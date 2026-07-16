/* ==========================================================================
   COSECHA DE ACERO — game.js
   Motor: estado, bucle, entidades, input y render.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.DATA, SP = window.SPRITES, AU = window.AUDIO;
  var TILE = D.TILE, COLS = D.COLS, ROWS = D.ROWS;
  var W = COLS * TILE, H = ROWS * TILE;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---------- geometría del camino ----------
  var wpPix = D.PATH.map(function (p) {
    return { x: p[0] * TILE + TILE / 2, y: p[1] * TILE + TILE / 2 };
  });

  var pathCells = {};                       // "c,r" -> true
  (function () {
    for (var i = 0; i < D.PATH.length - 1; i++) {
      var a = D.PATH[i], b = D.PATH[i + 1];
      var dc = Math.sign(b[0] - a[0]), dr = Math.sign(b[1] - a[1]);
      var c = a[0], r = a[1];
      pathCells[c + ',' + r] = true;
      while (c !== b[0] || r !== b[1]) {
        c += dc; r += dr;
        pathCells[c + ',' + r] = true;
      }
    }
  })();

  var blocked = {};                         // tiles no construibles
  Object.keys(pathCells).forEach(function (k) { blocked[k] = true; });
  D.BARN_TILES.forEach(function (t) { blocked[t[0] + ',' + t[1]] = true; });
  D.ROCKS.forEach(function (t) { blocked[t[0] + ',' + t[1]] = true; });

  // ---------- estado ----------
  var S = {};
  function makeBuilding(type, c, r) {
    var def = D.BUILDINGS[type];
    return {
      type: type, c: c, r: r,
      x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
      hp: def.hp, maxHp: def.hp, invested: def.cost, flash: 0
    };
  }
  function resetState() {
    S.phase = 'menu';          // menu | build | wave | won | lost
    S.money = D.START_MONEY;
    S.lives = D.START_LIVES;
    S.parts = 0;               // partes ⚙ para mejorar mechas
    S.wave = 0;
    S.speed = 1;
    S.paused = false;
    S.enemies = [];
    S.towers = [];
    S.buildings = D.START_BUILDINGS.map(function (b) {
      return makeBuilding(b.type, b.c, b.r);
    });
    S.projectiles = [];
    S.effects = [];            // rayos, trazadoras
    S.particles = [];
    S.floaters = [];
    S.decals = [];
    S.spawnQueue = [];
    S.waveT = 0;
    S.buildT = D.BUILD_TIME;   // cuenta atrás del disruptor de portales
    S.placing = null;          // tipo de torre/edificio en colocación
    S.selected = null;         // torre seleccionada
    S.selectedB = null;        // edificio seleccionado
    S.hover = null;            // {c, r}
    S.hurtFlash = 0;
    S.shake = 0;
    recomputePower();
  }
  // ---------- energía ----------
  function shopAlive() {
    for (var i = 0; i < S.buildings.length; i++) {
      if (S.buildings[i].type === 'shop') return true;
    }
    return false;
  }
  function recomputePower() {
    var cap = 0, used = 0, i;
    for (i = 0; i < S.buildings.length; i++) {
      cap += D.BUILDINGS[S.buildings[i].type].energy;
    }
    // si cae la capacidad, los últimos mechas construidos quedan sin energía
    for (i = 0; i < S.towers.length; i++) {
      used += D.TOWERS[S.towers[i].type].energy;
      S.towers[i].offline = used > cap;
    }
    S.energyCap = cap;
    S.energyUsed = used;
  }
  resetState();

  // ---------- fondo pre-horneado ----------
  var bg = document.createElement('canvas');
  bg.width = W; bg.height = H;
  (function bakeBG() {
    var g = bg.getContext('2d');
    g.imageSmoothingEnabled = false;
    var r, c, k;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        k = c + ',' + r;
        var t;
        if (pathCells[k]) t = SP.tiles.path[(c * 7 + r * 13) % SP.tiles.path.length];
        else t = SP.tiles.grass[(c * 5 + r * 11) % SP.tiles.grass.length];
        g.drawImage(t, 0, 0, 16, 16, c * TILE, r * TILE, TILE, TILE);
      }
    }
    D.CROPS.forEach(function (t) {
      g.drawImage(SP.crop, 0, 0, 16, 16, t[0] * TILE, t[1] * TILE, TILE, TILE);
    });
    D.FENCES.forEach(function (t) {
      g.drawImage(SP.fence, t[0] * TILE, t[1] * TILE + 6, TILE, SP.fence.height * 2);
    });
    D.ROCKS.forEach(function (t) {
      g.drawImage(SP.rock, t[0] * TILE, t[1] * TILE + 7, TILE, SP.rock.height * 2);
    });
    // agujero de spawn (oeste)
    g.drawImage(SP.hole, -24, 3 * TILE - 10, SP.hole.width * 2, SP.hole.height * 2);
    // granero (este)
    g.drawImage(SP.barn, 574, 4 * TILE + 4, SP.barn.width * 2, SP.barn.height * 2);
  })();

  // ---------- referencias de UI ----------
  var el = {
    money: document.getElementById('money'),
    lives: document.getElementById('lives'),
    wave: document.getElementById('wave'),
    energy: document.getElementById('energy'),
    parts: document.getElementById('parts'),
    pauseBtn: document.getElementById('pauseBtn'),
    info: document.getElementById('info'),
    towerBtns: document.getElementById('towerBtns'),
    upBtn: document.getElementById('upBtn'),
    sellBtn: document.getElementById('sellBtn'),
    startBtn: document.getElementById('startBtn'),
    speedBtn: document.getElementById('speedBtn'),
    muteBtn: document.getElementById('muteBtn'),
    title: document.getElementById('title'),
    endScreen: document.getElementById('endScreen'),
    endTitle: document.getElementById('endTitle'),
    endText: document.getElementById('endText'),
    playBtn: document.getElementById('playBtn'),
    restartBtn: document.getElementById('restartBtn'),
    titleArt: document.getElementById('titleArt')
  };

  // arte del título: el mecha COYOTE a 3x
  (function () {
    var g = el.titleArt.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(SP.mechs.mg, 0, 4, 48, 39);
  })();

  // botones de torre y de edificio
  var towerBtnEls = {};
  function makeBtn(key, def, sprite, hotkey) {
    var b = document.createElement('button');
    b.className = 'tbtn';
    var mini = document.createElement('canvas');
    mini.width = 16; mini.height = 16;
    var mg = mini.getContext('2d');
    mg.imageSmoothingEnabled = false;
    mg.drawImage(sprite, 0, 1, 16, 14);
    b.appendChild(mini);
    var lbl = document.createElement('div');
    lbl.innerHTML = def.name + '<br><span class="cost">$' + def.cost +
      '</span> <span class="key">[' + hotkey + ']</span>';
    b.appendChild(lbl);
    b.addEventListener('click', function () { startPlacing(key); });
    el.towerBtns.appendChild(b);
    towerBtnEls[key] = b;
  }
  D.TOWER_ORDER.forEach(function (key, i) {
    makeBtn(key, D.TOWERS[key], SP.mechs[key], i + 1);
  });
  D.BUILDING_ORDER.forEach(function (key, i) {
    makeBtn(key, D.BUILDINGS[key], SP.buildings[key], i + 5);
  });

  // ---------- helpers ----------
  function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

  function towerAt(c, r) {
    for (var i = 0; i < S.towers.length; i++) {
      if (S.towers[i].c === c && S.towers[i].r === r) return S.towers[i];
    }
    return null;
  }

  function buildingAt(c, r) {
    for (var i = 0; i < S.buildings.length; i++) {
      if (S.buildings[i].c === c && S.buildings[i].r === r) return S.buildings[i];
    }
    return null;
  }

  function canBuild(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
    if (blocked[c + ',' + r]) return false;
    if (towerAt(c, r) || buildingAt(c, r)) return false;
    return true;
  }

  // los edificios deben ir pegados al camino (ahí los muerden los bichos)
  function nearPath(c, r) {
    for (var dc = -1; dc <= 1; dc++) {
      for (var dr = -1; dr <= 1; dr++) {
        if (pathCells[(c + dc) + ',' + (r + dr)]) return true;
      }
    }
    return false;
  }

  function towerStats(t) {
    var def = D.TOWERS[t.type];
    var lvl = t.level - 1;
    return {
      dmg: Math.round(def.dmg * Math.pow(D.UP_DMG, lvl)),
      range: def.range + D.UP_RANGE * lvl,
      rof: def.rof * Math.pow(D.UP_ROF, lvl),
      chain: (def.chain || 0) + lvl,
      splash: (def.splash || 0) + 8 * lvl
    };
  }

  function upgradeCost(t) {
    return Math.round(D.TOWERS[t.type].cost * D.UP_COST_FACTOR * t.level);
  }

  function floater(x, y, text, color) {
    S.floaters.push({ x: x, y: y, text: text, color: color || '#f2d94e', life: 1.1 });
  }

  function burst(x, y, color, n, spd) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = (0.3 + Math.random() * 0.7) * (spd || 90);
      S.particles.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0.3 + Math.random() * 0.4, color: color,
        size: 1 + ((Math.random() * 3) | 0)
      });
    }
  }

  // ---------- colocación / selección ----------
  function isBldgKey(key) { return !!D.BUILDINGS[key]; }

  function startPlacing(key) {
    if (S.phase !== 'build' && S.phase !== 'wave') return;
    var def = isBldgKey(key) ? D.BUILDINGS[key] : D.TOWERS[key];
    if (S.money < def.cost) { AU.click(); return; }
    if (!isBldgKey(key)) {
      if (!shopAlive()) {
        floater(W / 2, H / 2, 'NECESITAS UN TALLER EN PIE', '#e05545');
        AU.click(); return;
      }
      if (S.energyUsed + def.energy > S.energyCap) {
        floater(W / 2, H / 2, 'SIN ENERGÍA: CONSTRUYE UN GENERADOR', '#6ab0e8');
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
    if (isBldgKey(S.placing)) {
      var bdef = D.BUILDINGS[S.placing];
      if (!canBuild(c, r) || !nearPath(c, r) || S.money < bdef.cost) return;
      S.money -= bdef.cost;
      S.buildings.push(makeBuilding(S.placing, c, r));
      floater(c * TILE + TILE / 2, r * TILE, '-$' + bdef.cost, '#e05545');
      AU.build();
      recomputePower();
      if (S.money < bdef.cost) S.placing = null;
      return;
    }
    var def = D.TOWERS[S.placing];
    if (!canBuild(c, r) || S.money < def.cost) return;
    if (!shopAlive() || S.energyUsed + def.energy > S.energyCap) return;
    S.money -= def.cost;
    S.towers.push({
      type: S.placing, c: c, r: r,
      x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
      level: 1, invested: def.cost, cd: 0, angle: -Math.PI / 2,
      flash: 0, offline: false
    });
    recomputePower();
    floater(c * TILE + TILE / 2, r * TILE, '-$' + def.cost, '#e05545');
    AU.build();
    if (S.money < def.cost) S.placing = null;
  }

  function upgradeParts(t) { return D.UP_PARTS[t.level - 1] || 0; }

  function upgradeSelected() {
    var t = S.selected;
    if (!t || t.level >= D.MAX_LEVEL || !shopAlive()) return;
    var cost = upgradeCost(t), parts = upgradeParts(t);
    if (S.money < cost || S.parts < parts) return;
    S.money -= cost;
    S.parts -= parts;
    t.invested += cost;
    t.level++;
    burst(t.x, t.y, '#f2d94e', 12, 60);
    floater(t.x, t.y - 10, 'NIVEL ' + t.level, '#8ac94a');
    AU.build();
  }

  function sellSelected() {
    var t = S.selected;
    if (!t) return;
    var refund = Math.round(t.invested * D.SELL_FACTOR);
    S.money += refund;
    S.towers.splice(S.towers.indexOf(t), 1);
    recomputePower();
    floater(t.x, t.y, '+$' + refund, '#f2d94e');
    S.selected = null;
    AU.sell();
  }

  function repairCost(b) { return Math.ceil((b.maxHp - b.hp) * D.REPAIR_PER_HP); }

  function repairSelectedB() {
    var b = S.selectedB;
    if (!b || b.hp >= b.maxHp) return;
    var cost = repairCost(b);
    if (S.money < cost) return;
    S.money -= cost;
    b.hp = b.maxHp;
    floater(b.x, b.y - 10, 'REPARADO', '#8ac94a');
    AU.build();
  }

  function sellSelectedB() {
    var b = S.selectedB;
    if (!b) return;
    var refund = Math.round(b.invested * D.SELL_FACTOR);
    S.money += refund;
    S.buildings.splice(S.buildings.indexOf(b), 1);
    recomputePower();
    floater(b.x, b.y, '+$' + refund, '#f2d94e');
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
        floater(W / 2, H / 2 - 56, 'DISRUPTOR DESACTIVADO +$' + bonus);
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
      floater(W / 2, H / 2 - 40, '¡LA NODRIZA SE ACERCA!', '#e05545');
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
      spawnT: 0, atkCd: Math.random() * D.ATTACK_CD, dead: false
    };
    S.enemies.push(e);
    return e;
  }

  function damageEnemy(e, dmg, splashless) {
    if (e.dead) return;
    e.hp -= Math.max(1, dmg - e.def.armor);
    if (e.hp <= 0) {
      e.dead = true;
      S.money += e.def.bounty;
      floater(e.x, e.y - 8, '+$' + e.def.bounty);
      // los bichos duros sueltan partes para el taller
      if (e.def.drop && Math.random() < e.def.drop.chance) {
        S.parts += e.def.drop.n;
        floater(e.x, e.y - 20, '+' + e.def.drop.n + ' ⚙', '#c65fd1');
        burst(e.x, e.y, '#c65fd1', 6, 70);
      }
      burst(e.x, e.y, '#9ee34a', e.type === 'boss' ? 40 : 10, e.type === 'boss' ? 160 : 90);
      burst(e.x, e.y, '#52276b', 6, 60);
      S.decals.push({ x: e.x, y: e.y, life: 12, size: e.def.size + 2 });
      if (S.decals.length > 50) S.decals.shift();
      if (e.type === 'boss') { S.shake = 0.5; AU.boom(); }
      AU.squish();
    }
  }

  function destroyBuilding(b) {
    S.buildings.splice(S.buildings.indexOf(b), 1);
    if (S.selectedB === b) S.selectedB = null;
    burst(b.x, b.y, '#e8912a', 18, 120);
    burst(b.x, b.y, '#454c52', 12, 90);
    S.decals.push({ x: b.x, y: b.y, life: 20, size: 10, rubble: true });
    S.shake = Math.max(S.shake, 0.3);
    floater(b.x, b.y - 12, '¡' + D.BUILDINGS[b.type].name + ' DESTRUIDO!', '#e05545');
    AU.boom();
    recomputePower();
  }

  // ---------- disparo de torres ----------
  function acquireTarget(t, range) {
    var best = null, bd = -1;
    for (var i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      if (e.dead) continue;
      if (dist2(t.x, t.y, e.x, e.y) <= range * range && e.dist > bd) {
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

    if (def.proj === 'bullet' || def.proj === 'shell') {
      S.projectiles.push({
        kind: def.proj, x: t.x, y: t.y - 6,
        speed: def.projSpeed, dmg: st.dmg, splash: st.splash,
        target: e, lx: e.x, ly: e.y
      });
      if (def.proj === 'shell') AU.cannon(); else AU.shot();
    } else if (def.proj === 'beam') {
      damageEnemy(e, st.dmg);
      S.effects.push({ kind: 'beam', x1: t.x, y1: t.y - 8, x2: e.x, y2: e.y, life: 0.12 });
      burst(e.x, e.y, '#f2d94e', 5, 70);
      AU.snipe();
    } else if (def.proj === 'chain') {
      var hitList = [e], cur = e;
      while (hitList.length < st.chain) {
        var nxt = null, nd = 80 * 80;
        for (var i = 0; i < S.enemies.length; i++) {
          var o = S.enemies[i];
          if (o.dead || hitList.indexOf(o) !== -1) continue;
          var d2 = dist2(cur.x, cur.y, o.x, o.y);
          if (d2 < nd) { nd = d2; nxt = o; }
        }
        if (!nxt) break;
        hitList.push(nxt); cur = nxt;
      }
      var px = t.x, py = t.y - 14;
      hitList.forEach(function (o) {
        S.effects.push({ kind: 'zap', x1: px, y1: py, x2: o.x, y2: o.y, life: 0.15 });
        damageEnemy(o, st.dmg);
        if (!o.dead) o.slowT = Math.max(o.slowT, def.slowDur);
        px = o.x; py = o.y;
      });
      AU.zap();
    }
  }

  // ---------- actualización ----------
  function update(dt) {
    var i, j;

    // disruptor de portales: cuenta atrás entre oleadas
    if (S.phase === 'build' && S.wave < D.WAVES.length) {
      S.buildT -= dt;
      if (S.buildT <= 0) {
        floater(W / 2, H / 2 - 56, '¡EL PORTAL SE ABRIÓ!', '#c65fd1');
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
      // mordiscos a edificios cercanos al pasar
      e.atkCd -= dt;
      if (e.atkCd <= 0 && S.buildings.length) {
        var bBest = null, bD2 = D.ATTACK_RANGE * D.ATTACK_RANGE;
        for (j = 0; j < S.buildings.length; j++) {
          var bb = S.buildings[j];
          var d2b = dist2(e.x, e.y, bb.x, bb.y);
          if (d2b <= bD2) { bD2 = d2b; bBest = bb; }
        }
        if (bBest) {
          e.atkCd = D.ATTACK_CD;
          bBest.hp -= e.def.bDmg;
          bBest.flash = 0.15;
          burst(bBest.x, bBest.y - 8, '#9ee34a', 4, 60);
          AU.squish();
          if (bBest.hp <= 0) destroyBuilding(bBest);
        }
      }

      // la nodriza engendra drones
      if (e.def.spawnEvery) {
        e.spawnT += dt;
        if (e.spawnT >= e.def.spawnEvery) {
          e.spawnT = 0;
          for (j = 0; j < e.def.spawnCount; j++) {
            spawnEnemy(e.def.spawnType, e.wp, e.dist,
              e.x + (Math.random() * 20 - 10), e.y + (Math.random() * 20 - 10));
          }
          burst(e.x, e.y, '#c65fd1', 8, 70);
        }
      }
    }

    // torres
    for (i = 0; i < S.towers.length; i++) {
      var t = S.towers[i];
      if (t.flash > 0) t.flash -= dt;
      t.cd -= dt;
      if (t.offline) continue;   // sin energía no dispara
      if (t.cd <= 0) fireTower(t, towerStats(t));
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
        // impacto
        if (p.kind === 'shell') {
          burst(p.lx, p.ly, '#e8912a', 14, 110);
          burst(p.lx, p.ly, '#454c52', 8, 70);
          AU.boom();
          for (j = 0; j < S.enemies.length; j++) {
            var o = S.enemies[j];
            if (!o.dead && dist2(p.lx, p.ly, o.x, o.y) <= p.splash * p.splash) {
              damageEnemy(o, p.dmg);
            }
          }
        } else {
          if (p.target && !p.target.dead) damageEnemy(p.target, p.dmg);
          burst(p.lx, p.ly, '#9ee34a', 3, 50);
        }
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
      floater(W / 2, H / 2 - 30, 'OLEADA SUPERADA  +$' + bonus, '#8ac94a');
      AU.coin();
    }
  }

  function endGame(won) {
    S.phase = won ? 'won' : 'lost';
    el.endScreen.classList.remove('hidden');
    if (won) {
      el.endTitle.textContent = 'GRANJA SALVADA';
      el.endTitle.classList.remove('bad');
      el.endText.innerHTML = 'La Nodriza cayó y los bichos volvieron a su agujero.<br>' +
        'La cosecha está a salvo... por esta temporada.<br><br>Vidas restantes: ' + S.lives;
      AU.win();
    } else {
      el.endTitle.textContent = 'GRANJA PERDIDA';
      el.endTitle.classList.add('bad');
      el.endText.innerHTML = 'Los bichos llegaron al granero en la oleada ' + S.wave +
        '.<br>Habrá que volver a empezar desde el refugio.';
      AU.lose();
    }
  }

  // ---------- render ----------
  function drawGun(t) {
    var def = D.TOWERS[t.type];
    if (def.proj === 'chain') return; // el pilón no tiene cañón
    ctx.save();
    ctx.translate(t.x, t.y - 6);
    ctx.rotate(t.angle);
    ctx.fillStyle = '#12100e';
    if (t.type === 'cannon') {
      ctx.fillRect(0, -4, 18, 8);
      ctx.fillStyle = '#454c52'; ctx.fillRect(0, -3, 16, 6);
      ctx.fillStyle = '#2b3238'; ctx.fillRect(12, -3, 4, 6);
    } else if (t.type === 'sniper') {
      ctx.fillRect(0, -2, 24, 4);
      ctx.fillStyle = '#35506b'; ctx.fillRect(0, -1, 22, 2);
    } else {
      ctx.fillRect(0, -3, 14, 6);
      ctx.fillStyle = '#454c52'; ctx.fillRect(0, -2, 12, 4);
    }
    if (t.flash > 0) {
      ctx.fillStyle = '#f2d94e';
      var fl = t.type === 'cannon' ? 6 : 4;
      ctx.fillRect(t.type === 'sniper' ? 22 : (t.type === 'cannon' ? 16 : 12), -fl / 2, fl, fl);
    }
    ctx.restore();
  }

  function zigzag(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    var segs = 5, dx = (x2 - x1) / segs, dy = (y2 - y1) / segs;
    for (var i = 1; i < segs; i++) {
      ctx.lineTo(x1 + dx * i + (Math.random() * 10 - 5),
                 y1 + dy * i + (Math.random() * 10 - 5));
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function render() {
    ctx.save();
    if (S.shake > 0) {
      ctx.translate((Math.random() * 6 - 3) * S.shake, (Math.random() * 6 - 3) * S.shake);
    }
    ctx.drawImage(bg, 0, 0);

    var i;

    // manchas de bicho y escombros
    for (i = 0; i < S.decals.length; i++) {
      var dc = S.decals[i];
      ctx.globalAlpha = Math.min(0.45, dc.life / 8);
      ctx.fillStyle = dc.rubble ? '#454c52' : '#5f9926';
      ctx.beginPath();
      ctx.arc(dc.x, dc.y, dc.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // al colocar un edificio, se iluminan los tiles válidos junto al camino
    if (S.placing && isBldgKey(S.placing)) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#6ab0e8';
      for (var vr = 0; vr < ROWS; vr++) {
        for (var vc = 0; vc < COLS; vc++) {
          if (canBuild(vc, vr) && nearPath(vc, vr)) {
            ctx.fillRect(vc * TILE + 1, vr * TILE + 1, TILE - 2, TILE - 2);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // rango de torre seleccionada / en colocación
    var rangeShow = null;
    if (S.selected) {
      rangeShow = { x: S.selected.x, y: S.selected.y, r: towerStats(S.selected).range, ok: true };
    } else if (S.placing && S.hover && !isBldgKey(S.placing)) {
      var hdef = D.TOWERS[S.placing];
      rangeShow = {
        x: S.hover.c * TILE + TILE / 2, y: S.hover.r * TILE + TILE / 2,
        r: hdef.range, ok: canBuild(S.hover.c, S.hover.r)
      };
    } else if (S.placing && S.hover) {
      // marco del tile para edificios
      var okB = canBuild(S.hover.c, S.hover.r) && nearPath(S.hover.c, S.hover.r);
      ctx.strokeStyle = okB ? '#9ee34a' : '#e05545';
      ctx.strokeRect(S.hover.c * TILE + 1.5, S.hover.r * TILE + 1.5, TILE - 3, TILE - 3);
    }
    if (rangeShow) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = rangeShow.ok ? '#9ee34a' : '#e05545';
      ctx.beginPath(); ctx.arc(rangeShow.x, rangeShow.y, rangeShow.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath(); ctx.arc(rangeShow.x, rangeShow.y, rangeShow.r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // edificios de apoyo
    for (i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      var bspr = SP.buildings[b.type];
      if (b.flash > 0) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.random();  // parpadea al recibir daño
      }
      ctx.drawImage(bspr, b.x - 16, b.r * TILE + TILE - 2 - bspr.height * 2, 32, bspr.height * 2);
      ctx.globalAlpha = 1;
      // barra de vida del edificio
      if (b.hp < b.maxHp) {
        var bhw = 22;
        ctx.fillStyle = '#12100e';
        ctx.fillRect(b.x - bhw / 2 - 1, b.r * TILE - 6, bhw + 2, 4);
        ctx.fillStyle = b.hp / b.maxHp > 0.4 ? '#8ac94a' : '#e05545';
        ctx.fillRect(b.x - bhw / 2, b.r * TILE - 5, bhw * Math.max(0, b.hp / b.maxHp), 2);
      }
      if (b === S.selectedB) {
        ctx.strokeStyle = '#f2d94e';
        ctx.strokeRect(b.c * TILE + 1.5, b.r * TILE + 1.5, TILE - 3, TILE - 3);
      }
    }

    // torres
    for (i = 0; i < S.towers.length; i++) {
      var t = S.towers[i];
      var spr = SP.mechs[t.type];
      if (t.offline) ctx.globalAlpha = 0.45;
      ctx.drawImage(spr, t.x - 16, t.r * TILE + TILE - 2 - spr.height * 2, 32, spr.height * 2);
      ctx.globalAlpha = 1;
      if (t.offline) {
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e05545';
        ctx.fillText('SIN ⚡', t.x, t.y - 20);
        ctx.textAlign = 'left';
      }
      drawGun(t);
      // pips de nivel
      for (var lv = 1; lv < t.level; lv++) {
        ctx.fillStyle = '#f2d94e';
        ctx.fillRect(t.x - 14 + (lv - 1) * 6, t.y + 11, 4, 4);
        ctx.strokeStyle = '#12100e';
        ctx.strokeRect(t.x - 14 + (lv - 1) * 6 - 0.5, t.y + 10.5, 5, 5);
      }
      if (t === S.selected) {
        ctx.strokeStyle = '#f2d94e';
        ctx.strokeRect(t.c * TILE + 1.5, t.r * TILE + 1.5, TILE - 3, TILE - 3);
      }
      // aura del pilón tesla
      if (t.type === 'tesla' && t.flash > 0) {
        ctx.strokeStyle = '#f2d94e';
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(t.x, t.y - 14, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // enemigos
    var drawScale = { drone: 1.5, wasp: 1.5, spitter: 1.8, scarab: 2, boss: 2 };
    var bossAlive = null;
    for (i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      var frames = SP.enemies[e.def.sprite];
      var fr = frames[((e.animT * 8) | 0) % 2];
      var sc = drawScale[e.type];
      var dw = fr.width * sc, dh = fr.height * sc;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle + Math.PI / 2);
      if (e.slowT > 0) { ctx.globalAlpha = 0.85; }
      ctx.drawImage(fr, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      ctx.globalAlpha = 1;
      // barra de vida
      if (e.hp < e.maxHp && e.type !== 'boss') {
        var bw = 16;
        ctx.fillStyle = '#12100e';
        ctx.fillRect(e.x - bw / 2 - 1, e.y - dh / 2 - 6, bw + 2, 4);
        ctx.fillStyle = e.slowT > 0 ? '#6ab0e8' : '#8ac94a';
        ctx.fillRect(e.x - bw / 2, e.y - dh / 2 - 5, bw * (e.hp / e.maxHp), 2);
      }
      if (e.type === 'boss') bossAlive = e;
    }

    // proyectiles
    for (i = 0; i < S.projectiles.length; i++) {
      var p = S.projectiles[i];
      if (p.kind === 'shell') {
        ctx.fillStyle = '#12100e';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#454c52';
        ctx.beginPath(); ctx.arc(p.x - 0.5, p.y - 0.5, 2.2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#f2d94e';
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
    }

    // efectos (rayos y trazadoras)
    for (i = 0; i < S.effects.length; i++) {
      var fx = S.effects[i];
      ctx.globalAlpha = Math.min(1, fx.life * 8);
      if (fx.kind === 'zap') {
        ctx.strokeStyle = '#9ee34a'; ctx.lineWidth = 2;
        zigzag(fx.x1, fx.y1, fx.x2, fx.y2);
        ctx.strokeStyle = '#e8f8c0'; ctx.lineWidth = 1;
        zigzag(fx.x1, fx.y1, fx.x2, fx.y2);
      } else {
        ctx.strokeStyle = '#f2d94e'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(fx.x1, fx.y1); ctx.lineTo(fx.x2, fx.y2); ctx.stroke();
      }
      ctx.lineWidth = 1;
    }
    ctx.globalAlpha = 1;

    // partículas
    for (i = 0; i < S.particles.length; i++) {
      var pt = S.particles[i];
      ctx.globalAlpha = Math.min(1, pt.life * 3);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // fantasma de colocación
    if (S.placing && S.hover) {
      var gs = isBldgKey(S.placing) ? SP.buildings[S.placing] : SP.mechs[S.placing];
      ctx.globalAlpha = 0.6;
      ctx.drawImage(gs, S.hover.c * TILE, S.hover.r * TILE + TILE - 2 - gs.height * 2,
        32, gs.height * 2);
      ctx.globalAlpha = 1;
    }

    // textos flotantes
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    for (i = 0; i < S.floaters.length; i++) {
      var f = S.floaters[i];
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = '#12100e';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // barra de vida del jefe
    if (bossAlive) {
      var bwid = 300;
      ctx.fillStyle = 'rgba(10,10,14,.75)';
      ctx.fillRect(W / 2 - bwid / 2 - 4, 6, bwid + 8, 18);
      ctx.fillStyle = '#2e1442';
      ctx.fillRect(W / 2 - bwid / 2, 10, bwid, 8);
      ctx.fillStyle = '#c65fd1';
      ctx.fillRect(W / 2 - bwid / 2, 10, bwid * Math.max(0, bossAlive.hp / bossAlive.maxHp), 8);
      ctx.fillStyle = '#e8e0cc';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('NODRIZA', W / 2, 33);
    }

    // aviso del disruptor durante la fase de construcción
    if (S.phase === 'build' && S.wave < D.WAVES.length) {
      var secs = Math.max(0, Math.ceil(S.buildT));
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = secs <= 5 ? '#e05545' : 'rgba(232,224,204,.85)';
      ctx.fillText('DISRUPTOR ACTIVO — el portal se abre en ' + secs +
        's · [Espacio] lo desactiva ya', W / 2, H - 10);
    }
    ctx.textAlign = 'left';

    // flash de daño
    if (S.hurtFlash > 0) {
      ctx.globalAlpha = S.hurtFlash * 0.9;
      ctx.fillStyle = '#c93b3b';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // pausa
    if (S.paused && S.phase !== 'menu') {
      ctx.fillStyle = 'rgba(8,10,14,.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f2d94e';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSA', W / 2, H / 2);
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }

  // ---------- UI DOM ----------
  function updateUI() {
    el.money.textContent = S.money;
    el.lives.textContent = S.lives;
    el.wave.textContent = S.wave + '/' + D.WAVES.length;
    el.energy.textContent = S.energyUsed + '/' + S.energyCap;
    el.parts.textContent = S.parts;
    el.startBtn.disabled = S.phase !== 'build';
    if (S.phase === 'build' && S.wave < D.WAVES.length) {
      el.startBtn.innerHTML = '&#9654; DESACTIVAR DISRUPTOR (' +
        Math.max(0, Math.ceil(S.buildT)) + 's) [Espacio]';
    } else if (S.phase === 'wave') {
      el.startBtn.innerHTML = 'OLEADA EN CURSO...';
    }
    el.pauseBtn.innerHTML = S.paused ? '&#9654; SEGUIR [P]' : '&#10074;&#10074; PAUSA [P]';

    D.TOWER_ORDER.forEach(function (key) {
      var def = D.TOWERS[key], b = towerBtnEls[key];
      b.classList.toggle('sel', S.placing === key);
      b.classList.toggle('poor', S.money < def.cost || !shopAlive() ||
        S.energyUsed + def.energy > S.energyCap);
    });
    D.BUILDING_ORDER.forEach(function (key) {
      var b = towerBtnEls[key];
      b.classList.toggle('sel', S.placing === key);
      b.classList.toggle('poor', S.money < D.BUILDINGS[key].cost);
    });

    if (S.selectedB) {
      var bl = S.selectedB, bdef = D.BUILDINGS[bl.type];
      var intact = bl.hp >= bl.maxHp;
      el.info.innerHTML =
        '<span class="name">' + bdef.name + '</span> — vida <b>' + Math.max(0, Math.ceil(bl.hp)) +
        '/' + bl.maxHp + '</b>' +
        (bdef.energy ? '<br>Energía: <b>+' + bdef.energy + ' ⚡</b>' : '<br>Permite ensamblar y mejorar mechas.') +
        '<br><span class="desc">' + bdef.desc + '</span>';
      el.upBtn.disabled = intact || S.money < repairCost(bl);
      el.upBtn.textContent = intact ? 'INTACTO' : 'REPARAR $' + repairCost(bl);
      el.sellBtn.disabled = false;
      el.sellBtn.textContent = 'VENDER $' + Math.round(bl.invested * D.SELL_FACTOR);
    } else if (S.selected) {
      var t = S.selected, def = D.TOWERS[t.type], st = towerStats(t);
      var maxed = t.level >= D.MAX_LEVEL;
      var uParts = upgradeParts(t);
      el.info.innerHTML =
        '<span class="name">' + def.name + '</span> — nivel ' + t.level + '/' + D.MAX_LEVEL +
        (t.offline ? ' <span style="color:var(--red)">SIN ⚡</span>' : '') +
        '<br>Daño: <b>' + st.dmg + '</b> &middot; Rango: <b>' + st.range + '</b>' +
        '<br>Cadencia: <b>' + st.rof.toFixed(2) + 's</b>' +
        (def.chain ? ' &middot; Saltos: <b>' + st.chain + '</b>' : '') +
        (def.splash ? ' &middot; &Aacute;rea: <b>' + st.splash + '</b>' : '') +
        '<br><span class="desc">' + def.desc + '</span>';
      el.upBtn.disabled = maxed || S.money < upgradeCost(t) || S.parts < uParts || !shopAlive();
      el.upBtn.textContent = maxed ? 'NIVEL MÁX.'
        : 'MEJORAR $' + upgradeCost(t) + ' + ' + uParts + '⚙';
      el.sellBtn.disabled = false;
      el.sellBtn.textContent = 'VENDER $' + Math.round(t.invested * D.SELL_FACTOR);
    } else if (S.placing && isBldgKey(S.placing)) {
      var pbdef = D.BUILDINGS[S.placing];
      el.info.innerHTML =
        '<span class="name">' + pbdef.name + '</span> — $' + pbdef.cost +
        '<br>Vida: <b>' + pbdef.hp + '</b>' +
        (pbdef.energy ? ' &middot; Energía: <b>+' + pbdef.energy + ' ⚡</b>' : '') +
        '<br><span class="desc">' + pbdef.desc + ' Col&oacute;calo en un tile iluminado.</span>';
      el.upBtn.disabled = true; el.upBtn.textContent = 'MEJORAR';
      el.sellBtn.disabled = true; el.sellBtn.textContent = 'VENDER';
    } else if (S.placing) {
      var pdef = D.TOWERS[S.placing];
      el.info.innerHTML =
        '<span class="name">' + pdef.name + '</span> — $' + pdef.cost +
        '<br>Daño: <b>' + pdef.dmg + '</b> &middot; Rango: <b>' + pdef.range +
        '</b> &middot; Consumo: <b>' + pdef.energy + ' ⚡</b>' +
        '<br><span class="desc">' + pdef.desc + ' Haz clic en el pasto para colocar.</span>';
      el.upBtn.disabled = true; el.upBtn.textContent = 'MEJORAR';
      el.sellBtn.disabled = true; el.sellBtn.textContent = 'VENDER';
    } else {
      el.info.innerHTML = '<span class="desc">Mechas [1-4] y edificios [5-6]. ' +
        'Los generadores dan energ&iacute;a ⚡ y el taller permite ensamblar; ' +
        'def&iacute;endelos: los bichos los muerden al pasar. ' +
        'Los bichos duros sueltan partes ⚙ para mejorar.</span>';
      el.upBtn.disabled = true; el.upBtn.textContent = 'MEJORAR';
      el.sellBtn.disabled = true; el.sellBtn.textContent = 'VENDER';
    }
  }

  // ---------- input ----------
  function canvasPos(ev) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) * (canvas.width / rect.width),
      y: (ev.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  canvas.addEventListener('mousemove', function (ev) {
    var p = canvasPos(ev);
    S.hover = { c: (p.x / TILE) | 0, r: (p.y / TILE) | 0 };
  });
  canvas.addEventListener('mouseleave', function () { S.hover = null; });

  canvas.addEventListener('click', function (ev) {
    if (S.phase !== 'build' && S.phase !== 'wave') return;
    var p = canvasPos(ev);
    var c = (p.x / TILE) | 0, r = (p.y / TILE) | 0;
    if (S.placing) { tryBuild(c, r); return; }
    var t = towerAt(c, r);
    var b = t ? null : buildingAt(c, r);
    S.selected = t || null;
    S.selectedB = b || null;
    if (t || b) AU.click();
  });

  canvas.addEventListener('contextmenu', function (ev) {
    ev.preventDefault();
    cancelActions();
  });

  document.addEventListener('keydown', function (ev) {
    if (S.phase === 'menu') return;
    var k = ev.key;
    if (k === ' ') { ev.preventDefault(); startWave(true); }
    else if (k === 'Escape') cancelActions();
    else if (k === 'p' || k === 'P') S.paused = !S.paused;
    else if (k >= '1' && k <= '4') startPlacing(D.TOWER_ORDER[+k - 1]);
    else if (k === '5' || k === '6') startPlacing(D.BUILDING_ORDER[+k - 5]);
  });

  el.upBtn.addEventListener('click', function () {
    if (S.selectedB) repairSelectedB(); else upgradeSelected();
  });
  el.sellBtn.addEventListener('click', function () {
    if (S.selectedB) sellSelectedB(); else sellSelected();
  });
  el.startBtn.addEventListener('click', function () { startWave(true); });
  el.pauseBtn.addEventListener('click', function () {
    S.paused = !S.paused;
    AU.click();
  });
  el.speedBtn.addEventListener('click', function () {
    S.speed = S.speed === 1 ? 2 : 1;
    el.speedBtn.innerHTML = '&times;' + S.speed;
    AU.click();
  });
  el.muteBtn.addEventListener('click', function () {
    var m = AU.toggleMute();
    el.muteBtn.innerHTML = m ? '&#9834; SILENCIO' : '&#9835; SONIDO';
  });
  el.playBtn.addEventListener('click', function () {
    AU.unlock();
    S.phase = 'build';
    el.title.classList.add('hidden');
    AU.horn();
  });
  el.restartBtn.addEventListener('click', function () {
    resetState();
    S.phase = 'build';
    el.endScreen.classList.add('hidden');
    AU.click();
  });

  // ---------- bucle principal ----------
  window.GAME = S; // estado expuesto para depuración

  var last = performance.now();
  function frame(now) {
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!S.paused && (S.phase === 'build' || S.phase === 'wave')) {
      for (var i = 0; i < S.speed; i++) update(dt);
    }
    render();
    updateUI();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
