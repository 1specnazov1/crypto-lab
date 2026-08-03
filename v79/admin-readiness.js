'use strict';
(() => {
  const BUILD = '7930';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function installStyle() {
    if ($('adminReadinessStyle')) return;
    const style = document.createElement('style');
    style.id = 'adminReadinessStyle';
    style.textContent = `
      .readiness-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .readiness-score{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;padding:12px;background:var(--p2);border:1px solid var(--line);border-radius:10px}
      .readiness-score strong{font-size:30px;line-height:1;font-variant-numeric:tabular-nums}
      .readiness-score small{display:block;color:var(--m);margin-top:4px}
      .readiness-bar{height:8px;background:#252b33;border-radius:99px;overflow:hidden;margin-top:8px}
      .readiness-bar i{display:block;height:100%;background:linear-gradient(90deg,#4d9fff,#0ecb81);border-radius:inherit}
      .readiness-list{display:grid;gap:7px;margin-top:10px}
      .readiness-item{display:grid;grid-template-columns:auto 1fr;gap:9px;padding:9px;background:var(--p2);border:1px solid var(--line);border-radius:8px}
      .readiness-item .mark{font-weight:950}.readiness-item.ok .mark{color:var(--ok)}.readiness-item.bad .mark{color:var(--bad)}
      .readiness-item b{display:block}.readiness-item small{display:block;color:var(--m);margin-top:3px;overflow-wrap:anywhere}
      .readiness-blocker{padding:9px;border:1px solid #f6465d35;background:#f6465d0c;border-radius:8px}
      .readiness-blocker b{color:#ffc4cd}.readiness-blocker small{display:block;color:var(--m);margin-top:3px}
      .retention-table{width:100%;border-collapse:collapse;min-width:760px}.retention-table th,.retention-table td{padding:9px;border-top:1px solid var(--line);vertical-align:top}
      .retention-table th{color:var(--m);font-size:9px;text-transform:uppercase;text-align:left}.retention-table td{white-space:normal}
      .readiness-note{color:var(--m);margin:8px 0 0;line-height:1.55}
      @media(max-width:760px){.readiness-grid{grid-template-columns:1fr}.readiness-score{grid-template-columns:1fr}.readiness-score strong{font-size:26px}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    installStyle();
    const dashboard = $('dashboard');
    if (!dashboard || $('adminReadinessPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'adminReadinessPanel';
    panel.className = 'card';
    panel.style.marginTop = '10px';
    panel.innerHTML = `
      <div class="request-head">
        <div><h3 style="margin:0">Готовность к запуску</h3><div class="muted">Автоматизированная техническая оценка build ${BUILD}</div></div>
        <button id="refreshReadiness">Обновить оценку</button>
      </div>
      <div id="readinessMessage" class="muted" style="margin-top:10px">Ожидание административной сессии…</div>
      <div id="readinessContent" class="hide"></div>
    `;
    dashboard.appendChild(panel);
    $('refreshReadiness').onclick = load;
  }

  function scoreCard(title, score, note) {
    const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
    return `<div class="readiness-score"><strong>${safeScore}%</strong><div><b>${esc(title)}</b><small>${esc(note)}</small><div class="readiness-bar"><i style="width:${safeScore}%"></i></div></div></div>`;
  }

  function render(readiness, retention) {
    const checks = Array.isArray(readiness?.checks) ? readiness.checks : [];
    const blockers = Array.isArray(readiness?.blockers) ? readiness.blockers : [];
    const policies = Array.isArray(retention?.policies) ? retention.policies : Array.isArray(readiness?.automatic_retention) ? readiness.automatic_retention : [];
    const eligible = retention?.eligible_now && typeof retention.eligible_now === 'object' ? retention.eligible_now : {};

    const checksHtml = checks.map(item => `<div class="readiness-item ${item.passed ? 'ok' : 'bad'}"><span class="mark">${item.passed ? '✓' : '!'}</span><div><b>${esc(item.key)} · ${esc(item.weight)}%</b><small>${esc(item.detail)}</small></div></div>`).join('');
    const blockersHtml = blockers.length ? blockers.map(item => `<div class="readiness-blocker"><b>${esc(item.code)}</b><small>${esc(item.detail)} · ответственный контур: ${esc(item.owner)}</small></div>`).join('') : '<div class="readiness-item ok"><span class="mark">✓</span><div><b>Нет блокеров</b></div></div>';
    const policiesHtml = policies.map(item => {
      const eligibleCount = Object.prototype.hasOwnProperty.call(eligible, item.data_class) ? Number(eligible[item.data_class] || 0) : '—';
      return `<tr><td><b>${esc(item.data_class)}</b><div class="muted">${esc(item.description)}</div></td><td>${item.retention_days == null ? 'по политике / бессрочно' : `${esc(item.retention_days)} дней`}</td><td>${esc(item.enforcement_mode)}</td><td>${esc(eligibleCount)}</td></tr>`;
    }).join('');

    $('readinessContent').innerHTML = `
      <div class="readiness-grid" style="margin-top:12px">
        ${scoreCard('Техническая beta-готовность', readiness?.technical_beta_score, 'Автоматизированные UI, PWA, база, cron, privacy и release-gates.')}
        ${scoreCard('Публичный платный запуск', readiness?.paid_public_launch_score, 'Снижен до настройки цен, провайдера, Turnstile и бизнес-политик.')}
      </div>
      <p class="readiness-note">Рекомендация: <b>${esc(readiness?.recommendation || '—')}</b>. Оценка не заменяет ручную проверку физических устройств, merchant sandbox и подтверждение резервного копирования.</p>
      <div class="readiness-grid" style="margin-top:12px">
        <div><h3>Контрольные проверки</h3><div class="readiness-list">${checksHtml || '<div class="muted">Нет данных</div>'}</div></div>
        <div><h3>Блокеры запуска</h3><div class="readiness-list">${blockersHtml}</div></div>
      </div>
      <h3 style="margin-top:16px">Политика хранения данных</h3>
      <div class="table"><table class="retention-table"><thead><tr><th>Класс данных</th><th>Срок</th><th>Режим</th><th>Можно удалить сейчас</th></tr></thead><tbody>${policiesHtml || '<tr><td colspan="4" class="muted">Нет данных</td></tr>'}</tbody></table></div>
    `;
    $('readinessMessage').classList.add('hide');
    $('readinessContent').classList.remove('hide');
  }

  async function load() {
    mount();
    const button = $('refreshReadiness');
    if (button) button.disabled = true;
    const message = $('readinessMessage');
    if (message) { message.textContent = 'Проверка launch-readiness…'; message.classList.remove('hide'); }
    try {
      if (typeof sb === 'undefined' || !sb?.rpc) throw new Error('Supabase client unavailable');
      const [{ data: readiness, error: readinessError }, { data: retention, error: retentionError }] = await Promise.all([
        sb.rpc('get_crypto_launch_readiness'),
        sb.rpc('get_crypto_retention_preview')
      ]);
      if (readinessError) throw readinessError;
      if (retentionError) throw retentionError;
      render(readiness || {}, retention || {});
    } catch (error) {
      if (message) {
        message.textContent = error?.message || String(error);
        message.classList.remove('hide');
      }
    } finally {
      if (button) button.disabled = false;
    }
  }

  mount();
  const observer = new MutationObserver(() => {
    mount();
    if ($('dashboard') && !$('dashboard').classList.contains('hide') && !$('readinessLoaded')) {
      const marker = document.createElement('span');
      marker.id = 'readinessLoaded';
      marker.hidden = true;
      document.body.appendChild(marker);
      load();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  setTimeout(() => {
    mount();
    if ($('dashboard') && !$('dashboard').classList.contains('hide')) load();
  }, 800);
})();