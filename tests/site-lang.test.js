const L = require('../assets/site.js');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

test('lang: Traditional Chinese tags show Chinese', () => {
  for (const t of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-TW', 'zh-Hant-CN', 'ZH-tw', 'zh_TW'])
    eq([t, L.detect([t], 'America/New_York')], [t, 'zh-tw']);
});
test('lang: Simplified Chinese shows English, even in Taiwan or Hong Kong', () => {
  for (const t of ['zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-HK', 'zh-Hans-TW'])
    for (const z of ['Asia/Shanghai', 'Asia/Taipei', 'Asia/Hong_Kong'])
      eq([t, z, L.detect([t], z)], [t, z, 'en']);
});
test('lang: the first Chinese entry decides', () => {
  eq(L.detect(['en-US', 'zh-TW'], 'Europe/London'), 'zh-tw');
  eq(L.detect(['en-US', 'zh-CN', 'zh-TW'], 'Asia/Taipei'), 'en');
  eq(L.detect(['ja-JP', 'zh-HK'], 'Asia/Tokyo'), 'zh-tw');
});
test('lang: no Chinese entry falls back to the time zone', () => {
  for (const z of ['Asia/Taipei', 'Asia/Hong_Kong', 'Asia/Macau']) eq(L.detect(['en-US'], z), 'zh-tw');
  for (const z of ['Asia/Shanghai', 'Asia/Tokyo', 'America/Los_Angeles', '', undefined]) eq(L.detect(['en-US'], z), 'en');
  eq(L.detect(['zh'], 'Asia/Taipei'), 'zh-tw');
  eq(L.detect(['zh'], 'Asia/Shanghai'), 'en');
});
test('lang: empty or missing language list', () => {
  eq(L.detect([], 'Asia/Taipei'), 'zh-tw');
  eq(L.detect(undefined, 'UTC'), 'en');
  eq(L.detect([undefined, null], 'UTC'), 'en');
});
test('lang: a saved choice wins; invalid saved values are ignored', () => {
  eq(L.choose('en', ['zh-TW'], 'Asia/Taipei'), 'en');
  eq(L.choose('zh-tw', ['en-US'], 'America/New_York'), 'zh-tw');
  for (const s of [null, '', 'fr', 'zh-TW', 'EN']) eq([s, L.choose(s, ['en-US'], 'Asia/Taipei')], [s, 'zh-tw']);
});

// HTML checks: language links and hreflang alternates.
function htmlPages(dir = root, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'tests' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) htmlPages(p, out);
    else if (e.name.endsWith('.html')) out.push(path.relative(root, p).split(path.sep).join('/'));
  }
  return out;
}
const pages = htmlPages();
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const alternates = (html) => [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => [m[1], m[2]]);

test('lang: every header language link remembers the choice', () => {
  for (const rel of pages) {
    const nav = (read(rel).match(/<nav class="site-nav"[\s\S]*?<\/nav>/) || [''])[0];
    eq([rel, nav.includes('<a href="/zh-tw/" data-set-lang="zh-tw"'), nav.includes('<a href="/en/" data-set-lang="en"')], [rel, true, true]);
  }
});
test('lang: the logo links to the home page of the page language', () => {
  for (const rel of pages) {
    const home = rel.startsWith('zh-tw/') ? '/zh-tw/' : rel.startsWith('en/') ? '/en/' : '/';
    eq([rel, read(rel).includes('<a class="brand" href="' + home + '">')], [rel, true]);
  }
});
test('lang: hreflang alternates point to real pages that list the same set', () => {
  for (const rel of pages) {
    const alts = alternates(read(rel));
    if (!alts.length) continue;
    const self = 'https://toollamp.github.io/' + rel.replace(/index\.html$/, '');
    eq([rel, alts.some(([, u]) => u === self)], [rel, true]);
    for (const [h, u] of alts) {
      eq([rel, h, ['x-default', 'zh-Hant', 'en'].includes(h)], [rel, h, true]);
      const target = u.replace('https://toollamp.github.io/', '') + 'index.html';
      eq([rel, u, fs.existsSync(path.join(root, target))], [rel, u, true]);
      eq([rel, u, alternates(read(target))], [rel, u, alts]);
    }
  }
});
test('lang: every tool exists in both languages and the pages list each other', () => {
  const tools = pages.filter(rel => /^(zh-tw|en)\/[^/]+\/[^/]+\/index\.html$/.test(rel) && !/^(zh-tw|en)\/(about|privacy|contact)\//.test(rel));
  eq(tools.length >= 8, true);
  for (const rel of tools) {
    const other = rel.startsWith('en/') ? rel.replace(/^en\//, 'zh-tw/') : rel.replace(/^zh-tw\//, 'en/');
    eq([rel, pages.includes(other)], [rel, true]);
    eq([rel, alternates(read(rel)).map(a => a[0])], [rel, ['zh-Hant', 'en']]);
  }
});
