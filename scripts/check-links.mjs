// Checks every hand-picked tool's link (data/tools.json) and lists the ones that look broken: the address doesn't
// exist, the page is gone (404 / 410), or the server keeps failing. Sites that only turn robots away (401, 403, 429)
// count as fine. Run by the Refresh Radar Action, which keeps an issue on the repo up to date with what it finds;
// or by hand:  node scripts/check-links.mjs
import { readFileSync, appendFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const tools = JSON.parse(readFileSync(new URL('../data/tools.json', import.meta.url), 'utf8')).tools;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const FINE = new Set([401, 403, 405, 406, 429, 451, 999]);

// (only a missing address, a refused or dropped connection, a bad certificate or a timeout counts as broken among
// errors — anything else odd about a site's reply, such as very long headers, means it did answer)
const DEAD = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|CERT|TimeoutError/i;
async function probe(url) {
  let last = null;
  for (const method of ['HEAD', 'GET']) {   // (some sites only answer a full GET properly)
    try {
      const r = await fetch(url, { method, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,*/*' }, signal: AbortSignal.timeout(20000) });
      r.body?.cancel().catch(() => {});
      if (r.ok || FINE.has(r.status)) return null;
      last = `${r.status}`;
    } catch (e) {
      const code = String(e.cause?.code || e.name || e.message);
      last = DEAD.test(code) ? code.slice(0, 40) : null;
      if (!last) return null;
    }
  }
  return last;
}

const broken = [];
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < tools.length) {
    const t = tools[next++];
    let why = await probe(t.u);
    if (why && /^5/.test(why)) why = await probe(t.u);   // (a server having a bad moment gets a second chance)
    if (why) broken.push({ n: t.n, u: t.u, why });
  }
}));
broken.sort((a, b) => a.n.localeCompare(b.n));

const report = broken.length
  ? `${broken.length} of ${tools.length} hand-picked links look broken:\n\n| Tool | Link | Why |\n| --- | --- | --- |\n${broken.map((b) => `| ${b.n} | ${b.u} | ${b.why} |`).join('\n')}\n\nFix them in \`data/tools.json\` (or remove the tool); this issue closes itself once they all answer.`
  : `All ${tools.length} hand-picked links answer.`;
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Hand-picked links\n\n${report}\n`);

// on GitHub: one issue, kept current — opened (or updated) when something's broken, closed when nothing is
if (process.env.GITHUB_ACTIONS && process.env.GH_TOKEN) {
  const TITLE = 'Radar: hand-picked links to check';
  const gh = (args, input) => execSync(`gh ${args}`, { encoding: 'utf8', input });
  const open = JSON.parse(gh(`issue list --state open --search "${TITLE} in:title" --json number,title`)).find((i) => i.title === TITLE);
  if (broken.length && open) gh(`issue edit ${open.number} --body-file -`, report);
  else if (broken.length) gh(`issue create --title "${TITLE}" --body-file -`, report);
  else if (open) gh(`issue close ${open.number} --comment "All hand-picked links answer again."`);
}
