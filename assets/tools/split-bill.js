// Split bill calculator / 聚餐分帳, shared by /zh-tw/ and /en/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// Money is handled in whole cents and percentages in hundredths of a percent, so no floating-point rounding creeps in.
var SPLIT = (function () {
  var MAX_CENTS = 1e10;   // 100,000,000.00
  var MAX_PEOPLE = 1000;

  function clean(text) {
    return String(text == null ? '' : text).replace(/[\s,，]/g, '')
      .replace(/[０-９．％]/g, function (c) { return c === '．' ? '.' : c === '％' ? '%' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  }

  // "1,234.5" -> 123450 cents. Returns { cents } or { error: 'empty' | 'number' | 'decimals' | 'zero' | 'big' }.
  function parseAmount(text) {
    var s = clean(text);
    if (!s) return { error: 'empty' };
    var m = s.match(/^(\d*)(?:\.(\d*))?$/);
    if (!m || (!m[1] && !m[2])) return { error: 'number' };
    if (m[2] && m[2].length > 2) return { error: 'decimals' };
    var cents = Number(m[1] || '0') * 100 + Number(((m[2] || '') + '00').slice(0, 2));
    if (cents === 0) return { error: 'zero' };
    if (cents > MAX_CENTS) return { error: 'big' };
    return { cents: cents };
  }

  // Whole number of people, 1 to 1000. Returns { n } or { error: 'empty' | 'people' }.
  function parsePeople(text) {
    var s = clean(text);
    if (!s) return { error: 'empty' };
    if (!/^\d+$/.test(s) || +s < 1 || +s > MAX_PEOPLE) return { error: 'people' };
    return { n: +s };
  }

  // "10" or "12.5%" -> hundredths of a percent (1000, 1250). Empty means 0. Returns { h } or { error: 'percent' }.
  function parsePercent(text) {
    var s = clean(text).replace(/%$/, '');
    if (!s) return { h: 0 };
    var m = s.match(/^(\d*)(?:\.(\d{0,2}))?$/);
    if (!m || (!m[1] && !m[2])) return { error: 'percent' };
    var h = Number(m[1] || '0') * 100 + Number(((m[2] || '') + '00').slice(0, 2));
    if (h > 10000) return { error: 'percent' };
    return { h: h };
  }

  // a / d rounded half up, for non-negative integers.
  function roundDiv(a, d) { return Math.floor((2 * a + d) / (2 * d)); }

  // cents: the bill; pctH: service charge or tip in hundredths of a percent; people: head count;
  // minUnit: the smallest coin in cents (100 for NT$, 1 for cents); roundTo: what each person's share is rounded up to, in cents.
  // total = bill + service charge, rounded to minUnit.
  // fair: shares that add up to exactly the total, differing by at most one minUnit.
  // each: everyone pays the same amount, rounded up to roundTo; extra is what is collected beyond the total.
  function split(cents, pctH, people, minUnit, roundTo) {
    var total = roundDiv(cents * (10000 + pctH), 10000 * minUnit) * minUnit;
    var low = Math.floor(total / (people * minUnit)) * minUnit;
    var highCount = (total - low * people) / minUnit;
    var each = Math.ceil(total / (people * roundTo)) * roundTo;
    return {
      total: total, service: total - cents,
      average: total / people,
      fair: { low: low, lowCount: people - highCount, high: low + minUnit, highCount: highCount },
      each: each, collected: each * people, extra: each * people - total
    };
  }

  // 123456 cents -> "1,235" (no decimals) or "1,234.56".
  function money(cents, decimals) {
    var v = decimals ? (cents / 100).toFixed(2) : String(Math.round(cents / 100));
    return v.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  // Average share, shown with up to 2 decimals: 333.33, 250, 12.5 -> 12.50 when decimals is set.
  function average(cents, decimals) {
    var v = (Math.round(cents) / 100).toFixed(2);
    if (!decimals) v = v.replace(/\.?0+$/, '');
    var p = v.split('.');
    return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (p[1] ? '.' + p[1] : '');
  }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    'zh-tw': {
      minUnit: 100, roundTo: [100, 1000, 10000],
      roundLabel: function (u) { return u / 100 + ' 元'; },
      amountError: { empty: '請輸入總金額，例如 3280。', number: '總金額只能輸入數字，例如 3280。', decimals: '總金額最多到小數點後 2 位。',
        zero: '總金額要大於 0。', big: '金額太大了，請輸入 1 億以內的金額。' },
      peopleError: { empty: '請輸入人數，例如 4。', people: '人數請輸入 1 到 1000 的整數。' },
      percentError: '服務費請輸入 0 到 100 之間的數字，例如 10，最多小數點後 2 位。',
      main: function (r) { return '每人 ' + money(r.each, false) + ' 元'; },
      sub: function (r, people) {
        return '總共 ' + money(r.total, false) + ' 元' + (r.service ? '（含服務費 ' + money(r.service, false) + ' 元）' : '') +
          '，' + people + ' 人平均每人 ' + average(r.average, false) + ' 元';
      },
      collectLabel: '收款',
      collect: function (r, people) {
        return money(r.each, false) + ' 元 × ' + people + ' 人 = ' + money(r.collected, false) + ' 元' +
          (r.extra ? '，比總額多 ' + money(r.extra, false) + ' 元' : '，剛好收齊');
      },
      fairLabel: '剛好收齊',
      fair: function (f) {
        return f.highCount + ' 人付 ' + money(f.high, false) + ' 元，' + f.lowCount + ' 人付 ' + money(f.low, false) + ' 元';
      }
    },
    en: {
      minUnit: 1, roundTo: [1, 100, 500],
      roundLabel: function (u) { return u === 1 ? '0.01' : String(u / 100); },
      amountError: { empty: 'Enter the bill total, for example 86.40.', number: 'The bill total must be a number, for example 86.40.',
        decimals: 'Use at most 2 decimal places for the bill total.', zero: 'The bill total must be more than 0.',
        big: 'That amount is too large. Enter up to 100,000,000.' },
      peopleError: { empty: 'Enter the number of people, for example 4.', people: 'Enter a whole number of people from 1 to 1000.' },
      percentError: 'Enter a tip or service charge from 0 to 100, for example 15, with at most 2 decimal places.',
      main: function (r) { return money(r.each, true) + ' each'; },
      sub: function (r, people) {
        return 'Total ' + money(r.total, true) + (r.service ? ' including ' + money(r.service, true) + ' tip or service' : '') +
          ', ' + average(r.average, true) + ' each when split exactly ' + people + ' ways';
      },
      collectLabel: 'Collected',
      collect: function (r, people) {
        return money(r.each, true) + ' × ' + people + ' = ' + money(r.collected, true) +
          (r.extra ? ', ' + money(r.extra, true) + ' more than the total' : ', exactly the total');
      },
      fairLabel: 'Exact split',
      fair: function (f) {
        var who = function (n) { return n === 1 ? '1 person pays ' : n + ' people pay '; };
        return who(f.highCount) + money(f.high, true) + ', ' + who(f.lowCount) + money(f.low, true);
      }
    }
  };

  return { parseAmount: parseAmount, parsePeople: parsePeople, parsePercent: parsePercent, split: split,
    money: money, average: average, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = SPLIT;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = SPLIT.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var roundTo = T.roundTo[0];

  var seg = $('round-seg');
  seg.innerHTML = T.roundTo.map(function (u) {
    return '<button type="button" data-round="' + u + '" aria-pressed="' + (u === roundTo) + '">' + T.roundLabel(u) + '</button>';
  }).join('');
  seg.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    roundTo = Number(b.dataset.round);
    seg.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    render();
  });

  function render() {
    var out = $('split-result');
    out.hidden = false;
    var a = SPLIT.parseAmount($('amount-input').value);
    if (a.error) { out.innerHTML = '<p class="error">' + T.amountError[a.error] + '</p>'; return; }
    var p = SPLIT.parsePeople($('people-input').value);
    if (p.error) { out.innerHTML = '<p class="error">' + T.peopleError[p.error] + '</p>'; return; }
    var s = SPLIT.parsePercent($('percent-input').value);
    if (s.error) { out.innerHTML = '<p class="error">' + T.percentError + '</p>'; return; }
    var r = SPLIT.split(a.cents, s.h, p.n, T.minUnit, roundTo);
    var list = '<dt>' + T.collectLabel + '</dt><dd>' + T.collect(r, p.n) + '</dd>';
    if (r.fair.highCount) list += '<dt>' + T.fairLabel + '</dt><dd>' + T.fair(r.fair) + '</dd>';
    out.innerHTML = '<div class="result-main">' + T.main(r) + '</div>' +
      '<div class="result-sub">' + T.sub(r, p.n) + '</div>' +
      '<dl class="result-list">' + list + '</dl>';
  }

  ['amount-input', 'people-input', 'percent-input'].forEach(function (id) { $(id).addEventListener('input', render); });
  render();
});
