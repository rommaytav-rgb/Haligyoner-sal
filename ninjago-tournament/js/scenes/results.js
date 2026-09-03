/* ============================================================
   True Potential — post-battle character progression screen:
   portrait with rays, name, rank, 5 medallions, animated XP bar.
   ============================================================ */
NT.Scenes.TruePotential = class TruePotential {
  constructor() { this.ui = new NT.UI.UILayer(); this.t = 0; }
  enter(params) {
    this.p = params; this.t = 0; this.char = NT.Characters.get(params.charId) || NT.Characters.list[0];
    const before = params.before || NT.Progression.levelInfo(this.char.id);
    this.before = before; this.after = NT.Progression.levelInfo(this.char.id);
    // animation plan: fill from before.xp by result.xp, crossing levels
    this.animLevel = before.level; this.animXp = before.xp; this.remaining = params.result ? params.result.xp : 0; this.done = this.remaining <= 0;
    this.litFx = []; NT.Audio.playMusic('menu');
    this.layout(NT.Game.W, NT.Game.H);
  }
  layout(W, H) {
    this.ui.clear(); const s = Math.min(W / 900, H / 560); const br = Math.max(30, 46 * Math.max(0.7, s)); this.s = Math.max(0.7, s);
    this.ui.add({ id: 'restart', x: br + 18, y: H - br - 18, r: br, onTap: () => NT.SceneManager.go(new NT.Scenes.Battle({ arenaId: this.p.plan.arenaId, round: this.p.plan.round, charId: this.char.id }), {}, 'iris'), draw: (ctx, b) => NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.restart }) });
    this.ui.add({ id: 'play', x: W - br - 18, y: H - br - 18, r: br, onTap: () => this.next(), draw: (ctx, b) => NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.play, glow: '#ffd86a', glowAmt: 0.5 + 0.5 * Math.sin(this.t * 4) }) });
  }
  next() { NT.Audio.play('select'); const d = NT.Save.get(); NT.SceneManager.go(new NT.Scenes.ArenaSelect(), { arenaId: d.currentArena, round: d.currentRound }, 'iris'); }
  resize(w, h) { this.layout(w, h); }
  update(dt) {
    this.t += dt; this.ui.update(dt);
    if (!this.done && this.t > 0.8) {
      const rate = Math.max(120, this.remaining * 1.2) * dt; const step = Math.min(this.remaining, rate);
      this.animXp += step; this.remaining -= step;
      const next = NT.Progression.xpToNext(this.animLevel);
      if (next && this.animXp >= next) { this.animXp -= next; this.animLevel++; NT.Audio.play('levelup'); this.litFx.push({ i: this.animLevel - 1, t: 0 }); }
      if (this.animLevel >= NT.Progression.MAX_LEVEL) { this.animXp = 0; this.remaining = 0; }
      if (this.remaining <= 0.5) { this.done = true; this.remaining = 0; this.animLevel = this.after.level; this.animXp = this.after.xp; }
    }
    for (const f of this.litFx) f.t += dt;
    if (NT.Input.consumePressed('Enter') || NT.Input.consumePressed('Space')) this.next();
  }
  onPointerDown(p) { this.ui.onPointerDown(p); }
  onPointerMove(p) { this.ui.onPointerMove(p); }
  onPointerUp(p) { this.ui.onPointerUp(p); }
  render(ctx) {
    const W = NT.Game.W, H = NT.Game.H, UI = NT.UI, U = NT.Util; const s = this.s; const land = W >= H; const base = land ? H : W * 1.1;
    UI.menuBackground(ctx, W, H, this.t);
    UI.scroll(ctx, W / 2, land ? 0.08 * H : 0.06 * H, Math.min(W * 0.45, 420), Math.max(40, 0.075 * base), 'True Potential', { size: Math.max(16, 0.036 * base) });
    // portrait with rays
    const pr = 0.1 * base; const py = land ? 0.3 * H : 0.22 * H;
    ctx.save(); ctx.translate(W / 2, py); ctx.rotate(this.t * 0.3); ctx.globalAlpha = 0.35;
    for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillStyle = i % 2 ? '#ffe9a0' : '#ff9a4a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(pr * 2.4, -pr * 0.25); ctx.lineTo(pr * 2.4, pr * 0.25); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    NT.Minifig.drawPortrait(ctx, this.char.look, W / 2, py, pr * 0.9); UI.goldRing(ctx, W / 2, py, pr * 0.93, pr * 0.12);
    const rank = NT.Progression.RANKS[this.animLevel - 1], desc = NT.Progression.RANK_DESC[this.animLevel - 1];
    UI.goldText(ctx, this.char.name, W / 2, py + pr * 1.55, Math.max(18, 0.045 * base), { mid: '#fff0b0' });
    UI.goldText(ctx, rank, W / 2, py + pr * 2.15, Math.max(16, 0.038 * base));
    UI.text(ctx, desc, W / 2, py + pr * 2.55, { size: Math.max(12, 0.024 * base), color: '#fff', stroke: '#2a1408', strokeWidth: 3 });
    // medallions
    const mr = Math.max(18, 0.055 * base); const my = land ? 0.74 * H : 0.62 * H; const sp = mr * 3.1;
    for (let i = 0; i < 5; i++) { const x = W / 2 + (i - 2) * sp; const lit = i < this.animLevel; const fx = this.litFx.find((f) => f.i === i); const sc = fx ? 1 + Math.sin(Math.min(1, fx.t) * Math.PI) * 0.3 : 1; UI.medallion(ctx, x, my, mr * sc, i + 1, lit); if (fx && fx.t < 0.8) { ctx.save(); ctx.globalAlpha = 1 - fx.t / 0.8; ctx.strokeStyle = '#fff0b0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, my, mr + fx.t * 120, 0, U.TAU); ctx.stroke(); ctx.restore(); } }
    // level bar
    const bw = Math.min(W * 0.36, 330), bh = Math.max(26, 0.06 * base), bx = W / 2 - bw / 2 + 30, by = land ? 0.86 * H : 0.75 * H;
    const next = NT.Progression.xpToNext(this.animLevel);
    UI.goldText(ctx, `Level: ${this.animLevel}`, bx - 16, by + bh / 2, Math.max(14, 0.03 * base), { align: 'right' });
    UI.bar(ctx, bx, by, bw, bh, next ? this.animXp / next : 1, { label: next ? `${Math.floor(this.animXp)} / ${next}` : 'MAX LEVEL' });
    if (this.p.result) UI.goldText(ctx, `+${this.p.result.xp} XP`, W / 2, by + bh + 0.04 * base, Math.max(13, 0.028 * base), { mid: '#c8a8ff' });
    this.ui.render(ctx);
  }
};
