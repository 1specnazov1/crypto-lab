'use strict';
(() => {
  const EMAIL_LOCK_MESSAGE = {
    ru: 'Регистрация и восстановление пароля временно отключены до подключения защищённой почтовой отправки.',
    uk: 'Реєстрацію та відновлення пароля тимчасово вимкнено до підключення захищеного надсилання пошти.',
    en: 'Sign-up and password recovery are temporarily disabled until protected email delivery is configured.'
  };

  let accountActionsInstalled = false;
  let authSafetyInstalled = false;

  function safetyText() {
    return EMAIL_LOCK_MESSAGE[typeof lang === 'string' ? lang : 'ru'] || EMAIL_LOCK_MESSAGE.ru;
  }

  function showSafetyMessage() {
    if (typeof show === 'function') show(safetyText(), 'bad');
  }

  function installAuthSafetyLock() {
    if (authSafetyInstalled || typeof client === 'undefined') return;

    const signupTab = document.getElementById('signupTab');
    const signupForm = document.getElementById('signupForm');
    const resetButton = document.getElementById('resetBtn');
    const loginForm = document.getElementById('loginForm');
    const authCard = loginForm?.closest('.card');

    if (!signupTab || !signupForm || !resetButton || !loginForm || !authCard) return;
    authSafetyInstalled = true;

    signupTab.hidden = true;
    signupTab.disabled = true;
    signupForm.classList.add('hide');
    signupForm.querySelectorAll('input,button').forEach(element => {
      element.disabled = true;
      element.required = false;
    });
    signupForm.onsubmit = event => {
      event.preventDefault();
      showSafetyMessage();
    };

    resetButton.hidden = true;
    resetButton.disabled = true;
    resetButton.onclick = event => {
      event.preventDefault();
      showSafetyMessage();
    };

    const notice = document.createElement('div');
    notice.id = 'authEmailSafetyNotice';
    notice.className = 'msg show';
    notice.style.display = 'block';
    notice.style.marginTop = '12px';
    notice.textContent = safetyText();
    authCard.appendChild(notice);

    const originalTranslate = typeof translate === 'function' ? translate : null;
    if (originalTranslate) {
      window.translate = function translatedWithSafetyNotice(...args) {
        const result = originalTranslate.apply(this, args);
        const currentNotice = document.getElementById('authEmailSafetyNotice');
        if (currentNotice) currentNotice.textContent = safetyText();
        return result;
      };
    }

    try {
      client.auth.signUp = async () => ({
        data: { user: null, session: null },
        error: new Error(safetyText())
      });
      client.auth.resetPasswordForEmail = async () => ({
        data: null,
        error: new Error(safetyText())
      });
    } catch (error) {
      console.warn('Unable to override client auth email methods', error);
    }
  }

  function installAccountActions() {
    if (accountActionsInstalled || typeof client === 'undefined' || !account || !session) return;
    const plans = document.getElementById('plans');
    if (!plans || !plans.children.length) return;
    accountActionsInstalled = true;

    [...plans.querySelectorAll('.plan')].forEach(card => {
      const plan = card.querySelector('.plan-name')?.textContent?.trim();
      if (!['BASIC', 'PRO'].includes(plan) || plan === account.effective_plan) return;
      const button = document.createElement('button');
      button.className = 'btn gold';
      button.style.marginTop = '12px';
      button.textContent = lang === 'uk' ? 'Подати заявку' : lang === 'en' ? 'Request plan' : 'Оставить заявку';
      button.onclick = async () => {
        button.disabled = true;
        const { error } = await client.rpc('request_crypto_plan', { p_plan: plan, p_note: null });
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

  function install() {
    installAuthSafetyLock();
    installAccountActions();
  }

  const observer = new MutationObserver(install);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(install, 1000);
  install();
})();