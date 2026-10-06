const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'artifacts');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const errors = [];
  const page = await browser.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => {
    if (/activity(?:-data\.js|\.json)\?/.test(request.url()) && networkMode === 'offline') return;
    errors.push(request.url());
  });
  const snapshotSource = await fs.readFile(path.join(root, 'site/activity-data.js'), 'utf8');
  const snapshot = JSON.parse(snapshotSource.slice('window.githubActivity = '.length).trim().replace(/;$/, ''));
  // Synthetic authorized snapshot exercises the data path; never written to site assets.
  const fixture = structuredClone(snapshot);
  fixture.scope = 'account';
  fixture.source = 'https://api.github.com/graphql';
  let networkMode = 'success';
  async function reply(route, script) {
    if (networkMode === 'offline') return route.fulfill({status:503,body:''});
    const payload = networkMode === 'invalid' ? {} : fixture;
    await route.fulfill({status:200,contentType:script ? 'application/javascript' : 'application/json',
      body:script ? 'window.githubActivity = ' + JSON.stringify(payload) + ';' : JSON.stringify(payload)});
  }
  await page.route('**/activity.json?*', route => reply(route, false));
  await page.route('**/activity-data.js?*', route => reply(route, true));
  const base = process.env.PREVIEW_URL || pathToFileURL(path.join(root, 'site/index.html')).href;
  try {
    for (const language of ['en', 'zh']) {
      for (const width of [1440, 1024, 768, 560, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(base + '?lang=' + language);
        await page.waitForFunction(() => !document.getElementById('activity-refresh').disabled);
        assert.equal(await page.locator('html').getAttribute('lang'), language === 'zh' ? 'zh-CN' : 'en');
        assert.equal(await page.locator('[data-i18n="heroTitle"]').textContent(), 'Bruce Liu');
        assert.match(await page.title(), /Bruce Liu/);
        assert.equal(await page.locator('.project-card').count(), 1);
        assert.equal(await page.locator('.focus-row').count(), 4);
        const actual = await page.locator('.activity-graph i[data-date]').evaluateAll(nodes => nodes.map(n => ({date:n.dataset.date,count:Number(n.dataset.count),level:Number(n.dataset.level)})));
        const expected = await page.evaluate(() => window.githubActivity.days);
        assert.deepEqual(actual, expected);
        assert.equal(await page.locator('.avatar-frame').count(), 0);
        assert.equal(await page.locator('.brand').textContent(), 'Bruce Liu');
        assert.equal(await page.locator('.technology-icon').count(), 8);
        assert.equal(await page.locator('.footer').innerText(), language === 'zh' ? '返回顶部 ↑' : 'Back to top ↑');
        const dimensions = await page.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          content: document.documentElement.scrollWidth,
          allImagesLoaded: [...document.images].every(image => image.complete && image.naturalWidth > 0),
          heroHeight: document.querySelector('.hero').getBoundingClientRect().height,
          backgroundLoaded: getComputedStyle(document.querySelector('.hero-background')).backgroundImage.includes('background.webp'),
          titleRight: document.querySelector('#hero-title').getBoundingClientRect().right,
          brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(a => !document.getElementById(a.hash.slice(1))).map(a => a.hash)
        }));
        assert.ok(dimensions.content <= dimensions.viewport, JSON.stringify({width, language, ...dimensions}));
        assert.ok(dimensions.allImagesLoaded);
        assert.ok(dimensions.heroHeight < 600);
        assert.ok(dimensions.backgroundLoaded);
        assert.ok(dimensions.titleRight <= dimensions.viewport);
        assert.deepEqual(dimensions.brokenAnchors, []);
        if (width === 1440 || width === 390) await page.screenshot({ path: path.join(output, 'bruce-' + language + '-' + width + '.png'), fullPage: true });
        console.log('PASS ' + language + ' at ' + width + 'px: layout, name, background, real calendar, logos, footer');
      }
    }
    await page.goto(base + '?lang=en');
    await page.locator('[data-language="zh"]').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'zh-CN');
    await page.locator('[data-language="en"]').click();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('[data-i18n="heroTitle"]').textContent(), 'Bruce Liu');
    assert.equal(await page.locator('#activity-period').count(), 0);
    assert.equal(await page.locator('[data-i18n="activityNote"]').count(), 0);
    assert.match(await page.locator('.activity-summary').textContent(), new RegExp(snapshot.total + ' contributions in the past year'));
    await page.locator('[data-language="zh"]').click();
    assert.match(await page.locator('.activity-summary').textContent(), new RegExp(snapshot.total + ' 次贡献'));
    await page.locator('[data-language="en"]').click();
    networkMode = 'offline';
    await page.locator('#activity-refresh').click();
    await page.waitForFunction(() => !document.getElementById('activity-refresh').disabled);
    assert.match(await page.locator('.activity-caption').textContent(), /Saved snapshot/);
    assert.match(await page.locator('.activity-summary').textContent(), new RegExp(snapshot.total + ' contributions'));
    networkMode = 'invalid';
    await page.locator('#activity-refresh').click();
    await page.waitForFunction(() => !document.getElementById('activity-refresh').disabled);
    assert.match(await page.locator('.activity-caption').textContent(), /Saved snapshot/);
    networkMode = 'success';
    const changedDate = fixture.days[0].date;
    fixture.days[0].count += 1;
    fixture.total += 1;
    fixture.allDays.find(day => day.date === changedDate).count += 1;
    fixture.totals[changedDate.slice(0,4)] += 1;
    fixture.allTotal += 1;
    await page.locator('#activity-refresh').click();
    await page.waitForFunction(() => !document.getElementById('activity-refresh').disabled);
    assert.match(await page.locator('.activity-summary').textContent(), new RegExp((snapshot.total + 1) + ' contributions'));
    assert.match(await page.locator('.activity-caption').textContent(), /Latest snapshot loaded/);
    console.log('PASS rolling-year summary, language switch, offline/invalid response fallback, and changed live data');
    // The incomplete public snapshot must not be presented as a full calendar.
    networkMode = 'invalid';
    await page.goto(base + '?lang=en');
    await page.waitForFunction(() => !document.getElementById('activity-refresh').disabled);
    assert.match(await page.locator('.activity-summary').textContent(), /Incomplete calendar/);
    assert.equal(await page.locator('.activity-graph').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log('PASS language round trip and no browser/resource errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
