// Affiliate recommendations for every tool page, keyed by slot name: "<lang>/<slug>" (each language uses its own programs).
// Only add links from programs marked 已核准 in PLAN.md, exactly as the owner gives them.
// zh-tw slots: 蝦皮分潤計畫 links (s.shopee.tw), picked by the owner on 2026-10-22.
// Each slot holds 0–3 items: { name, url, note } where note is one sentence on why it's recommended.
// An empty slot renders nothing.
var AFF = (function () {
  var SLOTS = {
    'zh-tw/roc-year-converter': [],
    'zh-tw/date-difference': [],
    'zh-tw/resistor-color-code': [
      { name: '1/4W 金屬膜電阻 30 種阻值包', url: 'https://s.shopee.tw/9APaXk1R1X', note: '常用阻值共 600 個，適合辨識色環與電路實驗。' }
    ],
    'zh-tw/voltage-divider': [
      { name: '1/4W 金屬膜電阻 30 種阻值包', url: 'https://s.shopee.tw/9APaXk1R1X', note: '搭配常用阻值，實作與驗證分壓電路。' }
    ],
    'zh-tw/ohms-law': [
      { name: '寶工 MT-1210 數位三用電錶', url: 'https://s.shopee.tw/BUltD912c', note: '可量測電壓、直流電流與電阻，適合實作驗證歐姆定律。' }
    ],
    'zh-tw/led-resistor': [
      { name: '電容、電阻、LED 綜合元件包', url: 'https://s.shopee.tw/BUlplcOxs', note: '含 LED 與電阻，可實作限流電路。' }
    ],
    'zh-tw/ping-converter': [
      { name: 'BOSCH GLM40／GLM50-21 雷射測距儀', url: 'https://s.shopee.tw/70L5yf4ama', note: '量測室內長寬後，搭配工具換算面積與坪數。' }
    ],
    'zh-tw/bmi-calculator': [
      { name: '小米 Xiaomi 體重計 S200', url: 'https://s.shopee.tw/1W09Pj2Cf3', note: '官方旗艦店供貨，方便定期量測體重。' }
    ],
    'zh-tw/age-calculator': [],
    'zh-tw/split-bill': [],
    'zh-tw/rc-time-constant': [
      { name: '電容、電阻、LED 綜合元件包', url: 'https://s.shopee.tw/BUlplcOxs', note: '搭配不同電阻與電容，實作 RC 充放電電路。' }
    ],
    'zh-tw/uart-baud-rate': [
      { name: '24MHz 8 通道 USB 邏輯分析儀', url: 'https://s.shopee.tw/1BLdGvlp9', note: '適合觀察 UART 訊號與檢查通訊時序。' }
    ],
    'zh-tw/loan-calculator': [
      { name: '珠友 NB-18362 A5 現金收支簿', url: 'https://s.shopee.tw/W7cE3aPdI', note: '記錄每月收支，規劃還款預算。' }
    ],
    'zh-tw/credit-card-interest': [
      { name: '珠友 NB-18362 A5 現金收支簿', url: 'https://s.shopee.tw/W7cE3aPdI', note: '整理消費與還款紀錄，掌握每月支出。' }
    ],
    'zh-tw/dip-switch-calculator': [
      { name: 'DIP 指撥開關 1P～12P', url: 'https://s.shopee.tw/8V9tlLDLQW', note: '多種位數可選，DMX 位址應用可選 10P 款。' }
    ],
    'zh-tw/capacitor-code': [
      { name: '電容、電阻、LED 綜合元件包', url: 'https://s.shopee.tw/BUlplcOxs', note: '常用電子元件一次備齊，適合入門實驗。' }
    ],
    'zh-tw/smd-resistor-code': [
      { name: '貼片電阻／電容樣品本', url: 'https://s.shopee.tw/AUuy8vdhzy', note: '多種封裝可選，方便分類收納與維修備料。' }
    ],
    'zh-tw/parallel-resistor': [
      { name: '1/4W 金屬膜電阻 30 種阻值包', url: 'https://s.shopee.tw/9APaXk1R1X', note: '適合練習串並聯與組合阻值。' }
    ],
    'zh-tw/adc-calculator': [
      { name: 'STM32 NUCLEO-F446RE 開發板', url: 'https://s.shopee.tw/gR2QkPsRj', note: '板載 ST-LINK，適合實作 ADC 取樣。' }
    ],
    'zh-tw/pwm-frequency': [
      { name: 'STM32 NUCLEO-F446RE 開發板', url: 'https://s.shopee.tw/gR2QkPsRj', note: '適合練習計時器、PWM 頻率與佔空比設定。' }
    ],
    'en/roc-year-converter': [],
    'en/date-difference': [],
    'en/resistor-color-code': [],
    'en/voltage-divider': [],
    'en/ohms-law': [],
    'en/led-resistor': [],
    'en/ping-converter': [],
    'en/bmi-calculator': [],
    'en/age-calculator': [],
    'en/split-bill': [],
    'en/rc-time-constant': [],
    'en/uart-baud-rate': [],
    'en/loan-calculator': [],
    'en/credit-card-interest': [],
    'en/dip-switch-calculator': [],
    'en/capacitor-code': [],
    'en/smd-resistor-code': [],
    'en/parallel-resistor': [],
    'en/adc-calculator': [],
    'en/pwm-frequency': []
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
