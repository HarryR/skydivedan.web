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

**Current: a sprite rig from the v01 parts** ([src/danart.js](src/danart.js)), using `dan-body-v01` (head, torso and backpack), `dan-arm-v01`, and `dan-leg-v01`. Each limb image is reused for the front and back limbs; back limbs are drawn darker and behind the body. Every frame, the rig is composed into one small reused offscreen canvas at 3 px per world unit with smoothing off, so rotated limbs and the body share one crunchy pixel grid. That canvas is then drawn into the world and mirrored for facing. Limb angles come from gameplay state, as the procedural Dan did: arms wave forward and up while falling and swing down while rising, and the legs spread slightly when falling. The splat squashes the composed sprite flat onto the ground. The procedural Dan in [src/render.js](src/render.js) remains the fallback until the parts load, and if they fail.

- Shipped parts (`tools/crunch.py`, 3 px/world unit): `dan-body-v01-49.png` (24 colours), `dan-arm-v01-52.png`, and `dan-leg-v01-24.png` (16 colours). About 2 KB in total.
- **Pivots and sizes** were measured from the tight-cropped v01 sources. They live as constants in `danart.js`: joint fractions per part (body hip and shoulders, arm shoulder, leg hip) and each part's height in world units (body 23.8, arm 8.4, leg 14.4). If a part is regenerated, re-measure that part's pivots and size.
- The v01 parts were generated at unrelated scales and without pivot data, so the scales and joints were set by eye. If they're regenerated, generate all parts together on one sheet at a shared scale, with marked joints (shoulder ball centre, hip ball centre, sole line).
- Dan's physics anchor is the bottom-centre feet point. Shoe soles meet this anchor exactly. Draw all parts facing right; the renderer mirrors Dan for left-facing movement.
- Keep visual sprites separate from physics hitboxes. The art does not change Dan's 22 × 34 world-unit collider or anchor point. Limbs extend beyond the collider.

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

- Save each generated full-resolution draft in `assets/originals/` with a stable, versioned filename (for example, `title-logo-v01.png`, `title-logo-v02.png`). Keep earlier versions so they can be compared and swapped in; do not overwrite a prior draft. The directory is gitignored (local only, large files) and GitHub Pages does not publish it.
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

- **Source:** the full-resolution generated draft in `assets/originals/` (for example, `assets/originals/title-logo-v01.png`). Keep it locally for future edits and re-exports. The game never loads it; it is gitignored and not deployed.
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
