import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:3000/', { waitUntil: 'load' });

const bodyStyles = await page.evaluate(() => {
  const style = getComputedStyle(document.body);
  return {
    backgroundColor: style.backgroundColor,
    color: style.color,
    backgroundImage: style.backgroundImage,
  };
});

const textStyles = await page.evaluate(() => {
  const el = document.querySelector('p.text-base');
  if (!el) return null;
  const style = getComputedStyle(el);
  return {
    color: style.color,
    backgroundColor: style.backgroundColor,
  };
});

const kpiStyles = await page.evaluate(() => {
  const el = document.querySelector('.kpi-label');
  if (!el) return null;
  const style = getComputedStyle(el);
  return {
    color: style.color,
    backgroundColor: style.backgroundColor,
  };
});

console.log({ bodyStyles, textStyles, kpiStyles });
await browser.close();
