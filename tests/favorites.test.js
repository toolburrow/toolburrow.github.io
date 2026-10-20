const FAV = require('../assets/favorites.js');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

test('favorites: stored text that is broken or odd gives a clean list', () => {
  eq(FAV.parse('["life/bmi-calculator","electronics/ohms-law"]'), ['life/bmi-calculator', 'electronics/ohms-law']);
  for (const s of [null, '', 'oops', '{}', '"life/bmi-calculator"', '42', 'null']) eq([s, FAV.parse(s)], [s, []]);
  eq(FAV.parse('["life/bmi-calculator","life/bmi-calculator",3,null,"../x","Life/BMI","life/a b","life/x-","<b>/x"]'), ['life/bmi-calculator']);
  const many = JSON.stringify(Array.from({ length: 80 }, (_, i) => 'life/t' + i));
  eq(FAV.parse(many).length, FAV.MAX);
});
test('favorites: toggle adds to the end and removes', () => {
  let l = [];
  l = FAV.toggle(l, 'life/age-calculator'); l = FAV.toggle(l, 'electronics/ohms-law');
  eq(l, ['life/age-calculator', 'electronics/ohms-law']);
  eq(FAV.toggle(l, 'life/age-calculator'), ['electronics/ohms-law']);
  eq(FAV.toggle(l, 'bad id'), l);
});
test('favorites: tool page paths', () => {
  eq(FAV.fromPath('/zh-tw/life/bmi-calculator/'), { lang: 'zh-tw', id: 'life/bmi-calculator' });
  eq(FAV.fromPath('/en/electronics/ohms-law/index.html'), { lang: 'en', id: 'electronics/ohms-law' });
  for (const p of ['/', '/zh-tw/', '/en/about/', '/zh-tw/life/', '/fr/life/x/', '/zh-tw/life/x/y/', '/zh-tw/life/bmi-calculator']) eq([p, FAV.fromPath(p)], [p, null]);
});
test('favorites: share link round trip', () => {
  const list = ['life/bmi-calculator', 'electronics/ohms-law'];
  const url = FAV.shareUrl('https://toollamp.github.io', 'zh-tw', list);
  eq(url, 'https://toollamp.github.io/zh-tw/?fav=life/bmi-calculator,electronics/ohms-law');
  eq(FAV.fromQuery(url.slice(url.indexOf('?'))), list);
  eq(FAV.fromQuery('?a=1&fav=life%2Fage-calculator,,bad,life/age-calculator#x'), ['life/age-calculator']);
  eq(FAV.fromQuery(''), []); eq(FAV.fromQuery('?fav='), []); eq(FAV.fromQuery('?fav=%E0%A4%A'), []);
  eq(FAV.incoming(['life/a'], ['life/a', 'life/b']), ['life/b']);
});
test('favorites: both languages have the same text keys', () => {
  eq(Object.keys(FAV.TEXT.en).sort(), Object.keys(FAV.TEXT['zh-tw']).sort());
  eq(FAV.TEXT.en.offer(1), 'This link has 1 favorite tool.');
  eq(FAV.TEXT['zh-tw'].offer(3), '這個連結帶有 3 個收藏的工具。');
});
test('favorites: every tool page and both language home pages load the script', () => {
  const pages = ['zh-tw/index.html', 'en/index.html'];
  for (const lang of ['zh-tw', 'en'])
    for (const cat of fs.readdirSync(path.join(root, lang), { withFileTypes: true }).filter(e => e.isDirectory()))
      for (const t of fs.readdirSync(path.join(root, lang, cat.name), { withFileTypes: true }).filter(e => e.isDirectory()))
        pages.push(lang + '/' + cat.name + '/' + t.name + '/index.html');
  eq(pages.length > 20, true);
  for (const rel of pages) {
    eq([rel, fs.readFileSync(path.join(root, rel), 'utf8').includes('<script src="/assets/favorites.js"></script>')], [rel, true]);
    if (rel.split('/').length === 4) eq([rel, FAV.fromPath('/' + rel) !== null], [rel, true]);
  }
});
