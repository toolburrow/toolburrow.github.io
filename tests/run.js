// Runs every *.test.js in this folder. Usage: node tests/run.js
const fs = require('fs');
const path = require('path');
let failed = 0, passed = 0;
global.test = (name, fn) => {
  try { fn(); passed++; }
  catch (e) { failed++; console.error('FAIL', name, '\n   ', e.message); }
};
global.eq = (a, b) => {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`expected ${sb}, got ${sa}`);
};
for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js'))) require(path.join(__dirname, f));
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
