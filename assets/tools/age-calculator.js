// Age calculator / 年齡計算, shared by /zh-tw/ and /en/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// Dates are plain { y, m, d } objects; day arithmetic uses a day count, never Date, so time zones and DST can't shift results.
var AGE = (function () {
  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

  function daysInMonth(y, m) { return m === 2 ? (isLeap(y) ? 29 : 28) : [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }

  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }

  // Days since 1970-01-01 in the proleptic Gregorian calendar (H. Hinnant's days_from_civil).
  function toDays(y, m, d) {
    y -= m <= 2 ? 1 : 0;
    var era = Math.floor(y / 400);
    var yoe = y - era * 400;
    var doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;
  }

  function dayNum(a) { return toDays(a.y, a.m, a.d); }

  // "2026-10-19" (what <input type="date"> gives) or "2026/10/19". Returns null if empty or not a real day.
  function parseDate(text) {
    var m = String(text == null ? '' : text).trim().match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1 || mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
    return { y: y, m: mo, d: d };
  }

  // Same day-of-month n months later; clamps to the month's last day, so a February 29 birthday is February 28
  // in other years (the Taiwan Civil Code, article 121, rule for a missing day).
  function addMonths(a, n) {
    var t = a.y * 12 + (a.m - 1) + n;
    var y = Math.floor(t / 12), m = t - y * 12 + 1;
    return { y: y, m: m, d: Math.min(a.d, daysInMonth(y, m)) };
  }

  function weekday(a) { return ((dayNum(a) + 4) % 7 + 7) % 7; } // 1970-01-01 was a Thursday

  function iso(a) { return pad(a.y, 4) + '-' + pad(a.m, 2) + '-' + pad(a.d, 2); }

  // Age of someone born on `birth`, on the day `on`. Returns { error: 'future' } if birth is after `on`.
  // years/months/days: completed years, then completed months, then leftover days.
  // next: the next birthday after `on` (today's date when `on` is the birthday itself, with isBirthday true).
  function age(birth, on) {
    var b = dayNum(birth), t = dayNum(on);
    if (b > t) return { error: 'future' };
    var months = (on.y - birth.y) * 12 + (on.m - birth.m);
    if (dayNum(addMonths(birth, months)) > t) months--;
    var years = Math.floor(months / 12);
    var days = t - dayNum(addMonths(birth, months));
    var isBirthday = years > 0 && months % 12 === 0 && days === 0;
    var nextYears = isBirthday ? years : years + 1;
    var next = addMonths(birth, nextYears * 12);
    return {
      years: years, months: months % 12, days: days,
      totalMonths: months, totalDays: t - b, totalWeeks: Math.floor((t - b) / 7),
      isBirthday: isBirthday, next: next, nextAge: nextYears, daysToNext: dayNum(next) - t,
      // Traditional 虛歲 by calendar year: 1 in the birth year, plus 1 every January 1.
      nominal: on.y - birth.y + 1
    };
  }

  function rocBirthYear(y) { return y >= 1912 ? '民國 ' + (y - 1911) + ' 年次' : '民前 ' + (1912 - y) + ' 年'; }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    'zh-tw': {
      copy: '複製', copied: '已複製',
      pickBirth: '請選擇出生日期。', pickOn: '請選擇要計算到哪一天。',
      future: '出生日期在計算日期之後，請檢查年份。',
      main: function (r) { return r.years + ' 歲'; },
      detail: function (r) { return r.years + ' 歲 ' + r.months + ' 個月 ' + r.days + ' 天'; },
      words: function (a) { return a.y + ' 年 ' + a.m + ' 月 ' + a.d + ' 日（星期' + '日一二三四五六'[weekday(a)] + '）'; },
      nextLabel: '下次生日',
      next: function (r) {
        if (r.isBirthday) return '就是今天，生日快樂！';
        return this.words(r.next) + '，還有 ' + r.daysToNext + ' 天，滿 ' + r.nextAge + ' 歲';
      },
      monthsLabel: '總共', months: function (r) { return num(r.totalMonths) + ' 個月，' + num(r.totalWeeks) + ' 週，' + num(r.totalDays) + ' 天'; },
      nominalLabel: '虛歲', nominal: function (r) { return r.nominal + ' 歲（以國曆年計算）'; },
      rocLabel: '出生年', roc: function (birth) { return rocBirthYear(birth.y); }
    },
    en: {
      copy: 'Copy', copied: 'Copied',
      pickBirth: 'Pick a date of birth.', pickOn: 'Pick the date to calculate the age on.',
      future: 'The date of birth is after the age-on date. Check the year.',
      main: function (r) { return plural(r.years, 'year') + ' old'; },
      detail: function (r) { return plural(r.years, 'year') + ', ' + plural(r.months, 'month') + ', ' + plural(r.days, 'day'); },
      words: function (a) { return DAYS_EN[weekday(a)] + ', ' + MONTHS[a.m - 1] + ' ' + a.d + ', ' + a.y; },
      nextLabel: 'Next birthday',
      next: function (r) {
        if (r.isBirthday) return 'Today. Happy birthday!';
        return this.words(r.next) + ', in ' + plural(r.daysToNext, 'day') + ' (turns ' + r.nextAge + ')';
      },
      monthsLabel: 'In total', months: function (r) { return plural(r.totalMonths, 'month') + ', ' + num(r.totalWeeks) + ' weeks, ' + num(r.totalDays) + ' days'; },
      nominalLabel: null, nominal: null,
      rocLabel: null, roc: null
    }
  };

  return { isLeap: isLeap, parseDate: parseDate, addMonths: addMonths, age: age, iso: iso, weekday: weekday,
    rocBirthYear: rocBirthYear, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = AGE;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = AGE.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];

  function render() {
    var out = $('age-result');
    var birth = AGE.parseDate($('birth-input').value), on = AGE.parseDate($('on-input').value);
    out.hidden = false;
    if (!birth || !on) { out.innerHTML = '<p class="error">' + (!birth ? T.pickBirth : T.pickOn) + '</p>'; return; }
    var r = AGE.age(birth, on);
    if (r.error) { out.innerHTML = '<p class="error">' + T.future + '</p>'; return; }
    var list = '<dt>' + T.nextLabel + '</dt><dd>' + T.next(r) + '</dd>' +
      '<dt>' + T.monthsLabel + '</dt><dd>' + T.months(r) + '</dd>';
    if (T.nominalLabel) list += '<dt>' + T.nominalLabel + '</dt><dd>' + T.nominal(r) + '</dd>';
    if (T.rocLabel) list += '<dt>' + T.rocLabel + '</dt><dd>' + T.roc(birth) + '</dd>';
    out.innerHTML = '<div class="result-main"><span id="age-main">' + T.main(r) + '</span>' +
      '<button class="copy-btn" type="button" data-copy="age-main" data-done="' + T.copied + '">' + T.copy + '</button></div>' +
      '<div class="result-sub">' + T.detail(r) + '</div>' +
      '<dl class="result-list">' + list + '</dl>';
  }

  ['birth-input', 'on-input'].forEach(function (id) { $(id).addEventListener('input', render); });

  // Start with someone born on January 1, 30 years ago, aged on today.
  var t = new Date();
  var today = AGE.iso({ y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() });
  $('on-input').value = today;
  $('birth-input').value = (t.getFullYear() - 30) + '-01-01';
  render();
});
