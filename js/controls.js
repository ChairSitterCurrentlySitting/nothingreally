import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// Sets up mouse-look + WASD movement.
// Returns the controls object and an update(delta) function to call every frame.
export function setupControls(camera, domElement) {
  const controls = new PointerLockControls(camera, domElement);

  const blocker = document.getElementById('blocker');
  const instructions = document.getElementById('instructions');

  // Click the overlay to lock the mouse pointer and start playing
  blocker.addEventListener('click', () => controls.lock());
  controls.addEventListener('lock', () => { blocker.style.display = 'none'; });
  controls.addEventListener('unlock', () => { blocker.style.display = 'flex'; });

  // Track which movement keys are currently held down
  const move = { forward: false, backward: false, left: false, right: false };

  document.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': move.forward = true; break;
      case 'KeyS': case 'ArrowDown': move.backward = true; break;
      case 'KeyA': case 'ArrowLeft': move.left = true; break;
      case 'KeyD': case 'ArrowRight': move.right = true; break;
    }
  });

  document.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': move.forward = false; break;
      case 'KeyS': case 'ArrowDown': move.backward = false; break;
      case 'KeyA': case 'ArrowLeft': move.left = false; break;
      case 'KeyD': case 'ArrowRight': move.right = false; break;
    }
  });

  const velocity = new THREE.Vector3();
  const SPEED = 6; // units per second

  function update(delta) {
    // Simple friction so movement feels smooth, not instant stop/start
    velocity.x -= velocity.x * 10 * delta;
    velocity.z -= velocity.z * 10 * delta;

    const direction = new THREE.Vector3();
    direction.z = Number(move.forward) - Number(move.backward);
    direction.x = Number(move.right) - Number(move.left);
    direction.normalize();

    if (move.forward || move.backward) velocity.z -= direction.z * SPEED * 10 * delta;
    if (move.left || move.right) velocity.x -= direction.x * SPEED * 10 * delta;

    // PointerLockControls gives us these helper methods to move
    // relative to where the camera is currently facing
    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);
  }

  return { controls, update };
}