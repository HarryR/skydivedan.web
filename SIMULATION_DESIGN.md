# Sky Dive Dan — Simulation Design

This document describes a small, bounded simulation for the first version of the game. The goal is a predictable CPU budget and readable code that can be tuned by feel. Optimization should protect the hot path without making ordinary game rules hard to change.

## Principles

- Keep the active cloud/coin pools bounded by constants. If tiles are added, bound the active tile count too.
- Separate the player's physics from rendering. Use a configurable fixed simulation step; let `requestAnimationFrame` set rendering cadence initially.
- Treat simple cloud drift as an analytic path through time, rather than updating every cloud on every step.
- Use cheap broad-phase collision checks to find candidates, then accurate hitboxes for the few candidates that remain.
- Start with bounded, predictable loops. Add bitmaps or more elaborate indexing only if profiling shows collision scans are expensive.
- Keep positions and hitboxes in world units. The camera and canvas scale only affect drawing.

## World window and budget

The eventual streamed world is divided into tiles. A fixed-size window follows Dan: tiles near and ahead of him are active, and tiles outside the window are retired. For example, a `5 × 5` active grid is 25 tiles. The final dimensions and tile size are tuning constants. For the first playable build, use a fixed cloud pool in the moving bounded window and defer the tile grid; the pool already caps entity work.

Set a maximum number of clouds in the active cloud pool and a separate cap for the active coin pool. Tiles are spatial coverage and recycling cells; clouds can cross tile boundaries, so their current positions do not have to stay in their generation tile. That makes the worst-case candidate count explicit:

```text
max active clouds = cloud pool capacity
max active coins  = coin pool capacity
```

These are upper bounds; sparse upper-altitude regions can contain fewer clouds. Seed the cloud spawner from the run seed and use it to choose replacement positions and movement parameters. Coins are managed independently by a coin spawner, not attached to cloud paths. Generate or recycle tiles only when the window moves. A recycled tile slot must carry its current tile coordinates so stale data cannot be mistaken for the new tile.

Distinguish the camera viewport (what the player sees) from the larger simulation window (the bounded region with active entities). The off-screen margin gives clouds room to move before entering view. Clouds may cross tile boundaries without changing direction; tile boundaries are not walls or cloud behavior. A cloud is removed after its complete hitbox leaves the simulation window. Replace it off-screen so the active cloud count stays near its altitude-dependent target. Clouds must never be initialized inside the camera viewport; they move into view along their existing paths.

For a replacement cloud, choose a spawn point inside the simulation window but outside the camera viewport (to the sides, above, or below). If it spawns left of Dan, give it a rightward horizontal velocity; if it spawns right of Dan, give it a leftward velocity. Add only a modest randomized vertical component if desired. This creates a stream passing through Dan's area from both sides without placing a newly initialized cloud visibly on top of the player.

## Viewport size

The camera viewport is not a fixed size. The page layout fits the stage to the window: it keeps the window's aspect ratio, clamped between tall phone portrait (9:20) and square, and letterboxes anything beyond that. A landscape desktop gets a square stage; a phone gets close to full screen.

The visible world height grows with the stage's CSS height, but sublinearly (square root), and clamps between a minimum and a maximum (560–900 world units initially). A bigger window or tablet shows a little more of the world. Past the maximum, for example on a large 4K display, the same world area is drawn larger and the canvas backing store follows `devicePixelRatio` so it stays sharp. UI text and buttons scale with the stage.

The camera carries its visible width and height in world units. Everything derived from the viewport, including the simulation window, off-screen spawn rules, density scaling, and camera limits, reads the camera's current size. A resize during a run takes effect on the next step.

## Cloud motion without per-cloud ticks

For straight-line drift, store the cloud's starting world position, velocity, and game-time spawn point. Its position at any time is:

```js
x = startX + velocityX * (gameTime - spawnTime);
y = startY + velocityY * (gameTime - spawnTime);
```

Use game time, not `Date.now()`, so pausing a run also pauses cloud motion. Generate a replacement's initial position and movement parameters once when its pool slot is refilled; do not recreate it at its initial position merely because it becomes visible. A run-seeded spawner can make the sequence reproducible.

The simulation asks for a cloud's position at each physics timestamp for collision checks. The renderer can ask at display time for smooth cloud motion. Dan can initially render at the most recent physics state; interpolation between player states is optional if a low simulation rate looks too choppy. If clouds later need to bob or follow a curved path, use a small analytic function of time where practical; reserve per-tick state for motion that depends on collisions or player interaction.

## Cloud population and replacement

Keep a target cloud count based on Dan's altitude, separate from the tile grid. The target is higher near the ground and lower up high, matching the intended difficulty curve. The pool capacity is the hard upper bound; `cloudTarget(altitude)` is the desired population below that cap.

The visible area depends on the screen (see [Viewport size](#viewport-size)), so targets are defined as densities. The configured cloud and coin targets are counts for a reference simulation window (a 360 × 640 view plus margins), and they are multiplied by the actual window area divided by that reference area. A larger view shows the same density, not a sparser sky. Coin spawn rates scale the same way. Pool capacities must cover the largest view.

When a cloud's complete bounds leave the simulation window, retire it and refill the freed slot with a seeded random replacement. Place replacements anywhere in the simulation window that is fully outside the camera viewport (plus a small margin), within the cloud altitude band. That includes the areas above and below the view, so a fast fall still finds clouds ahead. Point the cloud horizontally toward Dan: a cloud left of him moves right, a cloud right of him moves left. Its initial position, spawn time, velocity, and size are generated once for that slot and its trajectory is evaluated analytically. If altitude changes the target, add or retire clouds to approach the new target without exceeding pool capacity.

**Why spawn above and below the view, not only at the sides:** the camera moves vertically all the time, with bounces of a few hundred units and fast falls, so the areas above and below the view are where the player looks next. The simulation window works as a hysteresis band for object permanence. Clouds are created just outside the viewport and only retired once they have left the much larger window, so nothing ever appears or disappears on screen, and a cloud the player has seen stays put while the camera moves around nearby. Spawning only in side bands would leave the sky empty above and below during a fall or a big bounce. Some clouds spawned far above or below will be retired without ever being seen. That is expected: the target is a uniform density over the window, not a count of clouds guaranteed to become visible.

Unlike coins, cloud replacement does not need a randomized wait after a pickup. The cloud count drops when a cloud exits the bounded area, then returns toward target with an off-screen replacement. Keep a small minimum off-screen travel distance so replacements cannot immediately appear in the camera view.

## Timing loop and pause behavior

`requestAnimationFrame` drives rendering at the browser's repaint cadence; there is no separate render cap. The simulation runs at 60 Hz by default (`SIM_HZ`), one step per frame on a 60 Hz display.

**Graceful degradation.** All physics uses per-second rates (gravity, steering, camera smoothing, spawn hazards, and band-crossing collisions), so the step can change at runtime without changing behaviour. A 30 Hz and a 60 Hz bounce peak within about 3.5% of each other. The frame loop keeps a smoothed frame interval. If the device stays below `SIM_DEGRADE_FPS` (45) for `SIM_DEGRADE_S` (2 s), it drops to `SIM_HZ_LOW` (30 Hz), halving simulation work per frame. After `SIM_RECOVER_FPS` (55) holds for `SIM_RECOVER_S` (8 s), it returns to 60 Hz. The gap between the thresholds and the timers prevents flip-flopping. Single long stalls (over 250 ms) are ignored by the controller and handled by the catch-up cap below. `?prof` shows the current rate.

Cap catch-up at five simulation steps per animation callback. This handles ordinary missed frames without allowing a long main-thread stall to monopolize the page. If more than five steps are due, discard the excess whole-step backlog and keep the fractional remainder. This deliberately skips simulation time after a severe hitch. The hidden-tab case is handled by pausing instead.

Initialize the timestamp before measuring elapsed time. On resume, reset the timestamp and accumulator so paused time is not simulated:

```js
const SIM_HZ = 60; // configurable; adaptive (see above)
const DT = 1 / SIM_HZ;
const MAX_CATCHUP_STEPS = 5;
let lastFrameMs = null;
let accumulator = 0;
let gameTime = 0;

function frame(nowMs) {
  if (gameState === "RUNNING") {
    if (lastFrameMs === null) lastFrameMs = nowMs;
    const elapsed = (nowMs - lastFrameMs) / 1000;
    lastFrameMs = nowMs;
    accumulator += elapsed;

    let steps = 0;
    while (accumulator >= DT && steps < MAX_CATCHUP_STEPS) {
      copyState(previousState, currentState); // write into preallocated state
      simulateStep(previousState, currentState, input, DT, gameTime);
      gameTime += DT;
      accumulator -= DT;
      steps++;
    }

    if (accumulator >= DT) accumulator %= DT; // discard excess whole steps
  } else {
    lastFrameMs = null;
    accumulator = 0;
  }

  render(currentState, gameTime + accumulator);
  requestAnimationFrame(frame);
}
```

The snippet renders the current player state without interpolation. If that looks too choppy, interpolate player and camera positions in a later pass; analytic cloud positions can still be drawn at `gameTime + accumulator`.

Pause behavior is part of the simulation contract:

- The top-corner pause icon opens `PAUSED`, displays an overlay with Resume and Restart, and freezes simulation/game time.
- When `document.visibilityState` becomes `hidden`, transition to `PAUSED`. When visible again, remain paused and show the overlay; require an explicit Resume.
- On Resume, set `lastFrameMs = null` and `accumulator = 0` before requesting another animation frame.
- Clear held steering/boost inputs on pause and ignore run controls while paused.

## One simulation step

Keep the hot path in a fixed order. Use elapsed seconds (`dt`) for rates such as gravity and coin drain.

1. Read the current input state. Left/right controls steering; held **W**, **Up Arrow**, **Space**, or the mobile fart gesture requests boost.
2. If tile streaming is enabled, ensure the fixed tile window around Dan is current and recycle slots only when world coordinates change. The first playable build can skip tiles.
3. Save Dan's previous position; apply steering acceleration, friction, gravity, and any coin-funded upward boost.
4. Compute Dan's proposed position for this step.
5. Evaluate active cloud positions at this simulation time; retire clouds beyond the simulation window and fill freed slots off-screen toward the altitude target.
6. Scan the bounded cloud pool for bounce-band entries (see [Cloud bounce](#cloud-bounce)): Dan's feet entering a cloud's band from above or below, with horizontal overlap. The nearest entry wins.
7. Check nearby coin candidates and collect each coin at most once; advance the coin spawn process.
8. Apply ground collision, score/high-score state, and game-over transitions.
9. Update the camera target. Render after simulation; add interpolation only if the initial movement looks too choppy.

The exact order of boost, gravity, and bounce affects the feel. Keep it explicit and tune it rather than hiding it in a general physics engine.

## Coin availability and randomized spawning

Coins are independent world pickups, not children of clouds. Like clouds, they are kept at a **target density over the whole simulation window**, not clustered around Dan, so areas he moves into already have coins at the right density. Coins never spawn inside the camera viewport (plus a small margin), and never on top of Dan.

Use two separate height-dependent tuning values:

- `coinTarget(height)`: the desired number of coins in the simulation window, scaled by window area like the cloud target. This is higher near the ground and lower at altitude.
- `rho_coin(height)`: the rate, in coins per second, at which collected coins are allowed to respawn.

Coins are retired and replaced in two different ways:

- **Leaving the window** (Dan moved away): retire the coin and refill toward the target immediately, off-screen, a few per step.
- **Collected:** the replacement waits. Each pickup adds one unit of "coin debt", and the spawner fills only up to `target - debt`. A hazard process pays the debt back one coin at a time: accumulate `rho_coin(height) * dt` and repay one when it crosses a newly sampled exponential threshold, which gives a randomized interval with mean `1 / rho_coin`. Repaid coins also spawn off-screen. Clamp debt to the target, and clamp spawning to the target and the coin-pool capacity.

A new run fills the window to the target, away from Dan. The spawner runs once per simulation step, not once per rendered frame, using the run's seeded random generator. Positions stay within the active window and the cloud altitude band.

## Hitboxes and collision checks

Visual art and collision geometry should be separate. Dan can use a simple axis-aligned rectangle or capsule sized around his body, not the transparent edges of his sprite. Collision uses Dan's feet point (bottom centre) and his horizontal span. Coins can use circles or small rectangles. Debug mode should draw these shapes over the art.

### Cloud bounce

A cloud is not a one-way platform. Each cloud has a visual box (width × height; the art fills it, widest at mid-height) and a **bounce band** covering the full width and the middle 3/5 of the height (20%–80% from the top; tunable). Dan can bounce off a cloud from either direction:

- **Falling in from above:** his feet go from above the band top at the start of the step to at or below it at the end. Place his feet on the band top and set his vertical velocity to the upward bounce velocity.
- **Rising in from below:** his feet go from below the band bottom to at or above it. Keep his position and top up his upward speed to the bounce velocity (never reduce it). Rising through a stack of clouds therefore chains bounces upward, as in earlier versions of the game.

Both checks also require horizontal overlap between Dan's span and the cloud's width at the end of the step. A bounce triggers only on *entering* the band, so feet already inside a band never re-trigger. The cloud Dan just bounced on can't fire again until he has left its band. If several clouds qualify in one step, the nearest entry wins.

Evaluate each band edge at the start and end of the step, using the cloud's analytic position at those two times. The crossing is then tested in motion relative to the cloud, so a drifting cloud is handled. The test asks whether the feet crossed an edge during the step, not whether they ended inside the band, so it cannot tunnel. This holds even when one step moves farther than the band is tall: the thinnest bands are about 19 units, and a 30 Hz step at maximum fall speed moves about 24. The one approximation is that horizontal overlap is checked at the end of the step. If fast sideways movement makes Dan clip cloud edges badly, compute the entry fraction against the moving edge:

```text
u = (bandEdgeAtStart - danFeetAtStart)
    / ((danFeetAtEnd - danFeetAtStart)
       - (bandEdgeAtEnd - bandEdgeAtStart))
```

With `0 ≤ u ≤ 1`, check horizontal overlap at that same fraction `u` rather than at the end of the step.

Use a cheap broad phase before these exact checks:

- First get candidate clouds and coins from the active pools. Since pool capacities are fixed, directly scanning them already has a known upper bound. A cloud can drift across tile boundaries, so candidate lookup must use its current position rather than generation tile.
- Reject objects whose current swept bounds do not overlap Dan's swept bounds.
- Run the precise bounce-band or coin overlap test only for survivors.

If the bounded active set later becomes large enough to justify an index, bucket entities by their current world position each simulation step (or update a spatial hash when they cross a cell). Query the cells touched by Dan's swept bounds. This dynamic spatial index is separate from the procedural generation tiles.

## Do we need a subtile bitmap?

Probably not for the first version. If the active grid has a modest fixed number of clouds, a simple loop over bounded cloud arrays is easy to reason about and already has a known worst-case cost. Moving clouds make a static occupancy bitmap stale: their current cells have to be updated or rebuilt as they drift.

A bitmap can be a later broad-phase optimization if a spatial cell gets crowded. One option is a small grid where each cell stores 32-bit masks of cloud-pool slots. Rebuild or update the masks from current analytic positions, OR together masks for cells touched by Dan's swept box, and run exact hitbox tests only for set bits. The bitmap is only a candidate filter; it does not replace cloud positions or hitboxes. Avoid `BigInt` masks in the hot path.

Measure before adding this. Rebuilding a bitmap every step may cost more than checking a few dozen cloud bounds, especially on mobile. A clear `for` loop across a fixed maximum is a strong baseline.

## JavaScript hot-path practices

- Prefer a few predictable arrays with fixed meaning over per-frame creation of temporary arrays, objects, closures, or iterator chains.
- Keep object shapes consistent if using objects: initialize the same properties in the same order and avoid changing their types during play.
- If profiling shows data movement or allocation is a problem, use preallocated typed arrays (for example, positions, velocities, sizes, and flags in parallel arrays). Typed arrays are a compact storage option, not a guarantee that every loop is faster.
- Reuse tile slots and entity slots; use counts or active flags rather than growing and shrinking arrays each frame.
- Generate replacement cloud parameters only when a pool slot is refilled, not in the collision loop. Use a small deterministic PRNG seeded for the run.
- Keep rendering work out of collision code. Cull to the camera view, group similar Canvas draw state where useful, and cache repeated static scenery if it becomes a measured cost.
- Profile on a mid-range phone before pursuing clever bit tricks. The bounded entity count, no per-frame allocation, and simple collision math are the main budget controls.

## Suggested first implementation

1. Use fixed cloud and coin pool capacities in a bounded window; skip the tile grid.
2. Store active entities in reusable arrays; give clouds analytic linear drift and replenish off-screen.
3. Step Dan's physics at a configurable rate and draw on `requestAnimationFrame` without a render cap; start without interpolation.
4. Check the bounded cloud pool for bounce-band entries from either direction. Add the fractional swept test only if sideways clipping at cloud edges shows up in playtesting.
5. Add a debug overlay for the active window, cloud boxes and bounce bands, Dan's hitbox, and candidate counts.
6. Add tile streaming, interpolation, subtile masks, or typed-array restructuring only when the core game works and time or profiling justifies it.

## References

- MDN, [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame): browser repaint scheduling and refresh-rate behavior.
- MDN, [Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas): rendering guidance such as batching and avoiding unnecessary work.
- V8, [Fast properties](https://v8.dev/blog/fast-properties): why consistent object shapes can help JavaScript engine optimization.
