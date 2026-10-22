const PWM = require('../assets/tools/pwm-frequency.js');
const near = (a, b, rel = 1e-9) => { if (Math.abs(a - b) > Math.abs(b) * rel + 1e-15) throw new Error(`expected ~${b}, got ${a}`); };

test('pwm: frequency from PSC and ARR', () => {
  // The owner's spreadsheet uses pwmMaxValue as ARR: clock / (ARR + 1), rounded.
  eq(Math.round(PWM.forward('72', '0', '16384', 'edge', '', '16').freq), 4394);
  eq(Math.round(PWM.forward('72', '0', '65535', 'edge', '', '16').freq), 1099);
  eq(Math.round(PWM.forward('48', '0', '16384', 'edge', '', '16').freq), 2930);
  eq(Math.round(PWM.forward('48', '0', '3000', 'edge', '', '16').freq), 15995);
  const r = PWM.forward('72M', '71', '999', 'edge', '25', '16');
  eq([r.tick, r.freq, r.period, r.steps, r.dutyStep, r.ccr, r.dutyReal], [1e6, 1000, 0.001, 1000, 0.1, 250, 25]);
  eq(PWM.forward('72000000Hz', '0', '0xFFFF', 'edge', '', '16').steps, 65536);
  eq(PWM.forward('72000000Hz', '0', '0xFFFF', 'edge', '', '16').bits, 16);
  eq(PWM.forward('16', '63', '255', 'edge', '', '16').freq, 976.5625); // Arduino Uno pins 5 and 6
});
test('pwm: center-aligned', () => {
  const r = PWM.forward('72', '0', '3600', 'center', '50', '16');
  eq([r.freq, r.steps, r.ccr, r.dutyReal], [10000, 3600, 1800, 50]);
  near(PWM.forward('16', '7', '255', 'center', '', '16').freq, 16e6 / (8 * 510)); // AVR phase-correct
});
test('pwm: duty cycle and compare value', () => {
  eq(PWM.forward('72', '0', '999', 'edge', '0', '16').ccr, 0);
  eq(PWM.forward('72', '0', '999', 'edge', '100', '16').ccr, 1000);
  eq(PWM.forward('72', '0', '999', 'edge', '33.3%', '16').ccr, 333);
  eq(PWM.forward('72', '0', '2', 'edge', '50', '16').dutyReal, 66.6666666667); // only 3 steps: 2 of 3
  eq(PWM.forward('72', '0', '999', 'edge', '', '16').ccr, null);
  eq(PWM.forward('72', '0', '999', 'edge', '101', '16').error, 'duty-format');
  eq(PWM.forward('72', '0', '999', 'edge', 'half', '16').error, 'duty-format');
});
test('pwm: register limits and input errors', () => {
  eq(PWM.forward('72', '65536', '999', 'edge', '', '16'), { error: 'psc-range', max: 65535 });
  eq(PWM.forward('72', '0', '65536', 'edge', '', '16'), { error: 'arr-range', max: 65535 });
  near(PWM.forward('72', '0', '65536', 'edge', '', '32').freq, 72e6 / 65537);
  eq(PWM.forward('72', '0', '0', 'edge', '', '16').error, 'arr-small');
  eq(PWM.forward('72', '1.5', '999', 'edge', '', '16').error, 'psc-format');
  eq(PWM.forward('72', '', '999', 'edge', '', '16').error, 'psc-empty');
  eq(PWM.forward('', '0', '999', 'edge', '', '16').error, 'clock-empty');
  eq(PWM.forward('fast', '0', '999', 'edge', '', '16').error, 'clock-format');
  eq(PWM.forward('0', '0', '999', 'edge', '', '16').error, 'clock-positive');
  eq(PWM.readFreq('20k', 'target', 1).hz, 20000);
  eq(PWM.readFreq('1.5MHz', 'target', 1).hz, 1.5e6);
  eq(PWM.readFreq('500', 'target', 1).hz, 500);
  eq(PWM.readFreq('8', 'clock', 1e6).hz, 8e6);
  eq(PWM.readFreq('32.768k', 'clock', 1e6).hz, 32768);
});
test('pwm: PSC and ARR for a frequency', () => {
  const r = PWM.solve('72', '20k', 'edge', '16');
  eq(r.rows, [{ psc: 0, div: 1, arr: 3599, freq: 20000, errorPct: 0, steps: 3600 }]);
  eq(PWM.solve('72', '1k', 'edge', '16').rows[0], { psc: 1, div: 2, arr: 35999, freq: 1000, errorPct: 0, steps: 36000 });
  const s = PWM.solve('72', '50', 'edge', '16');
  eq([s.rows[0].psc, s.rows[0].arr], [21, 65454]);         // finest resolution first
  eq([s.rows[1].psc, s.rows[1].arr, s.rows[1].errorPct], [23, 59999, 0]); // then exact settings
  eq(PWM.solve('72', '10k', 'center', '16').rows[0], { psc: 0, div: 1, arr: 3600, freq: 10000, errorPct: 0, steps: 3600 });
  eq(PWM.solve('72', '0.01', 'edge', '32').rows[0].arr, 3599999999);
  eq(PWM.solve('72', '36M', 'edge', '16').rows[0].arr, 1);
});
test('pwm: solved settings give the frequency they claim and fit the registers', () => {
  for (let i = 0; i < 300; i++) {
    const clock = [8, 16, 48, 72, 84, 170][i % 6], target = Math.exp(Math.random() * Math.log(1e6)) + 1;
    for (const mode of ['edge', 'center']) for (const bits of ['16', '32']) {
      const r = PWM.solve(String(clock), String(target), mode, bits);
      if (r.error) { eq(['too-slow', 'too-fast'].includes(r.error), true); continue; }
      for (const x of r.rows) {
        eq(x.psc >= 0 && x.psc <= 65535 && x.arr >= 1 && x.arr <= PWM.ARR_MAX[bits], true);
        near(x.freq, PWM.forward(String(clock), String(x.psc), String(x.arr), mode, '', bits).freq);
      }
      for (let k = 2; k < r.rows.length; k++) eq(Math.abs(r.rows[k].errorPct) >= Math.abs(r.rows[k - 1].errorPct), true);
      for (let k = 1; k < r.rows.length; k++) eq(Math.abs(r.rows[k].errorPct) < Math.abs(r.rows[0].errorPct), true);
    }
  }
});
test('pwm: out-of-range targets', () => {
  eq(PWM.solve('72', '40M', 'edge', '16').rows[0].freq, 36e6); // nearest: ARR = 1
  eq(PWM.solve('72', '100M', 'edge', '16'), { error: 'too-fast', max: 36e6 });
  eq(PWM.solve('72', '0.01', 'edge', '16').error, 'too-slow');
  eq(PWM.solve('72', '', 'edge', '16').error, 'target-empty');
  eq(PWM.TEXT.en.errors['too-fast']({ max: 36e6 }), 'Too fast for this clock. The highest PWM frequency is 36 MHz.');
  eq(PWM.hzText(4394.26), '4.39426 kHz'); eq(PWM.hzText(976.5625), '976.563 Hz'); eq(PWM.hzText(20000), '20 kHz'); eq(PWM.hzText(1098.6328125), '1.09863 kHz');
});
test('pwm: AVR prescaler', () => {
  const r = PWM.forward('16', '64', '255', 'edge', '50', '8', 'avr'); // Uno pins 5 and 6: Timer0, N = 64
  eq([r.div, r.psc, r.freq, r.ccr], [64, 63, 976.5625, 128]);
  near(PWM.forward('16', '64', '255', 'center', '', '8', 'avr').freq, 16e6 / (64 * 510)); // pins 9, 10, 3, 11: ≈ 490 Hz
  eq(PWM.forward('16', '63', '255', 'edge', '', '8', 'avr').error, 'div-format');
  eq(PWM.forward('16', '64', '256', 'edge', '', '8', 'avr'), { error: 'arr-range', max: 255 });
  const s = PWM.solve('16', '50', 'edge', '16', 'avr'); // servo on Timer1: N = 8, TOP = 39999
  eq([s.rows[0].div, s.rows[0].arr, s.rows[0].errorPct], [8, 39999, 0]);
  for (const t of ['1', '100', '1k', '20k', '1M']) for (const mode of ['edge', 'center']) for (const bits of ['8', '16']) {
    const x = PWM.solve('16', t, mode, bits, 'avr');
    if (x.error) { eq(['too-slow', 'too-fast'].includes(x.error), true); continue; }
    for (const row of x.rows) {
      eq(PWM.AVR_DIV.includes(row.div) && row.arr <= PWM.ARR_MAX[bits], true);
      near(row.freq, PWM.forward('16', String(row.div), String(row.arr), mode, '', bits, 'avr').freq);
    }
  }
  eq(PWM.solve('16', '1', 'edge', '8', 'avr'), { error: 'too-slow', min: 16e6 / (1024 * 256) });
});
