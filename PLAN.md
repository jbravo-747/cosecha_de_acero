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

## 17. Refactor: arquitectura modular ✔

`game.js` se partió en módulos IIFE comunicados por `window.G` (sin build,
se conserva el doble clic en `index.html`): `core.js` (estado + helpers),
`behaviors.js` (tablas `ENEMY_BEHAVIORS` y `WEAPONS` componibles),
`entities.js` (motor), `render.js`, `ui.js` y `main.js`. Los enemigos
declaran sus comportamientos en `data.js` (`behaviors: ['biter', 'spawner']`)
y las armas se resuelven por `proj` en la tabla `WEAPONS`; añadir tipos
nuevos ya no toca el motor. Las pantallas de fin se sincronizan con
`S.phase` desde la UI (el motor no conoce el DOM).
