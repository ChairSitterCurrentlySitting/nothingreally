# DESIGN.md — Escape Game

Living spec for this project. Update this file whenever a feature is finished
or a decision is made — paste its contents into a new chat with Claude to get
it back up to speed without re-explaining everything.

---

## Core Concept

A first-person, browser-playable "collect objects to escape a setting" game.
Player explores an environment, finds and picks up objective items, and
escapes once all objectives are collected.

**Visual style:** ASCII art. The game renders as full 3D under the hood
(real geometry, lighting, camera), then Three.js's `AsciiEffect`
post-processes the rendered frame into text characters. This means all
normal 3D benefits (depth, perspective, shading) are kept, but the final
look is a moving ASCII scene.

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
│   ├── world.js           # Builds level geometry (hallway + door at far end)
│   ├── player.js          # (not yet implemented) player state/inventory
│   ├── objects.js         # (not yet implemented) collectible item definitions
│   ├── interaction.js     # Raycast from screen center; used to detect "looking at the door"
│   ├── gameState.js       # (not yet implemented) win/lose condition tracking
│   └── ui.js               # (not yet implemented) HUD updates
├── assets/
│   ├── models/           # for future .glb imports (Blender exports)
│   ├── textures/
│   └── sounds/
└── README.md
```

---

## Features Built So Far

- [x] Basic Three.js scene: ground plane, hallway (two side walls) leading to
      a door at the far end, ambient + directional lighting, fog. Collision
      intentionally deferred — walls and the door are currently walk-through,
      geometry only.
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

## Features Planned (not yet built)

- [ ] Data-driven map/level layout (JSON or grid-based, replacing the single
      hardcoded wall in `world.js`)
- [ ] Collectible objects placed in the scene (`objects.js`)
- [ ] Inventory / objective counter (`player.js`, `gameState.js`)
- [ ] Win condition: escape trigger once all objectives collected
- [ ] HUD: objective counter, prompts, win/lose screens (`ui.js`)
- [ ] ASCII rendering via Three.js `AsciiEffect` (visual style layer — should
      not require changes to game logic once added)
- [ ] Basic collision (can't walk through walls) — currently absent
- [ ] Sound effects / ambient audio
- [ ] Theme/setting decision (not yet chosen — spooky mansion, sci-fi facility,
      etc.)

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
- **Asset limitation**: no real 3D models or textures have been sourced yet —
  everything so far is procedural geometry (boxes/planes). Given the ASCII
  visual style, this may not matter much even long-term.

---

## Debugging Notes / Gotchas

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