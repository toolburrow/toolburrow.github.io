// RC time constant calculator / RC 時間常數計算, shared by /en/ and /zh-tw/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// Circuit: a resistor R in series with a capacitor C. Charging: Vc = Vs (1 - e^(-t/τ)); discharging: Vc = V0 e^(-t/τ).
var ELEC = typeof module !== 'undefined' ? require('../elec.js') : window.ELEC;

var RC = (function () {
  var clean = ELEC.clean;

  // Percentage between 0 and 100 (exclusive), as typed: 90, 63.2, 99%. Returns { p } or { error: 'percent' }.
  function readPercent(text) {
    var s = String(text == null ? '' : text).replace(/\s+/g, '').replace(/[%％]$/, '');
    if (!/^(\d+\.?\d*|\.\d+)$/.test(s) || !(+s > 0 && +s < 100)) return { error: 'percent' };
    return { p: +s };
  }

  // R as typed (4k7, 10k), C as typed (bare numbers are µF), target percentage as typed.
  // tau = RC; fc = 1 / (2πRC), the -3 dB point of an RC low-pass or high-pass filter.
  // charge: time to charge from 0 to p% of the supply; discharge: time to fall to p% of the starting voltage.
  // steps: 1τ to 5τ with the charge reached and the voltage left when discharging.
  function calc(rText, cText, pText) {
    var r = ELEC.read(rText, 'resistance', 'R'); if (r.error) return r;
    var c = ELEC.read(cText, 'capacitance', 'C', 1e-6); if (c.error) return c;
    var p = readPercent(pText); if (p.error) return p;
    var tau = clean(r.v * c.v);
    var steps = [1, 2, 3, 4, 5].map(function (n) {
      return { n: n, t: clean(n * tau), charged: 100 * (1 - Math.exp(-n)), left: 100 * Math.exp(-n) };
    });
    return {
      r: r.v, c: c.v, p: p.p, tau: tau, fc: clean(1 / (2 * Math.PI * tau)),
      charge: clean(-tau * Math.log(1 - p.p / 100)), discharge: clean(-tau * Math.log(p.p / 100)),
      steps: steps
    };
  }

  var si = ELEC.si;
  // Times of a minute or more are given in seconds plus minutes or hours, since "ks" reads badly.
  // u = [minute word, hour word, opening bracket, closing bracket].
  function time(t, u) {
    if (t < 60) return si(t, 's');
    var big = t < 3600 ? Number((t / 60).toPrecision(3)) + ' ' + u[0] : Number((t / 3600).toPrecision(3)) + ' ' + u[1];
    return Number(t.toPrecision(4)) + ' s' + u[2] + big + u[3];
  }
  function pct(x) { return x.toFixed(1) + '%'; }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    en: {
      copy: 'Copy', copied: 'Copied',
      errors: {
        'resistance-empty': function () { return 'Enter the resistance, for example 10k.'; },
        'resistance-format': function () { return 'The resistance isn’t a value I can read. Use a value like 470, 4.7k, 4k7 or 1M.'; },
        'resistance-positive': function () { return 'The resistance must be greater than 0.'; },
        'capacitance-empty': function () { return 'Enter the capacitance, for example 100n or 10u.'; },
        'capacitance-format': function () { return 'The capacitance isn’t a value I can read. Use a value like 100n, 4.7uF, 4u7 or 22p.'; },
        'capacitance-positive': function () { return 'The capacitance must be greater than 0.'; },
        percent: function () { return 'The target must be a percentage between 0 and 100, for example 90.'; }
      },
      time: function (t) { return time(t, ['min', 'h', ' (', ')']); },
      sub: function (r) { return 'τ = R × C = ' + si(r.r, 'Ω') + ' × ' + si(r.c, 'F'); },
      fcLabel: 'Cutoff frequency fc',
      chargeLabel: function (r) { return 'Charge to ' + r.p + '%'; },
      dischargeLabel: function (r) { return 'Discharge to ' + r.p + '%'; },
      tableHead: ['Time', 'Elapsed', 'Charged to', 'Left when discharging'],
      pct: pct
    },
    'zh-tw': {
      copy: '複製', copied: '已複製',
      errors: {
        'resistance-empty': function () { return '請輸入電阻值，例如 10k。'; },
        'resistance-format': function () { return '看不懂這個電阻值，請輸入像 470、4.7k、4k7 或 1M 這樣的值。'; },
        'resistance-positive': function () { return '電阻值必須大於 0。'; },
        'capacitance-empty': function () { return '請輸入電容值，例如 100n 或 10u。'; },
        'capacitance-format': function () { return '看不懂這個電容值，請輸入像 100n、4.7uF、4u7 或 22p 這樣的值。'; },
        'capacitance-positive': function () { return '電容值必須大於 0。'; },
        percent: function () { return '目標百分比必須在 0 到 100 之間，例如 90。'; }
      },
      time: function (t) { return time(t, ['分鐘', '小時', '（', '）']); },
      sub: function (r) { return 'τ = R × C = ' + si(r.r, 'Ω') + ' × ' + si(r.c, 'F'); },
      fcLabel: '截止頻率 fc',
      chargeLabel: function (r) { return '充電到 ' + r.p + '%'; },
      dischargeLabel: function (r) { return '放電到剩 ' + r.p + '%'; },
      tableHead: ['時間', '經過', '充電到', '放電剩下'],
      pct: pct
    }
  };

  return { readPercent: readPercent, calc: calc, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = RC;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = RC.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var si = ELEC.si;

  function render() {
    var out = $('rc-result');
    var r = RC.calc($('rc-r').value, $('rc-c').value, $('rc-p').value);
    if (r.error) { out.innerHTML = '<p class="error">' + T.errors[r.error](r) + '</p>'; return; }
    var rows = r.steps.map(function (s) {
      return '<tr><td>' + s.n + 'τ</td><td>' + T.time(s.t) + '</td><td>' + T.pct(s.charged) + '</td><td>' + T.pct(s.left) + '</td></tr>';
    }).join('');
    out.innerHTML =
      '<div class="result-main">τ = <span id="rc-main">' + T.time(r.tau) + '</span>' +
      '<button class="copy-btn" type="button" data-copy="rc-main" data-done="' + T.copied + '">' + T.copy + '</button></div>' +
      '<div class="result-sub">' + T.sub(r) + '</div>' +
      '<dl class="result-list"><dt>' + T.fcLabel + '</dt><dd>' + si(r.fc, 'Hz') + '</dd>' +
      '<dt>' + T.chargeLabel(r) + '</dt><dd>' + T.time(r.charge) + '</dd>' +
      '<dt>' + T.dischargeLabel(r) + '</dt><dd>' + T.time(r.discharge) + '</dd></dl>' +
      '<div class="table-scroll"><table><thead><tr>' + T.tableHead.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  ['rc-r', 'rc-c', 'rc-p'].forEach(function (id) { $(id).addEventListener('input', render); });

  // Start with 10 kΩ and 100 nF (τ = 1 ms), charging to 90%.
  $('rc-r').value = '10k'; $('rc-c').value = '100n'; $('rc-p').value = '90';
  render();
});
