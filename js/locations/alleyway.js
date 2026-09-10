import * as THREE from 'three';

// Alleyway location — a 100m stretch of road flanked by two tall walls
// (implied buildings), scattered with garbage-dump cuboids of varying
// sizes as obstacles to navigate around. Same buildX() -> { group, walls }
// shape as every other location module (Ikea, Digital Circus) — no scene
// parameter, self-contained THREE.Group, so it drops straight into
// main.js's LOCATIONS registry.
//
// The short ends (near/far) are left open — no end-cap walls. The scene's
// fog (set in main.js, 40-unit falloff) naturally obscures the transition
// to open space beyond either end, so no explicit boundary was needed
// there.

const ALLEY_LENGTH = 100; // meters (Z axis)
const ALLEY_WIDTH = 8;    // meters (X axis) — narrow, but enough room to weave around garbage
const WALL_HEIGHT = 8;    // taller than this project's usual 4m rooms — reads as multi-story buildings flanking the alley
const WALL_THICKNESS = 0.5;

const half = ALLEY_WIDTH / 2;
const alleyStartZ = 5;               // matches the player's usual spawn Z (5), so travel drops them right at one end
const alleyEndZ = alleyStartZ - ALLEY_LENGTH;
const alleyCenterZ = alleyStartZ - ALLEY_LENGTH / 2;

// Garbage dump "zones" spaced along the alley's length — each zone gets a
// small cluster of cuboids, alternating which side of the alley they're
// pushed toward for visual variety and to keep the path winding rather
// than a straight clear line down the middle.
const DUMP_ZONE_SPACING = 12; // meters between zones

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function buildAlleyway() {
  const group = new THREE.Group();
  const walls = [];

  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  group.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(5, 15, 5);
  group.add(sun);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x5c5850 });

  // --- Road (floor) ---
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ALLEY_WIDTH, ALLEY_LENGTH), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, alleyCenterZ);
  group.add(road);

  // --- Two long walls flanking the alley, full length, no gaps ---
  const sideWallGeo = new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, ALLEY_LENGTH);

  const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
  leftWall.position.set(-half, WALL_HEIGHT / 2, alleyCenterZ);
  group.add(leftWall);
  walls.push(leftWall);

  const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
  rightWall.position.set(half, WALL_HEIGHT / 2, alleyCenterZ);
  group.add(rightWall);
  walls.push(rightWall);

  // --- Garbage dump cuboids ---
  // A small palette of grungy colors, randomly assigned per cuboid so
  // dumps don't look uniform.
  const garbageColors = [0x4a4030, 0x5a5540, 0x3f3f2f, 0x554433, 0x484838];

  // Large garbage dumps genuinely block movement — real obstacles to
  // navigate around, not decoration, so every cuboid gets pushed into
  // `walls` too.
  function addGarbageCuboid(z, side) {
    const width = randomRange(0.8, 2.5);
    const height = randomRange(0.6, 2.5);
    const depth = randomRange(0.8, 2.5);
    const color = garbageColors[Math.floor(Math.random() * garbageColors.length)];
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color })
    );

    // How far the cuboid's center sits from its wall — small values hug
    // the wall, larger values push further into the alley, occasionally
    // reaching past center. Since dumps alternate sides zone-by-zone
    // (not simultaneously at the same Z), this narrows the path without
    // ever fully sealing it off.
    const intrusion = randomRange(width / 2 + 0.2, ALLEY_WIDTH * 0.55);
    const wallX = side === 'left' ? -half : half;
    const xPos = side === 'left' ? wallX + intrusion : wallX - intrusion;

    mesh.position.set(xPos, height / 2, z);
    group.add(mesh);
    walls.push(mesh);
  }

  let z = alleyStartZ - 6; // first zone a little way in from the spawn end, leaving a clear starting buffer
  let side = 'left';
  while (z > alleyEndZ + 6) {
    const cuboidCount = 2 + Math.floor(Math.random() * 3); // 2–4 per zone
    for (let i = 0; i < cuboidCount; i++) {
      addGarbageCuboid(z + randomRange(-2, 2), side);
    }
    side = side === 'left' ? 'right' : 'left'; // alternate sides zone to zone
    z -= DUMP_ZONE_SPACING;
  }

  return { group, walls };
}