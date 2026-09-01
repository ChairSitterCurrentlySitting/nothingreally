import * as THREE from 'three';

// Builds an enclosed cube-shaped room (floor, ceiling, 4 walls) with a
// door on one wall. Returns a `walls` array (used by collision.js to build
// collidable boxes) alongside individual named wall references.
export function buildWorld(scene) {

  // --- Lighting ---
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  // --- Room dimensions ---
  // Player starts at (0, 1.6, 5) facing -Z. The room is centered on the
  // origin, so the player starts a couple of units in from the near wall.
  const ROOM_SIZE = 10;         // width and depth of the room (it's a cube footprint)
  const ROOM_HEIGHT = 4;
  const WALL_THICKNESS = 0.5;

  const half = ROOM_SIZE / 2;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8899aa });

  // --- Floor ---
  const floorGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // --- Ceiling ---
  const ceilingGeo = new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE);
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  scene.add(ceiling);

  // --- Four walls ---
  // North/south walls run along X (wide, thin in Z); east/west run along Z (thin in X, deep).
  // The north wall is split into two segments with a real gap between them —
  // this is the doorway. Previously a single solid wall sat at the exact same
  // Z as the door, so the door was actually embedded inside solid geometry
  // (z-fighting/flicker at rest, not a real opening).
  const doorWidth = 2.2;
  const doorHeight = ROOM_HEIGHT * 0.85;
  const nsWallGeo = new THREE.BoxGeometry(ROOM_SIZE, ROOM_HEIGHT, WALL_THICKNESS);
  const ewWallGeo = new THREE.BoxGeometry(WALL_THICKNESS, ROOM_HEIGHT, ROOM_SIZE);

  const northSegmentWidth = (ROOM_SIZE - doorWidth) / 2;
  const northSegGeo = new THREE.BoxGeometry(northSegmentWidth, ROOM_HEIGHT, WALL_THICKNESS);

  const northWallLeft = new THREE.Mesh(northSegGeo, wallMat);
  northWallLeft.position.set(-(doorWidth / 2 + northSegmentWidth / 2), ROOM_HEIGHT / 2, -half);
  scene.add(northWallLeft);

  const northWallRight = new THREE.Mesh(northSegGeo, wallMat);
  northWallRight.position.set(doorWidth / 2 + northSegmentWidth / 2, ROOM_HEIGHT / 2, -half);
  scene.add(northWallRight);

  const southWall = new THREE.Mesh(nsWallGeo, wallMat); // wall behind the player's start
  southWall.position.set(0, ROOM_HEIGHT / 2, half);
  scene.add(southWall);

  const eastWall = new THREE.Mesh(ewWallGeo, wallMat);
  eastWall.position.set(half, ROOM_HEIGHT / 2, 0);
  scene.add(eastWall);

  const westWall = new THREE.Mesh(ewWallGeo, wallMat);
  westWall.position.set(-half, ROOM_HEIGHT / 2, 0);
  scene.add(westWall);

  // --- Door ---
  // Fills the gap left in the north wall. The door mesh sits inside a
  // "pivot" object positioned at the hinge edge, rather than rotating the
  // door's own center — rotating the pivot swings the door around that
  // edge, like a real hinge. It swings toward +Z (into the room), which
  // keeps it well clear of the east/west walls as it opens.
  const doorPivot = new THREE.Object3D();
  doorPivot.position.set(-doorWidth / 2, 0, -half); // hinge on the door's left edge, flush with the gap
  doorPivot.userData.isOpen = false;
  scene.add(doorPivot);

  const doorGeo = new THREE.BoxGeometry(doorWidth, doorHeight, 0.3);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21 }); // brown, reads as "door"
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(doorWidth / 2, doorHeight / 2, 0); // offset from the pivot so it sits centered in the gap
  doorPivot.add(door);

  const walls = [northWallLeft, northWallRight, southWall, eastWall, westWall];

  return { floor, ceiling, walls, northWallLeft, northWallRight, southWall, eastWall, westWall, door, doorPivot };
}

// Snaps the door open or shut instantly (no animation — a quick swing either way).
// Same function handles both directions, since it's the same click/tap either time.
export function toggleDoor(doorPivot) {
  doorPivot.userData.isOpen = !doorPivot.userData.isOpen;
  doorPivot.rotation.y = doorPivot.userData.isOpen ? -Math.PI / 2 : 0;
}