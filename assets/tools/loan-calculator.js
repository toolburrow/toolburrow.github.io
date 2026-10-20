// Loan calculator / 貸款試算, shared by /zh-tw/ and /en/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// The monthly rate is the annual rate / 12, as Taiwan banks and most US lenders quote it.
// Amounts are kept unrounded; the page rounds them for display.
var LOAN = (function () {
  function clean(text) {
    return String(text == null ? '' : text).replace(/[\s,，]/g, '')
      .replace(/[０-９．％]/g, function (c) { return c === '．' ? '.' : c === '％' ? '%' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  }

  // Plain non-negative decimal: "1,000" -> 1000. Returns a number, or NaN when it isn't one.
  function num(text) {
    var s = clean(text).replace(/%$/, '');
    return /^(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
  }

  // Loan amount, already multiplied by the page's unit (10000 for 萬元). Returns { value } or { error: 'empty' | 'number' | 'zero' | 'big' }.
  function parseAmount(text, unit) {
    if (!clean(text)) return { error: 'empty' };
    var v = num(text);
    if (isNaN(v)) return { error: 'number' };
    v *= unit || 1;
    if (v <= 0) return { error: 'zero' };
    if (v > 1e11) return { error: 'big' };
    return { value: v };
  }

  // Percentage from 0 to max (default 30), e.g. an annual rate. Returns { value } or { error: 'empty' | 'rate' }.
  function parseRate(text, max) {
    if (!clean(text)) return { error: 'empty' };
    var v = num(text);
    if (isNaN(v) || v > (max || 30)) return { error: 'rate' };
    return { value: v };
  }

  // Whole years from min to max. Empty counts as `empty` (or as 0 when emptyIsZero). Returns { value } or { error }.
  function parseYears(text, min, max, emptyIsZero) {
    var s = clean(text);
    if (!s) return emptyIsZero ? { value: 0 } : { error: 'empty' };
    if (!/^\d+$/.test(s) || +s < min || +s > max) return { error: 'range' };
    return { value: +s };
  }

  // principal; ratePct: annual rate in %; months: whole term; grace: interest-only months at the start (< months);
  // method: 'annuity' (本息平均攤還, equal payments) or 'principal' (本金平均攤還, equal principal each month).
  // prepay (optional): { month, amount, mode } pays `amount` extra right after that month's payment.
  //   mode 'term' keeps the payment (or the monthly principal) and ends the loan early;
  //   mode 'payment' keeps the end date and spreads the lower balance over the months left.
  // Returns { rows: [{ month, payment, interest, principal, extra, balance }], totalInterest, totalPayment }.
  // payment is interest + principal; extra is the prepaid amount, so totalPayment = principal + totalInterest.
  function schedule(principal, ratePct, months, grace, method, prepay) {
    var r = ratePct / 1200, rows = [], balance = principal, totalInterest = 0;
    function level(bal, n) { return r === 0 ? bal / n : bal * r / (1 - Math.pow(1 + r, -n)); }
    var pmt = level(principal, months - grace), part = principal / (months - grace);
    for (var m = 1; m <= months && balance > 0; m++) {
      var interest = balance * r, paid, extra = 0;
      if (m <= grace) paid = 0;
      else if (m === months) paid = balance;   // last month clears what's left, so rounding never leaves a remainder
      else paid = Math.min(balance, method === 'principal' ? part : pmt - interest);
      balance -= paid;
      if (balance < principal * 1e-12) balance = 0;
      if (prepay && m === prepay.month) {
        extra = Math.min(prepay.amount, balance);
        balance -= extra;
        if (balance < principal * 1e-12) balance = 0;
        var left = months - Math.max(m, grace);
        if (prepay.mode === 'payment' && left > 0) { pmt = level(balance, left); part = balance / left; }
      }
      totalInterest += interest;
      rows.push({ month: m, payment: interest + paid, interest: interest, principal: paid, extra: extra, balance: balance });
    }
    return { rows: rows, totalInterest: totalInterest, totalPayment: principal + totalInterest };
  }

  // Sums the monthly rows into one row per year (the last year may be shorter).
  function byYear(rows) {
    var years = [];
    rows.forEach(function (x, i) {
      var y = Math.floor(i / 12);
      if (!years[y]) years[y] = { year: y + 1, payment: 0, interest: 0, principal: 0, balance: 0 };
      years[y].payment += x.payment + x.extra; years[y].interest += x.interest; years[y].principal += x.principal + x.extra; years[y].balance = x.balance;
    });
    return years;
  }

  // Compares a loan with and without one extra payment at the end of `year`. penaltyPct is charged on the amount prepaid.
  function prepayment(principal, ratePct, months, grace, method, year, amount, mode, penaltyPct) {
    var base = schedule(principal, ratePct, months, grace, method);
    var after = schedule(principal, ratePct, months, grace, method, { month: year * 12, amount: amount, mode: mode });
    var row = after.rows[year * 12 - 1], next = Math.max(year * 12, grace);   // index of the first payment that changes
    var penalty = row.extra * penaltyPct / 100, saved = base.totalInterest - after.totalInterest;
    return {
      mode: mode, year: year, balance: row.balance + row.extra, extra: row.extra, paidOff: row.balance === 0,
      saved: saved, penalty: penalty, net: saved - penalty,
      monthsBefore: months, monthsAfter: after.rows.length, monthsSaved: months - after.rows.length,
      before: base.rows[next].payment, after: after.rows[next] ? after.rows[next].payment : 0
    };
  }

  // 75 -> "6 年 3 個月"; "6 years 3 months" in English.
  function duration(n) {
    var y = Math.floor(n / 12), m = n % 12;
    return (y ? y + ' 年' : '') + (y && m ? ' ' : '') + (m ? m + ' 個月' : '') + (y || m ? '' : '0 個月');
  }
  function durationEn(n) {
    var y = Math.floor(n / 12), m = n % 12, p = function (v, w) { return v + ' ' + w + (v === 1 ? '' : 's'); };
    return y && m ? p(y, 'year') + ' ' + p(m, 'month') : y ? p(y, 'year') : p(m, 'month');
  }

  // Groups digits: 12345.6 -> "12,346" (decimals 0) or "12,345.60" (decimals 2).
  function money(v, decimals) {
    var s = (Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals)).toFixed(decimals);
    if (s === '-0' || /^-0\.0+$/.test(s)) s = s.slice(1);
    var p = s.split('.');
    return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (p[1] ? '.' + p[1] : '');
  }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    'zh-tw': {
      unit: 10000, decimals: 0,
      amountError: { empty: '請輸入貸款金額，例如 1000（萬元）。', number: '貸款金額只能輸入數字，例如 1000。',
        zero: '貸款金額要大於 0。', big: '金額太大了，請輸入 1000 億元以內的金額。' },
      rateError: { empty: '請輸入年利率，例如 2.2。', rate: '年利率請輸入 0 到 30 之間的數字，例如 2.2。' },
      yearsError: { empty: '請輸入貸款年限，例如 30。', range: '貸款年限請輸入 1 到 40 的整數。' },
      graceError: '寬限期請輸入 0 到 5 的整數，而且要比貸款年限短。',
      methods: { annuity: '本息平均攤還', principal: '本金平均攤還' },
      main: function (s, grace, method) {
        var first = s.rows[grace].payment, last = s.rows[s.rows.length - 1].payment;
        return method === 'principal' && Math.round(first) !== Math.round(last)
          ? '每月 ' + money(first, 0) + ' → ' + money(last, 0) + ' 元'
          : '每月 ' + money(first, 0) + ' 元';
      },
      sub: function (s, grace, method) {
        if (!grace) return method === 'principal' ? '第一個月繳最多，之後每月遞減' : '每月繳一樣的金額';
        return '寬限期 ' + grace / 12 + ' 年內每月只繳利息 ' + money(s.rows[0].payment, 0) + ' 元，' +
          (method === 'principal' ? '寬限期後從上面的金額逐月遞減' : '寬限期後每月繳上面的金額');
      },
      interestLabel: '總利息', totalLabel: '本息合計', otherLabel: '改用',
      other: function (name, diff) {
        return name + '：總利息' + (Math.round(diff) === 0 ? '一樣' : (diff < 0 ? '少 ' : '多 ') + money(Math.abs(diff), 0) + ' 元');
      },
      amount: function (v) { return money(v, 0) + ' 元'; },
      modes: { term: '縮短年限', payment: '降低月付' },
      prepayAmountError: { empty: '請輸入提前還款金額，例如 200（萬元）。', number: '提前還款金額只能輸入數字，例如 200。',
        zero: '提前還款金額要大於 0。', big: '金額太大了，請輸入 1000 億元以內的金額。' },
      prepayYearError: function (max) { return '提前還款時間請輸入 1 到 ' + max + ' 的整數（第幾年底），要比貸款年限短。'; },
      penaltyError: '違約金請輸入 0 到 10 之間的數字，例如 1，沒有就填 0。',
      prepayMain: function (p) {
        if (p.paidOff) return '第 ' + p.year + ' 年底一次還清';
        return p.mode === 'term' ? '提早 ' + duration(p.monthsSaved) + '還清' : '每月少繳 ' + money(p.before - p.after, 0) + ' 元';
      },
      prepaySub: function (p) {
        return '第 ' + p.year + ' 年底剩餘本金 ' + money(p.balance, 0) + ' 元，提前還 ' + money(p.extra, 0) + ' 元後剩 ' +
          money(p.balance - p.extra, 0) + ' 元';
      },
      savedLabel: '省下利息', penaltyLabel: '違約金', netLabel: '實際省下', endLabel: '還清時間', paymentLabel: '每月還款',
      end: function (p) { return duration(p.monthsBefore) + ' → ' + duration(p.monthsAfter); },
      payment: function (p) { return money(p.before, 0) + ' → ' + money(p.after, 0) + ' 元'; },
      head: ['年', '繳款', '本金', '利息', '剩餘本金'],
      year: function (y) { return String(y); }
    },
    en: {
      unit: 1, decimals: 2,
      amountError: { empty: 'Enter the loan amount, for example 300000.', number: 'The loan amount must be a number, for example 300000.',
        zero: 'The loan amount must be more than 0.', big: 'That amount is too large. Enter up to 100,000,000,000.' },
      rateError: { empty: 'Enter the annual interest rate, for example 6.5.', rate: 'Enter an annual rate from 0 to 30, for example 6.5.' },
      yearsError: { empty: 'Enter the loan term in years, for example 30.', range: 'Enter a loan term of 1 to 40 whole years.' },
      graceError: 'Enter an interest-only period of 0 to 5 whole years, shorter than the loan term.',
      methods: { annuity: 'Equal payments', principal: 'Equal principal' },
      main: function (s, grace, method) {
        var first = s.rows[grace].payment, last = s.rows[s.rows.length - 1].payment;
        return method === 'principal' && Math.round(first * 100) !== Math.round(last * 100)
          ? money(first, 2) + ' → ' + money(last, 2) + ' a month'
          : money(first, 2) + ' a month';
      },
      sub: function (s, grace, method) {
        var t = grace ? 'Interest only (' + money(s.rows[0].payment, 2) + ' a month) for the first ' +
          (grace === 12 ? 'year' : grace / 12 + ' years') + ', then ' : '';
        var rest = method === 'principal' ? 'the payment starts highest and falls every month' : 'the same payment every month';
        return grace ? t + rest : rest.charAt(0).toUpperCase() + rest.slice(1);
      },
      interestLabel: 'Total interest', totalLabel: 'Total paid', otherLabel: 'With',
      other: function (name, diff) {
        return name.toLowerCase() + ': ' + (Math.round(diff * 100) === 0 ? 'the same interest'
          : money(Math.abs(diff), 2) + (diff < 0 ? ' less' : ' more') + ' interest');
      },
      amount: function (v) { return money(v, 2); },
      modes: { term: 'Shorter term', payment: 'Lower payment' },
      prepayAmountError: { empty: 'Enter the extra payment, for example 50000.', number: 'The extra payment must be a number, for example 50000.',
        zero: 'The extra payment must be more than 0.', big: 'That amount is too large. Enter up to 100,000,000,000.' },
      prepayYearError: function (max) { return 'Enter when you pay it as a whole year from 1 to ' + max + ', before the end of the loan.'; },
      penaltyError: 'Enter a prepayment penalty from 0 to 10%, or 0 for none.',
      prepayMain: function (p) {
        if (p.paidOff) return 'Paid off at the end of year ' + p.year;
        return p.mode === 'term' ? 'Paid off ' + durationEn(p.monthsSaved) + ' sooner' : money(p.before - p.after, 2) + ' less a month';
      },
      prepaySub: function (p) {
        return 'Balance at the end of year ' + p.year + ': ' + money(p.balance, 2) + ', ' + money(p.balance - p.extra, 2) +
          ' after paying ' + money(p.extra, 2);
      },
      savedLabel: 'Interest saved', penaltyLabel: 'Penalty', netLabel: 'Net saving', endLabel: 'Loan length', paymentLabel: 'Monthly payment',
      end: function (p) { return durationEn(p.monthsBefore) + ' → ' + durationEn(p.monthsAfter); },
      payment: function (p) { return money(p.before, 2) + ' → ' + money(p.after, 2); },
      head: ['Year', 'Paid', 'Principal', 'Interest', 'Balance'],
      year: function (y) { return String(y); }
    }
  };

  return { parseAmount: parseAmount, parseRate: parseRate, parseYears: parseYears, schedule: schedule, byYear: byYear, prepayment: prepayment,
    duration: duration, durationEn: durationEn,
    money: money, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = LOAN;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = LOAN.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var method = 'annuity';

  var seg = $('method-seg');
  seg.innerHTML = ['annuity', 'principal'].map(function (m) {
    return '<button type="button" data-method="' + m + '" aria-pressed="' + (m === method) + '">' + T.methods[m] + '</button>';
  }).join('');
  seg.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    method = b.dataset.method;
    seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render();
  });

  var mode = 'term';
  var modeSeg = $('prepay-seg');
  modeSeg.innerHTML = ['term', 'payment'].map(function (m) {
    return '<button type="button" data-mode="' + m + '" aria-pressed="' + (m === mode) + '">' + T.modes[m] + '</button>';
  }).join('');
  modeSeg.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    mode = b.dataset.mode;
    modeSeg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render();
  });

  function fail(msg) {
    ['loan-result', 'prepay-result', 'year-result'].forEach(function (id) { $(id).innerHTML = '<p class="error">' + msg + '</p>'; });
  }

  // The prepayment panel, for a loan that is already valid.
  function renderPrepay(amount, rate, years, grace) {
    var out = $('prepay-result');
    var a = LOAN.parseAmount($('prepay-amount-input').value, T.unit);
    if (a.error) { out.innerHTML = '<p class="error">' + T.prepayAmountError[a.error] + '</p>'; return; }
    var y = LOAN.parseYears($('prepay-year-input').value, 1, years - 1);
    if (y.error) { out.innerHTML = '<p class="error">' + T.prepayYearError(years - 1) + '</p>'; return; }
    var pen = LOAN.parseRate($('penalty-input').value, 10);
    if (pen.error === 'empty') pen = { value: 0 };
    if (pen.error) { out.innerHTML = '<p class="error">' + T.penaltyError + '</p>'; return; }
    var p = LOAN.prepayment(amount, rate, years * 12, grace, method, y.value, a.value, mode, pen.value);
    var list = '<dt>' + T.savedLabel + '</dt><dd>' + T.amount(p.saved) + '</dd>';
    if (p.penalty) list += '<dt>' + T.penaltyLabel + '</dt><dd>' + T.amount(p.penalty) + '</dd>' +
      '<dt>' + T.netLabel + '</dt><dd>' + T.amount(p.net) + '</dd>';
    if (p.monthsSaved) list += '<dt>' + T.endLabel + '</dt><dd>' + T.end(p) + '</dd>';
    if (!p.paidOff && Math.abs(p.before - p.after) >= 0.005) list += '<dt>' + T.paymentLabel + '</dt><dd>' + T.payment(p) + '</dd>';
    out.innerHTML = '<div class="result-main">' + T.prepayMain(p) + '</div>' +
      '<div class="result-sub">' + T.prepaySub(p) + '</div><dl class="result-list">' + list + '</dl>';
  }

  function render() {
    $('loan-result').hidden = false;
    $('prepay-result').hidden = false;
    var a = LOAN.parseAmount($('amount-input').value, T.unit);
    if (a.error) return fail(T.amountError[a.error]);
    var r = LOAN.parseRate($('rate-input').value);
    if (r.error) return fail(T.rateError[r.error]);
    var y = LOAN.parseYears($('years-input').value, 1, 40);
    if (y.error) return fail(T.yearsError[y.error]);
    var g = LOAN.parseYears($('grace-input').value, 0, 5, true);
    if (g.error || g.value >= y.value) return fail(T.graceError);

    var months = y.value * 12, grace = g.value * 12, d = T.decimals;
    var s = LOAN.schedule(a.value, r.value, months, grace, method);
    var otherMethod = method === 'annuity' ? 'principal' : 'annuity';
    var o = LOAN.schedule(a.value, r.value, months, grace, otherMethod);
    $('loan-result').innerHTML = '<div class="result-main">' + T.main(s, grace, method) + '</div>' +
      '<div class="result-sub">' + T.sub(s, grace, method) + '</div>' +
      '<dl class="result-list">' +
      '<dt>' + T.interestLabel + '</dt><dd>' + T.amount(s.totalInterest) + '</dd>' +
      '<dt>' + T.totalLabel + '</dt><dd>' + T.amount(s.totalPayment) + '</dd>' +
      '<dt>' + T.otherLabel + '</dt><dd>' + T.other(T.methods[otherMethod], o.totalInterest - s.totalInterest) + '</dd>' +
      '</dl>';

    renderPrepay(a.value, r.value, y.value, grace);

    $('year-result').innerHTML = '<div class="table-scroll"><table><thead><tr>' +
      T.head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      LOAN.byYear(s.rows).map(function (x) {
        return '<tr><td>' + T.year(x.year) + '</td><td>' + LOAN.money(x.payment, d) + '</td><td>' + LOAN.money(x.principal, d) +
          '</td><td>' + LOAN.money(x.interest, d) + '</td><td>' + LOAN.money(x.balance, d) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  ['amount-input', 'rate-input', 'years-input', 'grace-input', 'prepay-amount-input', 'prepay-year-input', 'penalty-input'].forEach(function (id) { $(id).addEventListener('input', render); });
  render();
});
