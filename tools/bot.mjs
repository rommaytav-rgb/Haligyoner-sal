// Generic game driver: starts a career and clicks through the game for N steps.
// Deliberately version-agnostic - it does not hardcode screen names, so it keeps
// working when the game file changes.

export async function startCareer(page, { name = 'Omri Cohen' } = {}) {
  await page.evaluate((nm) => {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    set('p-name', nm);
  }, name);

  // Click whatever button lives inside the creation screen (start career).
  const started = await page.evaluate(() => {
    const ui = document.getElementById('create-ui');
    if (!ui) return false;
    const btns = [...ui.querySelectorAll('button')].filter(b => b.offsetParent !== null);
    if (!btns.length) return false;
    btns[btns.length - 1].click();
    return true;
  });
  return started;
}

function visibleClickablesScript() {
  return () => {
    const isVisible = (el) => {
      if (!el || el.offsetParent === null) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const inOpenModal = (el) => {
      let n = el;
      while (n && n !== document.body) {
        const id = n.id || '';
        if (/modal|popup/i.test(id) || /modal|popup/i.test(n.className || '')) return isVisible(n) ? n : null;
        n = n.parentElement;
      }
      return null;
    };
    const all = [...document.querySelectorAll('button, .select-btn, [onclick]')].filter(isVisible);
    const modalBtns = all.filter(inOpenModal);
    return { modal: modalBtns.length, total: all.length };
  };
}

// One step: prefer a button inside an open modal, else the main "next" button.
export async function step(page, rnd) {
  return page.evaluate((seed) => {
    const isVisible = (el) => {
      if (!el || el.offsetParent === null) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const openModal = () => {
      const cands = [...document.querySelectorAll('[id*="modal" i], [id*="popup" i], .modal, .popup')];
      return cands.find(isVisible) || null;
    };
    const pick = (arr) => arr[Math.floor(seed * arr.length) % arr.length];

    const m = openModal();
    if (m) {
      const btns = [...m.querySelectorAll('button')].filter(b => isVisible(b) && !b.disabled);
      if (btns.length) { pick(btns).click(); return 'modal'; }
      // Modal is open but every button is disabled: the game is mid-animation
      // (e.g. the clutch reveal timeout). Wait rather than spamming dead clicks.
      return 'wait';
    }
    const next = document.getElementById('next-btn');
    if (next && isVisible(next) && !next.disabled) { next.click(); return 'next'; }

    // Fallback: any visible button that is not a destructive reset.
    const others = [...document.querySelectorAll('button')].filter(b =>
      isVisible(b) && !b.disabled && !/resetGame|restart/i.test(b.getAttribute('onclick') || '') &&
      !b.classList.contains('restart-btn'));
    if (others.length) { pick(others).click(); return 'other'; }
    return 'stuck';
  }, rnd);
}

export async function progress(page) {
  return page.evaluate(() => {
    const txt = (id) => { const e = document.getElementById(id); return e ? (e.innerText || e.textContent || '').trim() : null; };
    return { week: txt('st-week'), age: txt('st-age'), team: txt('st-team'), league: txt('st-league'), role: txt('st-role') };
  });
}

export async function play(page, steps = 400) {
  const seen = { modal: 0, next: 0, other: 0, wait: 0, stuck: 0 };
  let stuckRun = 0;
  for (let i = 0; i < steps; i++) {
    let what;
    try { what = await step(page, Math.random()); }
    catch { break; }
    seen[what] = (seen[what] || 0) + 1;
    if (what === 'stuck') { if (++stuckRun > 20) break; } else stuckRun = 0;
    await page.waitForTimeout(what === 'wait' || what === 'stuck' ? 120 : 8);
  }
  return seen;
}
