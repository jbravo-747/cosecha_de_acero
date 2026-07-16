/* ==========================================================================
   COSECHA DE ACERO — sprites.js
   Paleta y pixel art definido como matrices de caracteres.
   Cada sprite se hornea a un canvas offscreen al cargar.
   ========================================================================== */
(function () {
  'use strict';

  // ---------- paleta ----------
  var PAL = {
    '.': null,
    'k': '#12100e', // contorno
    // mecha / acero
    'b': '#5a7e9e', 'B': '#35506b', 'l': '#8fb0c9',
    'g': '#454c52', 'G': '#2b3238',
    'o': '#e8912a', 'O': '#a85a14', 'y': '#f2d94e',
    // granja
    'r': '#b0402e', 'R': '#7a2a1c', 'w': '#e8e0cc', 'W': '#c2ccd6',
    't': '#8a5a30', 'T': '#5f3a1c', 's': '#c9a86a', 'S': '#9a7a44',
    // alien
    'p': '#7e4696', 'P': '#52276b', 'd': '#2e1442',
    'v': '#9ee34a', 'V': '#5f9926', 'm': '#c65fd1',
    // varios
    'e': '#688a34', 'E': '#4e6a26', 'f': '#e06a9a'
  };

  // ---------- utilidades ----------
  function makeSprite(rows, scale) {
    scale = scale || 1;
    var w = 0, y, x;
    for (y = 0; y < rows.length; y++) w = Math.max(w, rows[y].length);
    var c = document.createElement('canvas');
    c.width = w * scale; c.height = rows.length * scale;
    var g = c.getContext('2d');
    for (y = 0; y < rows.length; y++) {
      for (x = 0; x < rows[y].length; x++) {
        var col = PAL[rows[y][x]];
        if (col) { g.fillStyle = col; g.fillRect(x * scale, y * scale, scale, scale); }
      }
    }
    return c;
  }

  // RNG con semilla (tiles deterministas)
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function makeTile(base, specks, seed) {
    var c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 16, 16);
    var r = rng(seed);
    for (var i = 0; i < 26; i++) {
      var col = specks[(r() * specks.length) | 0];
      g.fillStyle = col;
      g.fillRect((r() * 16) | 0, (r() * 16) | 0, 1 + ((r() * 2) | 0), 1);
    }
    return c;
  }

  // ==========================================================================
  // ENEMIGOS (vista cenital, mirando hacia arriba; se rotan en juego)
  // ==========================================================================

  var DRONE_A = [
    '......k..k......',
    '.....k....k.....',
    '.....dpppd......',
    '....dpvvvpd.....',
    '.k..dpvpvpd..k..',
    '..kkdppppppdkk..',
    '....dpvppvpd....',
    '.kkdpppvvpppdkk.',
    '...dppvvvvppd...',
    '..kkdppppppdkk..',
    '.k..dpvvvvpd..k.',
    '.....dppppd.....',
    '......dppd......',
    '.......dd.......'
  ];
  var DRONE_B = [
    '......k..k......',
    '.....k....k.....',
    '.....dpppd......',
    '....dpvvvpd.....',
    '..k.dpvpvpd.k...',
    '.kkkdppppppdkkk.',
    '....dpvppvpd....',
    '..kdpppvvpppdk..',
    '...dppvvvvppd...',
    '.kkkdppppppdkkk.',
    '..k.dpvvvvpd.k..',
    '.....dppppd.....',
    '......dppd......',
    '.......dd.......'
  ];

  var WASP_A = [
    '.......kk.......',
    '......kvvk......',
    '......dppd......',
    '..WWWdpmmpdWWW..',
    '.WWWWdpppmdWWWW.',
    '..WWdppppppdWW..',
    '.....dpvvpd.....',
    '.....dpppd......',
    '......dppd......',
    '......dppd......',
    '.......dpd......',
    '.......dd.......',
    '........d.......'
  ];
  var WASP_B = [
    '.......kk.......',
    '......kvvk......',
    '......dppd......',
    '....Wdpmmpd W...',
    '...WWdpppmdWW...',
    '..WWdppppppdWW..',
    '..W..dpvvpd..W..',
    '.....dpppd......',
    '......dppd......',
    '......dppd......',
    '.......dpd......',
    '.......dd.......',
    '........d.......'
  ];

  var SPIT_A = [
    '.....k....k.....',
    '......k..k......',
    '.....dpppp d....',
    '....dpvvvvpd....',
    '.k.dppvppvppd.k.',
    '..kdppppppppdk..',
    '..dpmmmmmmmmpd..',
    '.kdpmmfmmfmmpdk.',
    '..dpmmmmmmmmpd..',
    '.kdppmmmmmmppdk.',
    '..k.dppppppd.k..',
    '....dpvvvvpd....',
    '.....dpppp d....',
    '......dppd......',
    '.......dd.......'
  ];
  var SPIT_B = [
    '.....k....k.....',
    '......k..k......',
    '.....dpppp d....',
    '....dpvvvvpd....',
    '..k.dpvppvpd..k.',
    '.kdppppppppppdk.',
    '..dpmmmmmmmmpd..',
    '.kdpmmfmmfmmpdk.',
    '..dpmmmmmmmmpd..',
    '..kdpmmmmmmpdk..',
    '.k..dppppppd..k.',
    '....dpvvvvpd....',
    '.....dpppp d....',
    '......dppd......',
    '.......dd.......'
  ];

  var SCARAB_A = [
    '.....k....k.....',
    '....k.dppd.k....',
    '....dpvvvvpd....',
    '..kdPPPPPPPPdk..',
    '.kdPPpppppp PPdk',
    '..dPpppddpppPd..',
    '.kdPppdvvdppPdk.',
    '..dPppdvvdppPd..',
    '.kdPpppddpppPdk.',
    '..dPppppppppPd..',
    '.kdPPppppppPPdk.',
    '..kdPPPPPPPPdk..',
    '....dpppppd.....',
    '.....dpppd......',
    '......ddd.......'
  ];
  var SCARAB_B = [
    '.....k....k.....',
    '....k.dppd.k....',
    '....dpvvvvpd....',
    '.kkdPPPPPPPPdkk.',
    '..dPPpppppp PPd.',
    '.kdPpppddpppPdk.',
    '..dPppdvvdppPd..',
    '.kdPppdvvdppPdk.',
    '..dPpppddpppPd..',
    '.kdPppppppppPdk.',
    '..dPPppppppPPd..',
    '.kkdPPPPPPPPdkk.',
    '....dpppppd.....',
    '.....dpppd......',
    '......ddd.......'
  ];

  // Detonador: garrapata hinchada de ácido volátil (el vientre pulsa)
  var KAMI_A = [
    '.....k....k.....',
    '....k.dppd.k....',
    '....dpoooopd....',
    '...dpoOooOopd...',
    '..kdpooooooopd..',
    '..dpooffffoopd..',
    '.kdpofOOOOfopdk.',
    '..dpooffffoopd..',
    '..kdpoooooopdk..',
    '...dpoOooOopd...',
    '....dpoooopd....',
    '.....dpppd......',
    '......ddd.......'
  ];
  var KAMI_B = [
    '.....k....k.....',
    '....k.dppd.k....',
    '....dpoooopd....',
    '...dpoyooyopd...',
    '..kdpooooooopd..',
    '..dpooyyyyoopd..',
    '.kdpoyOyyOyopdk.',
    '..dpooyyyyoopd..',
    '..kdpoooooopdk..',
    '...dpoyooyopd...',
    '....dpoooopd....',
    '.....dpppd......',
    '......ddd.......'
  ];

  var BOSS_A = [
    '........k......k........',
    '.......k.dppppd.k.......',
    '........dpvvvvpd........',
    '......ddPPPPPPPPdd......',
    '..k..dPPmmPPPPmmPPd..k..',
    '...kdPPmffmPPmffmPPdk...',
    '..kdPPPmmPPPPPPmmPPPdk..',
    '..dPPppppppppppppppPPd..',
    '.kdPpppddppppppddpppPdk.',
    '..dPppdvvdppppdvvdppPd..',
    '.kdPppdvvdppppdvvdppPdk.',
    '..dPpppddppppppddpppPd..',
    '.kdPppppppvvppppppppPdk.',
    '..dPpppppvvvvpppppppPd..',
    '.kdPpppppvvvvpppppppPdk.',
    '..dPppppppvvppppppppPd..',
    '..kdPPppppppppppppPPdk..',
    '...kdPPPppppppppPPPdk...',
    '....kddPPPPPPPPPPddk....',
    '......ddpppppppdd.......',
    '.......dpppppp d........',
    '........dppppd..........',
    '.........dppd...........',
    '..........dd............'
  ];
  var BOSS_B = [
    '........k......k........',
    '.......k.dppppd.k.......',
    '........dpvvvvpd........',
    '......ddPPPPPPPPdd......',
    '...k.dPPmmPPPPmmPPd.k...',
    '..k.dPPmffmPPmffmPPd.k..',
    '...dPPPmmPPPPPPmmPPPd...',
    '.kdPPppppppppppppppPPdk.',
    '..dPpppddppppppddpppPd..',
    '.kdPppdvvdppppdvvdppPdk.',
    '..dPppdvvdppppdvvdppPd..',
    '.kdPpppddppppppddpppPdk.',
    '..dPppppppvvppppppppPd..',
    '.kdPpppppvvvvpppppppPdk.',
    '..dPpppppvvvvpppppppPd..',
    '.kdPppppppvvppppppppPdk.',
    '...dPPppppppppppppPPd...',
    '..k.dPPPppppppppPPPd.k..',
    '...kddPPPPPPPPPPddk.....',
    '......ddpppppppdd.......',
    '.......dpppppp d........',
    '........dppppd..........',
    '.........dppd...........',
    '..........dd............'
  ];

  // ==========================================================================
  // MECHAS (vista frontal; el arma se dibuja aparte y rota)
  // ==========================================================================

  var MECH_MG = [
    '.....kkkkkk.....',
    '....kbbbbbbk....',
    '...kbBooooBbk...',
    '...kbBoyooBbk...',
    '....kbbbbbbk....',
    '..kkkbBBBBbkkk..',
    '.kbbkBbbbbBkbbk.',
    '.kbbkBbyybBkbbk.',
    '.kllk.kBBk.kllk.',
    '...kBBk..kBBk...',
    '...kBBk..kBBk...',
    '..kBBBk..kBBBk..',
    '..kkkkk..kkkkk..'
  ];

  var MECH_CANNON = [
    '....kkkkkkkk....',
    '...kggggggggk...',
    '..kgGooooooGgk..',
    '..kgGooyyooGgk..',
    '...kggggggggk...',
    '.kkkgGGGGGGgkkk.',
    'kggkGggggggGkggk',
    'kggkGgryyrgGkggk',
    'kggk.kGGGGk.kggk',
    '..kGGGk..kGGGk..',
    '..kGGGk..kGGGk..',
    '.kGGGGk..kGGGGk.',
    '.kkkkkk..kkkkkk.'
  ];

  var MECH_SNIPER = [
    '.......ky.......',
    '.....kkkkkk.....',
    '....kBBBBBBk....',
    '...kBbyyyybBk...',
    '...kBbyooybBk...',
    '....kBBBBBBk....',
    '..kkkBbbbbBkkk..',
    '.kBBkbBBBBbkBBk.',
    '.kBBk.kBBk.kBBk.',
    '...kBBk..kBBk...',
    '....kBk..kBk....',
    '...kBBk..kBBk...',
    '...kkkk..kkkk...'
  ];

  // Mecha leñador: chasis de madera y acero con el hacha al hombro
  var MECH_AXE = [
    '.....kkkkkk.kWk.',
    '....kttttttkWWWk',
    '...ktToooTtkWWWk',
    '...ktToyoTtk.tk.',
    '....kttttttk.tk.',
    '..kkktTTTTtk.tk.',
    '.kttkTttttTkktk.',
    '.kttkTtyytTktk..',
    '.kssk.kTTk.kssk.',
    '...kTTk..kTTk...',
    '...kTTk..kTTk...',
    '..kTTTk..kTTTk..',
    '..kkkkk..kkkkk..'
  ];

  var TESLA = [
    '......kyyk......',
    '.....ky..yk.....',
    '....ky.yy.yk....',
    '....ky.yy.yk....',
    '.....ky..yk.....',
    '......kyyk......',
    '......kgGk......',
    '.....kgGGgk.....',
    '......kgGk......',
    '.....kgGGgk.....',
    '......ktTk......',
    '.....ktTTtk.....',
    '....ktTTTTtk....',
    '...kttTTTTttk...',
    '...kkkkkkkkkk...'
  ];

  // ==========================================================================
  // UNIDADES DE APOYO
  // ==========================================================================

  // Cargador: peón con cajas de munición (dos frames de caminata)
  var CARRIER_A = [
    '....kkkk....',
    '...kssssk...',
    '...kskskk...',
    '....ksss....',
    '.kkkboobkkk.',
    'kttkboobkttk',
    'kttkboobkttk',
    '.kkbboobbkk.',
    '...kbbbbk...',
    '...kbkkbk...',
    '..kbk..kbk..',
    '..kk....kk..'
  ];
  var CARRIER_B = [
    '....kkkk....',
    '...kssssk...',
    '...kskskk...',
    '....ksss....',
    '.kkkboobkkk.',
    'kttkboobkttk',
    'kttkboobkttk',
    '.kkbboobbkk.',
    '...kbbbbk...',
    '...kbkkbk...',
    '...kbkkbk...',
    '...kk..kk...'
  ];

  // Dron aliado: cuadricóptero (dos frames de rotor)
  var ALLY_DRONE_A = [
    'k..........k',
    'kgk......kgk',
    '.kgkkkkkkgk.',
    '..kgGGGGgk..',
    '..kGyyGGGk..',
    '..kgGGGGgk..',
    '...kgkkgk...',
    '....k..k....'
  ];
  var ALLY_DRONE_B = [
    '..k......k..',
    '.kgk....kgk.',
    '.kgkkkkkkgk.',
    '..kgGGGGgk..',
    '..kGyyGGGk..',
    '..kgGGGGgk..',
    '...kgkkgk...',
    '....k..k....'
  ];

  // Variantes visuales por nivel: hombreras de acero (nivel 2) y astas +
  // placas doradas (nivel 3) pintadas sobre el sprite base.
  function mechLevel(base, lvl) {
    var c = document.createElement('canvas');
    c.width = base.width; c.height = base.height;
    var g = c.getContext('2d');
    g.drawImage(base, 0, 0);
    var h = base.height, w = base.width;
    if (lvl >= 2) {
      g.fillStyle = '#454c52';
      g.fillRect(0, h - 7, 2, 3); g.fillRect(w - 2, h - 7, 2, 3);
      g.fillStyle = '#8fb0c9';
      g.fillRect(0, h - 7, 2, 1); g.fillRect(w - 2, h - 7, 2, 1);
    }
    if (lvl >= 3) {
      g.fillStyle = '#f2d94e';
      g.fillRect(2, 0, 2, 2); g.fillRect(w - 4, 0, 2, 2);
      g.fillRect(0, h - 8, 2, 1); g.fillRect(w - 2, h - 8, 2, 1);
    }
    return c;
  }

  // ==========================================================================
  // EDIFICIOS DE APOYO
  // ==========================================================================

  // Generador diésel: torre de acero con bobina amarilla encendida
  var GEN = [
    '.......kk.......',
    '......kyyk......',
    '.....kyooyk.....',
    '....kyoyyoyk....',
    '....kyoyyoyk....',
    '.....kyooyk.....',
    '....kgGGGGgk....',
    '....kgGyyGgk....',
    '....kgGyyGgk....',
    '....kgGGGGgk....',
    '...kggggggggk...',
    '...kgGGooGGgk...',
    '..kggggggggggk..',
    '..kkkkkkkkkkkk..'
  ];

  // Taller de ensamblado: cobertizo de madera con portón y ventanas
  var SHOP = [
    '....kkkkkkkk....',
    '...kggggggggk...',
    '..kgGGGGGGGGgk..',
    '.kGGGGGGGGGGGGk.',
    '.kttttttttttttk.',
    '.kttyyttttoottk.',
    '.kttyyttttoottk.',
    '.kttttkkkkttttk.',
    '.kttttkGGkttttk.',
    '.kttttkGgkttttk.',
    '.kttttkGGkttttk.',
    '.kTTTTkkkkTTTTk.',
    '.kkkkkkkkkkkkkk.'
  ];

  // ==========================================================================
  // ESCENARIO
  // ==========================================================================

  var BARN = [
    '................................',
    '..............kkkk..............',
    '...........kkkRRRRkkk...........',
    '........kkkRRRRRRRRRRkkk........',
    '......kkRRRRRRRRRRRRRRRRkk......',
    '....kkRRRRRRRRRRRRRRRRRRRRkk....',
    '...kRRRRRRRRRRRRRRRRRRRRRRRRk...',
    '..kRRRRwwRRRRRRRRRRRRRRwwRRRRk..',
    '..kwwwwwwwwwwwwwwwwwwwwwwwwwwk..',
    '..krrrrrrrrrrrrrrrrrrrrrrrrrrk..',
    '..krrrrrrrrrwwwwwwwwrrrrrrrrrk..',
    '..krrwwrrrrwwrrrrrrwwrrrrwwrrk..',
    '..krrwwrrrrwrrwwwwrrwrrrrwwrrk..',
    '..krrrrrrrrwrwrrrrwrwrrrrrrrrk..',
    '..krrrrrrrrwrrwwwwrrwrrrrrrrrk..',
    '..krrwwrrrrwwrrrrrrwwrrrrwwrrk..',
    '..krrwwrrrrrwwwwwwwwrrrrrwwrrk..',
    '..krrrrrrrrrrTTTTTTrrrrrrrrrrk..',
    '..krrrrrrrrrTttttttTrrrrrrrrrk..',
    '..krrwwrrrrrTttttttTrrrrrwwrrk..',
    '..krrwwrrrrrTttsstTTrrrrrwwrrk..',
    '..krrrrrrrrrTttttttTrrrrrrrrrk..',
    '..kRRRRRRRRRTttttttTRRRRRRRRRk..',
    '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..'
  ];

  var HOLE = [
    '................................',
    '.......dd.....ddd.....dd........',
    '.....ddPPdd.ddPPPdd.ddPPdd......',
    '....dPPppPPdPPpppPPdPPppPPd.....',
    '...dPpp kkkkkkkkkkkkkk ppPd.....',
    '..dPp kkkkkkkkkkkkkkkkkk pPd....',
    '..dPpkkkkkkkkkkkkkkkkkkkkpPd....',
    '.dPpkkkkkkkkkkkkkkkkkkkkkkpPd...',
    '.dPpkkkkkkkkkkkkkkkkkkkkkkpPd...',
    '.dPpkkkkkkkkkkkkkkkkkkkkkkpPd...',
    '.dPpkkkkkkkkkkkkkkkkkkkkkkpPd...',
    '..dPpkkkkkkkkkkkkkkkkkkkkpPd....',
    '..dPp kkkkkkkkkkkkkkkkkk pPd....',
    '...dPppkkkkkkkkkkkkkkkppPd......',
    '....dPPppPPdPPpppPPdPPppPPd.....',
    '.....ddvvdd.ddvvvdd.ddvvdd......',
    '.......vv.....vvv.....vv........'
  ];

  var ROCK = [
    '................',
    '.....kkkkk......',
    '....kWWWWgk.....',
    '...kWWWggggk....',
    '..kWWggggggGk...',
    '..kWgggggGGGk...',
    '..kggggGGGGGk...',
    '...kgGGGGGGk....',
    '....kkkkkkk.....'
  ];

  var CROP = [
    '................',
    '..v...v...v..v..',
    '.kVk.kVk.kVk.kV.',
    '..V...V...V..V..',
    '.TTTTTTTTTTTTTT.',
    '................',
    '..v..v...v...v..',
    '.kVk.kV.kVk.kVk.',
    '..V...V..V...V..',
    '.TTTTTTTTTTTTTT.',
    '................',
    '.v...v...v..v...',
    'kVk.kVk.kVk.kV..',
    '.V...V...V..V...',
    'TTTTTTTTTTTTTT..',
    '................'
  ];

  var FENCE = [
    '................',
    '.kt k..... kt k.',
    '.ktsk......ktsk.',
    '.kttkkkkkkkkttk.',
    '.kttssssssssttk.',
    '.kttk......kttk.',
    '.kttkkkkkkkkttk.',
    '.kttssssssssttk.',
    '.kttk......kttk.',
    '.kTTk......kTTk.',
    '.kkkk......kkkk.'
  ];

  // ---------- exportación ----------
  var SPRITES = {
    enemies: {
      drone:   [makeSprite(DRONE_A),  makeSprite(DRONE_B)],
      wasp:    [makeSprite(WASP_A),   makeSprite(WASP_B)],
      spitter: [makeSprite(SPIT_A),   makeSprite(SPIT_B)],
      scarab:  [makeSprite(SCARAB_A), makeSprite(SCARAB_B)],
      kamikaze: [makeSprite(KAMI_A),  makeSprite(KAMI_B)],
      boss:    [makeSprite(BOSS_A),   makeSprite(BOSS_B)]
    },
    mechs: {
      mg:     makeSprite(MECH_MG),
      cannon: makeSprite(MECH_CANNON),
      sniper: makeSprite(MECH_SNIPER),
      tesla:  makeSprite(TESLA),
      axe:    makeSprite(MECH_AXE)
    },
    buildings: {
      gen:  makeSprite(GEN),
      shop: makeSprite(SHOP)
    },
    units: {
      carrier: [makeSprite(CARRIER_A), makeSprite(CARRIER_B)],
      drone:   [makeSprite(ALLY_DRONE_A), makeSprite(ALLY_DRONE_B)]
    },
    barn: makeSprite(BARN),
    hole: makeSprite(HOLE),
    rock: makeSprite(ROCK),
    crop: makeSprite(CROP),
    fence: makeSprite(FENCE),
    tiles: {
      grass: [
        makeTile('#7aa03e', ['#688a34', '#8fb44a', '#688a34'], 11),
        makeTile('#7aa03e', ['#688a34', '#8fb44a', '#5f7e2e'], 47),
        makeTile('#769c3c', ['#688a34', '#8fb44a', '#688a34'], 83),
        makeTile('#7aa03e', ['#688a34', '#8fb44a', '#e0c060'], 129)
      ],
      path: [
        makeTile('#a8763e', ['#8f6234', '#bd8a4e', '#8f6234'], 7),
        makeTile('#a8763e', ['#8f6234', '#bd8a4e', '#7a522a'], 91)
      ]
    },
    PAL: PAL,
    makeSprite: makeSprite
  };

  // sprites por nivel de cada mecha: [nivel 1, nivel 2, nivel 3]
  SPRITES.mechLevels = {};
  Object.keys(SPRITES.mechs).forEach(function (k) {
    var base = SPRITES.mechs[k];
    SPRITES.mechLevels[k] = [base, mechLevel(base, 2), mechLevel(base, 3)];
  });

  window.SPRITES = SPRITES;
})();
