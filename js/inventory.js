// 3-slot inventory hotbar. Item pickup/placement isn't built yet (that's
// objects.js, still planned) — for now this just tracks which slot is
// selected and lays the groundwork for real items to occupy slots later.

const SLOT_COUNT = 3;

export function createInventoryState() {
  return {
    slots: [
      null,
      null,
      // Visual only — no actual portal gun functionality wired up yet.
      // Any future item just needs a `name` and `icon` to render the same way.
      { name: 'Portal Gun', icon: 'assets/textures/ui/portalgun.png' },
    ],
    selectedIndex: 0, // 0-based; slot 1 selected by default
  };
}

export function selectSlot(state, index) {
  if (index < 0 || index >= SLOT_COUNT) return;
  state.selectedIndex = index;
}