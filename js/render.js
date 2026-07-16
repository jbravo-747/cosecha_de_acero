/* ==========================================================================
   COSECHA DE ACERO — render.js
   Fondo pre-horneado y dibujado de cada frame sobre el canvas.
   ========================================================================== */
(function () {
  'use strict';

  var D = window.DATA, SP = window.SPRITES;
  var G = window.G, S = G.S;
  var W = G.W, H = G.H, TILE = G.TILE, COLS = G.COLS, ROWS = G.ROWS;
  var pathCells = G.pathCells;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---------- fondo pre-horneado ----------
  var bg = document.createElement('canvas');
  bg.width = W; bg.height = H;
  (function bakeBG() {
    var g = bg.getContext('2d');
    g.imageSmoothingEnabled = false;
    var r, c, k;
    for (r = 0; r < ROWS; r++) {
      for (c = 0; c < COLS; c++) {
        k = c + ',' + r;
        var t;
        if (pathCells[k]) t = SP.tiles.path[(c * 7 + r * 13) % SP.tiles.path.length];
        else t = SP.tiles.grass[(c * 5 + r * 11) % SP.tiles.grass.length];
        g.drawImage(t, 0, 0, 16, 16, c * TILE, r * TILE, TILE, TILE);
      }
    }
    D.CROPS.forEach(function (t) {
      g.drawImage(SP.crop, 0, 0, 16, 16, t[0] * TILE, t[1] * TILE, TILE, TILE);
    });
    D.FENCES.forEach(function (t) {
      g.drawImage(SP.fence, t[0] * TILE, t[1] * TILE + 6, TILE, SP.fence.height * 2);
    });
    D.ROCKS.forEach(function (t) {
      g.drawImage(SP.rock, t[0] * TILE, t[1] * TILE + 7, TILE, SP.rock.height * 2);
    });
    // agujero de spawn (oeste)
    g.drawImage(SP.hole, -24, 3 * TILE - 10, SP.hole.width * 2, SP.hole.height * 2);
    // granero (este)
    g.drawImage(SP.barn, 574, 4 * TILE + 4, SP.barn.width * 2, SP.barn.height * 2);
  })();

  // ---------- piezas ----------
  function drawGun(t) {
    var def = D.TOWERS[t.type];
    if (def.proj === 'chain') return; // el pilón no tiene cañón
    ctx.save();
    ctx.translate(t.x, t.y - 6);
    ctx.rotate(t.angle);
    ctx.fillStyle = '#12100e';
    if (t.type === 'cannon') {
      ctx.fillRect(0, -4, 18, 8);
      ctx.fillStyle = '#454c52'; ctx.fillRect(0, -3, 16, 6);
      ctx.fillStyle = '#2b3238'; ctx.fillRect(12, -3, 4, 6);
    } else if (t.type === 'sniper') {
      ctx.fillRect(0, -2, 24, 4);
      ctx.fillStyle = '#35506b'; ctx.fillRect(0, -1, 22, 2);
    } else {
      ctx.fillRect(0, -3, 14, 6);
      ctx.fillStyle = '#454c52'; ctx.fillRect(0, -2, 12, 4);
    }
    if (t.flash > 0) {
      ctx.fillStyle = '#f2d94e';
      var fl = t.type === 'cannon' ? 6 : 4;
      ctx.fillRect(t.type === 'sniper' ? 22 : (t.type === 'cannon' ? 16 : 12), -fl / 2, fl, fl);
    }
    ctx.restore();
  }

  function zigzag(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    var segs = 5, dx = (x2 - x1) / segs, dy = (y2 - y1) / segs;
    for (var i = 1; i < segs; i++) {
      ctx.lineTo(x1 + dx * i + (Math.random() * 10 - 5),
                 y1 + dy * i + (Math.random() * 10 - 5));
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // ---------- frame completo ----------
  function render() {
    ctx.save();
    if (S.shake > 0) {
      ctx.translate((Math.random() * 6 - 3) * S.shake, (Math.random() * 6 - 3) * S.shake);
    }
    ctx.drawImage(bg, 0, 0);

    var i;

    // manchas de bicho y escombros
    for (i = 0; i < S.decals.length; i++) {
      var dc = S.decals[i];
      ctx.globalAlpha = Math.min(0.45, dc.life / 8);
      ctx.fillStyle = dc.rubble ? '#454c52' : '#5f9926';
      ctx.beginPath();
      ctx.arc(dc.x, dc.y, dc.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // al colocar un edificio, se iluminan los tiles válidos junto al camino
    if (S.placing && G.isBldgKey(S.placing)) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#6ab0e8';
      for (var vr = 0; vr < ROWS; vr++) {
        for (var vc = 0; vc < COLS; vc++) {
          if (G.canBuild(vc, vr) && G.nearPath(vc, vr)) {
            ctx.fillRect(vc * TILE + 1, vr * TILE + 1, TILE - 2, TILE - 2);
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    // rango de torre seleccionada / en colocación
    var rangeShow = null;
    if (S.selected) {
      rangeShow = { x: S.selected.x, y: S.selected.y, r: G.towerStats(S.selected).range, ok: true };
    } else if (S.placing && S.hover && !G.isBldgKey(S.placing)) {
      var hdef = D.TOWERS[S.placing];
      rangeShow = {
        x: S.hover.c * TILE + TILE / 2, y: S.hover.r * TILE + TILE / 2,
        r: hdef.range, ok: G.canBuild(S.hover.c, S.hover.r)
      };
    } else if (S.placing && S.hover) {
      // marco del tile para edificios
      var okB = G.canBuild(S.hover.c, S.hover.r) && G.nearPath(S.hover.c, S.hover.r);
      ctx.strokeStyle = okB ? '#9ee34a' : '#e05545';
      ctx.strokeRect(S.hover.c * TILE + 1.5, S.hover.r * TILE + 1.5, TILE - 3, TILE - 3);
    }
    if (rangeShow) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = rangeShow.ok ? '#9ee34a' : '#e05545';
      ctx.beginPath(); ctx.arc(rangeShow.x, rangeShow.y, rangeShow.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.beginPath(); ctx.arc(rangeShow.x, rangeShow.y, rangeShow.r, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // edificios de apoyo
    for (i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      var bspr = SP.buildings[b.type];
      if (b.flash > 0) {
        ctx.globalAlpha = 0.6 + 0.4 * Math.random();  // parpadea al recibir daño
      }
      ctx.drawImage(bspr, b.x - 16, b.r * TILE + TILE - 2 - bspr.height * 2, 32, bspr.height * 2);
      ctx.globalAlpha = 1;
      // barra de vida del edificio
      if (b.hp < b.maxHp) {
        var bhw = 22;
        ctx.fillStyle = '#12100e';
        ctx.fillRect(b.x - bhw / 2 - 1, b.r * TILE - 6, bhw + 2, 4);
        ctx.fillStyle = b.hp / b.maxHp > 0.4 ? '#8ac94a' : '#e05545';
        ctx.fillRect(b.x - bhw / 2, b.r * TILE - 5, bhw * Math.max(0, b.hp / b.maxHp), 2);
      }
      if (b === S.selectedB) {
        ctx.strokeStyle = '#f2d94e';
        ctx.strokeRect(b.c * TILE + 1.5, b.r * TILE + 1.5, TILE - 3, TILE - 3);
      }
    }

    // torres
    for (i = 0; i < S.towers.length; i++) {
      var t = S.towers[i];
      var spr = SP.mechs[t.type];
      if (t.offline) ctx.globalAlpha = 0.45;
      ctx.drawImage(spr, t.x - 16, t.r * TILE + TILE - 2 - spr.height * 2, 32, spr.height * 2);
      ctx.globalAlpha = 1;
      if (t.offline) {
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#e05545';
        ctx.fillText('SIN ⚡', t.x, t.y - 20);
        ctx.textAlign = 'left';
      }
      drawGun(t);
      // pips de nivel
      for (var lv = 1; lv < t.level; lv++) {
        ctx.fillStyle = '#f2d94e';
        ctx.fillRect(t.x - 14 + (lv - 1) * 6, t.y + 11, 4, 4);
        ctx.strokeStyle = '#12100e';
        ctx.strokeRect(t.x - 14 + (lv - 1) * 6 - 0.5, t.y + 10.5, 5, 5);
      }
      if (t === S.selected) {
        ctx.strokeStyle = '#f2d94e';
        ctx.strokeRect(t.c * TILE + 1.5, t.r * TILE + 1.5, TILE - 3, TILE - 3);
      }
      // aura del pilón tesla
      if (t.type === 'tesla' && t.flash > 0) {
        ctx.strokeStyle = '#f2d94e';
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(t.x, t.y - 14, 8, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // enemigos
    var drawScale = { drone: 1.5, wasp: 1.5, spitter: 1.8, scarab: 2, boss: 2 };
    var bossAlive = null;
    for (i = 0; i < S.enemies.length; i++) {
      var e = S.enemies[i];
      var frames = SP.enemies[e.def.sprite];
      var fr = frames[((e.animT * 8) | 0) % 2];
      var sc = drawScale[e.type];
      var dw = fr.width * sc, dh = fr.height * sc;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.angle + Math.PI / 2);
      if (e.slowT > 0) { ctx.globalAlpha = 0.85; }
      ctx.drawImage(fr, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
      ctx.globalAlpha = 1;
      // barra de vida
      if (e.hp < e.maxHp && e.type !== 'boss') {
        var bw = 16;
        ctx.fillStyle = '#12100e';
        ctx.fillRect(e.x - bw / 2 - 1, e.y - dh / 2 - 6, bw + 2, 4);
        ctx.fillStyle = e.slowT > 0 ? '#6ab0e8' : '#8ac94a';
        ctx.fillRect(e.x - bw / 2, e.y - dh / 2 - 5, bw * (e.hp / e.maxHp), 2);
      }
      if (e.type === 'boss') bossAlive = e;
    }

    // proyectiles
    for (i = 0; i < S.projectiles.length; i++) {
      var p = S.projectiles[i];
      if (p.kind === 'shell') {
        ctx.fillStyle = '#12100e';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#454c52';
        ctx.beginPath(); ctx.arc(p.x - 0.5, p.y - 0.5, 2.2, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#f2d94e';
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      }
    }

    // efectos (rayos y trazadoras)
    for (i = 0; i < S.effects.length; i++) {
      var fx = S.effects[i];
      ctx.globalAlpha = Math.min(1, fx.life * 8);
      if (fx.kind === 'zap') {
        ctx.strokeStyle = '#9ee34a'; ctx.lineWidth = 2;
        zigzag(fx.x1, fx.y1, fx.x2, fx.y2);
        ctx.strokeStyle = '#e8f8c0'; ctx.lineWidth = 1;
        zigzag(fx.x1, fx.y1, fx.x2, fx.y2);
      } else {
        ctx.strokeStyle = '#f2d94e'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(fx.x1, fx.y1); ctx.lineTo(fx.x2, fx.y2); ctx.stroke();
      }
      ctx.lineWidth = 1;
    }
    ctx.globalAlpha = 1;

    // partículas
    for (i = 0; i < S.particles.length; i++) {
      var pt = S.particles[i];
      ctx.globalAlpha = Math.min(1, pt.life * 3);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // fantasma de colocación
    if (S.placing && S.hover) {
      var gs = G.isBldgKey(S.placing) ? SP.buildings[S.placing] : SP.mechs[S.placing];
      ctx.globalAlpha = 0.6;
      ctx.drawImage(gs, S.hover.c * TILE, S.hover.r * TILE + TILE - 2 - gs.height * 2,
        32, gs.height * 2);
      ctx.globalAlpha = 1;
    }

    // textos flotantes
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    for (i = 0; i < S.floaters.length; i++) {
      var f = S.floaters[i];
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = '#12100e';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // barra de vida del jefe
    if (bossAlive) {
      var bwid = 300;
      ctx.fillStyle = 'rgba(10,10,14,.75)';
      ctx.fillRect(W / 2 - bwid / 2 - 4, 6, bwid + 8, 18);
      ctx.fillStyle = '#2e1442';
      ctx.fillRect(W / 2 - bwid / 2, 10, bwid, 8);
      ctx.fillStyle = '#c65fd1';
      ctx.fillRect(W / 2 - bwid / 2, 10, bwid * Math.max(0, bossAlive.hp / bossAlive.maxHp), 8);
      ctx.fillStyle = '#e8e0cc';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('NODRIZA', W / 2, 33);
    }

    // aviso del disruptor durante la fase de construcción
    if (S.phase === 'build' && S.wave < D.WAVES.length) {
      var secs = Math.max(0, Math.ceil(S.buildT));
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = secs <= 5 ? '#e05545' : 'rgba(232,224,204,.85)';
      ctx.fillText('DISRUPTOR ACTIVO — el portal se abre en ' + secs +
        's · [Espacio] lo desactiva ya', W / 2, H - 10);
    }
    ctx.textAlign = 'left';

    // flash de daño
    if (S.hurtFlash > 0) {
      ctx.globalAlpha = S.hurtFlash * 0.9;
      ctx.fillStyle = '#c93b3b';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // pausa
    if (S.paused && S.phase !== 'menu') {
      ctx.fillStyle = 'rgba(8,10,14,.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f2d94e';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSA', W / 2, H / 2);
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }

  G.render = render;
})();
