// SMD resistor code calculator / SMD 電阻代碼換算, shared by /en/ and /zh-tw/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// Three marking systems: 3-digit (103 = 10 × 10³ Ω), 4-digit (1002 = 100 × 10² Ω) and EIA-96 (01C = 100 × 100 Ω),
// where the two digits are an index into the E96 series and the letter is the multiplier. R marks a decimal point (4R7).
var ELEC = typeof module !== 'undefined' ? require('../elec.js') : window.ELEC;

var SMD = (function () {
  var clean = ELEC.clean;

  // E96 values in index order: EIA-96 code 01 is 100, 96 is 976. Each is 100 × 10^(i/96) rounded to 3 digits.
  var E96 = [100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143, 147, 150, 154, 158, 162,
    165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280,
    287, 294, 301, 309, 316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453, 464, 475, 487,
    499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665, 681, 698, 715, 732, 750, 768, 787, 806, 825, 845,
    866, 887, 909, 931, 953, 976];
  // EIA-96 multiplier letters -> power of ten. Y/R, X/S and B/H are two letters for the same multiplier.
  var EIA_EXP = { Z: -3, Y: -2, R: -2, X: -1, S: -1, A: 0, B: 1, H: 1, C: 2, D: 3, E: 4, F: 5 };
  var EIA_LETTER = { '-3': 'Z', '-2': 'Y', '-1': 'X', 0: 'A', 1: 'B', 2: 'C', 3: 'D', 4: 'E', 5: 'F' };
  var EIA_MIN = 0.1, EIA_MAX = 976e5;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // Code as printed -> resistance. Returns { kind, ohms, ... } or { error: 'empty' | 'format' | 'index' }.
  // kind: 'zero' (0, 00, 000, 0000), 'digits3', 'digits4' (with digits, exp), 'r' (R as decimal point),
  // 'eia96' (with index, base, letter). tol is the usual tolerance of parts marked that way, in %.
  function decode(text) {
    var s = String(text == null ? '' : text).toUpperCase().replace(/\s+/g, '');
    if (!s) return { error: 'empty' };
    if (/^0{1,4}$/.test(s)) return { kind: 'zero', ohms: 0, tol: null };
    var m = s.match(/^(\d\d)([ZYRXSABHCDEF])$/);
    if (m) {
      var i = Number(m[1]);
      if (i < 1 || i > 96) return { error: 'index' };
      // Some makers print 10R for 10 Ω; as EIA-96, R is ×0.01.
      return { kind: 'eia96', index: i, base: E96[i - 1], letter: m[2], exp: EIA_EXP[m[2]],
        ohms: clean(E96[i - 1] * Math.pow(10, EIA_EXP[m[2]])), tol: 1, altOhms: m[2] === 'R' ? i : null };
    }
    m = s.match(/^(\d{2,3})(\d)$/);
    if (m && Number(m[1]) > 0) {
      var exp = Number(m[2]);
      return { kind: m[1].length === 2 ? 'digits3' : 'digits4', digits: Number(m[1]), exp: exp,
        ohms: clean(Number(m[1]) * Math.pow(10, exp)), tol: m[1].length === 2 ? 5 : 1 };
    }
    if (/^\d*R\d+$/.test(s) && s.length >= 3 && s.length <= 4) {
      var ohms = Number(s.replace('R', '.'));
      if (ohms > 0) return { kind: 'r', ohms: ohms, tol: s.length === 3 ? 5 : 1 };
    }
    return { error: 'format' };
  }

  // Resistance -> 3-digit (sig = 2) or 4-digit (sig = 3) code. Values below 10 or 100 Ω use R as the decimal point.
  // Returns { code, ohms } (ohms is what the code stands for) or { error: 'small' | 'large' }.
  function digitCode(v, sig) {
    if (v < Math.pow(10, sig - 1)) {
      var whole = v >= 1 ? Math.floor(Math.log10(v) + 1e-9) + 1 : 0;
      var dec = sig - whole;
      var n = Math.round(v * Math.pow(10, dec));
      // Tiny values keep only one or two digits after R, so 0.005 would round to R01 (0.01 Ω): refuse past 5%.
      if (n === 0 || Math.abs(n / Math.pow(10, dec) - v) > v * 0.05) return { error: 'small' };
      if (n >= Math.pow(10, sig)) return digitCode(n / Math.pow(10, dec), sig); // 9.96 rounds up to 10.0
      var str = String(n);
      while (str.length < sig) str = '0' + str;
      return { code: str.slice(0, whole) + 'R' + str.slice(whole), ohms: clean(n / Math.pow(10, dec)) };
    }
    var exp = Math.floor(Math.log10(v) + 1e-9) - (sig - 1);
    var digits = Math.round(v / Math.pow(10, exp));
    if (digits >= Math.pow(10, sig)) { digits = Math.round(digits / 10); exp += 1; }
    if (exp > 9) return { error: 'large' };
    return { code: String(digits) + exp, ohms: clean(digits * Math.pow(10, exp)) };
  }

  // Resistance -> the nearest EIA-96 code. Returns { code, ohms } or { error: 'range' }.
  function eiaCode(v) {
    if (v < EIA_MIN * (1 - 1e-9) || v > EIA_MAX * (1 + 1e-9)) return { error: 'range' };
    var best = null;
    for (var exp = -3; exp <= 5; exp++) E96.forEach(function (b, i) {
      var x = clean(b * Math.pow(10, exp));
      var d = Math.abs(Math.log(x / v));
      if (!best || d < best.d) best = { d: d, code: pad2(i + 1) + EIA_LETTER[exp], ohms: x };
    });
    return { code: best.code, ohms: best.ohms };
  }

  // Resistance as typed (4.7k, 4k7, 49.9, R005, 0) -> all three codes, each with exact and the difference in %.
  // Returns { ohms, d3, d4, eia } or { ohms: 0, zero: true } or { error: 'empty' | 'format' | 'negative' }.
  function encode(text) {
    if (!String(text == null ? '' : text).trim()) return { error: 'empty' };
    var v = ELEC.parseResistance(text);
    if (v === null) return { error: 'format' };
    if (v < 0) return { error: 'negative' };
    if (v === 0) return { ohms: 0, zero: true };
    var mark = function (c) {
      if (!c.error) { c.exact = Math.abs(c.ohms - v) <= v * 1e-9; c.diff = (c.ohms - v) / v * 100; }
      return c;
    };
    return { ohms: v, d3: mark(digitCode(v, 2)), d4: mark(digitCode(v, 3)), eia: mark(eiaCode(v)) };
  }

  var SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function pow(exp) { return exp < 0 ? String(Math.pow(10, exp)) : '10' + SUP[exp]; }
  var om = function (v) { return ELEC.si(v, 'Ω'); };
  var pct = function (d) { return (d > 0 ? '+' : '−') + Math.abs(d).toFixed(2) + '%'; };

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    en: {
      copy: 'Copy', copied: 'Copied',
      kind: { zero: 'Zero-ohm jumper', digits3: '3-digit code', digits4: '4-digit code', r: 'R is the decimal point', eia96: 'EIA-96 code' },
      how: {
        zero: function () { return 'A 0 Ω link used as a jumper'; },
        digits3: function (r) { return r.digits + ' × ' + pow(r.exp) + ' Ω'; },
        digits4: function (r) { return r.digits + ' × ' + pow(r.exp) + ' Ω'; },
        r: function () { return 'R marks the decimal point'; },
        eia96: function (r) { return r.index + ' = ' + r.base + ', ' + r.letter + ' = ×' + Math.pow(10, r.exp) + ' → ' + r.base + ' × ' + Math.pow(10, r.exp) + ' Ω'; }
      },
      typeLabel: 'Marking', tolLabel: 'Usual tolerance', tol: function (t) { return '±' + t + '%'; },
      alt: function (n) { return 'Some makers print ' + n + 'R to mean ' + n + ' Ω, so compare it with the other resistors on the board.'; },
      decodeError: {
        empty: function () { return 'Enter the code printed on the resistor, e.g. 103.'; },
        format: function () { return 'Use a code like 103, 4R7, 1002, R010 or 01C.'; },
        index: function () { return 'EIA-96 codes run from 01 to 96. Check the two digits.'; }
      },
      labels: { d3: '3-digit code (±5%)', d4: '4-digit code (±1%)', eia: 'EIA-96 code (±1%)' },
      codeLine: {
        exact: function (c) { return c.code; },
        rounded: function (c) { return c.code + ' = ' + om(c.ohms) + ' (closest, ' + pct(c.diff) + ')'; },
        small: function () { return 'Too small for this code'; },
        large: function () { return 'Too large for this code'; },
        range: function () { return 'EIA-96 covers 0.1 Ω to 97.6 MΩ'; }
      },
      zeroCodes: '0, 000 or 0000 (a 0 Ω jumper)',
      encodeError: {
        empty: function () { return 'Enter a resistance, e.g. 4.7k.'; },
        format: function () { return 'Use a value like 4.7k, 4k7, 220, 49.9, 1M or R005.'; },
        negative: function () { return 'Resistance can’t be negative.'; }
      }
    },
    'zh-tw': {
      copy: '複製', copied: '已複製',
      kind: { zero: '0 Ω 跳線電阻', digits3: '3 碼', digits4: '4 碼', r: 'R 代表小數點', eia96: 'EIA-96' },
      how: {
        zero: function () { return '0 Ω，當作跳線使用'; },
        digits3: function (r) { return r.digits + ' × ' + pow(r.exp) + ' Ω'; },
        digits4: function (r) { return r.digits + ' × ' + pow(r.exp) + ' Ω'; },
        r: function () { return 'R 代表小數點'; },
        eia96: function (r) { return r.index + ' = ' + r.base + '，' + r.letter + ' = ×' + Math.pow(10, r.exp) + ' → ' + r.base + ' × ' + Math.pow(10, r.exp) + ' Ω'; }
      },
      typeLabel: '標示方式', tolLabel: '一般誤差', tol: function (t) { return '±' + t + '%'; },
      alt: function (n) { return '有些廠商會印 ' + n + 'R 代表 ' + n + ' Ω，可以對照板子上其他電阻的標示來判斷。'; },
      decodeError: {
        empty: function () { return '請輸入電阻上印的代碼，例如 103。'; },
        format: function () { return '請輸入像 103、4R7、1002、R010 或 01C 這樣的代碼。'; },
        index: function () { return 'EIA-96 代碼的數字是 01 到 96，請檢查前兩位。'; }
      },
      labels: { d3: '3 碼（±5%）', d4: '4 碼（±1%）', eia: 'EIA-96（±1%）' },
      codeLine: {
        exact: function (c) { return c.code; },
        rounded: function (c) { return c.code + ' = ' + om(c.ohms) + '（最接近的值，' + pct(c.diff) + '）'; },
        small: function () { return '數值太小，這種代碼無法表示'; },
        large: function () { return '數值太大，這種代碼無法表示'; },
        range: function () { return 'EIA-96 只能表示 0.1 Ω 到 97.6 MΩ'; }
      },
      zeroCodes: '0、000 或 0000（0 Ω 跳線電阻）',
      encodeError: {
        empty: function () { return '請輸入電阻值，例如 4.7k。'; },
        format: function () { return '請輸入像 4.7k、4k7、220、49.9、1M 或 R005 這樣的電阻值。'; },
        negative: function () { return '電阻值不能是負數。'; }
      }
    }
  };

  return { E96: E96, EIA_EXP: EIA_EXP, decode: decode, encode: encode, digitCode: digitCode, eiaCode: eiaCode, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = SMD;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = SMD.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];

  function main(id, text) {
    return '<div class="result-main"><span id="' + id + '">' + text + '</span>' +
      '<button class="copy-btn" type="button" data-copy="' + id + '" data-done="' + T.copied + '">' + T.copy + '</button></div>';
  }

  function renderDecode() {
    var out = $('decode-result');
    var r = SMD.decode($('code-input').value);
    if (r.error) { out.innerHTML = '<p class="error">' + T.decodeError[r.error]() + '</p>'; return; }
    out.innerHTML = main('decode-main', ELEC.si(r.ohms, 'Ω')) +
      '<div class="result-sub">' + T.how[r.kind](r) + '</div>' +
      '<dl class="result-list"><dt>' + T.typeLabel + '</dt><dd>' + T.kind[r.kind] + '</dd>' +
      (r.tol ? '<dt>' + T.tolLabel + '</dt><dd>' + T.tol(r.tol) + '</dd>' : '') + '</dl>' +
      (r.altOhms ? '<p class="notice">' + T.alt(r.altOhms) + '</p>' : '');
  }

  function line(c) { return c.error ? T.codeLine[c.error]() : T.codeLine[c.exact ? 'exact' : 'rounded'](c); }

  function renderEncode() {
    var out = $('encode-result');
    var r = SMD.encode($('value-input').value);
    if (r.error) { out.innerHTML = '<p class="error">' + T.encodeError[r.error]() + '</p>'; return; }
    if (r.zero) { out.innerHTML = main('encode-main', '000') + '<div class="result-sub">' + T.zeroCodes + '</div>'; return; }
    // The headline is the first code that is exact, so 49.9 Ω shows 49R9 rather than a rounded 3-digit code.
    var best = ['d3', 'd4', 'eia'].filter(function (k) { return !r[k].error && r[k].exact; })[0];
    var head = best ? r[best].code : (r.d4.error ? r.d3 : r.d4).code || '—';
    out.innerHTML = main('encode-main', head) +
      '<div class="result-sub">= ' + ELEC.si(r.ohms, 'Ω') + '</div>' +
      '<dl class="result-list">' + ['d3', 'd4', 'eia'].map(function (k) {
        return '<dt>' + T.labels[k] + '</dt><dd>' + line(r[k]) + '</dd>';
      }).join('') + '</dl>';
  }

  $('code-input').addEventListener('input', renderDecode);
  $('value-input').addEventListener('input', renderEncode);

  // Start with the most common marking and a common value, so neither panel is empty.
  $('code-input').value = '103';
  $('value-input').value = '4.7k';
  renderDecode();
  renderEncode();
});
