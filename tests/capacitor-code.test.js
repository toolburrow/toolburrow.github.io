const CAP = require('../assets/tools/capacitor-code.js');

test('capacitor: three-digit codes', () => {
  eq([CAP.decode('104').pf, CAP.decode('104').f], [100000, 1e-7]);
  eq(CAP.decode('472').pf, 4700);
  eq(CAP.decode('101').pf, 100);
  eq(CAP.decode('100').pf, 10);
  eq(CAP.decode('105').pf, 1e6);
  eq(CAP.decode('107').pf, 1e8);   // tantalum: 100 µF
  eq(CAP.decode('109').pf, 1);     // 9 = ×0.1
  eq(CAP.decode('478').pf, 0.47);  // 8 = ×0.01
  eq([CAP.decode('104').kind, CAP.decode('104').digits, CAP.decode('104').exp], ['digits3', 10, 4]);
});
test('capacitor: two digits and R codes are pF', () => {
  eq([CAP.decode('47').pf, CAP.decode('47').kind], [47, 'digits2']);
  eq([CAP.decode('4R7').pf, CAP.decode('4R7').kind], [4.7, 'r']);
  eq(CAP.decode('0R5').pf, 0.5);
  eq(CAP.decode('R47').pf, 0.47);
  eq(CAP.decode('1r0').pf, 1);
});
test('capacitor: tolerance letters and voltage codes', () => {
  const r = CAP.decode('2A104J');
  eq([r.pf, r.voltage, r.letter, r.tol], [100000, 100, 'J', { type: 'pct', v: 5, min: 95000, max: 105000 }]);
  eq(CAP.decode(' 1h 473 k ').voltage, 50);
  eq(CAP.decode('104K').tol, { type: 'pct', v: 10, min: 90000, max: 110000 });
  eq(CAP.decode('104Z').tol, { type: 'asym', plus: 80, minus: 20, min: 80000, max: 180000 });
  eq(CAP.decode('4R7C').tol, { type: 'pf', v: 0.25, min: 4.45, max: 4.95 });
  eq(CAP.decode('1R0D').tol, { type: 'pf', v: 0.5, min: 0.5, max: 1.5 });  // D is ±0.5 pF below 10 pF
  eq(CAP.decode('101D').tol, { type: 'pct', v: 0.5, min: 99.5, max: 100.5 }); // and ±0.5% above
  eq(CAP.decode('0R5B').tol.min, 0.4);
  eq(CAP.decode('104').tol, null);
  eq(CAP.decode('104').voltage, null);
});
test('capacitor: bad codes', () => {
  eq(CAP.decode(''), { error: 'empty' });
  eq(CAP.decode('  '), { error: 'empty' });
  eq(CAP.decode('1'), { error: 'format' });
  eq(CAP.decode('1044'), { error: 'format' });
  eq(CAP.decode('000'), { error: 'format' });
  eq(CAP.decode('abc'), { error: 'format' });
  eq(CAP.decode('2X104'), { error: 'voltage', code: '2X' });
  eq(CAP.decode('104Q'), { error: 'tolerance', letter: 'Q' });
  eq(CAP.TEXT.en.decodeError.voltage({ code: '2X' }), '2X is not a voltage code this tool knows. See the voltage code table below.');
});
test('capacitor: value to code', () => {
  eq(CAP.encode('100n'), { code: '104', pf: 100000, f: 1e-7, exact: true, short: null });
  eq(CAP.encode('0.1u').code, '104');
  eq(CAP.encode('0.1µF').code, '104');
  eq(CAP.encode('4.7nF').code, '472');
  eq(CAP.encode('4n7').code, '472');
  eq(CAP.encode('1u').code, '105');
  eq(CAP.encode('100u').code, '107');
  eq(CAP.encode('22p'), { code: '220', pf: 22, f: 2.2e-11, exact: true, short: '22' });
  eq(CAP.encode('10p').code, '100');
  eq(CAP.encode('4.7p').code, '4R7');
  eq(CAP.encode('1p').code, '1R0');
  eq(CAP.encode('0.5p').code, '0R5');
});
test('capacitor: values a code cannot hold exactly are rounded and flagged', () => {
  eq(CAP.encode('4.75n'), { code: '482', pf: 4800, f: 4.8e-9, exact: false, short: null });
  eq(CAP.encode('999n'), { code: '105', pf: 1e6, f: 1e-6, exact: false, short: null });
  eq(CAP.encode('9.96p').code, '100');
  eq(CAP.encode('4.73p'), { code: '4R7', pf: 4.7, f: 4.7e-12, exact: false, short: null });
});
test('capacitor: value errors', () => {
  eq(CAP.encode(''), { error: 'empty' });
  eq(CAP.encode('100'), { error: 'unit' });
  eq(CAP.encode('0.1'), { error: 'unit' });
  eq(CAP.encode('100x'), { error: 'format' });
  eq(CAP.encode('0n'), { error: 'positive' });
  eq(CAP.encode('-1n'), { error: 'positive' });
  eq(CAP.encode('0.01p'), { error: 'small' });
  eq(CAP.encode('1000u').error, 'large');
  eq(CAP.encode('990u').code, '997');
});
test('capacitor: every code round-trips', () => {
  for (let d = 10; d <= 99; d++) for (let e = 0; e <= 7; e++) {
    const code = String(d) + e;
    const r = CAP.decode(code);
    const back = CAP.encode(r.pf + 'p');
    eq([code, back.code, back.exact], [code, code, true]);
    eq([code, CAP.encode(r.f * 1e9 + 'n').code], [code, code]);
  }
  for (let t = 1; t < 100; t++) {
    const code = Math.floor(t / 10) + 'R' + (t % 10);
    eq([code, CAP.encode(CAP.decode(code).pf + 'p').code], [code, code]);
  }
});
test('capacitor: pF, nF and µF columns', () => {
  eq(CAP.units(100000), ['100,000', '100', '0.1']);
  eq(CAP.units(4.7), ['4.7', '0.0047', '0.0000047']);
  eq(CAP.units(1e8), ['100,000,000', '100,000', '100']);
  eq([CAP.mult(4), CAP.mult(0), CAP.mult(-1), CAP.mult(-2)], ['10⁴', '10⁰', '0.1', '0.01']);
});
test('capacitor: every voltage code and tolerance letter appears on both pages', () => {
  const fs = require('fs');
  const path = require('path');
  for (const lang of ['en', 'zh-tw']) {
    const html = fs.readFileSync(path.join(__dirname, '..', lang, 'electronics/capacitor-code/index.html'), 'utf8');
    for (const [code, v] of Object.entries(CAP.VOLTAGE)) eq([lang, code, html.includes('<td>' + code + '</td><td>' + v + ' V</td>')], [lang, code, true]);
    for (const letter of Object.keys(CAP.TOLERANCE)) eq([lang, letter, html.includes('<td>' + letter + '</td>')], [lang, letter, true]);
  }
});
