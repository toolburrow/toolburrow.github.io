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

  // Annual rate in percent, 0 to 30. Returns { value } or { error: 'empty' | 'rate' }.
  function parseRate(text) {
    if (!clean(text)) return { error: 'empty' };
    var v = num(text);
    if (isNaN(v) || v > 30) return { error: 'rate' };
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
  // Returns { rows: [{ month, payment, interest, principal, balance }], totalInterest, totalPayment }.
  function schedule(principal, ratePct, months, grace, method) {
    var r = ratePct / 1200, n = months - grace, rows = [], balance = principal, totalInterest = 0;
    var pmt = r === 0 ? principal / n : principal * r / (1 - Math.pow(1 + r, -n));
    for (var m = 1; m <= months; m++) {
      var interest = balance * r, part;
      if (m <= grace) part = 0;
      else if (m === months) part = balance;   // last month clears what's left, so rounding never leaves a remainder
      else part = method === 'principal' ? principal / n : pmt - interest;
      balance -= part;
      totalInterest += interest;
      rows.push({ month: m, payment: interest + part, interest: interest, principal: part, balance: m === months ? 0 : balance });
    }
    return { rows: rows, totalInterest: totalInterest, totalPayment: principal + totalInterest };
  }

  // Sums the monthly rows into one row per year (the last year may be shorter).
  function byYear(rows) {
    var years = [];
    rows.forEach(function (x, i) {
      var y = Math.floor(i / 12);
      if (!years[y]) years[y] = { year: y + 1, payment: 0, interest: 0, principal: 0, balance: 0 };
      years[y].payment += x.payment; years[y].interest += x.interest; years[y].principal += x.principal; years[y].balance = x.balance;
    });
    return years;
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
      head: ['Year', 'Paid', 'Principal', 'Interest', 'Balance'],
      year: function (y) { return String(y); }
    }
  };

  return { parseAmount: parseAmount, parseRate: parseRate, parseYears: parseYears, schedule: schedule, byYear: byYear,
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

  function fail(msg) {
    $('loan-result').innerHTML = '<p class="error">' + msg + '</p>';
    $('year-result').innerHTML = '<p class="error">' + msg + '</p>';
  }

  function render() {
    $('loan-result').hidden = false;
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

    $('year-result').innerHTML = '<div class="table-scroll"><table><thead><tr>' +
      T.head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      LOAN.byYear(s.rows).map(function (x) {
        return '<tr><td>' + T.year(x.year) + '</td><td>' + LOAN.money(x.payment, d) + '</td><td>' + LOAN.money(x.principal, d) +
          '</td><td>' + LOAN.money(x.interest, d) + '</td><td>' + LOAN.money(x.balance, d) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  ['amount-input', 'rate-input', 'years-input', 'grace-input'].forEach(function (id) { $(id).addEventListener('input', render); });
  render();
});
