// Voltage divider calculator / 分壓電阻計算, shared by /en/ and /zh-tw/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// Circuit: Vin -- R1 -- Vout -- R2 -- GND, no load on Vout.
var ELEC = typeof module !== 'undefined' ? require('../elec.js') : window.ELEC;

var VD = (function () {
  var clean = ELEC.clean, si = ELEC.si, e24Neighbors = ELEC.e24Neighbors;

  // Errors are { error: code, name } so each page can word them in its own language (see TEXT).
  function readVoltage(text, name) { return ELEC.read(text, 'voltage', name); }
  function readResistance(text, name) { return ELEC.read(text, 'resistance', name); }

  // Everything that follows from Vin, R1 and R2.
  function circuit(vin, r1, r2) {
    var i = vin / (r1 + r2);
    return { vin: vin, r1: r1, r2: r2, vout: clean(vin * r2 / (r1 + r2)), ratio: clean(r2 / (r1 + r2)),
      current: clean(i), p1: clean(i * i * r1), p2: clean(i * i * r2), ptotal: clean(vin * i) };
  }

  // Vin, R1, R2 (as typed) -> circuit or { error }.
  function forward(vinText, r1Text, r2Text) {
    var vin = readVoltage(vinText, 'Vin'); if (vin.error) return vin;
    var r1 = readResistance(r1Text, 'R1'); if (r1.error) return r1;
    var r2 = readResistance(r2Text, 'R2'); if (r2.error) return r2;
    return circuit(vin.v, r1.v, r2.v);
  }

  // Vin, target Vout and the known resistor -> the exact other resistor, plus the E24 values on either side of it.
  // known is 'r1' or 'r2'. best is the index of the E24 option whose Vout is closest to the target.
  function solve(vinText, voutText, knownText, known) {
    var vin = readVoltage(vinText, 'Vin'); if (vin.error) return vin;
    var vout = readVoltage(voutText, 'Vout'); if (vout.error) return vout;
    var name = known === 'r1' ? 'R1' : 'R2';
    var r = readResistance(knownText, name); if (r.error) return r;
    if (vin.v === 0) return { error: 'vin-zero' };
    var k = vout.v / vin.v;
    if (vout.v === 0) return { error: 'vout-zero' };
    if (k < 0) return { error: 'sign' };
    if (k >= 1) return { error: 'too-high' };
    var exact = clean(known === 'r1' ? r.v * k / (1 - k) : r.v * (1 - k) / k);
    var options = e24Neighbors(exact).map(function (std) {
      var c = known === 'r1' ? circuit(vin.v, r.v, std) : circuit(vin.v, std, r.v);
      c.ohms = std;
      c.errorPct = clean((c.vout - vout.v) / vout.v * 100);
      return c;
    });
    var best = 0;
    options.forEach(function (o, i) { if (Math.abs(o.errorPct) < Math.abs(options[best].errorPct)) best = i; });
    return { solveFor: known === 'r1' ? 'r2' : 'r1', exact: exact, target: vout.v, options: options, best: best };
  }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    en: {
      copy: 'Copy', copied: 'Copied',
      errors: {
        'voltage-empty': function (n) { return 'Enter ' + n + ', for example 5 or 3.3.'; },
        'voltage-format': function (n) { return n + ' isn’t a voltage. Use a number like 5, 3.3, 3V3 or 500mV.'; },
        'resistance-empty': function (n) { return 'Enter ' + n + ', for example 10k.'; },
        'resistance-format': function (n) { return n + ' isn’t a resistance. Use a value like 10k, 4k7, 220 or 1M.'; },
        'resistance-positive': function (n) { return n + ' must be greater than 0 Ω.'; },
        'vin-zero': function () { return 'Vin can’t be 0 V. Enter the supply voltage.'; },
        'vout-zero': function () { return 'Vout can’t be 0 V. That would need R2 = 0 Ω.'; },
        'sign': function () { return 'Vout must have the same sign as Vin.'; },
        'too-high': function () { return 'Vout must be smaller than Vin. A voltage divider can only lower the voltage.'; }
      },
      current: 'Current', p1: 'Power in R1', p2: 'Power in R2', ptotal: 'Total power',
      ratio: function (pct) { return pct + '% of Vin, with no load on the output'; },
      closest: function (ohms, vout, err) { return 'Exact value. Closest E24 value: <strong>' + ohms + '</strong>, which gives ' + vout + ' (' + err + ').'; },
      unusual: 'That is outside the usual 1 Ω to 10 MΩ range. Try a different value for the resistor you know.',
      error: 'Error',
      powerNote: 'Current and power are for the closest E24 value.',
      known: { r1: 'R1 (top resistor)', r2: 'R2 (bottom resistor)' }
    },
    'zh-tw': {
      copy: '複製', copied: '已複製',
      errors: {
        'voltage-empty': function (n) { return '請輸入 ' + n + '，例如 5 或 3.3。'; },
        'voltage-format': function (n) { return n + ' 不是有效的電壓，請輸入像 5、3.3、3V3 或 500mV 這樣的值。'; },
        'resistance-empty': function (n) { return '請輸入 ' + n + '，例如 10k。'; },
        'resistance-format': function (n) { return n + ' 不是有效的電阻值，請輸入像 10k、4k7、220 或 1M 這樣的值。'; },
        'resistance-positive': function (n) { return n + ' 必須大於 0 Ω。'; },
        'vin-zero': function () { return 'Vin 不能是 0 V，請輸入電源電壓。'; },
        'vout-zero': function () { return 'Vout 不能是 0 V，那樣 R2 必須是 0 Ω。'; },
        'sign': function () { return 'Vout 和 Vin 的正負號必須相同。'; },
        'too-high': function () { return 'Vout 必須小於 Vin，分壓電路只能把電壓降低。'; }
      },
      current: '電流', p1: 'R1 消耗功率', p2: 'R2 消耗功率', ptotal: '總功率',
      ratio: function (pct) { return '是 Vin 的 ' + pct + '%（輸出端不接負載）'; },
      closest: function (ohms, vout, err) { return '這是精確值。最接近的 E24 值是 <strong>' + ohms + '</strong>，實際輸出 ' + vout + '（' + err + '）。'; },
      unusual: '這個值超出一般 1 Ω 到 10 MΩ 的範圍，請換一個已知電阻的值試試。',
      error: '誤差',
      powerNote: '電流和功率以最接近的 E24 值計算。',
      known: { r1: 'R1（上方電阻）', r2: 'R2（下方電阻）' }
    }
  };

  return { E24: ELEC.E24, parseResistance: ELEC.parseResistance, parseVoltage: ELEC.parseVoltage, si: si,
    circuit: circuit, forward: forward, e24Neighbors: e24Neighbors, solve: solve, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = VD;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = VD.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var known = 'r1';

  function errorHtml(r) { return '<p class="error">' + T.errors[r.error](r.name) + '</p>'; }

  function powerList(c) {
    return '<dt>' + T.current + '</dt><dd>' + VD.si(c.current, 'A') + '</dd>' +
      '<dt>' + T.p1 + '</dt><dd>' + VD.si(c.p1, 'W') + '</dd>' +
      '<dt>' + T.p2 + '</dt><dd>' + VD.si(c.p2, 'W') + '</dd>' +
      '<dt>' + T.ptotal + '</dt><dd>' + VD.si(c.ptotal, 'W') + '</dd>';
  }

  function pct(x) { return (x > 0 ? '+' : '') + Number(x.toPrecision(3)) + '%'; }

  // ---- Find Vout ----
  function renderForward() {
    var out = $('fwd-result');
    var r = VD.forward($('fwd-vin').value, $('fwd-r1').value, $('fwd-r2').value);
    if (r.error) { out.innerHTML = errorHtml(r); return; }
    out.innerHTML =
      '<div class="result-main">Vout = <span id="fwd-main">' + VD.si(r.vout, 'V') + '</span>' +
      '<button class="copy-btn" type="button" data-copy="fwd-main" data-done="' + T.copied + '">' + T.copy + '</button></div>' +
      '<div class="result-sub">' + T.ratio(Number((r.ratio * 100).toPrecision(4))) + '</div>' +
      '<dl class="result-list">' + powerList(r) + '</dl>';
  }

  // ---- Find a resistor ----
  function renderSolve() {
    var out = $('solve-result');
    var r = VD.solve($('solve-vin').value, $('solve-vout').value, $('solve-known').value, known);
    if (r.error) { out.innerHTML = errorHtml(r); return; }
    var name = r.solveFor.toUpperCase();
    var b = r.options[r.best];
    var rows = r.options.map(function (o, i) {
      var cells = '<td>' + VD.si(o.ohms, 'Ω') + '</td><td>' + VD.si(o.vout, 'V') + '</td><td>' + pct(o.errorPct) + '</td>';
      return '<tr' + (i === r.best ? ' class="best"' : '') + '>' + cells + '</tr>';
    }).join('');
    var unusual = b.ohms < 1 || b.ohms > 10e6;
    out.innerHTML =
      '<div class="result-main">' + name + ' = <span id="solve-main">' + VD.si(r.exact, 'Ω') + '</span>' +
      '<button class="copy-btn" type="button" data-copy="solve-main" data-done="' + T.copied + '">' + T.copy + '</button></div>' +
      '<div class="result-sub">' + T.closest(VD.si(b.ohms, 'Ω'), VD.si(b.vout, 'V'), pct(b.errorPct)) + '</div>' +
      (unusual ? '<p class="notice">' + T.unusual + '</p>' : '') +
      '<div class="table-scroll"><table class="e24"><thead><tr><th>E24 ' + name + '</th><th>Vout</th><th>' + T.error + '</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
      '<dl class="result-list">' + powerList(b) + '</dl>' +
      '<p class="result-sub">' + T.powerNote + '</p>';
  }

  function setKnown(next) {
    known = next;
    document.querySelectorAll('#known-seg button').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.known === known));
    });
    $('solve-known-label').textContent = T.known[known];
    renderSolve();
  }

  ['fwd-vin', 'fwd-r1', 'fwd-r2'].forEach(function (id) { $(id).addEventListener('input', renderForward); });
  ['solve-vin', 'solve-vout', 'solve-known'].forEach(function (id) { $(id).addEventListener('input', renderSolve); });
  document.querySelectorAll('#known-seg button').forEach(function (btn) {
    btn.addEventListener('click', function () { setKnown(btn.dataset.known); });
  });

  // Start with a common case: 5 V down to 3.3 V.
  $('fwd-vin').value = '5'; $('fwd-r1').value = '10k'; $('fwd-r2').value = '20k';
  $('solve-vin').value = '5'; $('solve-vout').value = '3.3'; $('solve-known').value = '10k';
  renderForward();
  setKnown('r1');
});
