// Every shared tool script must have the same text keys in both languages, so no page shows a missing string.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'assets', 'tools');

// Nested key structure only; a value may be text, a function, or null (not used in that language).
function shape(v) {
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) o[k] = shape(v[k]); return o; }
  return 1;
}

for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const X = require(path.join(dir, f));
  test('tool text: ' + f + ' has the same keys in zh-tw and en', () => {
    eq(Object.keys(X.TEXT).sort(), ['en', 'zh-tw']);
    eq(shape(X.TEXT.en), shape(X.TEXT['zh-tw']));
  });
}
