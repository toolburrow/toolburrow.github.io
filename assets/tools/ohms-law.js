// Ohm's law calculator / 歐姆定律計算, shared by /en/ and /zh-tw/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
var ELEC = typeof module !== 'undefined' ? require('../elec.js') : window.ELEC;

var OHM = (function () {
  var clean = ELEC.clean;
  var KEYS = ['v', 'i', 'r', 'p'];
  var KIND = { v: 'voltage', i: 'current', r: 'resistance', p: 'power' };
  var NAME = { v: 'V', i: 'I', r: 'R', p: 'P' };

  // Formula for each unknown, by the pair of known values.
  var FORMULAS = {
    vi: { r: 'R = V / I', p: 'P = V × I' },
    vr: { i: 'I = V / R', p: 'P = V² / R' },
    vp: { i: 'I = P / V', r: 'R = V² / P' },
    ir: { v: 'V = I × R', p: 'P = I² × R' },
    ip: { v: 'V = P / I', r: 'R = P / I²' },
    rp: { v: 'V = √(P × R)', i: 'I = √(P / R)' }
  };

  function solve(k) {
    var v = k.v, i = k.i, r = k.r, p = k.p;
    if (v !== undefined && i !== undefined) return { r: v / i, p: v * i };
    if (v !== undefined && r !== undefined) return { i: v / r, p: v * v / r };
    if (v !== undefined && p !== undefined) return { i: p / v, r: v * v / p };
    if (i !== undefined && r !== undefined) return { v: i * r, p: i * i * r };
    if (i !== undefined && p !== undefined) return { v: p / i, r: p / (i * i) };
    return { v: Math.sqrt(p * r), i: Math.sqrt(p / r) };
  }

  // texts: { v, i, r, p } as typed; exactly two must be filled in. Bare current is A and bare power is W.
  // Returns { v, i, r, p, known: [keys], unknown: [keys], formulas } or { error, name }.
  function calc(texts) {
    var known = KEYS.filter(function (k) { return String(texts[k] == null ? '' : texts[k]).trim() !== ''; });
    if (known.length < 2) return { error: 'need-two' };
    if (known.length > 2) return { error: 'too-many' };
    var vals = {};
    for (var n = 0; n < known.length; n++) {
      var k = known[n], r = ELEC.read(texts[k], KIND[k], NAME[k]);
      if (r.error) return r;
      if (!(r.v > 0)) return { error: 'voltage-positive', name: 'V' };
      vals[k] = r.v;
    }
    var out = solve(vals);
    var res = { known: known, unknown: KEYS.filter(function (k) { return known.indexOf(k) < 0; }), formulas: FORMULAS[known.join('')] };
    KEYS.forEach(function (k) { res[k] = clean(vals[k] !== undefined ? vals[k] : out[k]); });
    return res;
  }

  var UNIT = { v: 'V', i: 'A', r: 'Ω', p: 'W' };
  function format(k, x) { return ELEC.si(x, UNIT[k]); }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    en: {
      copy: 'Copy', copied: 'Copied', knownLabel: 'You entered', formulaLabel: 'Formulas', sep: ', ',
      errors: {
        'need-two': function () { return 'Enter any two of the four values.'; },
        'too-many': function () { return 'Enter only two values. Clear the others to calculate.'; },
        'voltage-format': function () { return 'V isn’t a voltage. Use a value like 5, 3.3, 3V3 or 500mV.'; },
        'current-format': function () { return 'I isn’t a current. Use a value like 0.02, 20mA or 1.5A.'; },
        'resistance-format': function () { return 'R isn’t a resistance. Use a value like 220, 4k7 or 1M.'; },
        'power-format': function () { return 'P isn’t a power. Use a value like 0.25, 1/4W or 250mW.'; },
        'voltage-positive': function () { return 'V must be greater than 0.'; },
        'current-positive': function () { return 'I must be greater than 0.'; },
        'resistance-positive': function () { return 'R must be greater than 0 Ω.'; },
        'power-positive': function () { return 'P must be greater than 0.'; }
      }
    },
    'zh-tw': {
      copy: '複製', copied: '已複製', knownLabel: '你輸入的', formulaLabel: '公式', sep: '、',
      errors: {
        'need-two': function () { return '請在四個欄位中任填兩個。'; },
        'too-many': function () { return '只能填兩個值，請清除其他欄位再計算。'; },
        'voltage-format': function () { return 'V 不是有效的電壓，請輸入像 5、3.3、3V3 或 500mV 這樣的值。'; },
        'current-format': function () { return 'I 不是有效的電流，請輸入像 0.02、20mA 或 1.5A 這樣的值。'; },
        'resistance-format': function () { return 'R 不是有效的電阻值，請輸入像 220、4k7 或 1M 這樣的值。'; },
        'power-format': function () { return 'P 不是有效的功率，請輸入像 0.25、1/4W 或 250mW 這樣的值。'; },
        'voltage-positive': function () { return 'V 必須大於 0。'; },
        'current-positive': function () { return 'I 必須大於 0。'; },
        'resistance-positive': function () { return 'R 必須大於 0 Ω。'; },
        'power-positive': function () { return 'P 必須大於 0。'; }
      }
    }
  };

  return { FORMULAS: FORMULAS, calc: calc, format: format, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = OHM;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = OHM.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var IDS = { v: 'ohm-v', i: 'ohm-i', r: 'ohm-r', p: 'ohm-p' };

  function render() {
    var out = $('ohm-result');
    var r = OHM.calc({ v: $(IDS.v).value, i: $(IDS.i).value, r: $(IDS.r).value, p: $(IDS.p).value });
    if (r.error) { out.innerHTML = '<p class="error">' + T.errors[r.error]() + '</p>'; return; }
    var first = r.unknown[0], second = r.unknown[1];
    var name = function (k) { return k.toUpperCase(); };
    out.innerHTML =
      '<div class="result-main">' + name(first) + ' = <span id="ohm-main">' + OHM.format(first, r[first]) + '</span>' +
      '<button class="copy-btn" type="button" data-copy="ohm-main" data-done="' + T.copied + '">' + T.copy + '</button></div>' +
      '<div class="result-main">' + name(second) + ' = ' + OHM.format(second, r[second]) + '</div>' +
      '<dl class="result-list"><dt>' + T.formulaLabel + '</dt><dd>' + r.unknown.map(function (k) { return r.formulas[k]; }).join(T.sep) + '</dd>' +
      '<dt>' + T.knownLabel + '</dt><dd>' + r.known.map(function (k) { return name(k) + ' = ' + OHM.format(k, r[k]); }).join(T.sep) + '</dd></dl>';
  }

  Object.keys(IDS).forEach(function (k) { $(IDS[k]).addEventListener('input', render); });
  $('ohm-clear').addEventListener('click', function () {
    Object.keys(IDS).forEach(function (k) { $(IDS[k]).value = ''; });
    render();
    $(IDS.v).focus();
  });

  // Start with a common case: 5 V across 220 Ω.
  $(IDS.v).value = '5'; $(IDS.r).value = '220';
  render();
});
