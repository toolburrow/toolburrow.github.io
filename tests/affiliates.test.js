const fs = require('fs');
const path = require('path');
const AFF = require('../assets/affiliates.js');

const item = (n) => ({ name: 'Item ' + n, url: 'https://example.com/p/' + n, note: 'Why item ' + n + '.' });

test('affiliates: empty slots render nothing', () => {
  eq(AFF.render([], 'en'), ''); eq(AFF.render([], 'zh-Hant-TW'), '');
  eq(AFF.render(undefined, 'en'), ''); eq(AFF.render(null, 'en'), '');
});
test('affiliates: every slot starts empty', () => {
  for (const k of Object.keys(AFF.SLOTS)) eq([k, AFF.SLOTS[k]], [k, []]);
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
  const pages = []; // a tool page is a folder with tool.js next to index.html
  for (const lang of ['zh-tw', 'en']) for (const cat of fs.readdirSync(path.join(root, lang), { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    for (const tool of fs.readdirSync(path.join(root, lang, cat.name), { withFileTypes: true })) {
      const dir = path.join(root, lang, cat.name, tool.name);
      if (tool.isDirectory() && fs.existsSync(path.join(dir, 'tool.js'))) pages.push([tool.name, path.join(dir, 'index.html')]);
    }
  }
  eq(pages.length >= 4, true);
  for (const [slug, file] of pages) {
    const html = fs.readFileSync(file, 'utf8');
    eq([slug, html.includes('<aside class="affiliate" data-slot="' + slug + '" hidden></aside>')], [slug, true]);
    eq([slug, html.includes('<script src="/assets/affiliates.js"></script>')], [slug, true]);
    eq([slug, Object.prototype.hasOwnProperty.call(AFF.SLOTS, slug)], [slug, true]);
  }
});
