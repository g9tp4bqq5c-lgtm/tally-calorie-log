// History — 7-day chart + day detail list
(function () {
  'use strict';

  function init() {
    const panel = document.getElementById('historyPanel');
    const toggle = document.getElementById('historyToggle');
    const canvas = document.getElementById('historyChart');
    const detail = document.getElementById('historyDetail');

    function fmtDate(key) {
      return new Date(key + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }

    function render() {
      const days = window.Tally.storage.lastNDays(7);
      const settings = window.Tally.storage.loadSettings();
      window.Tally.chart.draw(canvas, days, settings.dailyGoal || 0);

      detail.innerHTML = days
        .slice()
        .reverse()
        .map(d => {
          const isToday = d.offset === 0;
          const goal = settings.dailyGoal;
          const delta = goal ? (d.total - goal) : null;
          const note = delta == null
            ? ''
            : (delta > 0 ? `+${delta} over` : (delta < 0 ? `${delta} under` : 'on goal'));
          return `
            <div class="day-row${isToday ? ' today' : ''}">
              <span>${fmtDate(d.date)}${isToday ? ' · today' : ''}</span>
              <span>${d.total.toLocaleString()} cal · ${d.count} ${d.count === 1 ? 'item' : 'items'}${note ? ' · ' + note : ''}</span>
            </div>`;
        })
        .join('');
    }

    toggle.addEventListener('click', () => {
      const opening = !panel.classList.contains('open');
      panel.classList.toggle('open', opening);
      toggle.classList.toggle('active', opening);
      if (opening) render();
    });

    window.addEventListener('resize', () => {
      if (panel.classList.contains('open')) render();
    });

    return { render };
  }

  window.Tally = window.Tally || {};
  window.Tally.historyUI = { init };
})();
