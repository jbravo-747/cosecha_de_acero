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
  // hp: vida del mecha · ammo: cargador base (crece con nivel) · move: tiles
  // de desplazamiento por orden (como en ajedrez, distancia Chebyshev)
  var TOWERS = {
    mg: {
      name: 'COYOTE', cost: 100, range: 105, dmg: 8, rof: 0.16, energy: 1,
      hp: 160, ammo: 200, move: 2,
      proj: 'bullet', projSpeed: 380,
      desc: 'Ametralladora ligera. Rápida y barata: ideal contra enjambres de drones.'
    },
    tesla: {
      name: 'CERCA-9', cost: 150, range: 90, dmg: 15, rof: 0.85, energy: 1,
      hp: 180, ammo: 70, move: 1,
      proj: 'chain', chain: 3, slow: 0.5, slowDur: 1.4,
      desc: 'Pilón eléctrico de la cerca. La descarga salta entre bichos y los frena. Dos pilones flanqueando el camino crean un campo de fuerza que bloquea a los terrestres.'
    },
    cannon: {
      name: 'BISONTE', cost: 180, range: 125, dmg: 42, rof: 1.5, energy: 2,
      hp: 200, ammo: 45, move: 1,
      proj: 'shell', projSpeed: 240, splash: 42,
      desc: 'Cañón de asedio. Lento pero revienta grupos con daño en área.'
    },
    sniper: {
      name: 'VIUDA', cost: 260, range: 215, dmg: 95, rof: 2.3, energy: 2,
      hp: 130, ammo: 22, move: 3,
      proj: 'beam', airBonus: 1.5,
      desc: 'Rifle de larga distancia. Un tiro, un bicho grande menos. Daño ×1.5 contra voladores.'
    },
    axe: {
      name: 'LEÑADOR', cost: 140, range: 38, dmg: 34, rof: 1.0, energy: 1,
      hp: 260, ammo: 0, move: 2,
      proj: 'axe',
      desc: 'Mecha leñador: su hacha barre a todos los bichos al alcance. Cuerpo a cuerpo puro, no gasta munición y aguanta como un tractor.'
    }
  };
  var TOWER_ORDER = ['mg', 'tesla', 'cannon', 'sniper', 'axe'];

  // golpe cuerpo a cuerpo de emergencia: todos los mechas lo tienen y
  // no gasta munición
  var MELEE = { range: 26, cd: 1.0, dmg: 12, perLvl: 8 };
  var MAX_LEVEL = 3;
  // mejora: nivel 2 y 3
  var UP_COST_FACTOR = 0.75;   // costo mejora = base * factor * nivelActual
  var UP_DMG = 1.4, UP_RANGE = 14, UP_ROF = 0.87;
  var SELL_FACTOR = 0.7;

  // ---------- enemigos ----------
  // bDmg: daño por mordisco a mechas/unidades/edificios · drop: partes al morir
  // behaviors: comportamientos componibles definidos en behaviors.js
  // flying: vuela recto del agujero al granero, sin seguir el camino
  // spit: ataque a distancia contra la defensa
  var ENEMIES = {
    drone:   { name: 'Dron',       hp: 30,   speed: 55, bounty: 8,   dmg: 1,  armor: 0, size: 7,  sprite: 'drone',   bDmg: 3,
               behaviors: ['biter'] },
    wasp:    { name: 'Avispa',     hp: 24,   speed: 98, bounty: 10,  dmg: 1,  armor: 0, size: 6,  sprite: 'wasp',    bDmg: 2,
               flying: true, behaviors: ['biter'] },
    spitter: { name: 'Escupidor',  hp: 78,   speed: 44, bounty: 15,  dmg: 2,  armor: 0, size: 8,  sprite: 'spitter', bDmg: 6,
               behaviors: ['biter', 'spit'],
               spit: { range: 95, cd: 2.2, dmg: 8, speed: 150 },
               drop: { chance: 0.3, n: 1 } },
    scarab:  { name: 'Escarabajo', hp: 300,  speed: 27, bounty: 34,  dmg: 3,  armor: 6, size: 9,  sprite: 'scarab',  bDmg: 12,
               behaviors: ['biter'], drop: { chance: 1, n: 1 } },
    // carga contra la defensa y se inmola; también estalla si lo matan.
    // Su onda daña a tus unidades y puede iniciar explosiones en cadena.
    kamikaze:{ name: 'Detonador',  hp: 55,   speed: 70, bounty: 18,  dmg: 2,  armor: 0, size: 8,  sprite: 'kamikaze', bDmg: 0,
               behaviors: ['kamikaze'],
               boom: { r: 55, dmg: 70, detect: 110, fuse: 14 },
               drop: { chance: 0.25, n: 1 } },
    boss:    { name: 'NODRIZA',    hp: 3400, speed: 15, bounty: 500, dmg: 20, armor: 8, size: 14, sprite: 'boss',    bDmg: 30,
               behaviors: ['biter', 'spawner', 'spit'],
               spit: { range: 115, cd: 2.8, dmg: 14, speed: 150 },
               spawnEvery: 4.5, spawnType: 'drone', spawnCount: 2,
               drop: { chance: 1, n: 10 } }
  };

  // variantes de élite: bichos más resistentes que aparecen (y abundan)
  // conforme sube la oleada
  var ELITE = {
    fromWave: 4,       // primera oleada con élites
    chance: 0.06,      // probabilidad extra por oleada desde fromWave
    chanceMax: 0.5,
    hpMul: 2.2, bountyMul: 2,
    dropChance: 0.5    // las élites sueltan partes con esta probabilidad
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
             { t: 'spitter', n: 6,  gap: 1.4, delay: 6 },
             { t: 'kamikaze', n: 2, gap: 2.5, delay: 9 }],
    /* 6 */ [{ t: 'scarab', n: 2,  gap: 4.0, delay: 0 },
             { t: 'drone',  n: 14, gap: 0.6, delay: 2 }],
    /* 7 */ [{ t: 'scarab',  n: 4,  gap: 3.0, delay: 0 },
             { t: 'spitter', n: 10, gap: 1.0, delay: 3 },
             { t: 'kamikaze', n: 3, gap: 2.0, delay: 7 }],
    /* 8 */ [{ t: 'drone', n: 22, gap: 0.45, delay: 0 },
             { t: 'wasp',  n: 8,  gap: 0.8,  delay: 6 },
             { t: 'scarab', n: 2, gap: 5.0,  delay: 8 },
             { t: 'kamikaze', n: 3, gap: 2.2, delay: 11 }],
    /* 9 */ [{ t: 'scarab',  n: 6,  gap: 2.6, delay: 0 },
             { t: 'wasp',    n: 12, gap: 0.55, delay: 4 },
             { t: 'spitter', n: 10, gap: 1.0, delay: 8 },
             { t: 'kamikaze', n: 5, gap: 1.6, delay: 12 }],
    /*10 */ [{ t: 'boss',    n: 1,  gap: 0,   delay: 2 },
             { t: 'drone',   n: 12, gap: 1.1, delay: 6 },
             { t: 'wasp',    n: 8,  gap: 1.3, delay: 12 },
             { t: 'scarab',  n: 3,  gap: 6.0, delay: 16 },
             { t: 'kamikaze', n: 4, gap: 3.0, delay: 20 }]
  ];

  function waveBonus(wave) { return 60 + 15 * wave; }

  // ---------- edificios de apoyo ----------
  var BUILDINGS = {
    gen:  { name: 'GENERADOR', cost: 120, hp: 180, energy: 4, powerRange: 110,
            desc: 'Generador diésel: alimenta con 4 ⚡ a los mechas dentro de su radio.' },
    shop: { name: 'TALLER', cost: 200, hp: 220, energy: 0,
            desc: 'Taller de ensamblado. Sin al menos uno en pie no se construyen ni mejoran mechas. Cada taller extra abarata las mejoras un 12% (máx. 36%) y todo taller produce $2 cada 6 s.' }
  };
  var SHOP_DISCOUNT = 0.12;      // descuento de mejora por taller extra
  var SHOP_DISCOUNT_MAX = 0.36;  // tope del descuento
  var SHOP_INCOME = { every: 6, amount: 2 };  // ingreso pasivo de cada taller

  // el granero se refuerza: cada nivel da vidas extra y monta una torreta
  // en el techo (la del nivel 3 es más potente que la del 2)
  var BARN_UP = {
    maxLevel: 3,
    mounts: [{ x: 590, y: 138 }, { x: 622, y: 138 }],
    levels: [   // refuerzo a nivel 2 y 3
      { cost: 300, parts: 2, lives: 5,
        turret: { range: 120, dmg: 10, rof: 0.45, projSpeed: 340 } },
      { cost: 500, parts: 3, lives: 8,
        turret: { range: 145, dmg: 16, rof: 0.4, projSpeed: 360 } }
    ]
  };

  // campo de fuerza: dos CERCA-9 flanqueando una celda del camino
  var FIELD = {
    hpPerLvl: 80,   // vida = 80 × (nivel pilón A + nivel pilón B)
    regen: 12,      // seg para reformarse tras romperse
    block: 15       // px del centro a los que se detienen los terrestres
  };
  var BUILDING_ORDER = ['gen', 'shop'];
  var START_BUILDINGS = [{ type: 'gen', c: 16, r: 10 }, { type: 'shop', c: 16, r: 4 }];

  // ---------- unidades de apoyo ----------
  var UNITS = {
    carrier: { name: 'CARGADOR', cost: 90, hp: 60, speed: 46, flying: false,
               desc: 'Peón mecánico: lleva munición del granero a los mechas y los repara en el campo. Los mechas lo cubren si está en su rango.' },
    drone:   { name: 'DRON', cost: 140, hp: 70, speed: 72, flying: true,
               ammo: 50, atkRange: 75, atkDmg: 5, atkRof: 0.35,
               desc: 'Dron de apoyo: alterna entre RECARGAR mechas y ATACAR bichos. Vuela sobre cualquier tile, incluido el camino.' }
  };
  var UNIT_ORDER = ['carrier', 'drone'];
  var START_UNITS = ['drone'];          // la partida empieza con un dron
  var BARN_POS = { x: 600, y: 160 };    // puerta del granero (base logística)

  var BUILD_TIME = 30;      // seg de disruptor entre oleadas
  var EARLY_BONUS = 2;      // $ por segundo restante al desactivar el disruptor antes
  var ATTACK_RANGE = 48;    // px a los que un bicho muerde a la defensa al pasar
  var ATTACK_CD = 1.1;      // seg entre mordiscos
  var REPAIR_PER_HP = 0.5;  // $ por punto de vida reparado
  var UP_PARTS = [1, 2];    // partes ⚙ para subir a nivel 2 y 3
  var MOVE_CD = 4;          // seg de enfriamiento tras mover un mecha
  var RELOAD_TIME = 0.8;    // seg que tarda una unidad en dar servicio a un mecha
  var AMMO_LOW = 0.6;       // umbral de munición (fracción) para pedir servicio
  var HP_LOW = 0.7;         // umbral de vida (fracción) para pedir reparación

  // mejora del taller: torreta ligera montada en el techo
  var SHOP_TURRET = { cost: 150, parts: 1, range: 95, dmg: 7, rof: 0.5, projSpeed: 340 };

  // especial: bombardeo que arrasa un área (ignora blindaje, solo bichos)
  var BOMB = { cost: 250, parts: 2, radius: 70, dmg: 260, cd: 45, delay: 0.8 };

  var DRONE_GIFT = 90;      // seg entre drones de apoyo gratis
  var DRONE_CAP = 4;        // máximo de drones activos para recibir regalos

  // autodestrucción: radio y daño de la onda por tipo de entidad.
  // La onda daña bichos Y aliados; los aliados destruidos por ella
  // detonan también (explosión en cadena).
  var SELF_DESTRUCT = {
    tower:   { r: 62, base: 150, perLvl: 40 },
    gen:     { r: 70, dmg: 180 },
    shop:    { r: 70, dmg: 160 },
    carrier: { r: 46, dmg: 90 },
    drone:   { r: 46, dmg: 100 },
    chainDelay: 0.18   // seg entre eslabones de la cadena
  };

  window.DATA = {
    COLS: COLS, ROWS: ROWS, TILE: TILE,
    PATH: PATH, BARN_TILES: BARN_TILES,
    ROCKS: ROCKS, CROPS: CROPS, FENCES: FENCES,
    TOWERS: TOWERS, TOWER_ORDER: TOWER_ORDER,
    MAX_LEVEL: MAX_LEVEL, UP_COST_FACTOR: UP_COST_FACTOR,
    UP_DMG: UP_DMG, UP_RANGE: UP_RANGE, UP_ROF: UP_ROF, SELL_FACTOR: SELL_FACTOR,
    ENEMIES: ENEMIES, hpScale: hpScale, ELITE: ELITE,
    WAVES: WAVES, waveBonus: waveBonus,
    BUILDINGS: BUILDINGS, BUILDING_ORDER: BUILDING_ORDER, START_BUILDINGS: START_BUILDINGS,
    UNITS: UNITS, UNIT_ORDER: UNIT_ORDER, START_UNITS: START_UNITS, BARN_POS: BARN_POS,
    BUILD_TIME: BUILD_TIME, EARLY_BONUS: EARLY_BONUS,
    ATTACK_RANGE: ATTACK_RANGE, ATTACK_CD: ATTACK_CD,
    REPAIR_PER_HP: REPAIR_PER_HP, UP_PARTS: UP_PARTS,
    MOVE_CD: MOVE_CD, RELOAD_TIME: RELOAD_TIME, AMMO_LOW: AMMO_LOW, HP_LOW: HP_LOW,
    SHOP_TURRET: SHOP_TURRET, BOMB: BOMB, DRONE_GIFT: DRONE_GIFT,
    SHOP_DISCOUNT: SHOP_DISCOUNT, SHOP_DISCOUNT_MAX: SHOP_DISCOUNT_MAX,
    SHOP_INCOME: SHOP_INCOME, BARN_UP: BARN_UP,
    FIELD: FIELD, MELEE: MELEE,
    DRONE_CAP: DRONE_CAP, SELF_DESTRUCT: SELF_DESTRUCT,
    START_MONEY: 320, START_LIVES: 20
  };
})();
