# 🌾🤖 Cosecha de Acero

Tower defense en pixel art: **mechas granjeros contra insectoides alienígenas**.
Inspirado en el corto *"Suits"* de Love, Death + Robots.

Los bichos salieron del agujero al oeste de la propiedad y avanzan por el
camino de tierra hacia el granero. Coloca mechas, electrifica la cerca y
sobrevive 10 oleadas — en la última llega **la Nodriza**.

## Cómo jugar

Sin instalación ni dependencias: abre `index.html` en cualquier navegador
moderno (doble clic basta). Opcionalmente, con un servidor local:

```bash
python3 -m http.server 8080
# http://localhost:8080
```

### Controles

| Tecla / acción | Efecto |
|---|---|
| `1`–`4` o clic en tarjeta | Elegir mecha para colocar |
| `5` / `6` | Generador de energía / Taller de ensamblado |
| Clic en el pasto | Colocar el mecha o edificio |
| Clic en mecha / edificio | Seleccionar (mejorar / reparar / vender) |
| `Esc` / clic derecho | Cancelar / deseleccionar |
| `Espacio` | Desactivar el disruptor de portales (lanza la oleada) |
| `P` o botón PAUSA | Pausa |

### Mechas

- **COYOTE** ($100, 1 ⚡) — ametralladora rápida, anti-enjambre.
- **CERCA-9** ($150, 1 ⚡) — pilón tesla: la descarga salta entre bichos y los frena.
- **BISONTE** ($180, 2 ⚡) — cañón con daño en área.
- **VIUDA** ($260, 2 ⚡) — francotirador de largo alcance.

Cada uno mejora hasta nivel 3 (cuesta dinero **y partes ⚙**) y se vende al
70% de lo invertido.

### Infraestructura

- **GENERADOR** ($120) — da 4 ⚡ para alimentar mechas. Si cae, los últimos
  mechas quedan sin energía y dejan de disparar.
- **TALLER** ($200) — sin al menos uno en pie no se ensamblan ni mejoran mechas.

Ambos van **junto al camino** y los bichos los **muerden al pasar**:
defiéndelos, repáralos o reconstrúyelos.

### Disruptor de portales

Entre oleadas el disruptor contiene el portal **30 segundos**; al agotarse,
la oleada arranca sola. Desactivarlo antes con `Espacio` da un bono de
**+$2 por segundo restante**.

### Bichos

Drones (enjambre), avispas (veloces), escupidores, escarabajos blindados y
la **NODRIZA**, que engendra drones mientras avanza. Los duros sueltan
**partes ⚙** al morir: escupidores (30%), escarabajos (siempre) y la
Nodriza (10 ⚙).

## Tecnología

HTML5 Canvas + JavaScript vanilla, cero dependencias. Pixel art definido como
matrices de caracteres (`js/sprites.js`), tiles procedurales con RNG con
semilla, y efectos de sonido sintetizados con WebAudio (`js/audio.js`).

Arquitectura modular sin build: cada archivo es un IIFE y los módulos se
comunican por el espacio compartido `window.G`, en orden de carga:

```
index.html        layout, panel de UI, overlays
js/sprites.js     paleta + sprites + tiles
js/data.js        balance: torres, enemigos, oleadas, edificios, mapa
js/audio.js       sintetizador de efectos
js/core.js        estado, camino, helpers compartidos (G)
js/behaviors.js   comportamientos de enemigos y armas (tablas componibles)
js/entities.js    motor: colocación, oleadas, daño, update()
js/render.js      fondo pre-horneado + dibujado del frame
js/ui.js          panel lateral, overlays e input
js/main.js        bucle principal
```

Para añadir un enemigo o arma nueva: define sus datos en `data.js` y, si
necesita lógica propia, una entrada en las tablas de `behaviors.js`
(`ENEMY_BEHAVIORS` / `WEAPONS`) — el motor no se toca.

El diseño completo está en [PLAN.md](PLAN.md).
