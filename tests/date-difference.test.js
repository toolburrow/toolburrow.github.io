const DD = require('../assets/tools/date-difference.js');
const D = (s) => DD.parseDate(s);

test('閏年規則', () => {
  eq([2024, 2000, 2028].map(DD.isLeap), [true, true, true]);
  eq([2026, 1900, 2100].map(DD.isLeap), [false, false, false]);
  eq(DD.daysInMonth(2024, 2), 29); eq(DD.daysInMonth(2026, 2), 28); eq(DD.daysInMonth(1900, 2), 28);
  eq(DD.daysInMonth(2026, 4), 30); eq(DD.daysInMonth(2026, 12), 31);
});
test('解析日期', () => {
  eq(D('2026-10-19'), { y: 2026, m: 10, d: 19 });
  eq(D('2026/1/5'), { y: 2026, m: 1, d: 5 });
  eq(D('2024-02-29'), { y: 2024, m: 2, d: 29 });
  eq(D('2026-02-29'), null); eq(D('1900-02-29'), null);
  eq(D('2026-04-31'), null); eq(D('2026-13-01'), null); eq(D('2026-00-10'), null); eq(D('2026-01-00'), null);
  eq(D(''), null); eq(D('   '), null); eq(D(null), null); eq(D('abc'), null); eq(D('0000-01-01'), null);
});
test('日數換算與 Date 一致', () => {
  eq(DD.toDays(1970, 1, 1), 0);
  eq(DD.fromDays(0), { y: 1970, m: 1, d: 1 });
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 2000; i++) {
    const z = Math.floor(rnd() * 200000) - 100000; // about 1696–2243
    const t = new Date(z * 86400000);
    const want = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
    eq(DD.fromDays(z), want);
    eq(DD.toDays(want.y, want.m, want.d), z);
    eq(DD.weekday(want), t.getUTCDay());
  }
  eq(DD.fromDays(DD.toDays(1, 1, 1)), { y: 1, m: 1, d: 1 });
  eq(DD.fromDays(DD.toDays(9999, 12, 31)), { y: 9999, m: 12, d: 31 });
});
test('星期', () => {
  eq(DD.weekday(D('2026-10-19')), 1);
  eq(DD.weekday(D('2000-01-01')), 6);
  eq(DD.TEXT['zh-tw'].words(D('2026-10-19')), '2026 年 10 月 19 日（星期一）');
  eq(DD.TEXT.en.words(D('2026-10-19')), 'Monday, October 19, 2026');
  eq(DD.TEXT.en.words(D('2000-01-01')), 'Saturday, January 1, 2000');
});
test('相差天數：同月、跨月、跨年', () => {
  eq(DD.diff(D('2026-10-01'), D('2026-10-10')).days, 9);
  eq(DD.diff(D('2026-10-01'), D('2026-10-10'), true).days, 10);
  eq(DD.diff(D('2026-01-31'), D('2026-02-01')).days, 1);
  eq(DD.diff(D('2026-12-31'), D('2027-01-01')).days, 1);
  eq(DD.diff(D('2026-10-19'), D('2027-01-01')).days, 74);
  eq(DD.diff(D('2026-01-01'), D('2027-01-01')).days, 365);
  eq(DD.diff(D('2024-01-01'), D('2025-01-01')).days, 366);
});
test('相差天數：閏年 2 月', () => {
  eq(DD.diff(D('2024-02-28'), D('2024-03-01')).days, 2);
  eq(DD.diff(D('2026-02-28'), D('2026-03-01')).days, 1);
  eq(DD.diff(D('1900-02-28'), D('1900-03-01')).days, 1);
  eq(DD.diff(D('2000-02-28'), D('2000-03-01')).days, 2);
});
test('同一天與順序對調', () => {
  eq(DD.diff(D('2026-10-19'), D('2026-10-19')), { sign: 0, days: 0, weeks: 0, weekDays: 0, months: 0, monthDays: 0, years: 0, yearMonths: 0 });
  eq(DD.diff(D('2026-10-19'), D('2026-10-19'), true).days, 1);
  const fwd = DD.diff(D('2026-03-15'), D('2026-10-19'));
  const back = DD.diff(D('2026-10-19'), D('2026-03-15'));
  eq(back.sign, -1); eq(fwd.sign, 1);
  eq(Object.assign({}, back, { sign: 1 }), fwd);
  eq(DD.diff(D('2026-10-19'), D('2026-10-10'), true).days, 10);
});
test('週數', () => {
  const r = DD.diff(D('2026-10-19'), D('2027-01-01'));
  eq([r.weeks, r.weekDays], [10, 4]);
  const w = DD.diff(D('2026-10-19'), D('2026-11-02'));
  eq([w.weeks, w.weekDays], [2, 0]);
});
test('幾個月又幾天', () => {
  const md = (a, b, inc) => { const r = DD.diff(D(a), D(b), inc); return [r.months, r.monthDays]; };
  eq(md('2026-10-19', '2027-01-01'), [2, 13]);
  eq(md('2026-01-15', '2026-02-15'), [1, 0]);
  eq(md('2026-01-15', '2026-02-14'), [0, 30]);
  eq(md('2026-12-20', '2027-01-05'), [0, 16]);
  eq(md('2026-11-30', '2027-01-30'), [2, 0]);
  // Month-end clamp: 1/31 + 1 month is the last day of February.
  eq(md('2026-01-31', '2026-02-28'), [1, 0]);
  eq(md('2024-01-31', '2024-02-28'), [0, 28]);
  eq(md('2024-01-31', '2024-02-29'), [1, 0]);
  eq(md('2026-01-31', '2026-03-01'), [1, 1]);
  eq(md('2026-01-31', '2026-03-31'), [2, 0]);
  eq(md('2024-02-29', '2025-02-28'), [12, 0]);
  eq(md('2024-02-29', '2028-02-29'), [48, 0]);
  eq(md('2026-01-01', '2026-01-31', true), [1, 0]);
  eq(md('2026-10-19', '2026-03-15'), [7, 4]);
});
test('年月日', () => {
  const r = DD.diff(D('2020-05-10'), D('2026-10-19'));
  eq([r.years, r.yearMonths, r.monthDays], [6, 5, 9]);
});
test('月份加減', () => {
  eq(DD.addMonths(D('2026-01-31'), 1), { y: 2026, m: 2, d: 28 });
  eq(DD.addMonths(D('2024-01-31'), 1), { y: 2024, m: 2, d: 29 });
  eq(DD.addMonths(D('2026-11-15'), 3), { y: 2027, m: 2, d: 15 });
  eq(DD.addMonths(D('2026-01-15'), -1), { y: 2025, m: 12, d: 15 });
  eq(DD.addMonths(D('2026-03-31'), -1), { y: 2026, m: 2, d: 28 });
});
test('解析天數', () => {
  eq(DD.parseDays('30'), { n: 30 }); eq(DD.parseDays(' 30 '), { n: 30 });
  eq(DD.parseDays('-30'), { n: -30 }); eq(DD.parseDays('+7'), { n: 7 });
  eq(DD.parseDays('0'), { n: 0 }); eq(DD.parseDays('３０'), { n: 30 }); eq(DD.parseDays('－５'), { n: -5 });
  eq(DD.parseDays(''), { error: 'empty' }); eq(!!DD.parseDays('  ').error, true); eq(!!DD.parseDays(null).error, true);
  eq(DD.parseDays('1.5'), { error: 'integer' }); eq(!!DD.parseDays('abc').error, true); eq(!!DD.parseDays('3-').error, true);
});
test('加減天數', () => {
  const add = (a, n, c) => DD.iso(DD.addDays(D(a), n, c));
  eq(add('2026-10-19', 30), '2026-11-18');
  eq(add('2026-10-19', 30, true), '2026-11-17');
  eq(add('2026-10-19', 0), '2026-10-19');
  eq(add('2026-10-19', 0, true), '2026-10-19');
  eq(add('2026-10-19', 1, true), '2026-10-19');
  eq(add('2026-10-19', -1), '2026-10-18');
  eq(add('2026-10-19', -30), '2026-09-19');
  eq(add('2026-10-19', -30, true), '2026-09-20');
  eq(add('2026-12-31', 1), '2027-01-01');
  eq(add('2027-01-01', -1), '2026-12-31');
  eq(add('2024-02-28', 1), '2024-02-29');
  eq(add('2026-02-28', 1), '2026-03-01');
  eq(add('2024-03-01', -1), '2024-02-29');
  eq(add('2026-01-01', 365), '2027-01-01');
  eq(add('2024-01-01', 365), '2024-12-31');
  eq(add('2026-10-19', 280), '2027-07-26');
  eq(add('2026-10-19', 10000), '2054-03-06');
});
test('加減天數超出範圍', () => {
  eq(DD.addDays(D('9999-12-31'), 1), null);
  eq(DD.addDays(D('0001-01-01'), -1), null);
  eq(DD.iso(DD.addDays(D('9999-12-30'), 1)), '9999-12-31');
  eq(DD.addDays(D('2026-10-19'), 99999999), null);
});
test('民國年', () => { eq(DD.rocYear(2026), '民國 115 年'); eq(DD.rocYear(1912), '民國 1 年'); eq(DD.rocYear(1911), '民前 1 年'); });
test('英文頁的單複數', () => {
  const T = DD.TEXT.en;
  eq(T.days(1), '1 day'); eq(T.days(0), '0 days'); eq(T.weeks(1, 0), '1 week'); eq(T.weeks(2, 1), '2 weeks, 1 day');
  eq(T.months(1, 3), '1 month, 3 days'); eq(T.years(1, 0, 0), '1 year'); eq(T.years(2, 1, 1), '2 years, 1 month, 1 day');
  eq(T.how(D('2026-10-19'), 1, false), '1 day after Monday, October 19, 2026, not counting the start date');
  eq(T.how(D('2026-10-19'), -30, true), '30 days before Monday, October 19, 2026, counting the start date as day 1');
});
