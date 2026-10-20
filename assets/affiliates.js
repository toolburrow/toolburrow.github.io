// Affiliate recommendations for every tool page, keyed by slot name: "<lang>/<slug>" (each language uses its own programs).
// Only add links from programs marked 已核准 in PLAN.md, exactly as the owner gives them.
// Each slot holds 0–3 items: { name, url, note } where note is one sentence on why it's recommended.
// An empty slot renders nothing.
var AFF = (function () {
  var SLOTS = {
    'zh-tw/roc-year-converter': [],
    'zh-tw/date-difference': [],
    'zh-tw/resistor-color-code': [],
    'zh-tw/voltage-divider': [],
    'zh-tw/ping-converter': [],
    'zh-tw/bmi-calculator': [],
    'en/roc-year-converter': [],
    'en/date-difference': [],
    'en/resistor-color-code': [],
    'en/voltage-divider': [],
    'en/ping-converter': [],
    'en/bmi-calculator': []
  };

  var TEXT = {
    zh: { title: '推薦商品', disclosure: '本頁含有聯盟連結，透過連結購買時，ToolLamp 可能會獲得少量分潤，不影響你的購買價格。' },
    en: { title: 'Recommended products', disclosure: 'This page contains affiliate links. If you buy through them, ToolLamp may earn a small commission at no extra cost to you.' }
  };

  var MAX_ITEMS = 3;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Keep only complete items with an https link, at most MAX_ITEMS.
  function usable(items) {
    return (items || []).filter(function (it) {
      return it && it.name && it.note && /^https:\/\/[^\s"'<>]+$/.test(it.url || '');
    }).slice(0, MAX_ITEMS);
  }

  // lang is the page's <html lang>; anything starting with "zh" gets Chinese text.
  // Returns the inner HTML for the slot, or '' when there is nothing to show.
  function render(items, lang) {
    var list = usable(items);
    if (!list.length) return '';
    var t = /^zh/i.test(lang || '') ? TEXT.zh : TEXT.en;
    return '<h2>' + t.title + '</h2><ul>' + list.map(function (it) {
      return '<li><a href="' + esc(it.url) + '" rel="sponsored noopener" target="_blank">' + esc(it.name) + '</a>' +
        '<span>' + esc(it.note) + '</span></li>';
    }).join('') + '</ul><small>' + t.disclosure + '</small>';
  }

  return { SLOTS: SLOTS, MAX_ITEMS: MAX_ITEMS, usable: usable, render: render };
})();

if (typeof module !== 'undefined') module.exports = AFF;

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('aside.affiliate[data-slot]').forEach(function (el) {
    var html = AFF.render(AFF.SLOTS[el.getAttribute('data-slot')], document.documentElement.lang);
    if (!html) return;
    el.innerHTML = html;
    el.hidden = false;
  });
});
