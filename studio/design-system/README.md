# Expansion Study — Design System

> Creative code lab. WebGL playground. Mono-forward HUD. Ink on void.

A design system tokenized from the existing creative-coding identity. Pure black void, warm-neutral ink, glass panel surfaces, EB Garamond italic titles, JetBrains Mono for everything else. Built for interactive WebGL experiments where the canvas is the hero and the UI is a quiet observer.

---

## Quick start

```html
<link rel="stylesheet" href="design-system/styles.css">
```

Every token is a CSS variable: `var(--ink)`, `var(--panel)`, `var(--edge)`, `var(--font-mono)`.

---

## Visual foundations

**Environment.** Pure void (`#000`). The canvas owns the screen. UI surfaces float over it in glass panels — deep violet-black semi-transparent fills with `backdrop-filter: blur(14px)`.

**Color.** Monochromatic and warm-neutral. Ink at `rgba(235, 230, 220, 0.85)` is the primary text — warm, never cold. Dim ink at `0.38` for metadata. Faint ink at `0.18` for disabled states. Panels at `rgba(12, 10, 14, 0.72)` — a subtle violet-black that distinguishes surfaces from pure void. Edges at `rgba(235, 230, 220, 0.08)`.

**No accent color.** This is intentional — the creative work on the canvas IS the color. The UI deliberately avoids competing.

**Type.** Two voices, stark contrast. **EB Garamond italic** — for titles, headings, the "name" of the piece. Used rarely. **JetBrains Mono** — for everything else. Controls, labels, HUD elements, data readouts, the settings panel. This is a code playground; mono IS the interface.

**Surfaces.** `ex-panel` — the signature glass panel. `ex-slide-panel` — the slide-in settings drawer (from the right, with a heavier blur). `ex-stage` — the full-bleed canvas container.

**Controls.** Custom-styled range sliders (`ex-slider`), checkboxes (`ex-checkbox`), and toggle buttons (`ex-toggle`). All built to match the mono-forward aesthetic — 1px tracks, 10px square thumbs, sharp radii.

**Motion.** Quick and technical. `160ms` for micro-interactions, `320ms` for panel slides on `cubic-bezier(0.4, 0, 0.2, 1)`. Canvas runs at its own frame rate.

---

## Voice & tone

Minimal. The canvas speaks; the UI is quiet.

- **HUD text:** Lowercase, terse, italic for bottom-right attribution. `expansion` · `frame 1423` · `d.m`
- **Labels:** Lowercase mono, dim. `noise scale` · `particle count` · `speed`
- **Titles:** EB Garamond italic, warm. "Expansion study" · "Field · v3"
- **No marketing. No calls to action.** This is a lab, not a product page.

---

## Source DNA

| From | What |
|---|---|
| **Original identity** | All tokens were extracted from the existing `index.html` — ink, panel, edge, mono HUD, glass slider panel, the EB Garamond + JetBrains Mono pairing |
| **Umbrum** | Glass panel approach, mono-forward UI, sharp radii, the "no accent — canvas is the color" philosophy |

---

## Files

```
design-system/
  styles.css          ← link this only
  tokens/
    colors.css        ← void, panel, ink, edge (no accent)
    typography.css    ← EB Garamond titles, JetBrains Mono for everything
    effects.css       ← glass panels, slide panel, custom controls, stage
    base.css          ← reset, overflow-hidden default
  README.md           ← this file
  SKILL.md            ← AI-codeable frontmatter
```
