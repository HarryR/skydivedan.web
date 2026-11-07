# Sky Dive Dan — Technical Implementation Guide

This is the initial implementation plan for a small, static, plain JavaScript game. The aim is to get a complete playable loop quickly while choosing a few foundations that are expensive to replace later. Physics values, spawn rates, and art details should remain easy to tune.

## Implementation approach

Build in layers, using placeholder shapes until the core loop feels good:

1. **Static page and canvas:** create a responsive page that runs directly from static files and works under a GitHub Pages subpath.
2. **Input and camera:** map keyboard and pointer gestures to shared game actions; draw world coordinates through a following camera.
3. **Minimal run:** implement Dan's steering, simple gravity, a fixed-capacity pool of drifting clouds, cloud bounce, and ground collision. Replenish clouds off-screen, but skip the tile grid for this first playable version.
4. **Coins and fart:** add coin pickups and randomized replenishment, coin-funded boost, and score.
5. **End and restart:** keep the splat and game-over screen, show final/best balance, and allow restart.
6. **Robustness:** add pause and hidden-tab behavior, then improve collision handling or interpolation if play reveals a need.
7. **Presentation:** add the intro screen, Vietnamese/English toggle, opening lunch gag, art, sound, and optional scenery. If time is tight, defer these before cutting the core mechanics.

Keep each step playable. Do not start with a general-purpose engine, entity-component framework, WebGL layer, or bitmap collision system. The fixed cloud pool bounds work without tiles; profile before adding more machinery. Tile streaming is a post-hackathon extension, not part of this build order.

## Small module layout

Keep modules focused without splitting every entity into its own file:

```text
index.html
styles.css
src/
  main.js          // boot, canvas sizing, animation scheduling
  game.js          // state machine, start/restart/end of a run
  input.js         // keyboard and pointer state -> steer/boost actions
  simulation.js    // fixed-step player, collision, score and boost rules
  world.js         // bounded cloud pool and coin spawner; tile grid can follow later
  render.js        // camera transform, Canvas drawing and debug overlay
  ui.js            // intro, HUD, game-over, local best score
  i18n.js          // English/Vietnamese strings and language selection
  config.js        // world dimensions and gameplay tuning values
assets/            // optional sprites, sounds, fonts
```

Use native ECMAScript modules and relative imports/assets so the project needs no build step and can be hosted as a static GitHub Pages site. Keep asset URLs relative (for example `./assets/dan.png`) so deployment under a repository path works. If the game grows, modules can be split later without changing the conceptual boundaries.

## Decisions to settle before implementation

These decisions affect multiple systems. The guide includes starting recommendations; mark them as confirmed or changed before code depends on them.

| Decision | Recommended starting point | Why it is expensive to change later |
|---|---|---|
| **Screen orientation and logical canvas size** | **Confirmed:** the stage follows the window's aspect ratio clamped between tall portrait (9:20) and square, and is letterboxed beyond that. The visible world grows sublinearly with stage size up to a maximum, then scales up. Touch controls keep the bottom-centre fart button. Details: [SIMULATION_DESIGN.md](SIMULATION_DESIGN.md#viewport-size). | It affects camera framing, world visibility, UI placement, touch zones, and how much simulation space must be active. |
| **World coordinate convention** | World `x` increases right; world `y` increases down; altitude is derived from `groundY - danY`. Keep physics in world units, independent of CSS pixels and device pixel ratio. | Every movement, collision, tile coordinate, altitude curve, and camera transform relies on this convention. |
| **World window and entity capacity** | First playable build: fixed cloud pool around a camera-following Dan, without tiles. Add the tile grid later if time allows. | World bounds and entity capacity determine memory and CPU limits; tile layout also affects world generation and collision lookup. See [SIMULATION_DESIGN.md](SIMULATION_DESIGN.md) for the detailed contract. |
| **Cloud replacement and random seed** | Seed one run-level spawner. Refill a cloud slot off-screen when its cloud exits the simulation window; initialize its trajectory once. | Changing replacement rules or time basis can create visible respawns or alter the stream density; detailed rules live in [SIMULATION_DESIGN.md](SIMULATION_DESIGN.md). |
| **Cloud motion and collision timing** | Store analytic cloud paths; use fixed-step player physics. Clouds bounce Dan when his feet enter the cloud's bounce band from either direction. Add the fractional swept test only if sideways clipping at cloud edges shows up in playtesting. | Collision ordering and platform response affect movement feel; detailed procedure and upgrade path live in [SIMULATION_DESIGN.md](SIMULATION_DESIGN.md). |
| **Input gesture contract** | **Confirmed:** desktop uses arrows or A/D to steer and W, Up Arrow, or Space to fart. On mobile, horizontal drag offset from gesture start steers like a floating joystick: `steer = clamp(offsetX / 40 CSS px, -1, 1)`. A drag beginning on the bottom-center fart button boosts and uses that same steering rule until release; a drag beginning elsewhere steers only. Use pointer capture. | Input ownership, pointer capture, and page-scroll behavior affect the HUD and can be awkward to patch after touch controls are built. |
| **Score and high-score meaning** | **Confirmed:** coin balance is the current score; fart spends from it; score at death is the final balance and is saved as the local best. | Peak score, total coins collected, and final balance produce different incentives around spending boost fuel. The saved value also needs a stable definition. |
| **Language preference** | Detect `vi` from `navigator.languages`, otherwise default to English; the explicit toggle overrides detection and persists locally. Keep all visible strings behind translation keys. | Scattered literal text is easy to miss when adding Vietnamese; language preference affects start screen, controls, HUD, and game-over UI. |
| **Canvas vs DOM responsibility** | Canvas draws the moving world; DOM/CSS handles buttons, instructions, score labels, and language toggle. | A DOM overlay is easier to make touch-friendly and responsive; putting all text into Canvas creates extra scaling, hit-testing, and localization work. |
| **Asset anchors and hitboxes** | Store sprite anchor and collision shape separately in world units; use simple AABB/capsule Dan hitbox and a full-width cloud bounce band (middle 3/5 of the cloud's height). | Art changes should not alter physics. Coupling collision to sprite dimensions creates repeated tuning when images are replaced. |
| **Static hosting paths** | No bundler initially; use relative module and asset paths. | Root-absolute paths commonly work locally but break when Pages serves the site from `/repo-name/`. |

## Runtime and simulation source of truth

[SIMULATION_DESIGN.md](SIMULATION_DESIGN.md) is the single source for the fixed-step loop, catch-up limit, render cadence, pause and hidden-tab behavior, simulation window and tile recycling, cloud replacement, and collision procedure. Keep detailed rules there rather than duplicating them in this guide or the game plan.

The UI uses a small state machine for the introduction, opening, run, fall/splat, and game-over flow; the simulation document defines pause behavior. DOM/CSS handles buttons, instructions, score labels, and language selection; Canvas draws the moving world. Store the final coin balance as the local best score.

## Keep these easy to tune

Put values in `config.js` or a single balance object rather than scattering them through update code:

- simulation rate and active-window dimensions; add tile dimensions if streaming is implemented
- Dan's horizontal acceleration, maximum speed, drag, gravity, and cloud bounce
- fart drain and lift as a function of current coin balance
- cloud size, density, drift speed, and altitude curves
- coin target, `rho_coin`, placement range, and pool cap
- camera follow smoothing/dead zone and ground/vertical bounds
- canvas resolution scale, colors, animation timings, and UI spacing

Changing these should not require rewriting the collision model or world pool.

## Confirmed interaction and score decisions

- The stage fits the window: square on landscape desktop, portrait on phones (aspect clamped to 9:20–1:1). The visible world grows with window size up to a cap, then scales up.
- Clouds bounce Dan both when he falls onto them and when he rises up through them (bounce band: full width, middle 3/5 of the height).
- Mobile steering uses horizontal offset from where the touch began, like a floating joystick. Full steer is reached at about 40 CSS pixels and input clamps beyond that. The fart-button gesture uses the same rule while held.
- The best score is the final coin balance at death, after all fart spending.

Other numerical values remain tunable during the first playable build.
