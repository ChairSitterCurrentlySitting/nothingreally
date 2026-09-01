// Cheat mode — desktop-only testing tools. Not built for mobile yet.
//
// '=' toggles cheat mode on/off. While cheat mode is active, double-tapping
// Space (within DOUBLE_TAP_WINDOW) toggles flying — same convention as
// Minecraft's creative-mode fly toggle. While flying: hold Space to ascend,
// hold Shift to descend, WASD moves horizontally. Collision is skipped
// entirely while flying — this is a noclip-style debug tool for inspecting
// the level, not a "real" gameplay ability, so passing through walls/
// ceilings is intentional.
//
// Up/Down arrows adjust fly speed by 10% per press, from 10% up to the
// specified max of 300%. This governs BOTH vertical (Space/Shift) and
// horizontal (WASD) movement speed while flying — a judgment call, since
// "fly speed" wasn't specified as vertical-only or overall; overall speed
// seemed more useful for a level-inspection tool. Easy to split into
// separate vertical/horizontal rates later if vertical-only was intended.
//
// While cheat mode is active, stamina cannot be lost — sprinting and
// dashing both still "work" but stop costing stamina (see player.js).
//
// Self-contained: owns its own input listeners and its own small on-screen
// status indicator, so main.js only needs to call update() each frame.

const DOUBLE_TAP_WINDOW = 300; // ms
const FLY_SPEED = 8; // units per second, vertical/horizontal movement while flying, before the speed multiplier

const FLY_SPEED_STEP = 0.10;        // 10% per arrow press
const FLY_SPEED_MIN_MULTIPLIER = 0.1;  // not specified — chosen so speed can't hit zero/negative
const FLY_SPEED_MAX_MULTIPLIER = 3.0;  // 300%, as specified

export function setupCheats() {
  const state = {
    cheatModeActive: false,
    isFlying: false,
    flySpeedMultiplier: 1.0, // 100% — adjustable via Up/Down arrows, clamped 10%–300%
  };

  let lastSpacePress = 0;
  let spaceHeld = false;
  let shiftHeld = false;

  // --- Small status indicator, top-right ---
  const indicator = document.createElement('div');
  indicator.id = 'cheat-indicator';
  document.body.appendChild(indicator);

  function refreshIndicator() {
    if (state.isFlying) {
      const pct = Math.round(state.flySpeedMultiplier * 100);
      indicator.textContent = `CHEATS: FLYING ${pct}% speed (Space up / Shift down / \u2191\u2193 speed)`;
    } else if (state.cheatModeActive) {
      indicator.textContent = 'CHEATS ON — infinite stamina, double-tap Space to fly';
    } else {
      indicator.textContent = '';
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === '=' && !e.repeat) {
      state.cheatModeActive = !state.cheatModeActive;
      if (!state.cheatModeActive) state.isFlying = false; // turning cheats off also grounds the player
      refreshIndicator();
    }

    if (e.code === 'Space') {
      if (!e.repeat && state.cheatModeActive) {
        const now = performance.now();
        if (now - lastSpacePress < DOUBLE_TAP_WINDOW) {
          state.isFlying = !state.isFlying;
          lastSpacePress = 0; // reset so a third quick press doesn't immediately re-toggle
          refreshIndicator();
        } else {
          lastSpacePress = now;
        }
      }
      spaceHeld = true;
    }

    if (e.key === 'Shift') shiftHeld = true;

    // Fly speed adjustment. Deliberately NOT guarded by !e.repeat, unlike
    // the toggles above — holding the arrow key to continuously ramp speed
    // up/down is more useful here than requiring individual presses.
    if (state.cheatModeActive && e.code === 'ArrowUp') {
      state.flySpeedMultiplier = Math.min(FLY_SPEED_MAX_MULTIPLIER, state.flySpeedMultiplier + FLY_SPEED_STEP);
      refreshIndicator();
    }
    if (state.cheatModeActive && e.code === 'ArrowDown') {
      state.flySpeedMultiplier = Math.max(FLY_SPEED_MIN_MULTIPLIER, state.flySpeedMultiplier - FLY_SPEED_STEP);
      refreshIndicator();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') spaceHeld = false;
    if (e.key === 'Shift') shiftHeld = false;
  });

  // Called every frame (while the game isn't paused). Only does anything
  // while actually flying.
  function update(camera, delta) {
    if (!state.isFlying) return;
    const speed = FLY_SPEED * state.flySpeedMultiplier;
    if (spaceHeld) camera.position.y += speed * delta;
    if (shiftHeld) camera.position.y = Math.max(0.1, camera.position.y - speed * delta); // don't go below the floor
  }

  return { state, update };
}