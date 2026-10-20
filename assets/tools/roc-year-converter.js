// ROC (Minguo) year converter / 民國西元換算, shared by /zh-tw/ and /en/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
var ROC = (function () {
  var STEMS = '甲乙丙丁戊己庚辛壬癸';
  var BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
  var ZODIAC = '鼠牛虎兔龍蛇馬羊猴雞狗豬';
  var STEMS_PY = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'];
  var BRANCHES_PY = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];
  var ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];

  function mod(a, n) { return ((a % n) + n) % n; }

  // Western year -> { era: '民國' | '民前', n }
  function toRoc(y) {
    if (!Number.isInteger(y) || y < 1) return null;
    return y >= 1912 ? { era: '民國', n: y - 1911 } : { era: '民前', n: 1912 - y };
  }

  function fromRoc(n, era) {
    if (!Number.isInteger(n) || n < 1) return null;
    var y = era === '民前' ? 1912 - n : n + 1911;
    return y >= 1 ? y : null;
  }

  // gz/zodiac in Chinese, py/animal in English.
  function ganzhi(y) {
    var i = mod(y - 4, 60);
    return { gz: STEMS[i % 10] + BRANCHES[i % 12], zodiac: ZODIAC[i % 12],
      py: STEMS_PY[i % 10] + '-' + BRANCHES_PY[i % 12], animal: ANIMALS[i % 12] };
  }

  function rocLabel(r) { return r.era + r.n + '年'; }

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

  function validDate(y, m, d) {
    if (m < 1 || m > 12 || d < 1) return false;
    var dim = new Date(Date.UTC(2000, m, 0)).getUTCDate(); // month length, leap-safe below
    if (m === 2) dim = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
    return d <= dim;
  }

  // Parse a ROC date: 115/10/19, 115.10.19, 115-10-19, 民國115年10月19日, 1151019.
  // Returns { y, m, d, era, n } or { error: 'format' | 'year' | 'date' }.
  function parseRocDate(text) {
    var s = String(text).replace(/\s+/g, '').replace(/[／．－]/g, function (c) {
      return { '／': '/', '．': '.', '－': '-' }[c];
    }).replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
    var era = '民國';
    var m;
    if (/^民前/.test(s)) { era = '民前'; s = s.slice(2); }
    else if (/^民國/.test(s)) { s = s.slice(2); }
    if ((m = s.match(/^(\d{3})(\d{2})(\d{2})$/))) { /* 7-digit form */ }
    else m = s.match(/^(\d{1,3})[\/.\-年](\d{1,2})[\/.\-月](\d{1,2})日?$/);
    if (!m) return { error: 'format' };
    var n = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
    var y = fromRoc(n, era);
    if (!y) return { error: 'year' };
    if (!validDate(y, mo, d)) return { error: 'date' };
    return { y: y, m: mo, d: d, era: era, n: n };
  }

  function formatRocDate(y, m, d) {
    var r = toRoc(y);
    return {
      slash: (r.era === '民前' ? '民前' : '') + r.n + '/' + pad(m, 2) + '/' + pad(d, 2),
      words: r.era + r.n + '年' + m + '月' + d + '日',
      compact: r.era === '民國' && r.n < 1000 ? pad(r.n, 3) + pad(m, 2) + pad(d, 2) : null
    };
  }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    'zh-tw': {
      copy: '複製', copied: '已複製',
      yearLabel: { w2r: '西元年', r2w: '民國年' },
      yearPlaceholder: { w2r: '例如 2026', r2w: '例如 115' },
      badYear: '請輸入正整數年份。',
      tooEarly: '這個民前年份早於西元 1 年，無法換算。',
      roc: function (r) { return rocLabel(r); },
      western: function (y) { return '西元 ' + y + ' 年'; },
      rocInChinese: null,
      ganzhiLabel: '干支', ganzhi: function (g) { return g.gz + '年'; },
      zodiacLabel: '生肖', zodiac: function (g) { return g.zodiac + '（以農曆新年為界）'; },
      distanceLabel: '距今',
      distance: function (diff) { return diff === 0 ? '就是今年' : diff > 0 ? diff + ' 年前' : -diff + ' 年後'; },
      dateError: {
        format: '看不懂這個日期格式，請輸入像 115/10/19 或 1151019 這樣的格式。',
        year: '年份不正確。',
        date: '這一天不存在，請檢查月份和日期。'
      },
      westernDate: function (y, m, d) { return '西元 ' + y + ' 年 ' + m + ' 月 ' + d + ' 日'; },
      wordsLabel: '中文寫法', compactLabel: '7 碼格式'
    },
    en: {
      copy: 'Copy', copied: 'Copied',
      yearLabel: { w2r: 'Western year', r2w: 'ROC year' },
      yearPlaceholder: { w2r: 'e.g. 2026', r2w: 'e.g. 115' },
      badYear: 'Enter a whole year greater than 0.',
      tooEarly: 'That year is before 1 AD, so it can’t be converted.',
      roc: function (r) { return r.era === '民國' ? 'ROC ' + r.n : r.n + (r.n === 1 ? ' year' : ' years') + ' before ROC'; },
      western: function (y) { return 'Year ' + y; },
      rocInChinese: 'In Chinese',
      ganzhiLabel: 'Sexagenary year', ganzhi: function (g) { return g.gz + ' (' + g.py + ')'; },
      zodiacLabel: 'Zodiac', zodiac: function (g) { return g.animal + ' ' + g.zodiac + ' (from Lunar New Year)'; },
      distanceLabel: 'From now',
      distance: function (diff) { return diff === 0 ? 'This year' : diff > 0 ? diff + (diff === 1 ? ' year' : ' years') + ' ago' : -diff + (diff === -1 ? ' year' : ' years') + ' from now'; },
      dateError: {
        format: 'Use a format like 115/10/19 or 1151019.',
        year: 'The year isn’t valid.',
        date: 'That day doesn’t exist. Check the month and day.'
      },
      westernDate: function (y, m, d) { return MONTHS[m - 1] + ' ' + d + ', ' + y; },
      wordsLabel: 'In Chinese', compactLabel: '7-digit form'
    }
  };

  return { toRoc: toRoc, fromRoc: fromRoc, ganzhi: ganzhi, rocLabel: rocLabel,
    parseRocDate: parseRocDate, formatRocDate: formatRocDate, pad: pad, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = ROC;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = ROC.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var mode = 'w2r';

  function copyable(id, text) {
    return '<div class="result-main"><span id="' + id + '">' + text + '</span>' +
      '<button class="copy-btn" type="button" data-copy="' + id + '" data-done="' + T.copied + '">' + T.copy + '</button></div>';
  }

  // ---- Year converter ----
  function renderYear() {
    var out = $('year-result');
    var raw = $('year-input').value.trim();
    if (!raw) { out.hidden = true; return; }
    var n = Number(raw);
    out.hidden = false;
    if (!Number.isInteger(n) || n < 1) {
      out.innerHTML = '<p class="error">' + T.badYear + '</p>';
      return;
    }
    var y, r, main, sub;
    if (mode === 'w2r') {
      y = n;
      r = ROC.toRoc(y);
      main = T.roc(r);
      sub = T.western(y);
    } else {
      y = ROC.fromRoc(n, $('era').value);
      if (!y) { out.innerHTML = '<p class="error">' + T.tooEarly + '</p>'; return; }
      r = { era: $('era').value, n: n };
      main = T.western(y);
      sub = T.roc(r);
    }
    var g = ROC.ganzhi(y);
    out.innerHTML = copyable('year-main', main) +
      '<div class="result-sub">' + sub + '</div>' +
      '<dl class="result-list">' +
      (T.rocInChinese ? '<dt>' + T.rocInChinese + '</dt><dd lang="zh-Hant-TW">' + ROC.rocLabel(r) + '</dd>' : '') +
      '<dt>' + T.ganzhiLabel + '</dt><dd>' + T.ganzhi(g) + '</dd>' +
      '<dt>' + T.zodiacLabel + '</dt><dd>' + T.zodiac(g) + '</dd>' +
      '<dt>' + T.distanceLabel + '</dt><dd>' + T.distance(new Date().getFullYear() - y) + '</dd></dl>';
  }

  function setMode(next) {
    mode = next;
    document.querySelectorAll('#mode-seg button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    });
    $('era-field').hidden = mode === 'w2r';
    $('year-label').textContent = T.yearLabel[mode];
    $('year-input').placeholder = T.yearPlaceholder[mode];
    renderYear();
  }

  document.querySelectorAll('#mode-seg button').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.mode); });
  });
  $('year-input').addEventListener('input', renderYear);
  $('era').addEventListener('change', renderYear);

  // ---- Date converter ----
  function renderRocDate() {
    var out = $('rocdate-result');
    var raw = $('rocdate-input').value.trim();
    if (!raw) { out.hidden = true; return; }
    out.hidden = false;
    var p = ROC.parseRocDate(raw);
    if (p.error) { out.innerHTML = '<p class="error">' + T.dateError[p.error] + '</p>'; return; }
    var iso = p.y + '-' + ROC.pad(p.m, 2) + '-' + ROC.pad(p.d, 2);
    out.innerHTML = copyable('rocdate-main', iso) +
      '<div class="result-sub">' + T.westernDate(p.y, p.m, p.d) + '</div>';
  }

  function renderWesternDate() {
    var out = $('wdate-result');
    var v = $('wdate-input').value; // yyyy-mm-dd
    if (!v) { out.hidden = true; return; }
    var parts = v.split('-').map(Number);
    if (parts[0] < 1) { out.hidden = true; return; }
    var f = ROC.formatRocDate(parts[0], parts[1], parts[2]);
    out.hidden = false;
    out.innerHTML = copyable('wdate-main', f.slash) +
      '<dl class="result-list"><dt>' + T.wordsLabel + '</dt><dd lang="zh-Hant-TW">' + f.words + '</dd>' +
      (f.compact ? '<dt>' + T.compactLabel + '</dt><dd>' + f.compact + '</dd>' : '') + '</dl>';
  }

  $('rocdate-input').addEventListener('input', renderRocDate);
  $('wdate-input').addEventListener('input', renderWesternDate);

  // Start with today's year so the page is never empty.
  $('year-input').value = new Date().getFullYear();
  setMode('w2r');
});
