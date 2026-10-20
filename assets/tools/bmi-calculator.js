// BMI calculator / BMI 計算, shared by /zh-tw/ and /en/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// zh-tw pages use Taiwan's Health Promotion Administration cut-offs, en pages use WHO's.
var BMI = (function () {
  // Each band is [upper bound (exclusive), key].
  var STANDARDS = {
    tw: [[18.5, 'under'], [24, 'normal'], [27, 'over'], [30, 'obese1'], [35, 'obese2'], [Infinity, 'obese3']],
    who: [[18.5, 'under'], [25, 'normal'], [30, 'over'], [35, 'obese1'], [40, 'obese2'], [Infinity, 'obese3']]
  };
  var LB = 0.45359237, INCH = 0.0254;

  function round1(x) { return Math.round(x * 10 + 1e-9) / 10; }

  // Number from text: half- or full-width digits, optional decimal point. Returns a number, null for empty, NaN otherwise.
  function readNumber(text) {
    var s = String(text == null ? '' : text).replace(/\s+/g, '')
      .replace(/[０-９．]/g, function (c) { return c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xFEE0); });
    if (!s) return null;
    return /^(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : NaN;
  }

  // BMI as text, normally 1 decimal. When rounding would cross a cut-off (23.96 would show as 24.0 but is still
  // healthy), show 2 decimals, truncated, so the number shown always agrees with the category.
  function shown(bmi, standard) {
    var one = round1(bmi).toFixed(1);
    if (classify(Number(one), standard) === classify(bmi, standard)) return one;
    return (Math.floor(bmi * 100 + 1e-9) / 100).toFixed(2);
  }

  function classify(bmi, standard) {
    var bands = STANDARDS[standard];
    for (var i = 0; i < bands.length; i++) if (bmi < bands[i][0]) return bands[i][1];
  }

  // Healthy weight range in kg for a height in metres: from 18.5 up to (not including) the "over" cut-off.
  function healthyRange(m, standard) {
    var top = STANDARDS[standard][1][0];
    return { min: 18.5 * m * m, max: top * m * m };
  }

  // input: { system: 'metric', cm, kg } or { system: 'us', ft, inch, lb }, values as typed.
  // Returns { bmi, key, m, kg, range } or { error: code }.
  function compute(input, standard) {
    var m, kg;
    if (input.system === 'us') {
      var ft = readNumber(input.ft), inch = readNumber(input.inch), lb = readNumber(input.lb);
      if (ft === null && inch === null) return { error: 'height-empty' };
      if (Number.isNaN(ft) || Number.isNaN(inch)) return { error: 'height-number' };
      m = ((ft || 0) * 12 + (inch || 0)) * INCH;
      if (lb === null) return { error: 'weight-empty' };
      if (Number.isNaN(lb)) return { error: 'weight-number' };
      kg = lb * LB;
    } else {
      var cm = readNumber(input.cm), w = readNumber(input.kg);
      if (cm === null) return { error: 'height-empty' };
      if (Number.isNaN(cm)) return { error: 'height-number' };
      m = cm / 100;
      if (w === null) return { error: 'weight-empty' };
      if (Number.isNaN(w)) return { error: 'weight-number' };
      kg = w;
    }
    if (m < 0.5 || m > 2.75) return { error: 'height-range' };
    if (kg < 2 || kg > 650) return { error: 'weight-range' };
    var bmi = kg / (m * m);
    return { bmi: bmi, shown: shown(bmi, standard), key: classify(bmi, standard), m: m, kg: kg, range: healthyRange(m, standard) };
  }

  var KG_TO_LB = 1 / LB;
  function fmt(x) { return String(round1(x)); }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    'zh-tw': {
      standard: 'tw', defaultSystem: 'metric', copy: '複製', copied: '已複製',
      names: { under: '體重過輕', normal: '健康體位', over: '過重', obese1: '輕度肥胖', obese2: '中度肥胖', obese3: '重度肥胖' },
      errors: {
        'height-empty': '請輸入身高。', 'height-number': '身高只能是數字，例如 170。',
        'height-range': '身高看起來不太對，請確認單位（公分或英尺、英寸）。',
        'weight-empty': '請輸入體重。', 'weight-number': '體重只能是數字，例如 65。',
        'weight-range': '體重看起來不太對，請確認單位（公斤或磅）。'
      },
      categoryLabel: '分類', rangeLabel: '健康體重', gapLabel: '和健康範圍相比',
      range: function (r, us) { return us ? fmt(r.min * KG_TO_LB) + ' 到 ' + fmt(r.max * KG_TO_LB) + ' 磅' : fmt(r.min) + ' 到 ' + fmt(r.max) + ' 公斤'; },
      gap: function (diff, us) {
        if (diff === 0) return '在健康範圍內';
        var x = round1(Math.abs(diff) * (us ? KG_TO_LB : 1)), unit = us ? ' 磅' : ' 公斤';
        return (diff > 0 ? '多' : '少') + (x === 0 ? '不到 0.1' : '約 ' + x) + unit;
      },
      note: '依國健署成人標準，健康體位是 18.5 ≤ BMI < 24。'
    },
    en: {
      standard: 'who', defaultSystem: 'us', copy: 'Copy', copied: 'Copied',
      names: { under: 'Underweight', normal: 'Healthy weight', over: 'Overweight', obese1: 'Obesity class 1', obese2: 'Obesity class 2', obese3: 'Obesity class 3' },
      errors: {
        'height-empty': 'Enter your height.', 'height-number': 'Height must be a number, for example 5 and 9.',
        'height-range': 'That height doesn’t look right. Check the units (feet and inches, or cm).',
        'weight-empty': 'Enter your weight.', 'weight-number': 'Weight must be a number, for example 160.',
        'weight-range': 'That weight doesn’t look right. Check the units (lb or kg).'
      },
      categoryLabel: 'Category', rangeLabel: 'Healthy weight', gapLabel: 'Compared with that range',
      range: function (r, us) { return us ? fmt(r.min * KG_TO_LB) + ' to ' + fmt(r.max * KG_TO_LB) + ' lb' : fmt(r.min) + ' to ' + fmt(r.max) + ' kg'; },
      gap: function (diff, us) {
        if (diff === 0) return 'Within the healthy range';
        var x = round1(Math.abs(diff) * (us ? KG_TO_LB : 1)), unit = us ? ' lb' : ' kg';
        return (x === 0 ? 'Less than 0.1' : 'About ' + x) + unit + (diff > 0 ? ' above' : ' below');
      },
      note: 'WHO adult categories: a healthy weight is a BMI from 18.5 to under 25.'
    }
  };

  // kg above (positive) or below (negative) the healthy range, 0 inside it.
  function gap(r) {
    if (r.kg < r.range.min) return r.kg - r.range.min;
    if (r.kg >= r.range.max) return r.kg - r.range.max;
    return 0;
  }

  return { STANDARDS: STANDARDS, readNumber: readNumber, classify: classify, healthyRange: healthyRange,
    compute: compute, gap: gap, shown: shown, round1: round1, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = BMI;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = BMI.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var system = T.defaultSystem;

  function render() {
    var out = $('bmi-result');
    var r = BMI.compute(system === 'us'
      ? { system: 'us', ft: $('height-ft').value, inch: $('height-in').value, lb: $('weight-lb').value }
      : { system: 'metric', cm: $('height-cm').value, kg: $('weight-kg').value }, T.standard);
    if (r.error) { out.innerHTML = '<p class="error">' + T.errors[r.error] + '</p>'; return; }
    var us = system === 'us';
    out.innerHTML =
      '<div class="result-main">BMI <span id="bmi-main">' + r.shown + '</span>' +
      '<button class="copy-btn" type="button" data-copy="bmi-main" data-done="' + T.copied + '">' + T.copy + '</button></div>' +
      '<dl class="result-list"><dt>' + T.categoryLabel + '</dt><dd><strong>' + T.names[r.key] + '</strong></dd>' +
      '<dt>' + T.rangeLabel + '</dt><dd>' + T.range(r.range, us) + '</dd>' +
      '<dt>' + T.gapLabel + '</dt><dd>' + T.gap(BMI.gap(r), us) + '</dd></dl>' +
      '<p class="result-sub">' + T.note + '</p>';
    document.querySelectorAll('#bmi-table tr[data-key]').forEach(function (tr) {
      tr.classList.toggle('best', tr.dataset.key === r.key);
    });
  }

  function setSystem(next) {
    system = next;
    document.querySelectorAll('#system-seg button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.system === system));
    });
    $('metric-fields').hidden = system !== 'metric';
    $('us-fields').hidden = system !== 'us';
    render();
  }

  document.querySelectorAll('#system-seg button').forEach(function (b) {
    b.addEventListener('click', function () { setSystem(b.dataset.system); });
  });
  ['height-cm', 'weight-kg', 'height-ft', 'height-in', 'weight-lb'].forEach(function (id) { $(id).addEventListener('input', render); });

  // Start with an average adult so the page shows a result right away.
  $('height-cm').value = '170'; $('weight-kg').value = '65';
  $('height-ft').value = '5'; $('height-in').value = '9'; $('weight-lb').value = '160';
  setSystem(system);
});
