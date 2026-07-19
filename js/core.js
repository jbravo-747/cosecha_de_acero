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
  // ruta directa de los voladores: del agujero al granero, sin seguir el camino
  G.flyPath = [wpPix[0], { x: D.BARN_POS.x, y: D.BARN_POS.y + 16 }];

  // ---------- estado ----------
  var S = {};
  G.S = S;
  window.GAME = S; // estado expuesto para depuración y pruebas

  function makeBuilding(type, c, r) {
    var def = D.BUILDINGS[type];
    return {
      kind: 'bldg', type: type, c: c, r: r,
      x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
      hp: def.hp, maxHp: def.hp, invested: def.cost, flash: 0, sy: 1
    };
  }

  function makeUnit(type, free) {
    var def = D.UNITS[type];
    return {
      kind: 'unit', type: type,
      x: D.BARN_POS.x + (Math.random() * 12 - 6),
      y: D.BARN_POS.y + (Math.random() * 12 - 6),
      hp: def.hp, maxHp: def.hp,
      invested: free ? 0 : def.cost,
      mode: 'reload',            // dron: reload | attack
      state: 'idle',             // idle | go | load | back | restock
      target: null, post: null,
      ammo: def.ammo || 0, cd: 0, t: 0,
      animT: Math.random(), flash: 0, sy: 1
    };
  }

  function resetState() {
    S.phase = 'menu';          // menu | build | wave | won | lost
    S.diff = S.diff || 'aprendiz';   // la dificultad elegida sobrevive al reinicio
    S.endless = false;         // asedio sin fin activado tras la victoria
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
    S.units = D.START_UNITS.map(function (t) { return makeUnit(t, true); });
    S.projectiles = [];
    S.eShots = [];             // proyectiles enemigos (escupitajos)
    S.effects = [];            // rayos, trazadoras, anillos, cadáveres
    S.tweens = [];             // animaciones en curso (anim.js)
    S.particles = [];
    S.floaters = [];
    S.decals = [];
    S.spawnQueue = [];
    S.waveT = 0;
    S.buildT = D.BUILD_TIME;   // cuenta atrás del disruptor de portales
    S.giftT = D.DRONE_GIFT;    // cuenta atrás del dron de apoyo gratis
    S.bombCd = 0;              // enfriamiento del bombardeo
    S.bombs = [];              // bombardeos en caída
    S.chainQ = [];             // detonaciones en cadena pendientes
    S.confirmBoom = 0;         // temporizador de confirmación de autodestrucción
    S.fields = [];             // campos de fuerza entre pares de CERCA-9
    S.mines = [];              // minas enterradas en el camino
    S.aimingBomb = false;      // apuntando el especial
    S.hoverPx = null;          // posición exacta del ratón en el canvas
    S.placing = null;          // tipo de torre/edificio en colocación
    S.selected = null;         // torre seleccionada
    S.selectedB = null;        // edificio seleccionado
    S.selectedU = null;        // unidad seleccionada
    S.selectedBarn = false;    // granero seleccionado
    S.barnLevel = 1;           // nivel del granero
    S.barnGuns = [];           // torretas montadas en el techo del granero
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

  // La energía es espacial: cada generador alimenta hasta 4 ⚡ de mechas
  // dentro de su radio powerRange. Un mecha lejos de todo generador (o cuya
  // capacidad cercana esté agotada) queda sin energía y no dispara.
  function recomputePower() {
    var cap = 0, used = 0, i, j;
    var gens = [];
    for (i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      var e = D.BUILDINGS[b.type].energy;
      cap += e;
      if (e > 0) gens.push({ b: b, free: e });
    }
    for (i = 0; i < S.towers.length; i++) {
      var t = S.towers[i], need = D.TOWERS[t.type].energy;
      used += need;
      t.offline = true;
      for (j = 0; j < gens.length; j++) {
        var g = gens[j];
        var r = D.BUILDINGS.gen.powerRange;
        if (g.free >= need && dist2(t.x, t.y, g.b.x, g.b.y) <= r * r) {
          g.free -= need;
          t.offline = false;
          break;
        }
      }
    }
    S.energyCap = cap;
    S.energyUsed = used;
    recomputeFields();
  }

  // Dos CERCA-9 encendidas flanqueando una celda del camino (vertical u
  // horizontal) generan un campo de fuerza que bloquea a los terrestres.
  function recomputeFields() {
    var old = {}, seen = {}, i, j;
    for (i = 0; i < S.fields.length; i++) {
      old[S.fields[i].c + ',' + S.fields[i].r] = S.fields[i];
    }
    S.fields = [];
    var py = [];
    for (i = 0; i < S.towers.length; i++) {
      var t = S.towers[i];
      if (t.type === 'tesla' && !t.moving && !t.offline) py.push(t);
    }
    for (i = 0; i < py.length; i++) {
      for (j = i + 1; j < py.length; j++) {
        var a = py[i], b = py[j], c = -1, r = -1;
        if (a.c === b.c && Math.abs(a.r - b.r) === 2) { c = a.c; r = (a.r + b.r) / 2; }
        else if (a.r === b.r && Math.abs(a.c - b.c) === 2) { c = (a.c + b.c) / 2; r = a.r; }
        if (c < 0 || !pathCells[c + ',' + r] || seen[c + ',' + r]) continue;
        seen[c + ',' + r] = true;
        var maxHp = D.FIELD.hpPerLvl * (a.level + b.level);
        var f = {
          kind: 'field', c: c, r: r,
          x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
          ax: a.x, ay: a.y - 14, bx: b.x, by: b.y - 14,
          hp: maxHp, maxHp: maxHp, downT: 0, flash: 0
        };
        var prev = old[c + ',' + r];
        if (prev) {
          f.hp = Math.min(prev.hp, maxHp);
          f.downT = prev.downT;
          if (f.downT > 0) f.hp = 0;
        }
        S.fields.push(f);
      }
    }
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

  // las minas van justo donde nada más puede ir: sobre el camino
  function mineAt(c, r) {
    for (var i = 0; i < S.mines.length; i++) {
      if (S.mines[i].c === c && S.mines[i].r === r) return S.mines[i];
    }
    return null;
  }
  function canPlaceMine(c, r) {
    return !!pathCells[c + ',' + r] && !mineAt(c, r) &&
      S.money >= D.MINE.cost && S.mines.length < D.MINE.max;
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
      splash: (def.splash || 0) + 8 * lvl,
      maxAmmo: def.ammo * t.level,
      maxHp: Math.round(def.hp * Math.pow(1.25, lvl))
    };
  }

  // distancia de ajedrez entre tiles (movimiento de los mechas)
  function chebyshev(c1, r1, c2, r2) {
    return Math.max(Math.abs(c1 - c2), Math.abs(r1 - r2));
  }

  // todo lo que los bichos pueden atacar: edificios, mechas, unidades y
  // los campos de fuerza activos
  function defenseTargets() {
    var arr = S.buildings.concat(S.towers, S.units);
    for (var i = 0; i < S.fields.length; i++) {
      if (S.fields[i].hp > 0) arr.push(S.fields[i]);
    }
    return arr;
  }

  // unidad a menos de `rad` px de un punto (para seleccionarlas con clic)
  function unitNear(x, y, rad) {
    var best = null, bd = rad * rad;
    for (var i = 0; i < S.units.length; i++) {
      var d2 = dist2(x, y, S.units[i].x, S.units[i].y);
      if (d2 <= bd) { bd = d2; best = S.units[i]; }
    }
    return best;
  }

  function shopCount() {
    var n = 0;
    for (var i = 0; i < S.buildings.length; i++) {
      if (S.buildings[i].type === 'shop') n++;
    }
    return n;
  }

  // cada taller extra abarata las mejoras (economía de escala)
  function upgradeDiscount() {
    return Math.min(D.SHOP_DISCOUNT_MAX, Math.max(0, shopCount() - 1) * D.SHOP_DISCOUNT);
  }

  function upgradeCost(t) {
    return Math.round(D.TOWERS[t.type].cost * D.UP_COST_FACTOR * t.level *
      (1 - upgradeDiscount()));
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
  G.makeUnit = makeUnit;
  G.chebyshev = chebyshev;
  G.defenseTargets = defenseTargets;
  G.unitNear = unitNear;
  G.resetState = resetState;
  G.shopAlive = shopAlive;
  G.recomputePower = recomputePower;
  G.recomputeFields = recomputeFields;
  G.dist2 = dist2;
  G.towerAt = towerAt;
  G.buildingAt = buildingAt;
  G.canBuild = canBuild;
  G.mineAt = mineAt;
  G.canPlaceMine = canPlaceMine;
  G.nearPath = nearPath;
  G.isBldgKey = isBldgKey;
  G.towerStats = towerStats;
  G.shopCount = shopCount;
  G.upgradeDiscount = upgradeDiscount;
  G.upgradeCost = upgradeCost;
  G.upgradeParts = upgradeParts;
  G.repairCost = repairCost;
  G.floater = floater;
  G.burst = burst;

  resetState();
})();
