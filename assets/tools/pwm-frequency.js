// PWM frequency calculator / PWM 頻率計算, shared by /en/ and /zh-tw/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// A timer counts the prescaled clock up to ARR and starts again. Edge-aligned (up counting):
// f = clock / ((PSC + 1) × (ARR + 1)). Center-aligned (up/down): f = clock / ((PSC + 1) × 2 × ARR).
// The same form fits AVR fast / phase-correct PWM, where the prescaler N is chosen from a fixed list (N = PSC + 1)
// and TOP plays the part of ARR. presc is 'stm32' (PSC register, any value) or 'avr' (one of AVR_DIV).
var PWM = (function () {
  var PSC_MAX = 65535;
  var ARR_MAX = { 8: 255, 16: 65535, 32: 4294967295 };
  var AVR_DIV = [1, 8, 32, 64, 128, 256, 1024]; // 32 and 128 exist on Timer2 of the ATmega328P only

  function clean(x) { return Number(x.toPrecision(12)); }

  // Frequency as typed: 72, 72M, 72MHz, 20k, 8000000Hz. A bare number is multiplied by bare (1e6 for the clock
  // field, 1 for the target frequency); "m" is mega here. Returns { hz } or { error: name + '-empty' | '-format' | '-positive' }.
  function readFreq(text, name, bare) {
    var s = String(text == null ? '' : text).trim().toLowerCase().replace(/[\s,]/g, '');
    if (!s) return { error: name + '-empty' };
    var m = s.match(/^(\d+\.?\d*|\.\d+)([kmg]?)(hz)?$/);
    if (!m) return { error: name + '-format' };
    var scale = m[2] ? { k: 1e3, m: 1e6, g: 1e9 }[m[2]] : m[3] ? 1 : bare;
    var hz = clean(Number(m[1]) * scale);
    return hz > 0 ? { hz: hz } : { error: name + '-positive' };
  }

  // A register value: 0..max, decimal or 0x hex. Returns { v } or { error: name + '-empty' | '-format' | '-range', max }.
  function readReg(text, name, max) {
    var s = String(text == null ? '' : text).trim().toLowerCase().replace(/[\s,_]/g, '');
    if (!s) return { error: name + '-empty' };
    var v = /^\d+$/.test(s) ? Number(s) : /^0x[0-9a-f]+$/.test(s) ? parseInt(s.slice(2), 16) : null;
    if (v === null) return { error: name + '-format' };
    if (v > max) return { error: name + '-range', max: max };
    return { v: v };
  }

  // Counts in one PWM period for a given ARR.
  function steps(arr, mode) { return mode === 'center' ? 2 * arr : arr + 1; }

  // Clock, PSC, ARR (and a duty cycle in %) -> frequency, period, resolution and the compare value.
  // For presc 'avr', pscText is the prescaler N itself.
  function forward(clockText, pscText, arrText, mode, dutyText, arrBits, presc) {
    var c = readFreq(clockText, 'clock', 1e6); if (c.error) return c;
    var p;
    if (presc === 'avr') {
      p = AVR_DIV.indexOf(Number(pscText)) < 0 ? { error: 'div-format' } : { v: Number(pscText) - 1 };
    } else {
      p = readReg(pscText, 'psc', PSC_MAX);
    }
    if (p.error) return p;
    var a = readReg(arrText, 'arr', ARR_MAX[arrBits]); if (a.error) return a;
    if (a.v < 1) return { error: 'arr-small' };
    var duty = String(dutyText == null ? '' : dutyText).trim().replace(/%$/, '');
    var d = duty === '' ? null : /^(\d+\.?\d*|\.\d+)$/.test(duty) ? Number(duty) : NaN;
    if (Number.isNaN(d) || d > 100) return { error: 'duty-format' };
    var tick = c.hz / (p.v + 1);
    var n = mode === 'center' ? 2 * a.v : a.v + 1;
    var freq = tick / n;
    // Duty = CCR / (ARR + 1) edge-aligned, CCR / ARR center-aligned, so both use the counts per half or full period.
    var top = mode === 'center' ? a.v : a.v + 1;
    var ccr = d === null ? null : Math.round(d / 100 * top);
    return { hz: c.hz, psc: p.v, div: p.v + 1, arr: a.v, mode: mode, tick: clean(tick), freq: clean(freq), period: clean(1 / freq),
      steps: top, bits: clean(Math.log2(top)), dutyStep: clean(100 / top),
      duty: d, ccr: ccr, dutyReal: ccr === null ? null : clean(ccr / top * 100) };
  }

  // Clock and target frequency -> PSC and ARR. rows[0] is the highest resolution (smallest PSC); the rest are
  // settings that get closer to the target, closest first.
  function solve(clockText, targetText, mode, arrBits, presc) {
    var c = readFreq(clockText, 'clock', 1e6); if (c.error) return c;
    var t = readFreq(targetText, 'target', 1); if (t.error) return t;
    var maxArr = ARR_MAX[arrBits];
    var total = c.hz / t.hz; // clock cycles per PWM period
    var minSteps = mode === 'center' ? 4 : 2; // ARR of at least 1 (edge) or 2 (center), so the output can toggle
    if (total < minSteps - 0.5) return { error: 'too-fast', max: clean(c.hz / minSteps) };
    var divs = presc === 'avr' ? AVR_DIV : null, last = divs ? divs.length : PSC_MAX + 1;
    var list = [];
    for (var i = 0; i < last; i++) {
      var p = divs ? divs[i] : i + 1;
      var arr = mode === 'center' ? Math.round(total / (2 * p)) : Math.round(total / p) - 1;
      if (arr > maxArr) continue;
      if (steps(arr, mode) < minSteps) break; // larger prescalers only make it coarser
      var f = c.hz / (p * steps(arr, mode));
      list.push({ psc: p - 1, div: p, arr: arr, freq: clean(f), errorPct: clean((f - t.hz) / t.hz * 100),
        steps: mode === 'center' ? arr : arr + 1 });
    }
    if (!list.length) return { error: 'too-slow', min: clean(c.hz / ((divs ? divs[last - 1] : PSC_MAX + 1) * steps(maxArr, mode))) };
    var first = list[0];
    var better = list.slice(1).filter(function (x) { return Math.abs(x.errorPct) < Math.abs(first.errorPct) - 1e-12; })
      .sort(function (x, y) { return Math.abs(x.errorPct) - Math.abs(y.errorPct) || x.psc - y.psc; });
    return { hz: c.hz, target: t.hz, mode: mode, presc: presc, rows: [first].concat(better.slice(0, 4)) };
  }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    en: {
      copy: 'Copy', copied: 'Copied',
      errors: {
        'clock-empty': function () { return 'Enter the timer clock, for example 72 (MHz).'; },
        'clock-format': function () { return 'The clock isn’t a frequency. Use a value like 72, 16M or 8000000Hz.'; },
        'clock-positive': function () { return 'The clock must be greater than 0.'; },
        'target-empty': function () { return 'Enter the PWM frequency you want, for example 20k.'; },
        'target-format': function () { return 'The target isn’t a frequency. Use a value like 1000, 20k or 1.5M.'; },
        'target-positive': function () { return 'The target frequency must be greater than 0.'; },
        'psc-empty': function () { return 'Enter the prescaler PSC, for example 0.'; },
        'psc-format': function () { return 'PSC must be a whole number such as 0 or 71.'; },
        'psc-range': function (r) { return 'PSC goes up to ' + r.max + '.'; },
        'arr-empty': function () { return 'Enter ARR, for example 999.'; },
        'arr-format': function () { return 'ARR must be a whole number such as 999 or 0xFFFF.'; },
        'arr-range': function (r) { return 'ARR goes up to ' + r.max + ' on this timer. Choose a wider timer, or a larger prescaler.'; },
        'div-format': function () { return 'Choose an AVR prescaler: 1, 8, 32, 64, 128, 256 or 1024.'; },
        'arr-small': function () { return 'ARR must be at least 1.'; },
        'duty-format': function () { return 'Enter the duty cycle as a number from 0 to 100, or leave it empty.'; },
        'too-fast': function (r) { return 'Too fast for this clock. The highest PWM frequency is ' + hzText(r.max) + '.'; },
        'too-slow': function (r) { return 'Too slow for this timer. The lowest frequency is ' + hzText(r.min) + '; choose a wider timer or a slower clock.'; }
      },
      tick: 'Counter clock', period: 'Period', resolution: 'Resolution',
      stepsText: function (n, bits) { return n.toLocaleString('en-US') + ' steps (' + bits + ' bits)'; },
      dutyStep: 'Duty cycle step',
      ccr: function (ccr, real) { return 'CCR = ' + ccr + ' gives ' + real + '% duty'; },
      ccrLabel: 'Compare value',
      solveSub: function (f, err) { return 'Gives ' + f + ' (' + err + ') with the finest duty cycle steps.'; },
      head: { psc: 'PSC', arr: 'ARR', freq: 'Frequency', error: 'Error', steps: 'Steps' },
      avrHead: { psc: 'N', arr: 'TOP' }
    },
    'zh-tw': {
      copy: '複製', copied: '已複製',
      errors: {
        'clock-empty': function () { return '請輸入計時器時脈，例如 72（MHz）。'; },
        'clock-format': function () { return '時脈不是有效的頻率，請輸入像 72、16M 或 8000000Hz 這樣的值。'; },
        'clock-positive': function () { return '時脈必須大於 0。'; },
        'target-empty': function () { return '請輸入想要的 PWM 頻率，例如 20k。'; },
        'target-format': function () { return '目標頻率不是有效的值，請輸入像 1000、20k 或 1.5M 這樣的值。'; },
        'target-positive': function () { return '目標頻率必須大於 0。'; },
        'psc-empty': function () { return '請輸入預除頻 PSC，例如 0。'; },
        'psc-format': function () { return 'PSC 要是整數，例如 0 或 71。'; },
        'psc-range': function (r) { return 'PSC 最大是 ' + r.max + '。'; },
        'arr-empty': function () { return '請輸入 ARR，例如 999。'; },
        'arr-format': function () { return 'ARR 要是整數，例如 999 或 0xFFFF。'; },
        'arr-range': function (r) { return '這個計時器的 ARR 最大是 ' + r.max + '，請改選位元數比較多的計時器，或加大預除頻。'; },
        'div-format': function () { return '請選 AVR 的預除頻：1、8、32、64、128、256 或 1024。'; },
        'arr-small': function () { return 'ARR 至少要是 1。'; },
        'duty-format': function () { return '佔空比請輸入 0 到 100 的數字，或留空。'; },
        'too-fast': function (r) { return '這個時脈跑不到這麼快，PWM 頻率最高是 ' + hzText(r.max) + '。'; },
        'too-slow': function (r) { return '這個計時器跑不到這麼慢，最低是 ' + hzText(r.min) + '，請改選位元數比較多的計時器或降低時脈。'; }
      },
      tick: '計數時脈', period: '週期', resolution: '解析度',
      stepsText: function (n, bits) { return n.toLocaleString('en-US') + ' 階（' + bits + ' 位元）'; },
      dutyStep: '佔空比每階',
      ccr: function (ccr, real) { return 'CCR = ' + ccr + '，佔空比 ' + real + '%'; },
      ccrLabel: '比較值',
      solveSub: function (f, err) { return '實際 ' + f + '（' + err + '），佔空比可以調得最細。'; },
      head: { psc: 'PSC', arr: 'ARR', freq: '頻率', error: '誤差', steps: '階數' },
      avrHead: { psc: 'N', arr: 'TOP' }
    }
  };

  // 4394.26 Hz, 20 kHz, 1.09863 kHz: up to 6 significant digits.
  function hzText(hz) {
    var steps = [[1e9, 'GHz'], [1e6, 'MHz'], [1e3, 'kHz'], [1, 'Hz'], [1e-3, 'mHz']];
    for (var i = 0; i < steps.length; i++) {
      if (hz >= steps[i][0] || i === steps.length - 1) return Number((hz / steps[i][0]).toPrecision(6)) + ' ' + steps[i][1];
    }
  }

  return { PSC_MAX: PSC_MAX, ARR_MAX: ARR_MAX, AVR_DIV: AVR_DIV, readFreq: readFreq, readReg: readReg, forward: forward, solve: solve,
    hzText: hzText, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = PWM;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = PWM.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];

  function errorHtml(r) { return '<p class="error">' + T.errors[r.error](r) + '</p>'; }
  function pct(x) { return Math.abs(x) < 5e-7 ? '0%' : (x > 0 ? '+' : '') + Number(x.toPrecision(3)) + '%'; }
  function main(id, label, value) {
    return '<div class="result-main">' + label + '<span id="' + id + '">' + value + '</span>' +
      '<button class="copy-btn" type="button" data-copy="' + id + '" data-done="' + T.copied + '">' + T.copy + '</button></div>';
  }
  function item(dt, dd) { return '<dt>' + dt + '</dt><dd>' + dd + '</dd>'; }
  function seconds(s) { return ELEC.si(s, 's'); }
  function bitsText(b) { return String(Number(b.toFixed(2))); }

  function renderForward() {
    var out = $('fwd-result');
    var avr = $('fwd-presc').value === 'avr';
    var r = PWM.forward($('fwd-clock').value, avr ? $('fwd-div').value : $('fwd-psc').value, $('fwd-arr').value,
      $('fwd-mode').value, $('fwd-duty').value, $('fwd-bits').value, $('fwd-presc').value);
    if (r.error) { out.innerHTML = errorHtml(r); return; }
    out.innerHTML = main('fwd-main', 'f = ', PWM.hzText(r.freq)) +
      '<dl class="result-list">' +
      item(T.period, seconds(r.period)) + item(T.tick, PWM.hzText(r.tick)) +
      item(T.resolution, T.stepsText(r.steps, bitsText(r.bits))) + item(T.dutyStep, Number(r.dutyStep.toPrecision(3)) + '%') +
      (r.ccr === null ? '' : item(T.ccrLabel, T.ccr(r.ccr, Number(r.dutyReal.toPrecision(6))))) + '</dl>';
  }

  function renderSolve() {
    var out = $('solve-result');
    var r = PWM.solve($('solve-clock').value, $('solve-target').value, $('solve-mode').value, $('solve-bits').value, $('solve-presc').value);
    if (r.error) { out.innerHTML = errorHtml(r); return; }
    var avr = r.presc === 'avr';
    var h = avr ? T.avrHead : T.head;
    var reg = function (x) { return avr ? x.div : x.psc; };
    var b = r.rows[0];
    var rows = r.rows.map(function (x, i) {
      return '<tr' + (i === 0 ? ' class="best"' : '') + '><td>' + reg(x) + '</td><td>' + x.arr + '</td><td>' + PWM.hzText(x.freq) +
        '</td><td>' + pct(x.errorPct) + '</td><td>' + x.steps.toLocaleString('en-US') + '</td></tr>';
    }).join('');
    out.innerHTML = main('solve-main', '', h.psc + ' = ' + reg(b) + ', ' + h.arr + ' = ' + b.arr) +
      '<div class="result-sub">' + T.solveSub(PWM.hzText(b.freq), pct(b.errorPct)) + '</div>' +
      '<div class="table-scroll"><table><thead><tr><th>' + h.psc + '</th><th>' + h.arr + '</th><th>' + T.head.freq +
      '</th><th>' + T.head.error + '</th><th>' + T.head.steps + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  ['fwd-clock', 'fwd-psc', 'fwd-arr', 'fwd-duty'].forEach(function (id) { $(id).addEventListener('input', renderForward); });
  ['fwd-mode', 'fwd-bits', 'fwd-div'].forEach(function (id) { $(id).addEventListener('change', renderForward); });
  // An AVR prescaler is picked from a list instead of typed as a register value.
  $('fwd-presc').addEventListener('change', function () {
    var avr = $('fwd-presc').value === 'avr';
    $('fwd-psc-field').hidden = avr;
    $('fwd-div-field').hidden = !avr;
    renderForward();
  });
  ['solve-clock', 'solve-target'].forEach(function (id) { $(id).addEventListener('input', renderSolve); });
  ['solve-mode', 'solve-bits', 'solve-presc'].forEach(function (id) { $(id).addEventListener('change', renderSolve); });

  // Start with a 72 MHz STM32 timer: ARR 16383 (about 4.4 kHz), and a 20 kHz target (above hearing, common for motors).
  $('fwd-clock').value = '72'; $('fwd-psc').value = '0'; $('fwd-arr').value = '16383'; $('fwd-duty').value = '50';
  $('solve-clock').value = '72'; $('solve-target').value = '20k';
  renderForward();
  renderSolve();
});
