// Multi-step confirmation flow guarding every data erase.
// Step 1: explain what will be lost and show record counts.
// Step 2: require ticking an "I understand" box.
// Step 3: require typing an exact phrase. Only then is eraseAll() called.

import { countAll, eraseAll, ERASE_TOKEN } from './storage.js';

export const CONFIRM_PHRASE = 'DELETE ALL MY DATA';

export function setupEraseFlow({ onErased } = {}) {
  const dialog = document.getElementById('erase-dialog');
  const title = document.getElementById('erase-title');
  const body = document.getElementById('erase-body');
  const next = document.getElementById('erase-next');
  const cancel = document.getElementById('erase-cancel');
  let step = 0;

  const steps = [
    async () => {
      const n = await countAll();
      title.textContent = 'Erase all data? (step 1 of 3)';
      body.innerHTML = `<p>This permanently deletes <strong>${n}</strong> stored record(s): every project, time entry and setting in this browser.</p>
        <p>There is no undo and no cloud copy. Export a backup first if you might need it.</p>`;
      next.textContent = 'Continue';
      next.disabled = false;
    },
    () => {
      title.textContent = 'Are you sure? (step 2 of 3)';
      body.innerHTML = `<label class="check"><input type="checkbox" id="erase-ack"> I understand this cannot be undone.</label>`;
      next.textContent = 'Continue';
      next.disabled = true;
      body.querySelector('#erase-ack').addEventListener('change', (e) => { next.disabled = !e.target.checked; });
    },
    () => {
      title.textContent = 'Final confirmation (step 3 of 3)';
      body.innerHTML = `<p>Type <code>${CONFIRM_PHRASE}</code> to confirm.</p>
        <input id="erase-phrase" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Confirmation phrase">`;
      next.textContent = 'Erase everything';
      next.disabled = true;
      const input = body.querySelector('#erase-phrase');
      input.addEventListener('input', () => { next.disabled = input.value.trim() !== CONFIRM_PHRASE; });
      input.addEventListener('paste', (e) => e.preventDefault()); // must be typed
      input.focus();
    },
  ];

  async function show(i) { step = i; await steps[i](); }

  function close() { dialog.close(); body.innerHTML = ''; }

  next.addEventListener('click', async () => {
    if (step < steps.length - 1) return show(step + 1);
    const typed = body.querySelector('#erase-phrase')?.value.trim();
    if (typed !== CONFIRM_PHRASE) return;
    next.disabled = true;
    await eraseAll(ERASE_TOKEN);
    close();
    onErased?.();
  });
  cancel.addEventListener('click', close);
  dialog.addEventListener('cancel', () => { body.innerHTML = ''; }); // Esc key

  document.getElementById('erase-btn').addEventListener('click', async () => {
    await show(0);
    dialog.showModal();
    cancel.focus();
  });
}
