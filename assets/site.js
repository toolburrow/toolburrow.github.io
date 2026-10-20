// Shared by every page: language choice, theme toggle, copy buttons.

// Picks the site language from a saved choice, the browser languages and the time zone.
// Traditional Chinese or Taiwan / Hong Kong / Macau → 'zh-tw'; everything else, including
// Simplified Chinese, → 'en'. Nothing here leaves the browser.
var SiteLang = {
  LANGS: ['zh-tw', 'en'],
  ZH_ZONES: ['Asia/Taipei', 'Asia/Hong_Kong', 'Asia/Macau'],

  // languages: e.g. navigator.languages; timeZone: e.g. 'Asia/Taipei'.
  detect: function (languages, timeZone) {
    var list = languages || [];
    for (var i = 0; i < list.length; i++) {
      var parts = String(list[i]).toLowerCase().replace(/_/g, '-').split('-');
      if (parts[0] !== 'zh') continue;
      // The first Chinese entry decides. Script beats region (zh-Hans-HK is Simplified).
      if (parts.indexOf('hant') > 0) return 'zh-tw';
      if (parts.indexOf('hans') > 0) return 'en';
      if (parts.indexOf('tw') > 0 || parts.indexOf('hk') > 0 || parts.indexOf('mo') > 0) return 'zh-tw';
      if (parts.length > 1) return 'en'; // zh-CN, zh-SG, zh-MY
      break; // bare "zh": let the time zone decide
    }
    return SiteLang.ZH_ZONES.indexOf(timeZone) >= 0 ? 'zh-tw' : 'en';
  },

  // A saved choice always wins over detection.
  choose: function (saved, languages, timeZone) {
    return SiteLang.LANGS.indexOf(saved) >= 0 ? saved : SiteLang.detect(languages, timeZone);
  }
};
if (typeof module !== 'undefined') module.exports = SiteLang;

if (typeof document !== 'undefined') (function () {
  var root = document.documentElement;
  var LANG_KEY = 'tb-lang';

  function savedLang() {
    try { return localStorage.getItem(LANG_KEY); } catch (e) { return null; }
  }
  function saveLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  }
  function preferredLang() {
    var zone = '';
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
    return SiteLang.choose(savedLang(), navigator.languages || [navigator.language], zone);
  }

  // The root page only picks a language and moves on; its bilingual content is the no-JS fallback.
  if (location.pathname === '/' || location.pathname === '/index.html') {
    location.replace('/' + preferredLang() + '/');
    return;
  }

  try {
    var saved = localStorage.getItem('tb-theme');
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) {}

  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Offers the other language version of this page when the reader prefers it.
  // Only pages with a <link rel="alternate" hreflang> counterpart get the offer.
  function offerOtherLanguage() {
    var pageLang = root.lang === 'en' ? 'en' : 'zh-tw';
    var want = preferredLang();
    if (want === pageLang) return;
    var alt = document.querySelector('link[rel="alternate"][hreflang="' + (want === 'en' ? 'en' : 'zh-Hant') + '"]');
    var header = document.querySelector('.site-header');
    if (!alt || !header) return;
    var text = want === 'en'
      ? { msg: 'This page is also available in English.', go: 'Read in English', close: 'Stay on this page' }
      : { msg: '這一頁也有中文版。', go: '看中文版', close: '留在這一頁' };
    var bar = document.createElement('div');
    bar.className = 'lang-offer';
    bar.lang = want === 'en' ? 'en' : 'zh-Hant-TW';
    bar.innerHTML = '<div class="wrap"><span></span><a data-set-lang="' + want + '"></a><button type="button">×</button></div>';
    bar.querySelector('span').textContent = text.msg;
    var link = bar.querySelector('a');
    link.textContent = text.go;
    link.href = alt.getAttribute('href').replace(/^https:\/\/[^/]+/, '');
    var close = bar.querySelector('button');
    close.setAttribute('aria-label', text.close);
    close.addEventListener('click', function () { saveLang(pageLang); bar.remove(); });
    header.after(bar);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      var paint = function () { btn.textContent = currentTheme() === 'dark' ? '☀' : '☾'; };
      paint();
      btn.addEventListener('click', function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        try { localStorage.setItem('tb-theme', next); } catch (e) {}
        paint();
      });
    }

    offerOtherLanguage();

    document.addEventListener('click', function (ev) {
      // <a data-set-lang="en"> remembers the reader's language choice.
      var l = ev.target.closest('[data-set-lang]');
      if (l) saveLang(l.getAttribute('data-set-lang'));

      // <button data-copy="elementId"> copies that element's text.
      var b = ev.target.closest('[data-copy]');
      if (!b) return;
      var el = document.getElementById(b.getAttribute('data-copy'));
      if (!el || !navigator.clipboard) return;
      navigator.clipboard.writeText(el.textContent.trim()).then(function () {
        var old = b.textContent;
        b.textContent = b.getAttribute('data-done') || '✓';
        setTimeout(function () { b.textContent = old; }, 1200);
      });
    });
  });
})();
