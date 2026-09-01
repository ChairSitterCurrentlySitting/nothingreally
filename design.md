# DESIGN.md — Escape Game

Living spec for this project. Update this file whenever a feature is finished
or a decision is made — paste its contents into a new chat with Claude to get
it back up to speed without re-explaining everything.

---

## Core Concept

A first-person, browser-playable "collect objects to escape a setting" game.
Player explores an environment, finds and picks up objective items, and
escapes once all objectives are collected.

**Visual style:** Crude low-poly 3D. Environments are simple geometric
shapes (boxes, planes) with flat colors — no fine texture detail, no
attempt at photorealism, just a recognizable layout. Characters and
interactive items are 2D sprites rendered as billboards (flat images that
always rotate to face the camera), in the style of classic titles like
Doom or Wolfenstein 3D — full 3D world, 2D character/item art. (Previously
planned as an ASCII-rendered look via Three.js's `AsciiEffect`; that's been
dropped in favor of this approach.)

**Platform:** Runs entirely in-browser, no build step, no backend.
Playable on desktop and mobile.

**Hosting plan:** GitHub Pages, so friends can play via a link.

---

## Tech Stack

- **Three.js** (r0.160.0) — loaded via CDN using an import map in `index.html`,
  no npm/bundler needed.
- **PointerLockControls** (Three.js addon) — desktop mouse-look + lock.
- Vanilla JS, ES modules — no framework.
- Plain CSS for UI/HUD overlay.

---

## File Structure

```
escape-game/
├── index.html          # Entry point, import map, loads main.js
├── css/
│   └── style.css        # UI styling: blocker overlay, joystick, look zone
├── js/
│   ├── main.js           # Sets up scene/camera/renderer, runs game loop
│   ├── controls.js       # Desktop: WASD + PointerLockControls (mouse-look)
│   ├── touchControls.js  # Mobile: virtual joystick + drag-to-look
│   ├── world.js           # Builds level geometry (cube room with a door) —
│   │                        currently NOT active; see note below
│   ├── locations/
│   │   └── ikea.js        # First real location module (walls only, no
│   │                        props yet). See "Location module system" below.
│   ├── player.js          # HP, stamina, and sprint state/logic
│   ├── objects.js         # (not yet implemented) collectible item definitions
│   ├── interaction.js     # Raycast from screen center; used to detect "looking at the door"
│   ├── collision.js       # Circle-vs-wall collision (resolve-after-move)
│   ├── gameState.js       # (not yet implemented) win/lose condition tracking
│   ├── ui.js               # HP/stamina HUD bars
│   ├── dash.js             # Dash burst-movement mechanic
│   ├── cheats.js           # Desktop-only cheat/debug tools (fly, etc.)
│   ├── portalGun.js        # Right-click swirl spawn/despawn (visual only, no travel yet)
│   └── inventory.js        # 3-slot inventory hotbar (slot 3 holds the Portal Gun item)
├── assets/
│   ├── models/           # for future .glb imports (Blender exports)
│   ├── textures/
│   └── sounds/
└── README.md
```

---

## Features Built So Far

- [x] Viewmodel hand: a screen-space (not 3D-world) image pinned to the
      bottom-right corner via CSS `right: 0; bottom: 0`, created in `ui.js`
      alongside the rest of the HUD. Source art was background-removed
      (white-background color-keyed to transparent, verified against a
      magenta test composite, not just assumed) and pixelated to a 32×32
      base grid, exported at both 128×128 and 256×256 (`assets/textures/ui/`).
      Displayed at 650px wide (2.5× an original 260px), scaled purely by
      increasing width — `right:0/bottom:0` already anchors the bottom-right
      corner regardless of size, so no CSS transform/scale was needed to
      keep that corner fixed while growing. Sits behind the inventory bar
      via z-index (12 vs. the inventory bar's 25), and is `pointer-events:
      none` so it never intercepts clicks/taps meant for what's under it.
      **Wobble (QoL):** a subtle bob-and-tilt CSS `@keyframes` animation
      plays while the player is moving, toggled via a `.walking` class
      (`hand.classList.toggle`) rather than computing motion in JS each
      frame. `transform-origin: bottom right` keeps the anchored corner
      itself stationary during the wobble. Driven by the same `isMoving`
      signal already used for stamina regen gating; `isMoving` was hoisted
      outside the pause-gated block in `main.js` (defaulting `false`) so
      the wobble correctly freezes on pause too, without needing a separate
      pause check of its own.
      **Source image swapped from `idle_hand.png` to `_.jpeg`** — same
      element/behavior, just pointing at a different file
      (`assets/textures/ui/_.jpeg`) now.

- [x] Inventory hotbar: 3 slots, top-right corner, 96×96px each (doubled
      from an initial 48px). Desktop: keys 1/2/3 select a slot. Mobile:
      tapping a slot selects it — implemented as a plain `click` listener
      on each slot element, which fires for both a mouse click and a touch
      tap with no separate touch-handling code needed (a nice side effect:
      desktop mouse-clicking a slot also works, even though only keys were
      requested there). Selected slot is highlighted (`ui.js`). Slot 3 is
      pre-populated with a Portal Gun item (`{ name, icon }` in
      `inventory.js`'s initial state) — the icon renders as the slot's
      background-image, with the slot number as a small corner badge on
      top. Any future item works the same generic way, not a one-off
      special case for this one. Full pickup/inventory management still
      needs `objects.js` (still planned) to exist.
      **Mobile Use button mirrors the currently selected slot's icon**
      (`touchControls.js`'s `updateUseButtonIcon`) — same icon+corner-
      label pattern as the inventory slots (icon as background-image,
      "USE" as a small badge). Clears the background image (no icon, just
      the plain button) when the selected slot is empty — same convention
      as the desktop inventory slots' empty state, not a placeholder
      image. Always visible — unlike the dash button, it has no hide/
      disable state.
- [x] Portal gun spawn effect (`portalGun.js`): **U key** (desktop) or the
      mobile **Use button** (rebound from an initial right-click, which was
      awkward on a Mac trackpad — `main.js`'s `tryUsePortalGun()` is the
      single shared trigger both input paths call) — while the Portal Gun
      is the selected inventory slot, spawns a billboarded swirl sprite
      (`THREE.Sprite`, always faces the camera) 4 meters in front of the
      player, **horizontally** — direction is yaw-only, deliberately
      ignoring pitch, and the sprite's Y position is snapped so its
      *bottom* edge sits on the ground (`GROUND_Y`, currently `0` in both
      locations) regardless of where the player is aiming vertically. This
      reverses an earlier design (originally used
      `camera.getWorldDirection()` — full 3D, pitch included — specifically
      so aiming up/down mattered); the old reasoning no longer applies.
      15-second cooldown between uses (`USE_COOLDOWN`), exposed via
      `portalGun.getCooldownRemaining()` and displayed as a "Portal ready
      in X.Xs" countdown stacked directly above the dash cooldown timer
      (`ui.js`'s `updatePortalTimer`, `#portal-cooldown-timer` in
      style.css) — same pattern as dash's cooldown display. Lifetime is 5
      seconds, fading out (opacity 1→0) over the final 0.75s instead of
      vanishing abruptly; multiple swirls can be active at once, each with
      its own independent timer (using again doesn't reset or extend an
      existing one, and isn't blocked by other swirls still being visible
      — only the 15s use-cooldown gates a new use). Gated behind
      `controls.isLocked` **or** `onTouchDevice` (matches `isPaused`'s
      pattern — `isLocked` is desktop-only and stays permanently false on
      touch, so it can't be the sole gate for a trigger shared with the
      mobile button) and behind the same pause system as everything else.
      **Motion without real animation frames — ghost trail:** each swirl
      is a stack of `TRAIL_COUNT + 1` (currently 5) sprites, not one — a
      fully opaque "front" sprite at the current *size*, plus several
      progressively fainter sprites behind it showing progressively
      *older* sizes (`TRAIL_LAG` seconds apart), pulsing gently via
      `PULSE_AMOUNT`/`PULSE_SPEED`. Since size is a pure function of
      elapsed time, each ghost's size is just that formula evaluated at an
      earlier virtual timestamp — no history is actually recorded frame by
      frame. The pulse itself is modulated by cheap "sum of sines"
      pseudo-noise (no library, several sine waves at different
      frequencies/phases added together). All ghosts share one texture
      and use explicit `renderOrder` (front highest) since several
      sprites at the exact same position have no meaningful distance to
      sort by, which would otherwise flicker between frames.
      **There is deliberately no rotation anywhere in this file — two
      earlier approaches both involved rotation and were both reverted:**
      (1) Plain single-sprite rotation (no trail) — spinning an *oval's*
      whole silhouette around its center visibly rotates the portrait/
      landscape aspect back and forth, reading as a mechanical object (a
      fidget spinner) rather than swirling content.
      (2) Blurring that *same* rotation across a ghost trail — this was
      the first trail attempt, and it only softened the edges; the
      underlying rotation was still there, so the whole trail still
      visibly swept around like a spinning shape. Trailed *scale* instead
      of rotation avoids this category of problem entirely, since the
      silhouette's orientation never changes at any point.
      (3) Before either of those, an even earlier attempt panned the
      texture's UV offset — reverted for different reasons: an unbalanced
      "sum of sines" (one dominant term) read as an obvious side-to-side
      sway, and `RepeatWrapping` (needed to avoid edge-smearing) meant any
      nonzero offset immediately revealed tiled copies of the image. See
      the gotchas below.
      Texture is `portalthing_oval.png` — the source JPG, oval-cropped with
      a properly anti-aliased transparent edge (verified against a magenta
      test composite, not just assumed) and converted to PNG, since an oval
      crop needs real alpha transparency that JPG can't provide. Displayed
      at 3.15m tall (compounded from an original 1.5m through two separate
      size increases), with width derived from the source's real 1183:2560
      aspect ratio rather than forced into a square. **No portal travel
      yet — visual spawn/despawn only.**

- [x] Cheat mode (`cheats.js`), desktop-only — mobile intentionally not
      supported yet. `=` toggles cheat mode on/off. While active,
      double-tapping Space (within 300ms, same convention as Minecraft's
      creative-mode fly) toggles flying. While flying: hold Space to
      ascend, Shift to descend, WASD moves horizontally; collision is
      skipped entirely (noclip — intended as a level-inspection tool, not
      a real gameplay ability). Up/Down arrows adjust fly speed by 10% per
      press, clamped 10%–300% (holding the arrow ramps continuously —
      deliberately not debounced like the toggles). Fly speed governs both
      vertical and horizontal movement while flying, replacing the normal
      walk/sprint speed for as long as flight is active — a judgment call
      since "fly speed" wasn't specified as vertical-only; easy to split
      into separate rates later if that wasn't the intent. While cheat
      mode is active, stamina cannot be lost — sprinting and dashing both
      still work but cost nothing (`player.js`'s `updatePlayerState` and
      `trySpendDashStamina` both take an `infiniteStamina` flag for this).
      A small "CHEATS ON" / "CHEATS: FLYING X% speed" indicator shows
      top-right whenever cheat mode is active, self-managed inside
      `cheats.js`. Designed to be extended with more cheats later.

- [x] Ikea location (`js/locations/ikea.js`) — first real location module,
      walls only (no props/detail yet). Layout is a simplified rectangular
      grid translated from a provided floor plan photo, proportions
      approximated rather than pixel-matched. Walls between rooms that
      connect along the intended shopping path have an open doorway gap
      (~3 units wide); the south wall has a wider gap for the Showroom
      Entrance. Establishes the location-module pattern going forward: a
      `buildX()` function returns `{ group, walls, ... }` — a self-contained
      `THREE.Group`, not added to a scene itself — so a future level
      manager can add/remove it wholesale when the player travels.
      **`main.js` is currently previewing Ikea instead of the cube room**
      (temporary, clearly commented at the swap point) — the cube room in
      `world.js` still exists and works, it's just not the active location
      right now. Swap `const world = ikea; scene.add(ikea.group);` back to
      `const world = buildWorld(scene);` to return to it.
      `collision.js` was made defensive to support door-less locations as
      part of this (`getCollidableBoxes` now checks `world.door &&
      world.doorPivot` before touching them, rather than assuming every
      location has a door — this was a real crash risk, not just a style
      nit, since accessing `.userData` on an undefined `doorPivot` throws).

- [x] Basic Three.js scene: enclosed cube-shaped room (floor, ceiling, 4 walls,
      10×10 footprint, 4 units tall) with a door on the far wall, ambient +
      directional lighting, fog. Collision intentionally deferred — walls and
      the door are currently walk-through, geometry only.
- [x] Desktop first-person movement: WASD + mouse-look via `PointerLockControls`,
      click-to-lock overlay
- [x] Mobile touch controls: on-screen floating joystick (left half of screen,
      movement) + drag-to-look (right half of screen). Bypasses `PointerLockControls`
      entirely on touch devices — rotates the camera rig directly instead.
      Verified working via Chrome DevTools touch emulation; not yet tested on
      a physical phone.
- [x] Responsive canvas (resizes with window)
- [x] Interaction: left click (desktop) or tap (mobile) raycasts from screen
      center; if the door is hit within range, it snaps open or shut instantly
      (rotates 90° on a hinge pivot, no animation/easing) — same action
      toggles both directions
- [x] Collision: player treated as a circle (top-down), resolved against
      wall/closed-door AABBs after movement each frame (`collision.js`).
      Open doors are excluded from collision so they're actually walkable.
- [x] Player HP (100) and stamina (100) state (`player.js`), rendered as HUD
      bars top-left (`ui.js`). No damage source hooked up yet — HP starts
      full and currently has nothing that reduces it.
- [x] Base movement speed reduced 15%, then a further 5% (6 → 5.1 → 4.845
      units/sec) on both desktop and mobile.
- [x] Sprint: toggle (not hold) — Control key on desktop, an on-screen button
      bottom-right on mobile. 20% movement speed while active (deliberately
      less than the earlier 30% — at 30%, sprint would let the player
      permanently outrun Weiqi even after his speed scales up with friends
      collected; applied on top of the reduced base speed); stamina drains
      fully over 7 seconds of sprinting *while actually moving*, and
      force-disables sprint at 0. Stamina recovery is gated by standing
      still, not by the sprint toggle: toggling sprint on while stationary
      recovers stamina exactly like sprint being off does; walking without
      sprint neither drains nor recovers it. Recovery also takes 7 seconds
      full-to-full — drain and regen rates are symmetric. A "SPRINTING" text
      indicator next to the stamina bar shows/hides based on
      `state.isSprinting` (`ui.js`).
- [x] Pause on Escape (desktop only): reuses `controls.isLocked`, which
      browsers already force to `false` whenever Escape is pressed (this
      can't be prevented by JS) — no separate Escape listener needed.
      Movement, stamina drain/regen, and collision resolution all skip
      their update while unlocked. Doesn't apply to touch devices (no
      pointer lock concept there); explicitly excluded so mobile isn't
      permanently "paused." A comment in `main.js`'s animate loop marks
      where Weiqi's AI update should plug into the same `isPaused` check
      once that system exists — nothing to freeze there yet since Weiqi
      has no code, only design notes, so far.
- [x] Dash: F key on desktop, an on-screen button next to sprint on mobile.
      ~3 meters over 0.3 seconds (10 m/s), independent of walk/sprint speed —
      works regardless of sprint state. Costs 10% of max stamina per use
      (`trySpendDashStamina` in `player.js`) — only actually fires if both
      the cooldown has cleared *and* there's enough stamina; availability is
      checked before spending, so a rejected dash never wrongly deducts
      stamina. Direction is yaw-only (ignores pitch), same technique as
      normal movement, so looking up/down mid-dash can't send the player
      through the floor. Respects the same collision and pause systems as
      normal movement (`dash.js`). A 10-second cooldown after each dash was
      added even though not explicitly requested — without one, chaining
      dashes back to back would let the player move continuously faster
      than any tuned walk/sprint speed, breaking the Weiqi speed-scaling
      balance. Easy to retune/remove in `dash.js` if that wasn't the intent.
      A cooldown countdown ("Dash ready in X.Xs") displays bottom-center of
      the screen — subtitle position — while on cooldown, hidden otherwise
      (`ui.js`).

## Features Planned (not yet built)

- [ ] Data-driven map/level layout (JSON or grid-based, replacing the single
      hardcoded wall in `world.js`)
- [ ] Collectible objects placed in the scene (`objects.js`)
- [ ] Inventory (5 slots per the game concept) / objective tracking (`player.js`, `gameState.js`)
- [ ] Win condition: escape trigger once all objectives collected
- [ ] HUD additions: objective counter, prompts, win/lose screens (`ui.js`)
- [ ] Sprite billboard system for NPCs/items — flat 2D images that always
      face the camera (`THREE.Sprite`, or a plane with a per-frame
      lookAt-camera update)
- [x] Location module system, first pass: `js/locations/ikea.js` establishes
      the pattern — a location module builds and returns a self-contained
      `THREE.Group` (plus a `walls` array, matching `world.js`'s existing
      return shape so `collision.js` works unchanged), and does NOT take a
      `scene` parameter — the caller decides when to add/remove it.
- [ ] Level manager: actually swap locations in/out of the scene (portal
      gun, doors between locations, etc.) — the location-module *shape*
      exists (see above) but nothing adds/removes a location's group at
      runtime yet. Only one location can be "active" right now, chosen by
      which `buildX()` call `main.js` happens to use.
- [ ] Sound effects / ambient audio

---

## Key Decisions & Notes

- **No build tools.** Everything runs as raw ES modules via CDN import map,
  specifically so GitHub Pages hosting requires zero configuration.
- **Movement math**: friction-based velocity on desktop (`controls.js`);
  direct analog joystick input on mobile (`touchControls.js`) — these are two
  separate, intentionally un-unified code paths for clarity while the project
  is still small. Could be merged into one shared movement function later if
  duplication becomes a problem.
- **Collision is not yet implemented.** Currently you can walk through the
  wall. This needs to be addressed before/alongside adding more rooms.
- **Asset limitation**: no real 3D models have been sourced yet — environment
  geometry is procedural (boxes/planes). Character/item art will be 2D sprite
  images rather than 3D models, which keeps the asset pipeline simple (no
  Blender/rigging needed) — just flat artwork per character/item.
- **Visual style pivoted from ASCII to low-poly + sprites.** Reasoning:
  low-poly with sprite billboards is more expressive for a large cast of
  named characters (the school-set story has 12+ NPCs) than a monochrome
  ASCII look would be, while still keeping the "no fine detail needed" scope
  that made ASCII appealing in the first place — recognizable layout and
  silhouette matter, photorealism doesn't.
- **Location content should be gathered as a floor-plan sketch + a handful of
  reference photos per room**, not a 3D/LiDAR scan. Given the crude low-poly
  target, exact geometry isn't the goal — proportion, layout, and door
  placement are what actually translate into the code, and (unlike the
  original ASCII plan) rough color/material info from photos is now also
  useful since color will actually render and can help make a location
  recognizable.

---

## Debugging Notes / Gotchas

- **A duplicate `position` declaration in the same CSS rule silently
  breaks positioning — the later one wins, with no warning.** Adding
  `position: relative` to `#use-button` (so its child label could be
  absolutely positioned) while the rule already had `position: fixed`
  would have overridden the fixed anchoring entirely. `position: fixed`
  (or `relative`/`absolute`/`sticky`) already establishes a valid
  containing block for absolutely-positioned children on its own — no
  second `position` declaration is ever needed just to enable that.

- **Panning a full-frame texture's UV offset with `RepeatWrapping` reveals
  tiling — there's no "safe" amount of pan.** This only matters for a
  texture meant to be viewed as one complete image (a sprite, icon, etc.);
  it's a non-issue for textures genuinely meant to tile (repeating floor/
  wall patterns). If a single static image needs to visually drift or pan,
  animating rotation, scale, or opacity instead avoids the problem
  entirely, since none of those touch UV sampling.
- **A "sum of sines" pseudo-noise needs balanced amplitudes, or it just
  reads as one big sine wave with minor decoration.** A dominant term
  (e.g. one wave weighted much higher than the others) produces an obvious
  rhythmic sway rather than chaotic-looking motion — worth double-checking
  the relative weights sum to something reasonably even before assuming
  the noise itself is "good enough."

- **Rotating a non-circular sprite (an oval, a rectangle, anything without
  radial symmetry) around its center visibly rotates its silhouette, not
  just its content.** A portrait-oriented oval spinning reads as "a
  mechanical object spinning" (a fidget spinner), not "swirling content,"
  because the outer edge itself is clearly rotating. Only a genuinely
  circular/radially-symmetric shape can rotate without this artifact.
  **Blurring that same rotation across a fading ghost trail does NOT fix
  it** — tried this directly, and the underlying rotation is still there,
  so the whole trail still visibly sweeps around; blurring only softens
  the edges, it doesn't remove the motion causing the problem. Trailing a
  *different* property instead (scale, opacity — anything that doesn't
  change the silhouette's orientation) avoids the problem at its root,
  rather than trying to disguise it after the fact.

- **Multiple transparent objects at the exact same position have no
  meaningful distance to sort by, and Three.js's default depth-based
  transparency sort can flicker between them frame to frame as a result.**
  Set `renderOrder` explicitly on each one instead of relying on
  automatic sorting whenever stacking several sprites/planes at (or very
  near) the same spot, like a ghost-trail effect.

- **macOS's filesystem is case-insensitive, which can hide a real bug until
  it's deployed.** `portalGun.js` and `Portalgun.js` are treated as the same
  file locally, so an inconsistently-cased import works fine when testing
  with Live Server — but GitHub Pages serves from a case-sensitive Linux
  filesystem, where the mismatch would actually 404. VS Code's TypeScript/JS
  checker can catch this ahead of time (a tooltip on the import naming the
  conflicting path) even though nothing breaks locally. Worth treating as a
  real bug to fix, not just editor noise, given this project deploys to
  GitHub Pages. Find the actual mismatched reference via project-wide
  search (Cmd+Shift+F) with Match Case enabled.

- **A GIF loaded as a Three.js texture doesn't animate — it displays as a
  frozen first frame.** WebGL textures have no built-in GIF decoder the way
  an `<img>` tag does. Real animation needs the GIF's frames extracted and
  laid out as a single sprite sheet PNG (with proper alpha transparency,
  which also sidesteps GIF's limited 1-bit transparency), then cycled
  through in code by shifting UV coordinates over time. `portalGun.js`
  ended up using a different (JPG, not GIF) source image instead, oval-
  cropped to a static PNG — so this specific limitation didn't end up
  applying to the current texture, but the technique is worth remembering
  if an animated sprite (this or a future one) is wanted later.

Things that broke during development, so the same time isn't lost twice:

- **A missing `./` in an import silently breaks everything.** `import ... from
  'touchControls.js'` (missing the leading `./`) causes a 404 that stops all
  JS execution at that point — including code later in the file that attaches
  button/click listeners. Symptom looked like "click to play does nothing,"
  but the actual cause only showed up in the browser console (F12 → Console),
  not visually anywhere on the page. **Lesson: if a click/button silently does
  nothing, check the console before assuming the UI logic is wrong.**
- **Live Server doesn't always notice new files added while it's already
  running.** If a newly created file 404s even though it's in the right
  folder, fully stop and restart Live Server rather than just refreshing the
  browser.
- **Windows hides known file extensions by default**, which can cause a file
  to display as `touchControls.js` in File Explorer while it's actually saved
  as `touchControls.js.txt`. Worth checking if a file "looks right" but still
  404s.
- **`isTouchDevice()` only runs once, when the page first loads.** Toggling
  Chrome DevTools' device/touch emulation *after* the page has already loaded
  won't retroactively switch it into touch mode — reload the page with
  emulation already active.
- **Chrome's "Responsive" device mode does not emulate touch.** Only named
  device presets (e.g. "iPhone 12 Pro") trigger real touch event emulation;
  freely resizing the viewport does not.
- **Raycasting must use `recursive: true`.** The door mesh sits nested inside
  a hinge "pivot" object (so it can swing around an edge instead of its own
  center) rather than being a direct child of the scene. A non-recursive
  raycast only checks direct children of the scene and would silently miss
  it entirely.
- **A door needs an actual gap in the wall, not just a mesh placed in front of
  a solid one.** The first cube-room version placed the door at the exact
  same Z position as a single solid north wall — the door was literally
  embedded inside the wall's geometry, causing z-fighting/flicker at rest
  ("glitched into the wall"). Fixed by splitting that wall into two segments
  with a real doorWidth-sized gap between them, which the door fills.
- **Check which direction a hinged door swings relative to other geometry.**
  Rotating a door pivot can swing it into an adjacent wall if the hinge and
  rotation direction aren't checked against the room layout — this caused
  jittering in the earlier hallway version when the open door intersected a
  side wall. The cube room's hinge/rotation was set up to swing into open
  room space specifically to avoid this.
- **`PointerLockControls.getObject()` returns the camera itself, not a
  separate yaw/pitch wrapper object.** `touchControls.js` was originally
  written assuming a parent "rig" object with the camera nested inside it —
  that assumption was wrong, and caused two bugs: (1) setting yaw and pitch
  independently on the same object without forcing Euler order `'YXZ'`
  produced a visible tilt/roll while turning, and (2) moving with
  `translateZ`/`translateX` moved along the camera's full 3D facing
  direction — including pitch — so looking down while moving forward walked
  straight through the floor. Fixed by forcing `camera.rotation.order =
  'YXZ'` and computing movement from yaw alone (ignoring pitch) rather than
  using `translateZ`/`translateX` on the camera object directly.
- **Escape always force-releases pointer lock — no website JS can prevent
  it.** This means `controls.isLocked` is a free, already-existing "is the
  player actively playing" signal on desktop, reusable for pausing rather
  than needing a separate Escape keydown listener. Doesn't extend to touch
  devices, which never use pointer lock at all — must be explicitly
  excluded from any logic built on this, or mobile ends up permanently
  "paused."
- **`camera.rotation.order = 'YXZ'` needs to be set globally, once, not
  inside a device-specific code path.** It was originally only set inside
  `touchControls.js`'s touch-only setup, which happened to make touch look
  work correctly but left desktop reading a distorted `camera.rotation.y`
  from `PointerLockControls` whenever there was any pitch — `dash.js`
  (added later, reading `rig.rotation.y` to pick a dash direction) exposed
  this as dash appearing to always fire in one fixed world direction on
  desktop specifically. Moved to `main.js`, set once right after the camera
  is created, before any controls exist.
- **Mobile UI elements that overlap the joystick/look zones need a higher
  z-index, but don't need extra event-handling tricks.** The sprint button
  sits inside `#look-zone`'s screen area, but since browsers hit-test to
  whichever element is visually topmost at a touch point, giving the button
  a higher `z-index` was enough — no `stopPropagation()` or similar needed,
  since `look-zone` never actually receives the event in the first place.
- **Collision is circle-vs-AABB, resolved after movement, not predicted in
  advance.** Each frame, movement is applied first, then the player's
  position is pushed back out of any wall/closed-door box it ends up
  overlapping. This is simpler than swept/predictive collision and is
  robust enough for box-shaped rooms with no fast-moving objects — worth
  revisiting only if a future location needs more precision (e.g. thin fast
  projectiles clipping through in one frame).

---

## How to Run Locally

1. Open the folder in VS Code
2. Right-click `index.html` → "Open with Live Server"
3. Must be served over HTTP — opening the file directly (`file://`) breaks
   ES module imports

## How to Test on Mobile

**Without a physical device (Chrome DevTools emulation):**
1. Open DevTools (F12), toggle the device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
2. Select an actual device preset from the dropdown (e.g. "iPhone 12 Pro") —
   not "Responsive," which doesn't emulate touch
3. Reload the page *after* the device preset is selected
4. The "click to play" overlay should be skipped automatically, confirming
   touch mode activated; click-and-drag with the mouse simulates touch —
   left half of screen for the joystick, right half for look
5. Note: emulation is a close approximation, not identical to real hardware —
   do a final check on an actual device before considering this verified

**On a real device (local network):**
1. Ensure phone and computer are on the same WiFi
2. Find your computer's local IP address
3. On phone browser, go to `http://<your-ip>:5500`