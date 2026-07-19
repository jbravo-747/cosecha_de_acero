/* ==========================================================================
   COSECHA DE ACERO — ui.js
   Panel lateral, overlays e input (ratón + teclado). Habla con el motor
   solo a través de G; el estado de las pantallas de fin se sincroniza
   con S.phase cada frame.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.DATA, SP = window.SPRITES, AU = window.AUDIO;
  var G = window.G, S = G.S;
  var TILE = G.TILE;

  var canvas = document.getElementById('game');

  // ---------- referencias de UI ----------
  var el = {
    money: document.getElementById('money'),
    lives: document.getElementById('lives'),
    wave: document.getElementById('wave'),
    energy: document.getElementById('energy'),
    parts: document.getElementById('parts'),
    pauseBtn: document.getElementById('pauseBtn'),
    bombBtn: document.getElementById('bombBtn'),
    boomBtn: document.getElementById('boomBtn'),
    newBtn: document.getElementById('newBtn'),
    ctxPanel: document.getElementById('ctxPanel'),
    wavePrev: document.getElementById('wavePrev'),
    arsenalLabel: document.getElementById('arsenalLabel'),
    info: document.getElementById('info'),
    towerBtns: document.getElementById('towerBtns'),
    upBtn: document.getElementById('upBtn'),
    sellBtn: document.getElementById('sellBtn'),
    startBtn: document.getElementById('startBtn'),
    speedBtn: document.getElementById('speedBtn'),
    muteBtn: document.getElementById('muteBtn'),
    title: document.getElementById('title'),
    endScreen: document.getElementById('endScreen'),
    endTitle: document.getElementById('endTitle'),
    endText: document.getElementById('endText'),
    playBtn: document.getElementById('playBtn'),
    continueBtn: document.getElementById('continueBtn'),
    restartBtn: document.getElementById('restartBtn'),
    titleArt: document.getElementById('titleArt')
  };

  // arte del título: el mecha COYOTE a 3x
  (function () {
    var g = el.titleArt.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(SP.mechs.mg, 0, 4, 48, 39);
  })();

  // botones de torre, edificio y unidad
  var towerBtnEls = {};
  var hoverCard = null;   // {kind, key} de la tarjeta bajo el ratón (ficha técnica)
  function makeBtn(kind, key, def, sprite, hotkey, onClick) {
    var b = document.createElement('button');
    b.className = 'tbtn';
    var mini = document.createElement('canvas');
    mini.width = 16; mini.height = 16;
    var mg = mini.getContext('2d');
    mg.imageSmoothingEnabled = false;
    mg.drawImage(sprite, 0, 1, 16, 14);
    b.appendChild(mini);
    var lbl = document.createElement('div');
    lbl.innerHTML = def.name + '<br><span class="cost">$' + def.cost +
      '</span> <span class="key">[' + hotkey + ']</span>';
    b.appendChild(lbl);
    b.addEventListener('click', onClick);
    b.addEventListener('mouseenter', function () { hoverCard = { kind: kind, key: key }; });
    b.addEventListener('mouseleave', function () {
      if (hoverCard && hoverCard.key === key) hoverCard = null;
    });
    el.towerBtns.appendChild(b);
    towerBtnEls[key] = b;
  }
  D.TOWER_ORDER.forEach(function (key, i) {
    makeBtn('tower', key, D.TOWERS[key], SP.mechs[key], i + 1,
      function () { G.startPlacing(key); });
  });
  D.BUILDING_ORDER.forEach(function (key, i) {
    makeBtn('building', key, D.BUILDINGS[key], SP.buildings[key], i + 6,
      function () { G.startPlacing(key); });
  });
  D.UNIT_ORDER.forEach(function (key, i) {
    makeBtn('unit', key, D.UNITS[key], SP.units[key][0], i + 8,
      function () { G.buyUnit(key); });
  });

  // ficha técnica de una tarjeta del arsenal (se muestra en el monitor)
  function cardInfo(kind, key) {
    if (kind === 'tower') {
      var d = D.TOWERS[key];
      var dps = d.rof > 0 ? Math.round(d.dmg / d.rof) : d.dmg;
      return '<span class="name">' + d.name + '</span> — $' + d.cost +
        ' &middot; Consumo: <b>' + d.energy + ' ⚡</b>' +
        '<br>Daño: <b>' + d.dmg + '</b> &middot; DPS: <b>~' + dps +
        '</b> &middot; Rango: <b>' + d.range + '</b>' +
        '<br>Vida: <b>' + d.hp + '</b> &middot; ' +
        (d.ammo > 0 ? 'Munici&oacute;n: <b>' + d.ammo + '</b>'
          : 'Mel&eacute; puro: <b>sin munici&oacute;n</b>') +
        ' &middot; Paso: <b>' + d.move + '</b>' +
        '<br><span class="desc">' + d.desc + '</span>';
    }
    if (kind === 'building') {
      var bd = D.BUILDINGS[key];
      return '<span class="name">' + bd.name + '</span> — $' + bd.cost +
        '<br>Vida: <b>' + bd.hp + '</b>' +
        (bd.energy
          ? ' &middot; Energía: <b>+' + bd.energy + ' ⚡</b> (radio ' + bd.powerRange + ')'
          : ' &middot; Descuento de mejora: <b>' + Math.round(D.SHOP_DISCOUNT * 100) +
            '%</b> por taller extra') +
        '<br><span class="desc">' + bd.desc + '</span>';
    }
    var ud = D.UNITS[key];
    return '<span class="name">' + ud.name + '</span> — $' + ud.cost +
      '<br>Vida: <b>' + ud.hp + '</b> &middot; Velocidad: <b>' + ud.speed + '</b>' +
      (ud.atkDmg ? ' &middot; Metralla: <b>' + ud.atkDmg + '</b> (' + ud.ammo + ' balas)' : '') +
      '<br><span class="desc">' + ud.desc + '</span>';
  }

  // ---------- radar de oleada ----------
  var prevWaveBuilt = -2;   // oleada montada en el radar (-1 = modo "en curso")
  function buildWavePreview() {
    var counts = {}, order = [];
    D.WAVES[S.wave].forEach(function (grp) {
      if (!counts[grp.t]) { counts[grp.t] = 0; order.push(grp.t); }
      counts[grp.t] += grp.n;
    });
    el.wavePrev.innerHTML = '';
    var lbl = document.createElement('span');
    lbl.className = 'wlabel';
    lbl.textContent = '◆ PRÓXIMA OLEADA ' + (S.wave + 1) + ':';
    el.wavePrev.appendChild(lbl);
    order.forEach(function (t) {
      var s = document.createElement('span');
      s.className = 'wbug';
      s.title = D.ENEMIES[t].name;
      var spr = SP.enemies[t][0];
      var c = document.createElement('canvas');
      c.width = 22; c.height = 22;
      var g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      var sc = Math.min(1, 22 / Math.max(spr.width, spr.height));
      var w = Math.round(spr.width * sc), h = Math.round(spr.height * sc);
      g.drawImage(spr, (22 - w) >> 1, (22 - h) >> 1, w, h);
      s.appendChild(c);
      s.appendChild(document.createTextNode('×' + counts[t]));
      el.wavePrev.appendChild(s);
    });
    var wv = S.wave + 1;
    if (counts.boss) {
      var wb = document.createElement('span');
      wb.className = 'wwarn';
      wb.textContent = '⚠ ¡LA NODRIZA!';
      el.wavePrev.appendChild(wb);
    }
    if (wv >= D.ELITE.fromWave) {
      var pct = Math.round(Math.min(D.ELITE.chanceMax,
        (wv - D.ELITE.fromWave + 1) * D.ELITE.chance) * 100);
      var we = document.createElement('span');
      we.className = 'wwarn';
      we.textContent = '⚠ élites ~' + pct + '%';
      el.wavePrev.appendChild(we);
    }
  }
  function updateWavePreview() {
    if (S.phase === 'build' && S.wave < D.WAVES.length) {
      if (prevWaveBuilt !== S.wave) { prevWaveBuilt = S.wave; buildWavePreview(); }
      el.wavePrev.classList.remove('hidden');
    } else if (S.phase === 'wave') {
      if (prevWaveBuilt !== -1) {
        prevWaveBuilt = -1;
        el.wavePrev.innerHTML = '<span class="wlabel">◆ OLEADA ' + S.wave +
          ' EN CURSO</span><span class="wcount"></span>';
      }
      var cnt = el.wavePrev.querySelector('.wcount');
      if (cnt) cnt.textContent = 'bichos restantes: ' + (S.enemies.length + S.spawnQueue.length);
      el.wavePrev.classList.remove('hidden');
    } else {
      el.wavePrev.classList.add('hidden');
    }
  }

  // ---------- pantallas de fin (sincronizadas con S.phase) ----------
  var lastPhase = null;
  function syncEndScreen() {
    if (S.phase === lastPhase) return;
    lastPhase = S.phase;
    if (S.phase === 'won') {
      el.endTitle.textContent = 'GRANJA SALVADA';
      el.endTitle.classList.remove('bad');
      el.endText.innerHTML = 'La Nodriza cayó y los bichos volvieron a su agujero.<br>' +
        'La cosecha está a salvo... por esta temporada.<br><br>Vidas restantes: ' + S.lives;
      el.endScreen.classList.remove('hidden');
    } else if (S.phase === 'lost') {
      el.endTitle.textContent = 'GRANJA PERDIDA';
      el.endTitle.classList.add('bad');
      el.endText.innerHTML = 'Los bichos llegaron al granero en la oleada ' + S.wave +
        '.<br>Habrá que volver a empezar desde el refugio.';
      el.endScreen.classList.remove('hidden');
    } else {
      el.endScreen.classList.add('hidden');
    }
  }

  // ---------- panel lateral ----------
  function updateUI() {
    syncEndScreen();
    updateWavePreview();
    el.money.textContent = S.money;
    el.lives.textContent = S.lives;
    el.wave.textContent = S.wave + '/' + D.WAVES.length;
    el.energy.textContent = S.energyUsed + '/' + S.energyCap;
    el.parts.textContent = S.parts;
    el.startBtn.disabled = S.phase !== 'build';
    if (S.phase === 'build' && S.wave < D.WAVES.length) {
      el.startBtn.innerHTML = '&#9654; DESACTIVAR DISRUPTOR (' +
        Math.max(0, Math.ceil(S.buildT)) + 's) [Espacio]';
    } else if (S.phase === 'wave') {
      el.startBtn.innerHTML = 'OLEADA EN CURSO...';
    }
    el.pauseBtn.innerHTML = S.paused ? '&#9654; SEGUIR [P]' : '&#10074;&#10074; PAUSA [P]';
    if (G._newBtnLabel) G._newBtnLabel();

    // especial: bombardeo
    if (S.bombCd > 0) {
      el.bombBtn.innerHTML = '&#9762; RECARGANDO (' + Math.ceil(S.bombCd) + 's)';
      el.bombBtn.disabled = true;
    } else {
      el.bombBtn.innerHTML = S.aimingBomb
        ? '&#9762; APUNTA Y HAZ CLIC... [Esc]'
        : '&#9762; BOMBARDEO $' + D.BOMB.cost + ' + ' + D.BOMB.parts + '&#9881; [B]';
      el.bombBtn.disabled = S.money < D.BOMB.cost || S.parts < D.BOMB.parts ||
        (S.phase !== 'build' && S.phase !== 'wave');
    }
    el.bombBtn.classList.toggle('aiming', S.aimingBomb);

    // menú contextual: al seleccionar algo, el arsenal cede su lugar
    var sel = S.selectedU || S.selectedB || S.selected;
    el.towerBtns.classList.toggle('hidden', !!sel);
    el.ctxPanel.classList.toggle('hidden', !sel);
    if (sel) {
      var selDef = S.selectedU ? D.UNITS[sel.type]
        : S.selectedB ? D.BUILDINGS[sel.type] : D.TOWERS[sel.type];
      el.arsenalLabel.innerHTML = '&#9670; CONTROL: ' + selDef.name + ' &#9670;';
      el.boomBtn.innerHTML = S.confirmBoom > 0
        ? '&#9760; ¿CONFIRMAR DETONACI&Oacute;N?'
        : '&#9760; AUTODESTRUCCI&Oacute;N';
      el.boomBtn.classList.toggle('confirm', S.confirmBoom > 0);
    } else {
      el.arsenalLabel.innerHTML = '&#9670; ARSENAL &#9670;';
    }

    D.TOWER_ORDER.forEach(function (key) {
      var def = D.TOWERS[key], b = towerBtnEls[key];
      b.classList.toggle('sel', S.placing === key);
      b.classList.toggle('poor', S.money < def.cost || !G.shopAlive() ||
        S.energyUsed + def.energy > S.energyCap);
    });
    D.BUILDING_ORDER.forEach(function (key) {
      var b = towerBtnEls[key];
      b.classList.toggle('sel', S.placing === key);
      b.classList.toggle('poor', S.money < D.BUILDINGS[key].cost);
    });
    D.UNIT_ORDER.forEach(function (key) {
      towerBtnEls[key].classList.toggle('poor', S.money < D.UNITS[key].cost);
    });

    if (S.selectedU) {
      var un = S.selectedU, udef = D.UNITS[un.type];
      el.info.innerHTML =
        '<span class="name">' + udef.name + '</span> — vida <b>' + Math.max(0, Math.ceil(un.hp)) +
        '/' + un.maxHp + '</b>' +
        (un.type === 'drone'
          ? '<br>Modo: <b>' + (un.mode === 'attack' ? 'ATAQUE' : 'RECARGA') + '</b>' +
            (un.mode === 'attack' ? ' &middot; Munici&oacute;n: <b>' + un.ammo + '</b>' +
              '<br><span class="desc">Haz clic en el mapa para reposicionarlo.</span>' : '')
          : '') +
        '<br><span class="desc">' + udef.desc + '</span>';
      el.upBtn.disabled = un.type !== 'drone';
      el.upBtn.textContent = un.type === 'drone'
        ? 'MODO: ' + (un.mode === 'attack' ? 'RECARGA' : 'ATAQUE') : 'MEJORAR';
      el.sellBtn.disabled = false;
      el.sellBtn.textContent = 'VENDER $' + Math.round(un.invested * D.SELL_FACTOR);
    } else if (S.selectedB) {
      var bl = S.selectedB, bdef = D.BUILDINGS[bl.type];
      var intact = bl.hp >= bl.maxHp;
      var canTurret = bl.type === 'shop' && !bl.turret && intact;
      el.info.innerHTML =
        '<span class="name">' + bdef.name + '</span> — vida <b>' + Math.max(0, Math.ceil(bl.hp)) +
        '/' + bl.maxHp + '</b>' +
        (bdef.energy ? '<br>Energía: <b>+' + bdef.energy + ' ⚡</b>'
          : '<br>Descuento de mejora: <b>' + Math.round(G.upgradeDiscount() * 100) +
            '%</b> (talleres: ' + G.shopCount() + ')') +
        (bl.turret ? '<br>Torreta: <b>instalada</b>' : '') +
        '<br><span class="desc">' + bdef.desc + '</span>';
      if (canTurret) {
        el.upBtn.disabled = S.money < D.SHOP_TURRET.cost || S.parts < D.SHOP_TURRET.parts;
        el.upBtn.textContent = 'TORRETA $' + D.SHOP_TURRET.cost + ' + ' + D.SHOP_TURRET.parts + '⚙';
      } else {
        el.upBtn.disabled = intact || S.money < G.repairCost(bl);
        el.upBtn.textContent = intact
          ? (bl.turret ? 'TORRETA LISTA' : 'INTACTO')
          : 'REPARAR $' + G.repairCost(bl);
      }
      el.sellBtn.disabled = false;
      el.sellBtn.textContent = 'VENDER $' + Math.round(bl.invested * D.SELL_FACTOR);
    } else if (S.selected) {
      var t = S.selected, def = D.TOWERS[t.type], st = G.towerStats(t);
      var maxed = t.level >= D.MAX_LEVEL;
      var uParts = G.upgradeParts(t);
      el.info.innerHTML =
        '<span class="name">' + def.name + '</span> — nivel ' + t.level + '/' + D.MAX_LEVEL +
        (t.offline ? ' <span style="color:var(--red)">SIN ⚡</span>' : '') +
        '<br>Daño: <b>' + st.dmg + '</b> &middot; Rango: <b>' + st.range + '</b>' +
        ' &middot; Vida: <b>' + Math.max(0, Math.ceil(t.hp)) + '/' + t.maxHp + '</b>' +
        '<br>' + (st.maxAmmo > 0
          ? 'Munici&oacute;n: <b>' + t.ammo + '/' + st.maxAmmo + '</b>'
          : 'Melé puro: <b>sin munici&oacute;n</b>') +
        ' &middot; Paso: <b>' + def.move + '</b>' +
        (t.moveCd > 0 ? ' (' + Math.ceil(t.moveCd) + 's)' : '') +
        '<br><span class="desc">' + def.desc +
        ' Clic en un tile iluminado para moverlo.</span>';
      el.upBtn.disabled = maxed || S.money < G.upgradeCost(t) || S.parts < uParts || !G.shopAlive();
      el.upBtn.textContent = maxed ? 'NIVEL MÁX.'
        : 'MEJORAR $' + G.upgradeCost(t) + ' + ' + uParts + '⚙';
      el.sellBtn.disabled = false;
      el.sellBtn.textContent = 'VENDER $' + Math.round(t.invested * D.SELL_FACTOR);
    } else if (S.placing && G.isBldgKey(S.placing)) {
      var pbdef = D.BUILDINGS[S.placing];
      el.info.innerHTML =
        '<span class="name">' + pbdef.name + '</span> — $' + pbdef.cost +
        '<br>Vida: <b>' + pbdef.hp + '</b>' +
        (pbdef.energy ? ' &middot; Energía: <b>+' + pbdef.energy + ' ⚡</b>' : '') +
        '<br><span class="desc">' + pbdef.desc + ' Col&oacute;calo en un tile iluminado.</span>';
      el.upBtn.disabled = true; el.upBtn.textContent = 'MEJORAR';
      el.sellBtn.disabled = true; el.sellBtn.textContent = 'VENDER';
    } else if (S.placing) {
      var pdef = D.TOWERS[S.placing];
      el.info.innerHTML =
        '<span class="name">' + pdef.name + '</span> — $' + pdef.cost +
        '<br>Daño: <b>' + pdef.dmg + '</b> &middot; Rango: <b>' + pdef.range +
        '</b> &middot; Consumo: <b>' + pdef.energy + ' ⚡</b>' +
        '<br><span class="desc">' + pdef.desc + ' Haz clic en el pasto para colocar.</span>';
      el.upBtn.disabled = true; el.upBtn.textContent = 'MEJORAR';
      el.sellBtn.disabled = true; el.sellBtn.textContent = 'VENDER';
    } else if (hoverCard) {
      el.info.innerHTML = cardInfo(hoverCard.kind, hoverCard.key);
      el.upBtn.disabled = true; el.upBtn.textContent = 'MEJORAR';
      el.sellBtn.disabled = true; el.sellBtn.textContent = 'VENDER';
    } else {
      el.info.innerHTML = '<span class="desc">Mechas [1-5], edificios [6-7] y unidades [8-9]. ' +
        'Los mechas gastan munici&oacute;n y pelean cuerpo a cuerpo si los rodean. ' +
        'Dos CERCA-9 flanqueando el camino crean un campo de fuerza. ' +
        'Selecciona un mecha y sigue las flechas para moverlo.</span>';
      el.upBtn.disabled = true; el.upBtn.textContent = 'MEJORAR';
      el.sellBtn.disabled = true; el.sellBtn.textContent = 'VENDER';
    }
  }

  // ---------- input ----------
  function canvasPos(ev) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) * (canvas.width / rect.width),
      y: (ev.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  canvas.addEventListener('mousemove', function (ev) {
    var p = canvasPos(ev);
    S.hover = { c: (p.x / TILE) | 0, r: (p.y / TILE) | 0 };
    S.hoverPx = { x: p.x, y: p.y };
  });
  canvas.addEventListener('mouseleave', function () { S.hover = null; S.hoverPx = null; });

  // un clic de ratón y un toque en pantalla comparten la misma lógica
  function handleTap(p) {
    if (S.phase !== 'build' && S.phase !== 'wave') return;
    var c = (p.x / TILE) | 0, r = (p.y / TILE) | 0;
    if (S.aimingBomb) { G.dropBomb(p.x, p.y); return; }
    if (S.placing) { G.tryBuild(c, r); return; }
    // orden de movimiento al mecha seleccionado (tiles iluminados)
    if (S.selected && G.tryMove(S.selected, c, r)) return;
    // reposicionar al dron de ataque seleccionado (vuela a donde sea)
    if (S.selectedU && S.selectedU.type === 'drone' && S.selectedU.mode === 'attack' &&
        !G.unitNear(p.x, p.y, 18)) {
      S.selectedU.post = { x: p.x, y: p.y };
      AU.click();
      return;
    }
    var u = G.unitNear(p.x, p.y, 18);
    var t = u ? null : G.towerAt(c, r);
    var b = u || t ? null : G.buildingAt(c, r);
    S.selectedU = u || null;
    S.selected = t || null;
    S.selectedB = b || null;
    if (u || t || b) AU.click();
  }

  canvas.addEventListener('click', function (ev) { handleTap(canvasPos(ev)); });

  // táctil: arrastrar el dedo apunta (previsualiza colocación / diana del
  // bombardeo) y soltar ejecuta el toque. preventDefault evita el clic
  // sintético del navegador y el desplazamiento de la página.
  canvas.addEventListener('touchstart', function (ev) {
    ev.preventDefault();
    var p = canvasPos(ev.touches[0]);
    S.hover = { c: (p.x / TILE) | 0, r: (p.y / TILE) | 0 };
    S.hoverPx = { x: p.x, y: p.y };
  }, { passive: false });
  canvas.addEventListener('touchmove', function (ev) {
    ev.preventDefault();
    var p = canvasPos(ev.touches[0]);
    S.hover = { c: (p.x / TILE) | 0, r: (p.y / TILE) | 0 };
    S.hoverPx = { x: p.x, y: p.y };
  }, { passive: false });
  canvas.addEventListener('touchend', function (ev) {
    ev.preventDefault();
    if (S.hoverPx) handleTap(S.hoverPx);
  }, { passive: false });

  canvas.addEventListener('contextmenu', function (ev) {
    ev.preventDefault();
    G.cancelActions();
  });

  document.addEventListener('keydown', function (ev) {
    if (S.phase === 'menu') return;
    var k = ev.key;
    if (k === ' ') { ev.preventDefault(); G.startWave(true); }
    else if (k === 'Escape') G.cancelActions();
    else if (k === 'p' || k === 'P') S.paused = !S.paused;
    else if (k >= '1' && k <= '5') G.startPlacing(D.TOWER_ORDER[+k - 1]);
    else if (k === '6' || k === '7') G.startPlacing(D.BUILDING_ORDER[+k - 6]);
    else if (k === '8' || k === '9') G.buyUnit(D.UNIT_ORDER[+k - 8]);
    else if (k === 'b' || k === 'B') G.armBomb();
  });
  el.bombBtn.addEventListener('click', function () { G.armBomb(); });
  el.boomBtn.addEventListener('click', function () {
    if (!(S.selected || S.selectedB || S.selectedU)) return;
    if (S.confirmBoom > 0) {
      G.selfDestructSelected();
    } else {
      S.confirmBoom = 3;   // pide confirmación durante 3 segundos
      AU.click();
    }
  });

  el.upBtn.addEventListener('click', function () {
    if (S.selectedU) G.toggleUnitMode();
    else if (S.selectedB) {
      var bl = S.selectedB;
      if (bl.type === 'shop' && !bl.turret && bl.hp >= bl.maxHp) G.upgradeShopTurret();
      else G.repairSelectedB();
    }
    else G.upgradeSelected();
  });
  el.sellBtn.addEventListener('click', function () {
    if (S.selectedU) G.sellSelectedU();
    else if (S.selectedB) G.sellSelectedB();
    else G.sellSelected();
  });
  el.startBtn.addEventListener('click', function () { G.startWave(true); });
  el.pauseBtn.addEventListener('click', function () {
    S.paused = !S.paused;
    AU.click();
  });
  el.speedBtn.addEventListener('click', function () {
    S.speed = S.speed === 1 ? 2 : 1;
    el.speedBtn.innerHTML = '&times;' + S.speed;
    AU.click();
  });
  el.muteBtn.addEventListener('click', function () {
    var m = AU.toggleMute();
    el.muteBtn.innerHTML = m ? '&#9834; SILENCIO' : '&#9835;';
  });
  el.playBtn.addEventListener('click', function () {
    AU.unlock();
    G.clearSave();               // partida nueva desde el título
    S.phase = 'build';
    el.title.classList.add('hidden');
    AU.horn();
  });
  // reanudar la partida guardada
  if (G.hasSave()) el.continueBtn.classList.remove('hidden');
  el.continueBtn.addEventListener('click', function () {
    AU.unlock();
    if (G.loadGame()) {
      el.title.classList.add('hidden');
      AU.horn();
    }
  });
  el.restartBtn.addEventListener('click', function () {
    G.clearSave();
    G.resetState();
    S.phase = 'build';
    el.endScreen.classList.add('hidden');
    AU.click();
  });

  // nueva partida en caliente, con confirmación de 3 segundos
  var confirmNewUntil = 0;
  el.newBtn.addEventListener('click', function () {
    if (S.phase === 'menu') return;
    if (performance.now() < confirmNewUntil) {
      confirmNewUntil = 0;
      G.clearSave();
      G.resetState();
      S.phase = 'build';
      el.endScreen.classList.add('hidden');
      AU.horn();
    } else {
      confirmNewUntil = performance.now() + 3000;
      AU.click();
    }
  });
  G._newBtnLabel = function () {
    el.newBtn.innerHTML = performance.now() < confirmNewUntil
      ? '&#8635; ¿REINICIAR TODO?'
      : '&#8635; NUEVA PARTIDA';
  };

  G.updateUI = updateUI;
})();
