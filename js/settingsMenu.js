// Settings menu — opened via Escape (desktop) or the mobile pause icon
// (top-center, created in touchControls.js). Empty for now except a
// Resume button, per the request — no actual settings yet.
//
// This module only owns its own visibility (state.isOpen) and the Resume
// button's click. It does NOT decide what "paused" means for the rest of
// the game — main.js reads state.isOpen and folds it into its own
// isPaused calculation, same as it already does for desktop's pointer-lock
// state. This keeps the pause logic centralized in one place rather than
// scattered across modules.
//
// onResume is called when Resume is clicked — main.js decides what happens
// next, since the right behavior differs by platform:
//   - Desktop: attempts to re-engage pointer lock. Deliberately does NOT
//     close the menu here — browsers enforce a brief cooldown after an
//     Escape-triggered unlock before allowing a programmatic re-lock (a
//     security measure preventing sites from instantly re-trapping the
//     cursor). If this click's lock attempt gets rejected by that
//     cooldown, the menu needs to stay open so the user can just click
//     Resume again once it passes — closing optimistically here caused a
//     real softlock: menu gone, pointer lock never actually re-acquired,
//     game stuck paused with no remaining way to retry. Desktop closes the
//     menu itself only once a genuine 'lock' event fires (main.js).
//   - Mobile: no pointer-lock concept at all, so main.js's callback closes
//     the menu directly for that case instead.
export function setupSettingsMenu(onResume) {
    const state = { isOpen: false };
  
    const overlay = document.createElement('div');
    overlay.id = 'settings-overlay';
  
    const panel = document.createElement('div');
    panel.id = 'settings-panel';
  
    const title = document.createElement('h2');
    title.id = 'settings-title';
    title.textContent = 'Paused';
    panel.appendChild(title);
  
    const resumeButton = document.createElement('button');
    resumeButton.id = 'settings-resume-button';
    resumeButton.type = 'button';
    resumeButton.textContent = 'Resume';
    resumeButton.addEventListener('click', () => {
      if (onResume) onResume();
    });
    panel.appendChild(resumeButton);
  
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  
    function open() {
      state.isOpen = true;
      overlay.style.display = 'flex';
    }
  
    function close() {
      state.isOpen = false;
      overlay.style.display = 'none';
    }
  
    return { state, open, close };
  }