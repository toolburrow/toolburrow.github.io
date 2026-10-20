const P = require('../assets/tools/ping-converter.js');
const near = (a, b, tol = 1e-9) => { if (Math.abs(a - b) > tol) throw new Error(`expected ${b}, got ${a}`); };

test('ping: definition', () => {
  near(P.M2_PER.ping, 3.305785123966942);
  near(P.convert('1', 'm2').ping, 0.3025, 1e-15); // 1 m² = 0.3025 坪 exactly
  near(P.convert('1', 'ping').ft2, 35.583175, 1e-6);
});
test('ping: conversions', () => {
  const r = P.convert('30', 'ping');
  near(r.m2, 99.17355371900827); near(r.ft2, 1067.4952, 1e-4);
  near(P.convert('100', 'm2').ping, 30.25);
  near(P.convert('1000', 'ft2').ping, 92.90304 * 0.3025);
  near(P.convert('１，０００', 'ft2').m2, 92.90304); // full-width digits and comma
  eq(P.convert('0', 'ping').m2, 0);
});
test('ping: room size', () => {
  const r = P.room('4', '3.5', 'm');
  near(r.m2, 14); near(r.ping, 4.235);
  near(P.room('400', '350', 'cm').m2, 14);
  near(P.room('12', '10', 'ft').ft2, 120); near(P.room('12', '10', 'ft').m2, 11.1483648);
});
test('ping: shared areas', () => {
  const r = P.shared('35', '33');
  near(r.own, 23.45); near(r.shared, 11.55); near(r.ownM2, 23.45 * 400 / 121);
  near(P.shared('30', '0').own, 30);
  eq(P.shared('30', '100'), { error: 'ratio-range', field: 'ratio' });
});
test('ping: errors', () => {
  eq(P.convert('', 'ping'), { error: 'empty' });
  eq(P.convert('-3', 'ping'), { error: 'number' });
  eq(P.convert('3坪', 'ping'), { error: 'number' });
  eq(P.room('4', '', 'm'), { error: 'empty', field: 'width' });
  eq(P.room('x', '3', 'm'), { error: 'number', field: 'length' });
  eq(P.shared('', '30'), { error: 'empty', field: 'total' });
});
test('ping: number format', () => {
  eq(P.fmt(1067.4952, 1), '1,067.5'); eq(P.fmt(99.17355, 2), '99.17'); eq(P.fmt(30.25, 2), '30.25');
  eq(P.fmt(14, 2), '14'); eq(P.fmt(4.2350001, 2), '4.24'); eq(P.fmt(1234567.891, 2), '1,234,567.89'); eq(P.fmt(0, 2), '0');
});
test('ping: article tables', () => {
  for (const [ping, m2] of [[1, '3.31'], [10, '33.06'], [20, '66.12'], [25, '82.64'], [30, '99.17'], [35, '115.7'], [40, '132.23'], [50, '165.29']])
    eq([ping, P.fmt(P.convert(String(ping), 'ping').m2, 2)], [ping, m2]);
  for (const [ping, ft2] of [[10, '355.8'], [20, '711.7'], [30, '1,067.5'], [40, '1,423.3']])
    eq([ping, P.fmt(P.convert(String(ping), 'ping').ft2, 1)], [ping, ft2]);
});
