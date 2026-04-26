// USDA FoodData Central — whole / raw foods
(function () {
  'use strict';

  const SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';

  function fetchWithTimeout(url, opts = {}, ms = 12000) {
    return Promise.race([
      fetch(url, opts),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), ms)
      ),
    ]);
  }

  function getCaloriesPer100g(food) {
    const cal = food.foodNutrients?.find(n =>
      (n.nutrientName === 'Energy' || n.nutrientName === 'Energy (Atwater General Factors)') &&
      (n.unitName === 'KCAL' || n.unitName === 'kcal')
    );
    return cal ? cal.value : null;
  }

  function detectConfidence(food, query) {
    const q = String(query).toLowerCase();
    const desc = String(food.description || '').toLowerCase();
    if (food.brandName || food.brandOwner) return 'high';
    if (desc.startsWith(q)) return 'high';
    if (desc.includes(q)) return 'medium';
    return 'low';
  }

  function normalize(food, query) {
    const cal100 = getCaloriesPer100g(food);
    if (cal100 == null) return null;
    return {
      source: 'usda',
      sourceLabel: 'USDA',
      name: food.description || 'Unnamed food',
      brand: food.brandName || food.brandOwner || null,
      servingLabel: '100 g',
      servingGrams: 100,
      calories: Math.round(cal100),
      caloriesPer100g: cal100,
      confidence: detectConfidence(food, query),
      raw: { dataType: food.dataType, fdcId: food.fdcId },
    };
  }

  async function search(query, key) {
    if (!key) {
      return { source: 'usda', error: 'No USDA key set' };
    }
    const url =
      `${SEARCH_URL}?api_key=${encodeURIComponent(key)}` +
      `&query=${encodeURIComponent(query)}` +
      `&pageSize=8` +
      `&dataType=Foundation,SR%20Legacy,Survey%20%28FNDDS%29,Branded`;
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return { source: 'usda', error: `Invalid USDA key (HTTP ${res.status})` };
        }
        if (res.status === 429) {
          return { source: 'usda', error: 'USDA rate limit hit' };
        }
        return { source: 'usda', error: `USDA HTTP ${res.status}` };
      }
      const data = await res.json();
      const foods = data.foods || [];
      const items = foods.map(f => normalize(f, query)).filter(Boolean);
      return { source: 'usda', items };
    } catch (err) {
      return { source: 'usda', error: `USDA: ${err.message}` };
    }
  }

  async function ping(key) {
    if (!key) return { ok: false, message: 'no key set' };
    try {
      const res = await fetchWithTimeout(
        `${SEARCH_URL}?api_key=${encodeURIComponent(key)}&query=apple&pageSize=1`,
        {},
        8000
      );
      if (res.ok) return { ok: true, message: 'connected' };
      return { ok: false, message: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  window.Tally = window.Tally || {};
  window.Tally.usda = { search, ping };
})();
