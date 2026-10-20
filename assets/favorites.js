// Favorites: a ☆ button on every tool page, a "my favorites" list at the top of the language home pages,
// and a link that carries the list to another device. The list lives only in this browser's localStorage.
// Tool pages and the two language home pages load this script.
var FAV = (function () {
  var KEY = 'tb-fav';
  var MAX = 50;
  var ID = /^[a-z]+\/[a-z0-9]+(?:-[a-z0-9]+)*$/; // "<category>/<slug>", the same in both languages

  // Keeps valid ids only, without duplicates, at most MAX.
  function clean(list) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (id) {
      if (typeof id === 'string' && ID.test(id) && out.indexOf(id) < 0 && out.length < MAX) out.push(id);
    });
    return out;
  }

  // Stored text -> list. Anything broken gives an empty list rather than an error.
  function parse(text) {
    try { return clean(JSON.parse(text)); } catch (e) { return []; }
  }

  function toggle(list, id) {
    return list.indexOf(id) >= 0 ? list.filter(function (x) { return x !== id; }) : clean(list.concat([id]));
  }

  // "/zh-tw/life/bmi-calculator/" -> { lang: 'zh-tw', id: 'life/bmi-calculator' }; null for other pages.
  function fromPath(pathname) {
    var m = String(pathname).match(/^\/(zh-tw|en)\/([a-z]+\/[a-z0-9-]+)\/(?:index\.html)?$/);
    return m && ID.test(m[2]) ? { lang: m[1], id: m[2] } : null;
  }

  // Share link: https://toollamp.github.io/zh-tw/?fav=life/bmi-calculator,electronics/ohms-law
  function shareUrl(origin, lang, list) { return origin + '/' + lang + '/?fav=' + list.join(','); }

  // Ids from a share link's query string ("?fav=a/b,c/d"), or [] when it has none.
  function fromQuery(search) {
    var m = String(search).match(/[?&]fav=([^&#]*)/);
    if (!m) return [];
    var v; try { v = decodeURIComponent(m[1]); } catch (e) { return []; }
    return clean(v.split(','));
  }

  // Ids in the shared list that are not yet in mine.
  function incoming(mine, shared) { return shared.filter(function (id) { return mine.indexOf(id) < 0; }); }

  // Everything the script writes on the page, per language. Both languages must have the same keys.
  var TEXT = {
    'zh-tw': {
      add: '☆ 加入收藏', added: '★ 已收藏', addLabel: '加入我的收藏', removeLabel: '從我的收藏移除',
      title: '我的收藏', empty: '在工具頁按「☆ 加入收藏」，常用的工具就會出現在這裡。',
      remove: function (name) { return '從收藏移除「' + name + '」'; },
      copy: '複製收藏連結', copied: '已複製', copyFailed: '請手動複製這個連結：',
      hint: '在另一台裝置打開這個連結，就能把收藏帶過去。',
      offer: function (n) { return '這個連結帶有 ' + n + ' 個收藏的工具。'; },
      accept: '加入我的收藏', dismiss: '略過'
    },
    en: {
      add: '☆ Add to favorites', added: '★ In favorites', addLabel: 'Add to my favorites', removeLabel: 'Remove from my favorites',
      title: 'My favorites', empty: 'Press “☆ Add to favorites” on a tool page and your tools will show up here.',
      remove: function (name) { return 'Remove ' + name + ' from favorites'; },
      copy: 'Copy favorites link', copied: 'Copied', copyFailed: 'Copy this link yourself:',
      hint: 'Open this link on another device to bring your favorites along.',
      offer: function (n) { return 'This link has ' + n + (n === 1 ? ' favorite tool.' : ' favorite tools.'); },
      accept: 'Add to my favorites', dismiss: 'Skip'
    }
  };

  return { KEY: KEY, MAX: MAX, clean: clean, parse: parse, toggle: toggle, fromPath: fromPath, shareUrl: shareUrl,
    fromQuery: fromQuery, incoming: incoming, TEXT: TEXT };
})();

if (typeof module !== 'undefined') module.exports = FAV;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  var lang = document.documentElement.lang === 'en' ? 'en' : 'zh-tw';
  var T = FAV.TEXT[lang];

  // Redraw when the page comes back from the back/forward cache (no reload, so the list may be stale)
  // or when another tab changes the favorites.
  function refreshOn(fn) {
    window.addEventListener('pageshow', function (ev) { if (ev.persisted) fn(); });
    window.addEventListener('storage', function (ev) { if (ev.key === FAV.KEY) fn(); });
  }

  function load() { try { return FAV.parse(localStorage.getItem(FAV.KEY)); } catch (e) { return []; } }
  function save(list) { try { localStorage.setItem(FAV.KEY, JSON.stringify(list)); } catch (e) {} }

  // ---- Tool page: the ☆ button under the title ----
  var page = FAV.fromPath(location.pathname);
  var h1 = document.querySelector('.page-head h1');
  if (page && h1) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fav-btn';
    var paint = function () {
      var on = load().indexOf(page.id) >= 0;
      btn.textContent = on ? T.added : T.add;
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? T.removeLabel : T.addLabel);
    };
    btn.addEventListener('click', function () { save(FAV.toggle(load(), page.id)); paint(); });
    paint();
    h1.after(btn);
    refreshOn(paint);
    return;
  }

  // ---- Home page: "my favorites" above the tool groups, built from the page's own tool list ----
  var firstGroup = document.querySelector('main .tool-group');
  if (!firstGroup || !/^\/(zh-tw|en)\/(index\.html)?$/.test(location.pathname)) return;
  var entries = {};
  document.querySelectorAll('main .tool-list a[href]').forEach(function (a) {
    var p = FAV.fromPath(a.getAttribute('href'));
    if (p) entries[p.id] = a.closest('li');
  });

  var box = document.createElement('section');
  box.className = 'tool-group fav-group';
  box.setAttribute('aria-labelledby', 'fav-h');
  firstGroup.before(box);

  function render() {
    var list = load().filter(function (id) { return entries[id]; });
    if (!list.length) { box.innerHTML = '<h2 id="fav-h">' + T.title + '</h2><p class="fav-empty">' + T.empty + '</p>'; return; }
    box.innerHTML = '<h2 id="fav-h">' + T.title + '</h2><ul class="tool-list fav-list"></ul>' +
      '<p class="fav-share"><button type="button" class="copy-btn fav-copy">' + T.copy + '</button></p>';
    var ul = box.querySelector('ul');
    list.forEach(function (id) {
      var li = entries[id].cloneNode(true);
      var x = document.createElement('button');
      x.type = 'button';
      x.className = 'fav-remove';
      x.textContent = '×';
      x.setAttribute('aria-label', T.remove(li.querySelector('.tool-name').textContent));
      x.addEventListener('click', function () { save(load().filter(function (v) { return v !== id; })); render(); });
      li.appendChild(x);
      ul.appendChild(li);
    });
    var copy = box.querySelector('.fav-copy');
    copy.addEventListener('click', function () {
      var url = FAV.shareUrl(location.origin, lang, list);
      var shown = box.querySelector('.fav-link');
      var showLink = function (msg) {
        if (shown) shown.remove();
        var p = document.createElement('p');
        p.className = 'fav-link';
        p.innerHTML = '<span></span><input type="text" readonly>';
        p.querySelector('span').textContent = msg + ' ';
        p.querySelector('input').value = url;
        box.appendChild(p);
        p.querySelector('input').select();
      };
      if (!navigator.clipboard) { showLink(T.copyFailed); return; }
      navigator.clipboard.writeText(url).then(function () {
        copy.textContent = T.copied;
        setTimeout(function () { copy.textContent = T.copy; }, 1200);
        showLink(T.hint);
      }, function () { showLink(T.copyFailed); });
    });
  }

  // A share link (?fav=...) offers to add its tools; nothing changes until the reader agrees.
  var shared = FAV.fromQuery(location.search).filter(function (id) { return entries[id]; });
  var fresh = FAV.incoming(load(), shared);
  if (history.replaceState && location.search) history.replaceState(null, '', location.pathname + location.hash);
  if (fresh.length) {
    var bar = document.createElement('div');
    bar.className = 'fav-offer';
    bar.innerHTML = '<span></span> <button type="button" class="fav-accept"></button> <button type="button" class="fav-dismiss"></button>';
    bar.querySelector('span').textContent = T.offer(fresh.length);
    bar.querySelector('.fav-accept').textContent = T.accept;
    bar.querySelector('.fav-dismiss').textContent = T.dismiss;
    bar.querySelector('.fav-accept').addEventListener('click', function () {
      save(FAV.clean(load().concat(fresh))); bar.remove(); render();
    });
    bar.querySelector('.fav-dismiss').addEventListener('click', function () { bar.remove(); });
    box.before(bar);
  }
  render();
  refreshOn(render);
});
