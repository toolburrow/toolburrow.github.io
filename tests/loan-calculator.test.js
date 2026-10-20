const LN = require('../assets/tools/loan-calculator.js');
const near = (a, b, tol) => { if (Math.abs(a - b) > (tol || 1e-6)) throw new Error(`expected ${b}, got ${a}`); };

test('loan: parse amount, rate and years', () => {
  eq(LN.parseAmount('1000', 10000), { value: 1e7 });
  eq(LN.parseAmount('１,２００．５', 10000), { value: 12005000 });
  eq(LN.parseAmount('300,000', 1), { value: 300000 });
  eq(LN.parseAmount('.5', 1), { value: 0.5 });
  eq(LN.parseAmount('', 1), { error: 'empty' }); eq(LN.parseAmount('  ', 1), { error: 'empty' });
  ['-5', 'abc', '.', '1e5', '1.2.3'].forEach(s => eq([s, LN.parseAmount(s, 1)], [s, { error: 'number' }]));
  eq(LN.parseAmount('0', 1), { error: 'zero' }); eq(LN.parseAmount('0.00', 10000), { error: 'zero' });
  eq(LN.parseAmount('10000000', 10000), { value: 1e11 }); eq(LN.parseAmount('10000000.01', 10000), { error: 'big' });
  eq(LN.parseRate('2.2'), { value: 2.2 }); eq(LN.parseRate('1.775%'), { value: 1.775 }); eq(LN.parseRate('０'), { value: 0 });
  eq(LN.parseRate('30'), { value: 30 }); eq(LN.parseRate(''), { error: 'empty' });
  ['30.01', '-1', 'x', '%'].forEach(s => eq([s, LN.parseRate(s)], [s, { error: 'rate' }]));
  eq(LN.parseYears('30', 1, 40), { value: 30 }); eq(LN.parseYears('', 1, 40), { error: 'empty' });
  eq(LN.parseYears('', 0, 5, true), { value: 0 }); eq(LN.parseYears('3', 0, 5, true), { value: 3 });
  ['0', '41', '2.5', '-1', 'a'].forEach(s => eq([s, LN.parseYears(s, 1, 40)], [s, { error: 'range' }]));
  eq(LN.parseYears('6', 0, 5, true), { error: 'range' });
});

test('loan: equal payments match published amortization values', () => {
  const a = LN.schedule(1e6, 2, 240, 0, 'annuity');
  eq(LN.money(a.rows[0].payment, 2), '5,058.83');
  eq(LN.money(a.totalInterest, 0), '214,120');
  const b = LN.schedule(300000, 6.5, 360, 0, 'annuity');
  eq(LN.money(b.rows[0].payment, 2), '1,896.20');
  eq(LN.money(b.totalInterest, 2), '382,633.47');
  const c = LN.schedule(200000, 5, 180, 0, 'annuity');
  eq(LN.money(c.rows[0].payment, 2), '1,581.59');
  // every month pays the same, and the first month's interest is balance × rate / 12
  near(b.rows[0].interest, 1625); near(b.rows[359].payment, b.rows[0].payment, 1e-6);
});

test('loan: equal principal', () => {
  const s = LN.schedule(1.2e6, 3, 120, 0, 'principal');
  near(s.rows[0].payment, 13000); near(s.rows[119].payment, 10025);
  s.rows.forEach(x => near(x.principal, 10000, 1e-6));
  near(s.totalInterest, 1.2e6 * 0.0025 * 121 / 2, 1e-4); // P × r × (n + 1) / 2
  for (let i = 1; i < 120; i++) if (!(s.rows[i].payment < s.rows[i - 1].payment)) throw new Error('payment must fall every month');
});

test('loan: zero interest', () => {
  const a = LN.schedule(120000, 0, 12, 0, 'annuity');
  a.rows.forEach(x => { near(x.payment, 10000); eq(x.interest, 0); });
  eq(a.totalInterest, 0); eq(a.totalPayment, 120000);
  const p = LN.schedule(120000, 0, 24, 12, 'principal');
  eq(p.rows[0].payment, 0); near(p.rows[12].payment, 10000);
});

test('loan: grace period pays interest only', () => {
  const s = LN.schedule(1e7, 2.4, 360, 36, 'annuity');
  for (let i = 0; i < 36; i++) { near(s.rows[i].payment, 20000); eq(s.rows[i].principal, 0); near(s.rows[i].balance, 1e7); }
  // after the grace period it is a 27-year loan on the full amount
  const rest = LN.schedule(1e7, 2.4, 324, 0, 'annuity');
  near(s.rows[36].payment, rest.rows[0].payment, 1e-6);
  near(s.totalInterest, 36 * 20000 + rest.totalInterest, 1e-3);
  if (!(s.totalInterest > LN.schedule(1e7, 2.4, 360, 0, 'annuity').totalInterest)) throw new Error('grace must cost more interest');
});

test('loan: yearly totals', () => {
  const s = LN.schedule(1e6, 2, 240, 0, 'annuity');
  const y = LN.byYear(s.rows);
  eq(y.length, 20); eq(y[0].year, 1); eq(y[19].balance, 0);
  near(y[0].payment, 12 * s.rows[0].payment, 1e-6);
  near(y.reduce((t, x) => t + x.principal, 0), 1e6, 1e-6);
  near(y.reduce((t, x) => t + x.interest, 0), s.totalInterest, 1e-6);
  near(y[0].balance, s.rows[11].balance);
});

test('loan: money formatting', () => {
  eq(LN.money(1234567.891, 0), '1,234,568'); eq(LN.money(1234567.891, 2), '1,234,567.89');
  eq(LN.money(0, 2), '0.00'); eq(LN.money(-1e-9, 0), '0'); eq(LN.money(-1e-9, 2), '0.00'); eq(LN.money(999.995, 2), '1,000.00');
});

test('loan: random loans always pay off exactly', () => {
  let seed = 11;
  const rnd = (n) => Math.floor((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 * n);
  for (let i = 0; i < 2000; i++) {
    const P = 1000 + rnd(1e8), rate = rnd(3001) / 100, years = 1 + rnd(40), grace = Math.min(rnd(6), years - 1) * 12;
    const method = ['annuity', 'principal'][rnd(2)];
    const s = LN.schedule(P, rate, years * 12, grace, method);
    eq(s.rows.length, years * 12); eq(s.rows[s.rows.length - 1].balance, 0);
    const paidPrincipal = s.rows.reduce((t, x) => t + x.principal, 0);
    near(paidPrincipal, P, P * 1e-9);
    near(s.totalPayment, s.rows.reduce((t, x) => t + x.payment, 0), P * 1e-9);
    s.rows.forEach(x => { if (x.principal < -1e-6 || x.balance < -1e-6 * P) throw new Error('negative principal or balance'); });
    if (method === 'annuity') near(s.rows[s.rows.length - 1].payment, s.rows[grace].payment, P * 1e-9);
  }
});

test('loan: prepay and keep the term = a new loan on the balance left', () => {
  const s = LN.schedule(1e7, 2.2, 360, 0, 'annuity', { month: 60, amount: 2e6, mode: 'payment' });
  const left = s.rows[59].balance;
  near(s.rows[59].extra, 2e6); eq(s.rows.length, 360);
  const fresh = LN.schedule(left, 2.2, 300, 0, 'annuity');
  near(s.rows[60].payment, fresh.rows[0].payment, 1e-6);
  near(s.totalInterest, s.rows.slice(0, 60).reduce((t, x) => t + x.interest, 0) + fresh.totalInterest, 1e-3);
  const p = LN.schedule(1.2e6, 3, 120, 0, 'principal', { month: 24, amount: 240000, mode: 'payment' });
  near(p.rows[24].principal, (1.2e6 - 240000 - 240000) / 96, 1e-6); // 24 months of 10,000 paid, then 240,000 extra
});

test('loan: prepay and keep the payment ends the loan early', () => {
  const s = LN.schedule(1e7, 2.2, 360, 0, 'annuity', { month: 60, amount: 2e6, mode: 'term' });
  eq(s.rows.length, 276);
  near(s.rows[60].payment, s.rows[0].payment, 1e-6); near(s.rows[274].payment, s.rows[0].payment, 1e-6);
  if (!(s.rows[275].payment <= s.rows[0].payment)) throw new Error('last payment must not exceed the regular one');
  const p = LN.schedule(1.2e6, 3, 120, 0, 'principal', { month: 24, amount: 240000, mode: 'term' });
  eq(p.rows.length, 96); near(p.rows[24].principal, 10000);
});

test('loan: prepayment summary', () => {
  const p = LN.prepayment(1e7, 2.2, 360, 0, 'annuity', 5, 2e6, 'term', 1);
  eq([p.monthsAfter, p.monthsSaved, p.paidOff], [276, 84, false]);
  near(p.penalty, 20000); near(p.net, p.saved - 20000);
  const base = LN.schedule(1e7, 2.2, 360, 0, 'annuity');
  near(p.saved, base.totalInterest - LN.schedule(1e7, 2.2, 360, 0, 'annuity', { month: 60, amount: 2e6, mode: 'term' }).totalInterest);
  near(p.balance, base.rows[59].balance, 1e-6);
  const q = LN.prepayment(1e7, 2.2, 360, 0, 'annuity', 5, 2e6, 'payment', 0);
  eq([q.monthsSaved, q.penalty], [0, 0]);
  if (!(q.after < q.before && q.saved > 0 && q.saved < p.saved)) throw new Error('keeping the payment must save more interest');
  // more than the balance pays the loan off, and the penalty applies only to what was owed
  const all = LN.prepayment(1e6, 2, 240, 0, 'annuity', 5, 5e6, 'term', 1);
  eq([all.paidOff, all.monthsAfter], [true, 60]); near(all.extra, all.balance); near(all.penalty, all.balance / 100);
  // during a grace period the first changed payment is the first one after it
  const g = LN.prepayment(1e7, 2.2, 360, 36, 'annuity', 2, 2e6, 'payment', 0);
  near(g.after, LN.schedule(8e6, 2.2, 324, 0, 'annuity').rows[0].payment, 1e-6);
});

test('loan: durations', () => {
  eq([LN.duration(75), LN.duration(12), LN.duration(5), LN.duration(0)], ['6 年 3 個月', '1 年', '5 個月', '0 個月']);
  eq([LN.durationEn(13), LN.durationEn(24), LN.durationEn(1), LN.durationEn(0)], ['1 year 1 month', '2 years', '1 month', '0 months']);
});

test('loan: random prepayments still repay exactly the principal', () => {
  let seed = 23;
  const rnd = (n) => Math.floor((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 * n);
  for (let i = 0; i < 2000; i++) {
    const P = 1000 + rnd(1e8), rate = rnd(3001) / 100, years = 2 + rnd(39), grace = Math.min(rnd(6), years - 1) * 12;
    const method = ['annuity', 'principal'][rnd(2)], mode = ['term', 'payment'][rnd(2)];
    const month = 12 * (1 + rnd(years - 1)), amount = 1 + rnd(P);
    const s = LN.schedule(P, rate, years * 12, grace, method, { month, amount, mode });
    if (s.rows.length > years * 12) throw new Error('prepaying must never lengthen the loan');
    eq(s.rows[s.rows.length - 1].balance, 0);
    near(s.rows.reduce((t, x) => t + x.principal + x.extra, 0), P, P * 1e-9);
    if (!(s.totalInterest <= LN.schedule(P, rate, years * 12, grace, method).totalInterest + P * 1e-9)) throw new Error('prepaying must not add interest');
  }
});
