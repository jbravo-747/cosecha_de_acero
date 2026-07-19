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
    querySelector() { return null; },
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
  createTextNode(text) { return { nodeType: 3, textContent: text }; },
  addEventListener(t, f) { (docListeners[t] = docListeners[t] || []).push(f); }
};

let simNow = 0;
global.performance = { now: () => simNow };
global.localStorage = {
  _data: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; }
};
let rafCb = null;
global.requestAnimationFrame = cb => { rafCb = cb; };
global.window = global;

// ---------- carga del juego real ----------
['sprites', 'data', 'audio', 'core', 'anim', 'save', 'behaviors', 'entities', 'render', 'ui', 'main'].forEach(name => {
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
function canvasTouch(c, r) {
  const ev = { preventDefault() {}, touches: [{ clientX: c * 32 + 16, clientY: r * 32 + 16 }] };
  (canvasEl.listeners.touchstart || []).forEach(f => f(ev));
  (canvasEl.listeners.touchend || []).forEach(f => f({ preventDefault() {}, touches: [] }));
}
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
  key(String(D.BUILDING_ORDER.indexOf(type) + 7));
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
assert(!byId.wavePrev.classList.contains('hidden') && byId.wavePrev.innerHTML.includes('EN CURSO'),
  'el radar de oleada muestra la oleada en curso');
byId.restartBtn.click();
assert(S.phase === 'build' && S.wave === 0 && S.buildT === D.BUILD_TIME, 'reinicio recarga el disruptor');
step(1);
assert(byId.wavePrev.children.some(ch => String(ch.textContent).includes('PRÓXIMA OLEADA 1')),
  'el radar anuncia la próxima oleada en fase de construcción');

console.log('— Colocación de mechas —');
build('mg', 2, 2);
assert(S.money === D.START_MONEY - 100, 'construir descuenta el costo');
const before = S.towers.length;
key('Escape'); key('1'); canvasClick(3, 4); // tile de camino
assert(S.towers.length === before, 'no se puede construir sobre el camino');
key('1'); canvasClick(2, 2);
assert(S.towers.length === before, 'no se puede construir sobre otra torre');

console.log('— Entrada táctil —');
key('Escape');
canvasTouch(2, 2);
assert(S.selected && S.selected.c === 2 && S.selected.r === 2,
  'un toque en pantalla selecciona al mecha');
assert(S.hover && S.hover.c === 2 && S.hover.r === 2,
  'el toque actualiza la previsualización (hover)');
key('Escape');

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
assert(S.parts >= 1, 'superar la oleada deja +1 ⚙ de chatarra garantizada');
assert(S.towers.some(t => t.ammo < G.towerStats(t).maxAmmo), 'disparar consume munición');

console.log('— Logística: el cargador repone munición y repara —');
S.buildT = 99999;                       // congela el disruptor durante la prueba
key('9');                               // comprar CARGADOR
assert(S.units.some(u => u.type === 'carrier'), 'el cargador se recluta en el granero');
const hungry = S.towers.find(t => t.c === 4 && t.r === 4);
hungry.ammo = 1;
hungry.hp = Math.floor(hungry.maxHp * 0.4);
let refilled = false;
for (let i = 0; i < 40 * 60 && !refilled; i++) {
  step(1);
  refilled = hungry.ammo >= G.towerStats(hungry).maxAmmo;
}
assert(refilled, 'una unidad llevó munición del granero al mecha');
assert(hungry.hp === hungry.maxHp, 'el cargador también repara al mecha en el campo');
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

console.log('— Melé: los mechas pelean a quemarropa —');
hungry.ammo = 0;                        // sin balas: solo le queda el puño
const closeBug = G.spawnEnemy('drone', 3, 0, hungry.x + 18, hungry.y);
step(15);
assert(closeBug.dead || closeBug.hp < closeBug.maxHp,
  'sin munición, el mecha golpea cuerpo a cuerpo a los bichos pegados');
S.enemies.length = 0;

console.log('— LEÑADOR: el mecha del hacha —');
S.money += 500;
const axeMech = build('axe', 4, 3);
assert(!axeMech.offline, 'el LEÑADOR se enciende junto al generador');
const chop1 = G.spawnEnemy('drone', 3, 0, axeMech.x + 20, axeMech.y - 6);
const chop2 = G.spawnEnemy('drone', 3, 0, axeMech.x - 20, axeMech.y + 6);
step(40);
assert(chop1.dead && chop2.dead, 'el hacha barre a todos los bichos al alcance');
assert(axeMech.ammo === 0 && G.towerStats(axeMech).maxAmmo === 0,
  'el hacha no gasta munición');
S.enemies.length = 0;
selectTile(4, 3); byId.sellBtn.click();

console.log('— COYOTE nivel 3: lanzallamas —');
S.money += 800; S.parts += 5;
const pyro = build('mg', 4, 3);
pyro.level = 3;
const stP = G.towerStats(pyro);
const b1 = G.spawnEnemy('drone', 3, 0, pyro.x + 30, pyro.y);
const b2 = G.spawnEnemy('drone', 3, 0, pyro.x + 50, pyro.y + 12);
const b3 = G.spawnEnemy('drone', 3, 0, pyro.x - 40, pyro.y);   // a la espalda
const hp1 = b1.hp, hp2 = b2.hp, hp3 = b3.hp;
G.WEAPONS.flame.fire(pyro, stP, b1, D.TOWERS.mg);
assert(b1.hp < hp1 && b2.hp < hp2, 'el chorro de fuego baña a todos los bichos del cono');
assert(b3.hp === hp3, 'pero no quema a los que están a la espalda');
S.enemies.length = 0;
selectTile(4, 3); byId.sellBtn.click();

console.log('— SEGADOR: la hoja de energía —');
S.money += 500;
const bladeMech = build('blade', 4, 3);
assert(!bladeMech.offline, 'el SEGADOR se enciende junto al generador');
const armored = G.spawnEnemy('scarab', 3, 0, bladeMech.x + 34, bladeMech.y);
const hpA = armored.hp;
const stB = G.towerStats(bladeMech);
G.WEAPONS.blade.fire(bladeMech, stB, armored);
assert(hpA - armored.hp === stB.dmg,
  'la hoja atraviesa el blindaje: daño íntegro ' + stB.dmg + ' pese a la coraza');
assert(stB.maxAmmo === 0, 'la hoja no gasta munición');
step(60);   // y el motor la dispara solo sin tropezar
S.enemies.length = 0;
selectTile(4, 3); byId.sellBtn.click();

console.log('— Campo de fuerza entre pilones CERCA-9 —');
S.money += 800;
build('tesla', 2, 4);
build('tesla', 4, 4);
assert(S.fields.length === 1 && S.fields[0].c === 3 && S.fields[0].r === 4,
  'dos pilones flanqueando el camino crean el campo');
const fld = S.fields[0];
assert(fld.maxHp === D.FIELD.hpPerLvl * 2, 'la vida del campo escala con los niveles');
const blockedBug = G.spawnEnemy('scarab');
for (let i = 0; i < 15 * 60; i++) {
  step(1);
  if (fld.hp < fld.maxHp) break;
}
assert(!blockedBug.dead && blockedBug.y < fld.y - 8, 'el terrestre se detiene ante el campo');
assert(fld.hp < fld.maxHp, 'y lo muerde para romperlo');
fld.hp = 1;
for (let i = 0; i < 5 * 60 && fld.downT <= 0; i++) step(1);
assert(fld.downT > 0 && fld.hp === 0, 'el campo se rompe');
for (let i = 0; i < 6 * 60 && blockedBug.y <= fld.y && !blockedBug.dead; i++) step(1);
assert(blockedBug.dead || blockedBug.y > fld.y, 'roto el campo, el bicho avanza');
fld.downT = 0.3;
step(30);
assert(fld.hp === fld.maxHp, 'los pilones regeneran el campo');
S.enemies.length = 0;
const spitBug = G.spawnEnemy('spitter', 2, 0, 90, 170);   // el pilón le queda más cerca
spitBug.spitCd = 0;
step(1);
assert(S.eShots.length > 0 && S.eShots[0].target === fld,
  'los escupidores priorizan derribar el campo a distancia');
G.damageEnemy(spitBug, 9999);
S.eShots.length = 0;
S.enemies.length = 0;
[[2, 4], [4, 4]].forEach(([c, r]) => { selectTile(c, r); byId.sellBtn.click(); });
assert(S.fields.length === 0, 'sin pilones no hay campo');

console.log('— Sistema de animaciones (tweens) —');
const twObj = { v: 0 };
G.tween(twObj, 'v', 0, 10, 0.5, 'linear');
step(15);   // 0.25s de los 0.5s
assert(twObj.v > 3 && twObj.v < 8, 'el tween interpola en el tiempo (' + twObj.v.toFixed(1) + ')');
step(30);
assert(twObj.v === 10, 'el tween aterriza exacto en el destino');
assert(S.towers.every(t => t.sy === 1),
  'los mechas terminan su animación de despliegue en escala 1');

console.log('— Guardado en localStorage —');
G.saveGame();
assert(G.hasSave(), 'la partida se guarda');
const savedMoney = S.money, savedWave = S.wave, savedParts = S.parts,
  savedTowers = S.towers.length, savedBuildings = S.buildings.length,
  savedUnits = S.units.length;
S.money = 0; S.towers.length = 0; S.parts = 0;   // arruina el estado en vivo
assert(G.loadGame(), 'la partida se restaura desde el guardado');
assert(S.money === savedMoney && S.wave === savedWave && S.parts === savedParts &&
  S.towers.length === savedTowers && S.buildings.length === savedBuildings &&
  S.units.length === savedUnits,
  'dinero, oleada, partes, mechas, edificios y unidades vuelven intactos');
assert(S.phase === 'build' && S.towers.every(t => !t.moving),
  'se reanuda en fase de construcción');
S.buildT = 99999;
step(1);                        // el autoguardado vuelve a escribir
assert(G.hasSave(), 'el autoguardado corre en fase de construcción');
G.clearSave();
assert(!G.hasSave(), 'limpiar el guardado lo elimina');
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

console.log('— Más talleres, mejoras más baratas —');
const upT = S.towers[0];
const fullCost = G.upgradeCost(upT);
S.money += 1500;
buildB('shop', 2, 8);
assert(G.upgradeCost(upT) ===
  Math.round(D.TOWERS[upT.type].cost * D.UP_COST_FACTOR * upT.level * (1 - D.SHOP_DISCOUNT)),
  'un taller extra abarata la mejora ($' + fullCost + ' → $' + G.upgradeCost(upT) + ')');
buildB('shop', 4, 9);
buildB('shop', 6, 9);
buildB('shop', 9, 10);
assert(G.upgradeCost(upT) ===
  Math.round(D.TOWERS[upT.type].cost * D.UP_COST_FACTOR * upT.level * (1 - D.SHOP_DISCOUNT_MAX)),
  'el descuento se topa en ' + (D.SHOP_DISCOUNT_MAX * 100) + '%');
[[2, 8], [4, 9], [6, 9], [9, 10]].forEach(([c, r]) => { selectTile(c, r); byId.sellBtn.click(); });
assert(G.upgradeCost(upT) === fullCost, 'vender talleres devuelve el precio normal');

console.log('— Torreta del taller —');
S.buildT = 99999;
S.money += 500; S.parts += 3;
selectTile(16, 4);
assert(S.selectedB && S.selectedB.type === 'shop', 'taller re-seleccionado');
byId.upBtn.click();
assert(S.selectedB.turret === true, 'la mejora instala la torreta en el taller');
const waspT = G.spawnEnemy('wasp');
let waspHurt = false;
for (let i = 0; i < 12 * 60; i++) {
  step(1);
  if (waspT.dead || waspT.hp < waspT.maxHp) { waspHurt = true; break; }
  if (S.enemies.indexOf(waspT) === -1) break;   // se fugó intacta
}
assert(waspHurt, 'la torreta del taller dispara a los bichos que pasan');
S.enemies.length = 0;

console.log('— Especial: bombardeo de área —');
S.money += 1000; S.parts += 5;
byId.bombBtn.click();
assert(S.aimingBomb, 'el botón de mando arma el bombardeo');
const d1 = G.spawnEnemy('drone', 3, 0, 300, 300);
const d2 = G.spawnEnemy('drone', 3, 0, 320, 300);
const moneyPreBomb = S.money, partsPreBomb = S.parts;
canvasClickPx(310, 300);
assert(!S.aimingBomb && S.bombs.length === 1, 'clic en el mapa suelta la bomba');
assert(S.money === moneyPreBomb - D.BOMB.cost && S.parts === partsPreBomb - D.BOMB.parts,
  'el bombardeo cobra créditos y partes');
for (let i = 0; i < 2 * 60; i++) step(1);
assert((d1.dead || S.enemies.indexOf(d1) === -1) && (d2.dead || S.enemies.indexOf(d2) === -1),
  'la explosión arrasa con los bichos del área');
assert(S.bombCd > 0, 'el bombardeo queda en enfriamiento');

console.log('— Dron de apoyo gratis (con tope de flota) —');
const dronesBefore = S.units.filter(u => u.type === 'drone').length;
S.giftT = 0.5;
step(60);
const dronesAfter = S.units.filter(u => u.type === 'drone').length;
assert(dronesAfter === dronesBefore + 1 && S.units[S.units.length - 1].invested === 0,
  'cada ' + D.DRONE_GIFT + 's llega un dron de apoyo gratis');
while (S.units.filter(u => u.type === 'drone').length < D.DRONE_CAP) {
  S.units.push(G.makeUnit('drone', true));
}
S.giftT = 0.5;
step(60);
assert(S.units.filter(u => u.type === 'drone').length === D.DRONE_CAP,
  'con la flota al tope (' + D.DRONE_CAP + ') no llegan más regalos');

console.log('— Menú contextual de la consola —');
selectTile(5, 5);
step(1);
assert(!byId.ctxPanel.classList.contains('hidden') && byId.ctxIdle.classList.contains('hidden'),
  'al seleccionar aparece el menú contextual en la consola');
assert(!byId.towerBtns.classList.contains('hidden'),
  'el arsenal lateral sigue visible con algo seleccionado');
key('Escape');
step(1);
assert(byId.ctxPanel.classList.contains('hidden') && !byId.ctxIdle.classList.contains('hidden'),
  'al deseleccionar la consola queda en espera');

console.log('— Autodestrucción y explosión en cadena —');
S.money += 500;
const boomA = buildB('gen', 5, 2);
const boomB = buildB('gen', 6, 2);
const victim = G.spawnEnemy('drone', 2, 0, boomA.x + 14, boomA.y);
selectTile(5, 2);
byId.boomBtn.click();
assert(S.buildings.indexOf(boomA) !== -1, 'el primer clic solo pide confirmación');
byId.boomBtn.click();
assert(S.buildings.indexOf(boomA) === -1, 'confirmar detona la unidad seleccionada');
assert(victim.dead, 'la onda arrasa a los bichos cercanos');
step(30);
assert(S.buildings.indexOf(boomB) === -1, 'el generador vecino detona en cadena');

console.log('— Detonador: el bicho kamikaze —');
S.money += 500;
const kGen = buildB('gen', 5, 4);
const kami = G.spawnEnemy('kamikaze', 2, 0, kGen.x + 90, kGen.y);
let charged = false;
for (let i = 0; i < 5 * 60; i++) {
  step(1);
  if (kami.chargeTarget) charged = true;
  if (kami.dead || S.enemies.indexOf(kami) === -1) break;
}
assert(charged, 'el Detonador carga contra la defensa cercana');
assert(kami.dead || S.enemies.indexOf(kami) === -1, 'se inmola al alcanzarla');
assert(kGen.hp === kGen.maxHp - D.ENEMIES.kamikaze.boom.dmg,
  'su onda daña a la defensa (' + kGen.hp + '/' + kGen.maxHp + ')');
const kGen2 = buildB('gen', 6, 4);
kGen.hp = 60;                                   // dañado: la onda lo rematará
const kami2 = G.spawnEnemy('kamikaze', 2, 0, kGen.x + 20, kGen.y);
G.damageEnemy(kami2, 999);
assert(kami2.dead, 'matarlo de cerca también lo detona');
step(60);
assert(S.buildings.indexOf(kGen) === -1,
  'su estallido remata unidades dañadas, que aún detonan');
assert(S.buildings.indexOf(kGen2) !== -1 && kGen2.hp > 0,
  'pero la cadena enemiga llega contenida: el vecino sano resiste (' +
  Math.round(kGen2.hp) + ' hp)');
S.enemies.length = 0;

console.log('— VIUDA: bonus antiaéreo —');
const waspAir = G.spawnEnemy('wasp');
waspAir.hp = 200;
G.WEAPONS.beam.fire({ x: waspAir.x, y: waspAir.y }, { dmg: 100 }, waspAir, D.TOWERS.sniper);
assert(waspAir.hp === 50, 'el rifle hace ×1.5 de daño a voladores (200 → ' + waspAir.hp + ')');
S.enemies.length = 0;
S.buildT = D.BUILD_TIME;

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
key('9'); key('9'); key('9'); key('9');
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

let sawBoss = false, sawElite = false, sawFlier = false, sawTowerHurt = false, sawKami = false;
while (S.phase === 'build' && S.wave < D.WAVES.length) {
  byId.startBtn.click();
  const w = S.wave;
  for (let i = 0; i < 300 * 60 && S.phase === 'wave'; i++) {
    step(1);
    if (!sawBoss && S.enemies.some(e => e.type === 'boss')) sawBoss = true;
    if (!sawElite && S.enemies.some(e => e.elite)) sawElite = true;
    if (!sawFlier && S.enemies.some(e => e.flying && e.path.length === 2)) sawFlier = true;
    if (!sawTowerHurt && S.towers.some(t => t.hp < t.maxHp)) sawTowerHurt = true;
    if (!sawKami && S.enemies.some(e => e.type === 'kamikaze')) sawKami = true;
  }
  if (S.phase === 'wave') throw new Error('oleada ' + w + ' atascada');
  console.log('    oleada ' + w + ' superada · vidas ' + S.lives + ' · $' + S.money +
    ' · ⚙' + S.parts + ' · mechas ' + S.towers.length + ' · unidades ' + S.units.length);
}
assert(sawBoss, 'la Nodriza apareció en la oleada 10');
assert(sawKami, 'los Detonadores atacaron en oleadas avanzadas');
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

console.log('— Nueva partida en caliente —');
byId.newBtn.click();
assert(S.phase === 'lost', 'el primer clic solo pide confirmación');
byId.newBtn.click();
assert(S.phase === 'build' && S.wave === 0 && S.money === D.START_MONEY &&
  S.towers.length === 0 && S.units.length === 1, 'confirmar reinicia la partida al vuelo');

console.log('— El granero se refuerza —');
assert(S.barnLevel === 1 && S.barnGuns.length === 1,
  'el granero arranca en nivel 1 con su torreta de serie');
canvasClick(19, 6);   // esquina lejos del dron que ronda la puerta
assert(S.selectedBarn === true, 'clic en el granero lo selecciona');
const lvB = D.BARN_UP.levels[0];
const mB = S.money, lB = S.lives;
S.money += lvB.cost;
S.parts += lvB.parts;
byId.upBtn.click();
assert(S.barnLevel === 2 && S.lives === lB + lvB.lives,
  'reforzar sube el granero a nivel 2 y da +' + lvB.lives + ' vidas');
assert(S.barnGuns.length === 2, 'el refuerzo monta una torreta más en el techo');
assert(S.money === mB && S.parts === 0, 'el refuerzo cobra dinero y partes ⚙');
key('Escape');
assert(S.selectedBarn === false, 'Esc deselecciona el granero');

console.log('— Ingreso pasivo del taller —');
const mI = S.money;
const nShops = S.buildings.filter(b => b.type === 'shop').length;
step(Math.ceil(D.SHOP_INCOME.every * 60) + 5);
assert(S.money >= mI + D.SHOP_INCOME.amount * nShops,
  'cada taller produce $' + D.SHOP_INCOME.amount + ' cada ' + D.SHOP_INCOME.every + 's');

console.log('— Manual de campo —');
byId.helpScreen.classList.add('hidden');   // estado inicial real del DOM
key('h');
assert(!byId.helpScreen.classList.contains('hidden') && S.paused,
  'abrir las instrucciones pausa la partida');
key('h');
assert(byId.helpScreen.classList.contains('hidden') && !S.paused,
  'cerrar las instrucciones reanuda el juego');

console.log('— Minas terrestres —');
byId.newBtn.click(); byId.newBtn.click();   // partida limpia
S.money = 500;
key('m');
canvasClick(2, 3);                          // (2,3) es camino
assert(S.mines.length === 1 && S.money === 500 - D.MINE.cost,
  'la mina se entierra en el camino y cuesta $' + D.MINE.cost);
canvasClick(2, 2);                          // pasto: rechazada
assert(S.mines.length === 1, 'fuera del camino no se puede enterrar');
canvasClick(2, 3);                          // tile ya minado: rechazada
assert(S.mines.length === 1, 'no se apilan dos minas en el mismo tile');
key('Escape');
const flier = G.spawnEnemy('wasp', 1, 0, S.mines[0].x, S.mines[0].y);
step(30);
assert(S.mines.length === 1, 'los voladores no la activan');
flier.dead = true; S.enemies.length = 0;
const stomper = G.spawnEnemy('scarab', 1, 0, S.mines[0].x - 30, S.mines[0].y);
const stompHp = stomper.hp;
for (let i = 0; i < 10 * 60 && S.mines.length; i++) step(1);
assert(S.mines.length === 0, 'el terrestre la pisa y detona');
assert(stomper.dead || stomper.hp <= stompHp - D.MINE.dmg,
  'el estallido ignora el blindaje del escarabajo');
S.enemies.length = 0;

console.log('— Cadenas contenidas: la onda enemiga remata pero no arrasa —');
byId.newBtn.click(); byId.newBtn.click();   // partida limpia
S.money += 2000;
const gA = buildB('gen', 5, 2);
const gB = buildB('gen', 7, 2);   // a 64 px: dentro del radio (70) de A
gA.hp = 1;
const kamiX = G.spawnEnemy('kamikaze', 1, 0, gA.x - 20, gA.y);
G.damageEnemy(kamiX, 99999);      // matarlo lo detona pegado a A
step(20);                          // la cadena tarda chainDelay en resolverse
assert(S.buildings.indexOf(gA) === -1,
  'la unidad rematada por el Detonador aún estalla');
const gBExp = D.BUILDINGS.gen.hp -
  Math.round(D.SELF_DESTRUCT.gen.dmg * D.SELF_DESTRUCT.enemyChainMul);
assert(S.buildings.indexOf(gB) !== -1 && Math.round(gB.hp) === gBExp,
  'la onda encadenada por bichos pega reducida: el vecino sobrevive (' +
  Math.round(gB.hp) + '/' + D.BUILDINGS.gen.hp + ')');
S.enemies.length = 0;

console.log('— Dificultad —');
S.diff = 'veterano';
S.wave = 1;
const vHard = G.spawnEnemy('drone', 1, 0, 100, 100);
assert(Math.abs(vHard.maxHp - D.ENEMIES.drone.hp * D.hpScale(1) *
  D.DIFFICULTIES.veterano.hpMul) < 0.001,
  'en VETERANO los bichos traen +55% de vida');
assert(vHard.bounty === Math.round(D.ENEMIES.drone.bounty * D.DIFFICULTIES.veterano.moneyMul),
  'y pagan recompensas recortadas');
S.enemies.length = 0;
S.diff = 'aprendiz';
S.wave = 0;

console.log('— Asedio sin fin —');
assert(G.waveDef(3) === D.WAVES[2], 'las 10 primeras oleadas siguen el guion');
assert(G.waveDef(15).some(g => g.t === 'boss'), 'cada 5 oleadas de asedio vuelve una Nodriza');
assert(G.waveDef(20).find(g => g.t === 'drone').n > G.waveDef(11).find(g => g.t === 'drone').n,
  'las oleadas del asedio crecen sin tope');
S.wave = 10; S.phase = 'won';
G.startEndless();
assert(S.endless && S.phase === 'build', 'tras la victoria el asedio reabre el portal');
byId.startBtn.click();
assert(S.phase === 'wave' && S.wave === 11 && S.spawnQueue.length > 0,
  'la oleada 11 se genera procedural');
const eliteFrom = D.ELITE.fromWave;
D.ELITE.fromWave = 999;   // sin élites aleatorias: medimos la rampa pura
const eEnd = G.spawnEnemy('drone', 1, 0, 50, 50);
D.ELITE.fromWave = eliteFrom;
assert(Math.abs(eEnd.maxHp - D.ENEMIES.drone.hp * D.hpScale(11) * D.ENDLESS_HP_RAMP) < 0.001,
  'la rampa del asedio endurece a los bichos');
S.enemies.length = 0; S.spawnQueue.length = 0;
step(1);
assert(S.phase === 'build' && G.getRecord() && G.getRecord().wave >= 11,
  'superar una oleada de asedio actualiza el récord');

console.log('— Récord —');
const rec0 = G.getRecord().wave;
G.saveRecord(rec0 - 1);
assert(G.getRecord().wave === rec0, 'un intento peor no pisa el récord');
G.saveRecord(rec0 + 9);
assert(G.getRecord().wave === rec0 + 9, 'una hazaña mayor sí lo mejora');

console.log('— Modo HORDA y jefes nuevos —');
S.mode = 'horde';
byId.newBtn.click(); byId.newBtn.click();
assert(S.money === D.HORDE.money && S.parts === D.HORDE.parts,
  'la HORDA arranca con los bolsillos llenos ($' + S.money + ', ' + S.parts + '⚙)');
assert(JSON.stringify(G.waveDef(1)) === JSON.stringify(G.waveDef(1)),
  'la oleada aleatoria es determinista: el radar anuncia lo que sale');
assert(G.waveDef(4).some(g => D.ENEMIES[g.t].boss),
  'cada 4 oleadas de horda cae un jefe');
const seen = {};
for (let n = 4; n <= 60; n += 4) {
  G.waveDef(n).forEach(g => { if (D.ENEMIES[g.t].boss) seen[g.t] = true; });
}
assert(seen.mantis && seen.worm,
  'la MANTIS y el GUSANO entran en la rotación de jefes');
byId.startBtn.click();
assert(S.phase === 'wave' && S.wave === 1 && S.spawnQueue.length > 0,
  'la horda lanza su primera oleada aleatoria');
S.spawnQueue.length = 0; S.enemies.length = 0;

// el GUSANO excava bajo los campos de fuerza
S.phase = 'build';
S.money += 800;
buildB('gen', 2, 5);              // energía para los pilones de la prueba
build('tesla', 2, 4);
build('tesla', 4, 4);
assert(S.fields.length === 1, 'campo de fuerza montado para la prueba');
// pilones indestructibles: que el gusano no pase a mordidas, sino excavando
S.towers.forEach(t => { t.hp = t.maxHp = 999999; });
const fieldX = S.fields[0].x, fieldY = S.fields[0].y;
const digger = G.spawnEnemy('worm', 1, 0, 40, fieldY);
let wormPassed = false;
for (let i = 0; i < 30 * 60; i++) {
  step(1);
  if (S.enemies.indexOf(digger) === -1) break;   // llegó o murió
  if (digger.x > fieldX + 20) { wormPassed = true; break; }
}
assert(wormPassed, 'el GUSANO pasa por debajo del campo de fuerza');
S.enemies.length = 0;
S.mode = 'campaign';

console.log('\nTODO OK — ' + passed + ' aserciones superadas.');
