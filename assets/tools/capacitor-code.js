// Capacitor code calculator / 電容代碼換算, shared by /en/ and /zh-tw/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// A code is in picofarads: two digits and a multiplier digit (104 = 10 × 10⁴ pF), or R as the decimal point (4R7 = 4.7 pF).
var ELEC = typeof module !== 'undefined' ? require('../elec.js') : window.ELEC;

var CAP = (function () {
  var clean = ELEC.clean;

  // EIA voltage codes printed before the value, as in 2A104J (2A = 100 V).
  var VOLTAGE = { '0G': 4, '0J': 6.3, '1A': 10, '1C': 16, '1E': 25, '1V': 35, '1H': 50, '1J': 63, '1K': 80,
    '2A': 100, '2C': 160, '2D': 200, '2E': 250, '2F': 315, '2V': 350, '2G': 400, '2W': 450, '2H': 500, '2J': 630, '3A': 1000 };
  // Tolerance letters after the value. B and C are in pF; D is ±0.5 pF below 10 pF and ±0.5% above; Z is +80% / −20%.
  var TOLERANCE = { B: { pf: 0.1 }, C: { pf: 0.25 }, D: { pf: 0.5, pct: 0.5 }, F: { pct: 1 }, G: { pct: 2 },
    J: { pct: 5 }, K: { pct: 10 }, M: { pct: 20 }, Z: { plus: 80, minus: 20 } };
  // Third digit -> power of ten. 8 and 9 mean ×0.01 and ×0.1; 7 shows up on tantalum parts (107 = 100 µF).
  var EXP = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: -2, 9: -1 };

  function tolerance(letter, pf) {
    var t = TOLERANCE[letter];
    if (t.plus) return { type: 'asym', plus: t.plus, minus: t.minus, min: clean(pf * (1 - t.minus / 100)), max: clean(pf * (1 + t.plus / 100)) };
    if (t.pf && (!t.pct || pf < 10)) return { type: 'pf', v: t.pf, min: clean(Math.max(0, pf - t.pf)), max: clean(pf + t.pf) };
    return { type: 'pct', v: t.pct, min: clean(pf * (1 - t.pct / 100)), max: clean(pf * (1 + t.pct / 100)) };
  }

  // Code as printed -> value. Accepts 104, 104K, 2A104J, 472 J, 47, 4R7, R47.
  // Returns { pf, f, kind: 'digits3' | 'digits2' | 'r', digits, exp, voltage, letter, tol } or
  // { error: 'empty' | 'format' | 'voltage' (with code) | 'tolerance' (with letter) }.
  function decode(text) {
    var s = String(text == null ? '' : text).toUpperCase().replace(/\s+/g, '');
    if (!s) return { error: 'empty' };
    var m = s.match(/^(?:([0-3][A-Z]))?(\d{2,3}|\d*R\d+)([A-Z])?$/);
    if (!m) return { error: 'format' };
    if (m[1] && !VOLTAGE[m[1]]) return { error: 'voltage', code: m[1] };
    if (m[3] && !TOLERANCE[m[3]]) return { error: 'tolerance', letter: m[3] };
    var v = m[2], r = { voltage: m[1] ? VOLTAGE[m[1]] : null, letter: m[3] || null };
    if (v.indexOf('R') >= 0) {
      r.kind = 'r';
      r.pf = Number(v.replace('R', '.'));
    } else if (v.length === 2) {
      r.kind = 'digits2';
      r.pf = Number(v);
    } else {
      r.kind = 'digits3';
      r.digits = Number(v.slice(0, 2));
      r.exp = EXP[v[2]];
      r.pf = clean(r.digits * Math.pow(10, r.exp));
    }
    if (!(r.pf > 0)) return { error: 'format' };
    r.f = clean(r.pf * 1e-12);
    r.tol = r.letter ? tolerance(r.letter, r.pf) : null;
    return r;
  }

  // Value as typed (100n, 0.1u, 4.7nF, 22p) -> code. A bare number has no unit and is refused, since people mean
  // pF, nF or µF depending on the part. Returns { code, pf, f, exact, short } where pf is the value the code stands for
  // and short is the two-digit form printed on small parts (22 for 220), or
  // { error: 'empty' | 'unit' | 'format' | 'positive' | 'small' | 'large' }.
  function encode(text) {
    var s = String(text == null ? '' : text).trim();
    if (!s) return { error: 'empty' };
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s.replace(/\s+/g, ''))) return { error: 'unit' };
    var c = ELEC.parseCapacitance(s, 1);
    if (c === null) return { error: 'format' };
    if (!(c > 0)) return { error: 'positive' };
    var pf = clean(c * 1e12), code, actual, short = null;
    var tenths = Math.round(pf * 10);
    if (tenths === 0) return { error: 'small' };
    if (tenths < 100) {
      // Below 10 pF: R marks the decimal point, 4R7 = 4.7 pF.
      code = Math.floor(tenths / 10) + 'R' + (tenths % 10);
      actual = tenths / 10;
    } else {
      var exp = Math.floor(Math.log10(pf) + 1e-9) - 1;
      var digits = Math.round(pf / Math.pow(10, exp));
      if (digits >= 100) { digits = Math.round(digits / 10); exp += 1; }
      if (exp > 7) return { error: 'large' };
      code = String(digits) + exp;
      actual = clean(digits * Math.pow(10, exp));
      if (exp === 0) short = String(digits);
    }
    return { code: code, pf: actual, f: clean(actual * 1e-12), exact: Math.abs(actual - pf) <= pf * 1e-9, short: short };
  }

  // A value in pF shown in pF, nF and µF, with thousands separators: 100000 -> ['100,000', '100', '0.1'].
  function units(pf) {
    return [pf, pf / 1e3, pf / 1e6].map(function (x) { return clean(x).toLocaleString('en-US', { maximumSignificantDigits: 12 }); });
  }

  var SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  // The multiplier as people write it: 10⁴ for 4, 0.1 for 9, 0.01 for 8.
  function mult(exp) { return exp < 0 ? String(Math.pow(10, exp)) : '10' + String(exp).split('').map(function (c) { return SUP[c]; }).join(''); }

  var range = function (sep) { return function (t) { return ELEC.si(t.min * 1e-12, 'F') + sep + ELEC.si(t.max * 1e-12, 'F'); }; };

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    en: {
      copy: 'Copy', copied: 'Copied',
      unitLabels: ['Picofarads', 'Nanofarads', 'Microfarads'],
      tolLabel: 'Tolerance', voltageLabel: 'Rated voltage', valueLabel: 'Value',
      how: {
        digits3: function (r) { return r.digits + ' × ' + mult(r.exp) + ' pF'; },
        digits2: function () { return 'Two digits are the value in pF'; },
        r: function () { return 'R marks the decimal point, in pF'; }
      },
      tol: function (t) {
        var v = t.type === 'asym' ? '+' + t.plus + '% / −' + t.minus + '%' : '±' + t.v + (t.type === 'pf' ? ' pF' : '%');
        return v + ' (' + range(' to ')(t) + ')';
      },
      decodeError: {
        empty: function () { return 'Enter the code printed on the capacitor, e.g. 104.'; },
        format: function () { return 'Use a code like 104, 472J, 2A104K or 4R7.'; },
        voltage: function (e) { return e.code + ' is not a voltage code this tool knows. See the voltage code table below.'; },
        tolerance: function (e) { return e.letter + ' is not a tolerance letter. Common ones are J (±5%), K (±10%) and M (±20%).'; }
      },
      encodeError: {
        empty: function () { return 'Enter a capacitance, e.g. 100n.'; },
        unit: function () { return 'Add a unit: p, n or u, e.g. 100n, 0.1u or 22p.'; },
        format: function () { return 'Use a value like 100n, 0.1u, 4.7nF or 22p.'; },
        positive: function () { return 'Enter a value greater than zero.'; },
        small: function () { return 'Below 0.05 pF there is no code.'; },
        large: function () { return 'Codes go up to 990 µF. Larger capacitors have the value printed on them.'; }
      },
      rounded: function (v) { return 'A code holds only two significant digits, so the closest code stands for ' + v + '.'; },
      short: function (s) { return 'Small values are often printed with just the two digits: ' + s + '.'; }
    },
    'zh-tw': {
      copy: '複製', copied: '已複製',
      unitLabels: ['pF（皮法拉）', 'nF（奈法拉）', 'µF（微法拉）'],
      tolLabel: '誤差', voltageLabel: '耐壓', valueLabel: '電容值',
      how: {
        digits3: function (r) { return r.digits + ' × ' + mult(r.exp) + ' pF'; },
        digits2: function () { return '兩位數字直接是 pF 值'; },
        r: function () { return 'R 代表小數點，單位是 pF'; }
      },
      tol: function (t) {
        var v = t.type === 'asym' ? '+' + t.plus + '%／−' + t.minus + '%' : '±' + t.v + (t.type === 'pf' ? ' pF' : '%');
        return v + '（' + range(' 到 ')(t) + '）';
      },
      decodeError: {
        empty: function () { return '請輸入電容上印的代碼，例如 104。'; },
        format: function () { return '請輸入像 104、472J、2A104K 或 4R7 這樣的代碼。'; },
        voltage: function (e) { return e.code + ' 不是這個工具認得的耐壓代碼，請對照下面的耐壓代碼表。'; },
        tolerance: function (e) { return e.letter + ' 不是誤差字母，常見的是 J（±5%）、K（±10%）、M（±20%）。'; }
      },
      encodeError: {
        empty: function () { return '請輸入電容值，例如 100n。'; },
        unit: function () { return '請加上單位 p、n 或 u，例如 100n、0.1u、22p。'; },
        format: function () { return '請輸入像 100n、0.1u、4.7nF 或 22p 這樣的電容值。'; },
        positive: function () { return '請輸入大於 0 的電容值。'; },
        small: function () { return '小於 0.05 pF 沒有對應的代碼。'; },
        large: function () { return '代碼最大到 990 µF，更大的電容會直接印出電容值。'; }
      },
      rounded: function (v) { return '代碼只有兩位有效數字，最接近的代碼代表 ' + v + '。'; },
      short: function (s) { return '小電容常常只印兩位數字：' + s + '。'; }
    }
  };

  return { VOLTAGE: VOLTAGE, TOLERANCE: TOLERANCE, decode: decode, encode: encode, units: units, mult: mult, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = CAP;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = CAP.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var UNITS = ['pF', 'nF', 'µF'];

  function main(id, text) {
    return '<div class="result-main"><span id="' + id + '">' + text + '</span>' +
      '<button class="copy-btn" type="button" data-copy="' + id + '" data-done="' + T.copied + '">' + T.copy + '</button></div>';
  }
  function unitRows(pf) {
    return CAP.units(pf).map(function (v, i) { return '<dt>' + T.unitLabels[i] + '</dt><dd>' + v + ' ' + UNITS[i] + '</dd>'; }).join('');
  }

  function renderDecode() {
    var out = $('decode-result');
    var r = CAP.decode($('code-input').value);
    if (r.error) { out.innerHTML = '<p class="error">' + T.decodeError[r.error](r) + '</p>'; return; }
    out.innerHTML = main('decode-main', ELEC.si(r.f, 'F')) +
      '<div class="result-sub">' + T.how[r.kind](r) + '</div>' +
      '<dl class="result-list">' + unitRows(r.pf) +
      (r.tol ? '<dt>' + T.tolLabel + '</dt><dd>' + T.tol(r.tol) + '</dd>' : '') +
      (r.voltage ? '<dt>' + T.voltageLabel + '</dt><dd>' + r.voltage + ' V</dd>' : '') + '</dl>';
  }

  function renderEncode() {
    var out = $('encode-result');
    var r = CAP.encode($('value-input').value);
    if (r.error) { out.innerHTML = '<p class="error">' + T.encodeError[r.error]() + '</p>'; return; }
    out.innerHTML = main('encode-main', r.code) +
      '<div class="result-sub">= ' + ELEC.si(r.f, 'F') + '</div>' +
      '<dl class="result-list">' + unitRows(r.pf) + '</dl>' +
      (r.exact ? '' : '<p class="notice">' + T.rounded(ELEC.si(r.f, 'F')) + '</p>') +
      (r.short ? '<p class="notice">' + T.short(r.short) + '</p>' : '');
  }

  $('code-input').addEventListener('input', renderDecode);
  $('value-input').addEventListener('input', renderEncode);

  // Start with the most searched code and a common value, so neither panel is empty.
  $('code-input').value = '104';
  $('value-input').value = '4.7n';
  renderDecode();
  renderEncode();
});
