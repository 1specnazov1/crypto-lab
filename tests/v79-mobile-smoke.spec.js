import { test, expect } from '@playwright/test';

const ROUTES = ['analytics', 'scanner', 'ai', 'portfolio', 'calculator', 'backtest', 'journal', 'account'];
const ROUTE_FILES = {
  analytics: 'chart.html',
  scanner: 'scanner.html',
  ai: 'ai.html',
  portfolio: 'portfolio.html',
  calculator: 'calculator.html',
  backtest: 'backtest.html',
  journal: 'journal.html',
  account: 'account.html'
};

const SUPABASE_STUB = `
(() => {
  const ownerSession = { user: { id: 'owner-smoke', email: 'owner-smoke@example.invalid' } };
  let signedIn = true;
  let authCallback = null;
  const account = {
    effective_plan: 'FREE',
    profile: { display_name: 'Owner Smoke', language: 'ru', timezone: 'Europe/Kyiv', role: 'admin' },
    subscription: { status: 'active', current_period_end: null },
    limits: { daily_ai_requests: 3, daily_backtests: 3, daily_scanner_views: 10, max_portfolio_assets: 5, max_favorites: 10 },
    usage_today: { ai_requests: 0, backtests: 0, scanner_views: 0 },
    counts: { portfolio_assets: 0, favorites: 0 }
  };
  const plans = [
    { plan: 'FREE', display_order: 1, daily_ai_requests: 3, daily_backtests: 3, max_portfolio_assets: 5, max_favorites: 10 },
    { plan: 'BASIC', display_order: 2, daily_ai_requests: 30, daily_backtests: 20, max_portfolio_assets: 50, max_favorites: 100 },
    { plan: 'PRO', display_order: 3, daily_ai_requests: -1, daily_backtests: -1, max_portfolio_assets: -1, max_favorites: -1 }
  ];
  const chain = (table) => ({
    select() { return { order: async () => ({ data: table === 'crypto_plan_limits' ? plans : [], error: null }) }; },
    update() { return { eq: async () => ({ error: null }) }; },
    upsert: async () => ({ error: null })
  });
  const client = {
    auth: {
      getSession: async () => ({ data: { session: signedIn ? ownerSession : null }, error: null }),
      onAuthStateChange: (callback) => { authCallback = callback; return { data: { subscription: { unsubscribe() {} } } }; },
      signOut: async () => { signedIn = false; authCallback?.('SIGNED_OUT', null); return { error: null }; },
      signInWithPassword: async () => { signedIn = true; authCallback?.('SIGNED_IN', ownerSession); return { data: { session: ownerSession }, error: null }; },
      signUp: async () => ({ data: { session: null }, error: null }),
      resetPasswordForEmail: async () => ({ error: null }),
      updateUser: async () => ({ error: null })
    },
    rpc: async (name) => {
      if (name === 'get_my_crypto_account') return { data: account, error: null };
      if (name === 'get_crypto_feature_status') return { data: { allowed: true, remaining: 3, limit: 3 }, error: null };
      if (name === 'get_my_crypto_support_tickets') return { data: [], error: null };
      return { data: {}, error: null };
    },
    functions: {
      invoke: async (name) => {
        if (name === 'crypto-lab-v79-scanner') return { data: { signals: [], latest_run: {}, access: { quota: { remaining: 10, limit: 10 } } }, error: null };
        return { data: {}, error: null };
      }
    },
    from: chain
  };
  window.supabase = { createClient: () => client };
})();`;

async function stubExternalTraffic(page) {
  await page.route('https://**/*', async route => {
    const url = route.request().url();
    if (url.includes('/functions/v1/crypto-lab-v79-preview')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          latest_run: null,
          latest_monitor: null,
          active_signals: [],
          runs: []
        })
      });
    }
    if (url.includes('/functions/v1/crypto-lab-v79-register')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          enabled: false,
          registration_mode: 'disabled',
          site_key: null,
          captcha_provider: 'turnstile',
          captcha_action: 'crypto_register',
          password_min_length: 10,
          required_legal_keys: ['terms','privacy','refund','risk'],
          documents: [
            { key: 'terms', version: '2026-08-03', url: './terms.html' },
            { key: 'privacy', version: '2026-08-03', url: './privacy.html' },
            { key: 'refund', version: '2026-08-07-v1', url: './refund.html' },
            { key: 'risk', version: '2026-08-03', url: './risk-disclosure.html' }
          ],
          readiness: { feature_flag: false, owner_bootstrap: false, turnstile: true, mail_provider: true, mail_provider_code: 'resend', legal_documents: true }
        })
      });
    }
    if (url.includes('/functions/v1/crypto-lab-v79-recover')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          enabled: false,
          site_key: null,
          captcha_provider: 'turnstile',
          captcha_action: 'crypto_recover',
          email_enumeration_safe: true,
          readiness: { feature_flag: false, turnstile: true, mail_provider: true, mail_provider_code: 'resend' }
        })
      });
    }
    if (url.includes('api.binance.com') || url.includes('data-api.binance.vision')) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    }
    if (url.includes('cdn.jsdelivr.net')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: SUPABASE_STUB });
    }
    return route.abort();
  });
}

async function openShell(page) {
  await stubExternalTraffic(page);
  await page.goto('/v79/app.html?browser-smoke=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#nav button[data-route="home"]')).toBeVisible();
  await expect(page.locator('#homeView')).toBeVisible();
  await expect(page.locator('#cryptoSkipLink')).toBeAttached();
}

async function expectNoBodyOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(Math.max(dimensions.body, dimensions.document)).toBeLessThanOrEqual(dimensions.viewport + 2);
}

test('v79 owner launch path and mobile navigation remain usable', async ({ page, isMobile }) => {
  await openShell(page);
  await expectNoBodyOverflow(page);

  const unnamedButtons = await page.locator('button:visible').evaluateAll(buttons => buttons
    .filter(button => !(button.textContent || '').trim() && !button.getAttribute('aria-label') && !button.getAttribute('title'))
    .map(button => button.outerHTML.slice(0, 180)));
  expect(unnamedButtons).toEqual([]);

  if (isMobile) {
    await page.locator('#menu').click();
    await expect(page.locator('#side')).toHaveClass(/open/);
  }

  for (const route of ROUTES) {
    const button = page.locator(`#nav button[data-route="${route}"]`);
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator('#frameView')).toBeVisible();
    await expect(page.locator('#frame')).toHaveAttribute('src', new RegExp(ROUTE_FILES[route].replace('.', '\\.')));
    const frame = page.frameLocator('#frame');
    await expect(frame.locator('body')).toBeVisible();
    if (route === 'scanner') await expect(frame.locator('#body')).toBeVisible();
    if (route === 'ai') await expect(frame.locator('#run')).toBeVisible();
    if (route === 'account') {
      await expect(frame.locator('#accountView')).toBeVisible();
      await expect(frame.locator('#adminPanelBtn')).toBeVisible();
    }
    await expectNoBodyOverflow(page);
    if (isMobile && route !== ROUTES.at(-1)) {
      await page.locator('#menu').click();
      await expect(page.locator('#side')).toHaveClass(/open/);
    }
  }
});

test('account logout and repeated login UI lifecycle remains responsive', async ({ page }) => {
  await openShell(page);
  await page.locator('#nav button[data-route="account"]').click();
  const frame = page.frameLocator('#frame');
  await expect(frame.locator('#accountView')).toBeVisible();
  await expect(frame.locator('#adminPanelBtn')).toBeVisible();
  await expect(frame.locator('#logoutBtn')).toBeVisible();
  await frame.locator('#logoutBtn').click();
  await expect(frame.locator('#authView')).toBeVisible();
  await frame.locator('#loginEmail').fill('owner-smoke@example.invalid');
  await frame.locator('#loginPassword').fill('SmokeOnly123');
  await frame.locator('#loginBtn').click();
  await expect(frame.locator('#accountView')).toBeVisible();
  await expect(frame.locator('#adminPanelBtn')).toBeVisible();
});

test('support module opens with an authenticated session', async ({ page }) => {
  await stubExternalTraffic(page);
  await page.goto('/v79/support.html?browser-smoke=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#content')).toBeVisible();
  await expect(page.locator('#ticketForm')).toBeVisible();
  await expect(page.locator('#tickets')).toBeVisible();
});

test('shell and module accessibility semantics are applied', async ({ page, isMobile }) => {
  await openShell(page);
  await expect(page.locator('#nav')).toHaveAttribute('aria-label', /.+/);
  await expect(page.locator('#menu')).toHaveAttribute('aria-label', /.+/);
  await expect(page.locator('#menu')).toHaveAttribute('aria-controls', 'side');
  await expect(page.locator('#lang')).toHaveAttribute('aria-label', /.+/);
  await expect(page.locator('#nav button[data-route="home"]')).toHaveAttribute('aria-current', 'page');

  await page.keyboard.press('Tab');
  await expect(page.locator('#cryptoSkipLink')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();

  if (isMobile) {
    await page.locator('#menu').click();
    await expect(page.locator('#menu')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('#side')).not.toHaveClass(/open/);
    await expect(page.locator('#menu')).toBeFocused();
    await page.locator('#menu').click();
    await expect(page.locator('#side')).toHaveClass(/open/);
  }

  await page.locator('#nav button[data-route="calculator"]').click();
  await expect(page.locator('#frame')).toHaveAttribute('title', /Calculator|Калькулятор/);
  const frame = page.frameLocator('#frame');
  await expect(frame.locator('body')).toBeVisible();
  await expect(frame.locator('#moduleAccessibilityScript')).toBeAttached();
  const unnamedControls = await frame.locator('input,select,textarea,button').evaluateAll(elements => elements
    .filter(element => {
      const text = (element.textContent || '').trim();
      const labelled = element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.getAttribute('title');
      const label = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`) : null;
      return !text && !labelled && !label && !element.closest('label');
    })
    .map(element => element.outerHTML.slice(0, 180)));
  expect(unnamedControls).toEqual([]);
});

test('manifest and service worker are installable assets', async ({ page, request }) => {
  await openShell(page);

  const manifestResponse = await request.get('/v79/manifest.webmanifest');
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.display).toBe('standalone');
  expect(Array.isArray(manifest.icons) && manifest.icons.length > 0).toBeTruthy();

  const workerResponse = await request.get('/v79/service-worker.js');
  expect(workerResponse.ok()).toBeTruthy();
  const workerSource = await workerResponse.text();
  expect(workerSource).toContain('offline.html');
  expect(workerSource).toContain('crypto-lab-v79-7930');
  expect(workerSource).toContain('session-security.js');
  expect(workerSource).toContain('admin-audit.js');
  expect(workerSource).toContain('admin-readiness.js');

  const readinessResponse = await request.get('/v79/admin-readiness.js');
  expect(readinessResponse.ok()).toBeTruthy();
  const readinessSource = await readinessResponse.text();
  expect(readinessSource).toContain('get_crypto_launch_readiness');
  expect(readinessSource).toContain('get_crypto_retention_preview');

  const registration = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return null;
    const ready = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise(resolve => setTimeout(() => resolve(null), 8000))
    ]);
    return ready ? { scope: ready.scope, active: Boolean(ready.active) } : null;
  });
  expect(registration).not.toBeNull();
  expect(registration.active).toBeTruthy();
  expect(registration.scope).toContain('/v79/');
});

test('cached module remains available while offline', async ({ page }) => {
  await openShell(page);
  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) await navigator.serviceWorker.ready;
  });
  await page.context().setOffline(true);
  try {
    await page.goto('/v79/calculator.html?offline-smoke=1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveTitle(/Calculator|Калькулятор|CRYPTO LAB/i);
  } finally {
    await page.context().setOffline(false);
  }
});

test('language selection survives reload', async ({ page }) => {
  await openShell(page);
  await page.locator('#lang').selectOption('uk');
  await expect(page.locator('#title')).toContainText('CRYPTO LAB');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#lang')).toHaveValue('uk');
  await expect(page.locator('#cryptoSkipLink')).toContainText('Перейти');
});
