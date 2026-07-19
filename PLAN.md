# COSECHA DE ACERO — Plan de diseño y desarrollo

Tower defense de mechas contra insectoides alienígenas, en pixel art.
Inspirado en **"Suits"** (Love, Death + Robots): granjeros que defienden su
granja pilotando mechas caseros contra oleadas de bichos alienígenas (los
"DeeBees"), con cerca eléctrica perimetral y una reina gigante al final.

## 1. Concepto

- **Ambientación:** una granja en la pradera. El camino de tierra que lleva
  al granero es la ruta de invasión. Los bichos salen del "agujero" al oeste.
- **Objetivo:** sobrevivir 10 oleadas defendiendo el granero (20 puntos de vida).
- **Tono:** rural + mecha DIY, paleta cálida de campo contra púrpuras y verdes
  ácidos alienígenas.

## 2. Tecnología

| Área | Elección | Razón |
|---|---|---|
| Motor | HTML5 Canvas + JS vanilla (sin dependencias) | Se ejecuta abriendo `index.html`, sin build ni npm |
| Arte | Pixel art 16×16 definido como matrices de caracteres + tiles procedurales | Autocontenido, editable como texto |
| Render | Canvas lógico 640×384 escalado con `image-rendering: pixelated` | Píxel crujiente auténtico |
| Audio | WebAudio sintetizado (osciladores + ruido) | Sin archivos de audio |
| UI | Panel lateral en HTML/CSS | Más nítido y accesible que UI en canvas |

## 3. Mechas (torres) — homenaje a los pilotos de *Suits*

| Mecha | Rol | Costo | Notas |
|---|---|---|---|
| **COYOTE** | Ametralladora | $100 | Disparo rápido, daño bajo, anti-enjambre |
| **CERCA-9** | Pilón tesla | $150 | Cadena eléctrica que salta entre bichos y los ralentiza (la cerca de la granja) |
| **BISONTE** | Cañón | $180 | Daño en área, lento |
| **VIUDA** | Francotirador | $260 | Rango enorme, daño masivo a un objetivo |

Cada mecha tiene 3 niveles (mejora: +40% daño, +rango, +cadencia) y se puede
vender al 70% de lo invertido.

## 4. Enemigos (insectoides)

| Bicho | Rol | Rasgos |
|---|---|---|
| **Dron** | Enjambre | Rápido y débil, viene en masa |
| **Avispa** | Corredor | Muy rápida, poca vida |
| **Escupidor** | Línea media | Vida media, quita 2 vidas |
| **Escarabajo** | Tanque | Blindaje (reduce daño plano), lento |
| **NODRIZA** | Jefe final (oleada 10) | Enorme, engendra drones mientras avanza |

La vida escala +12% por oleada.

## 5. Sistemas

- Camino por waypoints sobre rejilla 20×12; colocación en tiles libres.
- Objetivo de torre: el bicho más avanzado dentro del rango.
- Economía: $320 iniciales, recompensa por bicho + bono de oleada.
- Velocidad ×1/×2, pausa, silencio, atajos 1–4 / Espacio / Esc.
- Partículas (fogonazos, sangre ácida, explosiones), manchas en el suelo,
  textos flotantes de dinero.
- Pantallas: título, victoria, derrota (reinicio).

## 6. Estructura de archivos

```
index.html      — layout, panel de UI, overlays
js/sprites.js   — paleta, sprites en matrices, tiles procedurales
js/data.js      — definiciones de torres, enemigos, oleadas, camino
js/audio.js     — sintetizador WebAudio
js/game.js      — motor: estado, bucle, entidades, input, render
```

## 7. Fases de ejecución

1. Esqueleto HTML + canvas escalado + panel UI. ✔
2. Sprites y tiles procedurales. ✔
3. Datos de balance (torres/enemigos/oleadas). ✔
4. Motor: camino, spawner, movimiento, targeting, proyectiles. ✔
5. Economía, mejoras, venta, jefe, victoria/derrota. ✔
6. Audio, partículas, pulido, pantalla de título. ✔
7. Verificación en navegador y commit. ✔

## 8. Expansión: infraestructura de la granja ✔

- **GENERADOR** ($120, 180 vida): cada uno da **4 ⚡**; los mechas consumen
  energía (COYOTE/CERCA-9: 1 ⚡, BISONTE/VIUDA: 2 ⚡). Sin energía libre no se
  ensamblan mechas; si cae un generador, los últimos mechas quedan **SIN ⚡**
  (dejan de disparar) hasta recuperar capacidad.
- **TALLER** ($200, 220 vida): sin al menos uno en pie no se construyen ni
  mejoran mechas.
- Ambos deben colocarse **junto al camino** y los bichos los **muerden al
  pasar** (rango 48 px, mordisco cada 1.1 s). Se pueden **reparar**
  ($0.5/punto de vida) y vender. Se arranca con uno de cada, cerca del granero.
- **Disruptor de portales**: contiene el portal **30 s** entre oleadas; al
  agotarse la oleada arranca sola. Desactivarlo antes ([Espacio]) lanza la
  oleada y paga **+$2 por segundo restante**.
- **Partes ⚙**: escupidores (30 %), escarabajos (100 %) y la Nodriza (10 ⚙)
  las sueltan al morir. Mejorar a nivel 2 cuesta 1 ⚙ y a nivel 3 cuesta 2 ⚙
  (además del dinero).
- **Pausa**: botón dedicado en el panel además de la tecla [P]; congela
  oleada, cuenta atrás y bichos.

## 9. Expansión: guerra de desgaste ✔

- **Munición**: cada disparo gasta balas (capacidad × nivel). El **CARGADOR**
  ($90, a pie) y el **DRON** ($140, volador, con el que empieza la partida)
  las reponen desde el granero; el dron alterna modo RECARGA/ATAQUE.
- **Mechas móviles y mortales**: tienen vida, se mueven como piezas de
  ajedrez (paso por tipo, enfriamiento 4 s) y cambian de sprite al subir de
  nivel. Los bichos muerden y escupen a toda la defensa; los mechas
  priorizan a los bichos que atacan a tus unidades.
- **Energía espacial**: cada generador alimenta 4 ⚡ solo dentro de su radio
  (110 px). Mover un mecha fuera de cobertura lo apaga.
- **Bichos**: avispas voladoras van directo al granero; escupidores y
  Nodriza atacan a distancia; élites (aura roja, ×2.2 vida) desde la
  oleada 4, más frecuentes a cada oleada.
- **Cuadrícula tenue** horneada sobre el mapa.

## 10. Apoyo de campaña ✔

- El **CARGADOR** da servicio completo: recarga munición **y repara** al
  mecha en la visita (pide servicio con munición < 60 % o vida < 70 %).
- El **TALLER** admite la mejora **torreta de techo** ($150 + 1⚙, daño 7,
  rango 95): defensa automática del edificio.
- Especial **BOMBARDEO** ($250 + 2⚙, enfriamiento 45 s, tecla B): diana
  libre sobre el mapa; a los 0.8 s cae un obús que hace 260 de daño
  ignorando blindaje en un radio de 70 px (solo bichos).
- Cada **90 s** llega un **dron de apoyo gratis** al granero.

## 11. Consola contextual y autodestrucción ✔

- Marcador ▼ animado sobre la entidad seleccionada.
- El panel ARSENAL se convierte en **CONTROL: <unidad>** al seleccionar:
  acciones contextuales (mejorar/reparar/modo, vender, autodestruir).
- **Autodestrucción** en toda entidad (doble clic de confirmación, 3 s):
  onda que daña bichos (ignora blindaje) y aliados por igual; los aliados
  destruidos por la onda **detonan en cadena** (retardo 0.18 s por eslabón).
  Daño: mecha 150+40/nivel (r62), generador 180 (r70), taller 160 (r70),
  cargador 90 / dron 100 (r46).
- Recomendaciones aplicadas: VIUDA con daño ×1.5 a voladores; el dron de
  regalo respeta un tope de 4 drones activos.

## 12. El Detonador y control de partida ✔

- **Detonador** (kamikaze, oleadas 5+): hp 55, veloz; detecta defensa a
  110 px, carga directo (anillo de alarma naranja) y se inmola a 14 px.
  Su onda (r 55, 70 daño) golpea a la defensa y **remata unidades dañadas,
  desatando la cadena**; matarlo de cerca también lo detona (con
  recompensa). Suelta partes 25 %.
- Botón **NUEVA PARTIDA** en el mando (confirmación de 3 s) para
  reiniciar en caliente.

## 13. La cerca, el hacha y la economía de escala ✔

- **Campo de fuerza**: dos CERCA-9 encendidas flanqueando una celda del
  camino (vertical u horizontal) generan una barrera (vida 80 × suma de
  niveles) que bloquea a los terrestres; es objetivo atacable (mordiscos,
  escupitajos, kamikazes) y se regenera 12 s después de romperse. Cae si
  un pilón se mueve, se apaga o muere. Los voladores la ignoran.
- **Melé universal**: todo mecha golpea (12 + 8/nivel de daño, rango 26 px,
  cada 1 s) a los bichos pegados, sin gastar munición.
- **LEÑADOR** ($140): mecha de hacha — barre a todos los bichos en 38 px
  (34 daño, +alcance por nivel), 260 de vida, sin munición. Teclas ahora:
  mechas 1-5, edificios 6-7, unidades 8-9.
- **Talleres en serie**: cada taller extra abarata las mejoras un 12 %
  (tope 36 %).
- Selección de mecha: casillas alcanzables con pulso + flechas
  direccionales.
- Contrapeso del muro: los **escupidores** (y la Nodriza) priorizan
  derribar los campos de fuerza a distancia antes que a cualquier otro
  objetivo en su rango.

## 14. Sistema de animaciones ✔

`js/anim.js`: motor de tweens (`G.tween(obj, prop, from, to, dur, ease)`
con easing linear/outQuad/outBack) que avanza con el reloj del juego (la
pausa lo congela), más efectos empaquetados en `G.fx`:

- `pop(o)` — despliegue: mechas, edificios y unidades brotan del suelo
  con rebote (tween de `sy` con outBack) y polvo.
- `ring(x, y, r, color)` — anillo de onda expansiva: visualiza el radio
  real de bombardeos, autodestrucciones y kamikazes; también celebra
  mejoras, recargas, reparaciones y drones de regalo, y avisa fugas al
  granero y campos rotos.
- `die(e)` — cadáver del bicho: el sprite se encoge y desvanece donde cayó.

Detalles de vida: respiración idle de los mechas, retroceso al disparar,
polvo bajo las pisadas al moverse, vaivén de vuelo del dron y pulso
púrpura del portal mientras siga escupiendo bichos.

## 15. Guardado en localStorage ✔

`js/save.js`: instantánea serializable (dinero, vidas, partes, oleada,
mechas con nivel/vida/munición, edificios con torreta, unidades con modo)
bajo la clave `cosecha-de-acero-save`. Autoguardado cada 3 s durante la
fase de construcción y como punto de control al superar cada oleada;
cerrar a media oleada reanuda en la construcción previa. Botón
**CONTINUAR** en el título si hay guardado; ganar, perder, ARRANCAR y
NUEVA PARTIDA lo borran. Tolerante a localStorage bloqueado.

## 16. Pulido y accesibilidad ✔

- **Radar de oleada**: franja CRT bajo el monitor táctico; en construcción
  muestra la composición de la próxima oleada (sprite × cantidad por tipo)
  con avisos de élites (% real) y de la Nodriza; durante la oleada, los
  bichos restantes.
- **Ficha técnica**: pasar el ratón por una tarjeta del arsenal muestra en
  el monitor sus números (daño, DPS aproximado, rango, vida, munición,
  paso, consumo ⚡) antes de comprar.
- **Soporte táctil**: arrastrar el dedo sobre el mapa apunta (previsualiza
  colocación y diana del bombardeo) y soltar ejecuta; volver a tocar la
  tarjeta cancela. `touch-action` ajustado para matar el zoom por doble
  toque y el resaltado de tap.

## 17. La granja produce y el granero se defiende ✔

- **Manual de campo**: botón ? INSTRUCCIONES [H] (y tecla H, también desde
  el título) abre un overlay con todas las reglas; abrirlo pausa la
  partida y cerrarlo la reanuda.
- **Granero mejorable**: clic en el granero → CONTROL: GRANERO. Reforzarlo
  (nivel 2: $300+2⚙, nivel 3: $500+3⚙) da vidas extra (+5/+8) y monta una
  torreta en el techo por nivel (la del 3 es más potente). Sin
  autodestrucción. El nivel se guarda en la partida.
- **Ingreso pasivo**: cada taller produce $2 cada 6 s mientras siga en pie.

## 18. Cabina de una sola pantalla ✔

- **Todo cabe sin scroll** en una pantalla estándar: el `body` fija
  `100vh`, el canvas se escala por JS (`fitCanvas`) al hueco disponible
  y en pantallas angostas (≤760 px) se vuelve al flujo vertical con
  scroll.
- **Arsenal vertical**: las 9 tarjetas viven en una columna lateral
  izquierda, siempre visibles.
- **Consola solo contextual**: la ranura inferior izquierda es el panel
  CONTROL (menú contextual de lo seleccionado o nota de espera); el
  mando se adelgazó (el hint largo se fue al manual de campo, NUEVA
  PARTIDA y AYUDA comparten fila).

## 19. Arte de cabina: mechas nuevos, SEGADOR y la cara del piloto ✔

- **Pixel art nuevo de los mechas** al estilo de las referencias: chasis
  verde militar, cabina de cristal con el piloto (gorra roja), luces
  amarillas y armas grises; el pilón CERCA-9 ganó aislante naranja y pie
  verde.
- **SEGADOR** ($240, 2 ⚡): sexto mecha, melé de hoja de energía
  alienígena — un tajo a un solo objetivo que ignora el blindaje
  (`blade` en `WEAPONS`), efecto de tajo púrpura. Teclas ahora: mechas
  1-6, edificios 7-8, unidades 9-0.
- **Retratos**: al seleccionar mecha/edificio/unidad/granero, el panel
  CONTROL muestra su sprite ampliado en un marco.
- **La cara del piloto** (estilo Doom): 4 estados de 16×16 (sereno,
  magullado, sangrando, crítico) elegidos por la fracción de vida del
  mecha — o del granero, con la vida máxima acumulada de sus refuerzos.

## 20. Dificultad y asedio sin fin ✔

- **Dificultades** en el título (persisten entre reinicios): APRENDIZ
  (balance clásico), GRANJERO (+25% vida, 90% economía), VETERANO
  (+55% vida, 75% economía). Multiplican la vida de todo bicho y toda
  recompensa (botín, élites y bono de oleada).
- **Asedio sin fin**: al ganar la campaña, el botón ☠ ASEDIO SIN FIN
  reabre el portal; las oleadas 11+ se generan procedurales
  (`endlessWave`), crecen sin tope, traen una Nodriza cada 5 y suman
  una rampa de vida compuesta (+8%/oleada) sobre la escala normal.
- **Récord de la granja** (localStorage aparte del guardado): mejor
  oleada sobrevivida con su dificultad; se muestra en el título y se
  actualiza al ganar, al caer y al superar cada oleada del asedio.
- La derrota en asedio presume las oleadas aguantadas; el HUD marca
  `11/∞`.

## 21. Cabina lateral: el mapa manda ✔

- La consola (CONTROL + MONITOR + MANDO) pasó de franja inferior a
  **columna derecha** pegada al mapa: el espacio muerto a la derecha se
  aprovecha y el canvas crece a todo el alto disponible (~el doble de
  área en 1366×768 y 1726×976).
- El arsenal (izquierda) y la consola (derecha) flanquean la acción:
  mínimo viaje visual (ley de Fitts / proximidad Gestalt).
- Overlays compactados: el título con selector de dificultad ya cabe
  sin scroll interno.

## 22. Balance: cadenas contenidas y chatarra generosa ✔

- **Cadena enemiga contenida**: cuando un Detonador remata unidades
  dañadas, éstas aún estallan, pero su onda pega a los aliados con el
  60% del daño (`enemyChainMul`) y la cadena se agota en 1 eslabón
  (`enemyChainDepth`): una sola bola ya no arrasa la base. La
  autodestrucción manual del jugador conserva la cadena ilimitada.
- **Partes ⚙ más generosas** (la mejora casi no se usaba): escupidor
  30%→50%, kamikaze 25%→40%, escarabajo suelta 2, élites 50%→75%, y
  **+1 ⚙ garantizada al superar cada oleada** (chatarra recuperada).

## 23. Identidad visual, Nodriza pausada y minas ✔

- **Un color por mecha** (remapa de paleta en `makeSprite`): COYOTE
  arena, CERCA-9 azul acero, BISONTE marrón, VIUDA carbón, LEÑADOR
  verde y SEGADOR turquesa — distinguibles al vistazo.
- **Nodriza más lenta** (15 → 11 px/s): la pelea final es un asedio con
  tiempo real de hacerle daño, no un sprint imparable.
- **MINA** ($40, tecla M): consumible que se entierra **sobre el
  camino** (tile de camino libre, máx. 8 activas); estalla bajo el
  primer terrestre que la pisa — 90 de daño en radio 36 ignorando
  blindaje; los voladores no la activan. El modo colocación permite
  sembrar varias seguidas y se guardan en la partida.

## 24. Torreta de serie en el granero ✔

- El granero arranca con una **torreta básica** montada (daño 6, rango
  100): la última línea de defensa nunca está indefensa. Los refuerzos
  de nivel 2 y 3 añaden sus torretas encima, hasta 3 en total.

## 25. Modo HORDA y jefes nuevos ✔

- **Selector de modo** en el título (pegajoso, se guarda en la partida):
  CAMPAÑA clásica o **☠ HORDA** — bolsillos llenos ($4000 y 12 ⚙),
  oleadas aleatorias sin fin desde la primera y jefe cada 4 oleadas.
- Las oleadas de horda son **deterministas por número** (`hordeWave`,
  RNG con semilla): el radar anuncia exactamente lo que saldrá.
- **Jefes nuevos** en rotación (`BOSS_POOL`, también cada 5 oleadas del
  asedio sin fin de campaña):
  - **MANTIS** (hp 1500, veloz para su tamaño): cazadora de defensa a
    mordiscos brutales (26).
  - **GUSANO** (hp 2600, blindaje 10): excavador — **pasa por debajo de
    los campos de fuerza** (`burrower`, el contrapeso definitivo al
    muro) y pare larvas al avanzar.
- Los jefes no generan variantes de élite (marca `boss: true`); avisos
  de radar y letrero al lanzar nombran al jefe que viene.

## 26. Botonería industrial ✔

- Rediseño CSS de todos los botones al lenguaje "tablero de máquina":
  biseles 3D con base negra que se hunde al pulsar (`translateY` +
  `box-shadow` escalonado), tornillos en las esquinas y franjas de
  peligro.
- **LANZAR OLEADA** es el botonazo rojo sobre carcasa amarilla (como el
  interruptor de emergencia de referencia); BOMBARDEO y AUTODESTRUCCIÓN
  llevan marcos de franjas amarillas/rojas; los botones de overlay son
  placas amarillas industriales; las tarjetas del arsenal y los
  selectores del título se hunden al quedar seleccionados.
- Ajuste fino de alturas (monitor, retratos 56 px, nota) para que la
  consola siga sin scroll interno a 768 px.

## 27. Logo oficial ✔

- `assets/logo.png` (512 px, generado con IA a partir del prompt de
  diseño): emblema circular con el mecha del hacha, trigo, granero y
  garra alienígena.
- Durante la partida el HUD muestra solo la **placa de letras**
  (`assets/logo-text.png`, recorte del original) presidiendo la esquina
  superior izquierda y **desbordando el marco a propósito**; el emblema
  completo protagoniza la pantalla de título, es el **favicon** y
  encabeza el README. El texto largo de intro lo absorbió el manual.

## 28. Experiencia móvil ✔

- **Vertical (≤760px), jerarquía de pulgar**: HUD compacto → mapa a todo
  lo ancho → **arsenal como tira horizontal deslizable** pegada al mapa
  (targets de 48px+, sin etiquetas de tecla) → MANDO (el botonazo LANZAR
  inmediato) → CONTROL → monitor al final.
- **Apaisado / ventanas bajas** (`max-height:520px`): la cabina encoge
  el cromo (logo, medidores, arsenal 112px, consola 236px) y el mapa
  conserva el protagonismo.
- Viewport sin zoom accidental (`maximum-scale=1`), `overscroll-behavior`
  bloqueado, `theme-color` y `apple-touch-icon` con el logo, y botón
  **⛶ pantalla completa** que solo aparece en pantallas táctiles
  (`pointer:coarse`).

## 29. Refactor: arquitectura modular ✔

`game.js` se partió en módulos IIFE comunicados por `window.G` (sin build,
se conserva el doble clic en `index.html`): `core.js` (estado + helpers),
`behaviors.js` (tablas `ENEMY_BEHAVIORS` y `WEAPONS` componibles),
`entities.js` (motor), `render.js`, `ui.js` y `main.js`. Los enemigos
declaran sus comportamientos en `data.js` (`behaviors: ['biter', 'spawner']`)
y las armas se resuelven por `proj` en la tabla `WEAPONS`; añadir tipos
nuevos ya no toca el motor. Las pantallas de fin se sincronizan con
`S.phase` desde la UI (el motor no conoce el DOM).
