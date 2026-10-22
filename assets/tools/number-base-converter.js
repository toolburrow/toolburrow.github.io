// Number base converter / 進位轉換, shared by /zh-tw/ and /en/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// Numbers are BigInt bit patterns, so 64-bit values stay exact. A width of 0 means "auto": unsigned, no padding.
var NBC = (function () {
  var WIDTHS = [0, 8, 16, 32, 64];
  var MAX_AUTO_BITS = 64;
  // ASCII control characters by code; 32 is the space and 127 is DEL.
  var CONTROL = ['NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI',
    'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US'];
  var ESCAPES = { 0: '\\0', 7: '\\a', 8: '\\b', 9: '\\t', 10: '\\n', 11: '\\v', 12: '\\f', 13: '\\r' };

  function halfWidth(text) {
    return String(text == null ? '' : text)
      .replace(/[０-９ａ-ｚＡ-Ｚ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); })
      .replace(/[－−]/g, '-');
  }

  // Text typed in the decimal, hex or binary field -> { value } (an unsigned BigInt bit pattern of `width` bits)
  // or { error: 'empty' | 'format' | 'negative' | 'range' }.
  // Decimal may be negative when a width is chosen (two's complement); hex and binary are always the bit pattern.
  function parse(text, base, width) {
    var s = halfWidth(text).replace(/[\s_,，]/g, '').toLowerCase(), v;
    if (!s) return { error: 'empty' };
    if (base === 'hex') {
      s = s.replace(/^0x/, '').replace(/h$/, '');
      if (!/^[0-9a-f]+$/.test(s)) return { error: 'format' };
      v = BigInt('0x' + s);
    } else if (base === 'bin') {
      s = s.replace(/^0b/, '');
      if (!/^[01]+$/.test(s)) return { error: 'format' };
      v = BigInt('0b' + s);
    } else {
      if (!/^-?\d+$/.test(s)) return { error: 'format' };
      v = BigInt(s);
      if (v < 0n) {
        if (!width) return { error: 'negative' };
        if (v < -(1n << BigInt(width - 1))) return { error: 'range' };
        v += 1n << BigInt(width);
      }
    }
    if (v >= 1n << BigInt(width || MAX_AUTO_BITS)) return { error: 'range' };
    return { value: v };
  }

  // Largest and smallest values a width can hold, as decimal strings, for error messages.
  function limits(width) {
    var w = BigInt(width || MAX_AUTO_BITS);
    return { max: String((1n << w) - 1n), min: width ? String(-(1n << (w - 1n))) : '0' };
  }

  // Bit pattern read as a two's complement signed number.
  function signed(value, width) {
    return value >= 1n << BigInt(width - 1) ? value - (1n << BigInt(width)) : value;
  }

  function bitLength(value) { return value === 0n ? 1 : value.toString(2).length; }

  // Digits padded to the width; in auto mode binary is padded to whole hex digits (4 bits) and hex is not padded.
  function hex(value, width) {
    var s = value.toString(16).toUpperCase();
    return width ? s.padStart(width / 4, '0') : s;
  }
  function bin(value, width) {
    var s = value.toString(2);
    return s.padStart(width || Math.ceil(s.length / 4) * 4, '0');
  }
  // Binary with a space every 4 bits from the right, so each group is one hex digit.
  function groupBits(s) { return s.replace(/\B(?=(?:[01]{4})+$)/g, ' '); }

  // Bytes from the most significant one: the width's byte count, or as few as fit in auto mode.
  function bytesBE(value, width) {
    var h = value.toString(16).toUpperCase();
    var n = width ? width / 8 : Math.ceil(h.length / 2);
    h = h.padStart(n * 2, '0');
    var out = [];
    for (var i = 0; i < n; i++) out.push(h.slice(i * 2, i * 2 + 2));
    return out;
  }

  // What an ASCII code is: { char } for a printable character, { control, escape } for a control character,
  // { space: true } for 32, or null above 127.
  function ascii(value) {
    if (value > 127n) return null;
    var c = Number(value);
    if (c === 32) return { space: true };
    if (c === 127) return { control: 'DEL', escape: null };
    if (c < 32) return { control: CONTROL[c], escape: ESCAPES[c] || null };
    return { char: String.fromCharCode(c) };
  }

  // Text <-> UTF-8 bytes. ASCII text gives one byte per character, the same as the ASCII code.
  function encode(text) { return Array.prototype.slice.call(new TextEncoder().encode(text)); }
  // { text, invalid } where invalid is true when the bytes aren't valid UTF-8 (shown as U+FFFD).
  function decode(bytes) {
    var u = new Uint8Array(bytes), invalid = false;
    try { new TextDecoder('utf-8', { fatal: true }).decode(u); } catch (e) { invalid = true; }
    return { text: new TextDecoder('utf-8').decode(u), invalid: invalid };
  }
  function isAscii(bytes) { return bytes.every(function (b) { return b < 128; }); }

  // Byte list in 'hex' ("48 65 6C"), 'dec' ("72 101 108") or 'bin' ("01001000 ...").
  function formatBytes(bytes, fmt) {
    return bytes.map(function (b) {
      if (fmt === 'dec') return String(b);
      if (fmt === 'bin') return b.toString(2).padStart(8, '0');
      return b.toString(16).toUpperCase().padStart(2, '0');
    }).join(' ');
  }
  function cArray(bytes) {
    return '{' + bytes.map(function (b) { return '0x' + b.toString(16).toUpperCase().padStart(2, '0'); }).join(', ') + '}';
  }

  // Codes typed in the code box -> { bytes } or { error: 'format' | 'range' | 'odd' | 'bits', token }.
  // Separators: spaces, commas, semicolons, braces. Hex accepts 0x and \x prefixes and runs like "48656C" (pairs);
  // binary accepts runs of whole bytes ("0100100001100101"). An empty box is zero bytes.
  function parseBytes(text, fmt) {
    var tokens = halfWidth(text).split(/[\s,，;{}\[\]]+/).filter(Boolean), out = [];
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i], j;
      if (fmt === 'hex') {
        var parts = t.replace(/^0x/i, '').split(/\\x/i).filter(Boolean);
        if (!parts.length) return { error: 'format', token: t };
        for (j = 0; j < parts.length; j++) {
          var p = parts[j];
          if (!/^[0-9a-fA-F]+$/.test(p)) return { error: 'format', token: t };
          if (p.length > 2 && p.length % 2) return { error: 'odd', token: t };
          for (var k = 0; k < p.length; k += 2) out.push(parseInt(p.length === 1 ? p : p.slice(k, k + 2), 16));
        }
      } else if (fmt === 'bin') {
        t = t.replace(/^0b/i, '');
        if (!/^[01]+$/.test(t)) return { error: 'format', token: tokens[i] };
        if (t.length > 8 && t.length % 8) return { error: 'bits', token: tokens[i] };
        for (j = 0; j < t.length; j += 8) out.push(parseInt(t.slice(j, j + 8), 2));
      } else {
        if (!/^\d+$/.test(t)) return { error: 'format', token: t };
        if (+t > 255) return { error: 'range', token: t };
        out.push(+t);
      }
    }
    return { bytes: out };
  }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    'zh-tw': {
      width: function (w) { return w ? String(w) : '自動'; },
      error: {
        empty: '請輸入數字。',
        format: { dec: '十進位只能有 0～9（負數前面加 -）。', hex: '十六進位只能有 0～9 和 A～F，可以用 0x 開頭。', bin: '二進位只能有 0 和 1，可以用 0b 開頭。' },
        negative: '負數要先選位元數（8、16、32 或 64），才能換成二補數。',
        range: function (w, l) { return w ? '超出 ' + w + ' 位元的範圍（無號 0～' + l.max + '，有號 ' + l.min + '～' + (BigInt(l.max) >> 1n) + '），請選更多位元或「自動」。' : '數字太大了，最多到 64 位元（' + l.max + '）。'; }
      },
      signedLabel: '有號十進位（二補數）', octLabel: '八進位', asciiLabel: 'ASCII 字元', bitsLabel: '位元數',
      beLabel: '位元組（大端序）', leLabel: '位元組（小端序）',
      bits: function (n, bytes) { return n + ' 位元（' + bytes + ' 個位元組）'; },
      asciiSpace: '空白（SP）',
      asciiControl: function (name, esc) { return name + '（控制字元' + (esc ? '，' + esc : '') + '）'; },
      asciiNone: '超過 127，不是 ASCII 字元',
      codeError: {
        format: function (t, fmt) { return '「' + t + '」不是' + TEXT['zh-tw'].fmt[fmt] + '的數字，請檢查格式或切換上面的代碼格式。'; },
        range: function (t) { return '「' + t + '」超過 255，一個位元組是 0～255。'; },
        odd: function (t) { return '「' + t + '」的位數是單數，十六進位每兩位是一個位元組，請補 0 或用空格分開。'; },
        bits: function (t) { return '「' + t + '」不是 8 的倍數個位元，請用空格把每個位元組分開。'; }
      },
      fmt: { hex: '十六進位', dec: '十進位', bin: '二進位' },
      byteCount: '位元組數', encodingLabel: '編碼', cLabel: 'C 陣列',
      encAscii: '全部是 ASCII，一個字元一個位元組',
      encUtf8: '含非 ASCII 字元，用 UTF-8 編碼（中文字通常 3 個位元組）',
      invalid: '這些位元組不是有效的 UTF-8，無法顯示的部分以 � 表示。',
      copy: '複製', copied: '已複製'
    },
    en: {
      width: function (w) { return w ? String(w) : 'Auto'; },
      error: {
        empty: 'Enter a number.',
        format: { dec: 'Decimal can only have 0–9 (put - in front of a negative number).', hex: 'Hex can only have 0–9 and A–F, optionally starting with 0x.', bin: 'Binary can only have 0 and 1, optionally starting with 0b.' },
        negative: 'Pick a bit width (8, 16, 32 or 64) to enter a negative number as two’s complement.',
        range: function (w, l) { return w ? 'That doesn’t fit in ' + w + ' bits (unsigned 0 to ' + l.max + ', signed ' + l.min + ' to ' + (BigInt(l.max) >> 1n) + '). Pick more bits or Auto.' : 'That number is too big. The limit is 64 bits (' + l.max + ').'; }
      },
      signedLabel: 'Signed decimal (two’s complement)', octLabel: 'Octal', asciiLabel: 'ASCII character', bitsLabel: 'Bits',
      beLabel: 'Bytes (big-endian)', leLabel: 'Bytes (little-endian)',
      bits: function (n, bytes) { return n + ' bit' + (n === 1 ? '' : 's') + ' (' + bytes + ' byte' + (bytes === 1 ? '' : 's') + ')'; },
      asciiSpace: 'Space (SP)',
      asciiControl: function (name, esc) { return name + ' (control character' + (esc ? ', ' + esc : '') + ')'; },
      asciiNone: 'Above 127, not an ASCII character',
      codeError: {
        format: function (t, fmt) { return '“' + t + '” isn’t a ' + TEXT.en.fmt[fmt].toLowerCase() + ' number. Check the format or switch the code format above.'; },
        range: function (t) { return '“' + t + '” is over 255. A byte is 0 to 255.'; },
        odd: function (t) { return '“' + t + '” has an odd number of digits. Each byte is two hex digits; add a 0 or separate the bytes with spaces.'; },
        bits: function (t) { return '“' + t + '” isn’t a whole number of bytes. Separate each 8 bits with a space.'; }
      },
      fmt: { hex: 'Hex', dec: 'Decimal', bin: 'Binary' },
      byteCount: 'Bytes', encodingLabel: 'Encoding', cLabel: 'C array',
      encAscii: 'All ASCII, one byte per character',
      encUtf8: 'Has non-ASCII characters, encoded as UTF-8 (2 to 4 bytes each)',
      invalid: 'These bytes aren’t valid UTF-8. Parts that can’t be shown appear as �.',
      copy: 'Copy', copied: 'Copied'
    }
  };

  return { WIDTHS: WIDTHS, CONTROL: CONTROL, ESCAPES: ESCAPES, parse: parse, limits: limits, signed: signed, bitLength: bitLength,
    hex: hex, bin: bin, groupBits: groupBits, bytesBE: bytesBE, ascii: ascii, encode: encode, decode: decode, isAscii: isAscii,
    formatBytes: formatBytes, cArray: cArray, parseBytes: parseBytes, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = NBC;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = NBC.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

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

  // Panel 1: the three fields stay in sync; the one being typed in is left as typed.
  var width = 0, source = 'dec';
  var fields = { dec: $('dec-input'), hex: $('hex-input'), bin: $('bin-input') };

  function renderNumber() {
    var out = $('num-result');
    out.hidden = false;
    var p = NBC.parse(fields[source].value, source, width);
    if (p.error) {
      var msg = T.error[p.error];
      if (p.error === 'format') msg = msg[source];
      if (p.error === 'range') msg = msg(width, NBC.limits(width));
      out.innerHTML = '<p class="error">' + msg + '</p>';
      return;
    }
    var v = p.value;
    if (source !== 'dec') fields.dec.value = v.toString();
    if (source !== 'hex') fields.hex.value = NBC.hex(v, width);
    if (source !== 'bin') fields.bin.value = NBC.groupBits(NBC.bin(v, width));
    var be = NBC.bytesBE(v, width), a = NBC.ascii(v);
    var asciiText = !a ? T.asciiNone : a.space ? T.asciiSpace : a.control ? T.asciiControl(a.control, a.escape) : a.char;
    out.innerHTML = '<dl class="result-list">' +
      (width ? '<dt>' + T.signedLabel + '</dt><dd>' + NBC.signed(v, width) + '</dd>' : '') +
      '<dt>' + T.octLabel + '</dt><dd>' + v.toString(8) + '</dd>' +
      '<dt>' + T.asciiLabel + '</dt><dd>' + esc(asciiText) + '</dd>' +
      '<dt>' + T.bitsLabel + '</dt><dd>' + T.bits(width || NBC.bitLength(v), be.length) + '</dd>' +
      '<dt>' + T.beLabel + '</dt><dd>' + be.join(' ') + '</dd>' +
      '<dt>' + T.leLabel + '</dt><dd>' + be.slice().reverse().join(' ') + '</dd>' +
      '</dl>';
  }

  Object.keys(fields).forEach(function (k) {
    fields[k].addEventListener('input', function () { source = k; renderNumber(); });
  });
  segment($('width-seg'), NBC.WIDTHS, width, T.width, function (v) { width = Number(v); renderNumber(); });

  // Panel 2: text and byte codes stay in sync the same way.
  var fmt = 'hex', bytes = [];

  function renderText(error, token) {
    var out = $('text-result');
    out.hidden = false;
    if (error) {
      out.innerHTML = '<p class="error">' + esc(T.codeError[error](token, fmt)) + '</p>';
      return;
    }
    var c = NBC.cArray(bytes);
    out.innerHTML = '<dl class="result-list">' +
      '<dt>' + T.byteCount + '</dt><dd>' + bytes.length + '</dd>' +
      '<dt>' + T.encodingLabel + '</dt><dd>' + (NBC.isAscii(bytes) ? T.encAscii : T.encUtf8) + '</dd>' +
      '<dt>' + T.cLabel + '</dt><dd><span id="c-array">' + c + '</span>' +
      '<button class="copy-btn" type="button" data-copy="c-array" data-done="' + T.copied + '">' + T.copy + '</button></dd>' +
      '</dl>' + (NBC.decode(bytes).invalid ? '<p class="notice">' + T.invalid + '</p>' : '');
  }

  $('text-input').addEventListener('input', function () {
    bytes = NBC.encode($('text-input').value);
    $('code-input').value = NBC.formatBytes(bytes, fmt);
    renderText();
  });
  $('code-input').addEventListener('input', function () {
    var p = NBC.parseBytes($('code-input').value, fmt);
    if (p.error) { renderText(p.error, p.token); return; }
    bytes = p.bytes;
    $('text-input').value = NBC.decode(bytes).text;
    renderText();
  });
  segment($('fmt-seg'), ['hex', 'dec', 'bin'], fmt, function (f) { return T.fmt[f]; }, function (v) {
    fmt = v;
    $('code-input').value = NBC.formatBytes(bytes, fmt);
    renderText();
  });

  renderNumber();
  bytes = NBC.encode($('text-input').value);
  $('code-input').value = NBC.formatBytes(bytes, fmt);
  renderText();
});
