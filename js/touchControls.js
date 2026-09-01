// Detects whether the device supports touch input at all.
// Used by main.js to decide whether to activate this module.
export function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

// rig    = controls.getObject() from PointerLockControls — note this is
//          actually the camera itself (Three.js's real PointerLockControls
//          has no separate wrapper object), so rig and camera below are the
//          same object. Kept as a separate parameter name for clarity about
//          which role each usage plays (movement vs. look).
// camera = the same object as rig, used here specifically for pitch (look up/down)
// onTap  = called when the player taps (not drags) anywhere on screen — used for interaction (e.g. opening the door)
// onSprintToggle = called when the player taps the on-screen sprint button
// onDashTrigger  = called when the player taps the on-screen dash button
// onUseTrigger   = called when the player taps the on-screen use button
export function setupTouchControls(rig, camera, onTap, onSprintToggle, onDashTrigger, onUseTrigger) {

  // IMPORTANT: rig and camera are actually the SAME object — PointerLockControls'
  // getObject() returns the camera directly, not a separate wrapper. Setting yaw
  // (rotation.y) and pitch (rotation.x) independently on one object only composes
  // correctly (no unwanted tilt) with 'YXZ' order — yaw applied outer, pitch
  // inner — which matches how real FPS cameras work. This is now set globally
  // in main.js (right after the camera is created), not here — it used to only
  // be set on this touch-only code path, which left desktop reading a distorted
  // camera.rotation.y (e.g. in dash.js) whenever there was any pitch.

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

  // Bottom-right: sprint toggle button. It needs a higher stacking order
  // than look-zone underneath it — browsers hit-test to whichever element
  // is visually on top at a given point, so as long as this renders above
  // look-zone (see z-index in style.css), touches on the button correctly
  // hit the button rather than triggering a look-drag.
  const sprintButton = document.createElement('button');
  sprintButton.id = 'sprint-button';
  sprintButton.type = 'button';
  sprintButton.textContent = 'SPRINT';
  document.body.appendChild(sprintButton);

  sprintButton.addEventListener('touchstart', (e) => {
    e.preventDefault(); // avoids the ~300ms ghost-click delay/double-fire some mobile browsers add
    if (onSprintToggle) onSprintToggle();
  }, { passive: false });

  // Dash button, positioned just to the left of the sprint button —
  // same reasoning applies: higher z-index than #look-zone underneath it
  // so touches here hit the button, not a look-drag.
  const dashButton = document.createElement('button');
  dashButton.id = 'dash-button';
  dashButton.type = 'button';
  dashButton.textContent = 'DASH';
  document.body.appendChild(dashButton);

  dashButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (onDashTrigger) onDashTrigger();
  }, { passive: false });

  // Use button, positioned just to the left of the dash button — same
  // z-index reasoning as the other two buttons. Shows the currently
  // selected inventory slot's item icon as its background (or a
  // placeholder if the slot is empty — see updateUseButtonIcon), with a
  // small "USE" label in the corner, same icon+badge pattern as the
  // inventory slots in ui.js. Always visible — no hide/disable state,
  // unlike the dash button's cooldown-based opacity.
  const useButton = document.createElement('button');
  useButton.id = 'use-button';
  useButton.type = 'button';

  const useLabel = document.createElement('span');
  useLabel.className = 'use-button-label';
  useLabel.textContent = 'USE';
  useButton.appendChild(useLabel);

  document.body.appendChild(useButton);

  useButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (onUseTrigger) onUseTrigger();
  }, { passive: false });

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
  const SPEED = 4.845;         // 6 * 0.85 * 0.95 — 15% then a further 5% slower, matches desktop

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
  function update(delta, speedMultiplier = 1) {
    const forwardInput = -move.y; // dragging up = forward
    const rightInput = move.x;

    if (Math.abs(forwardInput) < 0.05 && Math.abs(rightInput) < 0.05) return;

    // Move along the horizontal plane only, based on yaw (rig.rotation.y) —
    // deliberately ignoring pitch entirely. This is what stops the no-clip
    // bug: previously we used rig.translateZ/translateX, which move along
    // wherever the camera is actually facing in full 3D, pitch included —
    // so looking down and moving forward walked you into the floor.
    const yaw = rig.rotation.y;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const speed = SPEED * speedMultiplier;

    const dx = (-sin * forwardInput + cos * rightInput) * speed * delta;
    const dz = (-cos * forwardInput - sin * rightInput) * speed * delta;

    rig.position.x += dx;
    rig.position.z += dz;
  }

  // Reflects current sprint state on the on-screen button. Visual only —
  // main.js owns the real player state; this just syncs how the button looks.
  function updateSprintButton(isActive) {
    sprintButton.classList.toggle('active', isActive);
  }

  // Reflects whether a dash is currently available (not dashing, not on
  // cooldown). Visual only — main.js owns the real dash state.
  function updateDashButton(isAvailable) {
    dashButton.classList.toggle('unavailable', !isAvailable);
  }

  // Sets the Use button's icon to match the currently selected inventory
  // slot's item, or clears it (no background image — same convention as
  // the desktop inventory slots in ui.js) if that slot is empty.
  function updateUseButtonIcon(inventoryState) {
    const item = inventoryState.slots[inventoryState.selectedIndex];
    useButton.style.backgroundImage = item ? `url('${item.icon}')` : '';
  }

  // True if the joystick is currently pushed past the same dead-zone
  // threshold used in update() — used by player.js to decide whether
  // stamina is allowed to recover this frame.
  function isMoving() {
    return Math.abs(move.x) > 0.05 || Math.abs(move.y) > 0.05;
  }

  return { update, updateSprintButton, updateDashButton, updateUseButtonIcon, isMoving };
}