/* ==========================================================================
   COSECHA DE ACERO — audio.js
   Efectos de sonido sintetizados con WebAudio (sin archivos).
   ========================================================================== */
(function () {
  'use strict';

  var ctx = null, master = null, muted = false;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // tono simple con envolvente y deslizamiento de frecuencia
  function tone(type, f0, f1, dur, vol, delay) {
    if (muted || !ensure()) return;
    var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // ráfaga de ruido (explosiones, impactos)
  function noise(dur, vol, cutoff, delay) {
    if (muted || !ensure()) return;
    var t = ctx.currentTime + (delay || 0);
    var len = Math.max(1, (ctx.sampleRate * dur) | 0);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cutoff || 900;
    var g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  window.AUDIO = {
    unlock: function () { ensure(); },
    toggleMute: function () { muted = !muted; return muted; },
    isMuted: function () { return muted; },
    shot:   function () { tone('square', 620, 180, 0.07, 0.12); },
    cannon: function () { noise(0.35, 0.5, 500); tone('sine', 120, 40, 0.3, 0.4); },
    boom:   function () { noise(0.25, 0.35, 700); },
    zap:    function () { tone('sawtooth', 1400, 90, 0.14, 0.16); tone('square', 900, 60, 0.1, 0.1, 0.02); },
    snipe:  function () { tone('square', 1800, 200, 0.12, 0.2); noise(0.1, 0.2, 2500); },
    squish: function () { tone('sine', 300, 50, 0.18, 0.25); noise(0.12, 0.18, 400); },
    hurt:   function () { tone('square', 200, 60, 0.3, 0.3); tone('square', 150, 50, 0.3, 0.2, 0.05); },
    coin:   function () { tone('square', 880, 880, 0.05, 0.1); tone('square', 1320, 1320, 0.08, 0.1, 0.05); },
    horn:   function () { tone('sawtooth', 180, 180, 0.25, 0.25); tone('sawtooth', 240, 240, 0.35, 0.25, 0.22); },
    build:  function () { tone('square', 260, 520, 0.1, 0.15); noise(0.08, 0.12, 1200, 0.04); },
    sell:   function () { tone('square', 520, 260, 0.12, 0.15); },
    click:  function () { tone('square', 700, 700, 0.03, 0.08); },
    win:    function () { [523, 659, 784, 1047].forEach(function (f, i) { tone('square', f, f, 0.22, 0.18, i * 0.14); }); },
    lose:   function () { [392, 330, 262, 196].forEach(function (f, i) { tone('sawtooth', f, f * 0.9, 0.3, 0.2, i * 0.2); }); }
  };
})();
