// Tally — main controller. Wires UI modules together and runs the render loop.
(function () {
  'use strict';

  function fmtMasthead(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).toUpperCase();
  }

  function makeToast() {
    const el = document.getElementById('toast');
    let timer;
    return function toast(msg) {
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => el.classList.remove('show'), 2200);
    };
  }

  function start() {
    document.getElementById('dateStamp').textContent = fmtMasthead(new Date());
    const toast = makeToast();

    const log = window.Tally.logUI.init({
      onChange: () => history.render(),
    });

    const history = window.Tally.historyUI.init();

    window.Tally.composeUI.init({
      onLogged: () => {
        log.render();
        history.render();
      },
      toast,
    });

    window.Tally.settingsUI.init({
      onChange: () => {
        log.render();
        history.render();
      },
      toast,
    });

    log.render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
