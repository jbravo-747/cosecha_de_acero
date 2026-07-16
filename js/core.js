/* ==========================================================================
   COSECHA DE ACERO — core.js
   Espacio compartido G: constantes, geometría del camino, estado y helpers.
   Los módulos se cargan como IIFEs en orden (core → behaviors → entities →
   render → ui → main) y se comunican a través de window.G; las referencias
   entre módulos se resuelven en tiempo de llamada, nunca al cargar.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.DATA;
  var TILE = D.TILE, COLS = D.COLS, ROWS = D.ROWS;
  var G = window.G = {};

  G.TILE = TILE;
  G.COLS = COLS;
  G.ROWS = ROWS;
  G.W = COLS * TILE;
  G.H = ROWS * TILE;

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

  G.wpPix = wpPix;
  G.pathCells = pathCells;

  // ---------- estado ----------
  var S = {};
  G.S = S;
  window.GAME = S; // estado expuesto para depuración y pruebas

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

  function isBldgKey(key) { return !!D.BUILDINGS[key]; }

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

  function upgradeParts(t) { return D.UP_PARTS[t.level - 1] || 0; }

  function repairCost(b) { return Math.ceil((b.maxHp - b.hp) * D.REPAIR_PER_HP); }

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

  G.makeBuilding = makeBuilding;
  G.resetState = resetState;
  G.shopAlive = shopAlive;
  G.recomputePower = recomputePower;
  G.dist2 = dist2;
  G.towerAt = towerAt;
  G.buildingAt = buildingAt;
  G.canBuild = canBuild;
  G.nearPath = nearPath;
  G.isBldgKey = isBldgKey;
  G.towerStats = towerStats;
  G.upgradeCost = upgradeCost;
  G.upgradeParts = upgradeParts;
  G.repairCost = repairCost;
  G.floater = floater;
  G.burst = burst;

  resetState();
})();
