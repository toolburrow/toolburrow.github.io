// Site-wide checks on the HTML files: sitemap coverage and footer links.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

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
const urlOf = (rel) => 'https://toolburrow.github.io/' + rel.replace(/index\.html$/, '');
const sitemap = [...fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

test('site: every page except 404 is in the sitemap', () => {
  for (const rel of pages) if (rel !== '404.html') eq([rel, sitemap.includes(urlOf(rel))], [rel, true]);
});
test('site: every sitemap URL is a real page', () => {
  eq(new Set(sitemap).size, sitemap.length);
  for (const url of sitemap) {
    const rel = url.replace('https://toolburrow.github.io/', '') + 'index.html';
    eq([url, fs.existsSync(path.join(root, rel))], [url, true]);
  }
});
test('site: every page links to about, privacy and contact in its footer', () => {
  for (const rel of pages) {
    const footer = (fs.readFileSync(path.join(root, rel), 'utf8').match(/<footer class="site-footer">[\s\S]*?<\/footer>/) || [''])[0];
    const langs = rel.startsWith('en/') ? ['en'] : rel.startsWith('zh-tw/') ? ['zh-tw'] : ['zh-tw', 'en'];
    for (const l of langs) for (const p of ['about', 'privacy', 'contact']) {
      eq([rel, footer.includes('href="/' + l + '/' + p + '/"')], [rel, true]);
    }
  }
});
test('site: canonical URL matches the page location', () => {
  for (const rel of pages) {
    if (rel === '404.html') continue;
    const m = fs.readFileSync(path.join(root, rel), 'utf8').match(/<link rel="canonical" href="([^"]+)">/);
    eq([rel, m && m[1]], [rel, urlOf(rel)]);
  }
});
