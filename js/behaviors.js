/* ==========================================================================
   COSECHA DE ACERO — behaviors.js
   Comportamientos componibles. Cada enemigo declara los suyos en data.js
   (behaviors: ['biter', ...]) y cada mecha declara su arma (proj: 'bullet').
   Añadir un comportamiento nuevo = añadir una entrada aquí y nombrarla en
   los datos; el motor no se toca.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.DATA, AU = window.AUDIO;
  var G = window.G, S = G.S;

  // ---------- comportamientos de enemigos ----------
  // init(e): al aparecer · update(e, dt): cada frame mientras vive
  G.ENEMY_BEHAVIORS = {

    // muerde edificios cercanos al pasar
    biter: {
      init: function (e) { e.atkCd = Math.random() * D.ATTACK_CD; },
      update: function (e, dt) {
        e.atkCd -= dt;
        if (e.atkCd > 0 || !S.buildings.length) return;
        var best = null, bd = D.ATTACK_RANGE * D.ATTACK_RANGE;
        for (var j = 0; j < S.buildings.length; j++) {
          var b = S.buildings[j];
          var d2 = G.dist2(e.x, e.y, b.x, b.y);
          if (d2 <= bd) { bd = d2; best = b; }
        }
        if (!best) return;
        e.atkCd = D.ATTACK_CD;
        best.hp -= e.def.bDmg;
        best.flash = 0.15;
        G.burst(best.x, best.y - 8, '#9ee34a', 4, 60);
        AU.squish();
        if (best.hp <= 0) G.destroyBuilding(best);
      }
    },

    // engendra bichos mientras avanza (la Nodriza)
    spawner: {
      init: function (e) { e.spawnT = 0; },
      update: function (e, dt) {
        e.spawnT += dt;
        if (e.spawnT < e.def.spawnEvery) return;
        e.spawnT = 0;
        for (var j = 0; j < e.def.spawnCount; j++) {
          G.spawnEnemy(e.def.spawnType, e.wp, e.dist,
            e.x + (Math.random() * 20 - 10), e.y + (Math.random() * 20 - 10));
        }
        G.burst(e.x, e.y, '#c65fd1', 8, 70);
      }
    }
  };

  // ---------- armas de los mechas ----------
  // fire(t, st, e, def): disparo · impact(p): llegada del proyectil (si lo hay)
  G.WEAPONS = {

    bullet: {
      fire: function (t, st, e, def) {
        S.projectiles.push({
          kind: 'bullet', x: t.x, y: t.y - 6,
          speed: def.projSpeed, dmg: st.dmg, splash: 0,
          target: e, lx: e.x, ly: e.y
        });
        AU.shot();
      },
      impact: function (p) {
        if (p.target && !p.target.dead) G.damageEnemy(p.target, p.dmg);
        G.burst(p.lx, p.ly, '#9ee34a', 3, 50);
      }
    },

    shell: {
      fire: function (t, st, e, def) {
        S.projectiles.push({
          kind: 'shell', x: t.x, y: t.y - 6,
          speed: def.projSpeed, dmg: st.dmg, splash: st.splash,
          target: e, lx: e.x, ly: e.y
        });
        AU.cannon();
      },
      impact: function (p) {
        G.burst(p.lx, p.ly, '#e8912a', 14, 110);
        G.burst(p.lx, p.ly, '#454c52', 8, 70);
        AU.boom();
        for (var j = 0; j < S.enemies.length; j++) {
          var o = S.enemies[j];
          if (!o.dead && G.dist2(p.lx, p.ly, o.x, o.y) <= p.splash * p.splash) {
            G.damageEnemy(o, p.dmg);
          }
        }
      }
    },

    beam: {
      fire: function (t, st, e) {
        G.damageEnemy(e, st.dmg);
        S.effects.push({ kind: 'beam', x1: t.x, y1: t.y - 8, x2: e.x, y2: e.y, life: 0.12 });
        G.burst(e.x, e.y, '#f2d94e', 5, 70);
        AU.snipe();
      }
    },

    chain: {
      fire: function (t, st, e, def) {
        var hitList = [e], cur = e;
        while (hitList.length < st.chain) {
          var nxt = null, nd = 80 * 80;
          for (var i = 0; i < S.enemies.length; i++) {
            var o = S.enemies[i];
            if (o.dead || hitList.indexOf(o) !== -1) continue;
            var d2 = G.dist2(cur.x, cur.y, o.x, o.y);
            if (d2 < nd) { nd = d2; nxt = o; }
          }
          if (!nxt) break;
          hitList.push(nxt); cur = nxt;
        }
        var px = t.x, py = t.y - 14;
        hitList.forEach(function (o) {
          S.effects.push({ kind: 'zap', x1: px, y1: py, x2: o.x, y2: o.y, life: 0.15 });
          G.damageEnemy(o, st.dmg);
          if (!o.dead) o.slowT = Math.max(o.slowT, def.slowDur);
          px = o.x; py = o.y;
        });
        AU.zap();
      }
    }
  };
})();
