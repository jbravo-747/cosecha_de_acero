/* ==========================================================================
   COSECHA DE ACERO — main.js
   Bucle principal: actualiza el motor, dibuja y sincroniza el panel.
   ========================================================================== */
(function () {
  'use strict';

  var G = window.G, S = G.S;

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!S.paused && (S.phase === 'build' || S.phase === 'wave')) {
      for (var i = 0; i < S.speed; i++) G.update(dt);
    }
    G.render();
    G.updateUI();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
