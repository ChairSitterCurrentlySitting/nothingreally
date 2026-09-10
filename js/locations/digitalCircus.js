import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// The Amazing Digital Circus location — a fan-made GLB model, downloaded
// and placed at assets/models/the_digital_circus.glb, loaded via
// Three.js's GLTFLoader (bundled addon, already available through the
// existing 'three/addons/' import map alias — no index.html changes
// needed).
//
// DRACO-COMPRESSED — the model was compressed (gltf-transform, --compress
// draco) to get it under GitHub's 100MB file size limit (originally
// 114MB, now ~3.8MB). This means plain GLTFLoader can no longer decode
// it on its own — Draco-compressed mesh geometry requires a separate
// DRACOLoader, explicitly attached via setDRACOLoader() below. Without
// this, loading silently fails (nothing appears, no obvious error unless
// you check the console) — this was a real bug hit right after
// compressing the model, not a hypothetical. If the model is ever
// re-exported/re-compressed WITHOUT Draco in the future, this DRACOLoader
// setup becomes unnecessary but remains harmless to leave in place.
// Decoder is loaded from Google's CDN (gstatic.com) rather than bundled
// locally, matching this project's overall "load everything via CDN, no
// build step" approach (see the three/addons import map alias).
//
// ASYNCHRONOUS LOADING — this is a genuinely different pattern from every
// other location module in this project (world.js, ikea.js), which build
// all their geometry synchronously and return a fully-populated group
// immediately. Loading a GLB takes real time (network fetch + parse).
// This module returns an EMPTY group right away, which main.js adds to
// the scene immediately — the model's actual content is added as a child
// of that SAME group once loading finishes, so it just "pops in" when
// ready. This avoids restructuring main.js's otherwise fully-synchronous
// startup flow into something async-aware.
//
// COLLISION — manual, coordinate-defined. MANUAL_COLLISION_BOXES below is
// the ONLY source of collision — fill it in as coordinates are mapped out
// (fly around in cheat mode, use the crosshair + debug inspector in
// cheats.js to read off exact positions — left-click logs a mesh's full
// bounds to the console). Each box renders as a translucent red wireframe
// in the scene so placement can be visually checked against the actual
// model geometry.
//
// UNKNOWN SCALE/POSITION/ROTATION — fan-made models can be built at very
// different scales/orientations than this project's convention (~1 unit
// = 1 meter, Y-up). The constants below are a no-adjustment starting
// point (scale 1, no offset, no rotation) — very likely need tuning once
// you can actually see how the model sits relative to the fixed player
// spawn point (camera starts at (0, 1.6, 5) in main.js).

const MODEL_PATH = 'assets/models/the_digital_circus.glb';

const MODEL_SCALE = 1;
const MODEL_POSITION = new THREE.Vector3(0, 0, 0);
const MODEL_ROTATION_Y = 0; // radians

// Manually-defined collision volumes. Each entry: { minX, maxX, minZ, maxZ }
// (required — this is what collision.js actually uses, since the whole
// collision system is currently 2D top-down with no height awareness),
// plus optional minY/maxY (used only for sizing the debug-visualization
// box below — not enforced as real collision yet, since there's no
// vertical collision system in this project). Add real entries here as
// coordinates are mapped out.
const MANUAL_COLLISION_BOXES = [
  // Example: { minX: -5, maxX: 5, minZ: -10, maxZ: -9, minY: 0, maxY: 3 },
];

const DEBUG_BOX_HEIGHT_FALLBACK = 4; // used if a box entry omits minY/maxY

// DRACOLoader setup — one shared instance, reused across loads (per
// Three.js's own recommendation), decoding via Google's CDN-hosted
// WASM/JS decoder rather than a locally-bundled copy.
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
dracoLoader.preload();

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

export function buildDigitalCircus() {
  const group = new THREE.Group();

  // Same ambient/directional lighting as the other locations — the GLB
  // may include its own lights, but this guarantees something is lit
  // even if it doesn't.
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  group.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(5, 10, 5);
  group.add(sun);

  // --- Manual collision boxes ---
  // Built synchronously (no need to wait for the GLB), since they're
  // independent of the model itself — just raw coordinate data. Each is a
  // real THREE.Mesh (translucent red wireframe) so collision.js's
  // existing Box3().setFromObject() approach works completely unchanged —
  // no changes needed to collision.js for this.
  const debugBoxMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true,
    transparent: true,
    opacity: 0.5,
  });

  const walls = MANUAL_COLLISION_BOXES.map((box) => {
    const minY = box.minY ?? 0;
    const maxY = box.maxY ?? DEBUG_BOX_HEIGHT_FALLBACK;

    const width = box.maxX - box.minX;
    const height = maxY - minY;
    const depth = box.maxZ - box.minZ;

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), debugBoxMat);
    mesh.position.set(
      (box.minX + box.maxX) / 2,
      (minY + maxY) / 2,
      (box.minZ + box.maxZ) / 2
    );
    group.add(mesh);
    return mesh;
  });

  loader.load(
    MODEL_PATH,
    (gltf) => {
      const model = gltf.scene;
      model.scale.setScalar(MODEL_SCALE);
      model.position.copy(MODEL_POSITION);
      model.rotation.y = MODEL_ROTATION_Y;
      group.add(model);
      console.log('the_digital_circus.glb loaded successfully');
    },
    undefined, // onProgress — not used
    (error) => {
      console.error('Failed to load the_digital_circus.glb:', error);
    }
  );

  return { group, walls };
}