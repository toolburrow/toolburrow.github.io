// DIP switch calculator / 指撥開關換算, shared by /zh-tw/ and /en/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// Switches are numbered from 1 as printed on the part. With 'lsb' order switch 1 is worth 1 (the DMX convention);
// with 'msb' order switch 1 is the highest bit.
var DIP = (function () {
  var COUNTS = [4, 6, 8, 9, 10, 12, 16];
  var DMX_MAX = 512;

  function clean(text) {
    return String(text == null ? '' : text).replace(/[\s,，_]/g, '')
      .replace(/[０-９ａ-ｚＡ-Ｚ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
  }

  // "37", "0x25" or "0b100101" -> 37, for a value that fits in `count` switches.
  // Returns { value } or { error: 'empty' | 'format' | 'range' }.
  function parseValue(text, count) {
    var s = clean(text).toLowerCase(), v;
    if (!s) return { error: 'empty' };
    if (/^0x[0-9a-f]+$/.test(s)) v = parseInt(s.slice(2), 16);
    else if (/^0b[01]+$/.test(s)) v = parseInt(s.slice(2), 2);
    else if (/^\d+$/.test(s)) v = Number(s);
    else return { error: 'format' };
    if (v > Math.pow(2, count) - 1) return { error: 'range' };
    return { value: v };
  }

  // Whole number from min to max. Returns { value } or { error: 'empty' | 'range' }.
  function parseInt10(text, min, max) {
    var s = clean(text);
    if (!s) return { error: 'empty' };
    if (!/^\d+$/.test(s) || +s < min || +s > max) return { error: 'range' };
    return { value: +s };
  }

  // Weight of switch n (1-based) out of count.
  function weight(n, count, order) { return Math.pow(2, order === 'msb' ? count - n : n - 1); }

  // value -> [true, false, ...] for switches 1..count (true = ON).
  function toSwitches(value, count, order) {
    var out = [];
    for (var n = 1; n <= count; n++) out.push(Math.floor(value / weight(n, count, order)) % 2 === 1);
    return out;
  }

  // [true, false, ...] -> value.
  function fromSwitches(sw, order) {
    return sw.reduce(function (t, on, i) { return t + (on ? weight(i + 1, sw.length, order) : 0); }, 0);
  }

  // Switch numbers that are ON, e.g. 37 -> [1, 3, 6].
  function onList(value, count, order) {
    var out = [];
    toSwitches(value, count, order).forEach(function (on, i) { if (on) out.push(i + 1); });
    return out;
  }

  // value as binary written switch 1 first (how the switches look left to right), and as hex.
  function bits(value, count, order) {
    return toSwitches(value, count, order).map(function (on) { return on ? '1' : '0'; }).join('');
  }
  function hex(value) { return '0x' + value.toString(16).toUpperCase(); }

  // Addresses for `fixtures` DMX fixtures of `channels` channels each, starting at `start`, packed back to back.
  // Each fixture uses 10 switches (switch 10 is only needed for 512). Returns { rows: [{ fixture, address, last, on }] }
  // or { error: 'overflow', fits } when the last channel would pass 512 (fits: how many fixtures do fit).
  function dmxPlan(start, channels, fixtures) {
    var fits = Math.max(0, Math.floor((DMX_MAX - start + 1) / channels));
    if (start + channels * fixtures - 1 > DMX_MAX) return { error: 'overflow', fits: fits };
    var rows = [];
    for (var i = 0; i < fixtures; i++) {
      var a = start + i * channels;
      rows.push({ fixture: i + 1, address: a, last: a + channels - 1, on: onList(a, 10, 'lsb') });
    }
    return { rows: rows };
  }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    'zh-tw': {
      countLabel: function (n) { return String(n); },
      order: { lsb: '最低位（DMX 常用）', msb: '最高位' },
      on: 'ON', off: 'OFF',
      switchLabel: function (n, w, on) { return '開關 ' + n + '（' + w + '），目前 ' + (on ? 'ON' : 'OFF'); },
      valueError: { empty: '請輸入數值，例如 37、0x25 或 0b100101。', format: '只能輸入十進位、0x 開頭的十六進位或 0b 開頭的二進位，例如 37、0x25。',
        range: function (max) { return '這個數值超過開關能表示的範圍，最大是 ' + max + '，請加開關數或改小數值。'; } },
      main: function (v) { return '數值 ' + v; },
      onLabel: '打開的開關', binLabel: '二進位（開關 1 在左）', hexLabel: '十六進位', sumLabel: '加總',
      onList: function (l) { return l.length ? l.join('、') : '全部 OFF'; },
      sum: function (parts) { return parts.length ? parts.join(' + ') : '0'; },
      startError: '起始位址請輸入 1 到 512 的整數。',
      channelsError: '每台 channel 數請輸入 1 到 512 的整數。',
      fixturesError: '燈具數量請輸入 1 到 512 的整數。',
      overflow: function (fits) { return fits ? '超過 512 個 channel 了，這個設定最多只能放 ' + fits + ' 台，多的燈要接到另一個 universe。' : '超過 512 個 channel 了，請改小起始位址或 channel 數。'; },
      head: ['燈具', '起始位址', '打開的開關', '佔用 channel'],
      fixture: function (n) { return String(n); }
    },
    en: {
      countLabel: function (n) { return String(n); },
      order: { lsb: 'Lowest bit (DMX)', msb: 'Highest bit' },
      on: 'ON', off: 'OFF',
      switchLabel: function (n, w, on) { return 'Switch ' + n + ' (' + w + '), ' + (on ? 'ON' : 'OFF'); },
      valueError: { empty: 'Enter a value, for example 37, 0x25 or 0b100101.', format: 'Enter a decimal number, hex starting with 0x or binary starting with 0b, for example 37 or 0x25.',
        range: function (max) { return 'That value doesn’t fit. The largest is ' + max + '; add switches or enter a smaller value.'; } },
      main: function (v) { return 'Value ' + v; },
      onLabel: 'Switches ON', binLabel: 'Binary (switch 1 on the left)', hexLabel: 'Hex', sumLabel: 'Sum',
      onList: function (l) { return l.length ? l.join(', ') : 'All OFF'; },
      sum: function (parts) { return parts.length ? parts.join(' + ') : '0'; },
      startError: 'Enter a start address from 1 to 512.',
      channelsError: 'Enter 1 to 512 channels per fixture.',
      fixturesError: 'Enter 1 to 512 fixtures.',
      overflow: function (fits) { return fits ? 'That runs past channel 512. Only ' + fits + ' fixture' + (fits === 1 ? '' : 's') + ' fit; put the rest on another universe.' : 'That runs past channel 512. Use a lower start address or fewer channels.'; },
      head: ['Fixture', 'Address', 'Switches ON', 'Channels'],
      fixture: function (n) { return String(n); }
    }
  };

  return { COUNTS: COUNTS, parseValue: parseValue, parseInt10: parseInt10, weight: weight, toSwitches: toSwitches,
    fromSwitches: fromSwitches, onList: onList, bits: bits, hex: hex, dmxPlan: dmxPlan, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = DIP;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = DIP.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var count = 9, order = 'lsb', value = 37;

  function segment(el, items, current, label, onPick) {
    el.innerHTML = items.map(function (x) {
      return '<button type="button" data-v="' + x + '" aria-pressed="' + (x === current) + '">' + label(x) + '</button>';
    }).join('');
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      el.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      onPick(b.dataset.v);
    });
  }
  segment($('count-seg'), DIP.COUNTS, count, T.countLabel, function (v) {
    count = Number(v);
    var p = DIP.parseValue($('value-input').value, count);   // a typed value that now fits wins
    value = p.error ? value % Math.pow(2, count) : p.value;  // otherwise drop switches that no longer exist
    $('value-input').value = String(value);
    render();
  });
  segment($('order-seg'), ['lsb', 'msb'], order, function (o) { return T.order[o]; }, function (v) {
    order = v;   // keep the number, so the switch pattern changes
    render();
  });

  $('switches').addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    var sw = DIP.toSwitches(value, count, order);
    sw[Number(b.dataset.n) - 1] = !sw[Number(b.dataset.n) - 1];
    value = DIP.fromSwitches(sw, order);
    $('value-input').value = String(value);
    render();
  });
  $('value-input').addEventListener('input', function () {
    var p = DIP.parseValue($('value-input').value, count);
    if (!p.error) value = p.value;
    render(p.error);
  });

  function render(error) {
    var out = $('dip-result');
    out.hidden = false;
    var sw = DIP.toSwitches(value, count, order);
    $('switches').innerHTML = sw.map(function (on, i) {
      var n = i + 1, w = DIP.weight(n, count, order);
      return '<button type="button" class="sw" data-n="' + n + '" aria-pressed="' + on + '" aria-label="' + T.switchLabel(n, w, on) + '">' +
        '<span class="sw-slot"><span class="sw-knob"></span></span><span class="sw-n">' + n + '</span><span class="sw-w">' + w + '</span></button>';
    }).join('');
    if (error) {
      var msg = T.valueError[error];
      out.innerHTML = '<p class="error">' + (typeof msg === 'function' ? msg(Math.pow(2, count) - 1) : msg) + '</p>';
      return;
    }
    var on = DIP.onList(value, count, order);
    out.innerHTML = '<div class="result-main">' + T.main(value) + '</div>' +
      '<dl class="result-list">' +
      '<dt>' + T.onLabel + '</dt><dd>' + T.onList(on) + '</dd>' +
      '<dt>' + T.sumLabel + '</dt><dd>' + T.sum(on.map(function (n) { return DIP.weight(n, count, order); })) + '</dd>' +
      '<dt>' + T.binLabel + '</dt><dd>' + DIP.bits(value, count, order) + '</dd>' +
      '<dt>' + T.hexLabel + '</dt><dd>' + DIP.hex(value) + '</dd>' +
      '</dl>';
  }

  function renderDmx() {
    var out = $('dmx-result');
    out.hidden = false;
    var s = DIP.parseInt10($('dmx-start').value, 1, 512);
    if (s.error) { out.innerHTML = '<p class="error">' + T.startError + '</p>'; return; }
    var c = DIP.parseInt10($('dmx-channels').value, 1, 512);
    if (c.error) { out.innerHTML = '<p class="error">' + T.channelsError + '</p>'; return; }
    var f = DIP.parseInt10($('dmx-fixtures').value, 1, 512);
    if (f.error) { out.innerHTML = '<p class="error">' + T.fixturesError + '</p>'; return; }
    var plan = DIP.dmxPlan(s.value, c.value, f.value);
    if (plan.error) { out.innerHTML = '<p class="error">' + T.overflow(plan.fits) + '</p>'; return; }
    out.innerHTML = '<div class="table-scroll"><table><thead><tr>' +
      T.head.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      plan.rows.map(function (r) {
        return '<tr><td>' + T.fixture(r.fixture) + '</td><td>' + r.address + '</td><td>' + T.onList(r.on) + '</td><td>' +
          (r.last > r.address ? r.address + '–' + r.last : r.address) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  ['dmx-start', 'dmx-channels', 'dmx-fixtures'].forEach(function (id) { $(id).addEventListener('input', renderDmx); });
  render();
  renderDmx();
});
