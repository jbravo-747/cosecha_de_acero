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
| `7` / `8` | Reclutar CARGADOR / DRON (salen del granero) |
| Clic en el pasto | Colocar el mecha o edificio |
| Clic en mecha / edificio / unidad | Seleccionar |
| Mecha seleccionado + clic en tile iluminado | **Moverlo** (paso tipo ajedrez) |
| `Esc` / clic derecho | Cancelar / deseleccionar |
| `Espacio` | Desactivar el disruptor de portales (lanza la oleada) |
| `P` o botón PAUSA | Pausa |

### Mechas (unidades móviles con vida y munición)

- **COYOTE** ($100, 1 ⚡, paso 2) — ametralladora rápida, 200 balas.
- **CERCA-9** ($150, 1 ⚡, paso 1) — pilón tesla: salta entre bichos y los frena.
- **BISONTE** ($180, 2 ⚡, paso 1) — cañón de área, 45 obuses.
- **VIUDA** ($260, 2 ⚡, paso 3) — francotirador, 22 balas.

Cada disparo gasta munición; sin balas el mecha calla hasta que lo
reabastezcan. Se **mueven** como piezas de ajedrez (su "paso" en tiles, con
enfriamiento) y **cambian de aspecto** al subir de nivel: hombreras de acero
a nivel 2, astas doradas a nivel 3. Mejorar cuesta dinero **y partes ⚙** y
entrega el mecha reparado y recargado.

### Unidades de apoyo

- **CARGADOR** ($90) — peón mecánico: lleva munición del granero a los
  mechas **y los repara en el campo**. Los mechas cubren su ruta:
  priorizan a los bichos que atacan a tu gente.
- **DRON** ($140) — vuela sobre cualquier tile. Alterna entre modo
  **RECARGA** (reabastece mechas) y modo **ATAQUE** (métralla ligera,
  reposicionable con un clic). **La partida empieza con uno y cada 90
  segundos llega otro gratis al granero.**

### Consola contextual y autodestrucción

Al seleccionar cualquier cosa (mecha, edificio o unidad) aparece un
**marcador ▼** sobre ella y el arsenal cede su lugar a un **menú
contextual** con sus acciones. Todas las unidades tienen un botón de
**AUTODESTRUCCIÓN ☠** (con confirmación): la onda expansiva daña a los
bichos *y a tus propios aliados* — si la explosión destruye unidades
vecinas, éstas **detonan en cadena**. Alinear generadores tiene sus
riesgos... y sus usos desesperados.

Notas de campaña: la **VIUDA** hace daño ×1.5 a voladores, y los drones
de regalo dejan de llegar cuando ya tienes 4 activos.

### Especial: BOMBARDEO ☢

Con `B` o el botón de mando ($250 + 2⚙, enfriamiento 45s) armas un
bombardeo: apunta con la diana y haz clic — tras un instante cae un obús
que **arrasa a los bichos del área** (ignora blindaje).

### Infraestructura

- **GENERADOR** ($120) — alimenta con 4 ⚡ a los mechas **dentro de su
  radio**. Un mecha lejos de todo generador queda SIN ⚡ y no dispara.
- **TALLER** ($200) — sin al menos uno en pie no se ensamblan ni mejoran
  mechas. Admite una mejora: **torreta de techo** ($150 + 1⚙) que dispara
  sola a los bichos que pasan.

Los bichos **muerden y escupen** a todo: mechas, unidades y edificios.
Repara, reconstruye y reposiciona.

### Disruptor de portales

Entre oleadas el disruptor contiene el portal **30 segundos**; al agotarse,
la oleada arranca sola. Desactivarlo antes con `Espacio` da un bono de
**+$2 por segundo restante**.

### Bichos

Drones (enjambre), avispas (**voladoras: van directo al granero, sin seguir
el camino**), escupidores (**atacan a distancia**), escarabajos blindados,
**Detonadores** (kamikazes que cargan contra tu defensa y se inmolan — su
onda daña a tus unidades y puede desatar tu propia explosión en cadena;
matarlos de cerca también los detona) y la **NODRIZA**, que engendra
drones y escupe. Desde la oleada 4 aparecen
**variantes de élite** (aura roja): más grandes, con el doble de vida y
botín; abundan más a cada oleada. Los bichos duros y las élites sueltan
**partes ⚙** al morir.

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
