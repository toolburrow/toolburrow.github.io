// UART baud rate error calculator / UART 鮑率誤差計算, shared by /en/ and /zh-tw/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// A UART divides its clock to get the bit rate. Only whole divisors exist, so the real baud rate is often a bit off.
var UART = (function () {
  var COMMON = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

  // How each kind of UART turns the clock into a baud rate. step: clock cycles per divisor count.
  // min: the smallest divisor the hardware takes.
  var MODES = {
    x16: { step: 16, min: 1 },  // 16x oversampling: AVR (U2X = 0), 8051-style and 16550 UARTs. baud = f / (16 × D)
    x8: { step: 8, min: 1 },    // 8x oversampling: AVR with U2X = 1. baud = f / (8 × D)
    brr: { step: 1, min: 16 }   // STM32 USART, 16x oversampling: BRR = f / baud (fraction built in). baud = f / BRR
  };

  function clean(x) { return Number(x.toPrecision(12)); }

  // Clock as typed: 16, 16M, 16MHz, 7.3728M, 8000000Hz, 32k. A bare number is MHz; "m" is mega here.
  // Returns { hz } or { error: 'clock-empty' | 'clock-format' | 'clock-positive' }.
  function readClock(text) {
    var s = String(text == null ? '' : text).trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return { error: 'clock-empty' };
    var m = s.match(/^(\d+\.?\d*|\.\d+)([kmg]?)(hz)?$/);
    if (!m) return { error: 'clock-format' };
    var scale = m[2] ? { k: 1e3, m: 1e6, g: 1e9 }[m[2]] : m[3] ? 1 : 1e6;
    var hz = clean(Number(m[1]) * scale);
    return hz > 0 ? { hz: hz } : { error: 'clock-positive' };
  }

  // Baud rate as typed: 115200, 115.2k, 9600bps. Returns { baud } or { error: 'baud-empty' | 'baud-format' }.
  function readBaud(text) {
    var s = String(text == null ? '' : text).trim().toLowerCase().replace(/[\s,]/g, '').replace(/(bps|baud)$/, '');
    if (!s) return { error: 'baud-empty' };
    var m = s.match(/^(\d+\.?\d*|\.\d+)(k?)$/);
    if (!m) return { error: 'baud-format' };
    var baud = clean(Number(m[1]) * (m[2] ? 1e3 : 1));
    return baud > 0 ? { baud: baud } : { error: 'baud-format' };
  }

  // Closest divisor for one baud rate. Returns { divisor, actual, errorPct } or null if the clock is too slow.
  function divide(hz, baud, mode) {
    var md = MODES[mode];
    var d = Math.round(hz / (md.step * baud));
    if (d < md.min) return null;
    var actual = hz / (md.step * d);
    return { divisor: d, actual: actual, errorPct: clean((actual - baud) / baud * 100) };
  }

  // 'good' under 1%, 'ok' up to 2%, 'bad' above. Many references give about ±2% per side as the limit.
  function grade(errorPct) { var e = Math.abs(errorPct); return e < 1 + 1e-9 ? 'good' : e <= 2 + 1e-9 ? 'ok' : 'bad'; }

  function calc(clockText, baudText, mode) {
    var c = readClock(clockText); if (c.error) return c;
    var b = readBaud(baudText); if (b.error) return b;
    var r = divide(c.hz, b.baud, mode);
    if (!r) return { error: 'too-fast', max: clean(c.hz / (MODES[mode].step * MODES[mode].min)) };
    r.grade = grade(r.errorPct);
    r.hz = c.hz; r.baud = b.baud; r.mode = mode;
    r.table = COMMON.map(function (baud) {
      var x = divide(c.hz, baud, mode);
      return x ? { baud: baud, divisor: x.divisor, actual: x.actual, errorPct: x.errorPct, grade: grade(x.errorPct) } : { baud: baud };
    });
    return r;
  }

  function hzText(hz) {
    var steps = [[1e9, 'GHz'], [1e6, 'MHz'], [1e3, 'kHz'], [1, 'Hz']];
    for (var i = 0; i < steps.length; i++) if (hz >= steps[i][0] || i === steps.length - 1) return clean(hz / steps[i][0]) + ' ' + steps[i][1];
  }
  function baudText(b) { return String(Math.round(b * 100) / 100).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function errText(e) { return (e > 0 ? '+' : '') + (Math.abs(e) < 0.005 ? '0.00' : e.toFixed(2)) + '%'; }
  // The value to write into the baud rate register(s).
  function register(r) {
    if (r.mode === 'brr') return 'BRR = ' + r.divisor + ' (0x' + r.divisor.toString(16).toUpperCase() + ')';
    return 'UBRR = ' + (r.divisor - 1);
  }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    en: {
      errors: {
        'clock-empty': function () { return 'Enter the UART clock, for example 16M.'; },
        'clock-format': function () { return 'The clock isn’t a frequency I can read. Use a value like 16, 16MHz, 7.3728M or 8000000Hz.'; },
        'clock-positive': function () { return 'The clock must be greater than 0.'; },
        'baud-empty': function () { return 'Enter a baud rate, for example 115200.'; },
        'baud-format': function () { return 'The baud rate must be a number greater than 0, for example 9600 or 115200.'; },
        'too-fast': function (e) { return 'The clock is too slow for this baud rate. The highest it can reach in this mode is ' + baudText(e.max) + ' baud.'; }
      },
      main: function (r) { return errText(r.errorPct) + ' error'; },
      sub: function (r) { return 'Real baud rate ' + baudText(r.actual) + ' instead of ' + baudText(r.baud) + ', from ' + hzText(r.hz) + '.'; },
      grade: {
        good: 'Under 1%: fine.',
        ok: 'Between 1% and 2%: usually works, but leaves little room for error at the other end.',
        bad: 'Over 2%: likely to give garbled data. Pick another baud rate or a clock such as 7.3728, 11.0592 or 14.7456 MHz.'
      },
      divisorLabel: 'Divisor', divisor: function (r) { return r.mode === 'brr' ? String(r.divisor) : r.divisor + ' (' + register(r) + ' on AVR)'; },
      registerLabel: 'Register', register: function (r) { return r.mode === 'brr' ? register(r) : null; },
      tableHead: ['Baud rate', 'Divisor', 'Real baud rate', 'Error'],
      none: 'too fast',
      baudText: baudText, errText: errText
    },
    'zh-tw': {
      errors: {
        'clock-empty': function () { return '請輸入 UART 的時脈，例如 16M。'; },
        'clock-format': function () { return '看不懂這個時脈，請輸入像 16、16MHz、7.3728M 或 8000000Hz 這樣的值。'; },
        'clock-positive': function () { return '時脈必須大於 0。'; },
        'baud-empty': function () { return '請輸入鮑率，例如 115200。'; },
        'baud-format': function () { return '鮑率必須是大於 0 的數字，例如 9600 或 115200。'; },
        'too-fast': function (e) { return '時脈太低，達不到這個鮑率。這個模式下最高只能到 ' + baudText(e.max) + ' baud。'; }
      },
      main: function (r) { return '誤差 ' + errText(r.errorPct); },
      sub: function (r) { return '實際鮑率 ' + baudText(r.actual) + '，目標 ' + baudText(r.baud) + '，時脈 ' + hzText(r.hz) + '。'; },
      grade: {
        good: '誤差小於 1%，可以放心用。',
        ok: '誤差在 1% 到 2% 之間，通常可以用，但另一端的誤差空間就不多了。',
        bad: '誤差超過 2%，很可能收到亂碼。建議換一個鮑率，或改用 7.3728、11.0592、14.7456 MHz 這類時脈。'
      },
      divisorLabel: '除數', divisor: function (r) { return r.mode === 'brr' ? String(r.divisor) : r.divisor + '（AVR 的 ' + register(r) + '）'; },
      registerLabel: '暫存器', register: function (r) { return r.mode === 'brr' ? register(r) : null; },
      tableHead: ['鮑率', '除數', '實際鮑率', '誤差'],
      none: '太快',
      baudText: baudText, errText: errText
    }
  };

  return { COMMON: COMMON, MODES: MODES, readClock: readClock, readBaud: readBaud, divide: divide, grade: grade,
    calc: calc, hzText: hzText, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = UART;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = UART.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];

  function render() {
    var out = $('uart-result');
    var r = UART.calc($('uart-clock').value, $('uart-baud').value, $('uart-mode').value);
    if (r.error) { out.innerHTML = '<p class="error">' + T.errors[r.error](r) + '</p>'; return; }
    var reg = T.register(r);
    var rows = r.table.map(function (x) {
      if (x.divisor === undefined) return '<tr><td>' + T.baudText(x.baud) + '</td><td colspan="3">' + T.none + '</td></tr>';
      return '<tr' + (x.baud === r.baud ? ' class="best"' : '') + '><td>' + T.baudText(x.baud) + '</td><td>' + x.divisor + '</td><td>' +
        T.baudText(x.actual) + '</td><td class="' + x.grade + '">' + T.errText(x.errorPct) + '</td></tr>';
    }).join('');
    out.innerHTML =
      '<div class="result-main ' + r.grade + '">' + T.main(r) + '</div>' +
      '<div class="result-sub">' + T.sub(r) + '</div>' +
      '<p class="' + (r.grade === 'bad' ? 'error' : r.grade === 'ok' ? 'notice' : 'result-sub') + '">' + T.grade[r.grade] + '</p>' +
      '<dl class="result-list"><dt>' + T.divisorLabel + '</dt><dd>' + T.divisor(r) + '</dd>' +
      (reg ? '<dt>' + T.registerLabel + '</dt><dd>' + reg + '</dd>' : '') + '</dl>' +
      '<div class="table-scroll"><table><thead><tr>' + T.tableHead.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  ['uart-clock', 'uart-baud'].forEach(function (id) { $(id).addEventListener('input', render); });
  $('uart-mode').addEventListener('change', render);

  // Start with a common surprise: 16 MHz at 115200 baud is 3.5% off with 16x oversampling.
  $('uart-clock').value = '16M'; $('uart-baud').value = '115200'; $('uart-mode').value = 'x16';
  render();
});
