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
