const ADC = require('../assets/tools/adc-calculator.js');
const near = (a, b, rel = 1e-9) => { if (Math.abs(a - b) > Math.abs(b) * rel + 1e-15) throw new Error(`expected ~${b}, got ${a}`); };

test('adc: voltage to value', () => {
  // 3.3 V reference, 12-bit, dividing by 4095 (the owner's spreadsheet: 1 V -> 1241, 2.197 V -> 2726).
  eq(ADC.toCode('3.3', 12, 'max', '1').code, 1241);
  eq(ADC.toCode('3.3', 12, 'max', '2.197').code, 2726);
  eq(ADC.toCode('3', 12, 'max', '1.83').code, 2498);
  eq(ADC.toCode('3', 12, 'max', '0.7').code, 956);
  // Dividing by 4096.
  eq(ADC.toCode('3.3', 12, 'pow', '1.2').code, 1489);
  near(ADC.toCode('3.3', 12, 'pow', '1.2').exact, 1.2 / 3.3 * 4096);
  eq(ADC.toCode('3.3', 12, 'pow', '1.65').code, 2048);
  eq(ADC.toCode('5', 10, 'pow', '2.5').code, 512);
  eq(ADC.toCode('5', 10, 'max', '5').code, 1023);
  eq(ADC.toCode('2.5', 24, 'pow', '1.25').code, 8388608);
  eq(ADC.toCode('3.3', 8, 'pow', '3V3').code, 255);
  eq(ADC.toCode('3.3', 12, 'pow', '500mV').code, 621);
  eq(ADC.toCode('3.3', 12, 'pow', '0').code, 0);
});
test('adc: values outside the range are limited', () => {
  eq([ADC.toCode('3.3', 12, 'pow', '3.3').code, ADC.toCode('3.3', 12, 'pow', '3.3').clipped], [4095, 'high']);
  eq(ADC.toCode('3.3', 12, 'max', '3.3').clipped, null); // 4095 exactly
  eq([ADC.toCode('3.3', 12, 'max', '5').code, ADC.toCode('3.3', 12, 'max', '5').clipped], [4095, 'high']);
  eq([ADC.toCode('3.3', 12, 'pow', '-0.1').code, ADC.toCode('3.3', 12, 'pow', '-0.1').clipped], [0, 'low']);
});
test('adc: hex, LSB and the voltage of the value', () => {
  const r = ADC.toCode('3.3', 12, 'max', '1');
  eq(r.hex, '0x4D9'); eq(r.max, 4095); near(r.lsb, 3.3 / 4095); near(r.back, 1241 * 3.3 / 4095);
  eq(ADC.toCode('3.3', 16, 'pow', '0').hex, '0x0000');
  eq(ADC.toCode('3.3', 10, 'pow', '3.3').hex, '0x3FF');
  eq(ADC.toCode('3.3', 24, 'pow', '3.3').hex, '0xFFFFFF');
  near(ADC.setup('3.3', 12, 'pow').lsb, 3.3 / 4096);
});
test('adc: value to voltage', () => {
  eq(ADC.toVolt('3.3', 12, 'pow', '2048').v, 1.65);
  eq(ADC.toVolt('3.3', 12, 'pow', '0x800').v, 1.65);
  eq(ADC.toVolt('3.3', 12, 'max', '4095').v, 3.3);
  eq(ADC.toVolt('5', 10, 'pow', '512').v, 2.5);
  eq(ADC.toVolt('3.3', 12, 'pow', '4,095').code, 4095);
  eq(ADC.toVolt('3.3', 12, 'pow', '0b100000000000').code, 2048);
  eq(ADC.toVolt('3.3', 12, 'pow', '4096'), { error: 'code-range', max: 4095 });
  eq(ADC.toVolt('3.3', 12, 'pow', '1.5').error, 'code-format');
  eq(ADC.toVolt('3.3', 12, 'pow', '-1').error, 'code-format');
  eq(ADC.toVolt('3.3', 12, 'pow', '').error, 'code-empty');
});
test('adc: round trip for every resolution and both divisors', () => {
  for (const bits of ADC.BITS) for (const scale of ['pow', 'max']) {
    const max = 2 ** bits - 1;
    for (const code of [0, 1, max >> 1, max - 1, max, Math.floor(Math.random() * max)]) {
      const v = ADC.toVolt('3.3', bits, scale, String(code)).v;
      eq(ADC.toCode('3.3', bits, scale, v.toFixed(15)).code, code);
    }
  }
});
test('adc: reference voltage errors', () => {
  eq(ADC.toCode('', 12, 'pow', '1'), { error: 'voltage-empty', name: 'Vref' });
  eq(ADC.toCode('abc', 12, 'pow', '1'), { error: 'voltage-format', name: 'Vref' });
  eq(ADC.toCode('0', 12, 'pow', '1').error, 'vref-positive');
  eq(ADC.toCode('-3.3', 12, 'pow', '1').error, 'vref-positive');
  eq(ADC.toCode('3.3', 12, 'pow', ''), { error: 'voltage-empty', name: 'V' });
});
test('adc: sensor reading from two points', () => {
  const r = ADC.scaleReading('3.3', 12, 'pow', '0.5', '0', '2.5', '100', '2048');
  eq(r.reading, 57.5); eq(r.offset, -25); near(r.slope, 100 / (2 / 3.3 * 4096)); eq(r.perVolt, 50);
  eq(r.codes, [621, 3103]);
  // A falling line (voltage drops as the reading rises), as in the owner's current sensor sheet.
  const f = ADC.scaleReading('3', 12, 'max', '1.83', '0', '0.7', '4920', '956');
  eq(f.codes, [2498, 956]);
  eq(f.slope < 0, true);
  near(ADC.scaleReading('3', 12, 'max', '1.83', '0', '0.7', '4920', '2497').reading, f.slope * 2497 + f.offset);
  // The two points map back to their readings.
  for (let i = 0; i < 300; i++) {
    const v1 = Math.random() * 3, v2 = Math.random() * 3, y1 = Math.random() * 200 - 100, y2 = Math.random() * 200 - 100;
    if (Math.abs(v1 - v2) < 0.01) continue;
    const c1 = v1 / 3.3 * 4096;
    const s = ADC.scaleReading('3.3', 12, 'pow', String(v1), String(y1), String(v2), String(y2), '0');
    near(s.slope * c1 + s.offset, y1, 1e-6);
  }
  eq(ADC.scaleReading('3.3', 12, 'pow', '1', '0', '1', '5', '10').error, 'same-voltage');
  eq(ADC.scaleReading('3.3', 12, 'pow', '1', 'x', '2', '5', '10'), { error: 'reading-format', name: 'p1' });
  eq(ADC.scaleReading('3.3', 12, 'pow', '1', '0', '', '5', '10'), { error: 'voltage-empty', name: 'p2' });
  eq(ADC.scaleReading('3.3', 12, 'pow', '1', '-40', '2', '1.5e2', '10').error, undefined);
  eq(ADC.scaleReading('3.3', 12, 'pow', '1', '0', '2', '5', '5000').error, 'code-range');
});
test('adc: error messages', () => {
  const msg = (r, lang = 'en') => ADC.TEXT[lang].errors[r.error](r);
  eq(msg(ADC.toCode('', 12, 'pow', '1')), 'Enter the reference voltage, for example 3.3.');
  eq(msg(ADC.toVolt('3.3', 10, 'pow', '2000'), 'zh-tw'), '這個解析度的 ADC 數值最大是 1023。');
  eq(msg(ADC.scaleReading('3.3', 12, 'pow', '1', 'x', '2', '5', '10'), 'zh-tw'), '請輸入第 1 點的讀值，例如 0 或 100。');
});
