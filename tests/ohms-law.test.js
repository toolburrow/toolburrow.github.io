const O = require('../assets/tools/ohms-law.js');
const near = (a, b, tol = 1e-12) => { if (Math.abs(a - b) > tol * Math.max(1, Math.abs(b))) throw new Error(`expected ${b}, got ${a}`); };
const c = (v, i, r, p) => O.calc({ v, i, r, p });

test('ohm: every pair gives the same circuit', () => {
  // 12 V, 0.5 A, 24 Ω, 6 W
  for (const r of [c('12', '0.5', '', ''), c('12', '', '24', ''), c('12', '', '', '6'), c('', '0.5', '24', ''), c('', '500mA', '', '6W'), c('', '', '24', '6')]) {
    near(r.v, 12); near(r.i, 0.5); near(r.r, 24); near(r.p, 6);
  }
});
test('ohm: known and unknown keys, formulas', () => {
  const r = c('5', '', '220', '');
  eq(r.known, ['v', 'r']); eq(r.unknown, ['i', 'p']);
  eq(r.formulas, { i: 'I = V / R', p: 'P = V² / R' });
  eq([O.format('i', r.i), O.format('p', r.p)], ['22.73 mA', '113.6 mW']);
  eq(Object.keys(O.FORMULAS).length, 6);
});
test('ohm: units', () => {
  near(c('', '20mA', '1k', '').v, 20);
  near(c('3V3', '', '', '1/4W').i, 0.25 / 3.3);
  near(c('', '', '4k7', '250mW').v, Math.sqrt(0.25 * 4700));
});
test('ohm: errors', () => {
  eq(c('', '', '', '').error, 'need-two'); eq(c('5', '', '', '').error, 'need-two');
  eq(c('5', '1', '5', '').error, 'too-many');
  eq(c('5', 'x', '', '').error, 'current-format');
  eq(c('0', '1', '', '').error, 'voltage-positive'); eq(c('-5', '1', '', '').error, 'voltage-positive');
  eq(c('5', '', '0', '').error, 'resistance-positive');
  eq(c('5', '', '', '-1').error, 'power-positive');
  eq(c('  ', '1', '10', '').unknown, ['v', 'p']); // spaces count as empty
});
test('ohm: article examples', () => {
  eq(O.format('i', c('9', '', '470', '').i), '19.15 mA');
  eq(O.format('v', c('', '20mA', '150', '').v), '3 V');
  eq(O.format('r', c('12', '2', '', '').r), '6 Ω');
  eq(O.format('p', c('5', '0.5', '', '').p), '2.5 W');
  eq(O.format('i', c('', '', '8', '10').i), '1.118 A');
});
