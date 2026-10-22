const NB = require('../assets/tools/number-base-converter.js');
// eq() compares JSON, which has no BigInt; write BigInts as "<n>n" first.
const big = (x) => JSON.parse(JSON.stringify(x, (k, v) => (typeof v === 'bigint' ? v + 'n' : v)) ?? 'null');
const eqb = (a, b) => eq(big(a), big(b));

test('base: parse decimal, hex and binary', () => {
  eqb(NB.parse('65', 'dec', 0), { value: 65n }); eqb(NB.parse('1,000', 'dec', 0), { value: 1000n }); eqb(NB.parse('６５', 'dec', 0), { value: 65n });
  eqb(NB.parse('41', 'hex', 0), { value: 65n }); eqb(NB.parse('0x41', 'hex', 0), { value: 65n }); eqb(NB.parse('0XfF', 'hex', 0), { value: 255n });
  eqb(NB.parse('41h', 'hex', 0), { value: 65n }); eqb(NB.parse('dead beef', 'hex', 0), { value: 0xdeadbeefn });
  eqb(NB.parse('0100 0001', 'bin', 0), { value: 65n }); eqb(NB.parse('0b1_0000', 'bin', 0), { value: 16n });
  eqb(NB.parse('0', 'dec', 8), { value: 0n }); eqb(NB.parse('00ff', 'hex', 8), { value: 255n });
  eqb(NB.parse('', 'dec', 0), { error: 'empty' }); eqb(NB.parse('  ', 'hex', 8), { error: 'empty' });
  ['1.5', 'abc', '0x41', '--1', '1-'].forEach(s => eqb([s, NB.parse(s, 'dec', 8)], [s, { error: 'format' }]));
  ['g', '0x', '-1', '1.0'].forEach(s => eqb([s, NB.parse(s, 'hex', 8)], [s, { error: 'format' }]));
  ['2', '0b', '-1', '0x1'].forEach(s => eqb([s, NB.parse(s, 'bin', 8)], [s, { error: 'format' }]));
});

test('base: negative decimals are two’s complement and need a width', () => {
  eqb(NB.parse('-1', 'dec', 0), { error: 'negative' });
  eqb(NB.parse('-1', 'dec', 8), { value: 0xffn }); eqb(NB.parse('-128', 'dec', 8), { value: 0x80n });
  eqb(NB.parse('－1', 'dec', 16), { value: 0xffffn }); eqb(NB.parse('-2147483648', 'dec', 32), { value: 0x80000000n });
  eqb(NB.parse('-1', 'dec', 64), { value: 0xffffffffffffffffn });
  eqb(NB.parse('-9223372036854775808', 'dec', 64), { value: 0x8000000000000000n });
  eqb(NB.parse('-129', 'dec', 8), { error: 'range' }); eqb(NB.parse('-9223372036854775809', 'dec', 64), { error: 'range' });
  eqb([NB.signed(0xffn, 8), NB.signed(0x7fn, 8), NB.signed(0x80n, 8), NB.signed(0xfffen, 16)], [-1n, 127n, -128n, -2n]);
  eqb(NB.signed(0x8000000000000000n, 64), -9223372036854775808n);
});

test('base: values must fit the width', () => {
  eqb(NB.parse('255', 'dec', 8), { value: 255n }); eqb(NB.parse('256', 'dec', 8), { error: 'range' });
  eqb(NB.parse('100', 'hex', 8), { error: 'range' }); eqb(NB.parse('1 0000 0000', 'bin', 8), { error: 'range' });
  eqb(NB.parse('18446744073709551615', 'dec', 0), { value: 18446744073709551615n });
  eqb(NB.parse('18446744073709551616', 'dec', 0), { error: 'range' }); eqb(NB.parse('1' + '0'.repeat(16), 'hex', 64), { error: 'range' });
  eqb(NB.limits(8), { max: '255', min: '-128' }); eqb(NB.limits(0), { max: '18446744073709551615', min: '0' });
  eqb(NB.limits(32), { max: '4294967295', min: '-2147483648' });
});

test('base: formatting', () => {
  eqb([NB.hex(65n, 0), NB.hex(65n, 8), NB.hex(65n, 16), NB.hex(0n, 0), NB.hex(0xffffffffn, 32)], ['41', '41', '0041', '0', 'FFFFFFFF']);
  eqb([NB.bin(65n, 0), NB.bin(5n, 0), NB.bin(0n, 0), NB.bin(1000n, 0), NB.bin(1n, 16)],
    ['01000001', '0101', '0000', '001111101000', '0000000000000001']);
  eqb([NB.groupBits('01000001'), NB.groupBits('001111101000'), NB.groupBits('0101'), NB.groupBits('101')], ['0100 0001', '0011 1110 1000', '0101', '101']);
  eqb(NB.bytesBE(0x1234n, 0), ['12', '34']); eqb(NB.bytesBE(0x123n, 0), ['01', '23']); eqb(NB.bytesBE(0n, 0), ['00']);
  eqb(NB.bytesBE(0x1234n, 32), ['00', '00', '12', '34']); eqb(NB.bytesBE(0xffn, 8), ['FF']);
  eqb([NB.bitLength(0n), NB.bitLength(1n), NB.bitLength(255n), NB.bitLength(256n)], [1, 1, 8, 9]);
});

test('base: every width round-trips through every base', () => {
  let seed = 7;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return BigInt(seed); };
  for (const width of NB.WIDTHS) for (let i = 0; i < 400; i++) {
    const bits = BigInt(width || 64);
    const v = ((rand() << 33n) ^ (rand() << 16n) ^ rand() ^ (rand() << 48n)) % (1n << bits);
    const hex = NB.hex(v, width), bin = NB.bin(v, width);
    if (NB.parse(hex, 'hex', width).value !== v || NB.parse(NB.groupBits(bin), 'bin', width).value !== v ||
        NB.parse(v.toString(), 'dec', width).value !== v) throw new Error(`${width} ${v}`);
    if (width && (hex.length !== width / 4 || bin.length !== width)) throw new Error(`pad ${width} ${v}`);
    if (width && NB.parse(NB.signed(v, width).toString(), 'dec', width).value !== v) throw new Error(`signed ${width} ${v}`);
    if (BigInt('0x' + NB.bytesBE(v, width).join('')) !== v) throw new Error(`bytes ${width} ${v}`);
    if (Number(v) < 2 ** 53 && parseInt(hex, 16) !== Number(v)) throw new Error(`number ${v}`);
  }
});

test('base: ASCII characters', () => {
  eqb(NB.ascii(65n), { char: 'A' }); eqb(NB.ascii(48n), { char: '0' }); eqb(NB.ascii(126n), { char: '~' });
  eqb(NB.ascii(32n), { space: true }); eqb(NB.ascii(10n), { control: 'LF', escape: '\\n' }); eqb(NB.ascii(13n), { control: 'CR', escape: '\\r' });
  eqb(NB.ascii(0n), { control: 'NUL', escape: '\\0' }); eqb(NB.ascii(27n), { control: 'ESC', escape: null });
  eqb(NB.ascii(127n), { control: 'DEL', escape: null }); eqb(NB.ascii(128n), null); eqb(NB.ascii(0x41ffn), null);
  eqb(NB.CONTROL.length, 32);
});

test('base: text to UTF-8 bytes and back', () => {
  eqb(NB.encode('Hello'), [0x48, 0x65, 0x6c, 0x6c, 0x6f]); eqb(NB.encode(''), []);
  eqb(NB.encode('é'), [0xc3, 0xa9]); eqb(NB.encode('你好'), [0xe4, 0xbd, 0xa0, 0xe5, 0xa5, 0xbd]);
  eqb(NB.encode('😀'), [0xf0, 0x9f, 0x98, 0x80]); eqb(NB.encode('a\nb'), [0x61, 0x0a, 0x62]);
  for (const s of ['Hello, world!', '台灣 Taiwan 123', 'Ω µ ° ±', '🙂👍', 'tab\there']) {
    eqb([s, NB.encode(s)], [s, [...Buffer.from(s, 'utf8')]]);
    eqb(NB.decode(NB.encode(s)), { text: s, invalid: false });
  }
  for (let c = 0; c < 128; c++) eqb(NB.encode(String.fromCharCode(c)), [c]);
  eqb(NB.decode([0xff]), { text: '�', invalid: true }); eqb(NB.decode([0xe4, 0xbd]).invalid, true);
  eqb([NB.isAscii([0x41, 0x7f]), NB.isAscii([0x41, 0x80])], [true, false]);
});

test('base: byte codes are formatted and parsed', () => {
  const b = [0x48, 0x69, 0x0a];
  eqb(NB.formatBytes(b, 'hex'), '48 69 0A'); eqb(NB.formatBytes(b, 'dec'), '72 105 10'); eqb(NB.formatBytes(b, 'bin'), '01001000 01101001 00001010');
  eqb(NB.cArray(b), '{0x48, 0x69, 0x0A}'); eqb(NB.cArray([]), '{}');
  for (const f of ['hex', 'dec', 'bin']) eqb(NB.parseBytes(NB.formatBytes(b, f), f), { bytes: b });
  eqb(NB.parseBytes('48690a', 'hex'), { bytes: b }); eqb(NB.parseBytes('0x48, 0x69, 0x0A', 'hex'), { bytes: b });
  eqb(NB.parseBytes('{0x48,0x69,0x0a}', 'hex'), { bytes: b }); eqb(NB.parseBytes('\\x48\\x69\\x0a', 'hex'), { bytes: b });
  eqb(NB.parseBytes('4 a', 'hex'), { bytes: [4, 10] }); eqb(NB.parseBytes('', 'hex'), { bytes: [] });
  eqb(NB.parseBytes('72,105,10', 'dec'), { bytes: b }); eqb(NB.parseBytes('0100100001101001', 'bin'), { bytes: [0x48, 0x69] });
  eqb(NB.parseBytes('0b1 101', 'bin'), { bytes: [1, 5] });
  eqb(NB.parseBytes('48 6g', 'hex'), { error: 'format', token: '6g' }); eqb(NB.parseBytes('486', 'hex'), { error: 'odd', token: '486' });
  eqb(NB.parseBytes('0x', 'hex'), { error: 'format', token: '0x' });
  eqb(NB.parseBytes('72 256', 'dec'), { error: 'range', token: '256' }); eqb(NB.parseBytes('7a', 'dec'), { error: 'format', token: '7a' });
  eqb(NB.parseBytes('010010000', 'bin'), { error: 'bits', token: '010010000' }); eqb(NB.parseBytes('012', 'bin'), { error: 'format', token: '012' });
});
