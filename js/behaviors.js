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

    // muerde lo que tenga cerca al pasar: edificios, mechas y unidades
    biter: {
      init: function (e) { e.atkCd = Math.random() * D.ATTACK_CD; },
      update: function (e, dt) {
        e.atkCd -= dt;
        if (e.atkCd > 0) return;
        var targets = G.defenseTargets();
        var best = null, bd = D.ATTACK_RANGE * D.ATTACK_RANGE;
        for (var j = 0; j < targets.length; j++) {
          var o = targets[j];
          var d2 = G.dist2(e.x, e.y, o.x, o.y);
          if (d2 <= bd) { bd = d2; best = o; }
        }
        if (!best) return;
        e.atkCd = D.ATTACK_CD;
        e.aggroT = 2;            // los mechas priorizan a quien ataca
        G.burst(best.x, best.y - 8, '#9ee34a', 4, 60);
        AU.squish();
        G.damageDefense(best, e.def.bDmg);
      }
    },

    // escupe ácido a distancia contra la defensa
    spit: {
      init: function (e) { e.spitCd = Math.random() * e.def.spit.cd; },
      update: function (e, dt) {
        e.spitCd -= dt;
        if (e.spitCd > 0) return;
        var sp = e.def.spit;
        var targets = G.defenseTargets();
        var best = null, bd = sp.range * sp.range;
        for (var j = 0; j < targets.length; j++) {
          var o = targets[j];
          var d2 = G.dist2(e.x, e.y, o.x, o.y);
          if (d2 <= bd) { bd = d2; best = o; }
        }
        if (!best) return;
        e.spitCd = sp.cd;
        e.aggroT = 2;
        S.eShots.push({
          x: e.x, y: e.y, target: best, lx: best.x, ly: best.y,
          speed: sp.speed, dmg: sp.dmg
        });
      }
    },

    // carga contra la defensa cercana y se inmola (el Detonador)
    kamikaze: {
      init: function (e) { e.chargeTarget = null; },
      update: function (e, dt) {
        var bm = e.def.boom;
        var tg = e.chargeTarget;
        if (tg && (tg.hp <= 0 || G.defenseTargets().indexOf(tg) === -1)) {
          tg = e.chargeTarget = null;
        }
        if (!tg) {
          var targets = G.defenseTargets();
          var bd = bm.detect * bm.detect;
          for (var j = 0; j < targets.length; j++) {
            var o = targets[j];
            var d2 = G.dist2(e.x, e.y, o.x, o.y);
            if (d2 <= bd) { bd = d2; tg = o; }
          }
          if (tg) e.chargeTarget = tg;
        }
        if (!tg) return;
        e.aggroT = 2;   // que los mechas lo prioricen: es una amenaza
        if (G.dist2(e.x, e.y, tg.x, tg.y) <= bm.fuse * bm.fuse) {
          e.dead = true;   // se inmola: sin recompensa para el granjero
          S.decals.push({ x: e.x, y: e.y, life: 12, size: e.def.size + 2 });
          G.enemyBoom(e);
        }
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
      fire: function (t, st, e, def) {
        // la VIUDA castiga a los voladores
        var dmg = (e.flying && def.airBonus) ? Math.round(st.dmg * def.airBonus) : st.dmg;
        G.damageEnemy(e, dmg);
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
