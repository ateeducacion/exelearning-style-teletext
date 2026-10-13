// Uses Playwright already installed in the eXeLearning checkout; no test runner.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:1314/';
const NUMBERS = [100, 200, 210, 220, 230, 240, 300, 310, 320, 400, 500];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().startsWith(base)) errors.push(`${response.status()} ${response.url()}`); });
  const ready = () => page.waitForFunction(() => document.body.classList.contains('tt-ready') && [...document.querySelectorAll('.idevice_node[data-idevice-component-type="json"]')].every(node => node.classList.contains('loaded')));
  const open = async url => { await page.goto(url); await ready(); };
  const key = async selector => {
    const before = page.url();
    await page.locator(selector).click();
    await page.waitForURL(url => url.href !== before);
    await ready();
  };
  try {
    await open(base);
    const urls = await page.locator('#siteNav a').evaluateAll(links => links.map(link => link.href));
    const numbers = await page.locator('#siteNav .tt-number').allTextContents();
    assert.deepEqual(numbers.map(Number), NUMBERS, 'Teletext page numbers: 100, 200, 210…');
    assert.match(await page.locator('.page-title').innerText(), /^100\s/, 'The title carries the page number');
    assert.equal(await page.locator('.tt-status .tt-entry').innerText(), 'P100');
    assert.match(await page.locator('.tt-clock').innerText(), /^\d\d:\d\d\/\d\d$/, 'Header row clock');
    assert.equal(await page.locator('.tt-key-red').getAttribute('aria-disabled'), 'true', 'Nothing before the first page');

    // Read the whole service with the blue key.
    await open(urls[0]);
    const visited = [page.url()];
    while (await page.locator('a.tt-key-blue').count() && visited.length < 20) {
      await key('a.tt-key-blue');
      visited.push(page.url());
    }
    assert.deepEqual(visited, urls, 'The blue key reaches every page in order');
    assert.equal(await page.locator('.tt-key-blue').getAttribute('aria-disabled'), 'true', 'Nothing after the last page');
    await key('a.tt-key-red');
    assert.equal(page.url(), urls.at(-2), 'The red key goes back');

    // Arrow keys and typed page numbers.
    await open(urls[2]);
    await Promise.all([page.waitForURL(urls[3]), page.keyboard.press('ArrowRight')]);
    await ready();
    await Promise.all([page.waitForURL(urls[2]), page.keyboard.press('ArrowLeft')]);
    await ready();
    await page.keyboard.press('3');
    await page.keyboard.press('2');
    assert.equal(await page.locator('.tt-entry').innerText(), 'P32-', 'Typed digits show in the header row');
    await Promise.all([page.waitForURL(urls[NUMBERS.indexOf(320)]), page.keyboard.press('0')]);
    await ready();
    for (const digit of '999') await page.keyboard.press(digit);
    assert.equal(await page.locator('.tt-entry.tt-entry-missing').count(), 1, 'A page that does not exist is flagged');
    assert.equal(page.url(), urls[NUMBERS.indexOf(320)]);

    // Green key: the index; yellow key: the activities.
    await open(urls[2]);
    await page.locator('.tt-key-green').click();
    assert.equal(await page.evaluate(() => document.activeElement.closest('#siteNav') && document.activeElement.classList.contains('active')), true, 'The green key goes to the index');
    assert.equal(await page.locator('a.tt-key-yellow').evaluate(link => link.href), urls[NUMBERS.indexOf(300)], 'The yellow key opens Actividades');
    await open(urls[NUMBERS.indexOf(300)]);
    assert.equal(await page.locator('a.tt-key-yellow').evaluate(link => link.href), urls[NUMBERS.indexOf(310)], 'and from there the first activity');

    // Side column beside the content, and the quick check.
    await open(urls[2]);
    assert.equal(await page.locator('.tt-aside > .box').count(), 2, 'Recuerda and the quick check go to the side column');
    const [content, aside] = await Promise.all(['.page-content', '.tt-aside'].map(selector => page.locator(selector).boundingBox()));
    assert(aside.x >= content.x + content.width, 'The side column is beside the content');
    await page.locator('.tt-aside .TOFP-Answer[value="1"]').check();
    await page.locator('.tt-aside [id^="tofPCheckTest-"]').click();
    assert.equal(await page.locator('.tt-aside .TOFP-SolutionMessage').innerText(), 'Correcto', 'Quick check marks the answer in Spanish');

    // Activities work inside the screen.
    await open(urls[NUMBERS.indexOf(320)]);
    for (const [index, value] of ['1', '0', '1', '0'].entries()) {
      await page.locator('.TOFP-QuestionDiv').nth(index).locator(`input[value="${value}"]`).check();
    }
    await page.locator('[id^="tofPCheckTest-"]').click();
    assert.equal(await page.locator('.TOFP-SolutionMessage').filter({ hasText: /^Correcto$/ }).count(), 4, 'True/false quiz marks all answers');

    await open(urls[NUMBERS.indexOf(310)]);
    const options = await page.locator('.scrambled-list').evaluate(node => JSON.parse(node.dataset.ideviceJsonData).options);
    for (let i = 0; i < options.length; i++) {
      for (let attempts = 0; attempts < options.length; attempts++) {
        const items = await page.locator('.exe-sortableList-options > li').allTextContents();
        const index = items.findIndex(text => text.includes(options[i]));
        if (index === i) break;
        await page.locator('.exe-sortableList-options > li').nth(index).locator('a.up').click();
      }
    }
    await page.locator('input[class*="exe-sortableList-check-"]').click();
    assert.match(await page.locator('[id$="-feedback"]').innerText(), /Correcto|superada/i, 'Sorting exercise can be completed');

    // The miniature: a 1440 × 840 screen drawn at 1200 × 700.
    if (process.env.TELETEXT_SCREENSHOT) {
      const shot = await browser.newPage({ viewport: { width: 1440, height: 840 }, deviceScaleFactor: 1200 / 1440 });
      await shot.goto(urls[2]);
      await shot.waitForFunction(() => document.body.classList.contains('tt-ready') && document.querySelector('.TOFP-Answer'));
      await shot.evaluate(() => document.fonts.ready);
      await shot.evaluate(() => document.querySelector('.exe-open-exelearning')?.remove());
      for (const path of process.env.TELETEXT_SCREENSHOT.split(',')) await shot.screenshot({ path });
      await shot.close();
    }

    // Phones: the green key opens the index over the page; nothing wider than the screen.
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await open(urls[2]);
      assert.equal(await page.locator('.tt-index').isVisible(), false, `Index closed at ${width}px`);
      await page.locator('.tt-key-green').click();
      assert.equal(await page.locator('.tt-index').isVisible(), true, `The green key opens the index at ${width}px`);
      assert.equal(await page.locator('.tt-key-green').getAttribute('aria-expanded'), 'true');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.tt-index').isVisible(), false, 'Escape closes it');
      assert.equal(await page.evaluate(() => document.activeElement.classList.contains('tt-key-green')), true, 'Focus returns to the green key');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Fits ${width}px`);
    }
    assert.deepEqual(errors, [], errors.join('\n'));
    console.log(`PASS: ${urls.length} numbered pages read with the coloured keys, arrows and typed numbers, index, activities, side column and phone widths.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
