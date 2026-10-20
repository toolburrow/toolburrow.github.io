// Site-wide checks on the HTML files: sitemap coverage and footer links.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function htmlPages(dir = root, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'tests' || e.name === 'node_modules') continue;
    if (/^google[0-9a-f]+\.html$/.test(e.name)) continue; // Search Console verification file, not a page
    const p = path.join(dir, e.name);
    if (e.isDirectory()) htmlPages(p, out);
    else if (e.name.endsWith('.html')) out.push(path.relative(root, p).split(path.sep).join('/'));
  }
  return out;
}
const pages = htmlPages();
const urlOf = (rel) => 'https://toollamp.github.io/' + rel.replace(/index\.html$/, '');
const sitemap = [...fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);

test('site: every page except 404 is in the sitemap', () => {
  for (const rel of pages) if (rel !== '404.html') eq([rel, sitemap.includes(urlOf(rel))], [rel, true]);
});
test('site: every sitemap URL is a real page', () => {
  eq(new Set(sitemap).size, sitemap.length);
  for (const url of sitemap) {
    const rel = url.replace('https://toollamp.github.io/', '') + 'index.html';
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
test('site: ad slots are styled but no page has one yet', () => {
  const css = fs.readFileSync(path.join(root, 'assets/site.css'), 'utf8');
  eq(/\.ad-slot \{[^}]*min-height: 300px/.test(css), true);
  for (const rel of pages) eq([rel, /class="[^"]*\bad-slot\b/.test(fs.readFileSync(path.join(root, rel), 'utf8'))], [rel, false]);
});
test('site: footers carry no affiliate disclosure until a program is approved', () => {
  for (const rel of pages) {
    const footer = (fs.readFileSync(path.join(root, rel), 'utf8').match(/<footer class="site-footer">[\s\S]*?<\/footer>/) || [''])[0];
    eq([rel, /聯盟|affiliate/i.test(footer)], [rel, false]);
  }
});

const meta = (html, attr, key) => {
  const m = html.match(new RegExp('<meta ' + attr + '="' + key + '" content="([^"]*)">'));
  return m && m[1];
};
test('site: Open Graph tags match the title, description and canonical URL', () => {
  eq(fs.existsSync(path.join(root, 'assets/og.png')), true);
  for (const rel of pages) {
    if (rel === '404.html') continue;
    const h = fs.readFileSync(path.join(root, rel), 'utf8');
    eq([rel, meta(h, 'property', 'og:title')], [rel, h.match(/<title>([^<]*)<\/title>/)[1].replace(/ - ToolLamp$/, '')]);
    eq([rel, meta(h, 'property', 'og:description')], [rel, meta(h, 'name', 'description')]);
    eq([rel, meta(h, 'property', 'og:url')], [rel, urlOf(rel)]);
    eq([rel, meta(h, 'property', 'og:image')], [rel, 'https://toollamp.github.io/assets/og.png']);
    eq([rel, meta(h, 'property', 'og:locale')], [rel, rel.startsWith('en/') ? 'en_US' : 'zh_TW']);
    eq([rel, meta(h, 'name', 'twitter:card')], [rel, 'summary_large_image']);
  }
});

test('site: every tool page lists 2-4 related tools, copied from its home page', () => {
  for (const lang of ['zh-tw', 'en']) {
    const home = fs.readFileSync(path.join(root, lang, 'index.html'), 'utf8');
    const entries = new Map([...home.matchAll(/<li><a href="(\/[^"]+)">.*?<\/li>/g)].map(m => [m[1], m[0]]));
    for (const rel of pages.filter(p => p.startsWith(lang + '/') && p.split('/').length === 4)) {
      const h = fs.readFileSync(path.join(root, rel), 'utf8');
      const self = '/' + rel.replace(/index\.html$/, '');
      eq([rel, entries.has(self)], [rel, true]);
      const nav = (h.match(/<nav class="tool-group" aria-labelledby="related-h">[\s\S]*?<\/nav>/) || [''])[0];
      eq([rel, nav !== ''], [rel, true]);
      eq([rel, h.indexOf('</article>') < h.indexOf('aria-labelledby="related-h"')], [rel, true]);
      const lis = [...nav.matchAll(/<li><a href="(\/[^"]+)">.*?<\/li>/g)];
      eq([rel, lis.length >= 2 && lis.length <= 4], [rel, true]);
      for (const m of lis) {
        eq([rel, m[1] !== self], [rel, true]);
        eq([rel, m[0]], [rel, entries.get(m[1])]);
      }
    }
  }
});
test('site: both language versions of a tool list the same related tools', () => {
  const picks = (rel) => [...(fs.readFileSync(path.join(root, rel), 'utf8').match(/<nav class="tool-group" aria-labelledby="related-h">[\s\S]*?<\/nav>/) || [''])[0]
    .matchAll(/<li><a href="\/(?:zh-tw|en)\/([^"]+)">/g)].map(m => m[1]);
  for (const rel of pages.filter(p => p.startsWith('zh-tw/') && p.split('/').length === 4))
    eq([rel, picks(rel)], [rel, picks(rel.replace(/^zh-tw\//, 'en/'))]);
});
test('site: meta descriptions fit in a search result', () => {
  for (const rel of pages) {
    if (rel === '404.html') continue; // not indexed
    const m = fs.readFileSync(path.join(root, rel), 'utf8').match(/<meta name="description" content="([^"]*)">/);
    if (!m) continue;
    const width = [...m[1]].reduce((w, c) => w + (c.codePointAt(0) > 0x2e7f ? 2 : 1), 0); // full-width counts as two
    eq([rel, width > 50 && width <= 160], [rel, true]);
  }
});
test('site: page-level <style> rules are not copied between tools', () => {
  const seen = {};
  for (const rel of pages.filter(p => p.split('/').length === 4)) {
    const tool = rel.split('/').slice(1, 3).join('/');
    const style = (fs.readFileSync(path.join(root, rel), 'utf8').match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
    for (const rule of style.split('\n').map(l => l.trim()).filter(Boolean)) {
      seen[rule] = seen[rule] || new Set();
      seen[rule].add(tool);
    }
  }
  for (const rule of Object.keys(seen)) eq([rule, seen[rule].size], [rule, 1]);
});
test('site: the home pages name the site ToolLamp for search results', () => {
  for (const rel of ['index.html', 'zh-tw/index.html', 'en/index.html']) {
    const m = fs.readFileSync(path.join(root, rel), 'utf8').match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const data = JSON.parse(m[1]);
    eq([rel, data['@type'], data.name, data.url], [rel, 'WebSite', 'ToolLamp', 'https://toollamp.github.io/']);
  }
});
