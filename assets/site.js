// Shared by every page: theme toggle + copy buttons.
(function () {
  var root = document.documentElement;
  try {
    var saved = localStorage.getItem('tb-theme');
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) {}

  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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

    // <button data-copy="elementId"> copies that element's text.
    document.addEventListener('click', function (ev) {
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
