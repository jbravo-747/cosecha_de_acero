/* ==========================================================================
   COSECHA DE ACERO — anim.js
   Sistema de animación: motor de tweens con easing + efectos reutilizables
   (anillos de onda, cadáveres que se desvanecen, despliegue con rebote).
   Los tweens viven en S.tweens y avanzan con el reloj del juego, así que
   la pausa también los congela.
   ========================================================================== */
(function () {
  'use strict';

  var G = window.G, S = G.S;

  // ---------- easing ----------
  var EASE = {
    linear:  function (p) { return p; },
    outQuad: function (p) { return 1 - (1 - p) * (1 - p); },
    // rebote al aterrizar: ideal para despliegues
    outBack: function (p) {
      var c = 1.70158, q = p - 1;
      return 1 + (c + 1) * q * q * q + c * q * q;
    }
  };

  // ---------- motor de tweens ----------
  // anima obj[prop] de from a to en dur segundos
  function tween(obj, prop, from, to, dur, ease) {
    obj[prop] = from;
    S.tweens.push({
      o: obj, p: prop, f: from, t: to, d: dur, el: 0,
      e: EASE[ease] || EASE.outQuad
    });
  }

  function updateTweens(dt) {
    for (var i = S.tweens.length - 1; i >= 0; i--) {
      var tw = S.tweens[i];
      tw.el += dt;
      var p = Math.min(1, tw.el / tw.d);
      tw.o[tw.p] = tw.f + (tw.t - tw.f) * tw.e(p);
      if (p >= 1) {
        tw.o[tw.p] = tw.t;
        S.tweens.splice(i, 1);
      }
    }
  }

  // ---------- efectos empaquetados ----------
  // anillo de onda expansiva (explosiones, mejoras, avisos)
  function ring(x, y, r1, color, dur) {
    S.effects.push({
      kind: 'ring', x: x, y: y, r0: 4, r1: r1, color: color,
      life: dur || 0.4, max: dur || 0.4
    });
  }

  // cadáver de bicho: el sprite se encoge y desvanece donde cayó
  function die(e) {
    S.effects.push({
      kind: 'die', x: e.x, y: e.y, angle: e.angle,
      spr: e.def.sprite, type: e.type, elite: e.elite,
      life: 0.28, max: 0.28
    });
  }

  // despliegue: la entidad brota del suelo con rebote (anima su sy)
  function pop(o) { tween(o, 'sy', 0, 1, 0.3, 'outBack'); }

  G.tween = tween;
  G.updateTweens = updateTweens;
  G.fx = { ring: ring, die: die, pop: pop };
})();
