/* ==========================================================================
   COSECHA DE ACERO — save.js
   Guardado en localStorage. Se toma una instantánea serializable del
   estado en los momentos seguros (fase de construcción): dinero, vidas,
   partes, oleada y la disposición de mechas, edificios y unidades.
   Cerrar el juego a media oleada reanuda en la construcción previa.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.DATA;
  var G = window.G, S = G.S;
  var TILE = G.TILE;
  var KEY = 'cosecha-de-acero-save';
  var VERSION = 1;

  // localStorage puede no existir (pruebas) o estar bloqueado (privacidad)
  var store = null;
  try { store = window.localStorage || null; } catch (e) { store = null; }

  function saveGame() {
    if (!store) return;
    var data = {
      v: VERSION,
      money: S.money, lives: S.lives, parts: S.parts, wave: S.wave,
      giftT: Math.round(S.giftT), bombCd: Math.round(S.bombCd),
      towers: S.towers.map(function (t) {
        return { type: t.type, c: t.c, r: t.r, level: t.level,
          invested: t.invested, hp: Math.round(t.hp), maxHp: t.maxHp, ammo: t.ammo };
      }),
      buildings: S.buildings.map(function (b) {
        return { type: b.type, c: b.c, r: b.r, hp: Math.round(b.hp),
          invested: b.invested, turret: !!b.turret };
      }),
      units: S.units.map(function (u) {
        return { type: u.type, mode: u.mode, invested: u.invested,
          ammo: u.ammo, hp: Math.round(u.hp) };
      })
    };
    try { store.setItem(KEY, JSON.stringify(data)); } catch (e) {}
  }

  function hasSave() {
    try { return !!store && !!store.getItem(KEY); } catch (e) { return false; }
  }

  function clearSave() {
    try { if (store) store.removeItem(KEY); } catch (e) {}
  }

  function loadGame() {
    var d;
    try { d = JSON.parse(store.getItem(KEY)); } catch (e) { return false; }
    if (!d || d.v !== VERSION) return false;
    G.resetState();
    S.money = d.money;
    S.lives = d.lives;
    S.parts = d.parts;
    S.wave = d.wave;
    S.giftT = d.giftT || D.DRONE_GIFT;
    S.bombCd = d.bombCd || 0;
    S.buildings = d.buildings.map(function (bd) {
      var b = G.makeBuilding(bd.type, bd.c, bd.r);
      b.hp = Math.min(bd.hp, b.maxHp);
      b.invested = bd.invested;
      if (bd.turret) { b.turret = true; b.cd = 0; b.gunA = -Math.PI / 2; b.gflash = 0; }
      return b;
    });
    S.units = d.units.map(function (ud) {
      var u = G.makeUnit(ud.type, ud.invested === 0);
      u.mode = ud.mode;
      u.ammo = ud.ammo;
      u.invested = ud.invested;
      u.hp = Math.min(ud.hp, u.maxHp);
      return u;
    });
    S.towers = d.towers.map(function (td) {
      return {
        kind: 'tower', type: td.type, c: td.c, r: td.r,
        x: td.c * TILE + TILE / 2, y: td.r * TILE + TILE / 2,
        level: td.level, invested: td.invested,
        cd: 0, angle: -Math.PI / 2,
        hp: Math.min(td.hp, td.maxHp), maxHp: td.maxHp, ammo: td.ammo,
        moving: false, moveCd: 0, tx: 0, ty: 0, incoming: null,
        flash: 0, offline: false, sy: 1
      };
    });
    S.phase = 'build';
    S.buildT = D.BUILD_TIME;
    G.recomputePower();
    return true;
  }

  G.saveGame = saveGame;
  G.loadGame = loadGame;
  G.hasSave = hasSave;
  G.clearSave = clearSave;
})();
