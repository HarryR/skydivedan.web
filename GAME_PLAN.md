# Sky Dive Dan — Game Plan

## The idea

A new browser version of *Sky Dive Dan*, my own game, which I've rebuilt several times over the years since the original V-Cade release (an earlier C++/SDL version is at <https://gist.github.com/HarryR/5457326>). This version is a small 2D arcade game. Dan jumps out of a plane and pulls the cord, only to discover that his backpack has launched his lunch instead of a parachute. He has to keep himself aloft by bouncing off clouds, collect coins, and avoid falling all the way to the ground.

## Design goals

- Keep the feel of the earlier versions, but rethink the details freely for this build rather than porting any one version exactly.
- Keep the game immediately understandable: bounce, collect, stay airborne.
- Make a playable hackathon-sized version in a couple of hours.

## Core play loop

1. Dan leaves the plane and starts falling.
2. The player steers him toward clouds and coins.
3. Landing on a cloud bounces Dan back up. Passing up through another cloud bounces him again, so a run of clouds can chain him higher.
4. The player keeps chaining bounces and collecting coins.
5. Missing the clouds and reaching the ground ends the run with a splat / game-over moment.

## Coins and fart boost

- Coins directly make up the player's score.
- Coins spawn randomly in the world, independently of the clouds; clouds follow their own paths, so steering Dan to a coin is part of the challenge.
- Coins may deliberately spawn on-screen, with a brief sparkle to make the appearance readable. Clouds keep the strict off-screen replacement rule.
- Keep a height-dependent target availability of coins in the active world. Use a randomized spawn timer with a rate `rho_coin(height)` to replenish coins when the active count falls below that target. Pickups remove coins from the active count, so they are not immediately replaced; do not spawn above the target.
- Coins are sparser higher up and more plentiful closer to the ground. Tune both the target availability and `rho_coin(height)` across altitude.
- Dan has a special fart boost that propels him upward. It spends coins while active, reducing the score, so using it means trading points for a better chance to stay airborne.
- Make the boost costly enough to be a tactical save rather than something to hold forever. Its upward force should depend on the remaining coin balance, and it stops when the balance is empty. With very few coins, it provides very little lift.
- Tune the drain rate and lift together during playtesting; the intended choice is whether the rescue is worth the score spent.
- Fart is the only special action; there are no upgrades or other abilities.

## Run and high score

- The game is one continuous run with no levels. The goal is to beat the player's previous score.
- The score at death is the final coin balance after fart spending. Store the best final balance locally in the browser; there is no global leaderboard or account requirement.
- Keep the physics simple and tuneable; prioritize clear, responsive arcade movement over realism.

## Difficulty and altitude

The remembered difficulty curve changes with altitude:

- **Higher up:** clouds are sparser and farther apart, but Dan's jumps are higher and travel farther. This should feel relatively easy.
- **Closer to the ground:** clouds are denser and coins are more plentiful, but jumps are quicker and shorter. This should feel harder and more frantic.

Keep these as starting design intentions; tune the actual spacing and jump values by feel during the prototype.

## World and camera

- The play area is broad and effectively infinite horizontally. The camera follows Dan as he moves, including left and right, through the world.
- Clouds exist in world coordinates and drift along their own movement vectors at varied speeds. Panning the camera reveals clouds already in the world; they should not pop into existence at the viewport edges and begin moving from there.
- Clouds vary in size as well as position and movement.
- The playable cloud field has vertical limits. There are no clouds above its upper bound or below its lower bound. Falling below the lower bound leaves Dan in open air until he reaches the green ground and the run ends.
- The plane enters around the middle of the vertical range, so a new run starts at roughly average difficulty rather than at either extreme.
- The game fits the browser window: square on a landscape desktop, close to full screen on a portrait phone. Bigger windows and tablets show a little more of the world, up to a maximum; beyond that, as on a 4K display, the game scales up. See [SIMULATION_DESIGN.md](SIMULATION_DESIGN.md#viewport-size).

### Procedural world streaming

The cloud field uses a bounded simulation area around Dan, with a target cloud count that varies by altitude. Clouds drift on their own paths and are replaced off-screen so the field does not drain while Dan stays in one place. See [SIMULATION_DESIGN.md](SIMULATION_DESIGN.md) for the authoritative tile, timing, and replacement rules.

## Background and scenery

- Change the sky color with altitude, from the lower atmosphere toward a darker sky higher up.
- **Stretch goal:** add layered parallax scenery. Stars appear and grow brighter as Dan climbs toward space; mountains come into view lower down; trees and grass appear near the ground.
- Keep the scenery secondary to readable clouds, coins, and Dan.

## Technology and constraints

- Plain JavaScript / ECMAScript; no framework required for the first version.
- 2D rendering with Canvas 2D. Use the browser's normal accelerated canvas path where available; skip WebGL for this scope.
- Deploy the finished game as a static site with GitHub Pages.
- Support both desktop browsers and mobile browsers.
- Hackathon time: roughly a couple of hours. Prioritize a complete playable loop over polish or extra systems.

## Controls

- **Desktop:** Left / Right arrow keys or **A / D** to steer Dan left and right.
- **Mobile:** Drag one finger or thumb to steer Dan using the horizontal offset from where the touch began, like a floating joystick. Full steer is reached at about 40 CSS pixels; further movement is clamped.
- Keep the same left/right steering behavior across both input methods. Touch should work directly on the game area and avoid accidental page scrolling while playing.
- Steering is the primary movement control. Dan may build horizontal momentum; acceleration and friction are feel-tuning values, not additional controls.
- **Desktop fart:** Hold **W**, **Up Arrow**, or **Space** to use the fart boost; releasing the key stops it.
- **Mobile fart and steering:** The bottom-center fart button works like a camera shutter. Touching it starts the boost; while holding, drag left or right to steer with the same 40 CSS pixel floating-joystick rule and keep boosting. Releasing ends the boost. A drag that starts outside the fart button is normal left/right steering.

## Timing and game loop

The game has a visible pause control and pause state. The authoritative simulation timing, catch-up, hidden-tab, and pause behavior is documented in [SIMULATION_DESIGN.md](SIMULATION_DESIGN.md).

## Follow-up: start screen, language, and presentation

- Show an introduction screen before each run with a large arcade-style *Sky Dive Dan* title, a short explanation of the controls, and a **Begin Game** button.
- Detect the browser's preferred language and show Vietnamese or English accordingly. Include a visible **VN / EN** toggle on the start screen so players can switch languages themselves.
- The visual direction is simple, colorful, cartoonish, and a little dreamy: early-2000s Flash game clarity with hints of 1990s Mega Drive character. Favor readable shapes and expressive animation over detailed art.
- The plane entry and lunch-instead-of-parachute reveal happen once at the beginning of a run. The fall, splat, and **GAME OVER** are the closing gag when the run ends.

## First playable scope

- Focus first on the playable core: left/right steering, gravity, cloud bounce, coins, coin-funded fart, and the splat/game-over with final and best score.
- Use a fixed-capacity cloud pool and off-screen replacements; defer the tile grid until the core loop works.
- Support keyboard and the agreed mobile drag gestures from the first playable version.
- Use simple shapes and minimal UI. Add pause, the intro screen, VN/EN toggle, opening lunch gag, and polished art after the core loop if time allows.

## Tune during implementation

- Horizontal acceleration and friction, to make steering feel responsive without being twitchy.
- Coin drain and upward force for the fart boost, to keep it useful but costly.
- Cloud spacing, drift speeds, and jump strength at each altitude.
- How much animation and scenery can fit after the core loop is playable.
- Simulation update rate; rendering follows the browser's animation cadence. See [SIMULATION_DESIGN.md](SIMULATION_DESIGN.md) for timing behavior.

## Scope guardrails

For the first session, avoid levels, upgrades, tile streaming, complex art, and elaborate physics. Get one continuous playable run from plane jump to splat; cut presentation work before cutting steering, bouncing, coins, fart, or the game-over loop.

## Later options: waves and scoring structure

Not part of the first playable version. The first version uses randomized coin spawning only; once the core loop and controls feel right, these mechanics (from earlier versions of the game) can make it more game-like:

- **Waves:** split a run into timed waves, each with its own coin and cloud setup.
- **Progress meter:** an on-screen bar showing how far through the current wave the player is.
- **Completion bonus:** award extra points for surviving or finishing a wave.
- **Chain multiplier:** collecting coins in quick succession raises a score multiplier; a chain timer resets it if the player is too slow.

Open design point if these are added: the first version uses one coin balance as both score and fart fuel. A multiplier or completion bonus would either add to that balance (making fuel easier to earn) or need a separate score that fart spending doesn't touch. Waves would also give skilled players a reason for runs to end or escalate, which the continuous run doesn't yet have.
