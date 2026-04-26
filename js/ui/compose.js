// Compose — search + entry composer (renders results grouped by source)
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function init({ onLogged, toast }) {
    const foodInput = document.getElementById('foodInput');
    const gramsInput = document.getElementById('gramsInput');
    const searchBtn = document.getElementById('searchBtn');
    const resultsEl = document.getElementById('results');

    function statusHTML(msg) {
      return `<div class="results-status">${escapeHtml(msg)}</div>`;
    }

    function renderGroups(groups, grams) {
      resultsEl.innerHTML = '';
      groups.forEach(g => {
        const group = document.createElement('div');
        group.className = 'results-group';

        const header = document.createElement('div');
        header.className = 'results-group-header' + (g.items.length ? '' : ' empty');
        const right = g.error
          ? `<span class="count">${escapeHtml(g.error)}</span>`
          : `<span class="count">${g.items.length} ${g.items.length === 1 ? 'match' : 'matches'}</span>`;
        header.innerHTML = `<span>${escapeHtml(g.label)}</span>${right}`;
        group.appendChild(header);

        g.items.forEach(item => {
          const row = document.createElement('div');
          row.className = 'result-item';

          const calForGrams = window.Tally.aggregator.caloriesForGrams(item, grams);
          const calDisplay =
            item.needsLookup && calForGrams == null
              ? '— cal'
              : `${calForGrams != null ? calForGrams : '?'} cal`;

          const confClass = item.confidence === 'high'
            ? 'conf-high'
            : item.confidence === 'low' ? 'conf-low' : '';

          row.innerHTML = `
            <div class="result-name">${escapeHtml(item.name)}${item.brand ? ' <span class="result-brand">— ' + escapeHtml(item.brand) + '</span>' : ''}</div>
            <div class="result-meta">
              <span class="cal">${calDisplay}</span>
              · ${escapeHtml(item.servingLabel || '')}
              · <span class="${confClass}">${escapeHtml(item.confidence)}</span>
            </div>
          `;

          row.addEventListener('click', async () => {
            row.style.opacity = '0.5';
            try {
              const settings = window.Tally.storage.loadSettings();
              let resolved = item;
              if (item.needsLookup) {
                resolved = await window.Tally.aggregator.resolveItem(item, settings);
              }
              const cal = window.Tally.aggregator.caloriesForGrams(resolved, grams) ?? resolved.calories;
              if (cal == null) {
                toast('No calorie data');
                row.style.opacity = '';
                return;
              }
              const usingPer100 = typeof resolved.caloriesPer100g === 'number';
              const entry = {
                ts: Date.now(),
                name: resolved.name + (resolved.brand ? ` — ${resolved.brand}` : ''),
                grams: usingPer100 ? grams : (resolved.servingGrams || null),
                calories: cal,
                source: resolved.source,
                servingLabel: usingPer100 ? `${grams} g` : (resolved.servingLabel || ''),
              };
              window.Tally.storage.addEntry(entry);
              resultsEl.classList.remove('open');
              foodInput.value = '';
              foodInput.focus();
              onLogged?.();
              toast('Logged');
            } catch (err) {
              toast('Lookup failed: ' + err.message);
              row.style.opacity = '';
            }
          });

          group.appendChild(row);
        });

        resultsEl.appendChild(group);
      });
    }

    async function runSearch() {
      const q = foodInput.value.trim();
      if (!q) return;
      const grams = parseInt(gramsInput.value, 10) || 100;

      searchBtn.disabled = true;
      resultsEl.classList.add('open');
      resultsEl.innerHTML = statusHTML('searching the archive…');

      const settings = window.Tally.storage.loadSettings();
      const result = await window.Tally.aggregator.search(q, settings);
      searchBtn.disabled = false;

      if (result.configError) {
        resultsEl.innerHTML = statusHTML(result.configError);
        return;
      }
      if (!result.any) {
        resultsEl.innerHTML = statusHTML(
          result.groups.every(g => g.error)
            ? 'every source returned an error — check Settings'
            : 'nothing found for that term'
        );
        return;
      }
      renderGroups(result.groups, grams);
    }

    searchBtn.addEventListener('click', runSearch);
    foodInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') runSearch();
    });
    // re-render with new gram weight on the fly
    gramsInput.addEventListener('input', () => {
      const settings = window.Tally.storage.loadSettings();
      const cached = window.Tally.storage.cacheGet(
        window.Tally.storage.cacheKeyFor(foodInput.value.trim())
      );
      if (cached && resultsEl.classList.contains('open')) {
        renderGroups(cached, parseInt(gramsInput.value, 10) || 100);
      }
    });
  }

  window.Tally = window.Tally || {};
  window.Tally.composeUI = { init };
})();
