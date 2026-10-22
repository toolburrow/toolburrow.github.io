const PR = require('../assets/tools/parallel-resistor.js');
const near = (a, b, rel = 1e-9) => { if (Math.abs(a - b) > Math.abs(b) * rel + 1e-15) throw new Error(`expected ~${b}, got ${a}`); };

test('parallel resistor: totals', () => {
  near(PR.total('10k, 4.7k', 'parallel').total, 10000 * 4700 / 14700);
  near(PR.total('0.2, 1.8', 'parallel').total, 0.18);            // product over sum
  near(PR.total('10, 5.1, 5.1', 'parallel').total, 2.03187250996); // three in parallel
  eq(PR.total('10k, 10k', 'parallel').total, 5000);
  eq(PR.total('1k, 1k, 1k, 1k', 'parallel').total, 250);            // n equal resistors: R / n
  eq(PR.total('10k, 4k7, 220', 'series').total, 14920);
  eq(PR.total('1M, 2M2', 'series').total, 3200000);
});
test('parallel resistor: total is below the smallest resistor, shares add up to 100%', () => {
  for (let i = 0; i < 500; i++) {
    const vals = Array.from({ length: 2 + (i % 5) }, () => Math.round(Math.exp(Math.random() * 14)) + 1);
    const p = PR.total(vals.join(','), 'parallel');
    eq(p.total < Math.min(...vals), true);
    near(p.shares.reduce((a, b) => a + b, 0), 100, 1e-9);
    const s = PR.total(vals.join(','), 'series');
    near(s.shares.reduce((a, b) => a + b, 0), 100, 1e-9);
    near(s.total, vals.reduce((a, b) => a + b, 0));
  }
  const r = PR.total('1k, 3k', 'parallel');
  eq(r.shares, [75, 25]); // the smaller resistor carries more current
  eq(PR.total('1k, 3k', 'series').shares, [25, 75]);
});
test('parallel resistor: list parsing', () => {
  eq(PR.parseList('10k,4k7').values, [10000, 4700]);
  eq(PR.parseList('10k 4k7 R47').values, [10000, 4700, 0.47]);
  eq(PR.parseList('10 kΩ, 4.7 kΩ').values, [10000, 4700]);
  eq(PR.parseList('10k；4.7k、1M').values, [10000, 4700, 1000000]);
  eq(PR.parseList('10k + 10k').values, [10000, 10000]);
  eq(PR.parseList('10k // 10k').values, [10000, 10000]);
  eq(PR.parseList('10k || 10k').values, [10000, 10000]);
  eq(PR.parseList(' , ').error, 'list-empty');
  eq(PR.parseList('').error, 'list-empty');
  eq(PR.parseList('10k').error, 'list-one');
  eq(PR.parseList('10k, abc'), { error: 'list-format', item: 'abc' });
  eq(PR.parseList('10k, 4k7 x'), { error: 'list-format', item: 'x' });
  eq(PR.parseList('10k, 0'), { error: 'list-positive', item: '0' });
  eq(PR.parseList('10k, -1k'), { error: 'list-positive', item: '-1k' });
  eq(PR.parseList(Array(21).fill('1k').join(',')).error, 'list-many');
  eq(PR.parseList(Array(20).fill('1k').join(',')).values.length, 20);
});
test('parallel resistor: find the resistor to add', () => {
  const p = PR.missing('10k', '3.3k', 'parallel');
  near(p.exact, 1 / (1 / 3300 - 1 / 10000));
  eq(p.options.map(o => o.ohms), [4700, 5100]);
  eq(p.best, 1);
  near(p.options[0].total, 10000 * 4700 / 14700);
  const s = PR.missing('4.7k', '5k', 'series');
  eq(s.exact, 300); eq(s.options.map(o => o.ohms), [300]); eq(s.options[0].errorPct, 0);
  eq(PR.missing('10k', '5k', 'parallel').exact, 10000);
  eq(PR.missing('10k', '10k', 'parallel').error, 'parallel-too-high');
  eq(PR.missing('10k', '12k', 'parallel').error, 'parallel-too-high');
  eq(PR.missing('10k', '10k', 'series').error, 'series-too-low');
  eq(PR.missing('10k', '1k', 'series').error, 'series-too-low');
  eq(PR.missing('', '1k', 'series'), { error: 'resistance-empty', name: 'R1' });
  eq(PR.missing('1k', 'x', 'series'), { error: 'resistance-format', name: 'target' });
  // Adding the exact answer gives the target back.
  for (let i = 0; i < 500; i++) {
    const k = Math.round(Math.exp(Math.random() * 14)) + 2, t = k * (0.05 + Math.random() * 0.9);
    const r = PR.missing(String(k), String(t), 'parallel');
    near(PR.combine([k, r.exact], 'parallel'), t, 1e-8);
  }
});
test('parallel resistor: E24 pairs', () => {
  const p = PR.pairs('8k', 'parallel');
  eq([p.pairs[0].a, p.pairs[0].b, p.pairs[0].errorPct], [16000, 16000, 0]);
  eq(p.single, { ohms: 8200, errorPct: 2.5 });
  const s = PR.pairs('8k', 'series');
  eq([s.pairs[0].a, s.pairs[0].b], [3300, 4700]); // exact pairs: the closer-sized one first
  eq(PR.pairs('25', 'series').pairs[0].total, 25);
  eq(PR.pairs('4.7k', 'parallel').single, { ohms: 4700, errorPct: 0 });
  eq(PR.pairs('8k', 'parallel').pairs.length, 5);
  // Every pair is made of E24 values and is listed closest first.
  for (const t of ['1', '6.04k', '250', '1.234M', '10M', '33.3']) for (const m of ['parallel', 'series']) {
    const r = PR.pairs(t, m);
    for (const x of r.pairs) {
      eq(PR.E24_ALL.includes(x.a) && PR.E24_ALL.includes(x.b), true);
      near(x.total, PR.combine([x.a, x.b], m));
    }
    for (let i = 1; i < r.pairs.length; i++) eq(Math.abs(r.pairs[i].errorPct) >= Math.abs(r.pairs[i - 1].errorPct), true);
    eq(Math.abs(r.pairs[0].errorPct) < 1, true);
  }
  eq(PR.pairs('0.5', 'parallel').error, 'pair-range');
  eq(PR.pairs('20M', 'series').error, 'pair-range');
  eq(PR.pairs('', 'series').error, 'resistance-empty');
});
test('parallel resistor: error messages name the problem', () => {
  const msg = (r, lang = 'en') => PR.TEXT[lang].errors[r.error](r);
  eq(msg(PR.parseList('10k, abc')), '“abc” isn’t a resistance. Use values like 10k, 4k7, 220 or 1M, separated by commas.');
  eq(msg(PR.missing('', '1k', 'series'), 'zh-tw'), '請輸入手上的電阻，例如 10k。');
  eq(msg(PR.missing('1k', '', 'series'), 'zh-tw'), '請輸入想要的總阻值，例如 3.3k。');
});
