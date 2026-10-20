const B = require('../assets/tools/bmi-calculator.js');
const near = (a, b, tol = 1e-9) => { if (Math.abs(a - b) > tol) throw new Error(`expected ${b}, got ${a}`); };

test('bmi: metric', () => {
  const r = B.compute({ system: 'metric', cm: '170', kg: '65' }, 'tw');
  eq(r.shown, '22.5'); eq(r.key, 'normal');
  near(r.range.min, 18.5 * 1.7 * 1.7); near(r.range.max, 24 * 1.7 * 1.7);
  eq(B.compute({ system: 'metric', cm: '160', kg: '80' }, 'tw').shown, '31.3');
  eq(B.compute({ system: 'metric', cm: '１７０', kg: '６５．０' }, 'tw').shown, '22.5'); // full-width input
});
test('bmi: US units match metric', () => {
  const us = B.compute({ system: 'us', ft: '5', inch: '9', lb: '160' }, 'who');
  near(us.m, 1.7526); near(us.kg, 72.57477920);
  eq(us.shown, '23.6'); eq(us.key, 'normal');
  eq(B.compute({ system: 'us', ft: '6', inch: '', lb: '200' }, 'who').shown, '27.1'); // inches may be empty
  eq(B.compute({ system: 'us', ft: '', inch: '70', lb: '150' }, 'who').shown, '21.5'); // or feet
});
test('bmi: Taiwan cut-offs', () => {
  const k = (x) => B.classify(x, 'tw');
  eq([k(18.4), k(18.5), k(23.9), k(24), k(26.9), k(27), k(29.9), k(30), k(34.9), k(35), k(60)],
    ['under', 'normal', 'normal', 'over', 'over', 'obese1', 'obese1', 'obese2', 'obese2', 'obese3', 'obese3']);
});
test('bmi: WHO cut-offs', () => {
  const k = (x) => B.classify(x, 'who');
  eq([k(18.4), k(18.5), k(24), k(24.9), k(25), k(29.9), k(30), k(34.9), k(35), k(39.9), k(40)],
    ['under', 'normal', 'normal', 'normal', 'over', 'over', 'obese1', 'obese1', 'obese2', 'obese2', 'obese3']);
});
test('bmi: the number shown always agrees with the category', () => {
  eq([B.classify(23.96, 'tw'), B.shown(23.96, 'tw')], ['normal', '23.96']); // not "24.0"
  eq([B.classify(23.999, 'tw'), B.shown(23.999, 'tw')], ['normal', '23.99']);
  eq([B.classify(18.46, 'tw'), B.shown(18.46, 'tw')], ['under', '18.46']);  // not "18.5"
  eq(B.shown(23.94, 'tw'), '23.9'); eq(B.shown(24, 'tw'), '24.0'); eq(B.shown(22.49, 'tw'), '22.5');
  eq(B.shown(24.96, 'tw'), '25.0');  // no cut-off at 25 in Taiwan
  eq(B.shown(24.96, 'who'), '24.96'); // but there is in WHO
  for (let i = 0; i < 20000; i++) { // random check: the shown number always falls in the same category
    const x = 10 + Math.random() * 40;
    for (const std of ['tw', 'who']) eq([x, B.classify(Number(B.shown(x, std)), std)], [x, B.classify(x, std)]);
  }
});
test('bmi: gap to the healthy range follows the category', () => {
  const at = (kg, std) => B.gap(B.compute({ system: 'metric', cm: '170', kg: String(kg) }, std));
  eq(at(65, 'tw'), 0);
  near(at(80, 'tw'), 80 - 24 * 2.89); near(at(50, 'tw'), 50 - 18.5 * 2.89);
  eq(at(69.25, 'tw'), 0);      // BMI 23.96: healthy, inside 53.5 to 69.4 kg
  near(at(69.4, 'tw'), 69.4 - 69.36);
  eq(at(70, 'who'), 0);        // 24.2 is normal under WHO
});
test('bmi: errors', () => {
  const e = (i) => B.compute(i, 'tw').error;
  eq(e({ system: 'metric', cm: '', kg: '60' }), 'height-empty');
  eq(e({ system: 'metric', cm: '17o', kg: '60' }), 'height-number');
  eq(e({ system: 'metric', cm: '170', kg: ' ' }), 'weight-empty');
  eq(e({ system: 'metric', cm: '170', kg: '-5' }), 'weight-number');
  eq(e({ system: 'metric', cm: '1.7', kg: '60' }), 'height-range'); // metres typed into cm
  eq(e({ system: 'metric', cm: '170', kg: '0' }), 'weight-range');
  eq(e({ system: 'us', ft: '', inch: '', lb: '150' }), 'height-empty');
  eq(e({ system: 'us', ft: '5', inch: 'x', lb: '150' }), 'height-number');
  eq(e({ system: 'us', ft: '5', inch: '9', lb: '' }), 'weight-empty');
});
test('bmi: article tables', () => {
  // Healthy weight for 160 cm: 47.4 to 61.4 kg (Taiwan); BMI of 170 cm / 65 kg is 22.5.
  const r = B.compute({ system: 'metric', cm: '160', kg: '55' }, 'tw');
  eq([B.round1(r.range.min), B.round1(r.range.max)], [47.4, 61.4]);
  for (const [cm, lo, hi] of [[150, 41.6, 54], [155, 44.4, 57.7], [160, 47.4, 61.4], [165, 50.4, 65.3], [170, 53.5, 69.4], [175, 56.7, 73.5], [180, 59.9, 77.8]]) {
    const x = B.healthyRange(cm / 100, 'tw');
    eq([cm, B.round1(x.min), B.round1(x.max)], [cm, lo, hi]);
  }
  for (const [ft, inch, lo, hi] of [[5, 0, 94.7, 128], [5, 4, 107.8, 145.6], [5, 8, 121.7, 164.4], [6, 0, 136.4, 184.3]]) {
    const m = (ft * 12 + inch) * 0.0254, x = B.healthyRange(m, 'who'), k = 1 / 0.45359237;
    eq([ft, inch, B.round1(x.min * k), B.round1(x.max * k)], [ft, inch, lo, hi]);
  }
});
test('bmi: gap wording', () => {
  const zh = B.TEXT['zh-tw'], en = B.TEXT.en;
  eq(zh.gap(0, false), '在健康範圍內'); eq(zh.gap(10.64, false), '多約 10.6 公斤'); eq(zh.gap(-3, false), '少約 3 公斤');
  eq(zh.gap(0.04, false), '多不到 0.1 公斤'); eq(zh.gap(-1, true), '少約 2.2 磅');
  eq(en.gap(0.04, false), 'Less than 0.1 kg above'); eq(en.gap(-8.5, false), 'About 8.5 kg below'); eq(en.gap(1, true), 'About 2.2 lb above');
});
