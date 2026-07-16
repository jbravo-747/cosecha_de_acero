/* ==========================================================================
   COSECHA DE ACERO — entities.js
   Lógica de juego: colocación, mejoras, oleadas, daño y el bucle update().
   Los comportamientos por tipo viven en behaviors.js; aquí solo el motor.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.DATA, AU = window.AUDIO;
  var G = window.G, S = G.S;
  var W = G.W, H = G.H, TILE = G.TILE;
  var wpPix = G.wpPix;

  // ---------- colocación / selección ----------
  function startPlacing(key) {
    if (S.phase !== 'build' && S.phase !== 'wave') return;
    var def = G.isBldgKey(key) ? D.BUILDINGS[key] : D.TOWERS[key];
    if (S.money < def.cost) { AU.click(); return; }
    if (!G.isBldgKey(key)) {
      if (!G.shopAlive()) {
        G.floater(W / 2, H / 2, 'NECESITAS UN TALLER EN PIE', '#e05545');
        AU.click(); return;
      }
      if (S.energyUsed + def.energy > S.energyCap) {
        G.floater(W / 2, H / 2, 'SIN ENERGÍA: CONSTRUYE UN GENERADOR', '#6ab0e8');
        AU.click(); return;
      }
    }
    S.placing = (S.placing === key) ? null : key;
    S.selected = null;
    S.selectedB = null;
    AU.click();
  }

  function cancelActions() {
    S.placing = null;
    S.selected = null;
    S.selectedB = null;
  }

  function tryBuild(c, r) {
    if (G.isBldgKey(S.placing)) {
      var bdef = D.BUILDINGS[S.placing];
      if (!G.canBuild(c, r) || !G.nearPath(c, r) || S.money < bdef.cost) return;
      S.money -= bdef.cost;
      S.buildings.push(G.makeBuilding(S.placing, c, r));
      G.floater(c * TILE + TILE / 2, r * TILE, '-$' + bdef.cost, '#e05545');
      AU.build();
      G.recomputePower();
      if (S.money < bdef.cost) S.placing = null;
      return;
    }
    var def = D.TOWERS[S.placing];
    if (!G.canBuild(c, r) || S.money < def.cost) return;
    if (!G.shopAlive() || S.energyUsed + def.energy > S.energyCap) return;
    S.money -= def.cost;
    S.towers.push({
      type: S.placing, c: c, r: r,
      x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
      level: 1, invested: def.cost, cd: 0, angle: -Math.PI / 2,
      flash: 0, offline: false
    });
    G.recomputePower();
    G.floater(c * TILE + TILE / 2, r * TILE, '-$' + def.cost, '#e05545');
    AU.build();
    if (S.money < def.cost) S.placing = null;
  }

  function upgradeSelected() {
    var t = S.selected;
    if (!t || t.level >= D.MAX_LEVEL || !G.shopAlive()) return;
    var cost = G.upgradeCost(t), parts = G.upgradeParts(t);
    if (S.money < cost || S.parts < parts) return;
    S.money -= cost;
    S.parts -= parts;
    t.invested += cost;
    t.level++;
    G.burst(t.x, t.y, '#f2d94e', 12, 60);
    G.floater(t.x, t.y - 10, 'NIVEL ' + t.level, '#8ac94a');
    AU.build();
  }

  function sellSelected() {
    var t = S.selected;
    if (!t) return;
    var refund = Math.round(t.invested * D.SELL_FACTOR);
    S.money += refund;
    S.towers.splice(S.towers.indexOf(t), 1);
    G.recomputePower();
    G.floater(t.x, t.y, '+$' + refund, '#f2d94e');
    S.selected = null;
    AU.sell();
  }

  function repairSelectedB() {
    var b = S.selectedB;
    if (!b || b.hp >= b.maxHp) return;
    var cost = G.repairCost(b);
    if (S.money < cost) return;
    S.money -= cost;
    b.hp = b.maxHp;
    G.floater(b.x, b.y - 10, 'REPARADO', '#8ac94a');
    AU.build();
  }

  function sellSelectedB() {
    var b = S.selectedB;
    if (!b) return;
    var refund = Math.round(b.invested * D.SELL_FACTOR);
    S.money += refund;
    S.buildings.splice(S.buildings.indexOf(b), 1);
    G.recomputePower();
    G.floater(b.x, b.y, '+$' + refund, '#f2d94e');
    S.selectedB = null;
    AU.sell();
  }

  // ---------- oleadas ----------
  function startWave(manual) {
    if (S.phase !== 'build' || S.wave >= D.WAVES.length) return;
    if (manual && S.buildT > 0) {
      var bonus = Math.round(S.buildT * D.EARLY_BONUS);
      if (bonus > 0) {
        S.money += bonus;
        G.floater(W / 2, H / 2 - 56, 'DISRUPTOR DESACTIVADO +$' + bonus);
      }
    }
    S.buildT = 0;
    S.wave++;
    S.phase = 'wave';
    S.waveT = 0;
    S.spawnQueue = [];
    D.WAVES[S.wave - 1].forEach(function (grp) {
      for (var i = 0; i < grp.n; i++) {
        S.spawnQueue.push({ time: grp.delay + i * grp.gap, type: grp.t });
      }
    });
    S.spawnQueue.sort(function (a, b) { return a.time - b.time; });
    AU.horn();
    if (S.wave === D.WAVES.length) {
      G.floater(W / 2, H / 2 - 40, '¡LA NODRIZA SE ACERCA!', '#e05545');
    }
  }

  function spawnEnemy(type, atWp, atDist, px, py) {
    var def = D.ENEMIES[type];
    var e = {
      type: type, def: def,
      hp: def.hp * D.hpScale(S.wave), maxHp: def.hp * D.hpScale(S.wave),
      x: px !== undefined ? px : wpPix[0].x,
      y: py !== undefined ? py : wpPix[0].y + (Math.random() * 10 - 5),
      wp: atWp !== undefined ? atWp : 1,
      dist: atDist !== undefined ? atDist : 0,
      slowT: 0, angle: 0, animT: Math.random(),
      dead: false
    };
    (def.behaviors || []).forEach(function (name) {
      var bh = G.ENEMY_BEHAVIORS[name];
      if (bh.init) bh.init(e);
    });
    S.enemies.push(e);
    return e;
  }

  function damageEnemy(e, dmg) {
    if (e.dead) return;
    e.hp -= Math.max(1, dmg - e.def.armor);
    if (e.hp <= 0) {
      e.dead = true;
      S.money += e.def.bounty;
      G.floater(e.x, e.y - 8, '+$' + e.def.bounty);
      // los bichos duros sueltan partes para el taller
      if (e.def.drop && Math.random() < e.def.drop.chance) {
        S.parts += e.def.drop.n;
        G.floater(e.x, e.y - 20, '+' + e.def.drop.n + ' ⚙', '#c65fd1');
        G.burst(e.x, e.y, '#c65fd1', 6, 70);
      }
      G.burst(e.x, e.y, '#9ee34a', e.type === 'boss' ? 40 : 10, e.type === 'boss' ? 160 : 90);
      G.burst(e.x, e.y, '#52276b', 6, 60);
      S.decals.push({ x: e.x, y: e.y, life: 12, size: e.def.size + 2 });
      if (S.decals.length > 50) S.decals.shift();
      if (e.type === 'boss') { S.shake = 0.5; AU.boom(); }
      AU.squish();
    }
  }

  function destroyBuilding(b) {
    S.buildings.splice(S.buildings.indexOf(b), 1);
    if (S.selectedB === b) S.selectedB = null;
    G.burst(b.x, b.y, '#e8912a', 18, 120);
    G.burst(b.x, b.y, '#454c52', 12, 90);
    S.decals.push({ x: b.x, y: b.y, life: 20, size: 10, rubble: true });
    S.shake = Math.max(S.shake, 0.3);
    G.floater(b.x, b.y - 12, '¡' + D.BUILDINGS[b.type].name + ' DESTRUIDO!', '#e05545');
    AU.boom();
    G.recomputePower();
  }

  // ---------- disparo de torres ----------
  function acquireTarget(t, range) {
    var best = null, bd = -1;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      if (G.dist2(t.x, t.y, e.x, e.y) <= range * range && e.dist > bd) {
        best = e; bd = e.dist;
      }
    }
    return best;
  }

  function fireTower(t, st) {
    var def = D.TOWERS[t.type];
    var e = acquireTarget(t, st.range);
    if (!e) return;
    t.angle = Math.atan2(e.y - t.y, e.x - t.x);
    t.cd = st.rof;
    t.flash = 0.08;
    G.WEAPONS[def.proj].fire(t, st, e, def);
  }

  // ---------- actualización ----------
  function update(dt) {
    var i, j;

    // disruptor de portales: cuenta atrás entre oleadas
    if (S.phase === 'build' && S.wave < D.WAVES.length) {
      S.buildT -= dt;
      if (S.buildT <= 0) {
        G.floater(W / 2, H / 2 - 56, '¡EL PORTAL SE ABRIÓ!', '#c65fd1');
        startWave(false);
      }
    }

    // spawner
    if (S.phase === 'wave') {
      S.waveT += dt;
      while (S.spawnQueue.length && S.spawnQueue[0].time <= S.waveT) {
        spawnEnemy(S.spawnQueue.shift().type);
      }
    }

    // enemigos
    for (i = S.enemies.length - 1; i >= 0; i--) {
      var e = S.enemies[i];
      if (e.dead) { S.enemies.splice(i, 1); continue; }
      var spd = e.def.speed * (e.slowT > 0 ? 0.5 : 1);
      if (e.slowT > 0) e.slowT -= dt;
      e.animT += dt;

      var wp = wpPix[e.wp];
      if (wp) {
        var dx = wp.x - e.x, dy = wp.y - e.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        var step = spd * dt;
        e.angle = Math.atan2(dy, dx);
        if (step >= d) {
          e.x = wp.x; e.y = wp.y; e.wp++;
        } else {
          e.x += dx / d * step; e.y += dy / d * step;
        }
        e.dist += step;
      }
      if (e.wp >= wpPix.length) {
        // llegó al granero
        S.lives -= e.def.dmg;
        S.hurtFlash = 0.35;
        S.shake = Math.max(S.shake, 0.2);
        S.enemies.splice(i, 1);
        AU.hurt();
        if (S.lives <= 0) { S.lives = 0; endGame(false); return; }
        continue;
      }

      // comportamientos declarados en data.js (morder, engendrar, ...)
      var bs = e.def.behaviors;
      if (bs) {
        for (j = 0; j < bs.length; j++) {
          G.ENEMY_BEHAVIORS[bs[j]].update(e, dt);
        }
      }
    }

    // torres
    for (i = 0; i < S.towers.length; i++) {
      var t = S.towers[i];
      if (t.flash > 0) t.flash -= dt;
      t.cd -= dt;
      if (t.offline) continue;   // sin energía no dispara
      if (t.cd <= 0) fireTower(t, G.towerStats(t));
    }

    // flash de edificios golpeados
    for (i = 0; i < S.buildings.length; i++) {
      if (S.buildings[i].flash > 0) S.buildings[i].flash -= dt;
    }

    // proyectiles
    for (i = S.projectiles.length - 1; i >= 0; i--) {
      var p = S.projectiles[i];
      if (p.target && !p.target.dead) { p.lx = p.target.x; p.ly = p.target.y; }
      var pdx = p.lx - p.x, pdy = p.ly - p.y;
      var pd = Math.sqrt(pdx * pdx + pdy * pdy) || 0.001;
      var ps = p.speed * dt;
      if (ps >= pd) {
        G.WEAPONS[p.kind].impact(p);
        S.projectiles.splice(i, 1);
      } else {
        p.x += pdx / pd * ps;
        p.y += pdy / pd * ps;
      }
    }

    // efectos / partículas / flotantes / manchas
    for (i = S.effects.length - 1; i >= 0; i--) {
      S.effects[i].life -= dt;
      if (S.effects[i].life <= 0) S.effects.splice(i, 1);
    }
    for (i = S.particles.length - 1; i >= 0; i--) {
      var pt = S.particles[i];
      pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.92; pt.vy *= 0.92;
      if (pt.life <= 0) S.particles.splice(i, 1);
    }
    for (i = S.floaters.length - 1; i >= 0; i--) {
      var f = S.floaters[i];
      f.life -= dt; f.y -= 22 * dt;
      if (f.life <= 0) S.floaters.splice(i, 1);
    }
    for (i = S.decals.length - 1; i >= 0; i--) {
      S.decals[i].life -= dt;
      if (S.decals[i].life <= 0) S.decals.splice(i, 1);
    }
    if (S.hurtFlash > 0) S.hurtFlash -= dt;
    if (S.shake > 0) S.shake -= dt;

    // ¿oleada terminada?
    if (S.phase === 'wave' && !S.spawnQueue.length && !S.enemies.length) {
      if (S.wave >= D.WAVES.length) { endGame(true); return; }
      S.phase = 'build';
      S.buildT = D.BUILD_TIME;   // el disruptor vuelve a contener el portal
      var bonus = D.waveBonus(S.wave);
      S.money += bonus;
      G.floater(W / 2, H / 2 - 30, 'OLEADA SUPERADA  +$' + bonus, '#8ac94a');
      AU.coin();
    }
  }

  function endGame(won) {
    S.phase = won ? 'won' : 'lost';
    if (won) AU.win(); else AU.lose();
  }

  G.startPlacing = startPlacing;
  G.cancelActions = cancelActions;
  G.tryBuild = tryBuild;
  G.upgradeSelected = upgradeSelected;
  G.sellSelected = sellSelected;
  G.repairSelectedB = repairSelectedB;
  G.sellSelectedB = sellSelectedB;
  G.startWave = startWave;
  G.spawnEnemy = spawnEnemy;
  G.damageEnemy = damageEnemy;
  G.destroyBuilding = destroyBuilding;
  G.update = update;
})();
