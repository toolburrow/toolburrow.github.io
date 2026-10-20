// Resistor color code calculator / 電阻色碼計算, shared by /en/ and /zh-tw/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
var RCC = (function () {
  var COLORS = {
    black:  { name: 'Black',  hex: '#1B1B1B', digit: 0, exp: 0 },
    brown:  { name: 'Brown',  hex: '#7B4A26', digit: 1, exp: 1, tol: 1 },
    red:    { name: 'Red',    hex: '#C8281E', digit: 2, exp: 2, tol: 2 },
    orange: { name: 'Orange', hex: '#E8781A', digit: 3, exp: 3 },
    yellow: { name: 'Yellow', hex: '#F2C80F', digit: 4, exp: 4 },
    green:  { name: 'Green',  hex: '#2E8B3A', digit: 5, exp: 5, tol: 0.5 },
    blue:   { name: 'Blue',   hex: '#2457C5', digit: 6, exp: 6, tol: 0.25 },
    violet: { name: 'Violet', hex: '#7A3DB8', digit: 7, exp: 7, tol: 0.1 },
    grey:   { name: 'Grey',   hex: '#8A8A8A', digit: 8, exp: 8, tol: 0.05 },
    white:  { name: 'White',  hex: '#F2F2F2', digit: 9, exp: 9 },
    gold:   { name: 'Gold',   hex: '#C9A227', exp: -1, tol: 5 },
    silver: { name: 'Silver', hex: '#B8BCC2', exp: -2, tol: 10 },
    none:   { name: 'None',   hex: null, tol: 20 }
  };
  var DIGIT_COLORS = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white'];
  var MULT_COLORS = DIGIT_COLORS.concat(['gold', 'silver']);
  var TOL_COLORS = Object.keys(COLORS).filter(function (k) { return COLORS[k].tol !== undefined; });

  function clean(x) { return Number(x.toPrecision(12)); }

  // bands: array of color keys. 4-band = 2 digits + mult + tol; 5-band = 3 digits + mult + tol.
  function decode(bands) {
    var sig = bands.length - 2;
    var digits = 0;
    for (var i = 0; i < sig; i++) digits = digits * 10 + COLORS[bands[i]].digit;
    var exp = COLORS[bands[sig]].exp;
    var ohms = clean(digits * Math.pow(10, exp));
    var tol = COLORS[bands[sig + 1]].tol;
    return { ohms: ohms, tol: tol, min: clean(ohms * (1 - tol / 100)), max: clean(ohms * (1 + tol / 100)) };
  }

  function formatOhms(v) {
    var units = [[1e9, 'GΩ'], [1e6, 'MΩ'], [1e3, 'kΩ'], [1, 'Ω']];
    for (var i = 0; i < units.length; i++) {
      if (Math.abs(v) >= units[i][0] || i === units.length - 1) {
        return clean(v / units[i][0]).toString() + ' ' + units[i][1];
      }
    }
  }

  // Accepts 4.7k, 4k7, 470, 2.2M, R47, 0.47, 10kΩ, 1 ohm. "m" is treated as mega (resistor convention).
  function parseValue(text) {
    var s = String(text).trim().toLowerCase().replace(/\s+/g, '').replace(/(Ω|ω|ohms?)$/, '');
    var mult = { r: 1, '': 1, k: 1e3, m: 1e6, g: 1e9 };
    var m = s.match(/^(\d*)([rkmg])(\d+)$/);
    if (m && (m[1] !== '' || m[2] === 'r')) return clean(Number((m[1] || '0') + '.' + m[3]) * mult[m[2]]);
    m = s.match(/^(\d*\.?\d+)([rkmg]?)$/);
    if (m) return clean(Number(m[1]) * mult[m[2]]);
    return null;
  }

  // Value -> color bands for the given number of significant digits (2 or 3).
  // Errors: { error: 'zero' }, { error: 'small', min }, { error: 'large' }.
  function encode(ohms, sig) {
    if (!(ohms > 0)) return { error: 'zero' };
    var exp = Math.floor(Math.log10(ohms) + 1e-9) - (sig - 1);
    var digits = Math.round(ohms / Math.pow(10, exp));
    if (digits >= Math.pow(10, sig)) { digits = Math.round(digits / 10); exp += 1; }
    if (exp < -2) return { error: 'small', min: clean(Math.pow(10, sig - 1) / 100) };
    if (exp > 9) return { error: 'large' };
    var actual = clean(digits * Math.pow(10, exp));
    var ds = String(digits);
    while (ds.length < sig) ds = '0' + ds;
    var bands = ds.split('').map(function (c) { return DIGIT_COLORS[Number(c)]; });
    bands.push(MULT_COLORS.filter(function (k) { return COLORS[k].exp === exp; })[0]);
    return { bands: bands, actual: actual, exact: Math.abs(actual - ohms) / ohms < 1e-9 };
  }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  // Color names here; the English name in COLORS is only a fallback for code that has no page language.
  var TEXT = {
    en: {
      copy: 'Copy', copied: 'Copied',
      colors: { black: 'Black', brown: 'Brown', red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue',
        violet: 'Violet', grey: 'Grey', white: 'White', gold: 'Gold', silver: 'Silver', none: 'None' },
      digitBand: function (n) { return 'Band ' + n + ' (digit)'; }, multiplier: 'Multiplier', tolerance: 'Tolerance',
      range: function (a, b) { return a + ' to ' + b; }, sep: ', ',
      option: function (color, detail) { return color + ' (' + detail + ')'; },
      bandsTitle: function (n) { return n + '-band'; },
      bandsAria: function (title, names) { return title + ' resistor: ' + names; },
      badValue: 'Use a format like 4.7k, 4k7, 220, 1M or R47.',
      encodeError: {
        zero: function () { return 'Enter a value greater than zero.'; },
        small: function (e, sig) { return 'Too small to show with ' + sig + ' digit bands (smallest is ' + formatOhms(e.min) + ').'; },
        large: function () { return 'Too large for standard color bands.'; }
      },
      rounded: function (v, sig) { return 'Rounded to ' + v + '. ' + sig + ' significant digits can’t show this value exactly.'; }
    },
    'zh-tw': {
      copy: '複製', copied: '已複製',
      colors: { black: '黑', brown: '棕', red: '紅', orange: '橙', yellow: '黃', green: '綠', blue: '藍',
        violet: '紫', grey: '灰', white: '白', gold: '金', silver: '銀', none: '無色環' },
      digitBand: function (n) { return '第 ' + n + ' 環（數字）'; }, multiplier: '倍率', tolerance: '誤差',
      range: function (a, b) { return a + ' 到 ' + b; }, sep: '、',
      option: function (color, detail) { return color + '（' + detail + '）'; },
      bandsTitle: function (n) { return n + ' 環'; },
      bandsAria: function (title, names) { return title + '電阻：' + names; },
      badValue: '請輸入像 4.7k、4k7、220、1M 或 R47 這樣的格式。',
      encodeError: {
        zero: function () { return '請輸入大於 0 的電阻值。'; },
        small: function (e, sig) { return '數值太小，' + sig + ' 位數字的色環無法表示（最小是 ' + formatOhms(e.min) + '）。'; },
        large: function () { return '數值太大，標準色環無法表示。'; }
      },
      rounded: function (v, sig) { return '已四捨五入為 ' + v + '。' + sig + ' 位有效數字無法精確表示這個值。'; }
    }
  };

  return { COLORS: COLORS, DIGIT_COLORS: DIGIT_COLORS, MULT_COLORS: MULT_COLORS, TOL_COLORS: TOL_COLORS,
    decode: decode, encode: encode, parseValue: parseValue, formatOhms: formatOhms, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = RCC;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var C = RCC.COLORS;
  var T = RCC.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var name = function (k) { return T.colors[k]; };
  var names = function (keys) { return keys.map(name).join(T.sep); };
  var count = 4;
  var state = { 4: ['yellow', 'violet', 'red', 'gold'], 5: ['brown', 'black', 'black', 'red', 'brown'] };

  function labelFor(i) {
    var sig = count - 2;
    if (i < sig) return T.digitBand(i + 1);
    return i === sig ? T.multiplier : T.tolerance;
  }
  function optionsFor(i) {
    var sig = count - 2;
    if (i < sig) return i === 0 ? RCC.DIGIT_COLORS.slice(1) : RCC.DIGIT_COLORS;
    return i === sig ? RCC.MULT_COLORS : RCC.TOL_COLORS;
  }
  function optionText(key, i) {
    var sig = count - 2, c = C[key];
    if (i < sig) return T.option(name(key), c.digit);
    if (i === sig) return T.option(name(key), '×' + RCC.formatOhms(Math.pow(10, c.exp)).replace(/\s*Ω$/, '').replace(' ', ''));
    return T.option(name(key), '±' + c.tol + '%');
  }

  function buildSelects() {
    var box = $('band-selects');
    box.innerHTML = '';
    state[count].forEach(function (key, i) {
      var f = document.createElement('div');
      f.className = 'field band-field';
      var id = 'band-' + i;
      var sw = document.createElement('span');
      sw.className = 'swatch';
      f.innerHTML = '<label for="' + id + '">' + labelFor(i) + '</label>';
      var sel = document.createElement('select');
      sel.id = id;
      optionsFor(i).forEach(function (k) {
        var o = document.createElement('option');
        o.value = k; o.textContent = optionText(k, i);
        sel.appendChild(o);
      });
      sel.value = key;
      sel.addEventListener('change', function () { state[count][i] = sel.value; render(); });
      f.appendChild(sel);
      box.appendChild(f);
    });
  }

  function drawResistor(bands, svgId) {
    var svg = $(svgId);
    var g = svg.querySelector('.bands');
    g.innerHTML = '';
    var sig = bands.length - 2;
    var xs = [];
    for (var i = 0; i < sig + 1; i++) xs.push(108 + i * 26);
    if (bands.length > sig + 1) xs.push(268);
    bands.forEach(function (key, i) {
      var hex = C[key] && C[key].hex;
      if (!hex) return;
      var r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      r.setAttribute('x', xs[i]); r.setAttribute('y', 22);
      r.setAttribute('width', 14); r.setAttribute('height', 56);
      r.setAttribute('fill', hex);
      g.appendChild(r);
    });
  }

  function render() {
    var bands = state[count];
    var r = RCC.decode(bands);
    drawResistor(bands, 'resistor-svg');
    $('decode-main').textContent = RCC.formatOhms(r.ohms) + ' ±' + r.tol + '%';
    $('decode-range').textContent = T.range(RCC.formatOhms(r.min), RCC.formatOhms(r.max));
    $('decode-bands').textContent = names(bands);
  }

  function setCount(n) {
    count = n;
    document.querySelectorAll('#count-seg button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.count) === n));
    });
    buildSelects();
    render();
  }
  document.querySelectorAll('#count-seg button').forEach(function (b) {
    b.addEventListener('click', function () { setCount(Number(b.dataset.count)); });
  });

  // ---- Value -> colors ----
  function renderEncode() {
    var out = $('encode-result');
    var raw = $('value-input').value;
    if (!raw.trim()) { out.hidden = true; return; }
    out.hidden = false;
    var v = RCC.parseValue(raw);
    if (v === null) { out.innerHTML = '<p class="error">' + T.badValue + '</p>'; return; }
    var tolKey = $('tol-select').value;
    var html = '';
    [2, 3].forEach(function (sig) {
      var e = RCC.encode(v, sig);
      var title = T.bandsTitle(sig + 2);
      if (e.error) { html += '<h3>' + title + '</h3><p class="error">' + T.encodeError[e.error](e, sig) + '</p>'; return; }
      var bands = e.bands.concat([tolKey]);
      html += '<h3>' + title + '</h3>' +
        '<svg class="mini-resistor" id="enc-svg-' + sig + '" viewBox="0 0 400 100" role="img" aria-label="' + T.bandsAria(title, names(bands)) + '">' +
        resistorShell() + '</svg>' +
        '<p class="band-names">' + names(bands) + '</p>' +
        (e.exact ? '' : '<p class="notice">' + T.rounded(RCC.formatOhms(e.actual), sig) + '</p>');
    });
    out.innerHTML = html;
    [2, 3].forEach(function (sig) {
      var e = RCC.encode(v, sig);
      if (!e.error) drawResistor(e.bands.concat([tolKey]), 'enc-svg-' + sig);
    });
  }

  function resistorShell() {
    return '<line x1="0" y1="50" x2="400" y2="50" class="lead"/>' +
      '<rect x="80" y="22" width="240" height="56" rx="24" class="body"/><g class="bands"></g>';
  }

  $('value-input').addEventListener('input', renderEncode);
  $('tol-select').addEventListener('change', renderEncode);
  RCC.TOL_COLORS.forEach(function (k) {
    var o = document.createElement('option');
    o.value = k; o.textContent = T.option(name(k), '±' + C[k].tol + '%');
    $('tol-select').appendChild(o);
  });
  $('tol-select').value = 'gold';

  setCount(4);
  // Start with a common value so the panel is never empty.
  $('value-input').value = '4.7k';
  renderEncode();
});
