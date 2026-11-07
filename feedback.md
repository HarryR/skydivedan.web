# Review Feedback

> **How this file works:** reviewers add findings below. Once a finding is resolved, or a decision is made either way (fixed, won't fix, or deferred), **remove it from this file**. Record lasting design decisions in the design docs, and the change itself in the commit message. This file only holds open items, so an empty list means nothing is waiting.

## Open findings

### 1. Dan part sprites (`dan-body/arm/leg-v01`): usable, but they need pivots and a shared scale before integration

**Priority: Medium.** This is a review of `assets/originals/dan-body-v01.png`, `dan-arm-v01.png`, and `dan-leg-v01.png`.

**What works:**

- Good, consistent character art. It has a dark outline and cel shading, and it matches the game palette: red suit (Dan red), navy trousers with a red stripe, goggles, and a brown backpack.
- The figure faces right, as art.md requires. The renderer mirrors it for facing left.
- Alpha is real, not a painted checkerboard. "Opaque" pixels are alpha 253 rather than 255, which is harmless because crunch.py's 1-bit cutoff is 128.
- A rough composite crunched to in-game size reads clearly on both the light and dark sky. At 2 px/world unit (~44 × 68 px, 24 colours) the face and goggles survive. At 3 px/world unit (~66 × 102 px) it looks noticeably better, so the hero is worth 3 px/unit.

**What is missing for a rig:**

1. **No shared scale.** Each part was generated at an arbitrary size: the arm sheet is wider than the body. Relative scales were set by eye for the preview (body ≈ 0.66 of total height, leg ≈ 0.40, arm length ≈ 0.42). Record them, or regenerate the parts together on one sheet.
2. **No pivot data.** The rig needs, in source pixels: the shoulder and hip attach points on the body, the shoulder joint on the arm (centre of the red shoulder ball), and the hip joint on the leg (top centre). Without these, the body/leg join leaves a visible gap or overlap.
3. **One arm and one leg only.** Reuse each for both sides: back limbs drawn behind the body, optionally darkened slightly, and front limbs in front. That is fine for this scope.
4. **The head is part of the body.** The head can't tilt or change expression. That is acceptable for now.
5. **The arm is a single bent, open-glove pose.** Flailing comes from rotating it around the shoulder.

**Integration approach (proposed):** compose Dan each frame into one small reused offscreen canvas at the crunched resolution (~66 × 102), with limbs rotated from gameplay state as the procedural `drawDan` does now. Then draw that canvas into the world with smoothing off. Every part then shares one pixel grid, so the 8-bit look is consistent, rather than rotated sprites each showing a differently angled pixel grid. Ship crunched parts via `tools/crunch.py` and keep the procedural Dan as the load-failure fallback. Keep the 22 × 34 collider and the feet anchor: shoe soles on the feet point.

**To resolve:** decide whether to integrate these parts. If yes, record the pivots and scales (from Codex, or measured during integration), then remove this item.
