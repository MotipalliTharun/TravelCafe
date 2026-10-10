# Travel Café: "Every Cup Has a Passport"

A scroll-driven storytelling website for Travel Café. As you scroll, the page plays eight
illustrated scenes, and each scene's motion is tied directly to your scroll position:

| # | Scene | Scroll-linked motion |
|---|-------|----------------------|
| Prologue | Dawn on Wanderer's Lane | The sky changes colour and the sun rises. The shutter rolls up and the door sign flips to OPEN. |
| 01 | Origins | Hills move in parallax. Cherries ripen from green to red, then drop into a basket. |
| 02 | The Voyage | A trade route draws itself across the map with a ship following it. Passport stamps appear at each stop. |
| 03 | The Roast | The drum turns and the beans darken. The gauge needle and temperature readout climb, with sparks at first crack. |
| 04 | The Pour | The kettle tilts and water streams in. The carafe fills while a brew timer runs. |
| 05 | The Passport Menu | Vertical scrolling moves six drink postcards sideways. |
| 06 | The Window | The view through the window changes from Paris to Kyoto to Marrakech, with guest quotes. |
| Epilogue | Your Table | The cup drains, then the visit details and reservation link appear. |

The full scene-by-scene script, covering narration, timing and motion, is in [`SCRIPT.md`](SCRIPT.md).

## Run it

It is a static site with no build step and no dependencies:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Structure

```
index.html            scenes + inline SVG illustrations
css/style.css         layout, typography, ambient loops, responsive rules
js/main.js            dependency-free scroll engine + per-scene hooks
assets/               logo, favicon, world map, drink illustrations (all SVG)
tools/build-map.js    regenerates assets/world-map.svg (`node tools/build-map.js`)
SCRIPT.md             the story script
```

## Animating with `data-tw`

Any element inside a `.scene` can declare scroll-linked tweens:

```html
<g data-tw="0-.3: o 0 1, y 40 0; .8-1: o 1 0">
```

This means: between 0 and 30% of the scene, fade in and rise 40 units; between 80% and 100%, fade out.
The properties are `x y s sx sy r o d b fill stop`, and the easing options are `l i o io`.
`data-origin="x y"` sets the pivot point of an SVG element. Motion that needs more than a tween
(the route, menu track, timers) goes in a hook in `js/main.js`.

Ambient loops are turned off when the visitor has `prefers-reduced-motion` set.
