// Open Food Facts — packaged grocery items, no auth required
//
// Uses the v2 search API (faster + more stable than legacy /cgi/search.pl).
// Restricts results to English-language products via a server-side
// languages_tags filter, and only emits items that have an explicit
// product_name_en or generic_name_en — older multilingual fallbacks let
// French/Spanish names through.
(function () {
  'use strict';

  const SEARCH_URL = 'https://world.openfoodfacts.org/api/v2/search';
  const FIELDS = [
    'product_name_en',
    'generic_name_en',
    'brands',
    'nutriments',
    'code',
  ].join(',');

  function fetchWithTimeout(url, opts = {}, ms = 12000) {
    return Promise.race([
      fetch(url, opts),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), ms)
      ),
    ]);
  }

  function pickEnglishName(product) {
    if (product.product_name_en && product.product_name_en.trim()) {
      return product.product_name_en.trim();
    }
    if (product.generic_name_en && product.generic_name_en.trim()) {
      return product.generic_name_en.trim();
    }
    return null;
  }

  function detectConfidence(product) {
    if (product.brands) return 'high';
    if (product.product_name_en) return 'medium';
    return 'low';
  }

  function normalize(product) {
    const name = pickEnglishName(product);
    if (!name) return null;

    const nutr = product.nutriments || {};
    let cal100 = nutr['energy-kcal_100g'];
    if (cal100 == null && nutr['energy_100g'] != null) {
      // energy_100g is in kJ when energy-kcal not provided
      cal100 = nutr['energy_100g'] / 4.184;
    }
    if (cal100 == null) return null;

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
    // languages_tags=en:english filters server-side to products tagged as
    // English-language; we over-fetch (page_size=20) since the tag filter and
    // our English-name requirement both prune results.
    const url =
      `${SEARCH_URL}?search_terms=${encodeURIComponent(query)}` +
      `&page_size=20&lc=en` +
      `&languages_tags=${encodeURIComponent('en:english')}` +
      `&fields=${encodeURIComponent(FIELDS)}`;
    try {
      const res = await fetchWithTimeout(url, {}, 15000);
      if (!res.ok) {
        return { source: 'openfoodfacts', error: `Open Food Facts HTTP ${res.status}` };
      }
      const data = await res.json();
      const products = data.products || [];
      const items = products.map(normalize).filter(Boolean).slice(0, 8);
      return { source: 'openfoodfacts', items };
    } catch (err) {
      return { source: 'openfoodfacts', error: `Open Food Facts: ${err.message}` };
    }
  }

  async function ping() {
    try {
      const res = await fetchWithTimeout(
        `${SEARCH_URL}?search_terms=apple&page_size=1&fields=code&lc=en`,
        {},
        15000
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
