/* ============================================================
   Boot + Main Menu scenes
   ============================================================ */
NT.Scenes = NT.Scenes || {};
const __UI = NT.UI;

// draws the game logo
NT.UI.logo = function (ctx, x, y, w, t = 0) {
  const s = w / 420; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // LEGO tile
  ctx.save(); ctx.translate(-228, -34); ctx.fillStyle = '#d0202a'; NT.Minifig.rr(ctx, -30, -30, 60, 60, 8); ctx.fill(); ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 4; NT.Minifig.rr(ctx, -27, -27, 54, 54, 6); ctx.stroke(); ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5; NT.Minifig.rr(ctx, -30, -30, 60, 60, 8); ctx.stroke();
  NT.UI.text(ctx, 'LEGO', 0, 1, { size: 22, color: '#fff', stroke: '#111', strokeWidth: 4, weight: '900' }); ctx.restore();
  // NINJAGO
  ctx.save(); ctx.transform(1, 0, -0.08, 1, 0, 0);
  NT.UI.goldText(ctx, 'NINJAGO', 36, -30, 80, { weight: '900', strokeWidth: 12, stroke: '#2a0a3a', top: '#fff6c8', mid: '#f4c542', bot: '#b0701a' });
  ctx.restore();
  // TOURNAMENT scroll
  NT.UI.scroll(ctx, 20, 42, 330, 46, null);
  NT.UI.goldText(ctx, 'TOURNAMENT', 20, 43, 30, { weight: '900', top: '#ffffff', mid: '#f0d888', bot: '#c89a3a' });
  ctx.restore();
};

NT.Scenes.Boot = class Boot {
  enter() { this.t = 0; this.ready = false; this.pressed = false; NT.Audio.playMusic('menu'); }
  update(dt) { this.t += dt; if (this.t > 1.4) this.ready = true; }
  go() { if (!this.ready || this.pressed) return; this.pressed = true; NT.Audio.unlock(); NT.Audio.play('select'); NT.SceneManager.go(new NT.Scenes.Menu(), {}, 'iris', 0.5); }
  onPointerDown() { this.go(); }
  onKeyDown() { this.go(); }
  render(ctx) {
    const W = NT.Game.W, H = NT.Game.H;
    __UI.menuBackground(ctx, W, H, this.t);
    const lw = Math.min(W * 0.8, 520);
    __UI.logo(ctx, W / 2, H * 0.36, lw, this.t);
    const bw = Math.min(W * 0.6, 360), by = H * 0.62;
    if (!this.ready) { __UI.bar(ctx, W / 2 - bw / 2, by, bw, 26, Math.min(1, this.t / 1.3), { label: 'LOADING' }); }
    else { const a = 0.6 + 0.4 * Math.sin(this.t * 4); ctx.globalAlpha = a; __UI.goldText(ctx, NT.Input.touch || ('ontouchstart' in window) ? 'TAP TO START' : 'CLICK OR PRESS ANY KEY', W / 2, by + 13, Math.min(30, W * 0.05)); ctx.globalAlpha = 1; }
    __UI.text(ctx, 'Fan-made recreation · not affiliated with LEGO', W / 2, H - 18, { size: 11, color: 'rgba(255,240,200,0.55)', weight: 'normal' });
  }
};

NT.Scenes.Menu = class Menu {
  constructor() { this.ui = new __UI.UILayer(); this.t = 0; }
  enter() {
    this.t = 0; NT.Audio.playMusic('menu');
    this.figs = ['kai', 'jay', 'lloyd', 'cole', 'zane'].map((id) => NT.Characters.get(id));
    this.layout(NT.Game.W, NT.Game.H);
  }
  layout(W, H) {
    this.ui.clear(); const s = Math.min(W / 900, H / 560); const r = Math.max(34, 52 * Math.max(0.7, s));
    this.ui.add({ id: 'play', x: W - r - 22, y: H - r - 22, r, onTap: () => NT.SceneManager.go(new NT.Scenes.ArenaSelect(), {}, 'iris'), draw: (ctx, b) => __UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: __UI.Icons.play, glow: '#ffd86a', glowAmt: 0.6 + 0.4 * Math.sin(this.t * 4) }) });
    this.ui.add({ id: 'settings', x: r + 22, y: H - r - 22, r, onTap: () => NT.SceneManager.pushOverlay(new NT.Overlays.Settings()), draw: (ctx, b) => __UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: __UI.Icons.gear }) });
    this.ui.add({ id: 'chars', x: W / 2, y: H - 46, w: Math.min(260, W * 0.4), h: 44, shape: 'rect', onTap: () => NT.SceneManager.go(new NT.Scenes.CharSelect(), { from: 'menu' }, 'iris'), draw: (ctx, b) => __UI.pillButton(ctx, b.x, b.y, b.w, b.h, 'CHARACTERS', { press: b.press, size: 18 }) });
    this.s = s;
  }
  resize(w, h) { this.layout(w, h); }
  update(dt) { this.t += dt; this.ui.update(dt); }
  onPointerDown(p) { this.ui.onPointerDown(p); }
  onPointerMove(p) { this.ui.onPointerMove(p); }
  onPointerUp(p) { this.ui.onPointerUp(p); }
  onKeyDown(c) { if (c === 'Enter' || c === 'Space') this.ui.get('play').onTap(); }
  render(ctx) {
    const W = NT.Game.W, H = NT.Game.H, t = this.t;
    __UI.menuBackground(ctx, W, H, t);
    // floor line for figures
    const fy = H * 0.72; const g = ctx.createLinearGradient(0, fy - 80, 0, fy + 40); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = g; ctx.fillRect(0, fy - 80, W, 120);
    // animated ninja line-up
    const n = this.figs.length; const spacing = Math.min(150, W / (n + 1)); const sc = Math.min(1.5, Math.max(0.8, H / 600));
    this.figs.forEach((c, i) => {
      const x = W / 2 + (i - (n - 1) / 2) * spacing; const ph = t * 2 + i;
      const pose = i === 2 ? { armL: 2.9, armR: 2.9, bob: -Math.abs(Math.sin(t * 3)) * 10, weaponAngle: Math.PI } : { armL: 0.2 + Math.sin(ph) * 0.05, armR: 0.25, bob: Math.sin(ph) * 1.5, weaponAngle: Math.PI + 0.3 };
      ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, fy, 30 * sc, 10 * sc, 0, 0, 6.283); ctx.fill();
      ctx.translate(x, fy); ctx.scale(sc, sc); NT.Minifig.draw(ctx, c.look, pose, { facing: Math.PI / 2 + Math.sin(t * 0.7 + i) * 0.5 }); ctx.restore();
    });
    const lw = Math.min(W * 0.78, 520);
    __UI.logo(ctx, W / 2, H * 0.24, lw, t);
    // progress line
    const d = NT.Save.get(); const a = NT.Arenas.get(d.currentArena) || NT.Arenas.list[0];
    const done = NT.Tournament.isTournamentComplete();
    __UI.goldText(ctx, done ? 'TOURNAMENT CHAMPION!' : `Next: ${a.name} · Round ${Math.min(NT.Tournament.ROUNDS, d.currentRound + 1)}`, W / 2, H * 0.44, Math.min(20, W * 0.035), { mid: '#fff0b0' });
    // studs
    ctx.save(); ctx.translate(W - 60, 34); ctx.scale(0.36, 0.36); __UI.Icons.stud(ctx); ctx.restore();
    __UI.goldText(ctx, NT.Util.fmtNum(d.studs), W - 84, 34, 22, { align: 'right' });
    this.ui.render(ctx);
  }
};
