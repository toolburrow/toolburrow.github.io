// Credit card interest calculator / 信用卡利息試算, shared by /zh-tw/ and /en/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// Revolving interest is charged monthly at APR / 12 on the balance left after each payment (banks count it daily,
// so a statement can differ slightly). Installment rates are the internal rate of return of the payments.
var CARD = (function () {
  var MAX_MONTHS = 1200;

  function clean(text) {
    return String(text == null ? '' : text).replace(/[\s,，]/g, '')
      .replace(/[０-９．％]/g, function (c) { return c === '．' ? '.' : c === '％' ? '%' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  }

  // Plain non-negative decimal: "1,000" -> 1000. Returns a number, or NaN when it isn't one.
  function num(text) {
    var s = clean(text).replace(/%$/, '');
    return /^(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
  }

  // Money above 0 and up to 1e10. Returns { value } or { error: 'empty' | 'number' | 'zero' | 'big' }.
  function parseAmount(text) {
    if (!clean(text)) return { error: 'empty' };
    var v = num(text);
    if (isNaN(v)) return { error: 'number' };
    if (v <= 0) return { error: 'zero' };
    if (v > 1e10) return { error: 'big' };
    return { value: v };
  }

  // Percentage from 0 to max. Empty counts as 0 when emptyIsZero. Returns { value } or { error: 'empty' | 'percent' }.
  function parsePercent(text, max, emptyIsZero) {
    if (!clean(text)) return emptyIsZero ? { value: 0 } : { error: 'empty' };
    var v = num(text);
    if (isNaN(v) || v > max) return { error: 'percent' };
    return { value: v };
  }

  // Whole number of installments, 2 to 72. Returns { value } or { error: 'empty' | 'count' }.
  function parseCount(text) {
    var s = clean(text);
    if (!s) return { error: 'empty' };
    if (!/^\d+$/.test(s) || +s < 2 || +s > 72) return { error: 'count' };
    return { value: +s };
  }

  // Paying a fixed amount every month on a balance. Each month interest is added, then the payment comes off.
  // Returns { months, totalInterest, totalPaid, lastPayment, firstInterest } or { error: 'never' | 'long' }.
  function payoff(balance, aprPct, payment) {
    var r = aprPct / 1200, bal = balance, totalInterest = 0;
    if (payment <= balance * r) return { error: 'never' };
    for (var m = 1; m <= MAX_MONTHS; m++) {
      var interest = bal * r;
      totalInterest += interest;
      if (bal + interest <= payment * (1 + 1e-12)) {
        return { months: m, totalInterest: totalInterest, totalPaid: balance + totalInterest,
          lastPayment: bal + interest, firstInterest: balance * r };
      }
      bal = bal + interest - payment;
    }
    return { error: 'long' };
  }

  // The fixed monthly payment that clears a balance in `months`.
  function paymentFor(balance, aprPct, months) {
    var r = aprPct / 1200;
    return r === 0 ? balance / months : balance * r / (1 - Math.pow(1 + r, -months));
  }

  // An installment plan on `price` over n months with a fee of feePct % of the price, either spread evenly over the
  // payments ('spread') or charged with the first payment ('upfront').
  // Returns { payments: [..], fee, total, monthly: rate per month, apr: monthly × 12 in %, effective: compounded yearly in % }.
  function installment(price, n, feePct, when) {
    var fee = price * feePct / 100, payments = [];
    for (var i = 0; i < n; i++) payments.push(when === 'upfront' ? price / n + (i === 0 ? fee : 0) : (price + fee) / n);
    // Present value of the payments at monthly rate r; it falls as r rises, so bisection finds where it equals the price.
    var pv = function (r) { return payments.reduce(function (t, p, i) { return t + p / Math.pow(1 + r, i + 1); }, 0); };
    var lo = 0, hi = 1;
    if (fee > 0) for (var k = 0; k < 200; k++) { var mid = (lo + hi) / 2; if (pv(mid) > price) lo = mid; else hi = mid; }
    var monthly = fee > 0 ? (lo + hi) / 2 : 0;
    return { payments: payments, fee: fee, total: price + fee, monthly: monthly,
      apr: monthly * 1200, effective: (Math.pow(1 + monthly, 12) - 1) * 100 };
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
    if (/^-0(\.0+)?$/.test(s)) s = s.slice(1);
    var p = s.split('.');
    return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (p[1] ? '.' + p[1] : '');
  }
  // Percent with 2 decimals, trailing zeros dropped: 5.50 -> "5.5", 0 -> "0".
  function pct(v) { return (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, ''); }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    'zh-tw': {
      balanceError: { empty: '請輸入帳款金額，例如 50000。', number: '帳款金額只能輸入數字，例如 50000。',
        zero: '帳款金額要大於 0。', big: '金額太大了，請輸入 100 億以內的金額。' },
      rateError: '年利率請輸入 0 到 100 之間的數字，例如 15。',
      paymentError: { empty: '請輸入每月繳款金額，例如 3000。', number: '每月繳款只能輸入數字，例如 3000。',
        zero: '每月繳款要大於 0。', big: '金額太大了，請輸入 100 億以內的金額。' },
      never: function (interest) { return '每月繳的錢不夠付利息（第一個月利息就有 ' + money(interest, 0) + ' 元），永遠還不完，請提高每月繳款。'; },
      long: '照這個金額要繳超過 100 年，請提高每月繳款。',
      payoffMain: function (p) { return duration(p.months) + '還清'; },
      payoffSub: function (p) { return '總共繳 ' + money(p.totalPaid, 0) + ' 元，其中利息 ' + money(p.totalInterest, 0) + ' 元'; },
      firstLabel: '第一個月利息', lastLabel: '最後一期繳',
      targetLabel: function (n) { return n + ' 個月還清'; },
      target: function (pay, interest) { return '每月 ' + money(pay, 0) + ' 元，利息 ' + money(interest, 0) + ' 元'; },
      amount: function (v) { return money(v, 0) + ' 元'; },
      priceError: { empty: '請輸入分期金額，例如 30000。', number: '分期金額只能輸入數字，例如 30000。',
        zero: '分期金額要大於 0。', big: '金額太大了，請輸入 100 億以內的金額。' },
      countError: { empty: '請輸入期數，例如 12。', count: '期數請輸入 2 到 72 的整數。' },
      feeError: '手續費率請輸入 0 到 50 之間的數字，例如 3，0 利率免手續費就填 0。',
      when: { spread: '平均攤入每期', upfront: '第一期一次收' },
      instMain: function (x) { return x.fee ? '年利率約 ' + pct(x.apr) + '%' : '0 利率，沒有手續費'; },
      instSub: function (x, n, when) {
        return when === 'upfront' && x.fee
          ? '第一期 ' + money(x.payments[0], 0) + ' 元，之後每期 ' + money(x.payments[1], 0) + ' 元，共 ' + n + ' 期'
          : '每期 ' + money(x.payments[0], 0) + ' 元，共 ' + n + ' 期';
      },
      feeLabel: '手續費', totalLabel: '總共付', effectiveLabel: '實質年利率',
      effective: function (x) { return pct(x.effective) + '%（利息再滾利息）'; }
    },
    en: {
      balanceError: { empty: 'Enter the card balance, for example 5000.', number: 'The balance must be a number, for example 5000.',
        zero: 'The balance must be more than 0.', big: 'That amount is too large. Enter up to 10,000,000,000.' },
      rateError: 'Enter an APR from 0 to 100, for example 22.',
      paymentError: { empty: 'Enter the monthly payment, for example 200.', number: 'The monthly payment must be a number, for example 200.',
        zero: 'The monthly payment must be more than 0.', big: 'That amount is too large. Enter up to 10,000,000,000.' },
      never: function (interest) { return 'This payment does not cover the interest (' + money(interest, 2) + ' in the first month), so the balance never goes down. Pay more each month.'; },
      long: 'At this payment it would take more than 100 years. Pay more each month.',
      payoffMain: function (p) { return 'Paid off in ' + durationEn(p.months); },
      payoffSub: function (p) { return 'You pay ' + money(p.totalPaid, 2) + ' in total, ' + money(p.totalInterest, 2) + ' of it interest'; },
      firstLabel: 'First month’s interest', lastLabel: 'Last payment',
      targetLabel: function (n) { return 'Paid off in ' + n + ' months'; },
      target: function (pay, interest) { return money(pay, 2) + ' a month, ' + money(interest, 2) + ' interest'; },
      amount: function (v) { return money(v, 2); },
      priceError: { empty: 'Enter the purchase amount, for example 1200.', number: 'The purchase amount must be a number, for example 1200.',
        zero: 'The purchase amount must be more than 0.', big: 'That amount is too large. Enter up to 10,000,000,000.' },
      countError: { empty: 'Enter the number of payments, for example 12.', count: 'Enter a whole number of payments from 2 to 72.' },
      feeError: 'Enter a fee from 0 to 50%, for example 3, or 0 for no fee.',
      when: { spread: 'Spread over payments', upfront: 'Charged up front' },
      instMain: function (x) { return x.fee ? 'APR about ' + pct(x.apr) + '%' : '0% interest, no fee'; },
      instSub: function (x, n, when) {
        return when === 'upfront' && x.fee
          ? 'First payment ' + money(x.payments[0], 2) + ', then ' + money(x.payments[1], 2) + ' a month, ' + n + ' payments'
          : money(x.payments[0], 2) + ' a month, ' + n + ' payments';
      },
      feeLabel: 'Fee', totalLabel: 'Total paid', effectiveLabel: 'Effective annual rate',
      effective: function (x) { return pct(x.effective) + '% (compounded)'; }
    }
  };

  return { parseAmount: parseAmount, parsePercent: parsePercent, parseCount: parseCount, payoff: payoff,
    paymentFor: paymentFor, installment: installment, duration: duration, durationEn: durationEn, money: money, pct: pct,
    TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = CARD;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = CARD.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var error = function (out, msg) { out.innerHTML = '<p class="error">' + msg + '</p>'; };

  function renderPayoff() {
    var out = $('payoff-result');
    out.hidden = false;
    var b = CARD.parseAmount($('balance-input').value);
    if (b.error) return error(out, T.balanceError[b.error]);
    var r = CARD.parsePercent($('apr-input').value, 100);
    if (r.error) return error(out, T.rateError);
    var p = CARD.parseAmount($('payment-input').value);
    if (p.error) return error(out, T.paymentError[p.error]);
    var x = CARD.payoff(b.value, r.value, p.value);
    if (x.error) return error(out, x.error === 'never' ? T.never(b.value * r.value / 1200) : T.long);
    var list = '<dt>' + T.firstLabel + '</dt><dd>' + T.amount(x.firstInterest) + '</dd>' +
      '<dt>' + T.lastLabel + '</dt><dd>' + T.amount(x.lastPayment) + '</dd>';
    [6, 12, 24].forEach(function (n) {
      var pay = CARD.paymentFor(b.value, r.value, n);
      list += '<dt>' + T.targetLabel(n) + '</dt><dd>' + T.target(pay, pay * n - b.value) + '</dd>';
    });
    out.innerHTML = '<div class="result-main">' + T.payoffMain(x) + '</div>' +
      '<div class="result-sub">' + T.payoffSub(x) + '</div><dl class="result-list">' + list + '</dl>';
  }

  var when = 'spread';
  var seg = $('when-seg');
  seg.innerHTML = ['spread', 'upfront'].map(function (w) {
    return '<button type="button" data-when="' + w + '" aria-pressed="' + (w === when) + '">' + T.when[w] + '</button>';
  }).join('');
  seg.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    when = b.dataset.when;
    seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    renderInstallment();
  });

  function renderInstallment() {
    var out = $('installment-result');
    out.hidden = false;
    var a = CARD.parseAmount($('price-input').value);
    if (a.error) return error(out, T.priceError[a.error]);
    var n = CARD.parseCount($('count-input').value);
    if (n.error) return error(out, T.countError[n.error]);
    var f = CARD.parsePercent($('fee-input').value, 50, true);
    if (f.error) return error(out, T.feeError);
    var x = CARD.installment(a.value, n.value, f.value, when);
    var list = '<dt>' + T.feeLabel + '</dt><dd>' + T.amount(x.fee) + '</dd>' +
      '<dt>' + T.totalLabel + '</dt><dd>' + T.amount(x.total) + '</dd>';
    if (x.fee) list += '<dt>' + T.effectiveLabel + '</dt><dd>' + T.effective(x) + '</dd>';
    out.innerHTML = '<div class="result-main">' + T.instMain(x) + '</div>' +
      '<div class="result-sub">' + T.instSub(x, n.value, when) + '</div><dl class="result-list">' + list + '</dl>';
  }

  ['balance-input', 'apr-input', 'payment-input'].forEach(function (id) { $(id).addEventListener('input', renderPayoff); });
  ['price-input', 'count-input', 'fee-input'].forEach(function (id) { $(id).addEventListener('input', renderInstallment); });
  renderPayoff();
  renderInstallment();
});
