/* ============================================================
   Arena Select — scroll title, framed live arena preview, side
   previews, gift box (top-left), shop coin (top-right), round pips,
   back (bottom-left) and play (bottom-right).
   ============================================================ */
NT.Scenes.ArenaSelect = class ArenaSelect {
  constructor() { this.ui = new NT.UI.UILayer(); this.t = 0; }
  enter(params) {
    const d = NT.Save.get(); this.t = 0;
    this.index = Math.max(0, NT.Tournament.arenaIndex(params.arenaId || d.currentArena));
    this.round = params.round != null ? params.round : d.currentRound;
    this.slide = 0; this.slideFrom = this.index; this.previewCams = {};
    NT.Audio.playMusic('menu');
    this.clampRound();
    this.layout(NT.Game.W, NT.Game.H);
  }
  clampRound() { const a = NT.Arenas.list[this.index]; const cleared = NT.Save.arenaProgress(a.id).cleared; this.round = Math.min(this.round, Math.min(cleared, NT.Tournament.ROUNDS - 1)); if (this.round < 0) this.round = 0; }
  layout(W, H) {
    this.ui.clear(); const s = Math.min(W / 900, H / 560); const r = Math.max(30, 46 * Math.max(0.7, s)); this.s = s; this.r = r;
    const land = W >= H;
    this.frame = { w: Math.min(W * (land ? 0.44 : 0.8), 620), h: 0 }; this.frame.h = this.frame.w * 0.58; this.frame.x = W / 2 - this.frame.w / 2; this.frame.y = (land ? H * 0.19 : H * 0.2);
    this.ui.add({ id: 'gift', x: r + 20, y: r + 20, r, onTap: () => this.gift(), draw: (ctx, b) => { const ready = NT.Progression.giftReady(); NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.gift, glow: ready ? '#ffd86a' : null, glowAmt: 0.6 + 0.4 * Math.sin(this.t * 5) }); NT.UI.text(ctx, ready ? 'GIFT!' : NT.Progression.giftCountdown(), b.x, b.y + b.r + 12, { size: 11, color: '#ffe9a0', stroke: '#2a1408', strokeWidth: 3 }); } });
    this.ui.add({ id: 'shop', x: W - r - 20, y: r + 20, r, onTap: () => NT.SceneManager.go(new NT.Scenes.CharSelect(), { from: 'arena', shop: true, arenaId: NT.Arenas.list[this.index].id, round: this.round }, 'iris'), draw: (ctx, b) => NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.coin, iconScale: 1.1 }) });
    this.ui.add({ id: 'back', x: r + 20, y: H - r - 20, r, onTap: () => NT.SceneManager.go(new NT.Scenes.Menu(), {}, 'fade'), draw: (ctx, b) => NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.back }) });
    this.ui.add({ id: 'play', x: W - r - 20, y: H - r - 20, r, onTap: () => this.play(), draw: (ctx, b) => { const ok = NT.Tournament.isArenaUnlocked(NT.Arenas.list[this.index].id); NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.play, disabled: !ok, glow: ok ? '#ffd86a' : null, glowAmt: 0.5 + 0.5 * Math.sin(this.t * 4) }); } });
    // arrows
    const ay = this.frame.y + this.frame.h / 2; const ax = land ? this.frame.x - r * 1.6 : r + 10;
    this.ui.add({ id: 'left', x: land ? ax : r + 14, y: land ? ay : this.frame.y + this.frame.h + 40, r: r * 0.8, onTap: () => this.move(-1), draw: (ctx, b) => NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.arrowL, disabled: this.index === 0 }) });
    this.ui.add({ id: 'right', x: land ? W - ax : W - r - 14, y: land ? ay : this.frame.y + this.frame.h + 40, r: r * 0.8, onTap: () => this.move(1), draw: (ctx, b) => NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.arrowR, disabled: this.index === NT.Arenas.list.length - 1 }) });
    // round pips
    const pr = Math.max(14, 20 * Math.max(0.7, s)); const py = this.frame.y + this.frame.h + (land ? 46 : 90); this.pipY = py; this.pipR = pr;
    for (let i = 0; i < NT.Tournament.ROUNDS; i++) { const x = W / 2 + (i - 2) * pr * 2.6; this.ui.add({ id: 'pip' + i, x, y: py, r: pr, onTap: () => { const a = NT.Arenas.list[this.index]; const cleared = NT.Save.arenaProgress(a.id).cleared; if (i <= cleared && i < NT.Tournament.ROUNDS) { this.round = i; NT.Audio.play('select'); } else NT.Audio.play('error'); }, draw: (ctx, b) => { const a = NT.Arenas.list[this.index]; const cleared = NT.Save.arenaProgress(a.id).cleared; const lit = i < cleared; const sel = i === this.round; NT.UI.medallion(ctx, b.x, b.y, b.r * (sel ? 1.15 : 1), i + 1, lit || sel, { glow: sel }); if (sel) { ctx.save(); ctx.strokeStyle = '#fff0b0'; ctx.lineWidth = 3; ctx.shadowColor = '#ffd86a'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.25, 0, 6.283); ctx.stroke(); ctx.restore(); } } }); }
    // touch swipe on the frame
    this.ui.add({ id: 'frame', x: W / 2, y: this.frame.y + this.frame.h / 2, w: this.frame.w, h: this.frame.h, shape: 'rect', silent: true, onUp: (p, inside) => { const dx = p.x - p.sx; if (Math.abs(dx) > 60) this.move(dx < 0 ? 1 : -1); else if (inside && !p.moved) this.play(); } });
  }
  resize(w, h) { this.layout(w, h); }
  move(dir) { const ni = NT.Util.clamp(this.index + dir, 0, NT.Arenas.list.length - 1); if (ni === this.index) return; this.slideFrom = this.index; this.index = ni; this.slide = 1; this.round = Math.min(NT.Save.arenaProgress(NT.Arenas.list[ni].id).cleared, NT.Tournament.ROUNDS - 1); NT.Audio.play('whoosh'); }
  play() {
    const a = NT.Arenas.list[this.index];
    if (!NT.Tournament.isArenaUnlocked(a.id)) { NT.Audio.play('error'); NT.SceneManager.pushOverlay(new NT.Overlays.Message('LOCKED', [`Complete ${NT.Arenas.list[this.index - 1].name}`, 'to unlock this arena.'], { icon: NT.UI.Icons.lock })); return; }
    const d = NT.Save.get(); d.currentArena = a.id; d.currentRound = this.round; NT.Save.save();
    NT.Audio.play('select');
    NT.SceneManager.go(new NT.Scenes.CharSelect(), { from: 'arena', arenaId: a.id, round: this.round }, 'iris');
  }
  gift() {
    if (!NT.Progression.giftReady()) { NT.Audio.play('error'); NT.SceneManager.pushOverlay(new NT.Overlays.Message('DAILY GIFT', ['Your next gift is ready in', NT.Progression.giftCountdown() + '.'], { icon: NT.UI.Icons.gift })); return; }
    const g = NT.Progression.claimGift(); NT.Audio.play('gift');
    NT.SceneManager.pushOverlay(new NT.Overlays.Message('DAILY GIFT', [`You received ${NT.Util.fmtNum(g.studs)} studs!`, `Gift streak: ${g.streak}`], { icon: NT.UI.Icons.gift }));
  }
  update(dt) { this.t += dt; this.ui.update(dt); this.slide = Math.max(0, this.slide - dt * 3.2); if (NT.Input.consumePressed('ArrowLeft')) this.move(-1); if (NT.Input.consumePressed('ArrowRight')) this.move(1); if (NT.Input.consumePressed('Enter') || NT.Input.consumePressed('Space')) this.play(); if (NT.Input.consumePressed('Escape')) this.ui.get('back').onTap(); }
  onPointerDown(p) { this.ui.onPointerDown(p); }
  onPointerMove(p) { this.ui.onPointerMove(p); }
  onPointerUp(p) { this.ui.onPointerUp(p); }
  // live preview of an arena rendered with its own camera into a rect
  drawPreview(ctx, arena, x, y, w, h, alpha = 1) {
    if (!NT.ArenaCache[arena.id]) NT.ArenaCache[arena.id] = new NT.ArenaRenderer(arena);
    const ar = NT.ArenaCache[arena.id];
    let cam = this.previewCams[arena.id]; if (!cam) { cam = new NT.Camera(); cam.H = 700; cam.D = 1000; this.previewCams[arena.id] = cam; }
    cam.resize(w, h); cam.cx = w / 2; cam.cy = h * 0.5; cam.baseFocal *= 0.62; cam.tx = 0; cam.tz = -40; cam.snap();
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.translate(x, y); ctx.globalAlpha = alpha;
    ar.renderSky(ctx, cam, w, h, this.t); ar.renderFloor(ctx, cam, w, h);
    const list = ar.drawables(cam, this.t); list.sort((a, b) => a.z - b.z); for (const d of list) d.draw(ctx);
    const vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    if (!NT.Tournament.isArenaUnlocked(arena.id)) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, w, h); ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(w / 300, w / 300); NT.UI.Icons.lock(ctx); ctx.restore(); }
    ctx.restore();
  }
  render(ctx) {
    const W = NT.Game.W, H = NT.Game.H, UI = NT.UI, U = NT.Util; const s = this.s; const land = W >= H;
    UI.menuBackground(ctx, W, H, this.t);
    const a = NT.Arenas.list[this.index]; const f = this.frame;
    // side previews (neighbors peeking at the edges)
    const sw = f.w * 0.5, sh = f.h * 0.75, sy = f.y + (f.h - sh) / 2;
    if (land) { const prev = NT.Arenas.list[this.index - 1], next = NT.Arenas.list[this.index + 1];
      if (prev) { this.drawPreview(ctx, prev, -sw * 0.75, sy, sw, sh, 0.6); UI.goldFrame(ctx, -sw * 0.75, sy, sw, sh, 6); }
      if (next) { this.drawPreview(ctx, next, W - sw * 0.25, sy, sw, sh, 0.6); UI.goldFrame(ctx, W - sw * 0.25, sy, sw, sh, 6); } }
    // main preview with slide animation
    const slideX = this.slide > 0 ? (this.index > this.slideFrom ? 1 : -1) * U.ease.inOutQuad(this.slide) * f.w * 0.6 : 0;
    ctx.save(); ctx.beginPath(); ctx.rect(f.x - 4, f.y - 4, f.w + 8, f.h + 8); ctx.clip();
    this.drawPreview(ctx, a, f.x + slideX, f.y, f.w, f.h, 1);
    if (this.slide > 0) { const from = NT.Arenas.list[this.slideFrom]; this.drawPreview(ctx, from, f.x + slideX - Math.sign(slideX) * f.w * 1.05, f.y, f.w, f.h, 1); }
    ctx.restore();
    UI.goldFrame(ctx, f.x - 4, f.y - 4, f.w + 8, f.h + 8, Math.max(6, f.w * 0.018));
    // title scroll
    UI.scroll(ctx, W / 2, land ? H * 0.11 : f.y - 40, Math.min(W * 0.5, 460), Math.max(40, 56 * Math.max(0.7, s)), a.name, { size: Math.max(16, 22 * Math.max(0.7, s)) });
    // round label + champion
    const champ = NT.Characters.get(NT.Tournament.champions[a.id][this.round]); const cleared = NT.Save.arenaProgress(a.id).cleared;
    const ly = this.pipY + this.pipR * 2.1;
    const complete = cleared >= NT.Tournament.ROUNDS;
    UI.goldText(ctx, complete ? 'ARENA COMPLETE · replay any round' : `ROUND ${this.round + 1} of ${NT.Tournament.ROUNDS}${this.round === NT.Tournament.ROUNDS - 1 ? ' · ARENA BOSS' : ''}`, W / 2, ly, Math.max(13, 18 * Math.max(0.7, s)));
    if (champ) { UI.text(ctx, `Champion: ${champ.name}${this.round < cleared ? '  ✓' : ''}`, W / 2, ly + 24 * Math.max(0.7, s), { size: Math.max(12, 15 * Math.max(0.7, s)), color: '#ffe9a0', stroke: '#2a1408', strokeWidth: 3 }); }
    // studs top-right (next to shop)
    const d = NT.Save.get(); ctx.save(); ctx.translate(W - this.r * 2 - 60, this.r * 0.55 + 20); ctx.scale(0.3, 0.3); UI.Icons.stud(ctx); ctx.restore();
    UI.goldText(ctx, U.fmtNum(d.studs), W - this.r * 2 - 82, this.r * 0.55 + 20, 20, { align: 'right' });
    this.ui.render(ctx);
  }
};
