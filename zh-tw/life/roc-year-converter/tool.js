// 民國西元換算. Pure logic first (testable with node), DOM wiring below.
var ROC = (function () {
  var STEMS = '甲乙丙丁戊己庚辛壬癸';
  var BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
  var ZODIAC = '鼠牛虎兔龍蛇馬羊猴雞狗豬';

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

  function ganzhi(y) {
    var i = mod(y - 4, 60);
    return { gz: STEMS[i % 10] + BRANCHES[i % 12], zodiac: ZODIAC[i % 12] };
  }

  function rocLabel(r) { return r.era + r.n + '年'; }

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

  function validDate(y, m, d) {
    if (m < 1 || m > 12 || d < 1) return false;
    var dim = new Date(Date.UTC(2000, m, 0)).getUTCDate(); // month length, leap-safe below
    if (m === 2) dim = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
    return d <= dim;
  }

  // Parse a ROC date: 115/10/19, 115.10.19, 115-10-19, 民國115年10月19日, 1151019
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
    if (!m) return { error: '看不懂這個日期格式，請輸入像 115/10/19 或 1151019 這樣的格式。' };
    var n = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
    var y = fromRoc(n, era);
    if (!y) return { error: '年份不正確。' };
    if (!validDate(y, mo, d)) return { error: '這一天不存在，請檢查月份和日期。' };
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

  return { toRoc: toRoc, fromRoc: fromRoc, ganzhi: ganzhi, rocLabel: rocLabel,
    parseRocDate: parseRocDate, formatRocDate: formatRocDate, pad: pad };
})();

if (typeof module !== 'undefined') module.exports = ROC;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var mode = 'w2r';

  // ---- Year converter ----
  function renderYear() {
    var out = $('year-result');
    var raw = $('year-input').value.trim();
    if (!raw) { out.hidden = true; return; }
    var n = Number(raw);
    out.hidden = false;
    if (!Number.isInteger(n) || n < 1) {
      out.innerHTML = '<p class="error">請輸入正整數年份。</p>';
      return;
    }
    var y, main, sub;
    if (mode === 'w2r') {
      y = n;
      var r = ROC.toRoc(y);
      main = ROC.rocLabel(r);
      sub = '西元 ' + y + ' 年';
    } else {
      y = ROC.fromRoc(n, $('era').value);
      if (!y) { out.innerHTML = '<p class="error">這個民前年份早於西元 1 年，無法換算。</p>'; return; }
      main = '西元 ' + y + ' 年';
      sub = $('era').value + n + '年';
    }
    var g = ROC.ganzhi(y);
    out.innerHTML =
      '<div class="result-main"><span id="year-main">' + main + '</span>' +
      '<button class="copy-btn" type="button" data-copy="year-main" data-done="已複製">複製</button></div>' +
      '<div class="result-sub">' + sub + '</div>' +
      '<dl class="result-list"><dt>干支</dt><dd>' + g.gz + '年</dd><dt>生肖</dt><dd>' + g.zodiac +
      '（以農曆新年為界）</dd><dt>距今</dt><dd>' + describeDistance(y) + '</dd></dl>';
  }

  function describeDistance(y) {
    var now = new Date().getFullYear();
    if (y === now) return '就是今年';
    return y < now ? (now - y) + ' 年前' : (y - now) + ' 年後';
  }

  function setMode(next) {
    mode = next;
    document.querySelectorAll('#mode-seg button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    });
    $('era-field').hidden = mode === 'w2r';
    $('year-label').textContent = mode === 'w2r' ? '西元年' : '民國年';
    $('year-input').placeholder = mode === 'w2r' ? '例如 2026' : '例如 115';
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
    if (p.error) { out.innerHTML = '<p class="error">' + p.error + '</p>'; return; }
    var iso = p.y + '-' + ROC.pad(p.m, 2) + '-' + ROC.pad(p.d, 2);
    out.innerHTML =
      '<div class="result-main"><span id="rocdate-main">' + iso + '</span>' +
      '<button class="copy-btn" type="button" data-copy="rocdate-main" data-done="已複製">複製</button></div>' +
      '<div class="result-sub">西元 ' + p.y + ' 年 ' + p.m + ' 月 ' + p.d + ' 日</div>';
  }

  function renderWesternDate() {
    var out = $('wdate-result');
    var v = $('wdate-input').value; // yyyy-mm-dd
    if (!v) { out.hidden = true; return; }
    var parts = v.split('-').map(Number);
    if (parts[0] < 1) { out.hidden = true; return; }
    var f = ROC.formatRocDate(parts[0], parts[1], parts[2]);
    out.hidden = false;
    out.innerHTML =
      '<div class="result-main"><span id="wdate-main">' + f.slash + '</span>' +
      '<button class="copy-btn" type="button" data-copy="wdate-main" data-done="已複製">複製</button></div>' +
      '<dl class="result-list"><dt>中文寫法</dt><dd>' + f.words + '</dd>' +
      (f.compact ? '<dt>7 碼格式</dt><dd>' + f.compact + '</dd>' : '') + '</dl>';
  }

  $('rocdate-input').addEventListener('input', renderRocDate);
  $('wdate-input').addEventListener('input', renderWesternDate);

  // Start with today's year so the page is never empty.
  $('year-input').value = new Date().getFullYear();
  setMode('w2r');
});
