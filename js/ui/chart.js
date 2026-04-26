// Zero-dependency canvas bar chart for the 7-day history view.
(function () {
  'use strict';

  function readVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function draw(canvas, days, goal) {
    if (!canvas || !canvas.getContext) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 680;
    const cssH = canvas.clientHeight || 180;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const ink = readVar('--ink', '#1a1a1a');
    const muted = readVar('--muted', '#6b6256');
    const rule = readVar('--rule', '#c9c0aa');
    const accent = readVar('--accent', '#8b2c1c');
    const moss = readVar('--moss', '#4a5a3a');
    const paper = readVar('--paper', '#f4f0e8');

    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, cssW, cssH);

    const padL = 36, padR = 12, padT = 14, padB = 28;
    const w = cssW - padL - padR;
    const h = cssH - padT - padB;

    const max = Math.max(
      goal || 0,
      ...days.map(d => d.total),
      100
    );
    const niceMax = Math.ceil(max / 250) * 250;

    // Axis
    ctx.strokeStyle = rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT);
    ctx.lineTo(padL, padT + h);
    ctx.lineTo(padL + w, padT + h);
    ctx.stroke();

    // Y-axis ticks (3 levels)
    ctx.fillStyle = muted;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    [0, 0.5, 1].forEach(frac => {
      const v = Math.round(niceMax * frac);
      const y = padT + h - h * frac;
      ctx.strokeStyle = rule;
      ctx.beginPath();
      ctx.moveTo(padL - 3, y);
      ctx.lineTo(padL, y);
      ctx.stroke();
      ctx.fillText(String(v), padL - 6, y);
    });

    // Goal line
    if (goal && goal > 0) {
      const gy = padT + h - (h * goal) / niceMax;
      ctx.strokeStyle = moss;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(padL + w, gy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = moss;
      ctx.textAlign = 'left';
      ctx.fillText(`goal ${goal}`, padL + 4, gy - 8);
    }

    // Bars
    const n = days.length || 1;
    const slot = w / n;
    const barW = Math.max(8, Math.min(48, slot - 14));
    days.forEach((d, i) => {
      const x = padL + slot * i + (slot - barW) / 2;
      const bh = (h * d.total) / niceMax;
      const y = padT + h - bh;
      const over = goal && d.total > goal;
      ctx.fillStyle = over ? accent : ink;
      ctx.fillRect(x, y, barW, bh);

      // x-axis label (day-of-week)
      ctx.fillStyle = i === n - 1 ? ink : muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = "10px 'JetBrains Mono', monospace";
      const dow = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
      ctx.fillText(dow.toUpperCase(), x + barW / 2, padT + h + 6);
    });
  }

  window.Tally = window.Tally || {};
  window.Tally.chart = { draw };
})();
