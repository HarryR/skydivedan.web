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

- Build a small family of matching transparent cloud components rather than one repeated cloud image.
- Use base/body pieces and rounded puffs in a few sizes and silhouettes. Compose overlapping components into small, medium, and large clouds with varied but coherent outlines.
- The cloud's visual box is `w × 0.45w` world units. Art must fill that box, and the opaque silhouette must span the full width throughout the bounce band (20%–80% of the box height). Puffs may add shape in the top 20%; the bottom 20% may taper. A cloud that narrows inside the band makes Dan bounce on empty sky.
- Keep the bounce collider as separate data, but make its full-width band visually supported by opaque cloud art. Check alignment with the `?debug` overlay, which draws the box and bounce band.
- Generate a coordinated component sheet, then compose about 8–12 finished cloud variants into offscreen canvases once at load. At spawn, choose a cached variant using the cloud's seeded variant id and scale it to `w × 0.45w`; do not allocate a new canvas or rebuild a composition for each spawn.
- Keep components consistent in outline, shading, light direction, and white/soft-blue palette. Pure white needs a soft-blue underside or outline to stay visible against the lower sky. Avoid seams and a tiled, modular look.

## Other game art

- Coins should remain high-contrast and immediately recognizable. A short sparkle can mark a coin that spawns on-screen.
- Fart puffs and the splat can be expressive and silly, while remaining visually distinct from the collectible clouds.
- The plane and lunch-parachute reveal are opening-scene art, separate from the title logo.
- Parallax stars, mountains, trees, and grass are optional scenery polish after the character, clouds, and coins read clearly.

## Asset workflow

- Save each generated draft in the project `assets/` directory with a stable, versioned filename (for example, `title-logo-v01.png`, `title-logo-v02.png`). Keep earlier versions so they can be compared and swapped in; do not overwrite a prior draft.
- The first title-logo concept is `assets/title-logo-v01.png`. It is a draft for visual direction, not yet the approved in-game logo.

1. Establish a small style reference and confirm the palette.
2. Generate the cloud component sheet first; slice it into assets and bake 8–12 variants. Check the bounce band in the game.
3. Add a readable coin sprite.
4. Create the static wordmark and check it at phone size.
5. Consider Dan's layered rig last; the procedural Dan already reads clearly, so only replace him if time allows and the art meaningfully improves the game.
6. Review actual PNG alpha transparency and readability against both light and dark sky backgrounds in Canvas.
7. Add animation, particles, and other motion effects last.

For generated sheets, create each visual family together (all cloud parts on one sheet, all Dan rig parts on one sheet) to reduce style drift between separate generations. Verify that transparent corners have real alpha, not a painted checkerboard. Existing Python PIL 12.x and ImageMagick are available for slicing and export; do not add a new image-processing dependency for this pass.

Use relative paths such as `./assets/clouds.png` for GitHub Pages. Load images asynchronously and keep the current procedural rendering as a fallback until assets load and if they fail. The Pages workflow publishes `assets/` when present.

Favor transparent PNG assets for illustrated sprites and the logo. Add enough atlas padding for limb pivots without making each small sprite excessively large.

### Source vs shipped assets (file size)

The look is **crunchy pixels and an 8-bit aesthetic**, and file size matters, especially on phones. Every asset therefore exists in two forms:

- **Source:** the full-resolution generated draft (for example, `title-logo-v01.png`). Keep it for future edits and re-exports. The game never loads it.
- **Shipped:** a small crunched copy that the game loads, named with its width as a suffix (for example, `title-logo-v01-256.png`). Make it with `python3 tools/crunch.py SRC OUT --width W --colors N`. The script crops to the visible pixels, downscales, applies 1-bit alpha, and reduces to a small undithered palette. It uses only Python and Pillow.

Display shipped assets hard-edged: `image-rendering: pixelated` in CSS, and `ctx.imageSmoothingEnabled = false` when drawing sprites on Canvas. Budget about **20 KB per shipped asset** and about **150 KB total**. A source PNG can be over 1 MB, so never reference one from the game.

| Asset | World size | Shipped size (starting point) |
|---|---|---|
| Title wordmark | — | **256 px wide, 16 colours** (`title-logo-v01-256.png`, 5.9 KB, from a 1.4 MB source) |
| Dan base at the collider size | 22 × 34 world units | about 2 px/world unit: ~44 × 68 px; rig limbs need atlas padding |
| Largest cloud | 150 × 67.5 world units | about 2 px/world unit: ~300 × 135 px per baked variant |
| Coin | 22 world-unit diameter | ~24–32 px square |

Generate sources at 3–4 px per world unit or higher so there is detail to crunch from. Adjust shipped sizes and palette counts by eye in the game. Lower is fine as long as the art still reads.
