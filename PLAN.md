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
