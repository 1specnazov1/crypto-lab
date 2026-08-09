'use strict';
(() => {
  const chart = document.getElementById('chart');
  const rsiCanvas = document.getElementById('rsi');
  if (!chart || !rsiCanvas) return;

  if (!document.getElementById('chartInteractionStyles')) {
    const style = document.createElement('style');
    style.id = 'chartInteractionStyles';
    style.textContent = `
      .canvas-wrap{touch-action:none}
      #chart{cursor:crosshair}
      .chart-tooltip{position:absolute;z-index:6;display:none;min-width:205px;padding:9px 10px;border:1px solid #3a424c;border-radius:8px;background:rgba(14,18,23,.96);box-shadow:0 12px 30px rgba(0,0,0,.35);pointer-events:none;color:#dfe5ec;font-size:10px;line-height:1.5;font-variant-numeric:tabular-nums}
      .chart-tooltip.show{display:grid;gap:2px}
      .chart-tooltip b{font-size:11px;color:#fff;margin-bottom:2px}.chart-tooltip strong{color:#fff}.chart-tooltip .long{color:#0ecb81}.chart-tooltip .short{color:#f6465d}
      .chart-hint{position:absolute;left:12px;bottom:8px;z-index:4;padding:4px 7px;border-radius:6px;background:rgba(11,14,17,.72);color:#848e9c;font-size:9px;pointer-events:none;backdrop-filter:blur(4px)}
      @media(max-width:620px){.chart-tooltip{min-width:185px;font-size:9px}.chart-hint{display:none}}
    `;
    document.head.appendChild(style);
  }

  const state = {
    count: Math.max(40, Math.min(220, Number(storageGet('cryptoChartVisibleCandles')) || 120)),
    shift: 0,
    hoverGlobal: null,
    hoverX: null,
    hoverY: null,
    dragging: false,
    dragStartX: 0,
    dragStartShift: 0,
    lastTap: 0,
  };

  const tooltip = (() => {
    let el = document.getElementById('chartTooltip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'chartTooltip';
      el.className = 'chart-tooltip';
      document.querySelector('.canvas-wrap')?.appendChild(el);
    }
    return el;
  })();

  const hint = (() => {
    let el = document.getElementById('chartHint');
    if (!el) {
      el = document.createElement('div');
      el.id = 'chartHint';
      el.className = 'chart-hint';
      el.textContent = 'Колесо: масштаб · перетаскивание: история';
      document.querySelector('.canvas-wrap')?.appendChild(el);
    }
    return el;
  })();

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function view() {
    const total = candles.length;
    const count = clamp(Math.round(state.count), Math.min(24, total || 24), Math.max(24, total || 24));
    const maxShift = Math.max(0, total - count);
    state.shift = clamp(Math.round(state.shift), 0, maxShift);
    const end = Math.max(count, total - state.shift);
    const start = Math.max(0, end - count);
    return { start, end, count: end - start, rows: candles.slice(start, end) };
  }

  function formatTime(ms) {
    const d = new Date(ms);
    const locale = lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-GB' : 'ru-RU';
    if (tf === '1M') return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(d);
    if (tf === '1w' || tf === '1d') return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: tf === '1w' ? '2-digit' : undefined }).format(d);
    const date = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(d);
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    return `${date} ${time}`;
  }

  function fmtVol(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(2);
  }

  function drawPriceTag(ctx, x, y, text, bg, fg = '#0b0e11') {
    ctx.save();
    ctx.font = 'bold 10px system-ui';
    const width = Math.max(60, ctx.measureText(text).width + 12);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y - 9, width, 18);
    ctx.fillStyle = fg;
    ctx.fillText(text, x + 6, y + 4);
    ctx.restore();
  }

  drawMain = function drawMainEnhanced() {
    const { ctx, w, h } = fitCanvas(chart);
    ctx.clearRect(0, 0, w, h);
    if (!candles.length) return;

    const pad = { l: 12, r: 82, t: 20, b: 42 };
    const cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
    const current = view(), visible = current.rows, offset = current.start;
    if (!visible.length) return;

    const levels = [marketLevels.support, marketLevels.resistance, signal.entryLow, signal.entryHigh, signal.stop, signal.tp1, signal.tp2, signal.tp3].filter(Number.isFinite);
    let min = Math.min(...visible.map(c => c.low), ...levels), max = Math.max(...visible.map(c => c.high), ...levels);
    const margin = (max - min || 1) * .07; min -= margin; max += margin;
    const y = v => pad.t + (max - v) / (max - min || 1) * ch;
    const x = i => pad.l + (i + .5) / visible.length * cw;

    ctx.lineWidth = 1;
    ctx.font = '10px system-ui';
    for (let i = 0; i <= 6; i++) {
      const yy = pad.t + i / 6 * ch, val = max - i / 6 * (max - min);
      ctx.strokeStyle = '#20262d'; ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
      ctx.fillStyle = '#848e9c'; ctx.fillText(fmt(val), w - pad.r + 7, yy + 3);
    }

    const tickCount = Math.max(4, Math.min(8, Math.floor(cw / 125)));
    for (let i = 0; i <= tickCount; i++) {
      const idx = Math.min(visible.length - 1, Math.round(i / tickCount * (visible.length - 1)));
      const xx = x(idx);
      ctx.strokeStyle = '#1b2026'; ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, pad.t + ch); ctx.stroke();
      const label = formatTime(visible[idx].time);
      ctx.fillStyle = '#848e9c'; ctx.font = '10px system-ui';
      const tw = ctx.measureText(label).width;
      ctx.fillText(label, clamp(xx - tw / 2, pad.l, w - pad.r - tw), h - 12);
    }

    if (Number.isFinite(signal.entryLow) && Number.isFinite(signal.entryHigh)) {
      ctx.fillStyle = 'rgba(240,185,11,.10)';
      const y1 = y(Math.max(signal.entryLow, signal.entryHigh)), y2 = y(Math.min(signal.entryLow, signal.entryHigh));
      ctx.fillRect(pad.l, y1, cw, y2 - y1);
    }

    const bar = clamp(cw / visible.length * .68, 2, 18);
    visible.forEach((c, i) => {
      const xx = x(i), up = c.close >= c.open, col = up ? '#0ecb81' : '#f6465d';
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(xx, y(c.high)); ctx.lineTo(xx, y(c.low)); ctx.stroke();
      const top = Math.min(y(c.open), y(c.close)), height = Math.max(1, Math.abs(y(c.open) - y(c.close)));
      ctx.fillRect(xx - bar / 2, top, bar, height);
    });

    function line(values, color, width = 1) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); let started = false;
      visible.forEach((c, i) => {
        const v = values[offset + i]; if (!Number.isFinite(v)) return;
        const xx = x(i), yy = y(v); if (!started) { ctx.moveTo(xx, yy); started = true; } else ctx.lineTo(xx, yy);
      }); ctx.stroke();
    }
    line(ema20, '#f0b90b', 1.3); line(ema50, '#4d9fff', 1.3); line(ema200, '#a86bff', 1.3);

    function hline(v, color, label, dash = []) {
      if (!Number.isFinite(v)) return;
      const yy = y(v); ctx.save(); ctx.strokeStyle = color; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke(); ctx.setLineDash([]); drawPriceTag(ctx, w - pad.r + 4, yy, label, color); ctx.restore();
    }
    hline(marketLevels.support, '#4d9fff', 'S', [5, 4]); hline(marketLevels.resistance, '#f0b90b', 'R', [5, 4]);
    hline(signal.stop, '#f6465d', 'STOP'); hline(signal.tp1, '#0ecb81', 'TP1'); hline(signal.tp2, '#0ecb81', 'TP2'); hline(signal.tp3, '#0ecb81', 'TP3');

    const maxVol = Math.max(...visible.map(c => c.volume), 1), vh = ch * .18;
    visible.forEach((c, i) => { ctx.fillStyle = c.close >= c.open ? 'rgba(14,203,129,.26)' : 'rgba(246,70,93,.26)'; const hh = c.volume / maxVol * vh; ctx.fillRect(x(i) - bar / 2, pad.t + ch - hh, bar, hh); });

    const latest = candles.at(-1);
    if (latest && latest.time >= visible[0].time && latest.time <= visible.at(-1).time) {
      const yy = y(latest.close); ctx.save(); ctx.strokeStyle = '#0ecb81'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke(); ctx.setLineDash([]); drawPriceTag(ctx, w - pad.r + 4, yy, fmt(latest.close), '#0ecb81'); ctx.restore();
    }

    if (Number.isInteger(state.hoverGlobal) && state.hoverGlobal >= offset && state.hoverGlobal < current.end) {
      const local = state.hoverGlobal - offset, c = candles[state.hoverGlobal], xx = x(local), yy = clamp(state.hoverY ?? y(c.close), pad.t, pad.t + ch);
      ctx.save(); ctx.strokeStyle = '#8b949e'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, pad.t + ch); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke(); ctx.setLineDash([]);
      const cursorPrice = max - (yy - pad.t) / ch * (max - min); drawPriceTag(ctx, w - pad.r + 4, yy, fmt(cursorPrice), '#c5ccd6', '#101317');
      ctx.fillStyle = '#c5ccd6'; ctx.font = '10px system-ui'; const dateLabel = formatTime(c.time); const tw = ctx.measureText(dateLabel).width; ctx.fillRect(clamp(xx - tw / 2 - 5, pad.l, w - pad.r - tw - 10), h - 28, tw + 10, 18); ctx.fillStyle = '#101317'; ctx.fillText(dateLabel, clamp(xx - tw / 2, pad.l + 5, w - pad.r - tw - 5), h - 15); ctx.restore();
    }

    ctx.strokeStyle = '#2b3139'; ctx.beginPath(); ctx.moveTo(pad.l, pad.t + ch); ctx.lineTo(w - pad.r, pad.t + ch); ctx.stroke();
    hint.textContent = `${visible.length} свечей · колесо: масштаб · перетаскивание: история`;
  };

  drawRsi = function drawRsiEnhanced() {
    const { ctx, w, h } = fitCanvas(rsiCanvas); ctx.clearRect(0, 0, w, h);
    if (!candles.length) return;
    const current = view(), offset = current.start, visible = rsi14.slice(current.start, current.end);
    const pad = { l: 12, r: 82, t: 18, b: 18 }, cw = w - pad.l - pad.r, ch = h - pad.t - pad.b;
    const y = v => pad.t + (100 - v) / 100 * ch, x = i => pad.l + (i + .5) / Math.max(1, visible.length) * cw;

    ctx.fillStyle = 'rgba(246,70,93,.06)'; ctx.fillRect(pad.l, y(100), cw, y(70) - y(100));
    ctx.fillStyle = 'rgba(14,203,129,.05)'; ctx.fillRect(pad.l, y(30), cw, y(0) - y(30));
    ctx.font = '10px system-ui';
    [70, 50, 30].forEach(v => { ctx.strokeStyle = v === 50 ? '#2b3139' : '#3a414b'; ctx.setLineDash(v === 50 ? [] : [4, 4]); ctx.beginPath(); ctx.moveTo(pad.l, y(v)); ctx.lineTo(w - pad.r, y(v)); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#848e9c'; ctx.fillText(String(v), w - pad.r + 7, y(v) + 3); });
    ctx.fillStyle = '#9ba5b3'; ctx.font = 'bold 10px system-ui'; ctx.fillText('RSI 14', pad.l, 12);

    ctx.strokeStyle = '#eaecef'; ctx.lineWidth = 1.35; ctx.beginPath(); let started = false;
    visible.forEach((v, i) => { if (!Number.isFinite(v)) return; const xx = x(i), yy = y(v); if (!started) { ctx.moveTo(xx, yy); started = true; } else ctx.lineTo(xx, yy); }); ctx.stroke();

    const latestIdx = current.end - 1, latestRsi = rsi14[latestIdx];
    if (Number.isFinite(latestRsi)) { const col = latestRsi >= 70 ? '#f6465d' : latestRsi <= 30 ? '#0ecb81' : '#c5ccd6'; drawPriceTag(ctx, w - pad.r + 4, y(latestRsi), latestRsi.toFixed(1), col, col === '#c5ccd6' ? '#101317' : '#0b0e11'); }

    if (Number.isInteger(state.hoverGlobal) && state.hoverGlobal >= current.start && state.hoverGlobal < current.end) {
      const local = state.hoverGlobal - offset, value = rsi14[state.hoverGlobal];
      if (Number.isFinite(value)) { const xx = x(local); ctx.save(); ctx.strokeStyle = '#8b949e'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(xx, pad.t); ctx.lineTo(xx, pad.t + ch); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#eaecef'; ctx.beginPath(); ctx.arc(xx, y(value), 3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    }
  };

  function updateTooltip(clientX, clientY) {
    const rect = chart.getBoundingClientRect();
    if (!candles.length || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) { tooltip.classList.remove('show'); return; }
    const current = view(), visible = current.rows;
    const padL = 12, padR = 82, cw = Math.max(1, rect.width - padL - padR);
    const rel = clamp(clientX - rect.left - padL, 0, cw - 1);
    const local = clamp(Math.floor(rel / cw * visible.length), 0, visible.length - 1);
    const globalIndex = current.start + local, c = candles[globalIndex]; if (!c) return;
    state.hoverGlobal = globalIndex; state.hoverX = clientX - rect.left; state.hoverY = clientY - rect.top;
    const change = c.open ? (c.close - c.open) / c.open * 100 : 0, r = rsi14[globalIndex];
    tooltip.innerHTML = `<b>${formatTime(c.time)}</b><span>O <strong>${fmt(c.open)}</strong> · H <strong>${fmt(c.high)}</strong></span><span>L <strong>${fmt(c.low)}</strong> · C <strong>${fmt(c.close)}</strong></span><span>Изм. <strong class="${change >= 0 ? 'long' : 'short'}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</strong> · Vol <strong>${fmtVol(c.volume)}</strong></span><span>RSI14 <strong>${Number.isFinite(r) ? r.toFixed(1) : '—'}</strong></span>`;
    tooltip.classList.add('show');
    const left = state.hoverX > rect.width * .62 ? 12 : Math.min(rect.width - 225, state.hoverX + 14), top = state.hoverY < 125 ? state.hoverY + 16 : Math.max(12, state.hoverY - 112);
    tooltip.style.left = `${Math.max(8, left)}px`; tooltip.style.top = `${Math.max(8, top)}px`;
    requestAnimationFrame(draw);
  }

  chart.addEventListener('wheel', e => {
    e.preventDefault();
    if (!candles.length) return;
    const old = state.count, factor = e.deltaY < 0 ? .84 : 1.19;
    state.count = clamp(Math.round(old * factor), 24, Math.min(360, candles.length));
    storageSet('cryptoChartVisibleCandles', String(state.count));
    requestAnimationFrame(draw);
  }, { passive: false });

  chart.addEventListener('pointerdown', e => { if (e.button !== 0) return; state.dragging = true; state.dragStartX = e.clientX; state.dragStartShift = state.shift; chart.setPointerCapture?.(e.pointerId); chart.style.cursor = 'grabbing'; });
  chart.addEventListener('pointermove', e => {
    if (state.dragging && candles.length) {
      const rect = chart.getBoundingClientRect(), pixelsPerBar = Math.max(2, (rect.width - 94) / Math.max(1, state.count));
      const deltaBars = Math.round((e.clientX - state.dragStartX) / pixelsPerBar);
      state.shift = clamp(state.dragStartShift + deltaBars, 0, Math.max(0, candles.length - state.count));
      tooltip.classList.remove('show'); requestAnimationFrame(draw); return;
    }
    updateTooltip(e.clientX, e.clientY);
  });
  chart.addEventListener('pointerup', e => { state.dragging = false; chart.releasePointerCapture?.(e.pointerId); chart.style.cursor = 'crosshair'; updateTooltip(e.clientX, e.clientY); });
  chart.addEventListener('pointercancel', () => { state.dragging = false; chart.style.cursor = 'crosshair'; });
  chart.addEventListener('pointerleave', () => { if (state.dragging) return; state.hoverGlobal = null; tooltip.classList.remove('show'); requestAnimationFrame(draw); });
  chart.addEventListener('dblclick', () => { state.shift = 0; state.count = 120; storageSet('cryptoChartVisibleCandles', '120'); state.hoverGlobal = null; tooltip.classList.remove('show'); requestAnimationFrame(draw); });

  rsiCanvas.addEventListener('pointermove', e => {
    const rect = rsiCanvas.getBoundingClientRect(), current = view(), cw = Math.max(1, rect.width - 94), rel = clamp(e.clientX - rect.left - 12, 0, cw - 1), local = clamp(Math.floor(rel / cw * current.rows.length), 0, current.rows.length - 1);
    state.hoverGlobal = current.start + local; requestAnimationFrame(draw);
  });
  rsiCanvas.addEventListener('pointerleave', () => { state.hoverGlobal = null; requestAnimationFrame(draw); });

  const originalLoad = load;
  load = async function enhancedLoad(...args) { const result = await originalLoad.apply(this, args); state.shift = 0; requestAnimationFrame(draw); return result; };
  window.addEventListener('keydown', e => { if (e.key === 'Escape') { state.hoverGlobal = null; tooltip.classList.remove('show'); requestAnimationFrame(draw); } });
  setTimeout(() => requestAnimationFrame(draw), 0);
})();
