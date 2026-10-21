const SMD = require('../assets/tools/smd-resistor-code.js');

test('smd: E96 table is 100 × 10^(i/96) rounded', () => {
  eq(SMD.E96.length, 96);
  SMD.E96.forEach((v, i) => eq([i, v], [i, Math.round(100 * 10 ** (i / 96))]));
});
test('smd: 3-digit and 4-digit codes', () => {
  eq(SMD.decode('103'), { kind: 'digits3', digits: 10, exp: 3, ohms: 10000, tol: 5 });
  eq(SMD.decode('472').ohms, 4700);
  eq(SMD.decode('220').ohms, 22);
  eq(SMD.decode('105').ohms, 1e6);
  eq(SMD.decode('1002'), { kind: 'digits4', digits: 100, exp: 2, ohms: 10000, tol: 1 });
  eq(SMD.decode('4701').ohms, 4700);
  eq(SMD.decode('1000').ohms, 100);
  eq(SMD.decode('2493').ohms, 249000);
});
test('smd: R as the decimal point', () => {
  eq(SMD.decode('4R7'), { kind: 'r', ohms: 4.7, tol: 5 });
  eq(SMD.decode('R47').ohms, 0.47);
  eq(SMD.decode('r10').ohms, 0.1);
  eq(SMD.decode('49R9'), { kind: 'r', ohms: 49.9, tol: 1 });
  eq(SMD.decode('R005').ohms, 0.005);
  eq(SMD.decode('1R00').ohms, 1);
});
test('smd: EIA-96 codes', () => {
  eq(SMD.decode('01C').ohms, 10000);
  eq(SMD.decode('01A').ohms, 100);
  eq(SMD.decode('68X').ohms, 49.9);
  eq(SMD.decode('68S').ohms, 49.9);
  eq(SMD.decode('96F').ohms, 97600000);
  eq(SMD.decode('01Z').ohms, 0.1);
  eq(SMD.decode('30B').ohms, 2000);
  eq(SMD.decode('30H').ohms, 2000);
  eq(SMD.decode('66C').ohms, 47500);
  eq([SMD.decode('01c').index, SMD.decode('01c').base, SMD.decode('01c').tol], [1, 100, 1]);
  eq(SMD.decode('10Y').altOhms, null);
  eq([SMD.decode('10R').ohms, SMD.decode('10R').altOhms], [1.24, 10]); // as EIA-96, R = ×0.01
});
test('smd: zero-ohm jumpers and bad codes', () => {
  for (const c of ['0', '00', '000', '0000']) eq(SMD.decode(c), { kind: 'zero', ohms: 0, tol: null });
  eq(SMD.decode(''), { error: 'empty' });
  eq(SMD.decode('00C'), { error: 'index' });
  eq(SMD.decode('97A'), { error: 'index' });
  eq(SMD.decode('1'), { error: 'format' });
  eq(SMD.decode('10'), { error: 'format' });
  eq(SMD.decode('10003'), { error: 'format' });
  eq(SMD.decode('005'), { error: 'format' });
  eq(SMD.decode('01G'), { error: 'format' });
  eq(SMD.decode('R'), { error: 'format' });
  eq(SMD.decode('R0'), { error: 'format' });
  eq(SMD.decode('R00'), { error: 'format' });
  eq(SMD.decode('1R2345'), { error: 'format' });
});
test('smd: value to codes', () => {
  const r = SMD.encode('10k');
  eq([r.d3.code, r.d4.code, r.eia.code], ['103', '1002', '01C']);
  eq([r.d3.exact, r.d4.exact, r.eia.exact], [true, true, true]);
  const k47 = SMD.encode('4.7k');
  eq([k47.d3.code, k47.d4.code, k47.eia.code, k47.eia.ohms, k47.eia.exact], ['472', '4701', '66B', 4750, false]);
  eq(k47.eia.diff.toFixed(2), '1.06');
  eq(SMD.encode('4k7').d3.code, '472');
  const r49 = SMD.encode('49.9');
  eq([r49.d3.code, r49.d3.ohms, r49.d3.exact, r49.d4.code, r49.eia.code], ['500', 50, false, '49R9', '68X']);
  eq([SMD.encode('4.7').d3.code, SMD.encode('4.7').d4.code], ['4R7', '4R70']);
  eq([SMD.encode('0.47').d3.code, SMD.encode('0.47').d4.code], ['R47', 'R470']);
  eq([SMD.encode('R005').d3.error, SMD.encode('R005').d4.code], ['small', 'R005']);
  eq(SMD.encode('0.05').d3.code, 'R05');
  eq(SMD.encode('1').d3.code, '1R0');
  eq(SMD.encode('10').d3.code, '100');
  eq(SMD.encode('100').d4.code, '1000');
  eq(SMD.encode('99.96').d4.code, '1000'); // rounds up into the next decade
  eq(SMD.encode('9.96').d3.code, '100');
  eq(SMD.encode('0.996').d3.code, '1R0');
  eq(SMD.encode('4.75k').d3.code, '482');
  eq(SMD.encode('1M').eia.code, '01E');
  eq(SMD.encode('100k').eia.code, '01D');
});
test('smd: value limits and errors', () => {
  eq(SMD.encode('0'), { ohms: 0, zero: true });
  eq(SMD.encode(''), { error: 'empty' });
  eq(SMD.encode('abc'), { error: 'format' });
  eq(SMD.encode('-10'), { error: 'negative' });
  eq(SMD.encode('0.05').eia.error, 'range');
  eq(SMD.encode('100M').eia.error, 'range');
  eq(SMD.encode('97.6M').eia.code, '96F');
  eq(SMD.encode('0.1').eia.code, '01Z');
  eq(SMD.encode('100G').d3.error, 'large');
  eq(SMD.encode('99G').d3.code, '999');
});
test('smd: every code round-trips', () => {
  for (let d = 10; d <= 99; d++) for (let e = 0; e <= 9; e++) eq(SMD.encode(SMD.decode('' + d + e).ohms + '').d3.code, '' + d + e);
  for (let d = 100; d <= 999; d++) for (let e = 0; e <= 9; e++) eq(SMD.encode(SMD.decode('' + d + e).ohms + '').d4.code, '' + d + e);
  for (let i = 1; i <= 96; i++) for (const l of 'ZYXABCDEF') {
    const code = (i < 10 ? '0' : '') + i + l;
    const e = SMD.encode(SMD.decode(code).ohms + '').eia;
    eq([code, e.code, e.exact], [code, code, true]);
  }
  for (let n = 1; n < 100; n++) {
    const code = n < 10 ? n + 'R0' : (n / 10 | 0) + 'R' + (n % 10);
    eq(SMD.encode(SMD.decode(code).ohms + '').d3.code, code);
  }
});
test('smd: the EIA-96 table on both pages matches the code', () => {
  const fs = require('fs');
  const path = require('path');
  for (const lang of ['en', 'zh-tw']) {
    const html = fs.readFileSync(path.join(__dirname, '..', lang, 'electronics/smd-resistor-code/index.html'), 'utf8');
    SMD.E96.forEach((v, i) => {
      const cell = '<td>' + String(i + 1).padStart(2, '0') + '</td><td>' + v + '</td>';
      eq([lang, cell, html.includes(cell)], [lang, cell, true]);
    });
  }
});
