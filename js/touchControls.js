import * as THREE from 'three';

// Detects whether the device supports touch input at all.
// Used by main.js to decide whether to activate this module.
export function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

// rig    = the object that moves through the world (controls.getObject() from PointerLockControls)
// camera = the actual camera, parented to rig, used for looking up/down
// onTap  = called when the player taps (not drags) anywhere on screen — used for interaction (e.g. opening the door)
export function setupTouchControls(rig, camera, onTap) {

  // --- Build on-screen UI elements ---
  // Left half of the screen: joystick for movement
  const joystickZone = document.createElement('div');
  joystickZone.id = 'joystick-zone';

  const joystickBase = document.createElement('div');
  joystickBase.id = 'joystick-base';

  const joystickKnob = document.createElement('div');
  joystickKnob.id = 'joystick-knob';

  joystickBase.appendChild(joystickKnob);
  document.body.appendChild(joystickZone);
  document.body.appendChild(joystickBase);

  // Right half of the screen: drag to look around
  const lookZone = document.createElement('div');
  lookZone.id = 'look-zone';
  document.body.appendChild(lookZone);

  // --- Tap detection (a quick touch with barely any movement = interact, not drag) ---
  const TAP_MAX_DURATION = 300; // ms
  const TAP_MAX_DISTANCE = 10;  // px

  function isTap(startTime, startX, startY, endX, endY) {
    const duration = Date.now() - startTime;
    const distance = Math.hypot(endX - startX, endY - startY);
    return duration < TAP_MAX_DURATION && distance < TAP_MAX_DISTANCE;
  }

  // --- Joystick movement ---
  const JOYSTICK_RADIUS = 50; // px the knob can travel from center
  const SPEED = 6;            // units per second, same as desktop

  let joystickTouchId = null;
  let joystickOrigin = { x: 0, y: 0 };
  let joystickStartTime = 0;
  const move = { x: 0, y: 0 }; // -1..1 range on each axis

  joystickZone.addEventListener('touchstart', (e) => {
    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;
    joystickOrigin = { x: touch.clientX, y: touch.clientY };
    joystickStartTime = Date.now();

    // Place the joystick base wherever the player first touches ("floating" joystick)
    joystickBase.style.left = `${touch.clientX - 50}px`;
    joystickBase.style.top = `${touch.clientY - 50}px`;
    joystickBase.style.opacity = '1';
  }, { passive: true });

  joystickZone.addEventListener('touchmove', (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier !== joystickTouchId) continue;

      let dx = touch.clientX - joystickOrigin.x;
      let dy = touch.clientY - joystickOrigin.y;

      // Clamp the knob so it can't drift outside the base circle
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy), JOYSTICK_RADIUS);
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * dist;
      dy = Math.sin(angle) * dist;

      joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

      move.x = dx / JOYSTICK_RADIUS; // -1 (left) .. 1 (right)
      move.y = dy / JOYSTICK_RADIUS; // -1 (up/forward) .. 1 (down/backward)
    }
    e.preventDefault(); // stops the page from scrolling while dragging
  }, { passive: false });

  function resetJoystick(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier !== joystickTouchId) continue;

      if (onTap && isTap(joystickStartTime, joystickOrigin.x, joystickOrigin.y, touch.clientX, touch.clientY)) {
        onTap();
      }

      joystickTouchId = null;
      move.x = 0;
      move.y = 0;
      joystickKnob.style.transform = 'translate(0px, 0px)';
      joystickBase.style.opacity = '0';
    }
  }
  joystickZone.addEventListener('touchend', resetJoystick);
  joystickZone.addEventListener('touchcancel', resetJoystick);

  // --- Look control (drag anywhere on the right side) ---
  const LOOK_SENSITIVITY = 0.0025;
  let lookTouchId = null;
  let lastX = 0, lastY = 0;
  let lookStartX = 0, lookStartY = 0, lookStartTime = 0;
  let pitch = 0; // tracked manually so we can clamp up/down look angle

  lookZone.addEventListener('touchstart', (e) => {
    const touch = e.changedTouches[0];
    lookTouchId = touch.identifier;
    lastX = touch.clientX;
    lastY = touch.clientY;
    lookStartX = touch.clientX;
    lookStartY = touch.clientY;
    lookStartTime = Date.now();
  }, { passive: true });

  lookZone.addEventListener('touchmove', (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier !== lookTouchId) continue;

      const dx = touch.clientX - lastX;
      const dy = touch.clientY - lastY;
      lastX = touch.clientX;
      lastY = touch.clientY;

      rig.rotation.y -= dx * LOOK_SENSITIVITY; // left/right turn

      pitch -= dy * LOOK_SENSITIVITY;
      pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch)); // clamp so you can't flip upside down
      camera.rotation.x = pitch;
    }
    e.preventDefault();
  }, { passive: false });

  function resetLook(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier !== lookTouchId) continue;

      if (onTap && isTap(lookStartTime, lookStartX, lookStartY, touch.clientX, touch.clientY)) {
        onTap();
      }

      lookTouchId = null;
    }
  }
  lookZone.addEventListener('touchend', resetLook);
  lookZone.addEventListener('touchcancel', resetLook);

  // --- Per-frame movement update, called from main.js's animate loop ---
  function update(delta) {
    const forward = -move.y; // dragging up = forward
    const right = move.x;

    if (Math.abs(forward) > 0.05) rig.translateZ(-forward * SPEED * delta);
    if (Math.abs(right) > 0.05) rig.translateX(right * SPEED * delta);
  }

  return { update };
}