// Voltage divider calculator. Pure logic first (testable with node), DOM wiring below.
// Circuit: Vin -- R1 -- Vout -- R2 -- GND, no load on Vout.
var VD = (function () {
  var E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];

  function clean(x) { return Number(x.toPrecision(12)); }

  // Accepts 4.7k, 4k7, 470, 2.2M, R47, 4R7, 10kΩ, 1 ohm. "m" is treated as mega (resistor convention).
  // Returns a number (possibly 0 or negative, so callers can explain the problem) or null.
  function parseResistance(text) {
    var s = String(text == null ? '' : text).trim().toLowerCase().replace(/\s+/g, '').replace(/(Ω|ω|ohms?)$/, '');
    var mult = { r: 1, '': 1, k: 1e3, m: 1e6, g: 1e9 };
    var m = s.match(/^(-?)(\d*)([rkmg])(\d+)$/);
    if (m && (m[2] !== '' || m[3] === 'r')) return clean((m[1] ? -1 : 1) * Number((m[2] || '0') + '.' + m[4]) * mult[m[3]]);
    m = s.match(/^(-?(?:\d+\.?\d*|\.\d+))([kmg]?)$/);
    if (m) return clean(Number(m[1]) * mult[m[2]]);
    return null;
  }

  // Accepts 5, 3.3, -12, 3.3V, 3V3, 500mV. Returns a number or null.
  function parseVoltage(text) {
    var s = String(text == null ? '' : text).trim().toLowerCase().replace(/\s+/g, '');
    var m = s.match(/^(-?)(\d+)v(\d+)$/);
    if (m) return clean((m[1] ? -1 : 1) * Number(m[2] + '.' + m[3]));
    m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(mv|v)?$/);
    if (m) return clean(Number(m[1]) * (m[2] === 'mv' ? 1e-3 : 1));
    return null;
  }

  // Format with SI prefix and 4 significant digits: si(0.0001667, 'A') -> '166.7 µA'.
  function si(v, unit) {
    var r = Number(v.toPrecision(4));
    if (r === 0) return '0 ' + unit;
    var steps = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']];
    if (unit === 'Ω') steps = steps.slice(0, 4); // no mΩ: resistor values are written 0.47 Ω
    for (var i = 0; i < steps.length; i++) {
      if (Math.abs(r) >= steps[i][0] || i === steps.length - 1) {
        return Number((r / steps[i][0]).toPrecision(4)) + ' ' + steps[i][1] + unit;
      }
    }
  }

  function readVoltage(text, name) {
    if (!String(text == null ? '' : text).trim()) return { error: 'Enter ' + name + ', for example 5 or 3.3.' };
    var v = parseVoltage(text);
    if (v === null) return { error: name + ' isn’t a voltage. Use a number like 5, 3.3, 3V3 or 500mV.' };
    return { v: v };
  }

  function readResistance(text, name) {
    if (!String(text == null ? '' : text).trim()) return { error: 'Enter ' + name + ', for example 10k.' };
    var v = parseResistance(text);
    if (v === null) return { error: name + ' isn’t a resistance. Use a value like 10k, 4k7, 220 or 1M.' };
    if (!(v > 0)) return { error: name + ' must be greater than 0 Ω.' };
    return { v: v };
  }

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

  // E24 values just below and just above x (one value if x is itself an E24 value).
  function e24Neighbors(x) {
    var d = Math.floor(Math.log10(x)), all = [];
    for (var dec = d - 1; dec <= d + 1; dec++) E24.forEach(function (v) { all.push(clean(v * Math.pow(10, dec - 1))); });
    var lower = all.filter(function (v) { return v <= x * (1 + 1e-9); }).pop();
    var upper = all.filter(function (v) { return v >= x * (1 - 1e-9); })[0];
    return lower === upper ? [lower] : [lower, upper];
  }

  // Vin, target Vout and the known resistor -> the exact other resistor, plus the E24 values on either side of it.
  // known is 'r1' or 'r2'. best is the index of the E24 option whose Vout is closest to the target.
  function solve(vinText, voutText, knownText, known) {
    var vin = readVoltage(vinText, 'Vin'); if (vin.error) return vin;
    var vout = readVoltage(voutText, 'Vout'); if (vout.error) return vout;
    var name = known === 'r1' ? 'R1' : 'R2';
    var r = readResistance(knownText, name); if (r.error) return r;
    if (vin.v === 0) return { error: 'Vin can’t be 0 V. Enter the supply voltage.' };
    var k = vout.v / vin.v;
    if (vout.v === 0) return { error: 'Vout can’t be 0 V. That would need R2 = 0 Ω.' };
    if (k < 0) return { error: 'Vout must have the same sign as Vin.' };
    if (k >= 1) return { error: 'Vout must be smaller than Vin. A voltage divider can only lower the voltage.' };
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

  return { E24: E24, parseResistance: parseResistance, parseVoltage: parseVoltage, si: si,
    circuit: circuit, forward: forward, e24Neighbors: e24Neighbors, solve: solve };
})();

if (typeof module !== 'undefined') module.exports = VD;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var known = 'r1';

  function powerList(c) {
    return '<dt>Current</dt><dd>' + VD.si(c.current, 'A') + '</dd>' +
      '<dt>Power in R1</dt><dd>' + VD.si(c.p1, 'W') + '</dd>' +
      '<dt>Power in R2</dt><dd>' + VD.si(c.p2, 'W') + '</dd>' +
      '<dt>Total power</dt><dd>' + VD.si(c.ptotal, 'W') + '</dd>';
  }

  function pct(x) { return (x > 0 ? '+' : '') + Number(x.toPrecision(3)) + '%'; }

  // ---- Find Vout ----
  function renderForward() {
    var out = $('fwd-result');
    var r = VD.forward($('fwd-vin').value, $('fwd-r1').value, $('fwd-r2').value);
    if (r.error) { out.innerHTML = '<p class="error">' + r.error + '</p>'; return; }
    out.innerHTML =
      '<div class="result-main">Vout = <span id="fwd-main">' + VD.si(r.vout, 'V') + '</span>' +
      '<button class="copy-btn" type="button" data-copy="fwd-main" data-done="Copied">Copy</button></div>' +
      '<div class="result-sub">' + Number((r.ratio * 100).toPrecision(4)) + '% of Vin, with no load on the output</div>' +
      '<dl class="result-list">' + powerList(r) + '</dl>';
  }

  // ---- Find a resistor ----
  function renderSolve() {
    var out = $('solve-result');
    var r = VD.solve($('solve-vin').value, $('solve-vout').value, $('solve-known').value, known);
    if (r.error) { out.innerHTML = '<p class="error">' + r.error + '</p>'; return; }
    var name = r.solveFor.toUpperCase();
    var b = r.options[r.best];
    var rows = r.options.map(function (o, i) {
      var cells = '<td>' + VD.si(o.ohms, 'Ω') + '</td><td>' + VD.si(o.vout, 'V') + '</td><td>' + pct(o.errorPct) + '</td>';
      return '<tr' + (i === r.best ? ' class="best"' : '') + '>' + cells + '</tr>';
    }).join('');
    var unusual = b.ohms < 1 || b.ohms > 10e6;
    out.innerHTML =
      '<div class="result-main">' + name + ' = <span id="solve-main">' + VD.si(r.exact, 'Ω') + '</span>' +
      '<button class="copy-btn" type="button" data-copy="solve-main" data-done="Copied">Copy</button></div>' +
      '<div class="result-sub">Exact value. Closest E24 value: <strong>' + VD.si(b.ohms, 'Ω') + '</strong>, which gives ' +
      VD.si(b.vout, 'V') + ' (' + pct(b.errorPct) + ').</div>' +
      (unusual ? '<p class="notice">That is outside the usual 1 Ω to 10 MΩ range. Try a different value for the resistor you know.</p>' : '') +
      '<div class="table-scroll"><table class="e24"><thead><tr><th>E24 ' + name + '</th><th>Vout</th><th>Error</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div>' +
      '<dl class="result-list">' + powerList(b) + '</dl>' +
      '<p class="result-sub">Current and power are for the closest E24 value.</p>';
  }

  function setKnown(next) {
    known = next;
    document.querySelectorAll('#known-seg button').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.known === known));
    });
    $('solve-known-label').textContent = known === 'r1' ? 'R1 (top resistor)' : 'R2 (bottom resistor)';
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
