import * as THREE from 'three';

// Player is treated as a simple circle (viewed from above) for collision —
// accurate enough for box-shaped rooms, and much simpler than full 3D shapes.
const PLAYER_RADIUS = 0.35;

const scratchBox = new THREE.Box3(); // reused each call to avoid creating garbage every frame

// Builds a fresh list of collidable {minX, maxX, minZ, maxZ} boxes from a
// world/location object. Recomputed every frame (not cached) since a door's
// state can change — a closed door blocks movement, an open one doesn't.
// door/doorPivot are optional — not every location has one.
export function getCollidableBoxes(world) {
  const boxes = world.walls.map(boxFromMesh);

  if (world.door && world.doorPivot && !world.doorPivot.userData.isOpen) {
    boxes.push(boxFromMesh(world.door));
  }

  return boxes;
}

function boxFromMesh(mesh) {
  scratchBox.setFromObject(mesh); // world-space AABB, correctly accounts for parent transforms (e.g. the door's hinge pivot)
  return {
    minX: scratchBox.min.x, maxX: scratchBox.max.x,
    minZ: scratchBox.min.z, maxZ: scratchBox.max.z,
  };
}

// Pushes `position` (expects .x and .z — e.g. camera.position) out of any
// box it's currently overlapping, using a closest-point circle-vs-AABB
// clamp. Runs AFTER movement is applied each frame ("resolve after move"),
// rather than predicting collisions in advance — simpler, and plenty
// robust for simple box-shaped rooms with no fast-moving objects.
export function resolvePlayerCollision(position, boxes) {
  for (const box of boxes) {
    const closestX = Math.max(box.minX, Math.min(position.x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(position.z, box.maxZ));

    const dx = position.x - closestX;
    const dz = position.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < PLAYER_RADIUS * PLAYER_RADIUS) {
      const dist = Math.sqrt(distSq) || 0.0001; // guards against exact-center overlap (division by zero)
      const overlap = PLAYER_RADIUS - dist;
      position.x += (dx / dist) * overlap;
      position.z += (dz / dist) * overlap;
    }
  }
}