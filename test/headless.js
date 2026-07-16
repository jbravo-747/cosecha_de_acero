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
['sprites', 'data', 'audio', 'core', 'behaviors', 'entities', 'render', 'ui', 'main'].forEach(name => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8');
  eval(src); // eslint-disable-line no-eval
});

const S = global.GAME, D = global.DATA, G = global.G;
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
function canvasClickPx(x, y) {
  (canvasEl.listeners.click || []).forEach(f => f({ clientX: x, clientY: y }));
}
function canvasClick(c, r) { canvasClickPx(c * 32 + 16, r * 32 + 16); }
function build(type, c, r) {
  key('Escape');
  key(String(D.TOWER_ORDER.indexOf(type) + 1));
  canvasClick(c, r);
  const t = S.towers.find(t => t.c === c && t.r === r);
  if (!t) throw new Error('no se pudo construir ' + type + ' en ' + c + ',' + r);
  return t;
}
function buildB(type, c, r) {
  key('Escape');
  key(String(D.BUILDING_ORDER.indexOf(type) + 5));
  canvasClick(c, r);
  const b = S.buildings.find(b => b.c === c && b.r === r);
  if (!b) throw new Error('no se pudo construir ' + type + ' en ' + c + ',' + r);
  return b;
}
function selectTile(c, r) { key('Escape'); canvasClick(c, r); }
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
assert(S.buildings.length === 2, 'arranca con generador y taller pre-colocados');
assert(S.units.length === 1 && S.units[0].type === 'drone' && S.units[0].mode === 'reload',
  'la partida empieza con un dron de apoyo en modo recarga');
assert(S.parts === 0 && S.buildT === D.BUILD_TIME, 'sin partes y disruptor cargado a ' + D.BUILD_TIME + 's');

console.log('— Disruptor de portales: apertura automática —');
step(Math.ceil((D.BUILD_TIME + 1) * 60));
assert(S.phase === 'wave' && S.wave === 1, 'al agotarse el disruptor el portal se abre solo');
byId.restartBtn.click();
assert(S.phase === 'build' && S.wave === 0 && S.buildT === D.BUILD_TIME, 'reinicio recarga el disruptor');

console.log('— Colocación de mechas —');
build('mg', 2, 2);
assert(S.money === D.START_MONEY - 100, 'construir descuenta el costo');
const before = S.towers.length;
key('Escape'); key('1'); canvasClick(3, 4); // tile de camino
assert(S.towers.length === before, 'no se puede construir sobre el camino');
key('1'); canvasClick(2, 2);
assert(S.towers.length === before, 'no se puede construir sobre otra torre');

console.log('— Energía por rango: generadores cerca de los mechas —');
assert(S.towers[0].offline, 'un mecha lejos de todo generador queda SIN ⚡');
buildB('gen', 4, 2);
assert(!S.towers[0].offline, 'con un generador en rango el mecha se enciende');
S.money += 2000;
build('mg', 4, 4);
assert(!S.towers[1].offline, 'el generador alimenta a todos los mechas de su radio');
build('cannon', 1, 5);
assert(S.towers.find(t => t.c === 1 && t.r === 5).offline,
  'fuera del radio de todo generador no hay energía');
build('sniper', 1, 6);
build('cannon', 1, 7);
assert(S.energyUsed === 8 && S.energyCap === 8, 'consumo al tope de capacidad global (8/8)');
const tCount = S.towers.length;
key('1'); canvasClick(1, 8);
assert(S.towers.length === tCount, 'sin capacidad de energía no se ensamblan más mechas');
[[1, 5], [1, 6], [1, 7]].forEach(([c, r]) => { selectTile(c, r); byId.sellBtn.click(); });
assert(S.energyUsed === 2, 'vender mechas libera energía');

console.log('— Dron: alternar entre recarga y ataque —');
canvasClickPx(S.units[0].x, S.units[0].y);
assert(S.selectedU === S.units[0], 'clic sobre una unidad la selecciona');
byId.upBtn.click();
assert(S.units[0].mode === 'attack', 'el dron cambia a modo ATAQUE');
byId.upBtn.click();
assert(S.units[0].mode === 'reload', 'y vuelve a modo RECARGA');
key('Escape');

console.log('— Disruptor manual: bono por desactivarlo antes —');
const moneyPreWave = S.money;
byId.startBtn.click();
assert(S.phase === 'wave' && S.wave === 1, 'desactivar el disruptor lanza la oleada');
assert(S.money === moneyPreWave + Math.round(D.BUILD_TIME * D.EARLY_BONUS),
  'desactivarlo con tiempo restante paga el bono');

console.log('— Oleada 1: movimiento, munición y pausa —');
let maxEnemies = 0, sawMovement = false, spawnX = null;
step(60);
key('p');
const pausedT = S.waveT, pausedEnemies = S.enemies.map(e => e.x + ',' + e.y).join('|');
step(60);
assert(S.waveT === pausedT, 'en pausa el tiempo de oleada se congela');
assert(S.enemies.map(e => e.x + ',' + e.y).join('|') === pausedEnemies, 'en pausa los bichos no se mueven');
key('p');
for (let i = 0; i < 240; i++) {
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
assert(S.buildT === D.BUILD_TIME, 'el disruptor se recarga al terminar la oleada');
assert(S.money > moneyPreWave, 'los bichos muertos, el bono de oleada y el disruptor pagan (=$' + S.money + ')');
assert(S.lives === D.START_LIVES, 'con 2 COYOTES no se escapa ningún dron en la oleada 1');
assert(S.towers.some(t => t.ammo < G.towerStats(t).maxAmmo), 'disparar consume munición');

console.log('— Logística: el cargador repone munición —');
S.buildT = 99999;                       // congela el disruptor durante la prueba
key('7');                               // comprar CARGADOR
assert(S.units.some(u => u.type === 'carrier'), 'el cargador se recluta en el granero');
const hungry = S.towers.find(t => t.c === 4 && t.r === 4);
hungry.ammo = 1;
let refilled = false;
for (let i = 0; i < 40 * 60 && !refilled; i++) {
  step(1);
  refilled = hungry.ammo >= G.towerStats(hungry).maxAmmo;
}
assert(refilled, 'una unidad llevó munición del granero al mecha');
for (let i = 0; i < 20 * 60; i++) {     // deja que las unidades vuelvan a base
  step(1);
  if (S.units.every(u => u.state === 'idle')) break;
}

console.log('— Mechas móviles: desplazamiento tipo ajedrez —');
selectTile(4, 4);
assert(S.selected === hungry, 'clic sobre un mecha lo selecciona');
canvasClick(9, 9);                      // a 5 tiles: fuera de su paso (2)
assert(hungry.c === 4 && !hungry.moving, 'no puede moverse más allá de su paso');
selectTile(4, 4);                       // el clic inválido deselecciona
canvasClick(5, 5);                      // a 1 tile: válido
assert(hungry.c === 5 && hungry.r === 5 && hungry.moving, 'orden de movimiento válida: reserva el tile');
for (let i = 0; i < 10 * 60 && hungry.moving; i++) step(1);
assert(!hungry.moving && hungry.moveCd > 0, 'al llegar queda en enfriamiento de movimiento');
selectTile(5, 5);
canvasClick(6, 6);
assert(hungry.c === 5, 'en enfriamiento no acepta otra orden');
S.buildT = D.BUILD_TIME;

console.log('— Voladores: las avispas van directo al granero —');
const waspTest = G.spawnEnemy('wasp');
assert(waspTest.flying && waspTest.path.length === 2, 'la avispa vuela recto, sin seguir el camino');
S.enemies.pop();

console.log('— Reparación de edificios —');
const genB = S.buildings.find(b => b.type === 'gen' && b.c === 4);
genB.hp -= 50;
selectTile(4, 2);
assert(S.selectedB === genB, 'clic sobre un edificio lo selecciona');
const repCost = Math.ceil(50 * D.REPAIR_PER_HP);
const moneyPreRep = S.money;
byId.upBtn.click();
assert(genB.hp === genB.maxHp && S.money === moneyPreRep - repCost, 'reparar restaura la vida y cobra $' + repCost);

console.log('— Mejora con partes y venta —');
S.money += 1000;
S.parts = 10;
selectTile(2, 2);
const mech22 = S.selected;
const lvlBefore = mech22.level;
byId.upBtn.click(); byId.upBtn.click();
assert(mech22.level === lvlBefore + 2, 'mejora hasta nivel 3');
assert(S.parts === 10 - D.UP_PARTS[0] - D.UP_PARTS[1], 'cada mejora consume partes ⚙ (quedan ' + S.parts + ')');
assert(mech22.ammo === G.towerStats(mech22).maxAmmo && mech22.hp === mech22.maxHp,
  'el taller entrega el mecha mejorado reparado y con munición llena');
byId.upBtn.click();
assert(mech22.level === 3, 'no mejora más allá del nivel máximo');
S.parts = 0;
selectTile(5, 5);
byId.upBtn.click();
assert(S.selected.level === 1, 'sin partes no hay mejora');
const moneyPreSell = S.money;
selectTile(2, 2);
const invested = S.selected.invested;
byId.sellBtn.click();
assert(S.money === moneyPreSell + Math.round(invested * D.SELL_FACTOR), 'vender devuelve el 70%');
assert(!S.towers.find(t => t.c === 2 && t.r === 2), 'la torre vendida desaparece');

console.log('— Taller de ensamblado obligatorio —');
selectTile(16, 4);
assert(S.selectedB && S.selectedB.type === 'shop', 'el taller pre-colocado se selecciona');
byId.sellBtn.click();
assert(!S.buildings.find(b => b.type === 'shop'), 'el taller vendido desaparece');
const tPreShop = S.towers.length;
key('1'); canvasClick(6, 2);
assert(S.towers.length === tPreShop, 'sin taller no se ensamblan mechas');
S.money += 300;
buildB('shop', 16, 4);
build('mg', 6, 2);
assert(S.towers.length === tPreShop + 1, 'con taller nuevo se vuelve a ensamblar');
selectTile(6, 2); byId.sellBtn.click();

console.log('— Campaña completa hasta la Nodriza —');
S.money += 9000;
S.parts = 40;
// generadores cubriendo cada nido de defensa (energía por rango)
buildB('gen', 2, 5);
buildB('gen', 9, 4);
buildB('gen', 12, 4);
buildB('gen', 15, 7);
buildB('gen', 14, 5);
// logística de munición: cargadores + el dron inicial en modo recarga
key('7'); key('7'); key('7'); key('7');
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
assert(S.towers.every(t => !t.offline), 'todos los mechas quedaron dentro del radio de un generador');
// mejora todo a nivel 3
S.towers.slice().forEach(t => {
  selectTile(t.c, t.r);
  byId.upBtn.click(); byId.upBtn.click();
});
assert(S.towers.every(t => t.level === 3), 'todas las torres a nivel 3');
const partsPreCampaign = S.parts;

let sawBoss = false, sawElite = false, sawFlier = false, sawTowerHurt = false;
while (S.phase === 'build' && S.wave < D.WAVES.length) {
  byId.startBtn.click();
  const w = S.wave;
  for (let i = 0; i < 300 * 60 && S.phase === 'wave'; i++) {
    step(1);
    if (!sawBoss && S.enemies.some(e => e.type === 'boss')) sawBoss = true;
    if (!sawElite && S.enemies.some(e => e.elite)) sawElite = true;
    if (!sawFlier && S.enemies.some(e => e.flying && e.path.length === 2)) sawFlier = true;
    if (!sawTowerHurt && S.towers.some(t => t.hp < t.maxHp)) sawTowerHurt = true;
  }
  if (S.phase === 'wave') throw new Error('oleada ' + w + ' atascada');
  console.log('    oleada ' + w + ' superada · vidas ' + S.lives + ' · $' + S.money +
    ' · ⚙' + S.parts + ' · mechas ' + S.towers.length + ' · unidades ' + S.units.length);
}
assert(sawBoss, 'la Nodriza apareció en la oleada 10');
assert(sawElite, 'aparecieron variantes de élite en oleadas avanzadas');
assert(sawFlier, 'las avispas tomaron el atajo aéreo');
assert(sawTowerHurt, 'los bichos dañaron a los mechas (mordiscos / escupitajos)');
assert(S.phase === 'won', 'campaña completa: fase final = ' + S.phase);
assert(S.lives > 0, 'victoria con vidas restantes (' + S.lives + ')');
assert(S.parts > partsPreCampaign, 'los bichos duros soltaron partes ⚙ (' + partsPreCampaign + ' → ' + S.parts + ')');

console.log('— Derrota por fugas y mordiscos —');
byId.restartBtn.click();
assert(S.phase === 'build' && S.wave === 0 && S.towers.length === 0 &&
  S.buildings.length === 2 && S.units.length === 1 && S.parts === 0, 'reinicio limpia todo el estado');
let guard = 0;
while (S.phase === 'build' && guard++ < D.WAVES.length) {
  byId.startBtn.click();
  for (let i = 0; i < 300 * 60 && S.phase === 'wave'; i++) step(1);
}
assert(S.phase === 'lost', 'sin defensa se pierde la granja (en la oleada ' + S.wave + ')');
assert(S.lives === 0, 'las vidas llegan exactamente a 0');
assert(S.buildings.some(b => b.hp < b.maxHp) || S.buildings.length < 2,
  'los bichos mordieron la base al pasar');

console.log('\nTODO OK — ' + passed + ' aserciones superadas.');
