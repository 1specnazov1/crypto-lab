'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const number = (value, digits = 0) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const millis = value => {
    const ms = Number(value || 0);
    if (ms < 1000) return `${number(ms)} ms`;
    return `${number(ms / 1000, 2)} s`;
  };
  const date = value => value ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
  const labels = {
    ru: { title: 'Диагностика серверного бэктеста', period: 'Период', refresh: 'Обновить диагностику', runs: 'Запуски', success: 'Успешность', users: 'Пользователи', quota: 'Отказы по лимиту', average: 'Среднее время', p95: 'P95 время', trades: 'Сделок / запуск', ret: 'Средняя доходность', errors: 'Ошибки и отказы', profiles: 'Повторяемые профили', failures: 'Последние проблемные запуски', empty: 'Нет данных', loading: 'Загрузка диагностики…', code: 'Код', count: 'Количество', seen: 'Последний случай', market: 'Рынок', side: 'Side', profileRuns: 'Запуски', profileUsers: 'Пользователи', completed: 'Успешные', duration: 'Среднее время', email: 'Email', status: 'Статус', message: 'Сообщение' },
    uk: { title: 'Діагностика серверного бектесту', period: 'Період', refresh: 'Оновити діагностику', runs: 'Запуски', success: 'Успішність', users: 'Користувачі', quota: 'Відмови за лімітом', average: 'Середній час', p95: 'P95 час', trades: 'Угод / запуск', ret: 'Середня дохідність', errors: 'Помилки та відмови', profiles: 'Повторювані профілі', failures: 'Останні проблемні запуски', empty: 'Немає даних', loading: 'Завантаження діагностики…', code: 'Код', count: 'Кількість', seen: 'Останній випадок', market: 'Ринок', side: 'Side', profileRuns: 'Запуски', profileUsers: 'Користувачі', completed: 'Успішні', duration: 'Середній час', email: 'Email', status: 'Статус', message: 'Повідомлення' },
    en: { title: 'Server backtest diagnostics', period: 'Period', refresh: 'Refresh diagnostics', runs: 'Runs', success: 'Success rate', users: 'Users', quota: 'Quota rejections', average: 'Average time', p95: 'P95 time', trades: 'Trades / run', ret: 'Average return', errors: 'Errors and rejections', profiles: 'Repeated profiles', failures: 'Recent problem runs', empty: 'No data', loading: 'Loading diagnostics…', code: 'Code', count: 'Count', seen: 'Last seen', market: 'Market', side: 'Side', profileRuns: 'Runs', profileUsers: 'Users', completed: 'Completed', duration: 'Average time', email: 'Email', status: 'Status', message: 'Message' }
  };
  const lang = localStorage.getItem('cryptoLabLanguage') || 'ru';
  const t = labels[lang] || labels.ru;
  let loading = false;

  function addStyles() {
    if ($('adminTelemetryStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminTelemetryStyles';
    style.textContent = `
      .ops-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .ops-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.ops-controls select{min-width:120px}
      .ops-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}
      .ops-stat{background:var(--p2);border:1px solid var(--line);border-radius:8px;padding:10px}.ops-stat span{display:block;color:var(--m);font-size:9px;text-transform:uppercase;letter-spacing:.06em}.ops-stat b{display:block;font-size:18px;margin-top:5px}
      .ops-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.ops-card{background:var(--p);border:1px solid var(--line);border-radius:10px;padding:13px;min-width:0}.ops-card h3{margin:0 0 9px}
      .ops-table{overflow:auto;max-height:360px}.ops-table table{min-width:680px}.ops-table td code{color:#b9d9ff}.ops-muted{color:var(--m);padding:14px 0}.ops-error{color:#ffc4cd;padding:10px;border:1px solid #f6465d44;background:#f6465d10;border-radius:8px}
      .ops-badge{display:inline-flex;padding:3px 6px;border-radius:999px;border:1px solid var(--line);font-size:9px}.ops-badge.completed{color:#9cf0ca;border-color:#0ecb8145}.ops-badge.rejected,.ops-badge.failed{color:#ffc4cd;border-color:#f6465d45}
      @media(max-width:900px){.ops-stats{grid-template-columns:1fr 1fr}.ops-grid{grid-template-columns:1fr}}
      @media(max-width:480px){.ops-stats{grid-template-columns:1fr}.ops-controls{width:100%}.ops-controls select,.ops-controls button{flex:1;min-height:42px}}
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if ($('backtestOps')) return $('backtestOps');
    const dashboard = $('dashboard');
    if (!dashboard) return null;
    addStyles();
    const section = document.createElement('section');
    section.id = 'backtestOps';
    section.className = 'card';
    section.style.marginTop = '10px';
    section.innerHTML = `
      <div class="ops-head"><div><h2>${t.title}</h2><div class="muted" id="opsGenerated">—</div></div><div class="ops-controls"><label class="muted" for="opsPeriod">${t.period}</label><select id="opsPeriod"><option value="1">24h</option><option value="7" selected>7 days</option><option value="30">30 days</option><option value="90">90 days</option></select><button id="opsRefresh" class="gold">${t.refresh}</button></div></div>
      <div id="opsBody" class="ops-muted">${t.loading}</div>`;
    dashboard.appendChild(section);
    $('opsRefresh').onclick = load;
    $('opsPeriod').onchange = load;
    return section;
  }

  function table(headers, rows, emptyColspan) {
    if (!rows.length) return `<div class="ops-muted">${t.empty}</div>`;
    return `<div class="ops-table"><table><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }

  function render(data) {
    const totals = data?.totals || {};
    const errors = Array.isArray(data?.errors) ? data.errors : [];
    const profiles = Array.isArray(data?.profiles) ? data.profiles : [];
    const failures = Array.isArray(data?.recent_failures) ? data.recent_failures : [];
    $('opsGenerated').textContent = data?.generated_at ? `${data.period_days} days · ${new Date(data.generated_at).toLocaleString()}` : '—';
    $('opsBody').innerHTML = `
      <div class="ops-stats">
        <div class="ops-stat"><span>${t.runs}</span><b>${number(totals.runs)}</b></div>
        <div class="ops-stat"><span>${t.success}</span><b class="${Number(totals.success_rate) >= 95 ? 'pos' : Number(totals.success_rate) < 80 ? 'neg' : ''}">${number(totals.success_rate, 2)}%</b></div>
        <div class="ops-stat"><span>${t.users}</span><b>${number(totals.unique_users)}</b></div>
        <div class="ops-stat"><span>${t.quota}</span><b>${number(totals.quota_rejections)}</b></div>
        <div class="ops-stat"><span>${t.average}</span><b>${millis(totals.avg_duration_ms)}</b></div>
        <div class="ops-stat"><span>${t.p95}</span><b>${millis(totals.p95_duration_ms)}</b></div>
        <div class="ops-stat"><span>${t.trades}</span><b>${number(totals.avg_trades, 2)}</b></div>
        <div class="ops-stat"><span>${t.ret}</span><b class="${Number(totals.avg_return_pct) >= 0 ? 'pos' : 'neg'}">${number(totals.avg_return_pct, 4)}%</b></div>
      </div>
      <div class="ops-grid">
        <div class="ops-card"><h3>${t.errors}</h3>${table([t.code,t.count,t.seen], errors.map(item => `<tr><td><code>${escapeHtml(item.code)}</code></td><td>${number(item.count)}</td><td>${date(item.last_seen)}</td></tr>`), 3)}</div>
        <div class="ops-card"><h3>${t.profiles}</h3>${table([t.market,t.side,t.profileRuns,t.profileUsers,t.completed,t.duration], profiles.map(item => `<tr><td><b>${escapeHtml(item.symbol || '—')}USDT</b><div class="muted">${escapeHtml(item.interval || '—')}</div></td><td>${escapeHtml(item.side || '—')}</td><td>${number(item.runs)}</td><td>${number(item.users)}</td><td>${number(item.completed)}</td><td>${millis(item.avg_duration_ms)}</td></tr>`), 6)}</div>
      </div>
      <div class="ops-card" style="margin-top:10px"><h3>${t.failures}</h3>${table([t.seen,t.email,t.status,t.market,t.code,t.message], failures.map(item => `<tr><td>${date(item.created_at)}</td><td>${escapeHtml(item.email || '—')}</td><td><span class="ops-badge ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span></td><td>${escapeHtml(item.symbol || '—')} ${escapeHtml(item.interval || '')}</td><td><code>${escapeHtml(item.error_code || '—')}</code></td><td>${escapeHtml(item.error_message || '—')}</td></tr>`), 6)}</div>`;
  }

  async function load() {
    if (loading || typeof sb === 'undefined') return;
    ensurePanel();
    loading = true;
    $('opsRefresh').disabled = true;
    $('opsBody').innerHTML = `<div class="ops-muted">${t.loading}</div>`;
    try {
      const days = Number($('opsPeriod').value || 7);
      const { data, error } = await sb.rpc('get_crypto_admin_backtest_telemetry', { p_days: days });
      if (error) throw error;
      render(data || {});
    } catch (error) {
      $('opsBody').innerHTML = `<div class="ops-error">${escapeHtml(error?.message || error)}</div>`;
    } finally {
      loading = false;
      $('opsRefresh').disabled = false;
    }
  }

  function boot() {
    const panel = ensurePanel();
    if (!panel) return;
    const dashboard = $('dashboard');
    if (dashboard && !dashboard.classList.contains('hide')) load();
    const refresh = $('refresh');
    if (refresh && !refresh.dataset.telemetryHook) {
      refresh.dataset.telemetryHook = '1';
      refresh.addEventListener('click', () => setTimeout(load, 0));
    }
  }

  const observer = new MutationObserver(() => boot());
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  setInterval(boot, 1500);
  boot();
})();
