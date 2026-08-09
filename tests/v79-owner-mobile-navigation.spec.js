import { test, expect } from '@playwright/test';

const ROUTES = [
  ['analytics', 'chart.html'],
  ['news', 'news.html'],
  ['scanner', 'scanner.html'],
  ['ai', 'ai.html'],
  ['portfolio', 'portfolio.html'],
  ['calculator', 'calculator.html'],
  ['backtest', 'backtest.html'],
  ['journal', 'journal.html'],
  ['account', 'account.html']
];

async function stubExternalTraffic(page) {
  await page.route('https://**/*', async route => {
    const url = route.request().url();
    if (url.includes('/functions/v1/crypto-lab-v79-preview')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, latest_run: null, latest_monitor: null, active_signals: [], runs: [] })
      });
    }
    if (url.includes('/functions/v1/crypto-lab-v79-news')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,items:[],breaking:[],state:{status:'ok'},refresh_seconds:300})});
    if (url.includes('api.binance.com') || url.includes('data-api.binance.vision')) {
      return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
    }
    return route.abort();
  });
}

async function openShell(page) {
  await stubExternalTraffic(page);
  await page.goto('/v79/app.html?mobile-owner-smoke=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#homeView')).toBeVisible();
  await expect(page.locator('#menu')).toBeVisible();
}

async function openSidebar(page) {
  if (!(await page.locator('#side').evaluate(node => node.classList.contains('open')))) await page.locator('#menu').click();
  await expect(page.locator('#side')).toHaveClass(/open/);
}

test('mobile owner sidebar scrolls and every required module remains reachable', async ({ page }) => {
  await openShell(page);
  await openSidebar(page);

  const sidebar = await page.locator('#side').evaluate(node => ({
    overflowY: getComputedStyle(node).overflowY,
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight
  }));
  expect(['auto', 'scroll']).toContain(sidebar.overflowY);
  expect(sidebar.scrollHeight).toBeGreaterThanOrEqual(sidebar.clientHeight);

  for (const [route, file] of ROUTES) {
    await openSidebar(page);
    const button = page.locator(`#nav button[data-route="${route}"]`);
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
    await button.click();

    const state = await page.evaluate(({ routeName, fileName }) => {
      const button = document.querySelector(`#nav button[data-route="${routeName}"]`);
      const frameView = document.getElementById('frameView');
      const frame = document.getElementById('frame');
      return {
        selected: Boolean(button?.classList.contains('on')),
        frameVisible: Boolean(frameView && !frameView.classList.contains('hide')),
        target: frame?.getAttribute('src') || '',
        sidebarOpen: Boolean(document.getElementById('side')?.classList.contains('open'))
      };
    }, { routeName: route, fileName: file });

    expect(state.selected).toBeTruthy();
    expect(state.frameVisible).toBeTruthy();
    expect(state.target).toContain(file);
    expect(state.sidebarOpen).toBeFalsy();
  }

  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(Math.max(overflow.body, overflow.document)).toBeLessThanOrEqual(overflow.viewport + 2);
});