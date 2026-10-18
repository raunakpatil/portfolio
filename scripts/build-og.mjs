// Renders the share images (1200x630, what a link shows on LinkedIn, X, WhatsApp...) with a local Chrome:
//   img/og.jpg        raunakpatil.com    from scripts/og/home-og.html (a JPEG: WhatsApp shows the big card only
//                     for an image under about 300 KB, and a photo makes a PNG bigger than that)
//   img/radar-og.png  /radar and /ai-tools  from scripts/og/radar-og.html
// Run by hand after changing a design:  node scripts/build-og.mjs   (needs puppeteer-core: npx -p puppeteer-core ...)
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const JOBS = [['home-og.html', 'og.jpg'], ['radar-og.html', 'radar-og.png']];
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files'] });
for (const [src, out] of JOBS) {
  const p = await b.newPage();
  await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await p.goto(new URL(`./og/${src}`, import.meta.url).href, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: fileURLToPath(new URL(`../img/${out}`, import.meta.url)), ...(out.endsWith('.jpg') ? { type: 'jpeg', quality: 90 } : { type: 'png' }) });
  await p.close();
  console.log(`img/${out} from og/${src}`);
}
await b.close();
