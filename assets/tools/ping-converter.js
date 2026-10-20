// Ping (坪) converter / 坪數換算, shared by /zh-tw/ and /en/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
var PING = (function () {
  // 1 坪 = 6 尺 × 6 尺, with 1 尺 = 10/33 m, so 1 坪 = (20/11)² = 400/121 m² exactly.
  var M2_PER = { ping: 400 / 121, m2: 1, ft2: 0.09290304 }; // 1 ft = 0.3048 m exactly
  var M_PER = { m: 1, cm: 0.01, ft: 0.3048 };

  // Number from text: half- or full-width digits, commas allowed. Returns a number, null for empty, NaN otherwise.
  function readNumber(text) {
    var s = String(text == null ? '' : text).replace(/[\s,，]/g, '')
      .replace(/[０-９．]/g, function (c) { return c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
    if (!s) return null;
    return /^(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
  }

  function read(text) {
    var n = readNumber(text);
    if (n === null) return { error: 'empty' };
    if (Number.isNaN(n)) return { error: 'number' };
    return { n: n };
  }

  function fromM2(m2) { return { m2: m2, ping: m2 / M2_PER.ping, ft2: m2 / M2_PER.ft2 }; }

  // value as typed + unit ('ping' | 'm2' | 'ft2') -> { ping, m2, ft2 } or { error }
  function convert(text, unit) {
    var r = read(text); if (r.error) return r;
    return fromM2(r.n * M2_PER[unit]);
  }

  // length × width as typed + unit ('m' | 'cm' | 'ft')
  function room(lengthText, widthText, unit) {
    var a = read(lengthText); if (a.error) return { error: a.error, field: 'length' };
    var b = read(widthText); if (b.error) return { error: b.error, field: 'width' };
    return fromM2(a.n * M_PER[unit] * b.n * M_PER[unit]);
  }

  // Registered area in 坪 and the shared-area ratio (公設比) in % -> own and shared parts in 坪.
  function shared(totalText, ratioText) {
    var t = read(totalText); if (t.error) return { error: t.error, field: 'total' };
    var r = read(ratioText); if (r.error) return { error: r.error, field: 'ratio' };
    if (r.n >= 100) return { error: 'ratio-range', field: 'ratio' };
    var own = t.n * (1 - r.n / 100);
    return { own: own, shared: t.n - own, ownM2: own * M2_PER.ping };
  }

  // 1234.5678 -> "1,234.57": rounded to dp decimals, trailing zeros dropped, thousands separated.
  function fmt(x, dp) {
    var s = (Math.round(x * Math.pow(10, dp)) / Math.pow(10, dp)).toFixed(dp).replace(/\.?0+$/, '');
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    'zh-tw': {
      copy: '複製', copied: '已複製',
      units: { ping: '坪', m2: '平方公尺', ft2: '平方英尺' },
      errors: {
        empty: function (f) { return '請輸入' + f + '。'; },
        number: function (f) { return f + '只能是 0 或正數，例如 30。'; },
        'ratio-range': function () { return '公設比要小於 100%。'; }
      },
      fields: { value: '數值', length: '長度', width: '寬度', total: '權狀坪數', ratio: '公設比' },
      ownLabel: '扣除公設', sharedLabel: '公設', ownM2Label: '扣除公設（平方公尺）',
      ownNote: '扣除公設後的坪數仍包含陽台、雨遮等附屬建物，實際室內面積會再小一些。'
    },
    en: {
      copy: 'Copy', copied: 'Copied',
      units: { ping: 'ping', m2: 'm²', ft2: 'ft²' },
      errors: {
        empty: function (f) { return 'Enter the ' + f + '.'; },
        number: function (f) { return 'The ' + f + ' must be 0 or a positive number, for example 30.'; },
        'ratio-range': function () { return 'The shared-area ratio must be under 100%.'; }
      },
      fields: { value: 'value', length: 'length', width: 'width', total: 'registered area', ratio: 'shared-area ratio' },
      ownLabel: 'Excluding shared areas', sharedLabel: 'Shared areas', ownM2Label: 'Excluding shared areas (m²)',
      ownNote: 'The area excluding shared areas still includes balconies and other attached structures, so the indoor area is a little smaller.'
    }
  };

  return { M2_PER: M2_PER, readNumber: readNumber, convert: convert, room: room, shared: shared, fmt: fmt, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = PING;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = PING.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var DP = { ping: 2, m2: 2, ft2: 1 };

  function error(r, field) { return '<p class="error">' + T.errors[r.error](T.fields[r.field || field]) + '</p>'; }
  function amount(v, unit) { return PING.fmt(v, DP[unit]) + ' ' + T.units[unit]; }
  function copyable(id, text) {
    return '<div class="result-main"><span id="' + id + '">' + text + '</span>' +
      '<button class="copy-btn" type="button" data-copy="' + id + '" data-done="' + T.copied + '">' + T.copy + '</button></div>';
  }
  // The main line is the area in 坪, or in m² when the input is already in 坪; the others are listed below.
  function areaHtml(id, r, from) {
    var main = from === 'ping' ? 'm2' : 'ping';
    var rest = ['ping', 'm2', 'ft2'].filter(function (u) { return u !== main && u !== from; });
    return copyable(id, amount(r[main], main)) +
      '<dl class="result-list">' + rest.map(function (u) { return '<dt>' + T.units[u] + '</dt><dd>' + amount(r[u], u) + '</dd>'; }).join('') + '</dl>';
  }

  function renderConvert() {
    var r = PING.convert($('value-input').value, $('value-unit').value);
    $('convert-result').innerHTML = r.error ? error(r, 'value') : areaHtml('convert-main', r, $('value-unit').value);
  }
  function renderRoom() {
    var r = PING.room($('room-length').value, $('room-width').value, $('room-unit').value);
    $('room-result').innerHTML = r.error ? error(r) : areaHtml('room-main', r, null);
  }
  function renderShared() {
    var r = PING.shared($('shared-total').value, $('shared-ratio').value);
    if (r.error) { $('shared-result').innerHTML = error(r); return; }
    $('shared-result').innerHTML = copyable('shared-main', amount(r.own, 'ping')) +
      '<dl class="result-list"><dt>' + T.ownM2Label + '</dt><dd>' + amount(r.ownM2, 'm2') + '</dd>' +
      '<dt>' + T.sharedLabel + '</dt><dd>' + amount(r.shared, 'ping') + '</dd></dl>' +
      '<p class="result-sub">' + T.ownNote + '</p>';
  }

  ['value-input', 'value-unit'].forEach(function (id) { $(id).addEventListener('input', renderConvert); });
  ['room-length', 'room-width', 'room-unit'].forEach(function (id) { $(id).addEventListener('input', renderRoom); });
  ['shared-total', 'shared-ratio'].forEach(function (id) { $(id).addEventListener('input', renderShared); });

  // Common starting points: a 30-ping home, a 4 m × 3.5 m bedroom, 35 ping with a 33% shared-area ratio.
  $('value-input').value = '30'; $('room-length').value = '4'; $('room-width').value = '3.5';
  $('shared-total').value = '35'; $('shared-ratio').value = '33';
  renderConvert(); renderRoom(); renderShared();
});
