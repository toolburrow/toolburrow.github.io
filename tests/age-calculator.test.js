const AGE = require('../assets/tools/age-calculator.js');
const D = (s) => AGE.parseDate(s);
const A = (b, on) => AGE.age(D(b), D(on));
const ymd = (b, on) => { const r = A(b, on); return [r.years, r.months, r.days]; };

test('年齡：解析日期', () => {
  eq(D('1990-05-20'), { y: 1990, m: 5, d: 20 });
  eq(D('2024-02-29'), { y: 2024, m: 2, d: 29 });
  eq(D('2026-02-29'), null); eq(D(''), null); eq(D(null), null); eq(D('1990-13-01'), null); eq(D('0000-01-01'), null);
});
test('年齡：生日前一天、當天、隔天', () => {
  eq(ymd('1990-05-20', '2026-05-19'), [35, 11, 29]);
  eq(ymd('1990-05-20', '2026-05-20'), [36, 0, 0]);
  eq(ymd('1990-05-20', '2026-05-21'), [36, 0, 1]);
  eq(A('1990-05-20', '2026-05-20').isBirthday, true);
  eq(A('1990-05-20', '2026-05-19').isBirthday, false);
});
test('年齡：跨月、跨年的剩餘天數', () => {
  eq(ymd('1990-05-20', '2026-10-20'), [36, 5, 0]);
  eq(ymd('1990-05-20', '2026-10-19'), [36, 4, 29]);
  eq(ymd('2000-12-31', '2026-01-01'), [25, 0, 1]);
  eq(ymd('2000-01-31', '2026-03-01'), [26, 1, 1]); // 1/31 + 1 month = 2/28, then 1 day
  eq(ymd('2000-03-31', '2026-04-30'), [26, 1, 0]); // month-end clamp: 3/31 + 1 month = 4/30
  eq(ymd('2000-03-31', '2026-04-29'), [26, 0, 29]);
});
test('年齡：同一天出生、出生日在後', () => {
  const r = A('2026-10-20', '2026-10-20');
  eq([r.years, r.months, r.days, r.totalDays, r.isBirthday, r.nextAge, AGE.iso(r.next), r.daysToNext, r.nominal],
     [0, 0, 0, 0, false, 1, '2027-10-20', 365, 1]);
  eq(A('2026-10-21', '2026-10-20'), { error: 'future' });
});
test('年齡：2 月 29 日出生', () => {
  eq(ymd('2024-02-29', '2025-02-27'), [0, 11, 29]);
  eq(ymd('2024-02-29', '2025-02-28'), [1, 0, 0]);
  eq(A('2024-02-29', '2025-02-28').isBirthday, true);
  eq(ymd('2024-02-29', '2025-03-01'), [1, 0, 1]);
  eq(ymd('2024-02-29', '2028-02-28'), [3, 11, 30]);
  eq(ymd('2024-02-29', '2028-02-29'), [4, 0, 0]);
  const r = A('2024-02-29', '2026-10-20');
  eq([AGE.iso(r.next), r.nextAge], ['2027-02-28', 3]);
  eq(AGE.iso(A('2024-02-29', '2027-03-01').next), '2028-02-29');
});
test('年齡：下次生日', () => {
  const r = A('1990-05-20', '2026-10-20');
  eq([AGE.iso(r.next), r.nextAge, r.daysToNext], ['2027-05-20', 37, 212]);
  const s = A('1990-05-20', '2026-05-20');
  eq([AGE.iso(s.next), s.nextAge, s.daysToNext], ['2026-05-20', 36, 0]);
  const e = A('1990-12-31', '2026-12-30');
  eq([AGE.iso(e.next), e.daysToNext], ['2026-12-31', 1]);
});
test('年齡：總天數、週數、月數', () => {
  const r = A('2026-01-01', '2026-10-20');
  eq([r.totalDays, r.totalWeeks, r.totalMonths], [292, 41, 9]);
  eq(A('2000-01-01', '2026-01-01').totalDays, 9497); // 26 years with 7 leap days (2000, 04, 08, 12, 16, 20, 24)
  eq(A('2024-01-01', '2025-01-01').totalDays, 366);
});
test('年齡：虛歲和民國年次', () => {
  eq(A('1990-05-20', '2026-10-20').nominal, 37);
  eq(A('1990-12-31', '2026-01-01').nominal, 37);
  eq(A('1990-01-01', '2026-12-31').nominal, 37);
  eq(AGE.rocBirthYear(1990), '民國 79 年次');
  eq(AGE.rocBirthYear(1912), '民國 1 年次');
  eq(AGE.rocBirthYear(1911), '民前 1 年');
});
test('年齡：頁面文字', () => {
  const zh = AGE.TEXT['zh-tw'], en = AGE.TEXT.en;
  const r = A('1990-05-20', '2026-10-20');
  eq(zh.main(r), '36 歲'); eq(zh.detail(r), '36 歲 5 個月 0 天');
  eq(zh.next(r), '2027 年 5 月 20 日（星期四），還有 212 天，滿 37 歲');
  eq(zh.months(r), '437 個月，1,900 週，13,302 天');
  eq(en.main(r), '36 years old'); eq(en.detail(r), '36 years, 5 months, 0 days');
  eq(en.next(r), 'Thursday, May 20, 2027, in 212 days (turns 37)');
  eq(en.main(A('2025-01-01', '2026-01-01')), '1 year old');
  eq(en.next(A('1990-05-20', '2026-05-20')), 'Today. Happy birthday!');
});
test('年齡：和 Date 交叉比對 2000 組隨機日期', () => {
  let seed = 2026;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const day = (z) => { const t = new Date(z * 86400000); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
  for (let i = 0; i < 2000; i++) {
    const zb = Math.floor(rnd() * 40000) - 20000, zo = zb + Math.floor(rnd() * 40000);
    const b = day(zb), o = day(zo), r = AGE.age(b, o);
    eq(r.totalDays, zo - zb);
    // Completed years the plain way: has this year's birthday (2/29 → 2/28 in other years) passed?
    const bd = b.m === 2 && b.d === 29 && !AGE.isLeap(o.y) ? 28 : b.d;
    const passed = o.m > b.m || (o.m === b.m && o.d >= bd);
    eq([AGE.iso(b), AGE.iso(o), r.years], [AGE.iso(b), AGE.iso(o), o.y - b.y - (passed ? 0 : 1)]);
    eq(r.daysToNext >= 0 && r.daysToNext <= 366, true);
  }
});
