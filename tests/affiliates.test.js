const fs = require('fs');
const path = require('path');
const AFF = require('../assets/affiliates.js');

const item = (n) => ({ name: 'Item ' + n, url: 'https://example.com/p/' + n, note: 'Why item ' + n + '.' });

test('affiliates: empty slots render nothing', () => {
  eq(AFF.render([], 'en'), ''); eq(AFF.render([], 'zh-Hant-TW'), '');
  eq(AFF.render(undefined, 'en'), ''); eq(AFF.render(null, 'en'), '');
});
test('affiliates: every filled slot uses an approved program and renders all its items', () => {
  // Approved programs (PLAN.md): 蝦皮分潤計畫 for zh-tw pages only. English pages stay empty until one is approved.
  for (const [k, items] of Object.entries(AFF.SLOTS)) {
    eq([k, items.length <= AFF.MAX_ITEMS], [k, true]);
    eq([k, AFF.usable(items).length], [k, items.length]);
    for (const it of items) eq([k, k.startsWith('zh-tw/') && /^https:\/\/s\.shopee\.tw\/[A-Za-z0-9]+$/.test(it.url)], [k, true]);
  }
});
test('affiliates: renders items with sponsored links', () => {
  const html = AFF.render([item(1), item(2)], 'en');
  eq((html.match(/<li>/g) || []).length, 2);
  eq((html.match(/rel="sponsored noopener" target="_blank"/g) || []).length, 2);
  eq(html.includes('<a href="https://example.com/p/1" rel="sponsored noopener" target="_blank">Item 1</a><span>Why item 1.</span>'), true);
  eq(html.includes('<h2>Recommended products</h2>'), true);
  eq(html.includes('This page contains affiliate links.'), true);
});
test('affiliates: Chinese text on zh pages', () => {
  const html = AFF.render([item(1)], 'zh-Hant-TW');
  eq(html.includes('<h2>推薦商品</h2>'), true);
  eq(html.includes('本頁含有聯盟連結'), true);
  eq(html.includes('This page contains'), false);
});
test('affiliates: at most 3 items', () => {
  eq((AFF.render([1, 2, 3, 4, 5].map(item), 'en').match(/<li>/g) || []).length, 3);
});
test('affiliates: skips incomplete or unsafe items', () => {
  const bad = [
    { name: 'No note', url: 'https://example.com' },
    { url: 'https://example.com', note: 'No name.' },
    { name: 'Plain http', url: 'http://example.com', note: 'x' },
    { name: 'Script', url: 'javascript:alert(1)', note: 'x' },
    { name: 'Quote', url: 'https://example.com/"onmouseover="x', note: 'x' },
    null
  ];
  eq(AFF.render(bad, 'en'), '');
  eq(AFF.usable(bad.concat([item(1)])).length, 1);
});
test('affiliates: escapes names and notes', () => {
  const html = AFF.render([{ name: '<b>A&B</b>', url: 'https://example.com/?a=1&b=2', note: '"quoted"' }], 'en');
  eq(html.includes('&lt;b&gt;A&amp;B&lt;/b&gt;'), true);
  eq(html.includes('href="https://example.com/?a=1&amp;b=2"'), true);
  eq(html.includes('&quot;quoted&quot;'), true);
  eq(html.includes('<b>'), false);
});
test('affiliates: every tool page has a matching slot and loads the script', () => {
  const root = path.join(__dirname, '..');
  const pages = []; // a tool page is /<lang>/<category>/<slug>/index.html
  for (const lang of ['zh-tw', 'en']) for (const cat of fs.readdirSync(path.join(root, lang), { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    for (const tool of fs.readdirSync(path.join(root, lang, cat.name), { withFileTypes: true })) {
      const file = path.join(root, lang, cat.name, tool.name, 'index.html');
      if (tool.isDirectory() && fs.existsSync(file)) pages.push([lang + '/' + tool.name, file]);
    }
  }
  eq(pages.length >= 8, true);
  for (const [slot, file] of pages) {
    const html = fs.readFileSync(file, 'utf8');
    eq([slot, html.includes('<aside class="affiliate" data-slot="' + slot + '" hidden></aside>')], [slot, true]);
    eq([slot, /<script src="\/assets\/affiliates.js(\?v=\d+)?"><\/script>/.test(html)], [slot, true]);
    eq([slot, Object.prototype.hasOwnProperty.call(AFF.SLOTS, slot)], [slot, true]);
  }
  eq(Object.keys(AFF.SLOTS).sort(), pages.map(p => p[0]).sort()); // no slot without a page
});
