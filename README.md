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
| Clic en el pasto | Colocar el mecha |
| Clic en mecha colocado | Seleccionar (mejorar / vender) |
| `Esc` / clic derecho | Cancelar / deseleccionar |
| `Espacio` | Iniciar oleada |
| `P` | Pausa |

### Mechas

- **COYOTE** ($100) — ametralladora rápida, anti-enjambre.
- **CERCA-9** ($150) — pilón tesla: la descarga salta entre bichos y los frena.
- **BISONTE** ($180) — cañón con daño en área.
- **VIUDA** ($260) — francotirador de largo alcance.

Cada uno mejora hasta nivel 3 y se vende al 70% de lo invertido.

### Bichos

Drones (enjambre), avispas (veloces), escupidores, escarabajos blindados y
la **NODRIZA**, que engendra drones mientras avanza.

## Tecnología

HTML5 Canvas + JavaScript vanilla, cero dependencias. Pixel art definido como
matrices de caracteres (`js/sprites.js`), tiles procedurales con RNG con
semilla, y efectos de sonido sintetizados con WebAudio (`js/audio.js`).

```
index.html      layout, panel de UI, overlays
js/sprites.js   paleta + sprites + tiles
js/data.js      balance: torres, enemigos, oleadas, mapa
js/audio.js     sintetizador de efectos
js/game.js      motor del juego
```

El diseño completo está en [PLAN.md](PLAN.md).
