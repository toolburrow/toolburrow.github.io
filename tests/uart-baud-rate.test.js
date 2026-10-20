const U = require('../assets/tools/uart-baud-rate.js');

test('UART: 解析時脈和鮑率', () => {
  eq(U.readClock('16'), { hz: 16e6 }); eq(U.readClock('16M'), { hz: 16e6 }); eq(U.readClock('16 MHz'), { hz: 16e6 });
  eq(U.readClock('7.3728M'), { hz: 7372800 }); eq(U.readClock('8000000Hz'), { hz: 8e6 }); eq(U.readClock('32.768k'), { hz: 32768 });
  eq(U.readClock('1G'), { hz: 1e9 });
  eq(U.readClock(''), { error: 'clock-empty' }); eq(U.readClock('fast'), { error: 'clock-format' });
  eq(U.readClock('-16'), { error: 'clock-format' }); eq(U.readClock('0'), { error: 'clock-positive' });
  eq(U.readBaud('115200'), { baud: 115200 }); eq(U.readBaud('115.2k'), { baud: 115200 }); eq(U.readBaud('9600bps'), { baud: 9600 });
  eq(U.readBaud('115,200'), { baud: 115200 });
  eq(U.readBaud(''), { error: 'baud-empty' }); eq(U.readBaud('0'), { error: 'baud-format' }); eq(U.readBaud('x'), { error: 'baud-format' });
});
test('UART: AVR 16 MHz（和資料手冊的表一致）', () => {
  const r = (b, m) => { const x = U.calc('16M', String(b), m); return [x.divisor - 1, x.errorPct.toFixed(1)]; };
  eq(r(9600, 'x16'), [103, '0.2']);
  eq(r(19200, 'x16'), [51, '0.2']);
  eq(r(38400, 'x16'), [25, '0.2']);
  eq(r(57600, 'x16'), [16, '2.1']);
  eq(r(115200, 'x16'), [8, '-3.5']);
  eq(r(115200, 'x8'), [16, '2.1']);
  eq(r(250000, 'x16'), [3, '0.0']);
  eq(U.calc('16M', '115200', 'x16').grade, 'bad');
  eq(U.calc('16M', '115200', 'x8').grade, 'bad'); // 2.12% is just over 2%
  eq(U.calc('16M', '9600', 'x16').grade, 'good');
});
test('UART: 鮑率專用的石英振盪器沒有誤差', () => {
  for (const clk of ['7.3728M', '11.0592M', '14.7456M', '18.432M'])
    for (const b of [9600, 19200, 38400, 57600, 115200]) eq([clk, b, U.calc(clk, String(b), 'x16').errorPct], [clk, b, 0]);
});
test('UART: STM32 BRR', () => {
  const a = U.calc('72M', '115200', 'brr');
  eq([a.divisor, a.errorPct, a.error], [625, 0, undefined]);
  const b = U.calc('8M', '9600', 'brr');
  eq([b.divisor, b.errorPct.toFixed(2), b.grade], [833, '0.04', 'good']);
  eq(U.TEXT.en.register(b), 'BRR = 833 (0x341)');
  eq(U.TEXT.en.register(U.calc('8M', '9600', 'x16')), null);
  eq(U.calc('16M', '1000000', 'brr').divisor, 16);
  eq(U.calc('16M', '1100000', 'brr'), { error: 'too-fast', max: 1e6 });
});
test('UART: 時脈太低和整張表', () => {
  eq(U.calc('1M', '230400', 'x16'), { error: 'too-fast', max: 62500 });
  eq([U.calc('1M', '115200', 'x16').divisor, U.calc('1M', '115200', 'x16').grade], [1, 'bad']); // closest divisor is 1, 45.7% off
  eq(U.calc('1M', '9600', 'x16').divisor, 7);
  const t = U.calc('1M', '9600', 'x16').table;
  eq(t.map(x => x.baud), U.COMMON);
  eq(t[5], { baud: 230400 }); // 1 MHz / 16 cannot get near 230400
  eq(t[0].divisor, 7);
  eq(U.calc('', '9600', 'x16').error, 'clock-empty');
  eq(U.calc('16M', '', 'x16').error, 'baud-empty');
});
test('UART: 誤差的分級', () => {
  eq([0, 0.99, 1, -1, 1.5, 2, -2, 2.01, -3.5].map(U.grade), ['good', 'good', 'good', 'good', 'ok', 'ok', 'ok', 'bad', 'bad']);
});
test('UART: 頁面文字', () => {
  const en = U.TEXT.en, zh = U.TEXT['zh-tw'];
  const r = U.calc('16M', '115200', 'x16');
  eq(en.main(r), '-3.55% error'); eq(zh.main(r), '誤差 -3.55%');
  eq(en.sub(r), 'Real baud rate 111,111.11 instead of 115,200, from 16 MHz.');
  eq(zh.divisor(r), '9（AVR 的 UBRR = 8）');
  eq(en.errText(0), '0.00%'); eq(en.errText(0.16), '+0.16%');
  eq(U.hzText(7372800), '7.3728 MHz'); eq(U.hzText(32768), '32.768 kHz');
  eq(zh.errors['too-fast']({ max: 62500 }), '時脈太低，達不到這個鮑率。這個模式下最高只能到 62,500 baud。');
});
