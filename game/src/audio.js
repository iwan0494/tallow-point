// All sound is synthesized locally with WebAudio — no audio files, no network.
// Engine hum, police siren, gunshots, crashes, horns, UI ticks and a low radio
// groove. Everything is behind a master gain and a mute toggle (key N).

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let radioTimer = 0;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Audio is decoration; never break the game for it.
    }
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    try {
      const t = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1200;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t);
    } catch {
      // Ignore audio failures.
    }
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    tick() {
      tone(880, 0.06, 'square', 0.08);
    },
    cash() {
      tone(660, 0.09, 'sine', 0.15);
      setTimeout(() => tone(990, 0.14, 'sine', 0.15), 90);
    },
    gunshot() {
      noise(0.12, 0.5, 2500);
      tone(160, 0.1, 'square', 0.2, 60);
    },
    punch() {
      noise(0.08, 0.35, 900);
    },
    crash() {
      noise(0.25, 0.5, 700);
      tone(90, 0.2, 'sawtooth', 0.25, 45);
    },
    horn() {
      tone(370, 0.25, 'sawtooth', 0.12);
      tone(466, 0.25, 'sawtooth', 0.1);
    },
    steal() {
      tone(520, 0.08, 'square', 0.12);
      setTimeout(() => tone(780, 0.12, 'square', 0.12), 80);
    },
    busted() {
      tone(440, 0.3, 'sawtooth', 0.15, 220);
      setTimeout(() => tone(330, 0.4, 'sawtooth', 0.15, 165), 250);
    },
    setEngine(on, speed01) {
      if (!ensure()) return;
      try {
        if (on && !engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = ctx.createGain();
          engineGain.gain.value = 0.0;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 500;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        }
        if (engineOsc) {
          const target = on && !muted ? 0.05 + speed01 * 0.08 : 0.0;
          engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
          engineOsc.frequency.setTargetAtTime(55 + speed01 * 110, ctx.currentTime, 0.1);
        }
      } catch {
        // Ignore.
      }
    },
    setSiren(on) {
      if (!ensure()) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'triangle';
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0.0;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
          sirenOsc.frequency.setValueAtTime(700, ctx.currentTime);
        }
        if (sirenOsc) {
          sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0.0, ctx.currentTime, 0.2);
          if (on) {
            const t = ctx.currentTime;
            sirenOsc.frequency.cancelScheduledValues(t);
            sirenOsc.frequency.setValueAtTime(700, t);
            sirenOsc.frequency.linearRampToValueAtTime(1050, t + 0.5);
            sirenOsc.frequency.linearRampToValueAtTime(700, t + 1.0);
          }
        }
      } catch {
        // Ignore.
      }
    },
    /** A soft two-note radio groove, called once a second while driving. */
    radioBeat(dt) {
      radioTimer += dt;
      if (radioTimer < 0.9) return;
      radioTimer = 0;
      if (muted || !started) return;
      tone(220, 0.12, 'triangle', 0.05);
      setTimeout(() => tone(277, 0.12, 'triangle', 0.05), 220);
    },
  };
}
