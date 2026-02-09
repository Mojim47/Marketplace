import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3003/', { waitUntil: 'load' });

const bodyStyles = await page.evaluate(() => {
  const style = getComputedStyle(document.body);
  return {
    backgroundColor: style.backgroundColor,
    color: style.color,
    backgroundImage: style.backgroundImage,
  };
});

const titleStyles = await page.evaluate(() => {
  const el = document.querySelector('h1');
  if (!el) return null;
  const style = getComputedStyle(el);
  return {
    color: style.color,
    fontFamily: style.fontFamily,
  };
});

console.log({ bodyStyles, titleStyles });
await browser.close();
