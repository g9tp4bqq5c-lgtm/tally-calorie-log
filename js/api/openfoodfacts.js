// Open Food Facts — packaged grocery items, no auth required
(function () {
  'use strict';

  const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';

  function fetchWithTimeout(url, opts = {}, ms = 12000) {
    return Promise.race([
      fetch(url, opts),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), ms)
      ),
    ]);
  }

  function detectConfidence(product) {
    if (product.brands) return 'high';
    if (product.product_name) return 'medium';
    return 'low';
  }

  function normalize(product) {
    const nutr = product.nutriments || {};
    // Energy in kcal per 100g; fall back to converting from kJ if needed.
    let cal100 = nutr['energy-kcal_100g'];
    if (cal100 == null && nutr['energy_100g'] != null) {
      // energy_100g is in kJ when energy-kcal not present
      cal100 = nutr['energy_100g'] / 4.184;
    }
    if (cal100 == null) return null;

    const name = product.product_name || product.generic_name;
    if (!name) return null;

    return {
      source: 'openfoodfacts',
      sourceLabel: 'Open Food Facts',
      name,
      brand: product.brands || null,
      servingLabel: '100 g',
      servingGrams: 100,
      calories: Math.round(cal100),
      caloriesPer100g: cal100,
      confidence: detectConfidence(product),
      raw: { code: product.code },
    };
  }

  async function search(query) {
    const url =
      `${SEARCH_URL}?search_terms=${encodeURIComponent(query)}` +
      `&search_simple=1&action=process&json=1&page_size=8` +
      `&fields=product_name,generic_name,brands,nutriments,code`;
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        return { source: 'openfoodfacts', error: `Open Food Facts HTTP ${res.status}` };
      }
      const data = await res.json();
      const products = data.products || [];
      const items = products.map(normalize).filter(Boolean);
      return { source: 'openfoodfacts', items };
    } catch (err) {
      return { source: 'openfoodfacts', error: `Open Food Facts: ${err.message}` };
    }
  }

  async function ping() {
    try {
      const res = await fetchWithTimeout(
        `${SEARCH_URL}?search_terms=apple&search_simple=1&action=process&json=1&page_size=1`,
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
  window.Tally.openfoodfacts = { search, ping };
})();
