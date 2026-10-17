// Renders Radar's share image, img/radar-og.png (1200x630), from scripts/og/radar-og.html with a local Chrome.
// Run by hand after changing the design:  node scripts/build-og.mjs   (needs puppeteer-core: npx -p puppeteer-core ...)
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = new URL('./og/radar-og.html', import.meta.url);
const out = fileURLToPath(new URL('../img/radar-og.png', import.meta.url));
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files'] });
const p = await b.newPage();
await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await p.goto(page.href, { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: out, type: 'png' });
await b.close();
console.log(`img/radar-og.png from ${page.pathname.split('/').slice(-2).join('/')}`);
