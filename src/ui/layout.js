// Three layouts, chosen by INPUT TYPE first and window size second, so a
// small desktop window never gets phone (touch) behaviour:
//   touch   – phones/tablets (primary pointer is coarse)
//   desktop – mouse/trackpad, normal window
//   widget  – mouse/trackpad, window shrunk to a small card
export function detectMode() {
  const touch = matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
  if (touch) return 'touch';
  return innerWidth < 480 || innerHeight < 520 ? 'widget' : 'desktop';
}

export function setupLayout(app, onChange) {
  const apply = () => {
    const mode = detectMode();
    if (mode !== app.mode) {
      app.mode = mode;
      document.documentElement.dataset.mode = mode;
      onChange?.(mode);
    }
  };
  app.mode = null;
  apply();
  addEventListener('resize', apply);
  matchMedia('(pointer: coarse)').addEventListener?.('change', apply);
  // Remember which kind of pointer was used last (per interaction, not per device).
  app.lastPointer = document.documentElement.dataset.mode === 'touch' ? 'touch' : 'mouse';
  addEventListener('pointerdown', (e) => { app.lastPointer = e.pointerType === 'mouse' ? 'mouse' : 'touch'; }, true);
}
