import * as THREE from 'three';
import { buildWorld, toggleDoor } from './locations/world.js';
import { buildIkea } from './locations/ikea.js';
import { buildDigitalCircus } from './locations/digitalCircus.js';
import { buildAlleyway } from './locations/alleyway.js';
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
import { setupSettingsMenu } from './settingsMenu.js';
import { setupTravelMenu } from './travelMenu.js';

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

// --- Location registry + world state ---
// Maps a location key (used by the travel menu) to its build function and
// display label. Add new locations here as they're built.
//
// Note: the original cube-room test level (world.js's buildWorld) isn't
// included — its buildWorld(scene) takes a different signature (adds
// directly to a scene, doesn't return a self-contained group the way
// every location module since Ikea does) and hasn't been retrofitted to
// match, so it's not travel-menu-compatible yet.
const LOCATIONS = {
  ikea: { label: 'Ikea', build: buildIkea },
  digitalCircus: { label: 'Digital Circus', build: buildDigitalCircus },
  alleyway: { label: 'Alleyway', build: buildAlleyway },
};

// `world` and `currentLocationKey` are both `let` — this is the first
// place in the project where the active location can change at runtime
// (see travelTo() further down). Every other system in this file
// (collision, door interaction) reads `world` fresh each time it's used
// rather than capturing a snapshot at setup time, so reassigning it here
// is picked up correctly everywhere else with no further wiring needed.
let currentLocationKey = 'digitalCircus';
let world = LOCATIONS[currentLocationKey].build();
scene.add(world.group);

// --- Player state: HP, stamina, sprint ---
const playerState = createPlayerState();
const dashState = createDashState();
const inventoryState = createInventoryState();
const hud = setupHUD((index) => selectSlot(inventoryState, index));
const cheats = setupCheats();

// --- Movement ---
const { controls, update, isMoving: desktopIsMoving } = setupControls(camera, renderer.domElement);
scene.add(controls.getObject()); // the camera rig PointerLockControls moves around

// --- Settings menu: Escape (desktop) or the mobile pause icon. Empty for
// now except a Resume button — see settingsMenu.js.
//
// onTouchDevice is referenced here via closure even though it's declared
// further down — safe because this callback only ever runs later, in
// response to a click, by which point the whole script (including that
// declaration) has already finished executing top-to-bottom.
const settingsMenu = setupSettingsMenu(() => {
  if (onTouchDevice) {
    settingsMenu.close(); // no pointer-lock concept on mobile — close directly, nothing else will ever do it
  } else {
    controls.lock(); // desktop: attempt to re-lock; the menu closes itself once this genuinely succeeds (the 'lock' listener just below) — NOT here, since the browser can silently reject this if it happens too soon after an Escape-triggered unlock (see settingsMenu.js's comment for why that used to cause a real softlock)
  }
});

// Desktop: pressing Escape always force-releases pointer lock (browsers do
// this unconditionally, no JS can prevent it) — 'unlock' firing is exactly
// the moment to open the settings menu. 'lock' firing (e.g. clicking
// Resume, once it actually succeeds) closes it back up, keeping the
// menu's visibility in sync with real lock state rather than assumed.
//
// suppressNextSettingsOpen exists because the travel menu (below) ALSO
// needs to unlock the pointer to become usable — without this flag, that
// unlock would trigger THIS listener too, popping the settings menu open
// simultaneously alongside the travel menu.
let suppressNextSettingsOpen = false;

controls.addEventListener('unlock', () => {
  if (suppressNextSettingsOpen) {
    suppressNextSettingsOpen = false;
    return;
  }
  settingsMenu.open();
});
controls.addEventListener('lock', () => {
  settingsMenu.close();
  travelMenu.close();
});

// --- Travel menu: opened when the player uses the Portal Gun (see
// tryUseSelectedItem further down). Freezes the game and lists every
// known location — clicking one other than the current location travels
// there. See travelMenu.js for the menu's own UI/visibility; this is
// where the actual location-switching happens.
const travelMenu = setupTravelMenu(LOCATIONS, (key) => travelTo(key));

function travelTo(key) {
  if (key === currentLocationKey) return; // safety guard — the menu already disables this button, but just in case

  // The switch itself happens immediately, regardless of whether pointer
  // lock re-acquisition below succeeds — the player is genuinely in the
  // new location the instant this runs.
  scene.remove(world.group);
  // Not disposing of the old location's geometry/materials/textures here —
  // a real gap for long play sessions (repeated travel would leak GPU
  // memory over time), flagged as a known limitation, not fixed in this pass.

  world = LOCATIONS[key].build();
  scene.add(world.group);
  currentLocationKey = key;

  // Reasonable default spawn point, not location-specific yet — every
  // current location happens to treat roughly this area as open/walkable,
  // but this could use real per-location spawn points later.
  camera.position.set(0, 1.6, 5);
  camera.rotation.set(0, 0, 0);

  // Closing the menu / resuming control: same lesson learned from
  // settingsMenu.js — don't close optimistically. Mobile has no lock
  // concept, so close directly; desktop attempts re-lock and lets the
  // real 'lock' event (the listener above) close the menu once it
  // actually succeeds, rather than assuming success.
  if (onTouchDevice) {
    travelMenu.close();
  } else {
    controls.lock();
  }
}

function openTravelMenu() {
  // Unlocking to reveal a usable cursor is NOT the failure-prone
  // direction — browsers don't restrict exiting pointer lock, only
  // re-entering it — so this is safe to do immediately, unlike
  // travelTo()'s re-lock above.
  if (!onTouchDevice && controls.isLocked) {
    suppressNextSettingsOpen = true;
    controls.unlock();
  }
  travelMenu.open(currentLocationKey);
}

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
  if (!controls.isLocked) return;
  handleInteract();

  if (cheats.state.cheatModeActive) {
    const hit = interaction.raycastDetailsFromCenter(scene);
    if (hit) {
      const box = new THREE.Box3().setFromObject(hit.object);
      const size = new THREE.Vector3();
      box.getSize(size);
      const clickedPoint = hit.point.toArray().map(n => n.toFixed(2)).join(', ');
      const objectPos = hit.object.getWorldPosition(new THREE.Vector3()).toArray().map(n => n.toFixed(2)).join(', ');

      cheats.setLastClickInfo(`Last click: (${clickedPoint}) on "${hit.object.name}"`);   // ADD THIS LINE

      console.log(
        `[debug inspect] clicked point: (${clickedPoint}) — ` +
        `mesh "${hit.object.name}" — object position: (${objectPos}) — ` +
        `size (x,y,z): ${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}`
      );
    } else {
      cheats.setLastClickInfo('Last click: nothing under the crosshair');   // ADD THIS LINE
      console.log('[debug inspect] nothing under the crosshair');
    }
  }
});

// --- Use action: 'U' key (desktop) or the mobile Use button. Currently
// only the Portal Gun has real behavior — spawns a temporary swirl (still
// visual) and now ALSO opens the travel menu (see openTravelMenu above),
// freezing the game to pick a destination. An empty slot instead flashes
// a brief "nothing to use" reaction on the hand. Rebound from right-click,
// which was awkward on a Mac trackpad.
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
    // trySpawnSwirl returns false if blocked by cooldown — only open the
    // travel menu on a genuine use, not a press that did nothing.
    const spawned = portalGun.trySpawnSwirl(inventoryState);
    if (spawned) {
      openTravelMenu();
    }
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
// U key. Inventory slots — 1/2/3. Escape closes the settings menu if it's
// already open (opening it is handled automatically — see the 'unlock'
// listener above — since Escape's pointer-unlock behavior only triggers
// while pointer lock is actually active; pressing it again once already
// unlocked/menu-open does nothing on its own without this). e.repeat
// guards against the key-repeat that fires continuously while a key is
// held, which would otherwise flip sprint on/off (or re-trigger dash/use
// the instant it's next allowed) instead of responding once per actual
// key press.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Control' && !e.repeat) {
    toggleSprint(playerState);
  } else if (e.key.toLowerCase() === 'f' && !e.repeat) {
    tryDash();
  } else if (e.key.toLowerCase() === 'u' && !e.repeat) {
    tryUseSelectedItem();
  } else if (e.key === 'Escape' && !e.repeat && settingsMenu.state.isOpen) {
    // Same fix as the Resume button (settingsMenu.js) — don't close
    // optimistically. On desktop, wait for the real 'lock' event to close
    // it; a rejected re-lock attempt (browser cooldown right after an
    // Escape-triggered unlock) would otherwise leave the menu gone but the
    // game still paused, with no way to retry.
    if (onTouchDevice) {
      settingsMenu.close();
    } else {
      controls.lock();
    }
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
    tryUseSelectedItem,
    () => settingsMenu.open()
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
  // unconditionally — no JS can prevent it), which now opens the settings
  // menu (see the 'unlock' listener above) instead of the old blocker
  // reappearing. So controls.isLocked still doubles as an "is the game
  // actually running" flag on desktop. This doesn't apply on touch
  // devices, which never use pointer lock at all, so they're excluded
  // from THIS term — but settingsMenu.state.isOpen/travelMenu.state.isOpen
  // cover pausing for both platforms uniformly, since those are the
  // things the mobile pause icon, portal gun use, and desktop's
  // Escape/Resume flow all actually share.
  const isPaused = (!onTouchDevice && !controls.isLocked) || settingsMenu.state.isOpen || travelMenu.state.isOpen;

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

  // Debug inspector display — only bothers raycasting if cheat mode is
  // actually active, to avoid a wasted raycast every frame otherwise.
  if (cheats.state.cheatModeActive) {
    const lookTarget = interaction.raycastFromCenter(scene);
    cheats.updateDebugInfo(camera.position, lookTarget ? lookTarget.name : null);
  }

  renderer.render(scene, camera);
}

animate();