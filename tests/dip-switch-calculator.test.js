const DS = require('../assets/tools/dip-switch-calculator.js');

test('dip: parse values', () => {
  eq(DS.parseValue('37', 9), { value: 37 }); eq(DS.parseValue('0x25', 9), { value: 37 }); eq(DS.parseValue('0X1ff', 9), { value: 511 });
  eq(DS.parseValue('0b100101', 9), { value: 37 }); eq(DS.parseValue('０ｘ２５', 9), { value: 37 }); eq(DS.parseValue('1_000', 10), { value: 1000 });
  eq(DS.parseValue('0', 4), { value: 0 }); eq(DS.parseValue('15', 4), { value: 15 }); eq(DS.parseValue('65535', 16), { value: 65535 });
  eq(DS.parseValue('', 8), { error: 'empty' });
  ['-1', '1.5', 'abc', '0x', '0b2', '0xg', '25h'].forEach(s => eq([s, DS.parseValue(s, 8)], [s, { error: 'format' }]));
  eq(DS.parseValue('16', 4), { error: 'range' }); eq(DS.parseValue('512', 9), { error: 'range' }); eq(DS.parseValue('0x10000', 16), { error: 'range' });
  eq(DS.parseInt10('8', 1, 512), { value: 8 }); eq(DS.parseInt10('', 1, 512), { error: 'empty' });
  ['0', '513', '2.5', 'x'].forEach(s => eq([s, DS.parseInt10(s, 1, 512)], [s, { error: 'range' }]));
});

test('dip: switch 1 is the lowest bit in DMX order', () => {
  eq(DS.onList(37, 9, 'lsb'), [1, 3, 6]);       // 1 + 4 + 32
  eq(DS.onList(1, 9, 'lsb'), [1]); eq(DS.onList(256, 9, 'lsb'), [9]); eq(DS.onList(511, 9, 'lsb'), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  eq(DS.onList(512, 10, 'lsb'), [10]); eq(DS.onList(0, 9, 'lsb'), []);
  eq(DS.onList(100, 9, 'lsb'), [3, 6, 7]);      // 4 + 32 + 64
  eq(DS.bits(37, 9, 'lsb'), '101001000');
  eq([DS.weight(1, 9, 'lsb'), DS.weight(9, 9, 'lsb')], [1, 256]);
});

test('dip: switch 1 is the highest bit in MSB order', () => {
  eq(DS.onList(37, 8, 'msb'), [3, 6, 8]);       // 0b00100101
  eq(DS.bits(37, 8, 'msb'), '00100101');
  eq([DS.weight(1, 8, 'msb'), DS.weight(8, 8, 'msb')], [128, 1]);
  eq(DS.hex(37), '0x25'); eq(DS.hex(0), '0x0'); eq(DS.hex(65535), '0xFFFF');
});

test('dip: switches round-trip for every value and order', () => {
  for (const count of DS.COUNTS) for (const order of ['lsb', 'msb']) {
    const step = count > 12 ? 97 : 1;
    for (let v = 0; v < Math.pow(2, count); v += step) {
      const sw = DS.toSwitches(v, count, order);
      if (sw.length !== count || DS.fromSwitches(sw, order) !== v) throw new Error(`${count} ${order} ${v}`);
      const l = DS.onList(v, count, order);
      if (l.reduce((t, n) => t + DS.weight(n, count, order), 0) !== v) throw new Error(`sum ${count} ${order} ${v}`);
      if (DS.bits(v, count, order) !== sw.map(b => (b ? '1' : '0')).join('')) throw new Error('bits');
    }
    // msb order reads like normal binary, lsb order is the same string reversed
    const v = 37 % Math.pow(2, count);
    eq(DS.bits(v, count, 'msb'), v.toString(2).padStart(count, '0'));
    eq(DS.bits(v, count, 'lsb'), v.toString(2).padStart(count, '0').split('').reverse().join(''));
  }
});

test('dip: DMX address plan', () => {
  const p = DS.dmxPlan(1, 8, 4);
  eq(p.rows.map(r => [r.address, r.last, r.on]), [[1, 8, [1]], [9, 16, [1, 4]], [17, 24, [1, 5]], [25, 32, [1, 4, 5]]]);
  const end = DS.dmxPlan(505, 8, 1);
  eq(end.rows[0], { fixture: 1, address: 505, last: 512, on: [1, 4, 5, 6, 7, 8, 9] });
  eq(DS.dmxPlan(512, 1, 1).rows[0].on, [10]);
  eq(DS.dmxPlan(1, 512, 1).rows[0].last, 512);
  eq(DS.dmxPlan(1, 8, 65), { error: 'overflow', fits: 64 });
  eq(DS.dmxPlan(506, 8, 1), { error: 'overflow', fits: 0 });
  eq(DS.dmxPlan(500, 4, 5), { error: 'overflow', fits: 3 });
});
