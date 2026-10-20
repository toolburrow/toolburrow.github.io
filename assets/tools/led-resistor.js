// LED resistor calculator / LED 限流電阻計算, shared by /en/ and /zh-tw/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// Circuit: supply -- resistor -- n LEDs in series -- GND.
var ELEC = typeof module !== 'undefined' ? require('../elec.js') : window.ELEC;

var LED = (function () {
  var clean = ELEC.clean;
  // Typical forward voltage at about 20 mA. Real parts vary, so the page asks people to check the datasheet.
  var COLORS = { red: 2.0, orange: 2.0, yellow: 2.1, 'yellow-green': 2.1, green: 3.2, blue: 3.2, white: 3.2, ir: 1.3 };
  var RATINGS = [0.125, 0.25, 0.5, 1, 2, 3, 5]; // common resistor power ratings in W

  // Smallest common rating at least twice the power, or null if even 5 W isn't enough.
  function rating(p) {
    for (var i = 0; i < RATINGS.length; i++) if (RATINGS[i] >= 2 * p) return RATINGS[i];
    return null;
  }

  // Supply voltage, LED forward voltage, current (bare numbers are mA), LEDs in series, all as typed.
  // Returns the exact resistor and the E24 values either side, each with the current it really gives.
  function calc(vsText, vfText, iText, nText) {
    var vs = ELEC.read(vsText, 'voltage', 'Vs'); if (vs.error) return vs;
    var vf = ELEC.read(vfText, 'voltage', 'Vf'); if (vf.error) return vf;
    if (!(vf.v > 0)) return { error: 'vf-positive' };
    var i = ELEC.read(iText, 'current', 'I', 1e-3); if (i.error) return i;
    var n = String(nText == null ? '' : nText).trim();
    if (!/^\d+$/.test(n) || +n < 1 || +n > 100) return { error: 'count' };
    n = +n;
    var drop = clean(vs.v - n * vf.v);
    if (!(drop > 0)) return { error: 'not-enough', need: clean(n * vf.v) };
    var exact = clean(drop / i.v);
    var options = ELEC.e24Neighbors(exact).map(function (ohms) {
      var cur = clean(drop / ohms);
      return { ohms: ohms, current: cur, power: clean(drop * cur), over: cur > i.v * (1 + 1e-9) };
    });
    var pick = options[options.length - 1]; // the higher value keeps the current at or under the target
    return { vs: vs.v, vf: vf.v, current: i.v, n: n, drop: drop, exact: exact, options: options, pick: pick,
      rating: rating(pick.power), ledPower: clean(vf.v * pick.current), tight: drop < 1 };
  }

  var si = ELEC.si;
  function watts(w) { return w === 0.125 ? '1/8 W' : w === 0.25 ? '1/4 W' : w === 0.5 ? '1/2 W' : w + ' W'; }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    en: {
      copy: 'Copy', copied: 'Copied',
      errors: {
        'voltage-empty': function (e) { return 'Enter ' + e.name + ', for example 5.'; },
        'voltage-format': function (e) { return e.name + ' isn’t a voltage. Use a number like 5, 3.3 or 12V.'; },
        'vf-positive': function () { return 'Vf must be greater than 0 V.'; },
        'current-empty': function () { return 'Enter the LED current, for example 20 (mA).'; },
        'current-format': function () { return 'The current isn’t a number. Use a value like 20, 10mA or 0.02A.'; },
        'current-positive': function () { return 'The current must be greater than 0.'; },
        count: function () { return 'The number of LEDs must be a whole number from 1 to 100.'; },
        'not-enough': function (e) { return 'The supply must be higher than ' + si(e.need, 'V') + ', the total forward voltage of the LEDs. Use a higher supply or fewer LEDs in series.'; }
      },
      sub: function (r) { return 'Exact value for ' + si(r.current, 'A') + ', with ' + si(r.drop, 'V') + ' across the resistor.'; },
      use: function (r) { return 'Use <strong>' + si(r.pick.ohms, 'Ω') + '</strong> (E24), which gives ' + si(r.pick.current, 'A') + '.'; },
      e24: 'E24 resistor', current: 'Current', power: 'Resistor power', over: ' (above target)',
      ratingLabel: 'Resistor rating', rating: function (w) { return w ? watts(w) + ' or more' : 'Over 5 W. Use a constant-current LED driver instead.'; },
      ledPowerLabel: 'Power per LED',
      tight: 'Less than 1 V is left across the resistor, so small differences in the LED’s forward voltage change the current a lot. A higher supply voltage gives a steadier current.'
    },
    'zh-tw': {
      copy: '複製', copied: '已複製',
      errors: {
        'voltage-empty': function (e) { return '請輸入 ' + e.name + '，例如 5。'; },
        'voltage-format': function (e) { return e.name + ' 不是有效的電壓，請輸入像 5、3.3 或 12V 這樣的值。'; },
        'vf-positive': function () { return 'Vf 必須大於 0 V。'; },
        'current-empty': function () { return '請輸入 LED 電流，例如 20（mA）。'; },
        'current-format': function () { return '電流不是有效的數字，請輸入像 20、10mA 或 0.02A 這樣的值。'; },
        'current-positive': function () { return '電流必須大於 0。'; },
        count: function () { return 'LED 顆數必須是 1 到 100 的整數。'; },
        'not-enough': function (e) { return '電源電壓必須高於 LED 的順向電壓總和 ' + si(e.need, 'V') + '，請提高電源電壓或減少串聯的顆數。'; }
      },
      sub: function (r) { return '這是電流 ' + si(r.current, 'A') + ' 時的精確值，電阻上的電壓是 ' + si(r.drop, 'V') + '。'; },
      use: function (r) { return '建議用 <strong>' + si(r.pick.ohms, 'Ω') + '</strong>（E24），實際電流 ' + si(r.pick.current, 'A') + '。'; },
      e24: 'E24 電阻', current: '電流', power: '電阻功率', over: '（超過設定）',
      ratingLabel: '電阻瓦數', rating: function (w) { return w ? watts(w) + ' 以上' : '超過 5 W，建議改用 LED 定電流驅動 IC。'; },
      ledPowerLabel: '每顆 LED 功率',
      tight: '電阻上只剩不到 1 V，LED 順向電壓的些微差異就會讓電流變化很大。提高電源電壓，電流會比較穩定。'
    }
  };

  return { COLORS: COLORS, rating: rating, calc: calc, watts: watts, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = LED;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = LED.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var si = ELEC.si;

  function render() {
    var out = $('led-result');
    var r = LED.calc($('led-vs').value, $('led-vf').value, $('led-i').value, $('led-n').value);
    if (r.error) { out.innerHTML = '<p class="error">' + T.errors[r.error](r) + '</p>'; return; }
    var rows = r.options.map(function (o) {
      return '<tr' + (o === r.pick ? ' class="best"' : '') + '><td>' + si(o.ohms, 'Ω') + '</td><td>' + si(o.current, 'A') +
        (o.over ? T.over : '') + '</td><td>' + si(o.power, 'W') + '</td></tr>';
    }).join('');
    out.innerHTML =
      '<div class="result-main">R = <span id="led-main">' + si(r.exact, 'Ω') + '</span>' +
      '<button class="copy-btn" type="button" data-copy="led-main" data-done="' + T.copied + '">' + T.copy + '</button></div>' +
      '<div class="result-sub">' + T.sub(r) + ' ' + T.use(r) + '</div>' +
      (r.tight ? '<p class="notice">' + T.tight + '</p>' : '') +
      '<div class="table-scroll"><table><thead><tr><th>' + T.e24 + '</th><th>' + T.current + '</th><th>' + T.power + '</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
      '<dl class="result-list"><dt>' + T.ratingLabel + '</dt><dd>' + T.rating(r.rating) + '</dd>' +
      '<dt>' + T.ledPowerLabel + '</dt><dd>' + si(r.ledPower, 'W') + '</dd></dl>';
  }

  // Picking a color fills in its typical forward voltage; typing a voltage switches the picker to "custom".
  $('led-color').addEventListener('change', function () {
    var v = LED.COLORS[$('led-color').value];
    if (v !== undefined) $('led-vf').value = String(v);
    render();
  });
  $('led-vf').addEventListener('input', function () {
    if (LED.COLORS[$('led-color').value] !== Number($('led-vf').value)) $('led-color').value = 'custom';
    render();
  });
  ['led-vs', 'led-i', 'led-n'].forEach(function (id) { $(id).addEventListener('input', render); });

  // Start with the classic case: a red LED at 20 mA from 5 V.
  $('led-vs').value = '5'; $('led-color').value = 'red'; $('led-vf').value = '2'; $('led-i').value = '20'; $('led-n').value = '1';
  render();
});
