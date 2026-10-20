const RC = require('../assets/tools/rc-time-constant.js');
const near = (a, b, rel = 1e-9) => Math.abs(a - b) <= Math.abs(b) * rel;

test('RC: 10k × 100n = 1 ms', () => {
  const r = RC.calc('10k', '100n', '90');
  eq([r.r, r.c, r.tau], [1e4, 1e-7, 1e-3]);
  eq(near(r.fc, 159.15494309189535), true);
  eq(near(r.charge, 1e-3 * Math.log(10)), true);      // 2.303 ms
  eq(near(r.discharge, -1e-3 * Math.log(0.9)), true); // 0.105 ms
  eq(r.steps.map(s => s.t), [1e-3, 2e-3, 3e-3, 4e-3, 5e-3]);
  eq(r.steps.map(s => s.charged.toFixed(1)), ['63.2', '86.5', '95.0', '98.2', '99.3']);
  eq(r.steps.map(s => s.left.toFixed(1)), ['36.8', '13.5', '5.0', '1.8', '0.7']);
});
test('RC: 50% 是 0.693τ，63.2% 約等於 1τ', () => {
  const r = RC.calc('1k', '1u', '50');
  eq(near(r.charge, 1e-3 * Math.LN2), true); eq(near(r.discharge, 1e-3 * Math.LN2), true);
  const s = RC.calc('1k', '1u', '63.2120558828558');
  eq(near(s.charge, 1e-3, 1e-9), true);
});
test('RC: 單位寫法', () => {
  eq(RC.calc('4k7', '4u7', '90').tau, 0.02209);
  eq(RC.calc('1M', '10', '90').tau, 10);          // bare capacitance is µF
  eq(RC.calc('100', '22p', '90').tau, 2.2e-9);
  eq(RC.calc('10kΩ', '0.1uF', '90%').tau, 1e-3);
  eq(RC.calc('1M', '1000u', '99').tau, 1000);
});
test('RC: 錯誤', () => {
  eq(RC.calc('', '100n', '90').error, 'resistance-empty');
  eq(RC.calc('abc', '100n', '90').error, 'resistance-format');
  eq(RC.calc('0', '100n', '90').error, 'resistance-positive');
  eq(RC.calc('-1k', '100n', '90').error, 'resistance-positive');
  eq(RC.calc('10k', '', '90').error, 'capacitance-empty');
  eq(RC.calc('10k', '1x', '90').error, 'capacitance-format');
  eq(RC.calc('10k', '0', '90').error, 'capacitance-positive');
  ['', '0', '100', '-5', '150', 'x'].forEach(p => eq(RC.calc('10k', '100n', p).error, 'percent'));
  eq(RC.readPercent('99.9'), { p: 99.9 }); eq(RC.readPercent('5%'), { p: 5 });
});
test('RC: 時間格式', () => {
  const zh = RC.TEXT['zh-tw'], en = RC.TEXT.en;
  eq(zh.time(1e-3), '1 ms'); eq(zh.time(2.2e-9), '2.2 ns'); eq(zh.time(59.9), '59.9 s');
  eq(zh.time(1000), '1000 s（16.7 分鐘）'); eq(en.time(1000), '1000 s (16.7 min)');
  eq(zh.time(4605.17), '4605 s（1.28 小時）'); eq(en.time(7200), '7200 s (2 h)');
  eq(en.sub(RC.calc('10k', '100n', '90')), 'τ = R × C = 10 kΩ × 100 nF');
});
