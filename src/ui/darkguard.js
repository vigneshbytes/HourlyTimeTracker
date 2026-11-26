// The app has no dark mode. The page declares `color-scheme: only light`
// (stops Chrome's auto-dark and forced dark) and a `darkreader-lock` meta tag
// (Dark Reader turns itself off). This guard removes anything that still gets
// injected by dark-mode extensions.

const SUSPECT_STYLE = (el) => el.nodeType === 1 && (el.tagName === 'STYLE' || el.tagName === 'LINK')
  && (/dark-?reader|darkreader|nighteye|night-eye|darkmode|dark-mode-ext|turn-off-the-lights/i.test(`${el.className} ${el.id} ${el.getAttribute('data-source') || ''}`));

function scrub() {
  const html = document.documentElement;
  for (const attr of [...html.attributes]) {
    if (/^data-(darkreader|nighteye|dark-mode)/i.test(attr.name)) html.removeAttribute(attr.name);
  }
  document.querySelectorAll('style, link').forEach((el) => { if (SUSPECT_STYLE(el)) el.remove(); });
  // Filter-based inverters (invert() on <html> or <body>).
  for (const el of [html, document.body].filter(Boolean)) {
    const f = getComputedStyle(el).filter;
    if (f && f !== 'none' && /invert/.test(f)) el.style.setProperty('filter', 'none', 'important');
  }
}

export function installDarkGuard() {
  scrub();
  let queued = false;
  const mo = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scrub(); });
  });
  mo.observe(document.documentElement, { attributes: true, childList: true, subtree: true, attributeFilter: undefined });
  // Some extensions add styles to <head> after load; childList+subtree covers it.
}
