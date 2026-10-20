// Shared helpers for the electronics tools: parsing values as people type them, SI formatting, E24 values.
// Pages load this before their tool script; in node, tool scripts require it.
var ELEC = (function () {
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

  // Current or power with an optional prefix and unit: 20mA, 0.02A, 500uA, 250mW, 1/4W, 0.5 W.
  // unit is 'a' or 'w'. A bare number (no prefix, no unit) is multiplied by bare, so a field labelled
  // "mA" can pass 1e-3 and accept "20". Returns a number or null.
  function parseScaled(text, unit, bare) {
    var s = String(text == null ? '' : text).trim().toLowerCase().replace(/\s+/g, '').replace(/μ/g, 'µ');
    var hasUnit = s.slice(-1) === unit;
    if (hasUnit) s = s.slice(0, -1);
    var m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+))(?:\/(\d+\.?\d*))?([pnuµmk]?)$/);
    if (!m) return null;
    var v = Number(m[1]) / (m[2] === undefined ? 1 : Number(m[2]));
    if (!Number.isFinite(v)) return null;
    var scale = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3 }[m[3]];
    if (scale === undefined) scale = hasUnit ? 1 : bare;
    return clean(v * scale);
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

  // E24 values just below and just above x (one value if x is itself an E24 value).
  function e24Neighbors(x) {
    var d = Math.floor(Math.log10(x)), all = [];
    for (var dec = d - 1; dec <= d + 1; dec++) E24.forEach(function (v) { all.push(clean(v * Math.pow(10, dec - 1))); });
    var lower = all.filter(function (v) { return v <= x * (1 + 1e-9); }).pop();
    var upper = all.filter(function (v) { return v >= x * (1 - 1e-9); })[0];
    return lower === upper ? [lower] : [lower, upper];
  }

  // Read a typed value. kind is 'voltage', 'resistance', 'current' or 'power'.
  // Returns { v } or { error: kind + '-empty' | '-format' | '-positive', name } so pages can word errors themselves.
  // Resistance, current and power must be greater than 0; voltage may be any sign.
  function read(text, kind, name, bare) {
    if (!String(text == null ? '' : text).trim()) return { error: kind + '-empty', name: name };
    var v = kind === 'voltage' ? parseVoltage(text) : kind === 'resistance' ? parseResistance(text)
      : parseScaled(text, kind === 'current' ? 'a' : 'w', bare === undefined ? 1 : bare);
    if (v === null) return { error: kind + '-format', name: name };
    if (kind !== 'voltage' && !(v > 0)) return { error: kind + '-positive', name: name };
    return { v: v };
  }

  return { E24: E24, clean: clean, parseResistance: parseResistance, parseVoltage: parseVoltage,
    parseScaled: parseScaled, si: si, e24Neighbors: e24Neighbors, read: read };
})();

if (typeof module !== 'undefined') module.exports = ELEC;
