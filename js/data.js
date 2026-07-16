/* ==========================================================================
   COSECHA DE ACERO — data.js
   Balance: torres, enemigos, oleadas, mapa.
   ========================================================================== */
(function () {
  'use strict';

  // rejilla 20x12, tiles de 32px en canvas 640x384
  var COLS = 20, ROWS = 12, TILE = 32;

  // Camino por waypoints en coordenadas de tile (col, fila).
  // Empieza fuera del mapa (agujero al oeste) y termina en el granero.
  var PATH = [
    [-1, 3], [3, 3], [3, 8], [8, 8], [8, 2], [13, 2], [13, 9], [17, 9], [17, 5], [20, 5]
  ];

  // Tiles ocupados por el granero (no construibles)
  var BARN_TILES = [[18, 4], [19, 4], [18, 5], [19, 5], [18, 6], [19, 6]];

  // Decoración: rocas bloquean, cultivos y cercas no
  var ROCKS = [[6, 5], [11, 6], [15, 3], [5, 10], [10, 0]];
  var CROPS = [[0, 0], [1, 0], [0, 1], [1, 1], [18, 0], [19, 0], [18, 1], [19, 1],
               [0, 10], [1, 10], [0, 11], [1, 11], [10, 11], [11, 11]];
  var FENCES = [[16, 0], [17, 0], [16, 11], [17, 11]];

  // ---------- torres (mechas) ----------
  var TOWERS = {
    mg: {
      name: 'COYOTE', cost: 100, range: 105, dmg: 8, rof: 0.16, energy: 1,
      proj: 'bullet', projSpeed: 380,
      desc: 'Ametralladora ligera. Rápida y barata: ideal contra enjambres de drones.'
    },
    tesla: {
      name: 'CERCA-9', cost: 150, range: 90, dmg: 15, rof: 0.85, energy: 1,
      proj: 'chain', chain: 3, slow: 0.5, slowDur: 1.4,
      desc: 'Pilón eléctrico de la cerca. La descarga salta entre bichos y los frena.'
    },
    cannon: {
      name: 'BISONTE', cost: 180, range: 125, dmg: 42, rof: 1.5, energy: 2,
      proj: 'shell', projSpeed: 240, splash: 42,
      desc: 'Cañón de asedio. Lento pero revienta grupos con daño en área.'
    },
    sniper: {
      name: 'VIUDA', cost: 260, range: 215, dmg: 95, rof: 2.3, energy: 2,
      proj: 'beam',
      desc: 'Rifle de larga distancia. Un tiro, un bicho grande menos.'
    }
  };
  var TOWER_ORDER = ['mg', 'tesla', 'cannon', 'sniper'];
  var MAX_LEVEL = 3;
  // mejora: nivel 2 y 3
  var UP_COST_FACTOR = 0.75;   // costo mejora = base * factor * nivelActual
  var UP_DMG = 1.4, UP_RANGE = 14, UP_ROF = 0.87;
  var SELL_FACTOR = 0.7;

  // ---------- enemigos ----------
  // bDmg: daño por mordisco a edificios · drop: partes que suelta al morir
  var ENEMIES = {
    drone:   { name: 'Dron',       hp: 30,   speed: 55, bounty: 8,   dmg: 1,  armor: 0, size: 7,  sprite: 'drone',   bDmg: 3 },
    wasp:    { name: 'Avispa',     hp: 24,   speed: 98, bounty: 10,  dmg: 1,  armor: 0, size: 6,  sprite: 'wasp',    bDmg: 2 },
    spitter: { name: 'Escupidor',  hp: 78,   speed: 44, bounty: 15,  dmg: 2,  armor: 0, size: 8,  sprite: 'spitter', bDmg: 6,
               drop: { chance: 0.3, n: 1 } },
    scarab:  { name: 'Escarabajo', hp: 300,  speed: 27, bounty: 34,  dmg: 3,  armor: 6, size: 9,  sprite: 'scarab',  bDmg: 12,
               drop: { chance: 1, n: 1 } },
    boss:    { name: 'NODRIZA',    hp: 3400, speed: 15, bounty: 500, dmg: 20, armor: 8, size: 14, sprite: 'boss',    bDmg: 30,
               spawnEvery: 4.5, spawnType: 'drone', spawnCount: 2,
               drop: { chance: 1, n: 10 } }
  };

  // escala de vida por oleada
  function hpScale(wave) { return 1 + 0.12 * (wave - 1); }

  // ---------- oleadas ----------
  // cada grupo: t = tipo, n = cantidad, gap = seg entre bichos, delay = seg desde inicio de oleada
  var WAVES = [
    /* 1 */ [{ t: 'drone', n: 8,  gap: 1.1, delay: 0 }],
    /* 2 */ [{ t: 'drone', n: 12, gap: 0.9, delay: 0 }],
    /* 3 */ [{ t: 'drone', n: 10, gap: 0.9, delay: 0 },
             { t: 'wasp',  n: 5,  gap: 1.2, delay: 5 }],
    /* 4 */ [{ t: 'spitter', n: 7, gap: 1.5, delay: 0 },
             { t: 'drone',   n: 8, gap: 0.7, delay: 4 }],
    /* 5 */ [{ t: 'wasp',    n: 12, gap: 0.6, delay: 0 },
             { t: 'spitter', n: 6,  gap: 1.4, delay: 6 }],
    /* 6 */ [{ t: 'scarab', n: 2,  gap: 4.0, delay: 0 },
             { t: 'drone',  n: 14, gap: 0.6, delay: 2 }],
    /* 7 */ [{ t: 'scarab',  n: 4,  gap: 3.0, delay: 0 },
             { t: 'spitter', n: 10, gap: 1.0, delay: 3 }],
    /* 8 */ [{ t: 'drone', n: 22, gap: 0.45, delay: 0 },
             { t: 'wasp',  n: 8,  gap: 0.8,  delay: 6 },
             { t: 'scarab', n: 2, gap: 5.0,  delay: 8 }],
    /* 9 */ [{ t: 'scarab',  n: 6,  gap: 2.6, delay: 0 },
             { t: 'wasp',    n: 12, gap: 0.55, delay: 4 },
             { t: 'spitter', n: 10, gap: 1.0, delay: 8 }],
    /*10 */ [{ t: 'boss',    n: 1,  gap: 0,   delay: 2 },
             { t: 'drone',   n: 12, gap: 1.1, delay: 6 },
             { t: 'wasp',    n: 8,  gap: 1.3, delay: 12 },
             { t: 'scarab',  n: 3,  gap: 6.0, delay: 16 }]
  ];

  function waveBonus(wave) { return 60 + 15 * wave; }

  // ---------- edificios de apoyo ----------
  // Deben colocarse junto al camino (por eso los bichos pueden morderlos).
  var BUILDINGS = {
    gen:  { name: 'GENERADOR', cost: 120, hp: 180, energy: 4,
            desc: 'Generador diésel: da 4 de energía para alimentar mechas. Debe ir junto al camino.' },
    shop: { name: 'TALLER', cost: 200, hp: 220, energy: 0,
            desc: 'Taller de ensamblado. Sin al menos uno en pie no se construyen ni mejoran mechas.' }
  };
  var BUILDING_ORDER = ['gen', 'shop'];
  var START_BUILDINGS = [{ type: 'gen', c: 16, r: 10 }, { type: 'shop', c: 16, r: 4 }];

  var BUILD_TIME = 30;      // seg de disruptor entre oleadas
  var EARLY_BONUS = 2;      // $ por segundo restante al desactivar el disruptor antes
  var ATTACK_RANGE = 48;    // px a los que un bicho muerde edificios al pasar
  var ATTACK_CD = 1.1;      // seg entre mordiscos
  var REPAIR_PER_HP = 0.5;  // $ por punto de vida reparado
  var UP_PARTS = [1, 2];    // partes ⚙ para subir a nivel 2 y 3

  window.DATA = {
    COLS: COLS, ROWS: ROWS, TILE: TILE,
    PATH: PATH, BARN_TILES: BARN_TILES,
    ROCKS: ROCKS, CROPS: CROPS, FENCES: FENCES,
    TOWERS: TOWERS, TOWER_ORDER: TOWER_ORDER,
    MAX_LEVEL: MAX_LEVEL, UP_COST_FACTOR: UP_COST_FACTOR,
    UP_DMG: UP_DMG, UP_RANGE: UP_RANGE, UP_ROF: UP_ROF, SELL_FACTOR: SELL_FACTOR,
    ENEMIES: ENEMIES, hpScale: hpScale,
    WAVES: WAVES, waveBonus: waveBonus,
    BUILDINGS: BUILDINGS, BUILDING_ORDER: BUILDING_ORDER, START_BUILDINGS: START_BUILDINGS,
    BUILD_TIME: BUILD_TIME, EARLY_BONUS: EARLY_BONUS,
    ATTACK_RANGE: ATTACK_RANGE, ATTACK_CD: ATTACK_CD,
    REPAIR_PER_HP: REPAIR_PER_HP, UP_PARTS: UP_PARTS,
    START_MONEY: 320, START_LIVES: 20
  };
})();
