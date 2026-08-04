'use strict';
(() => {
  const BUILD = '7930';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const count = (data, key) => Number(data?.counts?.[key] || 0);
  const when = value => value ? new Date(value).toLocaleString() : '—';

  function installStyle() {
    if ($('signalOutboxAdminStyle')) return;
    const style = document.createElement('style');
    style.id = 'signalOutboxAdminStyle';
    style.textContent = `
      .outbox-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
      .outbox-stat{padding:10px;background:var(--p2);border:1px solid var(--line);border-radius:9px}
      .outbox-stat span{display:block;color:var(--m);font-size:9px;text-transform:uppercase;letter-spacing:.04em}
      .outbox-stat b{display:block;font-size:22px;margin-top:5px;font-variant-numeric:tabular-nums}
      .outbox-stat.warn b{color:#ffe58f}.outbox-stat.bad b{color:#ffc4cd}.outbox-stat.ok b{color:var(--ok)}
      .outbox-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:9px}
      .outbox-meta div{padding:9px;border:1px solid var(--line);border-radius:8px;background:#101317}
      .outbox-meta small{display:block;color:var(--m);margin-bottom:4px}.outbox-meta b{font-variant-numeric:tabular-nums}
      .outbox-table{width:100%;border-collapse:collapse;min-width:760px}.outbox-table th,.outbox-table td{padding:8px;border-top:1px solid var(--line);vertical-align:top}.outbox-table th{color:var(--m);font-size:9px;text-transform:uppercase;text-align:left}.outbox-error{max-width:380px;white-space:normal;overflow-wrap:anywhere;color:#ffc4cd}
      @media(max-width:900px){.outbox-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.outbox-meta{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:520px){.outbox-grid,.outbox-meta{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    installStyle();
    const dashboard = $('dashboard');
    if (!dashboard || $('signalOutboxAdminPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'signalOutboxAdminPanel';
    panel.className = 'card';
    panel.style.marginTop = '10px';
    panel.innerHTML = `
      <div class="request-head">
        <div><h3 style="margin:0">Очередь Telegram-событий</h3><div class="muted">Закрытый outbox monitor v5 · build ${BUILD}</div></div>
        <button id="refreshSignalOutbox">Обновить</button>
      </div>
      <div id="signalOutboxMessage" class="muted" style="margin-top:10px">Ожидание административной сессии…</div>
      <div id="signalOutboxContent" class="hide"></div>
    `;
    dashboard.appendChild(panel);
    $('refreshSignalOutbox').onclick = load;
  }

  function stat(label, value, className = '') {
    return `<div class="outbox-stat ${className}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  }

  function render(data) {
    const failures = Array.isArray(data?.recent_failures) ? data.recent_failures : [];
    const deliveries = Array.isArray(data?.recent_deliveries) ? data.recent_deliveries : [];
    const failureRows = failures.map(item => `<tr><td>${esc(item.event_type)}</td><td>${esc(item.status)}</td><td>${esc(item.attempts)}</td><td>${when(item.updated_at)}</td><td class="outbox-error">${esc(item.last_error || '—')}</td></tr>`).join('');
    const deliveryRows = deliveries.map(item => `<tr><td>${esc(item.event_type)}</td><td>${esc(item.status)}</td><td>${esc(item.attempts)}</td><td>${esc(item.telegram_message_id || '—')}</td><td>${when(item.sent_at)}</td><td>${esc(item.delivery_latency_ms ?? '—')} ms</td></tr>`).join('');
    const unsent = count(data, 'pending') + count(data, 'retry') + count(data, 'processing') + count(data, 'dead');

    $('signalOutboxContent').innerHTML = `
      <div class="outbox-grid" style="margin-top:12px">
        ${stat('Pending', count(data, 'pending'), count(data, 'pending') ? 'warn' : 'ok')}
        ${stat('Retry', count(data, 'retry'), count(data, 'retry') ? 'warn' : 'ok')}
        ${stat('Processing', count(data, 'processing'), count(data, 'processing') ? 'warn' : 'ok')}
        ${stat('Dead', count(data, 'dead'), count(data, 'dead') ? 'bad' : 'ok')}
        ${stat('Sent', count(data, 'sent'), 'ok')}
      </div>
      <div class="outbox-meta">
        <div><small>Неотправлено всего</small><b>${esc(unsent)}</b></div>
        <div><small>Старейшее неотправленное</small><b>${esc(data?.oldest_unsent_age_minutes == null ? '—' : `${data.oldest_unsent_age_minutes} мин`)}</b></div>
        <div><small>Retry просрочен</small><b>${esc(data?.retry_due || 0)}</b></div>
        <div><small>Зависло processing</small><b>${esc(data?.stuck_processing || 0)}</b></div>
        <div><small>Отправлено за 24ч</small><b>${esc(data?.sent_24h || 0)}</b></div>
        <div><small>Ошибок за 24ч</small><b>${esc(data?.failed_24h || 0)}</b></div>
        <div><small>Старейшая дата</small><b>${when(data?.oldest_unsent_created_at)}</b></div>
        <div><small>Срез сформирован</small><b>${when(data?.generated_at)}</b></div>
      </div>
      <h3 style="margin-top:16px">Последние доставки</h3>
      <div class="table"><table class="outbox-table"><thead><tr><th>Событие</th><th>Статус</th><th>Попытки</th><th>Telegram ID</th><th>Отправлено</th><th>Задержка</th></tr></thead><tbody>${deliveryRows || '<tr><td colspan="6" class="muted">Доставок пока нет</td></tr>'}</tbody></table></div>
      <h3 style="margin-top:16px">Последние ошибки</h3>
      <div class="table"><table class="outbox-table"><thead><tr><th>Событие</th><th>Статус</th><th>Попытки</th><th>Обновлено</th><th>Ограниченная ошибка</th></tr></thead><tbody>${failureRows || '<tr><td colspan="5" class="muted">Ошибок нет</td></tr>'}</tbody></table></div>
    `;
    $('signalOutboxMessage').classList.add('hide');
    $('signalOutboxContent').classList.remove('hide');
  }

  async function load() {
    mount();
    const button = $('refreshSignalOutbox');
    const message = $('signalOutboxMessage');
    if (button) button.disabled = true;
    if (message) { message.textContent = 'Проверка очереди уведомлений…'; message.classList.remove('hide'); }
    try {
      if (typeof sb === 'undefined' || !sb?.rpc) throw new Error('Supabase client unavailable');
      const { data, error } = await sb.rpc('get_crypto_admin_signal_outbox_health');
      if (error) throw error;
      render(data || {});
    } catch (error) {
      if (message) { message.textContent = error?.message || String(error); message.classList.remove('hide'); }
    } finally {
      if (button) button.disabled = false;
    }
  }

  mount();
  const observer = new MutationObserver(() => {
    mount();
    if ($('dashboard') && !$('dashboard').classList.contains('hide') && !$('signalOutboxAdminLoaded')) {
      const marker = document.createElement('span');
      marker.id = 'signalOutboxAdminLoaded';
      marker.hidden = true;
      document.body.appendChild(marker);
      load();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  setTimeout(() => {
    mount();
    if ($('dashboard') && !$('dashboard').classList.contains('hide')) load();
  }, 900);
})();
