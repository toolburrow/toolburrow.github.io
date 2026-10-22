// ADC calculator / ADC 換算, shared by /en/ and /zh-tw/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// An N-bit ADC turns 0..Vref into whole numbers 0..2^N − 1. Code = V / Vref × D, where D is 2^N (the ideal
// transfer function in most datasheets) or 2^N − 1 (so that Vref reads as the top value, common in app notes).
var ELEC = typeof module !== 'undefined' ? require('../elec.js') : window.ELEC;

var ADC = (function () {
  var clean = ELEC.clean;
  var BITS = [8, 10, 12, 14, 16, 18, 20, 24];

  // scale is 'pow' (divide by 2^N) or 'max' (divide by 2^N − 1).
  function setup(vrefText, bits, scale) {
    var vref = ELEC.read(vrefText, 'voltage', 'Vref'); if (vref.error) return vref;
    if (!(vref.v > 0)) return { error: 'vref-positive' };
    var max = Math.pow(2, bits) - 1;
    var div = scale === 'max' ? max : max + 1;
    return { vref: vref.v, bits: bits, scale: scale, max: max, div: div, lsb: vref.v / div };
  }

  // ADC value as typed: 1241, 0x4D9, 0b10011011001, 4,095. Returns an integer, or null.
  function parseCode(text) {
    var s = String(text == null ? '' : text).trim().toLowerCase().replace(/[\s,_]/g, '');
    if (/^\d+$/.test(s)) return Number(s);
    if (/^0x[0-9a-f]+$/.test(s)) return parseInt(s.slice(2), 16);
    if (/^0b[01]+$/.test(s)) return parseInt(s.slice(2), 2);
    return null;
  }

  function hex(code, bits) {
    var digits = Math.ceil(bits / 4);
    return '0x' + ('0000000' + code.toString(16).toUpperCase()).slice(-digits);
  }

  // Voltage -> ADC value. exact is the unrounded value; code is what the ADC reports, rounded and limited to 0..max.
  // clipped is 'high' or 'low' when the voltage is outside 0..Vref.
  function toCode(vrefText, bits, scale, vText) {
    var s = setup(vrefText, bits, scale); if (s.error) return s;
    var v = ELEC.read(vText, 'voltage', 'V'); if (v.error) return v;
    var exact = clean(v.v / s.vref * s.div);
    var code = Math.round(exact), clipped = null;
    if (code > s.max) { code = s.max; clipped = 'high'; }
    if (code < 0) { code = 0; clipped = 'low'; }
    s.v = v.v; s.exact = exact; s.code = code; s.clipped = clipped; s.hex = hex(code, bits);
    s.back = clean(code * s.lsb);
    return s;
  }

  // ADC value -> voltage.
  function toVolt(vrefText, bits, scale, codeText) {
    var s = setup(vrefText, bits, scale); if (s.error) return s;
    if (!String(codeText == null ? '' : codeText).trim()) return { error: 'code-empty' };
    var code = parseCode(codeText);
    if (code === null) return { error: 'code-format' };
    if (code > s.max) return { error: 'code-range', max: s.max };
    s.code = code; s.hex = hex(code, bits); s.v = clean(code * s.lsb);
    return s;
  }

  // A plain number for a sensor reading: 0, -40, 4920, 1.5e3. Returns a number or null.
  function parseNumber(text) {
    var s = String(text == null ? '' : text).trim().replace(/,/g, '');
    return /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s) ? Number(s) : null;
  }

  // Two known points (voltage and reading) -> reading = slope × ADC value + offset, then the reading for one ADC value.
  function scaleReading(vrefText, bits, scale, v1Text, y1Text, v2Text, y2Text, codeText) {
    var s = setup(vrefText, bits, scale); if (s.error) return s;
    var v1 = ELEC.read(v1Text, 'voltage', 'p1'); if (v1.error) return v1;
    var y1 = parseNumber(y1Text); if (y1 === null) return { error: 'reading-format', name: 'p1' };
    var v2 = ELEC.read(v2Text, 'voltage', 'p2'); if (v2.error) return v2;
    var y2 = parseNumber(y2Text); if (y2 === null) return { error: 'reading-format', name: 'p2' };
    if (v1.v === v2.v) return { error: 'same-voltage' };
    var c1 = v1.v / s.vref * s.div, c2 = v2.v / s.vref * s.div;
    var slope = (y2 - y1) / (c2 - c1), offset = y1 - slope * c1;
    if (!String(codeText == null ? '' : codeText).trim()) return { error: 'code-empty' };
    var code = parseCode(codeText);
    if (code === null) return { error: 'code-format' };
    if (code > s.max) return { error: 'code-range', max: s.max };
    return { max: s.max, slope: clean(slope), offset: clean(offset), code: code, reading: clean(slope * code + offset),
      codes: [Math.round(clean(c1)), Math.round(clean(c2))], perVolt: clean((y2 - y1) / (v2.v - v1.v)),
      range: [clean(offset), clean(slope * s.max + offset)] };
  }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    en: {
      copy: 'Copy', copied: 'Copied',
      errors: {
        'voltage-empty': function (r) { return { Vref: 'Enter the reference voltage, for example 3.3.', V: 'Enter a voltage, for example 1.2.',
          p1: 'Enter the voltage of point 1.', p2: 'Enter the voltage of point 2.' }[r.name]; },
        'voltage-format': function (r) { return { Vref: 'The reference voltage', V: 'The voltage', p1: 'The voltage of point 1', p2: 'The voltage of point 2' }[r.name] +
          ' isn’t a voltage. Use a number like 3.3, 1.25, 3V3 or 500mV.'; },
        'vref-positive': function () { return 'The reference voltage must be greater than 0 V.'; },
        'code-empty': function () { return 'Enter an ADC value, for example 2048.'; },
        'code-format': function () { return 'The ADC value must be a whole number such as 2048, or hex such as 0x800.'; },
        'code-range': function (r) { return 'At this resolution the ADC value goes up to ' + r.max + '.'; },
        'reading-format': function (r) { return 'Enter the reading of point ' + r.name.slice(1) + ' as a number, for example 0 or 100.'; },
        'same-voltage': function () { return 'The two points need different voltages.'; }
      },
      adcValue: 'ADC value',
      exact: function (x) { return 'Exact value ' + x + '. A real ADC can read a count or two either side, from noise and offset.'; },
      clipped: { high: 'This is at or above full scale, so the ADC reads its top value.', low: 'This is below 0 V, so the ADC reads 0. Many ADC pins are damaged by negative voltages.' },
      hexLabel: 'Hex', lsbLabel: 'One step (LSB)', maxLabel: 'Highest value', backLabel: 'Voltage of this value',
      inputLabel: { v2c: 'Voltage', c2v: 'ADC value' },
      inputHint: { v2c: 'e.g. 1.2, 3V3, 500mV', c2v: 'e.g. 2048, 0x800' },
      reading: 'Reading',
      formula: 'Formula', pointCodes: 'ADC values of the two points', perStep: 'Change per step', perVolt: 'Change per volt',
      fullRange: function (a, b) { return 'Reading at 0: ' + a + ', at the highest value: ' + b; },
      to: ' to '
    },
    'zh-tw': {
      copy: '複製', copied: '已複製',
      errors: {
        'voltage-empty': function (r) { return { Vref: '請輸入參考電壓，例如 3.3。', V: '請輸入電壓，例如 1.2。',
          p1: '請輸入第 1 點的電壓。', p2: '請輸入第 2 點的電壓。' }[r.name]; },
        'voltage-format': function (r) { return { Vref: '參考電壓', V: '電壓', p1: '第 1 點的電壓', p2: '第 2 點的電壓' }[r.name] +
          '不是有效的電壓，請輸入像 3.3、1.25、3V3 或 500mV 這樣的值。'; },
        'vref-positive': function () { return '參考電壓必須大於 0 V。'; },
        'code-empty': function () { return '請輸入 ADC 數值，例如 2048。'; },
        'code-format': function () { return 'ADC 數值要是整數，例如 2048，或十六進位，例如 0x800。'; },
        'code-range': function (r) { return '這個解析度的 ADC 數值最大是 ' + r.max + '。'; },
        'reading-format': function (r) { return '請輸入第 ' + r.name.slice(1) + ' 點的讀值，例如 0 或 100。'; },
        'same-voltage': function () { return '兩個點的電壓不能一樣。'; }
      },
      adcValue: 'ADC 數值',
      exact: function (x) { return '精確值 ' + x + '。實際的 ADC 因為雜訊和偏移，可能差 1、2 個數。'; },
      clipped: { high: '已經到達或超過滿刻度，ADC 會讀到最大值。', low: '低於 0 V，ADC 會讀到 0。很多 ADC 腳位接負電壓會損壞。' },
      hexLabel: '十六進位', lsbLabel: '每一階（LSB）', maxLabel: '最大值', backLabel: '這個數值的電壓',
      inputLabel: { v2c: '電壓', c2v: 'ADC 數值' },
      inputHint: { v2c: '例如 1.2、3V3、500mV', c2v: '例如 2048、0x800' },
      reading: '讀值',
      formula: '換算公式', pointCodes: '兩個點的 ADC 數值', perStep: '每一階變化', perVolt: '每伏特變化',
      fullRange: function (a, b) { return 'ADC 數值 0 時讀值 ' + a + '，最大值時 ' + b; },
      to: ' 到 '
    }
  };

  return { BITS: BITS, setup: setup, parseCode: parseCode, hex: hex, toCode: toCode, toVolt: toVolt,
    parseNumber: parseNumber, scaleReading: scaleReading, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = ADC;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = ADC.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var scale = 'pow', dir = 'v2c';
  var inputs = { v2c: '1.2', c2v: '2048' }; // what was typed in each direction, kept when switching

  function errorHtml(r) { return '<p class="error">' + T.errors[r.error](r) + '</p>'; }
  // Voltages with 6 significant digits, so 16- and 24-bit results are not rounded away.
  function volts(v) {
    var a = Math.abs(v);
    if (a !== 0 && a < 1) return Number((v * 1000).toPrecision(6)) + ' mV';
    return Number(v.toPrecision(6)) + ' V';
  }
  function num(x) { return String(Number(x.toPrecision(6))); }
  function main(id, label, value) {
    return '<div class="result-main">' + label + '<span id="' + id + '">' + value + '</span>' +
      '<button class="copy-btn" type="button" data-copy="' + id + '" data-done="' + T.copied + '">' + T.copy + '</button></div>';
  }
  function bits() { return Number($('adc-bits').value); }
  function item(dt, dd) { return '<dt>' + dt + '</dt><dd>' + dd + '</dd>'; }

  function renderConvert() {
    var out = $('adc-result');
    inputs[dir] = $('adc-input').value;
    var r = dir === 'v2c' ? ADC.toCode($('adc-vref').value, bits(), scale, inputs.v2c)
      : ADC.toVolt($('adc-vref').value, bits(), scale, inputs.c2v);
    if (r.error) { out.innerHTML = errorHtml(r); return; }
    var common = item(T.lsbLabel, ELEC.si(r.lsb, 'V')) + item(T.maxLabel, r.max + ' (' + ADC.hex(r.max, r.bits) + ')');
    if (dir === 'v2c') {
      out.innerHTML = main('adc-main', T.adcValue + ' = ', String(r.code)) +
        '<div class="result-sub">' + T.exact(num(r.exact)) + '</div>' +
        (r.clipped ? '<p class="notice">' + T.clipped[r.clipped] + '</p>' : '') +
        '<dl class="result-list">' + item(T.hexLabel, r.hex) + item(T.backLabel, volts(r.back)) + common + '</dl>';
    } else {
      out.innerHTML = main('adc-main', 'V = ', volts(r.v)) +
        '<dl class="result-list">' + item(T.hexLabel, r.hex) + common + '</dl>';
    }
  }

  function renderScale() {
    var out = $('scale-result');
    var r = ADC.scaleReading($('adc-vref').value, bits(), scale, $('scale-v1').value, $('scale-y1').value,
      $('scale-v2').value, $('scale-y2').value, $('scale-code').value);
    if (r.error) { out.innerHTML = errorHtml(r); return; }
    var sign = r.offset < 0 ? ' − ' : ' + ';
    out.innerHTML = main('scale-main', T.reading + ' = ', num(r.reading)) +
      '<dl class="result-list">' +
      item(T.formula, T.reading + ' = ' + num(r.slope) + ' × ADC' + sign + num(Math.abs(r.offset))) +
      item(T.pointCodes, r.codes[0] + ', ' + r.codes[1]) +
      item(T.perStep, num(r.slope)) + item(T.perVolt, num(r.perVolt)) + '</dl>' +
      '<p class="result-sub">' + T.fullRange(num(r.range[0]), num(r.range[1])) + '</p>';
  }

  function renderAll() { renderConvert(); renderScale(); }

  function setScale(next) {
    scale = next;
    document.querySelectorAll('#scale-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.scale === scale)); });
    renderAll();
  }
  // The full-scale buttons show the actual numbers for the chosen resolution.
  function labelScale() {
    var n = bits(), p = Math.pow(2, n);
    $('scale-pow').textContent = '2^' + n + ' = ' + p;
    $('scale-max').textContent = '2^' + n + ' − 1 = ' + (p - 1);
  }
  function setDir(next) {
    dir = next;
    document.querySelectorAll('#dir-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.dir === dir)); });
    $('adc-input-label').textContent = T.inputLabel[dir];
    $('adc-input').placeholder = T.inputHint[dir];
    $('adc-input').inputMode = dir === 'v2c' ? 'decimal' : 'text';
    $('adc-input').value = inputs[dir];
    renderConvert();
  }

  document.querySelectorAll('#scale-seg button').forEach(function (b) { b.addEventListener('click', function () { setScale(b.dataset.scale); }); });
  document.querySelectorAll('#dir-seg button').forEach(function (b) { b.addEventListener('click', function () { setDir(b.dataset.dir); }); });
  $('adc-bits').addEventListener('change', function () { labelScale(); renderAll(); });
  $('adc-vref').addEventListener('input', renderAll);
  $('adc-input').addEventListener('input', renderConvert);
  ['scale-v1', 'scale-y1', 'scale-v2', 'scale-y2', 'scale-code'].forEach(function (id) { $(id).addEventListener('input', renderScale); });

  // Start with a 12-bit ADC at 3.3 V, and a sensor that gives 0.5 V at 0 and 2.5 V at 100.
  $('adc-bits').value = '12'; $('adc-vref').value = '3.3';
  $('scale-v1').value = '0.5'; $('scale-y1').value = '0'; $('scale-v2').value = '2.5'; $('scale-y2').value = '100';
  $('scale-code').value = '2048';
  labelScale();
  setDir('v2c');
  setScale('pow');
});
