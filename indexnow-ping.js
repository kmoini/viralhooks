#!/usr/bin/env node
/**
 * Pings the IndexNow API (api.indexnow.org) with any sitemap URL this script
 * hasn't submitted before. IndexNow is a single shared endpoint that fans a
 * submission out to every participating engine (Bing, Yandex, Naver,
 * Seznam.cz) — Google does not participate and keeps using Search Console
 * separately.
 *
 * Deliberately NOT "ping everything every run" — a local record
 * (.indexnow-submitted.json, gitignored-worthy but harmless if committed)
 * tracks which URLs have already been reported, so a run with nothing new
 * makes zero network calls. This sitemap has no <lastmod> per URL, so the
 * record tracks plain URL membership, not a changed-since-when timestamp —
 * re-submitting a page whose content changed (not just a new page) needs an
 * explicit URL argument or --all.
 *
 * The key file (<key>.txt) must already be live at the site root before this
 * can succeed — it's how IndexNow verifies you own the host. This script
 * checks that itself before submitting, so a failed deploy produces a clear
 * local error instead of a silent 403.
 *
 * Usage:
 *   node indexnow-ping.js                # submit sitemap URLs not yet recorded
 *   node indexnow-ping.js --all          # force-submit every sitemap URL regardless of the record
 *   node indexnow-ping.js <url> [url...] # submit exactly these URLs, bypassing the diff
 *
 * Never throws past main() — meant to run as a best-effort post-deploy step.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const HOST = 'viralhooks.app';
const INDEXNOW_KEY = '00141ebff8efe6b6407f4cce276153b6';
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;
const SITEMAP_PATH = path.join(__dirname, 'sitemap.xml');
const STATE_PATH = path.join(__dirname, '.indexnow-submitted.json');
const ENDPOINT = 'https://api.indexnow.org/indexnow';

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function httpPostJson(url, payload) {
  const data = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function readSitemapUrls() {
  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const urls = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) urls.push(m[1]);
  return urls;
}

function readState() {
  try {
    return new Set(JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')));
  } catch (_) {
    return new Set();
  }
}

function writeState(set) {
  fs.writeFileSync(STATE_PATH, JSON.stringify([...set], null, 2));
}

const RESPONSE_MEANING = {
  200: 'OK — submitted',
  202: 'Accepted — key validation pending',
  400: 'Bad Request — invalid format',
  403: 'Forbidden — key file not found or does not contain the key',
  422: 'Unprocessable — URLs do not belong to this host',
  429: 'Too Many Requests — rate limited',
};

async function verifyKeyFileLive() {
  const res = await httpGet(KEY_LOCATION);
  if (res.status !== 200 || res.body.trim() !== INDEXNOW_KEY) {
    throw new Error(
      `Key file not live/correct at ${KEY_LOCATION} (status ${res.status}). ` +
      `Deploy ${INDEXNOW_KEY}.txt before submitting, or IndexNow will 403.`
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const forceAll = args.includes('--all');
  const explicitUrls = args.filter((a) => a.startsWith('http'));

  const sitemapUrls = readSitemapUrls();
  let toSubmit;

  if (explicitUrls.length) {
    toSubmit = explicitUrls;
  } else {
    const submitted = readState();
    toSubmit = (forceAll ? sitemapUrls : sitemapUrls.filter((u) => !submitted.has(u)));
  }

  if (!toSubmit.length) {
    log('Nothing new to submit (every sitemap URL already recorded).');
    return;
  }

  log(`Verifying key file is live at ${KEY_LOCATION}...`);
  await verifyKeyFileLive();

  log(`Submitting ${toSubmit.length} URL(s) to IndexNow:`);
  toSubmit.forEach((u) => log(`  ${u}`));

  const res = await httpPostJson(ENDPOINT, {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: toSubmit,
  });

  const meaning = RESPONSE_MEANING[res.status] || `Unexpected status ${res.status}`;
  log(`IndexNow responded ${res.status}: ${meaning}`);
  if (res.body) log(`  body: ${res.body.slice(0, 300)}`);

  if (res.status === 200 || res.status === 202) {
    const submitted = readState();
    toSubmit.forEach((u) => submitted.add(u));
    writeState(submitted);
    log(`Recorded ${toSubmit.length} URL(s) in ${STATE_PATH}.`);
  } else {
    log('Not updating the record — submission was not accepted, so the next run will retry these.');
  }
}

main().catch((err) => {
  log(`FAILED (non-blocking): ${err.message}`);
  process.exitCode = 0;
});
