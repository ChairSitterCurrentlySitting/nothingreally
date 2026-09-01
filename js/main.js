import * as THREE from 'three';
import { buildWorld, toggleDoor } from './locations/world.js';
import { buildIkea } from './locations/ikea.js';
import { setupControls } from './controls.js';
import { setupTouchControls, isTouchDevice } from './touchControls.js';
import { setupInteraction } from './interaction.js';
import { setupPortalGun } from './portalGun.js';
import { createPlayerState, updatePlayerState, toggleSprint, getSpeedMultiplier, trySpendDashStamina } from './player.js';
import { createDashState, triggerDash, updateDash, isDashAvailable } from './dash.js';
import { getCollidableBoxes, resolvePlayerCollision } from './collision.js';
import { setupHUD } from './ui.js';
import { setupCheats } from './cheats.js';
import { createInventoryState, selectSlot } from './inventory.js';

// --- Basic Three.js setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
scene.fog = new THREE.Fog(0x1a1a1a, 0, 40); // fades distant objects, hides pop-in

const camera = new THREE.PerspectiveCamera(
  75,                                    // field of view
  window.innerWidth / window.innerHeight, // aspect ratio
  0.1,                                    // near clip
  1000                                    // far clip
);
camera.position.set(0, 1.6, 5); // roughly eye-height, 5 units back from the wall

// Force 'YXZ' Euler order globally (yaw applied outer, pitch inner) — the
// order FPS-style look controls need. Without this, camera.rotation.y stops
// accurately representing pure yaw the moment there's any pitch (PointerLockControls
// itself always computes look correctly internally regardless of this setting,
// but code that reads camera.rotation.y directly — like dash.js — was getting a
// distorted value on desktop specifically, since this was previously only being
// set inside touchControls.js's touch-only setup path).
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Build the world ---
// TEMPORARILY previewing the Ikea location so its layout can be walked and
// checked against the floor plan. To go back to the cube-room test level,
// swap this back to: const world = buildWorld(scene);
const ikea = buildIkea();
scene.add(ikea.group);
const world = ikea;

// --- Player state: HP, stamina, sprint ---
const playerState = createPlayerState();
const dashState = createDashState();
const inventoryState = createInventoryState();
const hud = setupHUD((index) => selectSlot(inventoryState, index));
const cheats = setupCheats();

// --- Movement ---
const { controls, update, isMoving: desktopIsMoving } = setupControls(camera, renderer.domElement);
scene.add(controls.getObject()); // the camera rig PointerLockControls moves around

// --- Interaction: click (desktop) or tap (mobile) to open/close the door ---
const interaction = setupInteraction(camera);

function handleInteract() {
  const hit = interaction.raycastFromCenter(scene);
  if (hit === world.door) {
    toggleDoor(world.doorPivot);
  }
}

// Left click, while actually playing (not the initial "click to play" click,
// which is handled separately by controls.js to engage pointer lock)
document.addEventListener('click', () => {
  if (controls.isLocked) handleInteract();
});

// --- Use action: 'U' key (desktop) or the mobile Use button. Currently
// only the Portal Gun has real behavior (spawns a temporary swirl —
// visual only, no travel); an empty slot instead flashes a brief "nothing
// to use" reaction on the hand. Rebound from right-click, which was
// awkward on a Mac trackpad.
const portalGun = setupPortalGun(scene, camera);
function tryUseSelectedItem() {
  // controls.isLocked is desktop-only — pointer lock is never engaged on
  // touch devices at all, so it's permanently false there. Same pattern
  // as isPaused further down: touch devices are considered "playing"
  // once the blocker's hidden, regardless of isLocked.
  if (!(onTouchDevice || controls.isLocked)) return;

  const selected = inventoryState.slots[inventoryState.selectedIndex];

  if (!selected) {
    hud.flashEmptyHandIcon();
    return;
  }

  if (selected.name === 'Portal Gun') {
    portalGun.trySpawnSwirl(inventoryState);
  }
}

// Attempts to dash: only actually fires (and only spends stamina) if
// dash.js says a dash is currently allowed (not on cooldown/mid-dash).
// Checking availability first avoids wrongly deducting stamina for a dash
// that would've been rejected anyway.
function tryDash() {
  if (isDashAvailable(dashState) && trySpendDashStamina(playerState, cheats.state.cheatModeActive)) {
    triggerDash(dashState);
  }
}

// Sprint toggle — Control key on desktop. Dash — F key. Portal gun use —
// U key. Inventory slots — 1/2/3. e.repeat guards against the key-repeat
// that fires continuously while a key is held, which would otherwise flip
// sprint on/off (or re-trigger dash/use the instant it's next allowed)
// instead of responding once per actual key press.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Control' && !e.repeat) {
    toggleSprint(playerState);
  } else if (e.key.toLowerCase() === 'f' && !e.repeat) {
    tryDash();
  } else if (e.key.toLowerCase() === 'u' && !e.repeat) {
    tryUseSelectedItem();
  } else if (e.key === '1' && !e.repeat) {
    selectSlot(inventoryState, 0);
  } else if (e.key === '2' && !e.repeat) {
    selectSlot(inventoryState, 1);
  } else if (e.key === '3' && !e.repeat) {
    selectSlot(inventoryState, 2);
  }
});

// On touch devices, pointer lock isn't available (no mouse to lock),
// so skip the "click to play" overlay and use the on-screen joystick/look
// controls (and sprint button) instead.
const onTouchDevice = isTouchDevice();
let touchControls = null;
if (onTouchDevice) {
  document.getElementById('blocker').style.display = 'none';
  touchControls = setupTouchControls(
    controls.getObject(),
    camera,
    handleInteract,
    () => toggleSprint(playerState),
    tryDash,
    tryUseSelectedItem
  );
}

// --- Handle window resizing ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Game loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // Escape always force-releases pointer lock (browsers do this
  // unconditionally — no JS can prevent it), which controls.js already
  // listens for to bring the blocker screen back. So controls.isLocked
  // doubles as an "is the game actually running" flag on desktop — no
  // separate Escape listener needed. This doesn't apply on touch devices,
  // which never use pointer lock at all, so they're excluded here or the
  // game would appear permanently paused on mobile.
  const isPaused = !onTouchDevice && !controls.isLocked;

  // Declared outside the pause gate (defaulting false) so it's available
  // for the hand-wobble sync below regardless of pause state — this
  // naturally freezes the wobble on pause too, without special-casing it,
  // since it just stays false whenever the block below doesn't run.
  let isMoving = false;

  if (!isPaused) {
    isMoving = desktopIsMoving() || (touchControls ? touchControls.isMoving() : false);
    updatePlayerState(playerState, delta, isMoving, cheats.state.cheatModeActive);
    // While flying, fly speed governs horizontal movement too, replacing
    // the normal walk/sprint multiplier for as long as flight is active.
    const speedMultiplier = cheats.state.isFlying
      ? cheats.state.flySpeedMultiplier
      : getSpeedMultiplier(playerState);

    update(delta, speedMultiplier);
    if (touchControls) {
      touchControls.update(delta, speedMultiplier);
    }

    updateDash(dashState, controls.getObject(), delta);
    cheats.update(camera, delta);
    portalGun.update(delta);

    // Collision: push the player back out of any wall (or closed door) they
    // ended up inside after this frame's movement (including any dash) was
    // applied. Skipped entirely while flying — noclip is the point of the
    // cheat.
    if (!cheats.state.isFlying) {
      resolvePlayerCollision(camera.position, getCollidableBoxes(world));
    }

    // Future: any Weiqi AI update(s) should also run inside this block,
    // once that system exists — same isPaused gate as everything above.
  }

  if (touchControls) {
    touchControls.updateSprintButton(playerState.isSprinting);
    touchControls.updateDashButton(isDashAvailable(dashState));
    touchControls.updateUseButtonIcon(inventoryState);
  }

  hud.update(playerState);
  hud.updateDashTimer(dashState);
  hud.updatePortalTimer(portalGun.getCooldownRemaining());
  hud.updateInventory(inventoryState);
  hud.updateHandWobble(isMoving);

  renderer.render(scene, camera);
}

animate();