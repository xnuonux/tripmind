# TRIPMIND

**a chamber for watching mathematics become visible.**

TRIPMIND is a universal visualizer — an instrument, not a dashboard. Four sliders in easy mode. A deep panel when you want the theorems. Sixty-one finished compositions from still water to things that should not have names. Stills and video, in the aspect you actually publish.

It is its own object. Ancestors exist in `studio/` as historical matter. This is not a skin on that work.

---

## What it is for

To sit in front of a field and let a machine show you what a Hopf fibration *feels* like. To render a twelve-second square for a mint, or an eight-second clip for a story, or a 4K still that looks like a relic. To play an album into the mic and watch Gray–Scott grow organs on the beat.

Purpose, stated plainly: **make the invisible laws of form available to the body.**

Direction: from lightly bland to vivid to sacred to quantum to the unnameable. The presets are the product. Deep mode is the lab.

---

## Run it

Double-click `Start Tripmind.bat`, or:

```bash
node agent/bridge.mjs
```

then open [http://127.0.0.1:8765](http://127.0.0.1:8765). The bridge is the chamber **and** the agent HTTP API. Plain `python -m http.server` still works for humans; agents lose the `/v1` mailbox.

Needs a browser with **WebGL2**. First load wants the font CDN; after that it is just files.

---

## Agents

People play the dock. Agents use the same verbs without a mouse.

| surface | for |
|---|---|
| `window.TRIPMIND` | any script in the page. `help()` / `describe()` / `exec(cmd, args)` |
| `postMessage` | iframes, extensions. `{type:'tripmind', cmd, args, id}` |
| `POST /v1/cmd` | curl, other processes. requires the bridge + an open tab |
| `node agent/mcp.mjs` | Claude / Cursor / Grok MCP |
| `/AGENTS.md` `/llms.txt` `/agent.json` `/agent/catalog.json` | read these. do not guess. |

```js
await TRIPMIND.describe()
await TRIPMIND.applyPreset('godhead')
await TRIPMIND.setState({ intensity: 0.9, heat: 0.75 })
await TRIPMIND.still({ as: 'dataurl', download: false })
```

```bash
curl -s 127.0.0.1:8765/v1/cmd -H "content-type: application/json" \
  -d '{"cmd":"preset","args":{"id":"hopf-fibration"}}'
```

The tab is the GPU. You are the hands. Full contract: [`AGENTS.md`](AGENTS.md).

---

## Easy / Deep

**Easy** is the instrument.

| control | what it actually does |
|---|---|
| ← → / name | step the 61 compositions |
| intensity | how hard the field insists |
| tempo | the time constant |
| heat | saturation toward the palette’s fever |
| bloom | HDR halo on the hot parts |
| still / still 4K | PNG of the current frame at the render size |
| 8s / 15s clip | realtime video (webm or mp4) |
| mic / audio | bass breathes the field |

**Deep** is the observatory: engine, secondary engine, manifold, kaleidoscopic dihedral fold, domain warp, trails, grain, chromatic aberration, CRT phosphor, particle spring/orbit/morph, and a full render strip (aspect, long edge, fps, duration).

HUD is DOM. It is never baked into a still or a clip. Press **H** before you capture if you want the chamber empty.

---

## Fourteen engines

Each engine is a real object from mathematics or physics, not a filter name.

| engine | the law |
|---|---|
| **field** | GPGPU particles on a manifold — Gielis superformula, torus knots, Lissajous, Thomas attractor, spherical-harmonic shells. Spring-to-home, curl noise, orbital angular momentum, hard containment. |
| **kaleid** | Dihedral group Dₙ acting on the plane, inverted into a hyperbolic tunnel. |
| **warp** | Iterated domain-warped fBm (Quílez). |
| **abyss** | Volumetric raymarch of a Schoen gyroid mixed with a Mandelbox DE. |
| **phosphor** | Curl-advected dye + optional CRT aperture grille. |
| **lattice** | Chladni figures `cos(nπx)cos(mπy) − cos(mπx)cos(nπy)`, Bessel J₀ rings, Lissajous overlays. |
| **soliton** | Gray–Scott reaction–diffusion. Two chemicals, one law, the plane invents organs. |
| **iris** | Polar roses `r = cos(kθ)`, phyllotaxis at the golden angle `2π/φ²`, vesica, pupil. |
| **prism** | Thin-film interference. Optical path `δ = 2 n d cosθ`, `I(λ) ∝ sin²(2πδ/λ)`. Soap-bubble physics. |
| **filament** | Ridge noise as dielectric breakdown. Path-integral aesthetic. |
| **orbital** | Hydrogenic \|Yₗₘ\|² · Rₙₗ² on a rotating slice of R³. The electron is a cathedral of probability. |
| **hopf** | Hopf fibration S³ → S². Fibers are circles. Color is the base point. |
| **klein** | Iterated circle inversion. Kleinian / Apollonian limit dust. Descartes reciting himself. |
| **hybrid** | Warp against a second engine, breathing on a slow sinusoid. |

Thirty IQ cosine palettes sit under all of them. Seed is eight hex characters. Same seed, same engine, same params → the same world.

---

## Sixty-one compositions

Grouped the way a record is grouped.

- **still** — Pale Ember, Quiet Snow, Graphite Drift, Morning Film, Soft Iris, Dust Orbit, Paper Moon, Still Water, Ash Garden, Ivory Lattice, Low Tide, Candle Smoke
- **vivid** — Amber Cathedral, Cyan Hive, Velvet Orbit, Copper Filament, Tide Pool, Neon Relic, Glass Hive, Polar Rose, Magenta Sun, Plasma Crown, Electric Hive, Crimson Tunnel, Ultraviolet Garden, Hyperfoil, Acid Cathedral, Solar Wound
- **sacred** — Vesica, Phyllotaxis, Sephirot, Mandorla, Metatron, Gnosis
- **quantum** — Hydrogen 3d, Hopf Fibration, Bloch Garden, Path Integral, Kleinian Limit, Apollonian, Spinor Hymn
- **abyss** — Godhead, Afterdeath, The Fold, White Hole, Seraphim, Aeon, Null Communion, Chrysanthemum Bomb, Ten Thousand Eyes, The Last Color, Omega Iris, Unnameable, Event Horizon, Seraph Lattice
- **keeper** — Publication (`820bd92d`), Continuum, Nested, Lissajous Hold, Classic Ring, Phosphor Oracle

Press **G**. Click a name. The chamber changes key.

---

## Keys

| key | |
|---|---|
| ← → | previous / next composition |
| space | pause |
| E | easy ↔ deep |
| G | gallery |
| S | still |
| R | 8s clip |
| N | new seed |
| H | hide UI |
| F | fullscreen |
| esc | close |

Share a look with the URL hash: `#p=godhead&s=60dhead1&e=iris`

---

## Render

Easy: **still**, **still 4K**, **8s**, **15s**.

Deep: aspect `16:9 / 1:1 / 9:16 / 4:5 / 21:9`, long edge 1080–3840, 24/30/60 fps, 4–30 s. The browser picks mp4 if it can, otherwise webm.

Pixel ratio is forced to 1 for capture. The HUD is not in the file.

---

## Why the math is in here

Because pretty noise is a dead end.

A Chladni plate, a hydrogen orbital, a Hopf fiber, a Gray–Scott front, a thin film — these are not textures. They are *consequences*. When the picture is a consequence, it can be bland or it can be unbearable, but it cannot be generic. That is the whole bet.

The theology is not decoration. Sephirot is a graph. Gnosis is a standing wave in a skull-shaped potential. A spinor needs 4π to come home. The machine does not believe this. It computes it. You are the one who has to decide whether that is a hymn.

---

## Repo

```
index.html          the chamber
AGENTS.md           contract for machines
llms.txt            short machine brief
agent.json          discovery
agent/              catalog, schema, HTTP bridge, MCP
css/app.css         void, glass, Garamond, mono
js/api.js           window.TRIPMIND + postMessage
js/app.js           boot
js/renderer.js      WebGL2 pipeline
js/shaders.js       the laws
js/presets.js       the 61
studio/             ancestral sources, not the product
Start Tripmind.bat  chamber + bridge
```

MIT. Built as a static site. No build step. No framework.

— xnuonux, 2026
