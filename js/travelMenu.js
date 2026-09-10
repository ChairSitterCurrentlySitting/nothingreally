// Portal gun travel menu — opened when the player uses the Portal Gun
// (see main.js's openTravelMenu()). Freezes the game (main.js folds
// state.isOpen into its isPaused calculation, same pattern as
// settingsMenu.js) and shows every known location; clicking one other
// than the current location travels there.
//
// This module only owns the menu's own UI/visibility and which button
// was clicked — it does NOT know how to actually switch locations.
// main.js's travelTo() (the first thing in this project that swaps the
// active location at runtime — until now the active location was chosen
// once at startup and never changed) does that, then decides how to
// close this menu back down, same separation of concerns as
// settingsMenu.js/onResume.
//
// Closing follows the SAME lesson learned from settingsMenu.js: don't
// close optimistically on desktop. Browsers can silently reject a
// programmatic re-lock request under some conditions — closing this menu
// before that's confirmed risks the same class of softlock fixed there
// (menu gone, game still effectively paused, nothing left to click to
// retry). So travelTo() doesn't close this menu directly on desktop; it
// attempts controls.lock() and lets a genuine 'lock' event close it
// (main.js).
export function setupTravelMenu(locations, onSelectLocation) {
  const state = { isOpen: false };

  const overlay = document.createElement('div');
  overlay.id = 'travel-overlay';

  const panel = document.createElement('div');
  panel.id = 'travel-panel';

  const title = document.createElement('h2');
  title.id = 'travel-title';
  title.textContent = 'Travel';
  panel.appendChild(title);

  const list = document.createElement('div');
  list.id = 'travel-list';
  panel.appendChild(list);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Rebuilds the button list each time the menu opens, since which
  // location is "current" changes after traveling.
  function open(currentLocationKey) {
    state.isOpen = true;
    list.innerHTML = '';

    for (const key of Object.keys(locations)) {
      const isCurrent = key === currentLocationKey;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'travel-option' + (isCurrent ? ' current' : '');
      button.textContent = locations[key].label + (isCurrent ? ' (current)' : '');

      if (isCurrent) {
        button.disabled = true; // already here — nothing to do
      } else {
        button.addEventListener('click', () => onSelectLocation(key));
      }

      list.appendChild(button);
    }

    overlay.style.display = 'flex';
  }

  function close() {
    state.isOpen = false;
    overlay.style.display = 'none';
  }

  return { state, open, close };
}