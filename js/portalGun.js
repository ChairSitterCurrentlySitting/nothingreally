import * as THREE from 'three';

// 'U' key (desktop) or the mobile Use button, while the Portal Gun is the
// selected inventory slot, spawns a billboarded swirl sprite 4 meters in
// front of the player, which disappears after 5 seconds. No portal
// *travel* here yet — this is just the visual spawn/despawn, same
// "visual only" scope as adding the item to the inventory slot in the
// first place.
//
// Texture is a static oval-cropped PNG (background-removed, transparent
// corners) — no animated frames. Motion is faked with a "ghost trail":
// each swirl is a stack of sprites, not one — a fully opaque "front" copy
// at the current SIZE, plus several fainter copies behind it showing
// progressively OLDER (slightly different) sizes, creating a soft pulsing
// blur rather than a crisp static shape. Since scale is a pure function
// of elapsed time, each ghost's size is just that formula evaluated at an
// earlier virtual timestamp — no history is actually recorded frame by
// frame.
//
// IMPORTANT: there is NO rotation anywhere in this file, on purpose. Two
// earlier attempts both involved rotation and were both reverted:
// (1) Plain single-sprite rotation — spinning an OVAL's whole silhouette
// around its center visibly rotates the portrait/landscape aspect back
// and forth, reading as a mechanical object (a fidget spinner).
// (2) Blurring that SAME rotation across a ghost trail — this only
// softened the edges, it didn't remove the underlying rotation, so the
// whole trail still visibly swept around like a spinning shape. Trailing
// scale instead of rotation avoids this category of problem entirely,
// since the silhouette's orientation never changes.
// Before either of those, an even earlier attempt panned the texture's UV
// offset — also reverted, for different reasons (see the gotcha in
// DESIGN.md).

const SWIRL_TEXTURE_PATH = 'assets/textures/sprites/portalthing_oval.png';
const SPAWN_DISTANCE = 4; // meters in front of the player (horizontal — see note below)
const SWIRL_LIFETIME = 5; // seconds before a spawned swirl disappears
const SWIRL_FADE_DURATION = 0.75; // seconds — fades out over this final window of the lifetime, instead of vanishing abruptly
const USE_COOLDOWN = 15; // seconds before the portal gun can be used again

// Scale pulse driving the trail — a gentle "breathing" size variation, NOT
// rotation. PULSE_AMOUNT is how much the size varies (0.1 = ±10%);
// PULSE_SPEED controls how fast it pulses.
const PULSE_SPEED = 0.5;
const PULSE_AMOUNT = 0.1;

// Ghost trail. TRAIL_COUNT is how many faded copies trail behind the
// front sprite (total sprites per swirl = TRAIL_COUNT + 1). TRAIL_LAG is
// how many seconds "behind" each successive ghost's size snapshot is.
// TRAIL_OPACITY_FALLOFF is what fraction as opaque each successive ghost
// is compared to the one in front of it (so opacity drops off
// geometrically: 1, 0.6, 0.36, 0.22, ... for a falloff of 0.6).
const TRAIL_COUNT = 4;
const TRAIL_LAG = 0.05;
const TRAIL_OPACITY_FALLOFF = 0.6;

// Cheap "sum of sines" pseudo-noise — several sine waves at different
// frequencies and phases, added together. Not true Perlin/Simplex noise,
// but visually close enough for this, with zero dependencies. `seed`
// offsets the phase so different swirls don't pulse in lockstep with
// each other.
function pseudoNoise(t, seed) {
  return (
    Math.sin(t * 1.3 + seed) * 0.5 +
    Math.sin(t * 2.7 + seed * 1.7) * 0.3 +
    Math.sin(t * 4.1 + seed * 0.6) * 0.2
  );
}

// World Y coordinate of the floor in the current locations (world.js and
// ikea.js both place their floor at y=0). Portals always snap their
// bottom edge to this, regardless of where the player is aiming
// vertically — see the ground-snapping note in trySpawnSwirl below.
const GROUND_Y = 0;

// Source image is 1183×2560 (portrait — much taller than wide). The sprite
// used to be forced square (SWIRL_SIZE × SWIRL_SIZE), which squished a
// portrait image into a square footprint. SWIRL_HEIGHT is the anchor
// dimension; width is derived from the real aspect ratio so the image
// displays at its correct proportions instead of being stretched.
const SWIRL_TEXTURE_ASPECT = 1183 / 2560;
const SWIRL_HEIGHT = 3.15; // meters — 2.1 * 1.5 (another 1.5x on top of the earlier 40% increase)
const SWIRL_WIDTH = SWIRL_HEIGHT * SWIRL_TEXTURE_ASPECT;

const textureLoader = new THREE.TextureLoader();
const swirlTexture = textureLoader.load(SWIRL_TEXTURE_PATH);

export function setupPortalGun(scene, camera) {
  // Multiple swirls can be active at once — each one independently
  // disappears 5 seconds after ITS OWN spawn, not a shared/reset timer, so
  // using the portal gun again before an existing swirl vanishes doesn't
  // cut its life short or extend it.
  const activeSwirls = []; // { sprites: [...], timeRemaining, age, noiseSeed }

  let cooldownRemaining = 0; // seconds left before the gun can fire again

  function isHoldingPortalGun(inventoryState) {
    const selected = inventoryState.slots[inventoryState.selectedIndex];
    return Boolean(selected && selected.name === 'Portal Gun');
  }

  // Call from the 'U' keydown handler or the mobile Use button (main.js's tryUsePortalGun()).
  function trySpawnSwirl(inventoryState) {
    if (!isHoldingPortalGun(inventoryState)) return;
    if (cooldownRemaining > 0) return;

    // Horizontal direction only (yaw), deliberately ignoring pitch
    // entirely — was previously camera.getWorldDirection() (full 3D,
    // pitch included) specifically so aiming up/down mattered, but that's
    // reversed now: the portal always sits on the ground and appears in
    // front of the player based on which way they're facing left/right,
    // regardless of whether they're looking up, down, or level.
    const yaw = camera.rotation.y;
    const dirX = -Math.sin(yaw);
    const dirZ = -Math.cos(yaw);

    const spawnPos = new THREE.Vector3(
      camera.position.x + dirX * SPAWN_DISTANCE,
      // Sprite position is its CENTER, not its base — offsetting by half
      // the height makes the BOTTOM edge sit exactly at GROUND_Y instead
      // of the sprite's center (which would leave it half-buried).
      GROUND_Y + SWIRL_HEIGHT / 2,
      camera.position.z + dirZ * SPAWN_DISTANCE
    );

    // A stack of sprites forms the ghost trail — see the header comment.
    // All share the same texture (scale is set directly on each sprite
    // itself, not the texture, so no per-sprite texture cloning is
    // needed), same position, differing only in scale/opacity once
    // update() starts animating them.
    //
    // renderOrder is set explicitly (front sprite highest) rather than
    // left to Three.js's default distance-based transparency sorting —
    // multiple sprites at the exact same position have no meaningful
    // distance difference to sort by, which would otherwise cause
    // flickering/inconsistent draw order between them frame to frame.
    const sprites = [];
    for (let g = 0; g <= TRAIL_COUNT; g++) {
      const material = new THREE.SpriteMaterial({ map: swirlTexture, transparent: true, opacity: g === 0 ? 1 : 0 });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(spawnPos);
      sprite.scale.set(SWIRL_WIDTH, SWIRL_HEIGHT, 1);
      sprite.renderOrder = TRAIL_COUNT - g; // front (g=0) draws last/on top
      scene.add(sprite);
      sprites.push(sprite);
    }

    activeSwirls.push({
      sprites,
      timeRemaining: SWIRL_LIFETIME,
      age: 0, // seconds since spawn — drives the scale-pulse/trail animation
      noiseSeed: Math.random() * 100, // random phase so simultaneous swirls don't pulse in lockstep
    });
    cooldownRemaining = USE_COOLDOWN;
  }

  // Called every frame (while the game isn't paused).
  function update(delta) {
    if (cooldownRemaining > 0) {
      cooldownRemaining = Math.max(0, cooldownRemaining - delta);
    }

    for (let i = activeSwirls.length - 1; i >= 0; i--) {
      const swirl = activeSwirls[i];
      swirl.timeRemaining -= delta;
      swirl.age += delta;

      // Overall fade multiplier for the swirl's final SWIRL_FADE_DURATION
      // seconds of life — applied on top of each ghost's own trail
      // opacity below, so the whole stack fades out together rather than
      // vanishing abruptly.
      const fadeMultiplier = swirl.timeRemaining <= SWIRL_FADE_DURATION
        ? Math.max(0, swirl.timeRemaining / SWIRL_FADE_DURATION)
        : 1;

      for (let g = 0; g < swirl.sprites.length; g++) {
        // Each ghost shows the SIZE as it was TRAIL_LAG * g seconds ago —
        // clamped at 0 so early frames (before enough time has passed for
        // the full lag) don't go negative. No rotation anywhere here.
        const ghostAge = Math.max(0, swirl.age - g * TRAIL_LAG);
        const pulse = pseudoNoise(ghostAge * PULSE_SPEED, swirl.noiseSeed) * PULSE_AMOUNT;
        const scaleMultiplier = 1 + pulse;

        const trailOpacity = Math.pow(TRAIL_OPACITY_FALLOFF, g); // 1, 0.6, 0.36, 0.22, ...

        const sprite = swirl.sprites[g];
        sprite.scale.set(SWIRL_WIDTH * scaleMultiplier, SWIRL_HEIGHT * scaleMultiplier, 1);
        sprite.material.opacity = trailOpacity * fadeMultiplier;
      }

      if (swirl.timeRemaining <= 0) {
        for (const sprite of swirl.sprites) {
          scene.remove(sprite);
          sprite.material.dispose(); // just the material — the texture is shared across all swirls/ghosts, not cloned, so it isn't disposed per-instance
        }
        activeSwirls.splice(i, 1);
      }
    }
  }

  // Read-only — used by ui.js to display a cooldown countdown.
  function getCooldownRemaining() {
    return cooldownRemaining;
  }

  return { trySpawnSwirl, update, getCooldownRemaining };
}