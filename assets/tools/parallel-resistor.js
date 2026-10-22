// Parallel and series resistor calculator / 並聯、串聯電阻計算, shared by /en/ and /zh-tw/ pages.
// Pure logic first (testable with node), then page text per language, then DOM wiring.
// Parallel: 1/R = 1/R1 + 1/R2 + ... ; series: R = R1 + R2 + ...
var ELEC = typeof module !== 'undefined' ? require('../elec.js') : window.ELEC;

var PR = (function () {
  var clean = ELEC.clean;
  var MAX_COUNT = 20;

  // Every E24 value from 0.1 Ω to 910 MΩ, for building pairs.
  var E24_ALL = [];
  for (var dec = -1; dec <= 8; dec++) ELEC.E24.forEach(function (v) { E24_ALL.push(clean(v * Math.pow(10, dec - 1))); });

  function combine(values, mode) {
    if (mode === 'series') return clean(values.reduce(function (s, r) { return s + r; }, 0));
    return clean(1 / values.reduce(function (s, r) { return s + 1 / r; }, 0));
  }

  // A list as typed: "10k, 4k7, 2.2k". Commas, semicolons, +, / and | separate values; spaces separate them too
  // when an item doesn't read as one value ("10k 4k7"), but "10 kΩ" stays one value.
  // Returns { values } or { error: 'list-empty' | 'list-format' | 'list-positive' | 'list-one' | 'list-many', item }.
  function parseList(text) {
    var items = String(text == null ? '' : text).split(/[,;，、；+\/|\n]+/).map(function (s) { return s.trim(); })
      .filter(function (s) { return s; });
    if (!items.length) return { error: 'list-empty' };
    var values = [];
    for (var i = 0; i < items.length; i++) {
      var v = ELEC.parseResistance(items[i]);
      if (v !== null) { values.push({ v: v, item: items[i] }); continue; }
      var parts = items[i].split(/\s+/);
      for (var j = 0; j < parts.length; j++) {
        var p = ELEC.parseResistance(parts[j]);
        if (p === null) return { error: 'list-format', item: parts.length > 1 ? parts[j] : items[i] };
        values.push({ v: p, item: parts[j] });
      }
    }
    for (var k = 0; k < values.length; k++) if (!(values[k].v > 0)) return { error: 'list-positive', item: values[k].item };
    if (values.length < 2) return { error: 'list-one' };
    if (values.length > MAX_COUNT) return { error: 'list-many', max: MAX_COUNT };
    return { values: values.map(function (x) { return x.v; }) };
  }

  // Total of a typed list. shares: each resistor's part of the current (parallel) or of the voltage (series), in %.
  function total(text, mode) {
    var l = parseList(text); if (l.error) return l;
    var t = combine(l.values, mode);
    return { mode: mode, total: t, values: l.values,
      shares: l.values.map(function (r) { return clean((mode === 'series' ? r / t : t / r) * 100); }) };
  }

  function withError(ohms, target) { return clean((ohms - target) / target * 100); }

  // The second resistor that, with the one you have, gives the target. Plus the E24 values either side of it.
  function missing(knownText, targetText, mode) {
    var k = ELEC.read(knownText, 'resistance', 'R1'); if (k.error) return k;
    var t = ELEC.read(targetText, 'resistance', 'target'); if (t.error) return t;
    if (mode === 'parallel' && t.v >= k.v * (1 - 1e-12)) return { error: 'parallel-too-high' };
    if (mode === 'series' && t.v <= k.v * (1 + 1e-12)) return { error: 'series-too-low' };
    var exact = clean(mode === 'series' ? t.v - k.v : 1 / (1 / t.v - 1 / k.v));
    var options = ELEC.e24Neighbors(exact).map(function (std) {
      var got = combine([k.v, std], mode);
      return { ohms: std, total: got, errorPct: withError(got, t.v) };
    });
    var best = 0;
    options.forEach(function (o, i) { if (Math.abs(o.errorPct) < Math.abs(options[best].errorPct)) best = i; });
    return { mode: mode, known: k.v, target: t.v, exact: exact, options: options, best: best };
  }

  // Two E24 resistors that come closest to the target. Parallel pairs use values from the target up to 100×;
  // series pairs from 1/100 of the target up to the target. single is the closest single E24 value.
  function pairs(targetText, mode, count) {
    var t = ELEC.read(targetText, 'resistance', 'target'); if (t.error) return t;
    if (t.v < 1 || t.v > 10e6) return { error: 'pair-range' };
    var target = t.v;
    var pool = E24_ALL.filter(function (v) {
      return mode === 'series' ? v <= target * (1 + 1e-9) && v >= target / 100 : v >= target * (1 - 1e-9) && v <= target * 100;
    });
    var list = [];
    for (var i = 0; i < pool.length; i++) {
      for (var j = i; j < pool.length; j++) {
        var got = combine([pool[i], pool[j]], mode);
        list.push({ a: pool[i], b: pool[j], total: got, errorPct: withError(got, target) });
      }
    }
    // Closest first; on a tie, the pair whose two values are nearer each other (it shares the load more evenly).
    list.sort(function (x, y) {
      return Math.abs(x.errorPct) - Math.abs(y.errorPct) || x.b / x.a - y.b / y.a;
    });
    var single = ELEC.e24Neighbors(target).map(function (v) { return { ohms: v, errorPct: withError(v, target) }; })
      .sort(function (x, y) { return Math.abs(x.errorPct) - Math.abs(y.errorPct); })[0];
    return { mode: mode, target: target, single: single, pairs: list.slice(0, count || 5) };
  }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    en: {
      copy: 'Copy', copied: 'Copied',
      errors: {
        'resistance-empty': function (r) { return r.name === 'R1' ? 'Enter the resistor you have, for example 10k.' : 'Enter the total you want, for example 3.3k.'; },
        'resistance-format': function (r) { return (r.name === 'R1' ? 'The resistor you have' : 'The target') + ' isn’t a resistance. Use a value like 10k, 4k7, 220 or 1M.'; },
        'resistance-positive': function (r) { return (r.name === 'R1' ? 'The resistor you have' : 'The target') + ' must be greater than 0 Ω.'; },
        'list-empty': function () { return 'Enter two or more resistors, for example 10k, 4.7k.'; },
        'list-format': function (r) { return '“' + r.item + '” isn’t a resistance. Use values like 10k, 4k7, 220 or 1M, separated by commas.'; },
        'list-positive': function (r) { return '“' + r.item + '” must be greater than 0 Ω.'; },
        'list-one': function () { return 'Add at least one more resistor, separated by a comma.'; },
        'list-many': function (r) { return 'Enter at most ' + r.max + ' resistors.'; },
        'parallel-too-high': function () { return 'In parallel the total is always smaller than each resistor. Enter a target below the resistor you have, or switch to series.'; },
        'series-too-low': function () { return 'In series the total is always larger than each resistor. Enter a target above the resistor you have, or switch to parallel.'; },
        'pair-range': function () { return 'Enter a target between 1 Ω and 10 MΩ.'; }
      },
      totalSub: {
        parallel: function (n, min) { return n + ' resistors in parallel. The total is always below the smallest one (' + min + ').'; },
        series: function (n) { return n + ' resistors in series.'; }
      },
      shareHead: { parallel: 'Share of the current', series: 'Share of the voltage' },
      resistor: 'Resistor', value: 'Value',
      missingName: 'R2',
      closest: function (ohms, tot, err) { return 'Exact value. Closest E24 value: <strong>' + ohms + '</strong>, which gives a total of ' + tot + ' (' + err + ').'; },
      unusual: 'That is outside the usual 1 Ω to 10 MΩ range. Try a different resistor or target.',
      e24: 'E24 R2', totalHead: 'Total', error: 'Error',
      pairMain: { parallel: function (a, b) { return a + ' ∥ ' + b; }, series: function (a, b) { return a + ' + ' + b; } },
      pairSub: function (tot, err, one, oneErr) { return 'Gives ' + tot + ' (' + err + '). A single E24 resistor: ' + one + ' (' + oneErr + ').'; },
      pairHead: 'Pair'
    },
    'zh-tw': {
      copy: '複製', copied: '已複製',
      errors: {
        'resistance-empty': function (r) { return r.name === 'R1' ? '請輸入手上的電阻，例如 10k。' : '請輸入想要的總阻值，例如 3.3k。'; },
        'resistance-format': function (r) { return (r.name === 'R1' ? '手上的電阻' : '目標阻值') + '不是有效的電阻值，請輸入像 10k、4k7、220 或 1M 這樣的值。'; },
        'resistance-positive': function (r) { return (r.name === 'R1' ? '手上的電阻' : '目標阻值') + '必須大於 0 Ω。'; },
        'list-empty': function () { return '請輸入兩個以上的電阻，例如 10k, 4.7k。'; },
        'list-format': function (r) { return '「' + r.item + '」不是有效的電阻值，請輸入像 10k、4k7、220 或 1M 這樣的值，用逗號分開。'; },
        'list-positive': function (r) { return '「' + r.item + '」必須大於 0 Ω。'; },
        'list-one': function () { return '請再輸入至少一個電阻，用逗號分開。'; },
        'list-many': function (r) { return '最多輸入 ' + r.max + ' 個電阻。'; },
        'parallel-too-high': function () { return '並聯後的總阻值一定比每一顆都小，請輸入比手上電阻小的目標，或改成串聯。'; },
        'series-too-low': function () { return '串聯後的總阻值一定比每一顆都大，請輸入比手上電阻大的目標，或改成並聯。'; },
        'pair-range': function () { return '請輸入 1 Ω 到 10 MΩ 之間的目標阻值。'; }
      },
      totalSub: {
        parallel: function (n, min) { return n + ' 顆電阻並聯，總阻值一定比最小的那顆（' + min + '）還小。'; },
        series: function (n) { return n + ' 顆電阻串聯。'; }
      },
      shareHead: { parallel: '分到的電流', series: '分到的電壓' },
      resistor: '電阻', value: '阻值',
      missingName: 'R2',
      closest: function (ohms, tot, err) { return '這是精確值。最接近的 E24 值是 <strong>' + ohms + '</strong>，總阻值 ' + tot + '（' + err + '）。'; },
      unusual: '這個值超出一般 1 Ω 到 10 MΩ 的範圍，請換一個電阻或目標值試試。',
      e24: 'E24 R2', totalHead: '總阻值', error: '誤差',
      pairMain: { parallel: function (a, b) { return a + ' ∥ ' + b; }, series: function (a, b) { return a + ' + ' + b; } },
      pairSub: function (tot, err, one, oneErr) { return '總阻值 ' + tot + '（' + err + '）。只用一顆 E24 電阻：' + one + '（' + oneErr + '）。'; },
      pairHead: '組合'
    }
  };

  return { E24_ALL: E24_ALL, combine: combine, parseList: parseList, total: total, missing: missing, pairs: pairs,
    si: ELEC.si, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = PR;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = PR.TEXT[document.documentElement.lang === 'en' ? 'en' : 'zh-tw'];
  var modes = { total: 'parallel', missing: 'parallel', pairs: 'parallel' };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function errorHtml(r) {
    var safe = {}; for (var k in r) safe[k] = typeof r[k] === 'string' ? esc(r[k]) : r[k];
    return '<p class="error">' + T.errors[r.error](safe) + '</p>';
  }
  function pct(x) { return Math.abs(x) < 5e-7 ? '0%' : (x > 0 ? '+' : '') + Number(x.toPrecision(3)) + '%'; }
  function ohms(v) { return PR.si(v, 'Ω'); }
  function main(id, label, value) {
    return '<div class="result-main">' + label + '<span id="' + id + '">' + value + '</span>' +
      '<button class="copy-btn" type="button" data-copy="' + id + '" data-done="' + T.copied + '">' + T.copy + '</button></div>';
  }

  // ---- Total resistance ----
  function renderTotal() {
    var out = $('total-result');
    var r = PR.total($('total-list').value, modes.total);
    if (r.error) { out.innerHTML = errorHtml(r); return; }
    var rows = r.values.map(function (v, i) {
      return '<tr><td>R' + (i + 1) + '</td><td>' + ohms(v) + '</td><td>' + Number(r.shares[i].toPrecision(3)) + '%</td></tr>';
    }).join('');
    out.innerHTML = main('total-main', 'R = ', ohms(r.total)) +
      '<div class="result-sub">' + T.totalSub[r.mode](r.values.length, ohms(Math.min.apply(null, r.values))) + '</div>' +
      '<div class="table-scroll"><table><thead><tr><th>' + T.resistor + '</th><th>' + T.value + '</th><th>' + T.shareHead[r.mode] +
      '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  // ---- Find the second resistor ----
  function renderMissing() {
    var out = $('missing-result');
    var r = PR.missing($('missing-known').value, $('missing-target').value, modes.missing);
    if (r.error) { out.innerHTML = errorHtml(r); return; }
    var b = r.options[r.best];
    var rows = r.options.map(function (o, i) {
      return '<tr' + (i === r.best ? ' class="best"' : '') + '><td>' + ohms(o.ohms) + '</td><td>' + ohms(o.total) + '</td><td>' + pct(o.errorPct) + '</td></tr>';
    }).join('');
    out.innerHTML = main('missing-main', T.missingName + ' = ', ohms(r.exact)) +
      '<div class="result-sub">' + T.closest(ohms(b.ohms), ohms(b.total), pct(b.errorPct)) + '</div>' +
      (b.ohms < 1 || b.ohms > 10e6 ? '<p class="notice">' + T.unusual + '</p>' : '') +
      '<div class="table-scroll"><table><thead><tr><th>' + T.e24 + '</th><th>' + T.totalHead + '</th><th>' + T.error +
      '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  // ---- Two E24 resistors for a target ----
  function renderPairs() {
    var out = $('pairs-result');
    var r = PR.pairs($('pairs-target').value, modes.pairs);
    if (r.error) { out.innerHTML = errorHtml(r); return; }
    var p = r.pairs[0];
    var rows = r.pairs.map(function (x, i) {
      return '<tr' + (i === 0 ? ' class="best"' : '') + '><td>' + T.pairMain[r.mode](ohms(x.a), ohms(x.b)) + '</td><td>' +
        ohms(x.total) + '</td><td>' + pct(x.errorPct) + '</td></tr>';
    }).join('');
    out.innerHTML = main('pairs-main', '', T.pairMain[r.mode](ohms(p.a), ohms(p.b))) +
      '<div class="result-sub">' + T.pairSub(ohms(p.total), pct(p.errorPct), ohms(r.single.ohms), pct(r.single.errorPct)) + '</div>' +
      '<div class="table-scroll"><table><thead><tr><th>' + T.pairHead + '</th><th>' + T.totalHead + '</th><th>' + T.error +
      '</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  var renders = { total: renderTotal, missing: renderMissing, pairs: renderPairs };
  function setMode(panel, mode) {
    modes[panel] = mode;
    document.querySelectorAll('#' + panel + '-seg button').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    });
    // Each panel has a parallel and a series drawing; show the one in use.
    document.querySelectorAll('#' + panel + '-h ~ .with-schematic .schematic').forEach(function (svg) {
      svg.hidden = svg.dataset.mode !== mode;
    });
    renders[panel]();
  }

  Object.keys(renders).forEach(function (panel) {
    document.querySelectorAll('#' + panel + '-seg button').forEach(function (btn) {
      btn.addEventListener('click', function () { setMode(panel, btn.dataset.mode); });
    });
  });
  $('total-list').addEventListener('input', renderTotal);
  ['missing-known', 'missing-target'].forEach(function (id) { $(id).addEventListener('input', renderMissing); });
  $('pairs-target').addEventListener('input', renderPairs);

  // Start with common cases: 10k ∥ 4.7k, a 10k that needs to come down to 3.3k, and 8k from two E24 values.
  $('total-list').value = '10k, 4.7k';
  $('missing-known').value = '10k'; $('missing-target').value = '3.3k';
  $('pairs-target').value = '8k';
  Object.keys(renders).forEach(function (panel) { setMode(panel, 'parallel'); });
});
