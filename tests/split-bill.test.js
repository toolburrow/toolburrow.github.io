const SP = require('../assets/tools/split-bill.js');

test('分帳：解析金額', () => {
  eq(SP.parseAmount('3280'), { cents: 328000 });
  eq(SP.parseAmount('1,234.5'), { cents: 123450 });
  eq(SP.parseAmount('８６．４'), { cents: 8640 });
  eq(SP.parseAmount('.5'), { cents: 50 });
  eq(SP.parseAmount('12.'), { cents: 1200 });
  eq(SP.parseAmount(''), { error: 'empty' }); eq(SP.parseAmount('  '), { error: 'empty' });
  eq(SP.parseAmount('0'), { error: 'zero' }); eq(SP.parseAmount('0.00'), { error: 'zero' });
  eq(SP.parseAmount('-5'), { error: 'number' }); eq(SP.parseAmount('abc'), { error: 'number' }); eq(SP.parseAmount('.'), { error: 'number' });
  eq(SP.parseAmount('1.234'), { error: 'decimals' });
  eq(SP.parseAmount('100000000'), { cents: 1e10 }); eq(SP.parseAmount('100000000.01'), { error: 'big' });
});
test('分帳：解析人數和百分比', () => {
  eq(SP.parsePeople('4'), { n: 4 }); eq(SP.parsePeople('１２'), { n: 12 });
  eq(SP.parsePeople(''), { error: 'empty' });
  ['0', '-1', '2.5', '1001', 'a'].forEach(s => eq(SP.parsePeople(s), { error: 'people' }));
  eq(SP.parsePercent(''), { h: 0 }); eq(SP.parsePercent('10'), { h: 1000 }); eq(SP.parsePercent('12.5%'), { h: 1250 });
  eq(SP.parsePercent('１０％'), { h: 1000 }); eq(SP.parsePercent('100'), { h: 10000 }); eq(SP.parsePercent('0.01'), { h: 1 });
  ['101', '-5', '1.234', 'x', '.'].forEach(s => eq(SP.parsePercent(s), { error: 'percent' }));
});
test('分帳：服務費和四捨五入到 1 元', () => {
  const r = SP.split(328000, 1000, 5, 100, 100);
  eq([r.total, r.service, r.each, r.collected, r.extra], [360800, 32800, 72200, 361000, 200]);
  eq(r.fair, { low: 72100, lowCount: 2, high: 72200, highCount: 3 });
  eq(SP.split(100500, 1000, 1, 100, 100).total, 110600); // 1105.5 rounds up to 1106
  eq(SP.split(100400, 1000, 1, 100, 100).total, 110400); // 1104.4 rounds down
  eq(SP.split(99999, 0, 1, 100, 100).total, 100000);     // 999.99 typed in NT$ rounds to 1000
});
test('分帳：整除時剛好收齊', () => {
  const r = SP.split(328000, 1000, 4, 100, 100);
  eq([r.total, r.each, r.extra, r.fair.highCount, r.fair.low], [360800, 90200, 0, 0, 90200]);
  const one = SP.split(12345, 0, 1, 1, 1);
  eq([one.total, one.each, one.extra, one.fair.highCount], [12345, 12345, 0, 0]);
});
test('分帳：取整到 10 元、100 元', () => {
  const r = SP.split(328000, 1000, 5, 100, 1000);
  eq([r.each, r.collected, r.extra], [73000, 365000, 4200]);
  const h = SP.split(328000, 1000, 5, 100, 10000);
  eq([h.each, h.collected, h.extra], [80000, 400000, 39200]);
  eq(SP.split(300000, 0, 3, 100, 10000).extra, 0);
});
test('分帳：美元到分', () => {
  const r = SP.split(8640, 1800, 3, 1, 1);
  eq([r.total, r.service, r.each, r.collected, r.extra], [10195, 1555, 3399, 10197, 2]);
  eq(r.fair, { low: 3398, lowCount: 2, high: 3399, highCount: 1 });
  const d = SP.split(8640, 1800, 3, 1, 100);
  eq([d.each, d.extra], [3400, 5]);
  const f = SP.split(8640, 1800, 3, 1, 500);
  eq([f.each, f.extra], [3500, 305]);
});
test('分帳：隨機檢查總額一定收齊', () => {
  let seed = 7;
  const rnd = (n) => Math.floor((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 * n);
  for (let i = 0; i < 3000; i++) {
    const cents = 1 + rnd(1e7), pct = rnd(3001), people = 1 + rnd(50), min = [1, 100][rnd(2)];
    const round = min * [1, 10, 100, 5][rnd(4)];
    const r = SP.split(cents, pct, people, min, round);
    eq(r.total % min, 0);
    eq(Math.abs(r.total - cents * (1 + pct / 10000)) <= min / 2 + 1e-6, true);
    eq(r.fair.high * r.fair.highCount + r.fair.low * r.fair.lowCount, r.total);
    eq(r.fair.highCount >= 0 && r.fair.highCount < people, true);
    eq(r.each % round, 0);
    eq(r.extra >= 0 && r.extra < people * round, true);
  }
});
test('分帳：頁面文字', () => {
  const zh = SP.TEXT['zh-tw'], en = SP.TEXT.en;
  const r = SP.split(328000, 1000, 5, 100, 100);
  eq(zh.main(r), '每人 722 元');
  eq(zh.sub(r, 5), '總共 3,608 元（含服務費 328 元），5 人平均每人 721.6 元');
  eq(zh.collect(r, 5), '722 元 × 5 人 = 3,610 元，比總額多 2 元');
  eq(zh.fair(r.fair), '3 人付 722 元，2 人付 721 元');
  eq(zh.sub(SP.split(300000, 0, 3, 100, 100), 3), '總共 3,000 元，3 人平均每人 1,000 元');
  const u = SP.split(8640, 1800, 3, 1, 1);
  eq(en.main(u), '33.99 each');
  eq(en.sub(u, 3), 'Total 101.95 including 15.55 tip or service, 33.98 each when split exactly 3 ways');
  eq(en.collect(u, 3), '33.99 × 3 = 101.97, 0.02 more than the total');
  eq(en.fair(u.fair), '1 person pays 33.99, 2 people pay 33.98');
  eq(SP.average(2000000 / 3, false), '6,666.67');
});
