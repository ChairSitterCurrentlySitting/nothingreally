// '=' toggles cheat mode on/off. While cheat mode is active, double-tapping
// Space (within DOUBLE_TAP_WINDOW) toggles flying — same convention as
// Minecraft's creative-mode fly toggle. While flying: hold Space to ascend,
// hold Shift to descend, WASD moves horizontally. Collision is skipped
// entirely while flying — this is a noclip-style debug tool for inspecting
// the level, not a "real" gameplay ability, so passing through walls/
// ceilings is intentional.
//
// STOPPING FLIGHT TRIGGERS A SIMPLE FALL, not an instant stop in midair.
// There's no general gravity/ground-detection system in this project
// (matches the documented "vertical collision" gap) — this specifically
// simulates gravity pulling the player down to the standard eye-height
// (1.6), assuming a flat floor at Y=0, exactly like the rest of the
// project already assumes (e.g. portalGun.js's GROUND_Y). This won't
// correctly land on a raised platform — it'll fall straight through to
// the assumed flat ground level regardless of what's actually
// underneath, since there's no way to detect real floor height yet.
//
// Debug inspector (while cheat mode is active): a small panel shows the
// player's current world position and the name of whatever mesh is
// currently under the crosshair (reusing interaction.js's existing
// raycastFromCenter — the same raycast the door-interaction system
// already uses, not a separate one). Left-clicking while cheat mode is
// active additionally shows the EXACT clicked surface point (not just the
// mesh's overall position) directly in this same panel — persists on
// screen until the next click, no console needed — via setLastClickInfo,
// called from main.js's click handler. Full details (name, size, world
// position) also still go to the console for deeper digging when needed.
//
// While cheat mode is active, stamina cannot be lost — sprinting and
// dashing both still "work" but stop costing stamina (see player.js).
//
// Self-contained: owns its own input listeners and its own small on-screen
// status indicator, so main.js only needs to call update() each frame.

const FLY_SPEED = 8; // units/sec, before the speed multiplier below
const DOUBLE_TAP_WINDOW = 300; // ms — max gap between taps to count as a double-tap

const FLY_SPEED_STEP = 0.10;        // 10% per arrow press
const FLY_SPEED_MIN_MULTIPLIER = 0.1;  // not specified — chosen so speed can't hit zero/negative
const FLY_SPEED_MAX_MULTIPLIER = 3.0;  // 300%, as specified

const GRAVITY = 20; // units/sec² — arbitrary, chosen to feel like a reasonably snappy fall, not floaty
const EYE_HEIGHT = 1.6; // matches the camera's normal spawn height (main.js) — assumes flat ground at Y=0

export function setupCheats() {
  const state = {
    cheatModeActive: false,
    isFlying: false,
    flySpeedMultiplier: 1.0,
  };

  let lastSpacePress = 0;
  let spaceHeld = false;
  let shiftHeld = false;

  let isFalling = false;
  let fallVelocity = 0;

  // Text shown on the on-screen debug panel for the most recent click's
  // result — persists until the next click, or until cheat mode is
  // toggled off (then cleared along with everything else).
  let lastClickInfo = '';

  // Turns flying off AND starts the fall — used instead of directly
  // setting state.isFlying = false anywhere, so both places that can stop
  // flying (the Space double-tap, and turning cheat mode off entirely)
  // consistently trigger the same fall behavior rather than one of them
  // silently skipping it.
  function stopFlying() {
    if (!state.isFlying) return;
    state.isFlying = false;
    isFalling = true;
    fallVelocity = 0;
    refreshIndicator();
  }

  // --- Small status indicator, top-right ---
  const indicator = document.createElement('div');
  indicator.id = 'cheat-indicator';
  document.body.appendChild(indicator);

  // --- Debug inspector panel, below the status indicator — position +
  // what's currently under the crosshair, plus the last click's exact
  // coordinates. Only shown while cheat mode is active (see
  // updateDebugInfo).
  const debugPanel = document.createElement('div');
  debugPanel.id = 'cheat-debug-panel';
  document.body.appendChild(debugPanel);

  function refreshIndicator() {
    if (state.isFlying) {
      const pct = Math.round(state.flySpeedMultiplier * 100);
      indicator.textContent = `CHEATS: FLYING ${pct}% speed (Space up / Shift down / \u2191\u2193 speed)`;
    } else if (isFalling) {
      indicator.textContent = 'CHEATS ON — falling...';
    } else if (state.cheatModeActive) {
      indicator.textContent = 'CHEATS ON — infinite stamina, double-tap Space to fly';
    } else {
      indicator.textContent = '';
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === '=' && !e.repeat) {
      state.cheatModeActive = !state.cheatModeActive;
      if (!state.cheatModeActive) stopFlying(); // turning cheats off also grounds the player (via the fall, not instantly)
      refreshIndicator();
    }

    if (e.code === 'Space') {
      if (!e.repeat && state.cheatModeActive) {
        const now = performance.now();
        if (now - lastSpacePress < DOUBLE_TAP_WINDOW) {
          if (state.isFlying) {
            stopFlying();
          } else {
            state.isFlying = true;
            // Reset any leftover fall state in case flying is re-enabled
            // mid-fall — otherwise a stale fallVelocity could carry over
            // to a LATER fall.
            isFalling = false;
            fallVelocity = 0;
            refreshIndicator();
          }
          lastSpacePress = 0; // reset so a third quick press doesn't immediately re-toggle
        } else {
          lastSpacePress = now;
        }
      }
      spaceHeld = true;
    }

    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      shiftHeld = true;
    }

    if (state.isFlying && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
      const delta = e.code === 'ArrowUp' ? FLY_SPEED_STEP : -FLY_SPEED_STEP;
      state.flySpeedMultiplier = Math.min(
        FLY_SPEED_MAX_MULTIPLIER,
        Math.max(FLY_SPEED_MIN_MULTIPLIER, state.flySpeedMultiplier + delta)
      );
      refreshIndicator();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') spaceHeld = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shiftHeld = false;
  });

  // Called every frame (while the game isn't paused). Handles flying
  // (existing) and falling — the brief gravity simulation that starts
  // the moment flying stops (see stopFlying()).
  function update(camera, delta) {
    if (state.isFlying) {
      const speed = FLY_SPEED * state.flySpeedMultiplier;
      if (spaceHeld) camera.position.y += speed * delta;
      if (shiftHeld) camera.position.y = Math.max(0.1, camera.position.y - speed * delta); // don't go below the floor
      return;
    }

    if (isFalling) {
      fallVelocity += GRAVITY * delta;
      camera.position.y -= fallVelocity * delta;

      if (camera.position.y <= EYE_HEIGHT) {
        camera.position.y = EYE_HEIGHT;
        isFalling = false;
        fallVelocity = 0;
        refreshIndicator();
      }
    }
  }

  // position = camera.position (Vector3); lookTargetName = the name of
  // whatever mesh is currently under the crosshair, or null if nothing/
  // an unnamed mesh. main.js computes lookTargetName via
  // interaction.raycastFromCenter(scene) and passes it in — this module
  // doesn't do its own raycasting, just displays what it's given.
  function updateDebugInfo(position, lookTargetName) {
    if (!state.cheatModeActive) {
      debugPanel.textContent = '';
      return;
    }
    const pos = `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`;
    const target = lookTargetName || '(nothing)';
    const clickLine = lastClickInfo ? `\n${lastClickInfo}` : '';
    debugPanel.textContent = `pos: ${pos} — looking at: "${target}" (click to log coords)${clickLine}`;
  }

  // Called from main.js's click handler when cheat mode is active — sets
  // the text shown for the "last click" line in the debug panel above.
  // Takes effect on the very next updateDebugInfo call, which happens
  // every frame, so this is effectively immediate (one frame's delay,
  // ~16ms, imperceptible).
  function setLastClickInfo(text) {
    lastClickInfo = text;
  }

  return { state, update, updateDebugInfo, setLastClickInfo };
}