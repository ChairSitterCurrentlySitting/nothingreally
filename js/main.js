import * as THREE from 'three';
import { buildWorld, toggleDoor } from './world.js';
import { setupControls } from './controls.js';
import { setupTouchControls, isTouchDevice } from './touchControls.js';
import { setupInteraction } from './interaction.js';

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

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Build the world (ground + hallway + door) ---
const world = buildWorld(scene);

// --- Movement ---
const { controls, update } = setupControls(camera, renderer.domElement);
scene.add(controls.getObject()); // the camera rig PointerLockControls moves around

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
  if (controls.isLocked) handleInteract();
});

// On touch devices, pointer lock isn't available (no mouse to lock),
// so skip the "click to play" overlay and use the on-screen joystick/look controls instead.
let touchUpdate = null;
if (isTouchDevice()) {
  document.getElementById('blocker').style.display = 'none';
  const touchControls = setupTouchControls(controls.getObject(), camera, handleInteract);
  touchUpdate = touchControls.update;
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
  update(delta);
  if (touchUpdate) touchUpdate(delta);
  renderer.render(scene, camera);
}

animate();