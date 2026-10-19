const R = require('../en/electronics/resistor-color-code/tool.js');

test('decode 4-band', () => {
  eq(R.decode(['yellow', 'violet', 'red', 'gold']), { ohms: 4700, tol: 5, min: 4465, max: 4935 });
  eq(R.decode(['brown', 'black', 'gold', 'gold']).ohms, 1);
  eq(R.decode(['red', 'red', 'silver', 'none']).ohms, 0.22);
});
test('decode 5-band', () => { eq(R.decode(['brown', 'black', 'black', 'red', 'brown']).ohms, 10000); });
test('format', () => {
  eq(R.formatOhms(4700), '4.7 kΩ'); eq(R.formatOhms(0.47), '0.47 Ω');
  eq(R.formatOhms(2200000), '2.2 MΩ'); eq(R.formatOhms(100), '100 Ω');
});
test('parse', () => {
  eq(R.parseValue('4.7k'), 4700); eq(R.parseValue('4k7'), 4700); eq(R.parseValue('R47'), 0.47);
  eq(R.parseValue('2M2'), 2200000); eq(R.parseValue('10kΩ'), 10000); eq(R.parseValue('1 ohm'), 1);
  eq(R.parseValue('220'), 220); eq(R.parseValue('abc'), null); eq(R.parseValue('k'), null);
});
test('encode', () => {
  eq(R.encode(4700, 2).bands, ['yellow', 'violet', 'red']);
  eq(R.encode(10000, 3).bands, ['brown', 'black', 'black', 'red']);
  eq(R.encode(1, 2).bands, ['brown', 'black', 'gold']);
  eq(R.encode(0.47, 2).bands, ['yellow', 'violet', 'silver']);
  eq(R.encode(4750, 2).exact, false);
  eq(R.encode(4750, 3).exact, true);
  eq(R.encode(999, 2).bands, ['brown', 'black', 'red']); // 999 rounds to 1000 = 10 x 100
});
test('encode limits', () => { eq(!!R.encode(0.001, 2).error, true); eq(!!R.encode(0, 2).error, true); });
test('round trip E24 values', () => {
  const e24 = [10,11,12,13,15,16,18,20,22,24,27,30,33,36,39,43,47,51,56,62,68,75,82,91];
  for (const exp of [-1, 0, 1, 2, 3, 4, 5, 6]) for (const v of e24) {
    const ohms = Number((v * 10 ** exp).toPrecision(12));
    const e = R.encode(ohms, 2);
    eq(e.exact, true);
    eq(R.decode(e.bands.concat(['gold'])).ohms, ohms);
  }
});
