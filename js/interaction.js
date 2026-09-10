import * as THREE from 'three';

// Screen-center raycasting — used for "what is the player looking at"
// checks: door interaction (main.js's handleInteract) and the cheat-mode
// debug inspector (cheats.js/main.js). One shared Raycaster instance,
// reused across calls rather than creating a new one each time.
//
// recursive=true on intersectObjects is required — the door mesh is
// nested inside a pivot Object3D (for the hinge rotation), so a
// non-recursive raycast against only scene.children directly would miss
// it entirely.

export function setupInteraction(camera) {
  const raycaster = new THREE.Raycaster();
  const screenCenter = new THREE.Vector2(0, 0);

  // Returns the mesh directly under the crosshair, or null if nothing's
  // hit. Many callers (door interaction, the continuous "looking at"
  // debug display) only need the object itself, not the exact point of
  // intersection, so this stays as-is.
  function raycastFromCenter(scene) {
    raycaster.setFromCamera(screenCenter, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    return intersects.length > 0 ? intersects[0].object : null;
  }

  // Returns { object, point } for whatever's under the crosshair, or null
  // if nothing's hit — point is the exact world-space coordinate
  // (THREE.Vector3) where the ray struck the surface, NOT the object's
  // own pivot/origin position. Added specifically for the cheat-mode
  // debug inspector's click-to-log-coordinates feature (main.js) —
  // mapping out exact vertex coordinates for manual collision boxes needs
  // the precise clicked point, which raycastFromCenter alone can't give,
  // since it only ever returns the mesh itself.
  function raycastDetailsFromCenter(scene) {
    raycaster.setFromCamera(screenCenter, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    return intersects.length > 0
      ? { object: intersects[0].object, point: intersects[0].point }
      : null;
  }

  return { raycastFromCenter, raycastDetailsFromCenter };
}