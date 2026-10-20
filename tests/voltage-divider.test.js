const VD = require('../assets/tools/voltage-divider.js');
const near = (a, b, rel = 1e-9) => { if (Math.abs(a - b) > Math.abs(b) * rel + 1e-15) throw new Error(`expected ~${b}, got ${a}`); };

test('parse resistance', () => {
  eq(VD.parseResistance('10k'), 10000); eq(VD.parseResistance('4k7'), 4700); eq(VD.parseResistance('4.7k'), 4700);
  eq(VD.parseResistance('R47'), 0.47); eq(VD.parseResistance('4R7'), 4.7); eq(VD.parseResistance('2M2'), 2200000);
  eq(VD.parseResistance('1m'), 1000000); eq(VD.parseResistance(' 10 kΩ '), 10000); eq(VD.parseResistance('220 ohms'), 220);
  eq(VD.parseResistance('.5k'), 500); eq(VD.parseResistance('0'), 0); eq(VD.parseResistance('-10k'), -10000);
  eq(VD.parseResistance(''), null); eq(VD.parseResistance('k'), null); eq(VD.parseResistance('abc'), null);
  eq(VD.parseResistance('1.2.3'), null); eq(VD.parseResistance(null), null);
});
test('parse voltage', () => {
  eq(VD.parseVoltage('5'), 5); eq(VD.parseVoltage('3.3'), 3.3); eq(VD.parseVoltage('3.3V'), 3.3);
  eq(VD.parseVoltage('3V3'), 3.3); eq(VD.parseVoltage('500mV'), 0.5); eq(VD.parseVoltage('-12'), -12);
  eq(VD.parseVoltage('-12 V'), -12); eq(VD.parseVoltage('+5'), 5); eq(VD.parseVoltage('0'), 0); eq(VD.parseVoltage('.5'), 0.5);
  eq(VD.parseVoltage(''), null); eq(VD.parseVoltage('v'), null); eq(VD.parseVoltage('five'), null); eq(VD.parseVoltage('5kV'), null);
});
test('SI formatting', () => {
  eq(VD.si(3.3333333, 'V'), '3.333 V'); eq(VD.si(0.000166667, 'A'), '166.7 µA'); eq(VD.si(0.006, 'A'), '6 mA');
  eq(VD.si(19411.7647, 'Ω'), '19.41 kΩ'); eq(VD.si(2200000, 'Ω'), '2.2 MΩ'); eq(VD.si(0.47, 'Ω'), '0.47 Ω');
  eq(VD.si(999.96, 'Ω'), '1 kΩ'); eq(VD.si(0, 'W'), '0 W'); eq(VD.si(-5, 'V'), '-5 V'); eq(VD.si(0.072, 'W'), '72 mW');
});
test('forward: Vout, current, power', () => {
  const r = VD.forward('12', '1k', '1k');
  eq([r.vout, r.ratio, r.current, r.p1, r.p2, r.ptotal], [6, 0.5, 0.006, 0.036, 0.036, 0.072]);
  const s = VD.forward('5', '10k', '20k');
  near(s.vout, 10 / 3); near(s.current, 5 / 30000); near(s.p1, (5 / 30000) ** 2 * 10000); near(s.p2, (5 / 30000) ** 2 * 20000);
  near(s.p1 + s.p2, s.ptotal);
  near(VD.forward('9', '4k7', '1k').vout, 9 * 1000 / 5700);
});
test('forward: zero and negative Vin', () => {
  eq(VD.forward('0', '10k', '10k').vout, 0); eq(VD.forward('0', '10k', '10k').current, 0);
  const n = VD.forward('-12', '1k', '1k');
  eq([n.vout, n.current, n.p1, n.ptotal], [-6, -0.006, 0.036, 0.072]);
});
test('forward: errors', () => {
  const err = (a, b, c) => { const r = VD.forward(a, b, c); return r.error ? VD.TEXT.en.errors[r.error](r.name) : null; };
  eq(err('', '10k', '10k'), 'Enter Vin, for example 5 or 3.3.');
  eq(err('5', '', '10k'), 'Enter R1, for example 10k.');
  eq(err('5', '10k', '  '), 'Enter R2, for example 10k.');
  eq(!!err('abc', '10k', '10k'), true); eq(!!err('5', 'x', '10k'), true);
  eq(err('5', '0', '10k'), 'R1 must be greater than 0 Ω.');
  eq(err('5', '10k', '-1k'), 'R2 must be greater than 0 Ω.');
  eq(err('5', '10k', '10k'), null);
});
test('E24 neighbors', () => {
  eq(VD.e24Neighbors(19411.76), [18000, 20000]);
  eq(VD.e24Neighbors(10000), [10000]);
  eq(VD.e24Neighbors(4700), [4700]);
  eq(VD.e24Neighbors(9500), [9100, 10000]);   // across a decade
  eq(VD.e24Neighbors(10500), [10000, 11000]);
  eq(VD.e24Neighbors(0.95), [0.91, 1]);
  eq(VD.e24Neighbors(1500000), [1500000]);
  eq(VD.e24Neighbors(4699.9999999999), [4700]); // float noise still matches
});
test('solve for R2', () => {
  const r = VD.solve('5', '3.3', '10k', 'r1');
  eq(r.solveFor, 'r2'); near(r.exact, 10000 * 3.3 / 1.7, 1e-11);
  eq(r.options.map(o => o.ohms), [18000, 20000]);
  eq(r.best, 1);
  near(r.options[1].vout, 10 / 3); near(r.options[1].errorPct, (10 / 3 - 3.3) / 3.3 * 100, 1e-9);
  near(r.options[0].vout, 5 * 18 / 28);
  eq(r.options[1].r1, 10000); eq(r.options[1].r2, 20000);
  near(r.options[1].current, 5 / 30000);
});
test('solve for R1', () => {
  const r = VD.solve('12', '5', '10k', 'r2');
  eq(r.solveFor, 'r1'); near(r.exact, 14000);
  eq(r.options.map(o => o.ohms), [13000, 15000]);
  eq(r.best, 1); // 15k gives 4.8 V (-4%), 13k gives 5.217 V (+4.3%)
  near(r.options[1].vout, 4.8);
  const s = VD.solve('5', '3.3', '10k', 'r2');
  near(s.exact, 10000 * 1.7 / 3.3); eq(s.options.map(o => o.ohms), [5100, 5600]); eq(s.best, 0);
});
test('solve: exact E24 result', () => {
  const r = VD.solve('10', '5', '10k', 'r1');
  eq(r.exact, 10000); eq(r.options.length, 1); eq(r.options[0].errorPct, 0); eq(r.best, 0);
});
test('solve: negative supply', () => {
  const r = VD.solve('-12', '-5', '10k', 'r2');
  near(r.exact, 14000); near(r.options[r.best].vout, -4.8);
});
test('solve: errors', () => {
  const err = (a, b, c, k) => { const r = VD.solve(a, b, c, k || 'r1'); return r.error ? VD.TEXT.en.errors[r.error](r.name) : null; };
  eq(err('', '3.3', '10k'), 'Enter Vin, for example 5 or 3.3.');
  eq(err('5', '', '10k'), 'Enter Vout, for example 5 or 3.3.');
  eq(err('5', '3.3', ''), 'Enter R1, for example 10k.');
  eq(err('5', '3.3', '', 'r2'), 'Enter R2, for example 10k.');
  eq(err('0', '3.3', '10k'), 'Vin can’t be 0 V. Enter the supply voltage.');
  eq(err('5', '0', '10k'), 'Vout can’t be 0 V. That would need R2 = 0 Ω.');
  eq(err('5', '5', '10k'), 'Vout must be smaller than Vin. A voltage divider can only lower the voltage.');
  eq(!!err('5', '6', '10k'), true);
  eq(err('5', '-1', '10k'), 'Vout must have the same sign as Vin.');
  eq(err('5', '3.3', '0'), 'R1 must be greater than 0 Ω.');
  eq(err('5', '3.3', '-10k', 'r2'), 'R2 must be greater than 0 Ω.');
});
test('solve result reproduces target', () => {
  for (const [vin, vout, known] of [[5, 3.3, 'r1'], [12, 1.25, 'r2'], [24, 0.8, 'r1'], [3.3, 1.8, 'r2'], [100, 99, 'r1']]) {
    const r = VD.solve(String(vin), String(vout), '10k', known);
    const c = known === 'r1' ? VD.circuit(vin, 10000, r.exact) : VD.circuit(vin, r.exact, 10000);
    near(c.vout, vout, 1e-9);
  }
});
test('article table of common pairs', () => {
  const rows = [[5, '10k', '10k', '2.5 V'], [5, '4.7k', '9.1k', '3.297 V'], [3.3, '10k', '12k', '1.8 V'], [9, '12k', '15k', '5 V'],
    [12, '18k', '13k', '5.032 V'], [12, '24k', '9.1k', '3.299 V'], [24, '91k', '24k', '5.009 V']];
  for (const [vin, r1, r2, want] of rows) {
    eq(VD.si(VD.forward(String(vin), r1, r2).vout, 'V'), want);
    for (const r of [r1, r2]) eq(VD.e24Neighbors(VD.parseResistance(r)).length, 1); // both are E24 values
  }
});
test('errors: codes and Chinese text', () => {
  eq(VD.forward('', '10k', '10k'), { error: 'voltage-empty', name: 'Vin' });
  eq(VD.forward('5', 'x', '10k'), { error: 'resistance-format', name: 'R1' });
  eq(VD.solve('5', '5', '10k', 'r1'), { error: 'too-high' });
  const zh = VD.TEXT['zh-tw'].errors;
  eq(zh['resistance-positive']('R2'), 'R2 必須大於 0 Ω。');
  eq(zh['voltage-empty']('Vout'), '請輸入 Vout，例如 5 或 3.3。');
});
