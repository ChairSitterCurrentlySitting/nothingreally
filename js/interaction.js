import * as THREE from 'three';

// Casts a ray straight out from the center of the screen (where a crosshair
// would sit) and returns whatever object it hits first, if anything within
// range. Works the same way regardless of whether the "look" direction came
// from mouse-look or touch drag — it just reads the camera's current facing.
export function setupInteraction(camera) {
  const raycaster = new THREE.Raycaster();
  const screenCenter = new THREE.Vector2(0, 0); // (0,0) in normalized device coords = dead center
  const MAX_DISTANCE = 6; // how close you need to be for it to count

  function raycastFromCenter(scene) {
    raycaster.setFromCamera(screenCenter, camera);

    // `true` = recursive, so it finds meshes nested inside pivot objects
    // (like the door, which sits inside a hinge pivot rather than directly in the scene)
    const hits = raycaster.intersectObjects(scene.children, true);

    if (hits.length > 0 && hits[0].distance <= MAX_DISTANCE) {
      return hits[0].object;
    }
    return null;
  }

  return { raycastFromCenter };
}