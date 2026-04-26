// Settings panel — bind inputs to storage, handle save/test/export/import/clear.
(function () {
  'use strict';

  function init({ onChange, toast }) {
    const panel = document.getElementById('settingsPanel');
    const toggle = document.getElementById('settingsToggle');
    const usda = document.getElementById('usdaKey');
    const nixId = document.getElementById('nixAppId');
    const nixKey = document.getElementById('nixAppKey');
    const off = document.getElementById('offEnabled');
    const goal = document.getElementById('goalInput');
    const saveBtn = document.getElementById('saveSettings');
    const testBtn = document.getElementById('testKeys');
    const testResult = document.getElementById('testResult');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');
    const clearBtn = document.getElementById('clearBtn');

    function load() {
      const s = window.Tally.storage.loadSettings();
      usda.value = s.usdaKey || '';
      nixId.value = s.nutritionixAppId || '';
      nixKey.value = s.nutritionixAppKey || '';
      off.checked = s.openFoodFactsEnabled !== false;
      goal.value = s.dailyGoal != null ? String(s.dailyGoal) : '';
    }

    toggle.addEventListener('click', () => {
      panel.classList.toggle('open');
      toggle.classList.toggle('active', panel.classList.contains('open'));
    });

    saveBtn.addEventListener('click', () => {
      const merged = window.Tally.storage.saveSettings({
        usdaKey: usda.value.trim(),
        nutritionixAppId: nixId.value.trim(),
        nutritionixAppKey: nixKey.value.trim(),
        openFoodFactsEnabled: off.checked,
        dailyGoal: goal.value ? parseInt(goal.value, 10) : null,
      });
      toast('Settings saved');
      onChange?.(merged);
    });

    testBtn.addEventListener('click', async () => {
      testResult.textContent = 'testing…';
      testResult.style.color = 'var(--muted)';
      const settings = window.Tally.storage.loadSettings();
      const out = await window.Tally.aggregator.ping(settings);
      testResult.textContent = out;
      testResult.style.color = 'var(--ink)';
    });

    exportBtn.addEventListener('click', () => {
      const data = window.Tally.storage.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `tally-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Exported');
    });

    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', async () => {
      const file = importFile.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const payload = JSON.parse(text);
        window.Tally.storage.importAll(payload);
        load();
        onChange?.(window.Tally.storage.loadSettings());
        toast('Imported');
      } catch (err) {
        toast('Import failed: ' + err.message);
      } finally {
        importFile.value = '';
      }
    });

    clearBtn.addEventListener('click', () => {
      const ok = window.confirm(
        'Erase all entries, settings, API keys, and cache from this browser? This cannot be undone.'
      );
      if (!ok) return;
      window.Tally.storage.clearAll();
      load();
      onChange?.(window.Tally.storage.loadSettings());
      toast('Cleared');
    });

    load();

    // Auto-open if no source is configured.
    const s = window.Tally.storage.loadSettings();
    const hasAny = s.usdaKey || (s.nutritionixAppId && s.nutritionixAppKey) || s.openFoodFactsEnabled;
    if (!hasAny) {
      panel.classList.add('open');
      toggle.classList.add('active');
    }
  }

  window.Tally = window.Tally || {};
  window.Tally.settingsUI = { init };
})();
