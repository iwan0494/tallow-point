// audio.js — all sound is synthesised locally with WebAudio: engine hum,
// police siren, crash thud, gunshot crack and a simple bass loop. No audio
// files, no network. Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  function createAudio() {
    var ctx = null;
    var master = null;
    var engineOsc = null;
    var engineGain = null;
    var sirenOsc = null;
    var sirenGain = null;
    var musicTimer = null;
    var enabled = true;

    function ensure() {
      if (ctx) return true;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
        return true;
      } catch (e) { return false; }
    }

    function unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    }

    function blip(freq, dur, type, vol, slideTo) {
      if (!enabled || !ensure()) return;
      var t = ctx.currentTime;
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    }

    function noiseBurst(dur, vol, lowpass) {
      if (!enabled || !ensure()) return;
      var t = ctx.currentTime;
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var g = ctx.createGain();
      g.gain.value = vol || 0.3;
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t);
    }

    return {
      unlock: unlock,
      setEnabled: function (v) { enabled = v; },
      shoot: function () { noiseBurst(0.12, 0.5, 3000); blip(220, 0.08, 'square', 0.15, 60); },
      punch: function () { noiseBurst(0.1, 0.35, 500); },
      crash: function () { noiseBurst(0.25, 0.5, 800); blip(90, 0.2, 'sawtooth', 0.2, 40); },
      pickup: function () { blip(660, 0.09, 'sine', 0.2); blip(880, 0.12, 'sine', 0.2); },
      busted: function () { blip(440, 0.3, 'sawtooth', 0.2, 220); blip(330, 0.4, 'sawtooth', 0.2, 165); },
      engineStart: function () { blip(80, 0.4, 'sawtooth', 0.25, 160); },
      // Continuous engine hum whose pitch follows speed (0..1).
      setEngine: function (speed01, on) {
        if (!enabled) return;
        if (!ensure()) return;
        if (on && !engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = ctx.createGain();
          engineGain.gain.value = 0.04;
          engineOsc.connect(engineGain); engineGain.connect(master);
          engineOsc.start();
        }
        if (engineOsc) {
          engineOsc.frequency.value = 60 + speed01 * 140;
          engineGain.gain.value = on ? 0.03 + speed01 * 0.05 : 0;
        }
      },
      // Two-tone siren that wails while any wanted level is active.
      setSiren: function (on) {
        if (!enabled) return;
        if (!ensure()) return;
        if (on && !sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'triangle';
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0.05;
          sirenOsc.connect(sirenGain); sirenGain.connect(master);
          sirenOsc.start();
          var up = true;
          var step = function () {
            if (!sirenOsc) return;
            sirenOsc.frequency.value = up ? 950 : 650;
            up = !up;
          };
          step();
          sirenOsc._timer = setInterval(step, 420);
        } else if (!on && sirenOsc) {
          clearInterval(sirenOsc._timer);
          try { sirenOsc.stop(); } catch (e) {}
          sirenOsc = null; sirenGain = null;
        }
      },
      // A lazy bass loop for the sunset drive.
      startMusic: function () {
        if (musicTimer || !ensure()) return;
        var notes = [55, 55, 65.4, 49, 55, 82.4, 73.4, 65.4];
        var i = 0;
        musicTimer = setInterval(function () {
          if (!enabled) return;
          blip(notes[i % notes.length], 0.5, 'triangle', 0.08);
          blip(notes[i % notes.length] * 2, 0.25, 'sine', 0.04);
          i++;
        }, 420);
      },
      stopMusic: function () {
        if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
      },
    };
  }

  TP.Audio = { create: createAudio };
})(window.TP);
