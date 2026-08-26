import * as THREE from 'three';

// Builds the ground + a hallway leading to a door.
// No collision yet (intentionally deferred) — this is geometry only,
// so you can currently walk through the walls and the door itself.
export function buildWorld(scene) {

  // --- Lighting ---
  // Ambient light so nothing is pure black in shadow
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  // A directional light acts like a sun, gives the walls visible shading
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  // --- Ground ---
  const groundGeo = new THREE.PlaneGeometry(50, 50);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2; // lay it flat
  scene.add(ground);

  // --- Hallway dimensions ---
  // Player starts at z = 5, facing -Z (forward). The hallway runs from
  // just in front of the player to the door at the far end.
  const HALL_WIDTH = 4;    // distance between the two side walls
  const HALL_LENGTH = 20;  // how far the hallway runs
  const WALL_HEIGHT = 4;
  const WALL_THICKNESS = 0.5;

  const hallStartZ = 0;                       // near end, close to player start
  const hallEndZ = hallStartZ - HALL_LENGTH;   // far end, where the door sits
  const hallCenterZ = (hallStartZ + hallEndZ) / 2;

  const wallGeo = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, HALL_LENGTH);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8899aa });

  const leftWall = new THREE.Mesh(wallGeo, wallMat);
  leftWall.position.set(-HALL_WIDTH / 2, WALL_HEIGHT / 2, hallCenterZ);
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(wallGeo, wallMat);
  rightWall.position.set(HALL_WIDTH / 2, WALL_HEIGHT / 2, hallCenterZ);
  scene.add(rightWall);

  // --- Door ---
  // Sits at the far end of the hallway, filling the gap between the two walls.
  // Distinct color so it visually reads as "different from the walls" — this
  // is also the mesh interaction.js raycasts against to trigger opening it.
  //
  // The door mesh is offset inside a "pivot" object positioned at the hinge
  // edge, rather than rotating the door's own center. Rotating the pivot
  // swings the door around that edge, like a real hinge.
  const doorWidth = HALL_WIDTH - WALL_THICKNESS;
  const doorHeight = WALL_HEIGHT * 0.85;

  const doorPivot = new THREE.Object3D();
  doorPivot.position.set(-doorWidth / 2, 0, hallEndZ); // hinge on the left edge of the doorway
  doorPivot.userData.isOpen = false;
  scene.add(doorPivot);

  const doorGeo = new THREE.BoxGeometry(doorWidth, doorHeight, 0.3);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21 }); // brown, reads as "door"
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(doorWidth / 2, doorHeight / 2, 0); // offset from the pivot so it sits in the same place as before
  doorPivot.add(door);

  return { ground, leftWall, rightWall, door, doorPivot };
}

// Snaps the door open or shut instantly (no animation — a quick swing either way).
// Same function handles both directions, since it's the same click/tap either time.
export function toggleDoor(doorPivot) {
  doorPivot.userData.isOpen = !doorPivot.userData.isOpen;
  doorPivot.rotation.y = doorPivot.userData.isOpen ? -Math.PI / 2 : 0;
}