'use strict';
(() => {
  const labels = {
    ru: { action: 'Действия', chart: 'График', journal: 'В журнал' },
    uk: { action: 'Дії', chart: 'Графік', journal: 'У журнал' },
    en: { action: 'Actions', chart: 'Chart', journal: 'Journal' }
  };

  function text() {
    return labels[lang] || labels.ru;
  }

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function currentSignals() {
    const status = document.getElementById('status').value;
    const direction = document.getElementById('dir').value;
    const timeframe = document.getElementById('tf').value;
    const query = document.getElementById('search').value.trim().toUpperCase();
    return (DATA.signals || []).filter(signal =>
      !(status === 'live' && signal.status === 'CLOSED') &&
      (status === 'all' || status === 'live' || signal.status === status) &&
      (direction === 'all' || signal.direction === direction) &&
      (timeframe === 'all' || signal.timeframe === timeframe) &&
      (!query || signal.symbol.includes(query))
    );
  }

  function chartUrl(signal) {
    const params = new URLSearchParams({
      lang,
      symbol: signal.symbol || 'BTC',
      tf: ({ '5M': '5m', '1H': '1h', '4H': '4h' })[signal.timeframe] || '1h',
      direction: signal.direction || 'LONG'
    });
    [['entryLow', signal.entry_low], ['entryHigh', signal.entry_high], ['stop', signal.stop], ['tp1', signal.tp1], ['tp2', signal.tp2], ['tp3', signal.tp3]].forEach(([key, value]) => {
      if (finite(value) !== null) params.set(key, String(value));
    });
    return './chart.html?' + params.toString();
  }

  function journalUrl(signal) {
    const low = finite(signal.entry_low);
    const high = finite(signal.entry_high);
    const last = finite(signal.last_price);
    const midpoint = low !== null && high !== null ? (low + high) / 2 : (low ?? high ?? last);
    const entry = signal.entry_notified && last !== null ? last : midpoint;
    const params = new URLSearchParams({
      route: 'journal',
      lang,
      symbol: signal.symbol || 'BTC',
      direction: signal.direction || 'LONG',
      tf: signal.timeframe || '1H',
      sourceSignal: String(signal.id || ''),
      signalStatus: signal.status || 'WAITING'
    });
    if (entry !== null) params.set('entry', String(entry));
    [['entryLow', low], ['entryHigh', high], ['stop', signal.stop], ['tp', signal.tp1], ['tp2', signal.tp2], ['tp3', signal.tp3], ['strength', signal.strength]].forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') params.set(key, String(value));
    });
    const created = signal.activated_at || signal.created_at || signal.updated_at;
    if (created) params.set('signalTime', created);
    return './app.html?' + params.toString();
  }

  function addStyles() {
    if (document.getElementById('scannerActionStyles')) return;
    const style = document.createElement('style');
    style.id = 'scannerActionStyles';
    style.textContent = '.signal-actions{display:flex;gap:6px}.signal-actions button{padding:6px 8px;cursor:pointer}.signal-actions .journal{border-color:#f0b90b66;color:#ffe58f;background:#f0b90b12}';
    document.head.appendChild(style);
  }

  function enhance() {
    addStyles();
    const headerRow = document.querySelector('thead tr');
    if (headerRow && !document.getElementById('scannerActionsHead')) {
      const th = document.createElement('th');
      th.id = 'scannerActionsHead';
      headerRow.appendChild(th);
    }
    const actionHead = document.getElementById('scannerActionsHead');
    if (actionHead) actionHead.textContent = text().action;

    const body = document.getElementById('body');
    if (!body) return;
    const signals = currentSignals();
    const tableRows = [...body.querySelectorAll('tr')];
    if (!signals.length) {
      const empty = body.querySelector('.empty');
      if (empty) empty.colSpan = 12;
      return;
    }

    signals.forEach((signal, index) => {
      const row = tableRows[index];
      if (!row) return;
      let cell = row.querySelector('.scanner-actions-cell');
      if (!cell) {
        cell = document.createElement('td');
        cell.className = 'scanner-actions-cell';
        row.appendChild(cell);
      }
      cell.innerHTML = '';
      const box = document.createElement('div');
      box.className = 'signal-actions';
      const chart = document.createElement('button');
      chart.type = 'button';
      chart.textContent = text().chart;
      chart.onclick = () => { location.href = chartUrl(signal); };
      const journal = document.createElement('button');
      journal.type = 'button';
      journal.className = 'journal';
      journal.textContent = text().journal;
      journal.onclick = () => { window.top.location.href = journalUrl(signal); };
      box.append(chart, journal);
      cell.appendChild(box);
    });
  }

  const baseRender = render;
  render = function() {
    baseRender();
    enhance();
  };

  const language = document.getElementById('lang');
  if (language) language.addEventListener('change', () => setTimeout(enhance, 0));
  enhance();
})();