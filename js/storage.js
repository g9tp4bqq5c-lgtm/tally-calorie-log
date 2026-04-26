// Tally — localStorage helpers (entries, settings, cache)
// Attaches to window.Tally.storage so plain <script> tags can share state.
(function () {
  'use strict';

  const ENTRIES_KEY = 'tally.entries.v1';
  const SETTINGS_KEY = 'tally.settings.v1';
  const CACHE_KEY = 'tally.cache.v2';
  const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

  const DEFAULT_SETTINGS = {
    usdaKey: '',
    nutritionixAppId: '',
    nutritionixAppKey: '',
    openFoodFactsEnabled: true,
    dailyGoal: null,
  };

  function safeParse(json, fallback) {
    try { return json ? JSON.parse(json) : fallback; }
    catch (_) { return fallback; }
  }

  function todayKey(date) {
    const d = date instanceof Date ? date : new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function dateKeyFromOffset(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return todayKey(d);
  }

  // ----- Entries (keyed by date string) -----
  function loadAllEntries() {
    return safeParse(localStorage.getItem(ENTRIES_KEY), {});
  }

  function loadEntriesFor(dateKey) {
    const all = loadAllEntries();
    return all[dateKey] || [];
  }

  function loadTodayEntries() {
    return loadEntriesFor(todayKey());
  }

  function saveTodayEntries(entries) {
    const all = loadAllEntries();
    all[todayKey()] = entries;
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(all));
  }

  function addEntry(entry) {
    const entries = loadTodayEntries();
    entries.unshift(entry);
    saveTodayEntries(entries);
  }

  function deleteEntry(ts) {
    const entries = loadTodayEntries().filter(e => e.ts !== ts);
    saveTodayEntries(entries);
  }

  function totalCaloriesFor(dateKey) {
    return loadEntriesFor(dateKey).reduce((s, e) => s + (e.calories || 0), 0);
  }

  function lastNDays(n) {
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
      const key = dateKeyFromOffset(i);
      days.push({
        date: key,
        total: totalCaloriesFor(key),
        count: loadEntriesFor(key).length,
        offset: i,
      });
    }
    return days;
  }

  // ----- Settings -----
  function loadSettings() {
    const stored = safeParse(localStorage.getItem(SETTINGS_KEY), {});
    return Object.assign({}, DEFAULT_SETTINGS, stored);
  }

  function saveSettings(partial) {
    const merged = Object.assign({}, loadSettings(), partial);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    return merged;
  }

  // ----- Cache (search results, 7-day TTL) -----
  function hashKey(s) {
    // djb2-ish — fine for cache keys, not security
    let h = 5381;
    const str = String(s);
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36);
  }

  function loadCache() {
    return safeParse(localStorage.getItem(CACHE_KEY), {});
  }

  function saveCache(cache) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  }

  function cacheGet(key) {
    const cache = loadCache();
    const entry = cache[key];
    if (!entry) return null;
    if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
      delete cache[key];
      saveCache(cache);
      return null;
    }
    return entry.value;
  }

  function cacheSet(key, value) {
    const cache = loadCache();
    cache[key] = { savedAt: Date.now(), value };
    // simple cap: keep most recent 200 entries
    const keys = Object.keys(cache);
    if (keys.length > 200) {
      keys
        .map(k => [k, cache[k].savedAt])
        .sort((a, b) => a[1] - b[1])
        .slice(0, keys.length - 200)
        .forEach(([k]) => delete cache[k]);
    }
    saveCache(cache);
  }

  function cacheKeyFor(query) {
    return hashKey(String(query).trim().toLowerCase());
  }

  // ----- Export / import / wipe -----
  function exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: loadAllEntries(),
      settings: loadSettings(),
    };
  }

  function importAll(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid import file');
    }
    if (payload.entries && typeof payload.entries === 'object') {
      localStorage.setItem(ENTRIES_KEY, JSON.stringify(payload.entries));
    }
    if (payload.settings && typeof payload.settings === 'object') {
      const merged = Object.assign({}, DEFAULT_SETTINGS, payload.settings);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    }
  }

  function clearAll() {
    localStorage.removeItem(ENTRIES_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(CACHE_KEY);
  }

  window.Tally = window.Tally || {};
  window.Tally.storage = {
    todayKey,
    dateKeyFromOffset,
    loadAllEntries,
    loadEntriesFor,
    loadTodayEntries,
    saveTodayEntries,
    addEntry,
    deleteEntry,
    totalCaloriesFor,
    lastNDays,
    loadSettings,
    saveSettings,
    cacheGet,
    cacheSet,
    cacheKeyFor,
    exportAll,
    importAll,
    clearAll,
  };
})();
