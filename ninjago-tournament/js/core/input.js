/* ============================================================
   NT.Input — multitouch pointer tracking + keyboard mapping
   Scenes receive pointer events; UI layers manage buttons.
   ============================================================ */
NT.Input = (function () {
  const pointers = new Map(); // id -> {id,x,y,sx,sy,st,target,moved}
  const keys = new Set();
  const keyPressed = new Set(); // edge-triggered (consumed per frame)
  let canvas = null;
  let handler = null; // current scene
  let lastInputWasTouch = false;

  function toLocal(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function init(c) {
    canvas = c;
    canvas.style.touchAction = 'none';
    const opt = { passive: false };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      lastInputWasTouch = e.pointerType === 'touch';
      const p = toLocal(e);
      const ptr = { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, st: performance.now(), target: null, moved: false, type: e.pointerType };
      pointers.set(e.pointerId, ptr);
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      NT.Audio.unlock();
      if (handler && handler.onPointerDown) handler.onPointerDown(ptr);
    }, opt);
    canvas.addEventListener('pointermove', (e) => {
      e.preventDefault();
      const ptr = pointers.get(e.pointerId);
      if (!ptr) return;
      const p = toLocal(e);
      ptr.x = p.x; ptr.y = p.y;
      if (Math.hypot(ptr.x - ptr.sx, ptr.y - ptr.sy) > 8) ptr.moved = true;
      if (handler && handler.onPointerMove) handler.onPointerMove(ptr);
    }, opt);
    const up = (e) => {
      e.preventDefault();
      const ptr = pointers.get(e.pointerId);
      if (!ptr) return;
      const p = toLocal(e);
      ptr.x = p.x; ptr.y = p.y;
      pointers.delete(e.pointerId);
      if (handler && handler.onPointerUp) handler.onPointerUp(ptr);
    };
    canvas.addEventListener('pointerup', up, opt);
    canvas.addEventListener('pointercancel', up, opt);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      lastInputWasTouch = false;
      keys.add(e.code);
      keyPressed.add(e.code);
      NT.Audio.unlock();
      if (handler && handler.onKeyDown) handler.onKeyDown(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { keys.delete(e.code); });
    window.addEventListener('blur', () => { keys.clear(); pointers.clear(); if (handler && handler.onBlur) handler.onBlur(); });
  }

  function setHandler(h) { handler = h; pointers.clear(); }
  function isDown(code) { return keys.has(code); }
  function consumePressed(code) { const v = keyPressed.has(code); keyPressed.delete(code); return v; }
  function endFrame() { keyPressed.clear(); }

  // keyboard movement vector
  function keyAxis() {
    let x = 0, y = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1;
    const l = Math.hypot(x, y);
    if (l > 0) { x /= l; y /= l; }
    return { x, y, active: l > 0 };
  }

  return { init, setHandler, pointers, isDown, consumePressed, endFrame, keyAxis, get touch() { return lastInputWasTouch; } };
})();
