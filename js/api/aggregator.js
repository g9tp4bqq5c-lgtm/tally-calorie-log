// Aggregator — runs configured sources in parallel, normalizes, groups by source.
(function () {
  'use strict';

  const SOURCES = [
    {
      id: 'usda',
      label: 'USDA',
      enabled: s => !!s.usdaKey,
      run: (q, s) => window.Tally.usda.search(q, s.usdaKey),
    },
    {
      id: 'nutritionix',
      label: 'Nutritionix',
      enabled: s => !!s.nutritionixAppId && !!s.nutritionixAppKey,
      run: (q, s) => window.Tally.nutritionix.search(q, s.nutritionixAppId, s.nutritionixAppKey),
    },
    {
      id: 'openfoodfacts',
      label: 'Open Food Facts',
      enabled: s => s.openFoodFactsEnabled !== false,
      run: () => null, // placeholder
    },
  ];
  // wire OFF runner here so we can read settings consistently
  SOURCES[2].run = (q) => window.Tally.openfoodfacts.search(q);

  function configuredSources(settings) {
    return SOURCES.filter(src => src.enabled(settings));
  }

  // Returns: { groups: [{ id, label, items, error }], any: bool, fromCache: bool }
  async function search(query, settings) {
    const trimmed = String(query || '').trim();
    if (!trimmed) return { groups: [], any: false, fromCache: false };

    const cacheKey = window.Tally.storage.cacheKeyFor(trimmed);
    const cached = window.Tally.storage.cacheGet(cacheKey);
    if (cached) {
      return { groups: cached, any: cached.some(g => g.items && g.items.length), fromCache: true };
    }

    const sources = configuredSources(settings);
    if (sources.length === 0) {
      return {
        groups: [],
        any: false,
        fromCache: false,
        configError:
          'No food sources configured. Open Settings and add at least one API key (USDA is fastest).',
      };
    }

    const settled = await Promise.allSettled(sources.map(s => s.run(trimmed, settings)));

    const groups = settled.map((res, i) => {
      const src = sources[i];
      if (res.status === 'rejected') {
        return { id: src.id, label: src.label, items: [], error: res.reason?.message || 'failed' };
      }
      const v = res.value || {};
      return {
        id: src.id,
        label: src.label,
        items: v.items || [],
        error: v.error || null,
      };
    });

    // sort items within each group: high-confidence first, then those with calories
    groups.forEach(g => {
      g.items.sort((a, b) => {
        const conf = { high: 0, medium: 1, low: 2 };
        const ca = conf[a.confidence] ?? 3;
        const cb = conf[b.confidence] ?? 3;
        if (ca !== cb) return ca - cb;
        if (a.calories == null && b.calories != null) return 1;
        if (a.calories != null && b.calories == null) return -1;
        return 0;
      });
    });

    const any = groups.some(g => g.items.length > 0);
    if (any) {
      window.Tally.storage.cacheSet(cacheKey, groups);
    }
    return { groups, any, fromCache: false };
  }

  // Resolve a normalized item that needs a follow-up call (Nutritionix common items).
  async function resolveItem(item, settings) {
    if (!item.needsLookup) return item;
    if (item.source === 'nutritionix') {
      const { nutritionixAppId: id, nutritionixAppKey: key } = settings;
      if (item.raw?.kind === 'branded' && item.raw.nix_item_id) {
        const r = await window.Tally.nutritionix.resolveBranded(item.raw.nix_item_id, id, key);
        return Object.assign({}, item, r, { needsLookup: false });
      }
      if (item.raw?.kind === 'common' && item.raw.food_name) {
        const r = await window.Tally.nutritionix.resolveCommon(item.raw.food_name, id, key);
        return Object.assign({}, item, r, { needsLookup: false });
      }
    }
    return item;
  }

  // Compute calories for a given gram weight, falling back to per-serving when no per-100g data.
  function caloriesForGrams(item, grams) {
    if (typeof item.caloriesPer100g === 'number') {
      return Math.round((item.caloriesPer100g * grams) / 100);
    }
    if (typeof item.calories === 'number') {
      // No per-100g rate — return the per-serving value as-is.
      return item.calories;
    }
    return null;
  }

  async function ping(settings) {
    const lines = [];
    const sources = configuredSources(settings);
    if (sources.length === 0) {
      return 'No sources configured.';
    }
    const checks = await Promise.allSettled(
      sources.map(src => {
        if (src.id === 'usda') return window.Tally.usda.ping(settings.usdaKey);
        if (src.id === 'nutritionix')
          return window.Tally.nutritionix.ping(settings.nutritionixAppId, settings.nutritionixAppKey);
        return window.Tally.openfoodfacts.ping();
      })
    );
    checks.forEach((res, i) => {
      const src = sources[i];
      if (res.status === 'fulfilled') {
        const r = res.value;
        lines.push(`${r.ok ? '✓' : '✗'} ${src.label} — ${r.message}`);
      } else {
        lines.push(`✗ ${src.label} — ${res.reason?.message || 'failed'}`);
      }
    });
    return lines.join('\n');
  }

  window.Tally = window.Tally || {};
  window.Tally.aggregator = { search, ping, resolveItem, caloriesForGrams, configuredSources };
})();
