const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  for (const url of ['http://localhost:3103/login','http://localhost:3100/']) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const a = document.querySelector('a');
      return {
        title: document.title,
        body: document.body.innerText.slice(0,120),
        linkCount: document.querySelectorAll('a').length,
        color: a ? getComputedStyle(a).color : null,
        rules: document.styleSheets.length ? (()=>{ try{return document.styleSheets[0].cssRules.length}catch{return -1} })() : -2,
      };
    });
    console.log(url, JSON.stringify(info));
  }
  await browser.close();
})();
