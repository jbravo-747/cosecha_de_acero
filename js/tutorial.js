/* ==========================================================================
   COSECHA DE ACERO — tutorial.js
   Mini demo interactiva de la mecánica: pasos guiados que resaltan la
   tarjeta o el botón que toca usar y avanzan solos cuando el jugador
   ejecuta la acción. Se lanza en la primera partida (localStorage) y
   desde el botón TUTORIAL del título.
   ========================================================================== */
(function () {
  'use strict';

  var G = window.G, S = G.S;
  var KEY = 'cosecha-de-acero-tutorial';
  var store = null;
  try { store = window.localStorage || null; } catch (e) { store = null; }

  var box = document.getElementById('tutBox');
  var txt = document.getElementById('tutText');
  var next = document.getElementById('tutNext');
  var skip = document.getElementById('tutSkip');

  var stepIdx = -1, glowEl = null, baseTowers = 0;

  // manual: espera el botón ENTENDIDO · done(): avanza solo al cumplirse
  // target(): elemento del panel a resaltar mientras el paso está activo
  var STEPS = [
    { manual: true,
      text: 'Los bichos salen del <b>agujero del oeste</b> y siguen el camino ' +
        'de tierra hasta tu <b>granero</b>. Cada bicho que llega te roba vidas.' },
    { text: 'Elige tu primer mecha: <b>toca la tarjeta del COYOTE</b> en el arsenal.',
      target: function () { return G._towerBtn && G._towerBtn('mg'); },
      done: function () { return S.placing === 'mg' || S.towers.length > baseTowers; } },
    { text: 'Ahora <b>plántalo en el pasto</b>, pegado al camino y cerca del ' +
        'GENERADOR: un mecha lejos de todo generador queda SIN ⚡ y no dispara.',
      done: function () { return S.towers.length > baseTowers; } },
    { manual: true,
      text: '¡Ensamblado! Cada disparo <b>gasta munición</b>: el DRON y el ' +
        'CARGADOR la reponen desde el granero. Si un bicho se le pega, tu ' +
        'mecha pelea <b>cuerpo a cuerpo</b>.' },
    { manual: true,
      text: 'Tócalo (o toca el granero) para abrir su panel <b>CONTROL</b>: ' +
        'mejorar cuesta dinero y <b>partes ⚙</b> — los bichos duros las ' +
        'sueltan y cada oleada superada deja una.' },
    { text: 'Cuando tu defensa esté lista, pulsa el <b>botonazo rojo</b> ' +
        '(o [Espacio]) para abrir el portal.',
      target: function () { return document.getElementById('startBtn'); },
      done: function () { return S.phase === 'wave'; } },
    { manual: true,
      text: '¡Ahí vienen! Sobrevive las <b>10 oleadas</b>: entre cada una ' +
        'mejora, repara y refuerza el granero. El manual completo vive en ' +
        '<b>[H]</b>. ¡Suerte, granjero!' }
  ];

  function setGlow(el2) {
    if (glowEl) glowEl.classList.remove('tut-glow');
    glowEl = el2 || null;
    if (glowEl) glowEl.classList.add('tut-glow');
  }

  function show(i) {
    stepIdx = i;
    var st = STEPS[i];
    txt.innerHTML = '<b>[' + (i + 1) + '/' + STEPS.length + ']</b> ' + st.text;
    next.classList.toggle('hidden', !st.manual);
    setGlow(st.target ? st.target() : null);
    box.classList.remove('hidden');
  }

  function finish() {
    stepIdx = -1;
    setGlow(null);
    box.classList.add('hidden');
    try { if (store) store.setItem(KEY, '1'); } catch (e) {}
  }

  function advance() {
    if (stepIdx + 1 >= STEPS.length) finish();
    else show(stepIdx + 1);
  }

  // llamado cada frame desde updateUI mientras el tutorial esté activo
  G.tutorialTick = function () {
    if (stepIdx < 0) return;
    if (S.phase !== 'build' && S.phase !== 'wave') { finish(); return; }
    var st = STEPS[stepIdx];
    if (st.target) {
      var el2 = st.target();
      if (el2 !== glowEl) setGlow(el2);
    }
    if (!st.manual && st.done && st.done()) advance();
  };

  next.addEventListener('click', function () { advance(); });
  skip.addEventListener('click', finish);

  G.startTutorial = function () { baseTowers = S.towers.length; show(0); };
  G.tutorialSeen = function () {
    try { return !!(store && store.getItem(KEY)); } catch (e) { return true; }
  };
})();
