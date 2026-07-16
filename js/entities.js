/* ==========================================================================
   COSECHA DE ACERO — entities.js
   Lógica de juego: colocación, movimiento de mechas, unidades de apoyo,
   oleadas, munición, daño y el bucle update().
   Los comportamientos por tipo viven en behaviors.js; aquí solo el motor.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.DATA, AU = window.AUDIO;
  var G = window.G, S = G.S;
  var W = G.W, H = G.H, TILE = G.TILE;
  var wpPix = G.wpPix;

  var MOVE_SPEED = 42;   // px/s de un mecha caminando a su nueva posición

  // ---------- colocación / selección ----------
  function clearSelection() {
    S.selected = null;
    S.selectedB = null;
    S.selectedU = null;
  }

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
    clearSelection();
    AU.click();
  }

  function cancelActions() {
    S.placing = null;
    clearSelection();
  }

  function tryBuild(c, r) {
    if (G.isBldgKey(S.placing)) {
      var bdef = D.BUILDINGS[S.placing];
      if (!G.canBuild(c, r) || S.money < bdef.cost) return;
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
      kind: 'tower', type: S.placing, c: c, r: r,
      x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
      level: 1, invested: def.cost, cd: 0, angle: -Math.PI / 2,
      hp: def.hp, maxHp: def.hp, ammo: def.ammo,
      moving: false, moveCd: 0, tx: 0, ty: 0, incoming: null,
      flash: 0, offline: false
    });
    G.recomputePower();
    G.floater(c * TILE + TILE / 2, r * TILE, '-$' + def.cost, '#e05545');
    AU.build();
    if (S.money < def.cost) S.placing = null;
  }

  // orden de movimiento tipo ajedrez: hasta def.move tiles (Chebyshev)
  function tryMove(t, c, r) {
    var def = D.TOWERS[t.type];
    if (t.moving || t.moveCd > 0) return false;
    if (c === t.c && r === t.r) return false;
    if (G.chebyshev(t.c, t.r, c, r) > def.move) return false;
    if (!G.canBuild(c, r)) return false;
    t.c = c; t.r = r;               // reserva el tile de destino
    t.tx = c * TILE + TILE / 2;
    t.ty = r * TILE + TILE / 2;
    t.moving = true;
    AU.click();
    return true;
  }

  function buyUnit(key) {
    if (S.phase !== 'build' && S.phase !== 'wave') return;
    var def = D.UNITS[key];
    if (S.money < def.cost) { AU.click(); return; }
    S.money -= def.cost;
    S.units.push(G.makeUnit(key, false));
    G.floater(D.BARN_POS.x, D.BARN_POS.y - 14, def.name + ' LISTO', '#8ac94a');
    AU.build();
  }

  function toggleUnitMode() {
    var u = S.selectedU;
    if (!u || u.type !== 'drone') return;
    u.mode = u.mode === 'reload' ? 'attack' : 'reload';
    if (u.target && u.target.incoming === u) u.target.incoming = null;
    u.target = null;
    u.state = 'idle';
    if (u.mode === 'attack') u.post = { x: u.x, y: u.y };
    G.floater(u.x, u.y - 12, 'MODO ' + (u.mode === 'attack' ? 'ATAQUE' : 'RECARGA'), '#6ab0e8');
    AU.click();
  }

  function sellSelectedU() {
    var u = S.selectedU;
    if (!u) return;
    var refund = Math.round(u.invested * D.SELL_FACTOR);
    S.money += refund;
    if (u.target && u.target.incoming === u) u.target.incoming = null;
    S.units.splice(S.units.indexOf(u), 1);
    G.floater(u.x, u.y, '+$' + refund, '#f2d94e');
    S.selectedU = null;
    AU.sell();
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
    var st = G.towerStats(t);
    t.maxHp = st.maxHp;
    t.hp = st.maxHp;            // el taller lo deja como nuevo
    t.ammo = st.maxAmmo;        // y con el cargador lleno
    G.burst(t.x, t.y, '#f2d94e', 12, 60);
    G.floater(t.x, t.y - 10, 'NIVEL ' + t.level, '#8ac94a');
    AU.build();
  }

  function sellSelected() {
    var t = S.selected;
    if (!t) return;
    var refund = Math.round(t.invested * D.SELL_FACTOR);
    S.money += refund;
    if (t.incoming) t.incoming.target = null;
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
    // los voladores toman el atajo aéreo directo al granero
    var path = def.flying ? G.flyPath : wpPix;
    var e = {
      type: type, def: def, path: path, flying: !!def.flying,
      hp: def.hp * D.hpScale(S.wave), maxHp: def.hp * D.hpScale(S.wave),
      bounty: def.bounty, elite: false,
      x: px !== undefined ? px : path[0].x,
      y: py !== undefined ? py : path[0].y + (Math.random() * 10 - 5),
      wp: atWp !== undefined ? atWp : 1,
      dist: atDist !== undefined ? atDist : 0,
      slowT: 0, angle: 0, animT: Math.random(), aggroT: 0,
      dead: false
    };
    // variantes de élite: más frecuentes y duras a mayor oleada
    if (type !== 'boss' && S.wave >= D.ELITE.fromWave) {
      var chance = Math.min(D.ELITE.chanceMax,
        (S.wave - D.ELITE.fromWave + 1) * D.ELITE.chance);
      if (Math.random() < chance) {
        e.elite = true;
        e.hp = e.maxHp = e.maxHp * D.ELITE.hpMul;
        e.bounty = Math.round(def.bounty * D.ELITE.bountyMul);
      }
    }
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
      S.money += e.bounty;
      G.floater(e.x, e.y - 8, '+$' + e.bounty);
      // los bichos duros (y las élites) sueltan partes para el taller
      var dropChance = e.def.drop ? e.def.drop.chance : (e.elite ? D.ELITE.dropChance : 0);
      var dropN = e.def.drop ? e.def.drop.n : 1;
      if (dropChance && Math.random() < dropChance) {
        S.parts += dropN;
        G.floater(e.x, e.y - 20, '+' + dropN + ' ⚙', '#c65fd1');
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

  // ---------- daño a la defensa (edificios, mechas, unidades) ----------
  function damageDefense(o, dmg) {
    o.hp -= dmg;
    o.flash = 0.15;
    if (o.hp > 0) return;
    if (o.kind === 'bldg') destroyBuilding(o);
    else if (o.kind === 'tower') destroyTower(o);
    else killUnit(o);
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

  function destroyTower(t) {
    S.towers.splice(S.towers.indexOf(t), 1);
    if (S.selected === t) S.selected = null;
    if (t.incoming) t.incoming.target = null;
    G.burst(t.x, t.y, '#e8912a', 16, 110);
    G.burst(t.x, t.y, '#454c52', 10, 80);
    S.decals.push({ x: t.x, y: t.y, life: 20, size: 9, rubble: true });
    S.shake = Math.max(S.shake, 0.25);
    G.floater(t.x, t.y - 12, '¡' + D.TOWERS[t.type].name + ' DERRIBADO!', '#e05545');
    AU.boom();
    G.recomputePower();
  }

  function killUnit(u) {
    S.units.splice(S.units.indexOf(u), 1);
    if (S.selectedU === u) S.selectedU = null;
    if (u.target && u.target.incoming === u) u.target.incoming = null;
    G.burst(u.x, u.y, '#e8912a', 10, 90);
    G.floater(u.x, u.y - 10, '¡' + D.UNITS[u.type].name + ' PERDIDO!', '#e05545');
    AU.boom();
  }

  // ---------- disparo de torres ----------
  // prioriza a los bichos que están atacando a la defensa (aggroT); si no
  // hay ninguno en rango, al más avanzado hacia el granero
  function acquireTarget(x, y, range) {
    var best = null, bd = -1, bestAggro = null, bdA = -1;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      if (G.dist2(x, y, e.x, e.y) > range * range) continue;
      if (e.aggroT > 0 && e.dist > bdA) { bestAggro = e; bdA = e.dist; }
      if (e.dist > bd) { best = e; bd = e.dist; }
    }
    return bestAggro || best;
  }

  function fireTower(t, st) {
    if (t.ammo <= 0) return;
    var def = D.TOWERS[t.type];
    var e = acquireTarget(t.x, t.y, st.range);
    if (!e) return;
    t.angle = Math.atan2(e.y - t.y, e.x - t.x);
    t.cd = st.rof;
    t.flash = 0.08;
    t.ammo--;
    G.WEAPONS[def.proj].fire(t, st, e, def);
  }

  // ---------- unidades de apoyo ----------
  function moveTo(u, x, y, speed, dt) {
    var dx = x - u.x, dy = y - u.y;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var step = speed * dt;
    if (step >= d) { u.x = x; u.y = y; return true; }
    u.x += dx / d * step;
    u.y += dy / d * step;
    return false;
  }

  function needsAmmo(t) {
    return !t.moving && t.ammo < G.towerStats(t).maxAmmo * D.AMMO_LOW && !t.incoming;
  }

  function updateReloader(u, def, dt) {
    if (u.state === 'idle') {
      // en el granero: busca el mecha con hambre de munición más cercano
      var best = null, bd = Infinity;
      for (var i = 0; i < S.towers.length; i++) {
        var t = S.towers[i];
        if (!needsAmmo(t)) continue;
        var d2 = G.dist2(u.x, u.y, t.x, t.y);
        if (d2 < bd) { bd = d2; best = t; }
      }
      if (best) {
        u.target = best;
        best.incoming = u;
        u.state = 'go';
      }
    } else if (u.state === 'go') {
      var tg = u.target;
      if (!tg || S.towers.indexOf(tg) === -1) {
        if (tg && tg.incoming === u) tg.incoming = null;
        u.target = null; u.state = 'back'; return;
      }
      if (moveTo(u, tg.x, tg.y - 10, def.speed, dt)) {
        u.state = 'load';
        u.t = D.RELOAD_TIME;
      }
    } else if (u.state === 'load') {
      u.t -= dt;
      if (u.t <= 0) {
        var tg2 = u.target;
        if (tg2 && S.towers.indexOf(tg2) !== -1) {
          tg2.ammo = G.towerStats(tg2).maxAmmo;
          tg2.incoming = null;
          G.floater(tg2.x, tg2.y - 16, '+MUNICIÓN', '#f2d94e');
          AU.coin();
        }
        u.target = null;
        u.state = 'back';
      }
    } else { // back
      if (moveTo(u, D.BARN_POS.x, D.BARN_POS.y, def.speed, dt)) {
        u.state = 'idle';
      }
    }
  }

  function updateAttackDrone(u, def, dt) {
    if (u.ammo <= 0 || u.state === 'restock') {
      u.state = 'restock';
      if (moveTo(u, D.BARN_POS.x, D.BARN_POS.y, def.speed, dt)) {
        u.ammo = def.ammo;
        u.state = 'idle';
      }
      return;
    }
    if (u.post && G.dist2(u.x, u.y, u.post.x, u.post.y) > 16) {
      moveTo(u, u.post.x, u.post.y, def.speed, dt);
      return;
    }
    u.cd -= dt;
    if (u.cd > 0) return;
    var e = acquireTarget(u.x, u.y, def.atkRange);
    if (!e) return;
    u.cd = def.atkRof;
    u.ammo--;
    damageEnemy(e, def.atkDmg);
    S.effects.push({ kind: 'beam', x1: u.x, y1: u.y, x2: e.x, y2: e.y, life: 0.08 });
    AU.shot();
  }

  function updateUnit(u, dt) {
    var def = D.UNITS[u.type];
    u.animT += dt;
    if (u.flash > 0) u.flash -= dt;
    if (u.type === 'drone' && u.mode === 'attack') updateAttackDrone(u, def, dt);
    else updateReloader(u, def, dt);
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
      if (e.aggroT > 0) e.aggroT -= dt;
      e.animT += dt;

      var wp = e.path[e.wp];
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
      if (e.wp >= e.path.length) {
        // llegó al granero
        S.lives -= e.def.dmg;
        S.hurtFlash = 0.35;
        S.shake = Math.max(S.shake, 0.2);
        S.enemies.splice(i, 1);
        AU.hurt();
        if (S.lives <= 0) { S.lives = 0; endGame(false); return; }
        continue;
      }

      // comportamientos declarados en data.js (morder, escupir, engendrar)
      var bs = e.def.behaviors;
      if (bs) {
        for (j = 0; j < bs.length; j++) {
          G.ENEMY_BEHAVIORS[bs[j]].update(e, dt);
        }
      }
    }

    // torres: desplazamiento y disparo
    for (i = 0; i < S.towers.length; i++) {
      var t = S.towers[i];
      if (t.flash > 0) t.flash -= dt;
      t.cd -= dt;
      if (t.moving) {
        if (moveTo(t, t.tx, t.ty, MOVE_SPEED, dt)) {
          t.moving = false;
          t.moveCd = D.MOVE_CD;
          G.recomputePower();
        }
        continue;                // caminando no dispara
      }
      if (t.moveCd > 0) t.moveCd -= dt;
      if (t.offline) continue;   // sin energía no dispara
      if (t.cd <= 0) fireTower(t, G.towerStats(t));
    }

    // unidades de apoyo
    for (i = 0; i < S.units.length; i++) updateUnit(S.units[i], dt);

    // flash de edificios golpeados
    for (i = 0; i < S.buildings.length; i++) {
      if (S.buildings[i].flash > 0) S.buildings[i].flash -= dt;
    }

    // proyectiles aliados
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

    // escupitajos enemigos
    for (i = S.eShots.length - 1; i >= 0; i--) {
      var q = S.eShots[i];
      var alive = q.target && q.target.hp > 0 &&
        (S.buildings.indexOf(q.target) !== -1 ||
         S.towers.indexOf(q.target) !== -1 ||
         S.units.indexOf(q.target) !== -1);
      if (alive) { q.lx = q.target.x; q.ly = q.target.y; }
      var qdx = q.lx - q.x, qdy = q.ly - q.y;
      var qd = Math.sqrt(qdx * qdx + qdy * qdy) || 0.001;
      var qs = q.speed * dt;
      if (qs >= qd) {
        if (alive) damageDefense(q.target, q.dmg);
        G.burst(q.lx, q.ly, '#9ee34a', 5, 60);
        S.eShots.splice(i, 1);
      } else {
        q.x += qdx / qd * qs;
        q.y += qdy / qd * qs;
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
  G.tryMove = tryMove;
  G.buyUnit = buyUnit;
  G.toggleUnitMode = toggleUnitMode;
  G.sellSelectedU = sellSelectedU;
  G.upgradeSelected = upgradeSelected;
  G.sellSelected = sellSelected;
  G.repairSelectedB = repairSelectedB;
  G.sellSelectedB = sellSelectedB;
  G.startWave = startWave;
  G.spawnEnemy = spawnEnemy;
  G.damageEnemy = damageEnemy;
  G.damageDefense = damageDefense;
  G.destroyBuilding = destroyBuilding;
  G.destroyTower = destroyTower;
  G.update = update;
})();
