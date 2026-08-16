---
name: expansion-study-design
description: Use this skill to generate well-branded interfaces for Expansion Study (creative code lab / WebGL playground). Pure void, glass panels, EB Garamond italic titles, JetBrains Mono HUD. No accent — the canvas is the color.
user-invocable: true
---

# Expansion Study — Design Skill

Expansion Study is a creative-coding lab — WebGL experiments, particle simulations, procedural visuals. The brand is **minimal and mono-forward**: pure void black, glass panels, warm-neutral ink, EB Garamond italic titles, JetBrains Mono for the entire UI. No accent color — the creative work on the canvas IS the color.

Read **`README.md`** in this skill first — it holds the full visual foundations and file manifest.

## Quick orientation
- **Feeling:** A code editor at midnight. Canvas fills the screen. UI whispers from the edges.
- **Tokens:** Link `styles.css` (it `@import`s everything in `tokens/`). Use semantic aliases (`--ink`, `--panel`, `--edge`, `--font-mono`).
- **Type:** EB Garamond italic for titles (rare). JetBrains Mono for everything else — HUD, controls, labels, data.
- **Surfaces:** `ex-panel` for floating UI. `ex-slide-panel` for settings drawers. `ex-stage` for the full-bleed canvas.
- **Controls:** `ex-slider` (1px track, square thumb), `ex-checkbox` (sharp, minimal), `ex-toggle` (menu trigger).
- **HUD:** `ex-hud-br` (bottom-right, italic), `ex-hud-bl` (bottom-left), `ex-hud-tl` (top-left). All fixed, pointer-events: none.

## Design rules
1. **No accent color.** The canvas provides the color. UI stays monochromatic.
2. **Mono is the interface.** Labels, controls, data, HUD — all JetBrains Mono.
3. **Serif is for naming.** Titles and piece names are EB Garamond italic. Used sparingly.
4. **Glass over void.** Panels float on `backdrop-filter: blur`. Never solid backgrounds.
5. **Sharp and small.** `1px`–`2px` radii. `10px` thumbs. `28px` checkboxes. The UI is quiet.
6. **Lowercase HUD.** `expansion` · `frame 1423` · lowercase, dim, italic where appropriate.

## Building Expansion Study surfaces
- Start every HTML file with `<link rel="stylesheet" href="design-system/styles.css">`.
- **Experiment page:** `<div class="ex-stage"><canvas></canvas></div>` + HUD elements + `<div class="ex-slide-panel">` for controls.
- **Settings panel:** Nested `ex-group` sections with `ex-group-title` headers + `ex-slider` / `ex-checkbox` controls.
- **HUD:** `ex-hud-tl` for title, `ex-hud-br` for frame counter / attribution, `ex-hud-bl` for status.

If invoked without guidance, ask what Expansion Study surface they want to build, then act as an expert designer who outputs HTML artifacts or production code.
