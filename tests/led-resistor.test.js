const L = require('../assets/tools/led-resistor.js');
const { si } = require('../assets/elec.js');
const near = (a, b, tol = 1e-9) => { if (Math.abs(a - b) > tol) throw new Error(`expected ${b}, got ${a}`); };

test('led: red LED from 5 V at 20 mA', () => {
  const r = L.calc('5', '2', '20', '1');
  eq([r.drop, r.exact], [3, 150]);
  eq(r.options.map(o => o.ohms), [150]); // 150 Ω is an E24 value
  eq([r.pick.current, r.pick.power, r.rating, r.ledPower, r.tight], [0.02, 0.06, 0.125, 0.04, false]);
});
test('led: picks the higher E24 value so the current stays at or under target', () => {
  const r = L.calc('5', '3.2', '20', '1'); // 1.8 V / 20 mA = 90 Ω
  eq(r.exact, 90); eq(r.options.map(o => o.ohms), [82, 91]);
  eq(r.pick.ohms, 91); near(r.pick.current, 1.8 / 91); eq(r.options[0].over, true); eq(r.options[1].over, false);
  const s = L.calc('12', '2.1', '20mA', '3'); // 5.7 V / 20 mA = 285 Ω
  eq(s.drop, 5.7); eq(s.exact, 285); eq(s.options.map(o => o.ohms), [270, 300]); eq(s.pick.ohms, 300);
});
test('led: power rating with 2x margin', () => {
  eq([L.rating(0.06), L.rating(0.0625), L.rating(0.07), L.rating(0.2), L.rating(0.3), L.rating(2.4), L.rating(2.6)], [0.125, 0.125, 0.25, 0.5, 1, 5, null]);
  const r = L.calc('24', '3.2', '350', '1'); // 20.8 V × 350 mA: about 7.3 W in the resistor
  eq(r.rating, null);
  eq([L.watts(0.125), L.watts(0.25), L.watts(0.5), L.watts(2)], ['1/8 W', '1/4 W', '1/2 W', '2 W']);
});
test('led: current units and small headroom', () => {
  eq(L.calc('5', '2', '0.02A', '1').exact, 150);
  eq(L.calc('5', '2', '10mA', '1').exact, 300);
  eq(L.calc('3.3', '3.2', '5', '1').tight, true); // 0.1 V left: 20 Ω
  eq(L.calc('3.3', '3.2', '5', '1').exact, 20);
});
test('led: errors', () => {
  const e = (...a) => L.calc(...a).error;
  eq(e('', '2', '20', '1'), 'voltage-empty'); eq(e('5', 'x', '20', '1'), 'voltage-format'); eq(e('5', '0', '20', '1'), 'vf-positive');
  eq(e('5', '2', '', '1'), 'current-empty'); eq(e('5', '2', '0', '1'), 'current-positive');
  eq(e('5', '2', '20', '0'), 'count'); eq(e('5', '2', '20', '1.5'), 'count'); eq(e('5', '2', '20', ''), 'count');
  eq(L.calc('5', '2', '20', '3'), { error: 'not-enough', need: 6 });
  eq(e('6', '2', '20', '3'), 'not-enough'); // exactly equal is not enough either
});
test('led: article table', () => {
  for (const [vs, vf, n, exact, pick] of [[5, 2, 1, '150 Ω', '150 Ω'], [5, 3.2, 1, '90 Ω', '91 Ω'], [3.3, 2, 1, '65 Ω', '68 Ω'],
    [12, 2, 1, '500 Ω', '510 Ω'], [12, 3.2, 1, '440 Ω', '470 Ω'], [12, 3.2, 3, '120 Ω', '120 Ω']]) {
    const r = L.calc(String(vs), String(vf), '20', String(n));
    eq([vs, vf, n, si(r.exact, 'Ω'), si(r.pick.ohms, 'Ω')], [vs, vf, n, exact, pick]);
  }
});
