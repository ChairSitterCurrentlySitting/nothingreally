import * as THREE from 'three';

// Ikea location — walls only, no props/detail yet (per "ignore all details,
// just get the walls built"). Room layout is translated from the provided
// floor plan into a simplified rectangular grid; proportions are
// approximate, not pixel-matched to the source image.
//
// Unlike world.js's buildWorld(scene) (which adds directly to a scene),
// this returns a self-contained THREE.Group and does NOT take a scene
// parameter — the caller decides when to scene.add()/remove() it. This is
// the shape a future level manager needs to swap locations in and out
// (e.g. for the portal gun), so it's built this way from the start even
// though nothing wires that up yet.

const WALL_HEIGHT = 4;
const WALL_THICKNESS = 0.4;

// Rooms, as simple rectangles. Mostly used here for floor/ceiling sizing —
// the actual walls are listed explicitly below as segments, since several
// rooms span multiple grid cells (Kitchens, Living Rooms) and hand-listing
// segments was clearer than deriving them from room adjacency automatically.
const ROOMS = {
  bathrooms:         { x1: -18, x2: -6, z1: -32, z2: -22 },
  workSpaces:        { x1: -6,  x2: 6,  z1: -32, z2: -22 },
  kitchens:          { x1: 6,   x2: 20, z1: -32, z2: -12 }, // spans two rows
  bedroomStorage:    { x1: -18, x2: -6, z1: -22, z2: -12 },
  dining:            { x1: -6,  x2: 6,  z1: -22, z2: -12 },
  bedrooms:          { x1: -18, x2: -6, z1: -12, z2: -2 },
  livingRoomStorage: { x1: -6,  x2: 6,  z1: -12, z2: -2 },
  childrensIkea:     { x1: 6,   x2: 20, z1: -12, z2: -2 },
  livingRooms:       { x1: -18, x2: 6,  z1: -2,  z2: 10 }, // spans two columns
  marketHall:        { x1: 6,   x2: 20, z1: -2,  z2: 4 },
  restaurant:        { x1: 6,   x2: 20, z1: 4,   z2: 10 },
};

export function buildIkea() {
  const group = new THREE.Group();
  const walls = [];

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  group.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(5, 10, 5);
  group.add(sun);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x9aa7b0 });
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

  // --- Floor + ceiling: one slab each, sized to the overall footprint ---
  const bounds = { x1: -18, x2: 20, z1: -32, z2: 10 };
  const width = bounds.x2 - bounds.x1;
  const depth = bounds.z2 - bounds.z1;
  const centerX = (bounds.x1 + bounds.x2) / 2;
  const centerZ = (bounds.z1 + bounds.z2) / 2;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centerX, 0, centerZ);
  group.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(centerX, WALL_HEIGHT, centerZ);
  group.add(ceiling);

  // Builds a wall along the X or Z axis, optionally split around a gap
  // (an open doorway). Same technique as world.js's cube-room door gap,
  // generalized here since this location needs many such gaps.
  function addWall(orientation, fixed, start, end, gapCenter = null, gapWidth = 0) {
    function segment(segStart, segEnd) {
      const length = segEnd - segStart;
      if (length <= 0.05) return;
      const center = (segStart + segEnd) / 2;
      const geo = orientation === 'x'
        ? new THREE.BoxGeometry(length, WALL_HEIGHT, WALL_THICKNESS)
        : new THREE.BoxGeometry(WALL_THICKNESS, WALL_HEIGHT, length);
      const mesh = new THREE.Mesh(geo, wallMat);
      if (orientation === 'x') mesh.position.set(center, WALL_HEIGHT / 2, fixed);
      else mesh.position.set(fixed, WALL_HEIGHT / 2, center);
      group.add(mesh);
      walls.push(mesh);
    }

    if (gapCenter === null) {
      segment(start, end);
    } else {
      segment(start, gapCenter - gapWidth / 2);
      segment(gapCenter + gapWidth / 2, end);
    }
  }

  const DOOR = 3; // default doorway gap width between connected rooms

  // --- Exterior perimeter ---
  addWall('x', bounds.z1, bounds.x1, bounds.x2);              // north (back) wall, solid
  addWall('x', bounds.z2, bounds.x1, bounds.x2, 0, 6);        // south wall — gap = Showroom Entrance
  addWall('z', bounds.x1, bounds.z1, bounds.z2);              // west wall, solid
  addWall('z', bounds.x2, bounds.z1, bounds.z2);              // east wall, solid

  // --- Interior walls, each with a doorway gap where rooms connect along
  // the shopping path. First pass — specific gap positions/widths, and
  // which connections should instead be fully solid, can be refined once
  // the overall layout is confirmed to look right in-game. ---

  // Vertical wall at x = -6 (left column / mid column boundary)
  addWall('z', -6, -32, -22, -27, DOOR); // bathrooms | workSpaces
  addWall('z', -6, -22, -12, -17, DOOR); // bedroomStorage | dining
  addWall('z', -6, -12, -2,  -7,  DOOR); // bedrooms | livingRoomStorage
  // no wall at x=-6 for z:[-2,10] — livingRooms spans both columns there

  // Vertical wall at x = 6 (mid column / right column boundary)
  addWall('z', 6, -32, -22, -27, DOOR); // workSpaces | kitchens
  addWall('z', 6, -22, -12, -17, DOOR); // dining | kitchens
  addWall('z', 6, -12, -2,  -7,  DOOR); // livingRoomStorage | childrensIkea
  addWall('z', 6, -2,  4,   1,   DOOR); // livingRooms | marketHall
  addWall('z', 6, 4,   10,  7,   DOOR); // livingRooms | restaurant

  // Horizontal wall at z = -22 (row 1 / row 2 boundary)
  addWall('x', -22, -18, -6, -12, DOOR); // bathrooms | bedroomStorage
  addWall('x', -22, -6,  6,  0,   DOOR); // workSpaces | dining
  // no wall at z=-22 for x:[6,20] — kitchens spans both rows there

  // Horizontal wall at z = -12 (row 2 / row 3 boundary)
  addWall('x', -12, -18, -6, -12, DOOR); // bedroomStorage | bedrooms
  addWall('x', -12, -6,  6,  0,   DOOR); // dining | livingRoomStorage
  addWall('x', -12, 6,   20, 13,  DOOR); // kitchens | childrensIkea

  // Horizontal wall at z = -2 (row 3 / row 4 boundary)
  addWall('x', -2, -18, -6, -12, DOOR); // bedrooms | livingRooms
  addWall('x', -2, -6,  6,  0,   DOOR); // livingRoomStorage | livingRooms
  addWall('x', -2, 6,   20, 13,  DOOR); // childrensIkea | marketHall

  // Horizontal wall at z = 4 (marketHall / restaurant boundary, right side only)
  addWall('x', 4, 6, 20, 13, DOOR);

  return { group, walls, floor, ceiling, rooms: ROOMS };
}