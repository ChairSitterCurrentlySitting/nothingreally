// Tracks player HP, stamina, and sprint state. Pure state + update logic —
// no rendering; ui.js reads these values to draw the HUD bars.

const MAX_HP = 100;
const MAX_STAMINA = 100;

// Sprinting drains stamina fast enough to fully empty it in 7 seconds.
const SPRINT_DRAIN_PER_SECOND = MAX_STAMINA / 7; // ≈ 14.29 per second

// Stamina fully recovers over the same 7-second window while stationary.
const STAMINA_REGEN_PER_SECOND = MAX_STAMINA / 7; // ≈ 14.29 per second

const SPRINT_SPEED_MULTIPLIER = 1.2; // 20% faster while sprinting

const DASH_STAMINA_COST = MAX_STAMINA * 0.10; // dash costs 10% of max stamina = 10

export function createPlayerState() {
  return {
    hp: MAX_HP,
    maxHp: MAX_HP,
    stamina: MAX_STAMINA,
    maxStamina: MAX_STAMINA,
    isSprinting: false, // toggled on/off, not held down
  };
}

// Called every frame regardless of input device. `isMoving` reflects
// whether the player currently has movement input held (WASD or joystick),
// not raw position change. `infiniteStamina` is true while cheat mode is
// active — sprinting still "works" but never costs anything.
//
// Rules:
// - Sprinting AND actually moving  -> drains stamina (the core sprint cost),
//                                     unless infiniteStamina is set.
// - Standing still                 -> stamina recovers, regardless of
//                                     whether sprint is toggled on or off.
//                                     Toggling sprint while stationary no
//                                     longer wastes stamina — it behaves
//                                     the same as sprint being off.
// - Walking (moving, sprint off)   -> stamina neither drains nor recovers.
export function updatePlayerState(state, delta, isMoving, infiniteStamina = false) {
  if (state.isSprinting && isMoving) {
    if (!infiniteStamina) {
      state.stamina = Math.max(0, state.stamina - SPRINT_DRAIN_PER_SECOND * delta);
      if (state.stamina === 0) {
        state.isSprinting = false; // ran out — force off, player re-toggles once it's regenerated
      }
    }
  } else if (!isMoving && state.stamina < state.maxStamina) {
    state.stamina = Math.min(state.maxStamina, state.stamina + STAMINA_REGEN_PER_SECOND * delta);
  }
}

// Flips sprint on/off. Refuses to turn on with zero stamina, so toggling
// "on" never silently does nothing.
export function toggleSprint(state) {
  if (!state.isSprinting && state.stamina <= 0) return;
  state.isSprinting = !state.isSprinting;
}

export function getSpeedMultiplier(state) {
  return state.isSprinting ? SPRINT_SPEED_MULTIPLIER : 1;
}

// Attempts to pay a dash's stamina cost. Returns true and deducts the cost
// if there was enough stamina; returns false and leaves stamina untouched
// otherwise. `infiniteStamina` (cheat mode) always succeeds at no cost.
// The caller (main.js) is responsible for only actually starting the dash
// if this returns true — this function only handles the cost, not whether
// a dash is allowed to fire right now (that's dash.js's cooldown).
export function trySpendDashStamina(state, infiniteStamina = false) {
  if (infiniteStamina) return true;
  if (state.stamina < DASH_STAMINA_COST) return false;
  state.stamina -= DASH_STAMINA_COST;
  return true;
}