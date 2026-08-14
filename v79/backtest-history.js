'use strict';
(() => {
  const labels = {
    ru: { title:'Последние серверные бэктесты', note:'Хранятся только параметры и итоговая статистика, без сырых свечей', refresh:'Обновить', date:'Дата', status:'Статус', market:'Рынок', trades:'Сделок', net:'P&L', ret:'Доходность', duration:'Время', error:'Ошибка', empty:'История пока пуста', auth:'Требуется вход в аккаунт', exact:'Scanner v15 EXACT', classic:'Classic', parity:'Production parity: EMA / RSI / ADX / MACD / ATR / volume / BTC context / news / liquidity rank' },
    uk: { title:'Останні серверні бектести', note:'Зберігаються лише параметри та підсумкова статистика, без сирих свічок', refresh:'Оновити', date:'Дата', status:'Статус', market:'Ринок', trades:'Угод', net:'P&L', ret:'Дохідність', duration:'Час', error:'Помилка', empty:'Історія поки порожня', auth:'Потрібен вхід в акаунт', exact:'Scanner v15 EXACT', classic:'Classic', parity:'Production parity: EMA / RSI / ADX / MACD / ATR / volume / BTC context / news / liquidity rank' },
    en: { title:'Recent server backtests', note:'Only parameters and summary statistics are stored; raw candles are not retained', refresh:'Refresh', date:'Date', status:'Status', market:'Market', trades:'Trades', net:'P&L', ret:'Return', duration:'Time', error:'Error', empty:'No history yet', auth:'Sign in is required', exact:'Scanner v15 EXACT', classic:'Classic', parity:'Production parity: EMA / RSI / ADX / MACD / ATR / volume / BTC context / news / liquidity rank' }
  };
  const text = () => labels[typeof lang === 'string' ? lang : 'ru'] || labels.ru;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const format = (value, digits = 2) => Number(value).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const when = value => new Intl.DateTimeFormat(lang === 'uk' ? 'uk-UA' : lang === 'en' ? 'en-GB' : 'ru-RU', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(value));
  const money = value => (Number(value) >= 0 ? '+' : '') + '$' + format(value, 2);

  function mountEngineSwitch() {
    if (document.getElementById('backtestEngineSwitch')) return;
    const top = document.querySelector('.top');
    if (!top) return;
    const box = document.createElement('div');
    box.id = 'backtestEngineSwitch';
    box.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap';
    box.innerHTML = '<button id="scannerV15Exact" type="button" class="engine-tab exact"></button><button id="classicEngine" type="button" class="engine-tab active"></button><span id="engineParityNote" class="engine-parity"></span>';
    const brand = top.querySelector('.brand');
    if (brand?.nextSibling) top.insertBefore(box, brand.nextSibling); else top.appendChild(box);
    document.getElementById('scannerV15Exact').onclick = () => {
      const language = typeof lang === 'string' ? lang : 'ru';
      location.href = './backtest-v15.html?lang=' + encodeURIComponent(language) + '&from=classic';
    };
    document.getElementById('classicEngine').onclick = () => {};
  }

  function mount() {
    if (document.getElementById('serverBacktestHistory')) return;
    const style = document.createElement('style');
    style.id = 'serverBacktestHistoryStyles';
    style.textContent = '.status-pill{display:inline-flex;padding:3px 7px;border-radius:999px;border:1px solid var(--line);font-size:10px;font-weight:800}.status-pill.completed{color:#a7f3d0;border-color:#0ecb8155}.status-pill.rejected,.status-pill.failed{color:#ffc4cd;border-color:#f6465d55}.history-table{min-width:860px}.engine-tab{background:var(--p2,#1e2329);border:1px solid var(--l,#2b3139);color:#fff;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:800}.engine-tab.exact{border-color:#f0b90b88;color:#ffe58f;background:#f0b90b10}.engine-tab.active{border-color:#4d9fff66;color:#cce4ff;background:#4d9fff10}.engine-parity{color:var(--m,#98a2b3);font-size:10px;max-width:500px;white-space:normal}@media(max-width:900px){.engine-parity{display:none}}';
    document.head.appendChild(style);
    mountEngineSwitch();
    const footer = document.getElementById('footer');
    if (!footer) return;
    const section = document.createElement('section');
    section.id = 'serverBacktestHistory';
    section.className = 'card';
    section.innerHTML = '<div class="head"><div><h3 id="historyTitle"></h3><small id="historyNote"></small></div><button id="historyRefresh"></button></div><div class="table-wrap"><table class="history-table"><thead><tr><th id="historyDate"></th><th id="historyStatus"></th><th id="historyMarket"></th><th id="historyTrades"></th><th id="historyNet"></th><th id="historyReturn"></th><th id="historyDuration"></th><th id="historyError"></th></tr></thead><tbody id="historyBody"><tr><td colspan="8" class="empty">—</td></tr></tbody></table></div>';
    footer.before(section);
    document.getElementById('historyRefresh').onclick = load;
  }

  function applyLabels() {
    mount();
    mountEngineSwitch();
    const t = text();
    const map = { historyTitle:'title', historyNote:'note', historyRefresh:'refresh', historyDate:'date', historyStatus:'status', historyMarket:'market', historyTrades:'trades', historyNet:'net', historyReturn:'ret', historyDuration:'duration', historyError:'error', scannerV15Exact:'exact', classicEngine:'classic', engineParityNote:'parity' };
    Object.entries(map).forEach(([id, key]) => { const element = document.getElementById(id); if (element) element.textContent = t[key]; });
  }

  async function load() {
    applyLabels();
    const body = document.getElementById('historyBody');
    if (!body || typeof sb === 'undefined') return;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      body.innerHTML = `<tr><td colspan="8" class="empty">${text().auth}</td></tr>`;
      return;
    }
    const { data, error } = await sb
      .from('crypto_backtest_runs')
      .select('created_at,status,symbol,interval,trade_count,net_pnl,return_pct,duration_ms,error_code')
      .order('created_at', { ascending:false })
      .limit(20);
    if (error) {
      body.innerHTML = `<tr><td colspan="8" class="empty neg">${safe(error.message)}</td></tr>`;
      return;
    }
    const rows = data || [];
    body.innerHTML = rows.length ? rows.map(row => `<tr>
      <td>${when(row.created_at)}</td>
      <td><span class="status-pill ${safe(row.status)}">${safe(row.status)}</span></td>
      <td>${safe(row.symbol || '—')}USDT · ${safe(row.interval || '—')}</td>
      <td>${row.trade_count ?? '—'}</td>
      <td class="${Number(row.net_pnl) >= 0 ? 'pos' : 'neg'}">${row.net_pnl == null ? '—' : money(row.net_pnl)}</td>
      <td class="${Number(row.return_pct) >= 0 ? 'pos' : 'neg'}">${row.return_pct == null ? '—' : (Number(row.return_pct) >= 0 ? '+' : '') + format(row.return_pct, 2) + '%'}</td>
      <td>${row.duration_ms == null ? '—' : format(Number(row.duration_ms) / 1000, 2) + 's'}</td>
      <td class="neg">${safe(row.error_code || '—')}</td>
    </tr>`).join('') : `<tr><td colspan="8" class="empty">${text().empty}</td></tr>`;
  }

  function installRunGuard(){
    if(document.getElementById('backtestRunGuardScript'))return;
    const script=document.createElement('script');
    script.id='backtestRunGuardScript';
    script.src='./backtest-run-guard.js?v=7930free29';
    script.async=false;
    document.head.appendChild(script);
  }

  mount();
  const originalStatus = typeof status === 'function' ? status : null;
  if (originalStatus) {
    status = async function() {
      const result = await originalStatus();
      await load();
      return result;
    };
  }
  document.getElementById('lang')?.addEventListener('change',()=>setTimeout(applyLabels,0));
  installRunGuard();
  load();
})();
