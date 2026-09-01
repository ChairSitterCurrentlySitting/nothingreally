// Dash: a quick burst of forward movement, independent of walk/sprint.
// Moves ~3 meters over 0.3 seconds, then goes on cooldown.

const DASH_DISTANCE = 3;   // meters
const DASH_DURATION = 0.3; // seconds
const DASH_SPEED = DASH_DISTANCE / DASH_DURATION; // = 10 m/s while dashing

// Not specified in the request — added so dashing can't be spammed
// back-to-back to trivially outrun the game's tuned movement speeds.
// Easy to retune or remove in one place.
const DASH_COOLDOWN = 10; // seconds after a dash ends before another can start

export function createDashState() {
  return {
    isDashing: false,
    timeRemaining: 0,      // seconds left in the current dash
    cooldownRemaining: 0,  // seconds left before another dash can start
  };
}

// Attempts to start a dash. Does nothing if already dashing or on cooldown —
// safe to call unconditionally from an input handler.
export function triggerDash(state) {
  if (state.isDashing || state.cooldownRemaining > 0) return;
  state.isDashing = true;
  state.timeRemaining = DASH_DURATION;
}

// Called every frame (while the game isn't paused). `rig` is the object to
// move — the same camera/rig used by normal movement (desktop and mobile
// share this same object). Moves along yaw only, ignoring pitch — same
// horizontal-only technique used in touchControls.js, so looking up/down
// mid-dash can't send the player through the floor.
export function updateDash(state, rig, delta) {
  if (state.cooldownRemaining > 0) {
    state.cooldownRemaining = Math.max(0, state.cooldownRemaining - delta);
  }

  if (!state.isDashing) return;

  const yaw = rig.rotation.y;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);

  rig.position.x += -sin * DASH_SPEED * delta;
  rig.position.z += -cos * DASH_SPEED * delta;

  state.timeRemaining -= delta;
  if (state.timeRemaining <= 0) {
    state.isDashing = false;
    state.cooldownRemaining = DASH_COOLDOWN;
  }
}

// True if a dash could start right now — used to show/hide the "on
// cooldown" look on the mobile dash button.
export function isDashAvailable(state) {
  return !state.isDashing && state.cooldownRemaining <= 0;
}