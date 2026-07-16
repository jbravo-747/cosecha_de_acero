/* ==========================================================================
   Arnés headless: carga el juego real con stubs de DOM/canvas y simula
   partidas completas dirigiendo los mismos manejadores de input que usa
   un jugador. Ejecutar: node test/headless.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

// ---------- stubs de DOM ----------
function ctxStub() {
  return new Proxy({}, {
    get(t, p) {
      if (p === 'canvas') return null;
      if (!(p in t)) t[p] = function () {};
      return t[p];
    },
    set() { return true; }
  });
}

function makeEl(tag) {
  const el = {
    tag: tag || 'div', listeners: {}, style: {}, children: [],
    innerHTML: '', textContent: '', disabled: false, width: 300, height: 150,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, v) { v ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(t, f) { (el.listeners[t] = el.listeners[t] || []).push(f); },
    appendChild(c) { el.children.push(c); },
    getContext() { return ctxStub(); },
    getBoundingClientRect() { return { left: 0, top: 0, width: el.width, height: el.height }; },
    click() { (el.listeners.click || []).forEach(f => f({ preventDefault() {}, clientX: 0, clientY: 0 })); }
  };
  return el;
}

const byId = {};
const docListeners = {};
global.document = {
  getElementById(id) {
    if (!byId[id]) { byId[id] = makeEl(id === 'game' || id === 'titleArt' ? 'canvas' : 'div'); }
    if (id === 'game') { byId[id].width = 640; byId[id].height = 384; }
    return byId[id];
  },
  createElement(tag) { return makeEl(tag); },
  addEventListener(t, f) { (docListeners[t] = docListeners[t] || []).push(f); }
};

let simNow = 0;
global.performance = { now: () => simNow };
let rafCb = null;
global.requestAnimationFrame = cb => { rafCb = cb; };
global.window = global;

// ---------- carga del juego real ----------
['sprites', 'data', 'audio', 'game'].forEach(name => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8');
  eval(src); // eslint-disable-line no-eval
});

const S = global.GAME, D = global.DATA;
const canvasEl = byId.game;

// ---------- helpers de simulación ----------
function step(frames) {
  for (let i = 0; i < frames; i++) {
    simNow += 1000 / 60;
    const cb = rafCb; rafCb = null;
    cb(simNow);
    if (!rafCb) throw new Error('el bucle rAF murió (excepción en frame)');
  }
}
function key(k) { (docListeners.keydown || []).forEach(f => f({ key: k, preventDefault() {} })); }
function canvasClick(c, r) {
  (canvasEl.listeners.click || []).forEach(f =>
    f({ clientX: c * 32 + 16, clientY: r * 32 + 16 }));
}
function build(type, c, r) {
  key('Escape');
  key(String(D.TOWER_ORDER.indexOf(type) + 1));
  canvasClick(c, r);
  const t = S.towers.find(t => t.c === c && t.r === r);
  if (!t) throw new Error('no se pudo construir ' + type + ' en ' + c + ',' + r);
  return t;
}
function selectTower(c, r) { key('Escape'); canvasClick(c, r); }
function runUntilBuildPhase(maxSeconds) {
  const cap = Math.ceil(maxSeconds * 60);
  for (let i = 0; i < cap; i++) {
    step(1);
    if (S.phase !== 'wave') return;
  }
  throw new Error('la oleada ' + S.wave + ' no terminó en ' + maxSeconds + 's (enemigos: ' +
    S.enemies.length + ', cola: ' + S.spawnQueue.length + ')');
}

let passed = 0;
function assert(cond, msg) {
  if (!cond) { console.error('  ✗ ' + msg); process.exitCode = 1; throw new Error('FALLO: ' + msg); }
  passed++;
  console.log('  ✓ ' + msg);
}

// ==========================================================================
console.log('— Arranque —');
byId.playBtn.click();
assert(S.phase === 'build', 'al pulsar ARRANCAR entra en fase de construcción');
assert(S.money === D.START_MONEY && S.lives === D.START_LIVES, 'dinero y vidas iniciales correctos');

console.log('— Colocación —');
build('mg', 2, 2);
assert(S.money === D.START_MONEY - 100, 'construir descuenta el costo');
const before = S.towers.length;
key('Escape'); key('1'); canvasClick(3, 4); // tile de camino
assert(S.towers.length === before, 'no se puede construir sobre el camino');
key('1'); canvasClick(2, 2);
assert(S.towers.length === before, 'no se puede construir sobre otra torre');

console.log('— Oleada 1 con defensa —');
build('mg', 4, 4);
const moneyBefore = S.money;
byId.startBtn.click();
assert(S.phase === 'wave' && S.wave === 1, 'la oleada 1 arranca');
let maxEnemies = 0, sawMovement = false, spawnX = null;
for (let i = 0; i < 240; i++) { // 4s muestreando
  step(1);
  maxEnemies = Math.max(maxEnemies, S.enemies.length);
  const e = S.enemies[0];
  if (e) {
    if (spawnX === null) spawnX = e.x;
    else if (e.x !== spawnX || e.wp > 1) sawMovement = true;
  }
}
assert(maxEnemies > 0, 'los bichos aparecen por el agujero');
assert(sawMovement, 'los bichos avanzan por el camino');
runUntilBuildPhase(120);
assert(S.phase === 'build', 'la oleada 1 termina y vuelve la fase de construcción');
assert(S.money > moneyBefore, 'los bichos muertos y el bono de oleada pagan (=$' + S.money + ')');
assert(S.lives === D.START_LIVES, 'con 2 COYOTES no se escapa ningún dron en la oleada 1');

console.log('— Mejora y venta —');
S.money += 1000;
selectTower(2, 2);
assert(S.selected && S.selected.c === 2, 'clic sobre un mecha lo selecciona');
const dmgBefore = S.selected.level;
byId.upBtn.click(); byId.upBtn.click();
assert(S.selected.level === dmgBefore + 2, 'mejora hasta nivel 3');
byId.upBtn.click();
assert(S.selected.level === 3, 'no mejora más allá del nivel máximo');
const moneyPreSell = S.money;
const invested = S.selected.invested;
byId.sellBtn.click();
assert(S.money === moneyPreSell + Math.round(invested * D.SELL_FACTOR), 'vender devuelve el 70%');
assert(!S.towers.find(t => t.c === 2 && t.r === 2), 'la torre vendida desaparece');

console.log('— Campaña completa hasta la Nodriza —');
S.money += 5000;
// defensa en los cuellos del recorrido
build('mg', 2, 2);
build('tesla', 4, 7);
build('cannon', 7, 5);
build('mg', 9, 3);
build('tesla', 12, 3);
build('sniper', 10, 6);
build('cannon', 14, 8);
build('mg', 16, 8);
build('tesla', 16, 6);
build('sniper', 15, 5);
// mejora todo a nivel 3
S.towers.slice().forEach(t => {
  selectTower(t.c, t.r);
  byId.upBtn.click(); byId.upBtn.click();
});
assert(S.towers.every(t => t.level === 3), 'todas las torres a nivel 3');

let sawBoss = false;
while (S.phase === 'build' && S.wave < D.WAVES.length) {
  byId.startBtn.click();
  const w = S.wave;
  for (let i = 0; i < 300 * 60 && S.phase === 'wave'; i++) {
    step(1);
    if (S.enemies.some(e => e.type === 'boss')) sawBoss = true;
  }
  if (S.phase === 'wave') throw new Error('oleada ' + w + ' atascada');
  console.log('    oleada ' + w + ' superada · vidas ' + S.lives + ' · $' + S.money);
}
assert(sawBoss, 'la Nodriza apareció en la oleada 10');
assert(S.phase === 'won', 'campaña completa: fase final = ' + S.phase);
assert(S.lives > 0, 'victoria con vidas restantes (' + S.lives + ')');

console.log('— Derrota por fugas —');
// reinicio limpio
byId.restartBtn.click();
assert(S.phase === 'build' && S.wave === 0 && S.towers.length === 0, 'reinicio limpia el estado');
// sin torres, dejar pasar oleadas hasta perder
let guard = 0;
while (S.phase === 'build' && guard++ < D.WAVES.length) {
  byId.startBtn.click();
  for (let i = 0; i < 300 * 60 && S.phase === 'wave'; i++) step(1);
}
assert(S.phase === 'lost', 'sin defensa se pierde la granja (en la oleada ' + S.wave + ')');
assert(S.lives === 0, 'las vidas llegan exactamente a 0');

console.log('\nTODO OK — ' + passed + ' aserciones superadas.');
