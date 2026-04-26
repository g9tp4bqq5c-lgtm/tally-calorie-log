// Log — today's entries view + tally header
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function init({ onChange }) {
    const tallyNumber = document.getElementById('tallyNumber');
    const tallyGoal = document.getElementById('tallyGoal');
    const logCount = document.getElementById('logCount');
    const entriesList = document.getElementById('entriesList');

    function render() {
      const entries = window.Tally.storage.loadTodayEntries();
      const settings = window.Tally.storage.loadSettings();
      const total = entries.reduce((s, e) => s + (e.calories || 0), 0);
      tallyNumber.textContent = total.toLocaleString();
      logCount.textContent = `${entries.length} ${entries.length === 1 ? 'item' : 'items'}`;

      if (settings.dailyGoal && settings.dailyGoal > 0) {
        const remaining = settings.dailyGoal - total;
        if (remaining >= 0) {
          tallyGoal.innerHTML = `<span class="under">${remaining.toLocaleString()} under goal of ${settings.dailyGoal}</span>`;
        } else {
          tallyGoal.innerHTML = `<span class="over">${Math.abs(remaining).toLocaleString()} over goal of ${settings.dailyGoal}</span>`;
        }
      } else {
        tallyGoal.textContent = '';
      }

      if (entries.length === 0) {
        entriesList.innerHTML = `
          <div class="empty">
            <div class="empty-mark">❦</div>
            <div>nothing recorded yet today</div>
          </div>`;
        return;
      }

      entriesList.innerHTML = entries
        .map(e => {
          const time = new Date(e.ts).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          });
          const portion = e.servingLabel
            ? escapeHtml(e.servingLabel)
            : (e.grams ? `${e.grams} g` : '1 serving');
          const src = e.source ? ` · ${escapeHtml(e.source)}` : '';
          return `
            <div class="entry">
              <div class="entry-name">
                ${escapeHtml(e.name)}
                <small>${portion} · ${escapeHtml(time)}${src}</small>
              </div>
              <div class="entry-cals">${e.calories}</div>
              <button class="entry-delete" data-ts="${e.ts}" title="Remove">✕</button>
            </div>`;
        })
        .join('');

      entriesList.querySelectorAll('.entry-delete').forEach(btn => {
        btn.addEventListener('click', () => {
          const ts = parseInt(btn.dataset.ts, 10);
          window.Tally.storage.deleteEntry(ts);
          render();
          onChange?.();
        });
      });
    }

    return { render };
  }

  window.Tally = window.Tally || {};
  window.Tally.logUI = { init };
})();
