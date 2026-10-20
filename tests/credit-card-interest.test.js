const CC = require('../assets/tools/credit-card-interest.js');
const near = (a, b, tol) => { if (Math.abs(a - b) > (tol || 1e-6)) throw new Error(`expected ${b}, got ${a}`); };

test('card: parse inputs', () => {
  eq(CC.parseAmount('50,000'), { value: 50000 }); eq(CC.parseAmount('５０００'), { value: 5000 }); eq(CC.parseAmount('.5'), { value: 0.5 });
  eq(CC.parseAmount(''), { error: 'empty' }); eq(CC.parseAmount('0'), { error: 'zero' });
  ['-1', 'abc', '.', '1e3'].forEach(s => eq([s, CC.parseAmount(s)], [s, { error: 'number' }]));
  eq(CC.parseAmount('10000000000'), { value: 1e10 }); eq(CC.parseAmount('10000000000.5'), { error: 'big' });
  eq(CC.parsePercent('15', 100), { value: 15 }); eq(CC.parsePercent('15%', 100), { value: 15 }); eq(CC.parsePercent('0', 100), { value: 0 });
  eq(CC.parsePercent('', 100), { error: 'empty' }); eq(CC.parsePercent('', 50, true), { value: 0 });
  ['100.1', '-1', 'x'].forEach(s => eq([s, CC.parsePercent(s, 100)], [s, { error: 'percent' }]));
  eq(CC.parsePercent('51', 50), { error: 'percent' });
  eq(CC.parseCount('12'), { value: 12 }); eq(CC.parseCount(''), { error: 'empty' });
  ['1', '73', '2.5', 'a', '-3'].forEach(s => eq([s, CC.parseCount(s)], [s, { error: 'count' }]));
});

test('card: payoff months match the closed-form formula', () => {
  const closed = (B, a, P) => { const r = a / 1200; return Math.ceil(-Math.log(1 - B * r / P) / Math.log(1 + r) - 1e-9); };
  let seed = 5;
  const rnd = (n) => Math.floor((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 * n);
  for (let i = 0; i < 2000; i++) {
    const B = 100 + rnd(1e6), a = 1 + rnd(3000) / 100, P = B * a / 1200 * (1.05 + rnd(400) / 10);
    const x = CC.payoff(B, a, P);
    if (x.error) continue; // very slow payoffs hit the 100-year cap
    eq([B, a, P, x.months], [B, a, P, closed(B, a, P)]);
    near(x.totalPaid, P * (x.months - 1) + x.lastPayment, B * 1e-9);
    if (!(x.lastPayment > 0 && x.lastPayment <= P * (1 + 1e-9))) throw new Error('last payment out of range');
  }
});

test('card: payoff examples and errors', () => {
  const x = CC.payoff(50000, 15, 3000);
  eq([x.months, CC.money(x.totalInterest, 0), CC.money(x.lastPayment, 0), x.firstInterest], [19, '6,420', '2,420', 625]);
  const y = CC.payoff(5000, 22, 200);
  eq([y.months, CC.money(y.totalInterest, 2)], [34, '1,749.88']);
  const z = CC.payoff(1200, 0, 100);
  eq([z.months, z.totalInterest, z.lastPayment], [12, 0, 100]);
  eq(CC.payoff(50000, 15, 625), { error: 'never' });
  eq(CC.payoff(50000, 15, 600), { error: 'never' });
  eq(CC.payoff(1e6, 15, 12500.001), { error: 'long' });
  eq(CC.payoff(100, 15, 500).months, 1);
});

test('card: payment to clear a balance in n months', () => {
  near(CC.paymentFor(50000, 15, 12), 4512.9156, 1e-4);
  near(CC.paymentFor(1200, 0, 12), 100);
  const p = CC.paymentFor(8000, 19.9, 24);
  eq(CC.payoff(8000, 19.9, p * (1 + 1e-9)).months, 24);
});

test('card: installment fees as an annual rate', () => {
  const x = CC.installment(30000, 12, 3, 'spread');
  eq([x.fee, x.total, x.payments.length, x.payments[0]], [900, 30900, 12, 2575]);
  eq([CC.pct(x.apr), CC.pct(x.effective)], ['5.49', '5.63']);
  // the rate found makes the payments worth exactly the price
  const r = x.monthly; near(x.payments.reduce((t, p, i) => t + p / Math.pow(1 + r, i + 1), 0), 30000, 1e-6);
  const u = CC.installment(1200, 12, 3, 'upfront');
  eq([u.payments[0], u.payments[1]], [136, 100]);
  if (!(u.apr > CC.installment(1200, 12, 3, 'spread').apr)) throw new Error('an up-front fee costs more');
  const z = CC.installment(30000, 6, 0, 'spread');
  eq([z.apr, z.effective, z.fee, z.payments[0]], [0, 0, 0, 5000]);
  // the same fee over more months is a lower rate
  if (!(CC.installment(30000, 24, 3, 'spread').apr < x.apr)) throw new Error('longer plan must have a lower rate');
});

test('card: formatting', () => {
  eq([CC.pct(5.5), CC.pct(0), CC.pct(12.345), CC.pct(17.9)], ['5.5', '0', '12.35', '17.9']);
  eq([CC.duration(19), CC.duration(24), CC.durationEn(34), CC.durationEn(12)], ['1 年 7 個月', '2 年', '2 years 10 months', '1 year']);
  eq([CC.money(1234.5, 0), CC.money(1234.5, 2), CC.money(-1e-9, 2)], ['1,235', '1,234.50', '0.00']);
});
