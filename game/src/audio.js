// Tallow Point — audio.js
// Suara lokal (WebAudio): mesin, sirene, tembakan, tabrakan, uang, misi.
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-3).
// - Semua suara disintesis (oscillator / noise buffer) — TANPA file audio,
//   tanpa network.
// - AudioContext dibuat malas (lazy) saat gestur pertama pengguna (aturan
//   autoplay browser); kalau gagal (headless tanpa perangkat audio), semua
//   method jadi no-op dan game tetap jalan.
// - Mute (tombol M) mematikan master gain, bukan menghentikan konteks.

import { AUDIO } from "./config.js";

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this._sirenPhase = 0;
    this._sirenTimer = 0;
    this._noiseBuf = null;
    // Nyalakan konteks saat gestur pertama (klik / tombol apa pun).
    const wake = () => this.ensure();
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
  }

  // Buat AudioContext + node persisten. Kembalikan false kalau tidak bisa.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : AUDIO.master;
      this.master.connect(this.ctx.destination);
      // Buffer noise putih (dipakai ulang tembakan + tabrakan).
      const len = Math.floor(this.ctx.sampleRate * 0.25);
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      // Mesin: sawtooth + lowpass, gain kecil, jalan terus.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.value = 55;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = "lowpass";
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc
        .connect(this.engineFilter)
        .connect(this.engineGain)
        .connect(this.master);
      this.engineOsc.start();
      // Sirene: square dua nada, gain 0 saat tidak ada polisi.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = "square";
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      return true;
    } catch (err) {
      this.ctx = null;
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : AUDIO.master, this.ctx.currentTime, 0.05);
    }
  }

  // Dipanggil tiap frame: nada mesin ikut kecepatan, sirene ikut wanted.
  // opts: {speed (m/s), driving (bool), siren (bool)}
  update(dt, opts) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    if (this.engineOsc && this.engineGain) {
      const target = opts.driving
        ? AUDIO.engineGain * (0.5 + Math.min(1, Math.abs(opts.speed || 0) / 26))
        : 0.015;
      this.engineGain.gain.setTargetAtTime(target, t, 0.08);
      this.engineOsc.frequency.setTargetAtTime(
        50 + Math.abs(opts.speed || 0) * 5,
        t,
        0.1
      );
    }
    if (this.sirenOsc && this.sirenGain) {
      if (opts.siren) {
        // Dua nada bergantian tiap 0,4 detik (wail polisi klasik).
        this._sirenTimer += dt;
        if (this._sirenTimer >= 0.4) {
          this._sirenTimer = 0;
          this._sirenPhase = 1 - this._sirenPhase;
          this.sirenOsc.frequency.setTargetAtTime(
            this._sirenPhase ? 880 : 660,
            t,
            0.03
          );
        }
        this.sirenGain.gain.setTargetAtTime(AUDIO.sirenGain, t, 0.1);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, t, 0.15);
      }
    }
  }

  _blip(freq, dur, type, gain) {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = type || "sine";
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gain || 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (err) {}
  }

  _noise(dur, filterFreq, gain) {
    if (!this.ctx || !this._noiseBuf) return;
    try {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = filterFreq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + dur + 0.02);
    } catch (err) {}
  }

  // Tembakan: noise pendek + dentum rendah.
  gunshot() {
    if (!this.ctx) return;
    this._noise(0.12, 2400, 0.5);
    this._blip(160, 0.09, "square", 0.2);
  }

  // Tabrakan: noise rendah + sine jatuh 110 -> 45 Hz.
  impact(strength) {
    if (!this.ctx) return;
    const s = Math.min(1, (strength || 8) / 20);
    this._noise(0.18, 700, 0.25 + s * 0.35);
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.3 + s * 0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.22);
    } catch (err) {}
  }

  // Uang masuk: dua blip naik (880 -> 1320).
  cash() {
    if (!this.ctx) return;
    this._blip(880, 0.09, "sine", 0.25);
    setTimeout(() => this._blip(1320, 0.12, "sine", 0.25), 90);
  }

  // Misi selesai: arpeggio 3 nada (523 / 659 / 784).
  missionDone() {
    if (!this.ctx) return;
    [523, 659, 784].forEach((f, i) => {
      setTimeout(() => this._blip(f, 0.22, "sine", 0.28), i * 110);
    });
  }

  // BUSTED / DEAD: nada turun.
  busted() {
    if (!this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(380, t);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.6);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.7);
    } catch (err) {}
  }
}
