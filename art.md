# Sky Dive Dan — Art Direction

This document is the home for the game's visual style and art-asset decisions. Keep implementation and simulation details in their existing guides.

## Overall style

- Simple, colorful, cartoonish, and a little dreamy.
- Early-2000s Flash game clarity, with hints of 1990s Mega Drive character.
- Favor strong silhouettes, expressive poses, and a few clear colors over texture and detail.
- Keep Dan, clouds, coins, and interface elements easy to read against the altitude-changing sky.
- Preserve a consistent outline weight, lighting direction, and color treatment across generated assets.
- Use light from above and a restrained outline so assets remain clear when Dan is mirrored and against both the pale lower sky and dark upper sky.

### Current palette reference

These are the placeholder renderer colors to build from, not an immutable palette:

| Element | Current color |
|---|---|
| Sky near the ground | `rgb(140, 205, 245)` |
| Sky at the top | `rgb(18, 24, 70)` |
| Ground | `#4caf50` |
| Dan's suit | `#e53935` |
| Coins | `#ffd54f` |
| Clouds | White with a soft blue underside or outline |

## Title logo

- The logo is a transparent PNG wordmark containing stylized **Sky Dive Dan** lettering.
- Keep it as text art: do not integrate Dan, the plane, or the lunch-parachute gag into the mark.
- Make the static wordmark strong and readable at the start-screen size first. Motion, bounce, or other effects are optional last-minute polish.
- Keep the spelling exact. If generated lettering is not clean, use generated graphic treatment as a reference and finish the lettering with accurate vector typography before exporting the transparent PNG.
- Target roughly 1024 px wide, with a transparent background and enough empty margin for responsive scaling.
- Integrate it as an asynchronously loaded image inside the existing semantic title element, using a relative asset path. Keep accessible text as the fallback and show it if the image fails to load.

## Dan

- The current Canvas drawing is a useful procedural cutout and animation prototype. Keep using it while movement and poses are being tuned.
- For final artwork, the preferred direction is a compact layered sprite rig: backpack, torso, head, arms, hands, legs, and shoes with defined pivots. Continue driving the limbs from gameplay state so falling, rising, boosting, and facing direction remain responsive.
- Dan's physics anchor is the bottom-centre feet point. Shoe soles should meet this anchor exactly. Draw all parts facing right; the renderer mirrors Dan for left-facing movement. Use overhead lighting so the mirrored version still looks correct.
- Keep visual sprites separate from physics hitboxes. Replacing the placeholder art should not change Dan's 22 × 34 world-unit collider or anchor point. Limbs can extend beyond the collider.
- Store rig metadata in a small data file: each part's relative asset path, source rectangle, pivot in source pixels, and source-pixels-per-world-unit scale. Keep transparent padding around limbs so rotations do not clip.
- Create a consistent character reference before generating individual parts, so clothing, proportions, and color treatment match.

## Clouds

**Decision: clouds are procedural, not sprites.** [src/cloudart.js](src/cloudart.js) draws each cloud every frame as random ovals and circles inside its box, generated from the cloud's 32-bit seed. A given cloud looks the same every frame, and nothing is stored or allocated per cloud. No cloud image assets are needed. All tuning lives in [src/config.js](src/config.js) (`CLOUD_*` art settings), so shape and style changes show up on reload.

- **Style**, taken from `assets/originals/cloud-components-v01.png`: navy outline, soft-blue underside, pale body, and white caps. These are drawn as four layered passes over the same shapes: outline grown by `CLOUD_OUTLINE`; shade; body with its bottom lifted by `CLOUD_SHADE_LIFT`; white cap with `CLOUD_TOP_LIFT`. The outline keeps clouds readable against the light lower sky.
- **Shape and collider:** the cloud's box is `w × 0.45w` world units. A row of 2–3 base ovals spans the full width across the bounce band (20%–80% of the box height). 2–4 puffs sit on top, and one of them touches the box top. This makes the visible body line up with where Dan bounces. Check alignment with the `?debug` overlay, which draws the box and band.
- The generated `cloud-puff-v01`–`v04` drafts are not used. They have no outline, so they vanish against the light sky. Their soft, glowing alpha edges turn into grey fringes when crunched. Their proportions don't fit the box (v03 is square, v04 is a sliver).
- If a pixel look is wanted later, render the same shapes into a low-resolution offscreen canvas and draw it with smoothing off.

## Other game art

- Coins should remain high-contrast and immediately recognizable. A short sparkle can mark a coin that spawns on-screen.
- Fart puffs and the splat can be expressive and silly, while remaining visually distinct from the collectible clouds.
- The plane and lunch-parachute reveal are opening-scene art, separate from the title logo.
- Parallax stars, mountains, trees, and grass are optional scenery polish after the character, clouds, and coins read clearly.

## Asset workflow

- Save each generated full-resolution draft in `assets/originals/` with a stable, versioned filename (for example, `title-logo-v01.png`, `title-logo-v02.png`). Keep earlier versions so they can be compared and swapped in; do not overwrite a prior draft. GitHub Pages does not publish `assets/originals/`.
- Shipped (crunched) copies go directly in `assets/` (see [Source vs shipped assets](#source-vs-shipped-assets-file-size)).
- The first title-logo concept is `assets/originals/title-logo-v01.png`; the game loads `assets/title-logo-v01-256.png`.

1. Establish a small style reference and confirm the palette.
2. Clouds are done procedurally (see [Clouds](#clouds)); tune them in config rather than generating art.
3. Add a readable coin sprite.
4. Create the static wordmark and check it at phone size.
5. Consider Dan's layered rig last; the procedural Dan already reads clearly, so only replace him if time allows and the art meaningfully improves the game.
6. Review actual PNG alpha transparency and readability against both light and dark sky backgrounds in Canvas.
7. Add animation, particles, and other motion effects last.

For generated sheets, create each visual family together (all cloud parts on one sheet, all Dan rig parts on one sheet) to reduce style drift between separate generations. Verify that transparent corners have real alpha, not a painted checkerboard. Existing Python PIL 12.x and ImageMagick are available for slicing and export; do not add a new image-processing dependency for this pass.

Use relative paths such as `./assets/coin.png` for GitHub Pages. Load images asynchronously and keep the current procedural rendering as a fallback until assets load and if they fail. The Pages workflow publishes `assets/` when present, excluding `assets/originals/`.

Favor transparent PNG assets for illustrated sprites and the logo. Add enough atlas padding for limb pivots without making each small sprite excessively large.

### Source vs shipped assets (file size)

The look is **crunchy pixels and an 8-bit aesthetic**, and file size matters, especially on phones. Every asset therefore exists in two forms:

- **Source:** the full-resolution generated draft in `assets/originals/` (for example, `assets/originals/title-logo-v01.png`). Keep it for future edits and re-exports. The game never loads it, and it is not deployed.
- **Shipped:** a small crunched copy that the game loads, named with its width as a suffix (for example, `title-logo-v01-256.png`). Make it with `python3 tools/crunch.py SRC OUT --width W --colors N`. The script crops to the visible pixels, downscales, applies 1-bit alpha, and reduces to a small undithered palette. It then runs `pngcrush` if installed (it is here), which recompresses losslessly; no separate crushed file is needed. It uses only Python and Pillow, plus the system pngcrush.

Display shipped assets hard-edged: `image-rendering: pixelated` in CSS, and `ctx.imageSmoothingEnabled = false` when drawing sprites on Canvas. Budget about **20 KB per shipped asset** and about **150 KB total**. A source PNG can be over 1 MB, so never reference one from the game.

| Asset | World size | Shipped size (starting point) |
|---|---|---|
| Title wordmark | — | **256 px wide, 16 colours** (`title-logo-v01-256.png`, 4.5 KB after pngcrush, from a 1.4 MB source) |
| Game-over wordmark | — | **256 px wide, 16 colours** (`game-over-logo-v01-256.png`, 4.4 KB, from a 1.3 MB source) |
| Paused wordmark | — | **256 px wide, 16 colours** (`paused-logo-v01-256.png`, 2.4 KB, from an 883 KB source). English-only, so the Vietnamese UI shows the translated text heading instead (`.logo-en-only`). |
| Dan base at the collider size | 22 × 34 world units | about 2 px/world unit: ~44 × 68 px; rig limbs need atlas padding |
| Coin | 22 world-unit diameter | ~24–32 px square |

Generate sources at 3–4 px per world unit or higher so there is detail to crunch from. Adjust shipped sizes and palette counts by eye in the game. Lower is fine as long as the art still reads.
