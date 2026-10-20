const ROC = require('../assets/tools/roc-year-converter.js');

test('西元轉民國', () => { eq(ROC.toRoc(2026), { era: '民國', n: 115 }); eq(ROC.toRoc(1912), { era: '民國', n: 1 }); });
test('民前', () => { eq(ROC.toRoc(1911), { era: '民前', n: 1 }); eq(ROC.toRoc(1900), { era: '民前', n: 12 }); });
test('民國轉西元', () => { eq(ROC.fromRoc(115, '民國'), 2026); eq(ROC.fromRoc(1, '民前'), 1911); eq(ROC.fromRoc(0, '民國'), null); });
const gz = (y) => { const g = ROC.ganzhi(y); return { gz: g.gz, zodiac: g.zodiac }; };
test('干支生肖', () => {
  eq(gz(2026), { gz: '丙午', zodiac: '馬' });
  eq(gz(2024), { gz: '甲辰', zodiac: '龍' });
  eq(gz(2000), { gz: '庚辰', zodiac: '龍' });
  eq(gz(1990), { gz: '庚午', zodiac: '馬' });
  eq(gz(1980), { gz: '庚申', zodiac: '猴' });
  eq(gz(2027), { gz: '丁未', zodiac: '羊' });
  eq(gz(2025), { gz: '乙巳', zodiac: '蛇' });
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
  eq(ROC.parseRocDate('115/02/29'), { error: 'date' });
  eq(!!ROC.parseRocDate('113/02/29').error, false); // 2024 是閏年
  eq(!!ROC.parseRocDate('89/02/29').error, false);  // 2000 是閏年
  eq(ROC.parseRocDate('abc'), { error: 'format' });
  eq(ROC.parseRocDate('0/01/01'), { error: 'year' });
});
test('西元日期轉民國格式', () => {
  eq(ROC.formatRocDate(2026, 10, 19), { slash: '115/10/19', words: '民國115年10月19日', compact: '1151019' });
  eq(ROC.formatRocDate(2000, 1, 5).compact, '0890105');
  eq(ROC.formatRocDate(1911, 10, 10).slash, '民前1/10/10');
});
test('干支拼音和英文生肖', () => {
  eq(ROC.ganzhi(2026), { gz: '丙午', zodiac: '馬', py: 'bing-wu', animal: 'Horse' });
  eq(ROC.ganzhi(2024).py, 'jia-chen'); eq(ROC.ganzhi(2024).animal, 'Dragon');
  eq(ROC.ganzhi(1984), { gz: '甲子', zodiac: '鼠', py: 'jia-zi', animal: 'Rat' });
  eq(ROC.ganzhi(2043), { gz: '癸亥', zodiac: '豬', py: 'gui-hai', animal: 'Pig' });
  eq(ROC.ganzhi(2029).animal, 'Rooster'); eq(ROC.ganzhi(2027).animal, 'Goat');
});
test('英文頁的年份寫法', () => {
  const T = ROC.TEXT.en;
  eq(T.roc(ROC.toRoc(2026)), 'ROC 115'); eq(T.roc(ROC.toRoc(1911)), '1 year before ROC'); eq(T.roc(ROC.toRoc(1900)), '12 years before ROC');
  eq(T.westernDate(2026, 10, 19), 'October 19, 2026');
  eq(T.distance(0), 'This year'); eq(T.distance(1), '1 year ago'); eq(T.distance(-2), '2 years from now');
  eq(ROC.TEXT['zh-tw'].distance(3), '3 年前'); eq(ROC.TEXT['zh-tw'].distance(-3), '3 年後');
});
