// Renders Radar's pictures from scripts/og/frames.html with a local Chrome: its project covers (img/projects/radar*,
// img/tunnel/radar*) and, given the best-ai-tools repo's folder, the screenshots in its README (assets/*).
// The screenshots are taken from the live site first, into a temporary folder.
//   node scripts/build-frames.mjs [path/to/best-ai-tools]      (needs puppeteer-core)
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = join(tmpdir(), 'radar-shots');
const REPO = process.argv[2];
const site = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const frames = new URL('./og/frames.html', import.meta.url).href;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(SHOTS, { recursive: true });
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });

// ---------- the screenshots, from the live site (reduced motion: no arrival screen); NOSHOT=1 keeps the last ones ----------
if (!process.env.NOSHOT) {
const open = async (w, h, url, mobile = false) => {
  const p = await b.newPage();
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: mobile, hasTouch: mobile });
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  await wait(4000);
  return p;
};
const toDir = (p, off) => p.evaluate((o) => scrollTo(0, document.querySelector('.tl-dir').getBoundingClientRect().top + scrollY - o), off);
// (LEAD=n turns the lead story on n times first: pick one whose picture is a logo or art, not a photo of a person)
const pastPeople = async (p) => {
  for (let k = 0; k < Number(process.env.LEAD || 0); k++) { await p.click('#tl-lead-next'); await wait(2000); }
};
let p = await open(1440, 900, 'https://raunakpatil.com/radar');
await pastPeople(p);
await p.screenshot({ path: join(SHOTS, 'radar-top.png') });
await toDir(p, 64); await wait(1200);
await p.screenshot({ path: join(SHOTS, 'radar-tools.png') });
await p.click('#tl-search'); await p.type('#tl-search', 'turn my podcast into short clips', { delay: 20 });
await p.keyboard.press('Enter');
await p.waitForSelector('.tl-answer-list:not(.wait)', { timeout: 40000 }).catch(() => {});
await wait(1500); await toDir(p, 64); await wait(500);
await p.screenshot({ path: join(SHOTS, 'radar-ask.png') });
await p.close();
p = await open(1440, 900, 'https://raunakpatil.com/ai-tools/best-ai-video-tools');
await p.screenshot({ path: join(SHOTS, 'ai-tools-video.png') });
await p.close();
p = await open(390, 844, 'https://raunakpatil.com/radar', true);
await pastPeople(p);
await p.screenshot({ path: join(SHOTS, 'phone-top.png') });
await toDir(p, 58); await wait(1000);
await p.screenshot({ path: join(SHOTS, 'phone-tools.png') });
await p.close();
p = await open(390, 844, 'https://raunakpatil.com/ai-tools/tool/cursor', true);
await p.screenshot({ path: join(SHOTS, 'phone-tool.png') });
await p.close();

}

// ---------- framed ----------
const shot = (n) => pathToFileURL(join(SHOTS, `${n}.png`)).href;
async function render(out, size, mode, imgs = [], url) {
  const [w, h] = size.split('x').map(Number);
  const q = new URLSearchParams({ mode, size, ...(url ? { url } : {}) });
  imgs.forEach((s, k) => q.set('abc'[k], shot(s)));
  const pg = await b.newPage();
  await pg.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await pg.goto(`${frames}?${q}`, { waitUntil: 'networkidle0' });
  await pg.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await pg.screenshot({ path: out, type: 'webp', quality: 90 });
  await pg.close();
  console.log(out);
}
await render(site('img/projects/radar.webp'), '1600x893', 'cover', ['radar-ask', 'phone-top']);
await render(site('img/projects/radar-mobile.webp'), '960x717', 'cover-mobile', ['phone-top', 'phone-tools']);
await render(site('img/tunnel/radar.webp'), '1100x614', 'tunnel');
await render(site('img/tunnel/radar-mobile.webp'), '900x672', 'tunnel');
if (REPO) {
  mkdirSync(join(REPO, 'assets'), { recursive: true });
  await render(join(REPO, 'assets/radar.webp'), '1600x1060', 'window', ['radar-top']);
  await render(join(REPO, 'assets/ask-radar.webp'), '1600x1060', 'window', ['radar-ask']);
  await render(join(REPO, 'assets/directory.webp'), '1600x1060', 'window', ['radar-tools']);
  await render(join(REPO, 'assets/ai-tools-page.webp'), '1600x1060', 'window', ['ai-tools-video'], 'raunakpatil.com/ai-tools/best-ai-video-tools');
  await render(join(REPO, 'assets/phones.webp'), '1600x1150', 'phones', ['phone-top', 'phone-tools', 'phone-tool']);
}
await b.close();
