/* ============================================================
   NT.SceneManager — scene stack with transitions
   Scene interface: enter(params), exit(), update(dt), render(ctx),
   onPointerDown/Move/Up(ptr), onKeyDown(code), resize(w,h)
   ============================================================ */
NT.SceneManager = (function () {
  let current = null;
  let next = null;
  let nextParams = null;
  let trans = { active: false, t: 0, dur: 0.45, phase: 0, type: 'fade' }; // phase 0 = out, 1 = in
  let overlays = []; // modal overlays (pause, settings)

  function go(scene, params, type = 'fade', dur = 0.45) {
    if (trans.active && trans.phase === 0) { next = scene; nextParams = params; return; }
    next = scene; nextParams = params;
    trans = { active: true, t: 0, dur, phase: 0, type };
    NT.Audio.play('whoosh');
  }
  function replaceImmediate(scene, params) {
    if (current && current.exit) current.exit();
    current = scene;
    overlays = [];
    NT.Input.setHandler(dispatcher);
    if (current.enter) current.enter(params || {});
    if (current.resize) current.resize(NT.Game.W, NT.Game.H);
  }

  function pushOverlay(o) { overlays.push(o); if (o.enter) o.enter(); }
  function popOverlay() { const o = overlays.pop(); if (o && o.exit) o.exit(); return o; }
  function topOverlay() { return overlays[overlays.length - 1] || null; }

  const dispatcher = {
    onPointerDown(p) { const t = topOverlay() || current; if (t && t.onPointerDown) t.onPointerDown(p); },
    onPointerMove(p) { const t = topOverlay() || current; if (t && t.onPointerMove) t.onPointerMove(p); },
    onPointerUp(p) { const t = topOverlay() || current; if (t && t.onPointerUp) t.onPointerUp(p); },
    onKeyDown(c) { const t = topOverlay() || current; if (t && t.onKeyDown) t.onKeyDown(c); },
    onBlur() { const t = topOverlay() || current; if (t && t.onBlur) t.onBlur(); },
  };

  function update(dt) {
    if (trans.active) {
      trans.t += dt;
      if (trans.phase === 0 && trans.t >= trans.dur) {
        replaceImmediate(next, nextParams);
        next = null;
        trans.phase = 1; trans.t = 0;
      } else if (trans.phase === 1 && trans.t >= trans.dur) {
        trans.active = false;
      }
    }
    const top = topOverlay();
    if (top) { if (top.update) top.update(dt); if (top.blocksUpdate === false && current && current.update) current.update(dt); }
    else if (current && current.update && !(trans.active && trans.phase === 0 && trans.t > trans.dur * 0.9)) current.update(dt);
  }

  function render(ctx) {
    if (current && current.render) current.render(ctx);
    for (const o of overlays) if (o.render) o.render(ctx);
    if (trans.active) {
      const W = NT.Game.W, H = NT.Game.H;
      let a = trans.phase === 0 ? trans.t / trans.dur : 1 - trans.t / trans.dur;
      a = NT.Util.clamp(a, 0, 1);
      if (trans.type === 'iris') {
        // circular iris wipe (gold rim)
        const maxR = Math.hypot(W, H) * 0.6;
        const r = maxR * (1 - NT.Util.ease.inOutQuad(a));
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(W / 2, H / 2, Math.max(0, r), 0, Math.PI * 2, true);
        ctx.fillStyle = '#0a0612'; ctx.fill('evenodd');
        if (r > 0 && r < maxR) { ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = '#e0b14a'; ctx.stroke(); }
        ctx.restore();
      } else {
        ctx.fillStyle = `rgba(6,3,12,${a})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  function resize(w, h) { if (current && current.resize) current.resize(w, h); for (const o of overlays) if (o.resize) o.resize(w, h); }

  return { go, replaceImmediate, update, render, resize, pushOverlay, popOverlay, topOverlay, get current() { return current; }, get transitioning() { return trans.active; } };
})();
