import { test, expect } from '@playwright/test';

const ROUTES = ['calculator', 'portfolio', 'backtest', 'journal'];

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
    if (url.includes('api.binance.com') || url.includes('data-api.binance.vision')) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    }
    if (url.includes('cdn.jsdelivr.net')) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.supabase=window.supabase||{};' });
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

test('v79 shell, modules and mobile navigation remain usable', async ({ page, isMobile }) => {
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
    await expect(page.locator('#frame')).toHaveAttribute('src', new RegExp(`${route}\\.html`));
    const frame = page.frameLocator('#frame');
    await expect(frame.locator('body')).toBeVisible();
    await expectNoBodyOverflow(page);
    if (isMobile && route !== ROUTES.at(-1)) {
      await page.locator('#menu').click();
      await expect(page.locator('#side')).toHaveClass(/open/);
    }
  }
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