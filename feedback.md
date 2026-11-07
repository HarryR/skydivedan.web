# Review Feedback

> **How this file works:** reviewers add findings below. Once a finding is resolved, or a decision is made either way (fixed, won't fix, or deferred), **remove it from this file**. Record lasting design decisions in the design docs, and the change itself in the commit message. This file only holds open items, so an empty list means nothing is waiting.

## Open findings

These findings are a review of [art.md](art.md), made before sprite generation and integration start. Most are information the art pass needs from the current code. Resolve each one by adding the contract to art.md (or deciding against it), then remove it here.

### 1. Cloud art must fill the bounce band

**Priority: High.** In [src/world.js](src/world.js) and [src/simulation.js](src/simulation.js), a cloud's visual box is `w × 0.45w` world units, with `w` from 70 to 150. Dan bounces when his feet enter the band covering the **full box width** and the **middle 3/5 of its height** (`CLOUD_BAND_TOP` 0.2 to `CLOUD_BAND_BOTTOM` 0.8 in [src/config.js](src/config.js)). The art must fill the box, with its widest opaque part across the band. Puffs can sit in the top 20%, and the bottom 20% can taper. A cloud that is narrow at mid-height makes Dan bounce on empty sky at its edges.

art.md's line "the art can vary while the collision rule stays predictable" invites exactly this mismatch. State the constraint in art.md. Use `?debug` to check alignment: it draws each cloud's box faintly and its band in red.

### 2. No export sizes are defined

**Priority: High.** The largest view is 900 world units across a canvas backing of at most 2560 device pixels (`VIEW_H_MAX`, `MAX_BACKING_PX`). That is about 2.85 device pixels per world unit at most. Export at 3–4 px per world unit:

| Asset | World size | Suggested export |
|---|---|---|
| Dan (whole figure) | 22 × 34 collider | ~88 × 136 px |
| Cloud | up to 150 × 68 | ~512 px wide |
| Coin | radius 11 | 64–96 px square |
| Title logo | stage width | ~1024 px wide |

Without these numbers, generated images will arrive at 1024² for 22-unit sprites, wasting memory on phones.

### 3. Dan's anchor, pivots, and facing

**Priority: Medium.** Dan's anchor is his feet point, at the bottom centre of the collider. Shoe soles must sit exactly on it.

A part rig needs a small data file listing each part's image, its pivot in pixels, and the pixels-per-world-unit scale. The procedural pose code in [src/render.js](src/render.js) `drawDan` drives the limbs from this data.

Draw all art **facing right**. The renderer mirrors Dan with `scale(-1, 1)`, so the lighting must work when flipped: light from directly above, not from one side.

### 4. Pre-bake cloud variants at load, not per spawn

**Priority: Medium.** art.md says to "cache or flatten that composition" when a cloud spawns. Clouds spawn continuously, so creating a canvas per spawn breaks the no-allocation rule for the hot path in [SIMULATION_DESIGN.md](SIMULATION_DESIGN.md).

Instead, compose about 8–12 variants into offscreen canvases when the game loads. Each cloud picks a variant from its seed and is drawn scaled into its `w × h` box.

### 5. Specify the palette and the contrast requirement

**Priority: Medium.** These are the actual colours in [src/render.js](src/render.js):

| Element | Colour |
|---|---|
| Sky near the ground | `rgb(140,205,245)` |
| Sky at the top | `rgb(18,24,70)` |
| Ground | `#4caf50` |
| Dan red | `#e53935` |
| Coin gold | `#ffd54f` |

Pure white clouds nearly disappear against the light sky near the ground. Require a soft blue underside or outline, and test against both ends of the sky.

### 6. Image-generation pitfalls and tooling

**Priority: Medium.**

- Generated "transparent" PNGs often contain a painted checkerboard. Verify that each image has a real alpha channel and transparent corners.
- Generate each family (all cloud components, all Dan parts) in **one sheet**, then slice it. Separate generations drift in style.
- Process images with the **Python PIL (12.x) and ImageMagick already installed**. Do not install anything: no npm, no sharp, no Node tooling on this machine.

### 7. Integration rules

**Priority: Medium.**

- Use relative paths (`./assets/...`). The Pages workflow already publishes `assets/` when it exists.
- Load images asynchronously and keep the current procedural drawing as the fallback until they load, and if they fail. The game must never block or break on art.
- The logo should be an `<img alt="Sky Dive Dan">` inside the existing `.title` element, so the text title still works without it.

### 8. Asset order for the hackathon

**Priority: Low.** Suggested order: clouds first (they cover the screen and carry the bounce-band risk from finding 1), then coins, the logo, and Dan's rig. The procedural Dan already reads clearly, so his rig is the most expensive item with the least visible gain. This conflicts with art.md's workflow order, so decide which order wins.
