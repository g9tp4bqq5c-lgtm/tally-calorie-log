// Open Food Facts — packaged grocery items, no auth required
//
// Uses the v2 search API. OFF's data quality is uneven: many products store
// French or Spanish text in their `product_name_en` field, and the server-side
// language filter doesn't reliably exclude them. So we filter twice on the
// client: (1) require `en:english` in `languages_tags`, (2) reject names that
// match unambiguous French/Spanish stop-words or food words.
(function () {
  'use strict';

  const SEARCH_URL = 'https://world.openfoodfacts.org/api/v2/search';
  const FIELDS = [
    'product_name_en',
    'generic_name_en',
    'brands',
    'nutriments',
    'code',
    'languages_tags',
  ].join(',');

  // Whole-word matches only. These are unambiguous in a food-product name —
  // English never uses "blanc/poulet/sans/pollo/pechuga" etc. as ordinary
  // vocabulary, even when borrowing French cuisine terms.
  const NON_ENGLISH_RE = new RegExp(
    '\\b(' + [
      // French
      'blanc', 'noir', 'rouge', 'jaune',
      'sans', 'avec', 'pour', 'aux', 'rôti', 'tranches?', 'broche',
      'poulet', 'boeuf', 'bœuf', 'porc', 'agneau', 'jambon', 'saumon',
      'fromage', 'beurre', 'lait',
      // Spanish
      'pollo', 'pescado', 'cerdo', 'pechuga', 'tiras', 'filete', 'rebanadas?',
      'queso', 'leche', 'mantequilla', 'manzana', 'fresa',
      'del', 'los', 'las', 'sin', 'con',
    ].join('|') + ')\\b',
    'i'
  );

  function fetchWithTimeout(url, opts = {}, ms = 12000) {
    return Promise.race([
      fetch(url, opts),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out')), ms)
      ),
    ]);
  }

  function pickEnglishName(product) {
    const tags = product.languages_tags || [];
    if (!tags.includes('en:english')) return null;
    const candidates = [product.product_name_en, product.generic_name_en];
    for (const c of candidates) {
      const trimmed = (c || '').trim();
      if (!trimmed) continue;
      if (NON_ENGLISH_RE.test(trimmed)) continue;
      return trimmed;
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
    // OFF v2 doesn't reliably honor a `languages_tags` query filter — passing
    // it caused fetches to fail outright in Safari ("load failed"). Rely on
    // client-side filtering in pickEnglishName instead, and over-fetch
    // (page_size=20) so the language pruning doesn't shrink the result list.
    const url =
      `${SEARCH_URL}?search_terms=${encodeURIComponent(query)}` +
      `&page_size=20&lc=en` +
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
