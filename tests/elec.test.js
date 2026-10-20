const E = require('../assets/elec.js');

test('elec: current and power with prefixes and units', () => {
  const a = (t, bare = 1) => E.parseScaled(t, 'a', bare);
  eq([a('20mA'), a('20 mA'), a('0.02'), a('0.02A'), a('500uA'), a('500µA'), a('500μA'), a('1.5A'), a('2')], [0.02, 0.02, 0.02, 0.02, 0.0005, 0.0005, 0.0005, 1.5, 2]);
  eq([a('20', 1e-3), a('20mA', 1e-3), a('0.02A', 1e-3), a('1.5k', 1)], [0.02, 0.02, 0.02, 1500]);
  const w = (t) => E.parseScaled(t, 'w', 1);
  eq([w('1/4W'), w('1/4'), w('250mW'), w('0.5 W'), w('2')], [0.25, 0.25, 0.25, 0.5, 2]);
  eq([a(''), a('abc'), a('20mV'), a('1/0'), w('5 V')], [null, null, null, null, null]);
});
test('elec: read errors', () => {
  eq(E.read('', 'current', 'I'), { error: 'current-empty', name: 'I' });
  eq(E.read('x', 'power', 'P'), { error: 'power-format', name: 'P' });
  eq(E.read('0', 'resistance', 'R'), { error: 'resistance-positive', name: 'R' });
  eq(E.read('-1mA', 'current', 'I'), { error: 'current-positive', name: 'I' });
  eq(E.read('-5', 'voltage', 'V'), { v: -5 }); // voltage may be negative
  eq(E.read('20', 'current', 'I', 1e-3), { v: 0.02 });
});
test('elec: capacitance parsing', () => {
  const C = (s, bare) => E.parseCapacitance(s, bare === undefined ? 1e-6 : bare);
  eq(C('100n'), 1e-7); eq(C('100nF'), 1e-7); eq(C('100 nF'), 1e-7); eq(C('4.7uF'), 4.7e-6); eq(C('4.7µF'), 4.7e-6);
  eq(C('4.7μF'), 4.7e-6); eq(C('4u7'), 4.7e-6); eq(C('4n7'), 4.7e-9); eq(C('2p2'), 2.2e-12); eq(C('22p'), 2.2e-11);
  eq(C('0.1u'), 1e-7); eq(C('10'), 1e-5); eq(C('1F'), 1); eq(C('1mF'), 1e-3); eq(C('470uf'), 4.7e-4);
  eq(C('abc'), null); eq(C('4x7'), null); eq(C(''), null);
  eq(E.read('0', 'capacitance', 'C', 1e-6).error, 'capacitance-positive');
  eq(E.read('', 'capacitance', 'C', 1e-6).error, 'capacitance-empty');
  eq(E.read('1q', 'capacitance', 'C', 1e-6).error, 'capacitance-format');
  eq(E.read('100n', 'capacitance', 'C', 1e-6), { v: 1e-7 });
});
test('elec: SI formatting down to pico', () => {
  eq(E.si(2.2e-11, 'F'), '22 pF'); eq(E.si(1e-7, 'F'), '100 nF'); eq(E.si(4.7e-6, 'F'), '4.7 µF'); eq(E.si(1e-3, 'F'), '1000 µF'); eq(E.si(0.0022, 'F'), '2200 µF'); eq(E.si(1, 'F'), '1 F');
  eq(E.si(5e-10, 'A'), '500 pA');
});
