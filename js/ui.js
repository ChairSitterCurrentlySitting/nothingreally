// Builds and updates simple DOM-based HUD bars for HP and stamina, plus a
// dash cooldown timer positioned bottom-center (subtitle position) and a
// 3-slot inventory hotbar bottom-right. Pure UI — reads state, never
// modifies it directly (slot selection goes through onSlotSelect instead).
//
// onSlotSelect(index) is called on plain 'click' events on a slot — this
// naturally covers both a mouse click (desktop) and a touch tap (mobile)
// with no separate touch-handling code needed, since 'click' fires for
// both input types in the browser.
export function setupHUD(onSlotSelect) {
  const container = document.createElement('div');
  container.id = 'hud';
  container.innerHTML = `
    <div class="hud-row">
      <span class="hud-label">HP</span>
      <div class="hud-bar-bg"><div class="hud-bar-fill hp-fill"></div></div>
    </div>
    <div class="hud-row">
      <span class="hud-label">STA</span>
      <div class="hud-bar-bg"><div class="hud-bar-fill stamina-fill"></div></div>
      <span class="sprint-indicator">SPRINTING</span>
    </div>
  `;
  document.body.appendChild(container);

  const dashTimer = document.createElement('div');
  dashTimer.id = 'dash-cooldown-timer';
  document.body.appendChild(dashTimer);

  // Stacked directly above the dash timer (positioning handled in style.css).
  const portalTimer = document.createElement('div');
  portalTimer.id = 'portal-cooldown-timer';
  document.body.appendChild(portalTimer);

  // --- Viewmodel hand (bottom-right, behind the inventory bar via z-index in style.css) ---
  const HAND_SRC_NORMAL = 'assets/textures/ui/idle_hand.png';
  const HAND_SRC_EMPTY_USE = 'assets/textures/ui/_.jpeg'; // brief reaction shown when U/Use is pressed with nothing selected — see flashEmptyHandIcon
  const hand = document.createElement('img');
  hand.id = 'viewmodel-hand';
  hand.src = HAND_SRC_NORMAL;
  document.body.appendChild(hand);

  // --- Inventory hotbar ---
  const inventoryBar = document.createElement('div');
  inventoryBar.id = 'inventory-bar';
  for (let i = 0; i < 3; i++) {
    const slot = document.createElement('div');
    slot.className = 'inventory-slot';

    const numberLabel = document.createElement('span');
    numberLabel.className = 'inventory-slot-number';
    numberLabel.textContent = String(i + 1);
    slot.appendChild(numberLabel);

    slot.addEventListener('click', () => {
      if (onSlotSelect) onSlotSelect(i);
    });
    inventoryBar.appendChild(slot);
  }
  document.body.appendChild(inventoryBar);
  const slotElements = inventoryBar.querySelectorAll('.inventory-slot');

  const hpFill = container.querySelector('.hp-fill');
  const staminaFill = container.querySelector('.stamina-fill');
  const sprintIndicator = container.querySelector('.sprint-indicator');

  function update(state) {
    hpFill.style.width = `${(state.hp / state.maxHp) * 100}%`;
    staminaFill.style.width = `${(state.stamina / state.maxStamina) * 100}%`;
    sprintIndicator.style.visibility = state.isSprinting ? 'visible' : 'hidden';
  }

  // Shows "Dash ready in X.Xs" while on cooldown, hidden otherwise
  // (including while a dash is actively in progress — this is specifically
  // a cooldown timer, not a dash-duration timer).
  function updateDashTimer(dashState) {
    if (dashState.cooldownRemaining > 0) {
      dashTimer.textContent = `Dash ready in ${dashState.cooldownRemaining.toFixed(1)}s`;
      dashTimer.style.visibility = 'visible';
    } else {
      dashTimer.style.visibility = 'hidden';
    }
  }

  // Same pattern as updateDashTimer, for the portal gun's 15s use-cooldown.
  function updatePortalTimer(cooldownRemaining) {
    if (cooldownRemaining > 0) {
      portalTimer.textContent = `Portal ready in ${cooldownRemaining.toFixed(1)}s`;
      portalTimer.style.visibility = 'visible';
    } else {
      portalTimer.style.visibility = 'hidden';
    }
  }

  function updateInventory(inventoryState) {
    slotElements.forEach((el, i) => {
      el.classList.toggle('selected', i === inventoryState.selectedIndex);
      const item = inventoryState.slots[i];
      el.style.backgroundImage = item ? `url('${item.icon}')` : '';
    });
  }

  // Toggles the wobble animation on/off based on whether the player is
  // currently moving. The actual oscillation is a CSS @keyframes animation
  // (style.css) — this just adds/removes the class that triggers it,
  // rather than computing sine values in JS every frame.
  function updateHandWobble(isMoving) {
    hand.classList.toggle('walking', isMoving);
  }

  const EMPTY_USE_FLASH_DURATION = 500; // ms — how long the reaction shows before reverting to the normal hand
  let flashTimeoutId = null;

  // Briefly swaps the hand to HAND_SRC_EMPTY_USE, then reverts to
  // HAND_SRC_NORMAL after EMPTY_USE_FLASH_DURATION — call this when the
  // player presses U/Use while the selected inventory slot is empty
  // (main.js decides when that condition is met; this function just
  // handles the visual reaction). If called again before the previous
  // flash finished, the timer restarts rather than stacking multiple
  // reverts.
  function flashEmptyHandIcon() {
    hand.src = HAND_SRC_EMPTY_USE;
    if (flashTimeoutId) clearTimeout(flashTimeoutId);
    flashTimeoutId = setTimeout(() => {
      hand.src = HAND_SRC_NORMAL;
      flashTimeoutId = null;
    }, EMPTY_USE_FLASH_DURATION);
  }

  return { update, updateDashTimer, updatePortalTimer, updateInventory, updateHandWobble, flashEmptyHandIcon };
}