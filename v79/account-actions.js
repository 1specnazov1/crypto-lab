'use strict';
(() => {
  let installed = false;

  function install() {
    if (installed || typeof client === 'undefined' || !account || !session) return;
    const plans = document.getElementById('plans');
    if (!plans || !plans.children.length) return;
    installed = true;

    [...plans.querySelectorAll('.plan')].forEach(card => {
      const plan = card.querySelector('.plan-name')?.textContent?.trim();
      if (!['BASIC', 'PRO'].includes(plan) || plan === account.effective_plan) return;
      const button = document.createElement('button');
      button.className = 'btn gold';
      button.style.marginTop = '12px';
      button.textContent = lang === 'uk' ? 'Подати заявку' : lang === 'en' ? 'Request plan' : 'Оставить заявку';
      button.onclick = async () => {
        button.disabled = true;
        const { data, error } = await client.rpc('request_crypto_plan', { p_plan: plan, p_note: null });
        button.disabled = false;
        if (error) show(error.message, 'bad');
        else show(
          lang === 'uk' ? `Заявку на ${plan} створено.` : lang === 'en' ? `${plan} request created.` : `Заявка на ${plan} создана.`,
          'ok'
        );
      };
      card.appendChild(button);
    });

    if (account.profile?.role === 'admin') {
      const header = document.querySelector('.account-head > div:last-child');
      if (header && !document.getElementById('adminPanelBtn')) {
        const button = document.createElement('button');
        button.id = 'adminPanelBtn';
        button.className = 'btn';
        button.style.marginLeft = '6px';
        button.textContent = 'Admin';
        button.onclick = () => location.href = './admin.html';
        header.appendChild(button);
      }
    }
  }

  const observer = new MutationObserver(() => install());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(install, 1000);
  install();
})();