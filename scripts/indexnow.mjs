// Tells search engines that take IndexNow (Bing, Yandex, Seznam, Naver; Bing's index also feeds ChatGPT search and
// others) which of Radar's pages changed, so they're crawled within days rather than weeks. The key is the file
// /<key>.txt at the site's root. The Refresh Radar Action runs this after it commits; by hand:
//   node scripts/indexnow.mjs                  (the pages whose files changed in the last commit)
//   node scripts/indexnow.mjs --all            (every address in sitemap.xml)
import { readFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const SITE = 'https://raunakpatil.com';
const root = new URL('../', import.meta.url);
const keyFile = readdirSync(root).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.log('indexnow: no key file'); process.exit(0); }
const key = keyFile.slice(0, -4);

let urls;
if (process.argv.includes('--all')) {
  urls = [...readFileSync(new URL('sitemap.xml', root), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
} else {
  const changed = execSync('git diff --name-only HEAD~1 HEAD', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  urls = changed.map((f) => (f === 'radar.html' ? `${SITE}/radar` : /^ai-tools\/.+\.html$/.test(f) ? `${SITE}/${f.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '')}` : null)).filter(Boolean);
}
if (!urls.length) { console.log('indexnow: nothing changed'); process.exit(0); }
for (let i = 0; i < urls.length; i += 10000) {
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: 'raunakpatil.com', key, keyLocation: `${SITE}/${keyFile}`, urlList: urls.slice(i, i + 10000) }),
  });
  console.log(`indexnow: ${urls.slice(i, i + 10000).length} addresses, ${r.status}`);
}
