// Before every deploy: a new ?v= for the site's files (so browsers fetch the new ones), then radar.html rebuilt
// from index.html (scripts/build-radar-page.mjs) so /radar matches.   node scripts/deploy-prep.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../index.html', import.meta.url);
const v = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const html = readFileSync(file, 'utf8');
const n = (html.match(/\?v=\d{14}/g) || []).length;
writeFileSync(file, html.replace(/\?v=\d{14}/g, `?v=${v}`));
console.log(`index.html: ?v=${v} (${n} files)`);
await import('./build-radar-page.mjs');
