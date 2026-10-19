const ROC = require('../zh-tw/life/roc-year-converter/tool.js');

test('西元轉民國', () => { eq(ROC.toRoc(2026), { era: '民國', n: 115 }); eq(ROC.toRoc(1912), { era: '民國', n: 1 }); });
test('民前', () => { eq(ROC.toRoc(1911), { era: '民前', n: 1 }); eq(ROC.toRoc(1900), { era: '民前', n: 12 }); });
test('民國轉西元', () => { eq(ROC.fromRoc(115, '民國'), 2026); eq(ROC.fromRoc(1, '民前'), 1911); eq(ROC.fromRoc(0, '民國'), null); });
test('干支生肖', () => {
  eq(ROC.ganzhi(2026), { gz: '丙午', zodiac: '馬' });
  eq(ROC.ganzhi(2024), { gz: '甲辰', zodiac: '龍' });
  eq(ROC.ganzhi(2000), { gz: '庚辰', zodiac: '龍' });
  eq(ROC.ganzhi(1990), { gz: '庚午', zodiac: '馬' });
  eq(ROC.ganzhi(1980), { gz: '庚申', zodiac: '猴' });
  eq(ROC.ganzhi(2027), { gz: '丁未', zodiac: '羊' });
  eq(ROC.ganzhi(2025), { gz: '乙巳', zodiac: '蛇' });
});
test('解析民國日期', () => {
  const want = { y: 2026, m: 10, d: 19, era: '民國', n: 115 };
  eq(ROC.parseRocDate('115/10/19'), want);
  eq(ROC.parseRocDate('115.10.19'), want);
  eq(ROC.parseRocDate('1151019'), want);
  eq(ROC.parseRocDate('民國115年10月19日'), want);
  eq(ROC.parseRocDate('１１５／１０／１９'), want);
  eq(ROC.parseRocDate('0890105'), { y: 2000, m: 1, d: 5, era: '民國', n: 89 });
});
test('不存在的日期', () => {
  eq(!!ROC.parseRocDate('115/02/29').error, true);
  eq(!!ROC.parseRocDate('113/02/29').error, false); // 2024 是閏年
  eq(!!ROC.parseRocDate('89/02/29').error, false);  // 2000 是閏年
  eq(!!ROC.parseRocDate('abc').error, true);
});
test('西元日期轉民國格式', () => {
  eq(ROC.formatRocDate(2026, 10, 19), { slash: '115/10/19', words: '民國115年10月19日', compact: '1151019' });
  eq(ROC.formatRocDate(2000, 1, 5).compact, '0890105');
  eq(ROC.formatRocDate(1911, 10, 10).slash, '民前1/10/10');
});
