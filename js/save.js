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
  var KEY_REC = 'cosecha-de-acero-record';
  var VERSION = 1;

  // localStorage puede no existir (pruebas) o estar bloqueado (privacidad)
  var store = null;
  try { store = window.localStorage || null; } catch (e) { store = null; }

  function saveGame() {
    if (!store) return;
    var data = {
      v: VERSION,
      money: S.money, lives: S.lives, parts: S.parts, wave: S.wave,
      barn: S.barnLevel, diff: S.diff, endless: S.endless,
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
      }),
      mines: S.mines.map(function (m) { return { c: m.c, r: m.r }; })
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
    S.diff = D.DIFFICULTIES[d.diff] ? d.diff : 'aprendiz';
    S.endless = !!d.endless;
    S.giftT = d.giftT || D.DRONE_GIFT;
    S.bombCd = d.bombCd || 0;
    // remontar las torretas del granero según el nivel guardado
    S.barnLevel = d.barn || 1;
    for (var gi = 0; gi < S.barnLevel - 1; gi++) {
      var m = D.BARN_UP.mounts[gi];
      S.barnGuns.push({ x: m.x, y: m.y, cd: 0, gunA: -Math.PI / 2, gflash: 0,
        stats: D.BARN_UP.levels[gi].turret });
    }
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
    S.mines = (d.mines || []).map(function (m) {
      return { c: m.c, r: m.r, x: m.c * TILE + TILE / 2, y: m.r * TILE + TILE / 2,
        t: Math.random() * 2 };
    });
    S.phase = 'build';
    S.buildT = D.BUILD_TIME;
    G.recomputePower();
    return true;
  }

  // ---------- récord de oleadas (sobrevive entre partidas) ----------
  function getRecord() {
    try { return JSON.parse(store.getItem(KEY_REC)) || null; }
    catch (e) { return null; }
  }
  function saveRecord(wave) {
    if (!store || wave < 1) return;
    var r = getRecord();
    if (r && r.wave >= wave) return;
    try { store.setItem(KEY_REC, JSON.stringify({ wave: wave, diff: S.diff })); }
    catch (e) {}
  }

  G.saveGame = saveGame;
  G.loadGame = loadGame;
  G.hasSave = hasSave;
  G.clearSave = clearSave;
  G.getRecord = getRecord;
  G.saveRecord = saveRecord;
})();
