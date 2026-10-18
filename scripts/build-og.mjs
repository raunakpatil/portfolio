// Renders the share images (1200x630, what a link shows on LinkedIn, X, WhatsApp...) with a local Chrome:
//   img/og.png        raunakpatil.com       from scripts/og/home-og.html
//   img/radar-og.png  /radar and /ai-tools  from scripts/og/radar-og.html
// WhatsApp shows the big card only for a PNG that stays well under 300 KB (a JPEG got the small thumbnail even at
// 100 KB), and the photo makes the site's card bigger than that: so it's brought down to 256 colours afterwards,
// which looks the same (Python with Pillow):
//   node scripts/build-og.mjs   (needs puppeteer-core: npx -p puppeteer-core ...)
//   python -c "from PIL import Image as I; I.open('img/og.png').convert('RGB').quantize(256, dither=1).save('img/og.png', optimize=True)"
// then give its address in index.html a new ?v= (og:image), so the apps fetch it again.
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const JOBS = [['home-og.html', 'og.png'], ['radar-og.html', 'radar-og.png']];
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--allow-file-access-from-files'] });
for (const [src, out] of JOBS) {
  const p = await b.newPage();
  await p.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await p.goto(new URL(`./og/${src}`, import.meta.url).href, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: fileURLToPath(new URL(`../img/${out}`, import.meta.url)), type: 'png' });
  await p.close();
  console.log(`img/${out} from og/${src}`);
}
await b.close();
