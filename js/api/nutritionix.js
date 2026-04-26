// Nutritionix — restaurant chains, branded items
//   /v2/search/instant   → autocomplete-style search (common + branded lists)
//   /v2/natural/nutrients → full nutrition for a chosen item
(function () {
  'use strict';

  const INSTANT_URL = 'https://trackapi.nutritionix.com/v2/search/instant';
  const NATURAL_URL = 'https://trackapi.nutritionix.com/v2/natural/nutrients';
  const ITEM_URL = 'https://trackapi.nutritionix.com/v2/search/item';

  function fetchWithTimeout(url, opts = {}, ms = 12000) {
    return Promise.race([
      fetch(url, opts),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), ms)
      ),
    ]);
  }

  function authHeaders(appId, appKey) {
    return {
      'x-app-id': appId,
      'x-app-key': appKey,
      'Content-Type': 'application/json',
    };
  }

  function normalizeCommon(food) {
    // /search/instant common items lack calorie data — we mark them low-confidence
    // and provide enough info to fetch full data on click via /natural/nutrients.
    return {
      source: 'nutritionix',
      sourceLabel: 'Nutritionix',
      name: food.food_name || 'Unnamed',
      brand: null,
      servingLabel: food.serving_unit
        ? `${food.serving_qty || 1} ${food.serving_unit}`
        : '1 serving',
      servingGrams: null,
      calories: null,
      caloriesPer100g: null,
      confidence: 'medium',
      needsLookup: true,
      raw: { kind: 'common', food_name: food.food_name },
    };
  }

  function normalizeBranded(food) {
    const grams = food.serving_weight_grams || null;
    const cal = typeof food.nf_calories === 'number' ? Math.round(food.nf_calories) : null;
    const caloriesPer100g = grams && cal != null ? (cal / grams) * 100 : null;
    return {
      source: 'nutritionix',
      sourceLabel: 'Nutritionix',
      name: food.food_name || food.brand_name_item_name || 'Unnamed',
      brand: food.brand_name || null,
      servingLabel: food.serving_unit
        ? `${food.serving_qty || 1} ${food.serving_unit}${grams ? ` (${grams} g)` : ''}`
        : grams ? `${grams} g` : '1 serving',
      servingGrams: grams,
      calories: cal,
      caloriesPer100g,
      confidence: 'high',
      needsLookup: cal == null,
      raw: { kind: 'branded', nix_item_id: food.nix_item_id },
    };
  }

  async function search(query, appId, appKey) {
    if (!appId || !appKey) {
      return { source: 'nutritionix', error: 'No Nutritionix credentials set' };
    }
    const url = `${INSTANT_URL}?query=${encodeURIComponent(query)}`;
    try {
      const res = await fetchWithTimeout(url, {
        headers: authHeaders(appId, appKey),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return { source: 'nutritionix', error: `Invalid Nutritionix credentials (HTTP ${res.status})` };
        }
        if (res.status === 429) {
          return { source: 'nutritionix', error: 'Nutritionix daily limit reached' };
        }
        return { source: 'nutritionix', error: `Nutritionix HTTP ${res.status}` };
      }
      const data = await res.json();
      const common = (data.common || []).slice(0, 4).map(normalizeCommon);
      const branded = (data.branded || []).slice(0, 8).map(normalizeBranded);
      return { source: 'nutritionix', items: [...branded, ...common] };
    } catch (err) {
      return { source: 'nutritionix', error: `Nutritionix: ${err.message}` };
    }
  }

  // Resolve a "common" item (no calories yet) by sending its name to /natural/nutrients.
  async function resolveCommon(foodName, appId, appKey) {
    const res = await fetchWithTimeout(NATURAL_URL, {
      method: 'POST',
      headers: authHeaders(appId, appKey),
      body: JSON.stringify({ query: foodName }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const f = (data.foods || [])[0];
    if (!f) throw new Error('not found');
    const grams = f.serving_weight_grams || null;
    const cal = typeof f.nf_calories === 'number' ? Math.round(f.nf_calories) : null;
    return {
      name: f.food_name || foodName,
      servingLabel: f.serving_unit
        ? `${f.serving_qty || 1} ${f.serving_unit}${grams ? ` (${grams} g)` : ''}`
        : grams ? `${grams} g` : '1 serving',
      servingGrams: grams,
      calories: cal,
      caloriesPer100g: grams && cal != null ? (cal / grams) * 100 : null,
    };
  }

  async function resolveBranded(nixItemId, appId, appKey) {
    const url = `${ITEM_URL}?nix_item_id=${encodeURIComponent(nixItemId)}`;
    const res = await fetchWithTimeout(url, { headers: authHeaders(appId, appKey) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const f = (data.foods || [])[0];
    if (!f) throw new Error('not found');
    const grams = f.serving_weight_grams || null;
    const cal = typeof f.nf_calories === 'number' ? Math.round(f.nf_calories) : null;
    return {
      name: f.food_name || 'Unnamed',
      servingLabel: f.serving_unit
        ? `${f.serving_qty || 1} ${f.serving_unit}${grams ? ` (${grams} g)` : ''}`
        : grams ? `${grams} g` : '1 serving',
      servingGrams: grams,
      calories: cal,
      caloriesPer100g: grams && cal != null ? (cal / grams) * 100 : null,
    };
  }

  async function ping(appId, appKey) {
    if (!appId || !appKey) return { ok: false, message: 'no credentials set' };
    try {
      const res = await fetchWithTimeout(
        `${INSTANT_URL}?query=apple`,
        { headers: authHeaders(appId, appKey) },
        8000
      );
      if (res.ok) return { ok: true, message: 'connected' };
      return { ok: false, message: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  }

  window.Tally = window.Tally || {};
  window.Tally.nutritionix = { search, ping, resolveCommon, resolveBranded };
})();
