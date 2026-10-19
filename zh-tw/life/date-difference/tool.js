// 日期間隔計算. Pure logic first (testable with node), DOM wiring below.
// Dates are plain { y, m, d } objects; day arithmetic uses a day count, never Date, so time zones and DST can't shift results.
var DD = (function () {
  var WEEKDAYS = '日一二三四五六';
  var MIN_DAY = toDays(1, 1, 1), MAX_DAY = toDays(9999, 12, 31);

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

  function fromDays(z) {
    z += 719468;
    var era = Math.floor(z / 146097);
    var doe = z - era * 146097;
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    var mp = Math.floor((5 * doy + 2) / 153);
    var d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    var m = mp < 10 ? mp + 3 : mp - 9;
    return { y: yoe + era * 400 + (m <= 2 ? 1 : 0), m: m, d: d };
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

  // Same day-of-month n months later; clamps to the month's last day (1/31 + 1 month = 2/28 or 2/29).
  function addMonths(a, n) {
    var t = a.y * 12 + (a.m - 1) + n;
    var y = Math.floor(t / 12), m = t - y * 12 + 1;
    return { y: y, m: m, d: Math.min(a.d, daysInMonth(y, m)) };
  }

  // Difference from a to b. inclusive = count both the first and the last day.
  // Months are whole calendar months from the earlier date, then the leftover days.
  function diff(a, b, inclusive) {
    var sign = dayNum(b) > dayNum(a) ? 1 : dayNum(b) < dayNum(a) ? -1 : 0;
    var start = sign < 0 ? b : a, end = sign < 0 ? a : b;
    if (inclusive) end = fromDays(dayNum(end) + 1);
    var days = dayNum(end) - dayNum(start);
    var months = (end.y - start.y) * 12 + (end.m - start.m);
    if (dayNum(addMonths(start, months)) > dayNum(end)) months--;
    var monthDays = dayNum(end) - dayNum(addMonths(start, months));
    return {
      sign: sign, days: days,
      weeks: Math.floor(days / 7), weekDays: days % 7,
      months: months, monthDays: monthDays,
      years: Math.floor(months / 12), yearMonths: months % 12
    };
  }

  // Signed whole number of days, half- or full-width digits. Returns { n } or { error }.
  function parseDays(text) {
    var s = String(text == null ? '' : text).replace(/\s+/g, '')
      .replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/^[－−]/, '-').replace(/^＋/, '+');
    if (!s) return { error: '請輸入天數，例如 30。' };
    if (!/^[+-]?\d+$/.test(s)) return { error: '天數只能是整數，往前推請輸入負數，例如 -30。' };
    return { n: parseInt(s, 10) };
  }

  // a + n days. countStart = the start day itself is day 1 (so 30 days from 10/19 ends on 11/17).
  function addDays(a, n, countStart) {
    var shift = countStart && n !== 0 ? n - (n > 0 ? 1 : -1) : n;
    var z = dayNum(a) + shift;
    if (z < MIN_DAY || z > MAX_DAY) return null;
    return fromDays(z);
  }

  function weekday(a) { return ((dayNum(a) + 4) % 7 + 7) % 7; } // 1970-01-01 was a Thursday

  function iso(a) { return pad(a.y, 4) + '-' + pad(a.m, 2) + '-' + pad(a.d, 2); }

  function words(a) { return a.y + ' 年 ' + a.m + ' 月 ' + a.d + ' 日（星期' + WEEKDAYS[weekday(a)] + '）'; }

  function rocYear(y) { return y >= 1912 ? '民國 ' + (y - 1911) + ' 年' : '民前 ' + (1912 - y) + ' 年'; }

  return { isLeap: isLeap, daysInMonth: daysInMonth, parseDate: parseDate, addMonths: addMonths, diff: diff,
    parseDays: parseDays, addDays: addDays, weekday: weekday, iso: iso, words: words, rocYear: rocYear,
    toDays: toDays, fromDays: fromDays };
})();

if (typeof module !== 'undefined') module.exports = DD;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };

  function todayIso() {
    var t = new Date();
    return DD.iso({ y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() });
  }

  // ---- Difference between two dates ----
  function renderDiff() {
    var out = $('diff-result');
    var a = DD.parseDate($('start-input').value), b = DD.parseDate($('end-input').value);
    out.hidden = false;
    if (!a || !b) {
      out.innerHTML = '<p class="error">請選擇' + (!a ? '起始日' : '結束日') + '。</p>';
      return;
    }
    var r = DD.diff(a, b, $('inclusive').checked);
    var lead = r.sign === 0 && !$('inclusive').checked ? '同一天' : r.days + ' 天';
    var sub = DD.words(a) + ' → ' + DD.words(b) + (r.sign < 0 ? '（結束日在起始日之前）' : '');
    var list = '<dt>週</dt><dd>' + r.weeks + ' 週' + (r.weekDays ? '又 ' + r.weekDays + ' 天' : '') + '</dd>' +
      '<dt>月</dt><dd>' + r.months + ' 個月' + (r.monthDays ? '又 ' + r.monthDays + ' 天' : '') + '</dd>';
    if (r.years) list += '<dt>年</dt><dd>' + r.years + ' 年' + (r.yearMonths ? ' ' + r.yearMonths + ' 個月' : '') +
      (r.monthDays ? ' ' + r.monthDays + ' 天' : '') + '</dd>';
    out.innerHTML =
      '<div class="result-main"><span id="diff-main">' + lead + '</span>' +
      '<button class="copy-btn" type="button" data-copy="diff-main" data-done="已複製">複製</button></div>' +
      '<div class="result-sub">' + sub + '</div>' +
      '<dl class="result-list">' + list + '</dl>';
  }

  // ---- Add or subtract days ----
  function renderAdd() {
    var out = $('add-result');
    var a = DD.parseDate($('base-input').value);
    out.hidden = false;
    if (!a) { out.innerHTML = '<p class="error">請選擇起始日。</p>'; return; }
    var p = DD.parseDays($('days-input').value);
    if (p.error) { out.innerHTML = '<p class="error">' + p.error + '</p>'; return; }
    var r = DD.addDays(a, p.n, $('count-start').checked);
    if (!r) { out.innerHTML = '<p class="error">結果超出西元 1 年到 9999 年的範圍，請把天數改小一點。</p>'; return; }
    var how = p.n === 0 ? '就是起始日當天' : (p.n > 0 ? '往後 ' : '往前 ') + Math.abs(p.n) + ' 天' +
      ($('count-start').checked ? '（起始日算第 1 天）' : '（起始日不算）');
    out.innerHTML =
      '<div class="result-main"><span id="add-main">' + DD.iso(r) + '</span>' +
      '<button class="copy-btn" type="button" data-copy="add-main" data-done="已複製">複製</button></div>' +
      '<div class="result-sub">' + DD.words(r) + '</div>' +
      '<dl class="result-list"><dt>民國</dt><dd>' + DD.rocYear(r.y) + ' ' + r.m + ' 月 ' + r.d + ' 日</dd>' +
      '<dt>計算方式</dt><dd>' + DD.words(a) + ' ' + how + '</dd></dl>';
  }

  ['start-input', 'end-input'].forEach(function (id) { $(id).addEventListener('input', renderDiff); });
  $('inclusive').addEventListener('change', renderDiff);
  ['base-input', 'days-input'].forEach(function (id) { $(id).addEventListener('input', renderAdd); });
  $('count-start').addEventListener('change', renderAdd);

  // Start from today: countdown to next New Year's Day, and 30 days from today.
  var today = todayIso();
  $('start-input').value = today;
  $('end-input').value = (Number(today.slice(0, 4)) + 1) + '-01-01';
  $('base-input').value = today;
  $('days-input').value = '30';
  renderDiff();
  renderAdd();
});
