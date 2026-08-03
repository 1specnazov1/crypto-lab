'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const n = (value, digits = 0) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const ms = value => Number(value || 0) < 1000 ? `${n(value)} ms` : `${n(Number(value || 0) / 1000, 2)} s`;
  const when = value => value ? new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
  const lang = localStorage.getItem('cryptoLabLanguage') || 'ru';
  const T = {
    ru: { title: 'Диагностика CRYPTO LAB AI', period: 'Период', refresh: 'Обновить AI', runs: 'Запросы', success: 'Успешность', users: 'Пользователи', quota: 'Лимит', rate: 'Rate limit', avg: 'Среднее время', p95: 'P95 время', tokens: 'Всего токенов', quality: 'Качество / 5', models: 'Модели и стоимость нагрузки', errors: 'Ошибки и отказы', failures: 'Последние проблемные запросы', model: 'Модель', count: 'Запросы', duration: 'Среднее время', code: 'Код', seen: 'Последний случай', email: 'Email', market: 'Рынок', status: 'Статус', message: 'Сообщение', empty: 'Нет данных', loading: 'Загрузка AI-диагностики…' },
    uk: { title: 'Діагностика CRYPTO LAB AI', period: 'Період', refresh: 'Оновити AI', runs: 'Запити', success: 'Успішність', users: 'Користувачі', quota: 'Ліміт', rate: 'Rate limit', avg: 'Середній час', p95: 'P95 час', tokens: 'Усього токенів', quality: 'Якість / 5', models: 'Моделі та навантаження', errors: 'Помилки та відмови', failures: 'Останні проблемні запити', model: 'Модель', count: 'Запити', duration: 'Середній час', code: 'Код', seen: 'Останній випадок', email: 'Email', market: 'Ринок', status: 'Статус', message: 'Повідомлення', empty: 'Немає даних', loading: 'Завантаження AI-діагностики…' },
    en: { title: 'CRYPTO LAB AI diagnostics', period: 'Period', refresh: 'Refresh AI', runs: 'Requests', success: 'Success rate', users: 'Users', quota: 'Quota rejects', rate: 'Rate limits', avg: 'Average time', p95: 'P95 time', tokens: 'Total tokens', quality: 'Quality / 5', models: 'Models and load', errors: 'Errors and rejections', failures: 'Recent problem requests', model: 'Model', count: 'Requests', duration: 'Average time', code: 'Code', seen: 'Last seen', email: 'Email', market: 'Market', status: 'Status', message: 'Message', empty: 'No data', loading: 'Loading AI diagnostics…' }
  };
  const t = T[lang] || T.ru;
  let busy = false;

  function styles() {
    if ($('adminAiTelemetryStyles')) return;
    const style = document.createElement('style');
    style.id = 'adminAiTelemetryStyles';
    style.textContent = '.aiops-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.aiops-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.aiops-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}.aiops-stat{background:var(--p2);border:1px solid var(--line);border-radius:8px;padding:10px}.aiops-stat span{display:block;color:var(--m);font-size:9px;text-transform:uppercase;letter-spacing:.06em}.aiops-stat b{display:block;font-size:18px;margin-top:5px}.aiops-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.aiops-card{background:var(--p);border:1px solid var(--line);border-radius:10px;padding:13px;min-width:0}.aiops-card h3{margin:0 0 9px}.aiops-table{overflow:auto;max-height:340px}.aiops-table table{min-width:650px}.aiops-muted{color:var(--m);padding:14px 0}.aiops-error{color:#ffc4cd;padding:10px;border:1px solid #f6465d44;background:#f6465d10;border-radius:8px}.aiops-badge{display:inline-flex;padding:3px 6px;border-radius:999px;border:1px solid var(--line);font-size:9px}.aiops-badge.completed{color:#9cf0ca;border-color:#0ecb8145}.aiops-badge.rejected,.aiops-badge.failed{color:#ffc4cd;border-color:#f6465d45}@media(max-width:900px){.aiops-stats{grid-template-columns:1fr 1fr}.aiops-grid{grid-template-columns:1fr}}@media(max-width:480px){.aiops-stats{grid-template-columns:1fr}.aiops-controls{width:100%}.aiops-controls select,.aiops-controls button{flex:1;min-height:42px}}';
    document.head.appendChild(style);
  }

  function panel() {
    if ($('aiOps')) return $('aiOps');
    const dashboard = $('dashboard');
    if (!dashboard) return null;
    styles();
    const section = document.createElement('section');
    section.id = 'aiOps';
    section.className = 'card';
    section.style.marginTop = '10px';
    section.innerHTML = `<div class="aiops-head"><div><h2>${t.title}</h2><div class="muted" id="aiOpsGenerated">—</div></div><div class="aiops-controls"><label class="muted" for="aiOpsPeriod">${t.period}</label><select id="aiOpsPeriod"><option value="1">24h</option><option value="7" selected>7 days</option><option value="30">30 days</option><option value="90">90 days</option></select><button id="aiOpsRefresh" class="gold">${t.refresh}</button></div></div><div id="aiOpsBody" class="aiops-muted">${t.loading}</div>`;
    dashboard.appendChild(section);
    $('aiOpsRefresh').onclick = load;
    $('aiOpsPeriod').onchange = load;
    return section;
  }

  function table(headers, rows) {
    if (!rows.length) return `<div class="aiops-muted">${t.empty}</div>`;
    return `<div class="aiops-table"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }

  function render(data) {
    const totals = data?.totals || {};
    const models = Array.isArray(data?.models) ? data.models : [];
    const errors = Array.isArray(data?.errors) ? data.errors : [];
    const failures = Array.isArray(data?.recent_failures) ? data.recent_failures : [];
    $('aiOpsGenerated').textContent = data?.generated_at ? `${data.period_days} days · ${new Date(data.generated_at).toLocaleString()}` : '—';
    $('aiOpsBody').innerHTML = `
      <div class="aiops-stats">
        <div class="aiops-stat"><span>${t.runs}</span><b>${n(totals.runs)}</b></div>
        <div class="aiops-stat"><span>${t.success}</span><b class="${Number(totals.success_rate) >= 95 ? 'pos' : Number(totals.success_rate) < 80 ? 'neg' : ''}">${n(totals.success_rate,2)}%</b></div>
        <div class="aiops-stat"><span>${t.users}</span><b>${n(totals.unique_users)}</b></div>
        <div class="aiops-stat"><span>${t.quota}</span><b>${n(totals.quota_rejections)}</b></div>
        <div class="aiops-stat"><span>${t.rate}</span><b>${n(totals.rate_rejections)}</b></div>
        <div class="aiops-stat"><span>${t.avg}</span><b>${ms(totals.avg_duration_ms)}</b></div>
        <div class="aiops-stat"><span>${t.p95}</span><b>${ms(totals.p95_duration_ms)}</b></div>
        <div class="aiops-stat"><span>${t.tokens}</span><b>${n(totals.total_tokens)}</b></div>
        <div class="aiops-stat"><span>${t.quality}</span><b class="${Number(totals.avg_quality_score) >= 4 ? 'pos' : Number(totals.avg_quality_score) < 3 ? 'neg' : ''}">${n(totals.avg_quality_score,2)}</b></div>
      </div>
      <div class="aiops-grid">
        <div class="aiops-card"><h3>${t.models}</h3>${table([t.model,t.count,t.tokens,t.duration],models.map(item=>`<tr><td><b>${esc(item.model)}</b></td><td>${n(item.runs)}</td><td>${n(item.tokens)}</td><td>${ms(item.avg_duration_ms)}</td></tr>`))}</div>
        <div class="aiops-card"><h3>${t.errors}</h3>${table([t.code,t.count,t.seen],errors.map(item=>`<tr><td><code>${esc(item.code)}</code></td><td>${n(item.count)}</td><td>${when(item.last_seen)}</td></tr>`))}</div>
      </div>
      <div class="aiops-card" style="margin-top:10px"><h3>${t.failures}</h3>${table([t.seen,t.email,t.status,t.market,t.code,t.message],failures.map(item=>`<tr><td>${when(item.created_at)}</td><td>${esc(item.email||'—')}</td><td><span class="aiops-badge ${esc(item.status)}">${esc(item.status)}</span></td><td>${esc(item.symbol||'—')} ${esc(item.interval||'')}</td><td><code>${esc(item.error_code||'—')}</code></td><td>${esc(item.error_message||'—')}</td></tr>`))}</div>`;
  }

  async function load() {
    if (busy || typeof sb === 'undefined') return;
    panel();
    busy = true;
    $('aiOpsRefresh').disabled = true;
    $('aiOpsBody').innerHTML = `<div class="aiops-muted">${t.loading}</div>`;
    try {
      const { data, error } = await sb.rpc('get_crypto_admin_ai_telemetry', { p_days: Number($('aiOpsPeriod').value || 7) });
      if (error) throw error;
      render(data || {});
    } catch (error) {
      $('aiOpsBody').innerHTML = `<div class="aiops-error">${esc(error?.message || error)}</div>`;
    } finally {
      busy = false;
      $('aiOpsRefresh').disabled = false;
    }
  }

  function boot() {
    const target = panel();
    if (!target) return;
    const dashboard = $('dashboard');
    if (dashboard && !dashboard.classList.contains('hide')) load();
    const refresh = $('refresh');
    if (refresh && !refresh.dataset.aiTelemetryHook) {
      refresh.dataset.aiTelemetryHook = '1';
      refresh.addEventListener('click', () => setTimeout(load, 0));
    }
  }

  const observer = new MutationObserver(boot);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  setInterval(boot, 1500);
  boot();
})();
