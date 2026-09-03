/* ============================================================
   NT.Game — bootstrap, canvas sizing, main loop
   ============================================================ */
NT.Game = (function () {
  let canvas, ctx, W = 800, H = 600, dpr = 1, last = 0, running = false, time = 0, fpsAcc = 0, fpsN = 0, fps = 60;
  const listeners = [];

  function resize() {
    W = Math.max(320, window.innerWidth); H = Math.max(240, window.innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1, W * H > 1500 * 900 ? 1.25 : 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    NT.SceneManager.resize(W, H);
    const hint = document.getElementById('rotate-hint');
    if (hint) { if (H > W && W < 700 && NT.SceneManager.current instanceof NT.Scenes.Battle) hint.classList.add('show'); else hint.classList.remove('show'); }
  }
  function loop(ts) {
    if (!running) return;
    requestAnimationFrame(loop);
    let dt = (ts - last) / 1000; last = ts;
    if (!(dt > 0)) dt = 0.016; if (dt > 0.05) dt = 0.05;
    time += dt;
    fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    try {
      NT.SceneManager.update(dt);
      ctx.save(); NT.SceneManager.render(ctx); ctx.restore();
    } catch (e) { console.error(e); ctx.fillStyle = '#300'; ctx.fillRect(0, 0, W, 40); ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.fillText('Error: ' + (e && e.message), 6, 24); }
    NT.Input.endFrame();
  }
  function start() {
    canvas = document.getElementById('game'); ctx = canvas.getContext('2d', { alpha: false });
    NT.Save.load();
    NT.Input.init(canvas);
    window.addEventListener('resize', () => { resize(); });
    window.addEventListener('orientationchange', () => setTimeout(resize, 120));
    document.addEventListener('visibilitychange', () => { if (document.hidden) { const c = NT.SceneManager.current; if (c && c.onBlur) c.onBlur(); } });
    resize();
    NT.SceneManager.replaceImmediate(new NT.Scenes.Boot(), {});
    running = true; last = performance.now(); requestAnimationFrame(loop);
  }
  function onSettings(fn) { listeners.push(fn); }
  function notifySettings() { for (const fn of listeners) fn(); const c = NT.SceneManager.current; if (c && c.onSettingsChanged) c.onSettingsChanged(); }
  return { start, get W() { return W; }, get H() { return H; }, get ctx() { return ctx; }, get canvas() { return canvas; }, get time() { return time; }, get fps() { return fps; }, resize, onSettings, notifySettings };
})();
window.addEventListener('DOMContentLoaded', () => NT.Game.start());
