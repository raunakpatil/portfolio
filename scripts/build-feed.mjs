// Saves a snapshot of the Tools page's live feed (the latest AI headlines and trending open models) to data/feed.json,
// which the page shows should the live one (Ronie's worker, /feed) not answer. Run it now and then:
//   node scripts/build-feed.mjs
import { writeFileSync } from 'node:fs';
import { buildFeed } from '../worker/src/feed.js';

const feed = await buildFeed();
writeFileSync(new URL('../data/feed.json', import.meta.url), JSON.stringify(feed) + '\n');
console.log(`data/feed.json: ${feed.news.length} headlines, ${feed.models.length} models (${feed.updated})`);
