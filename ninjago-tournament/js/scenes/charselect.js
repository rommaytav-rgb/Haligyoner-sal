/* ============================================================
   Character Select — honeycomb portrait grid (13 per page), name,
   Special Move / Ranged / Dodge / Jump Slam table, special icon,
   level bar, studs, back / shop (buy) / play. Doubles as the shop.
   ============================================================ */
NT.Scenes.CharSelect = class CharSelect {
  constructor() { this.ui = new NT.UI.UILayer(); this.t = 0; }
  enter(params) {
    this.params = params || {}; this.t = 0; this.selT = 0;
    const d = NT.Save.get(); this.roster = NT.Characters.list;
    this.selected = this.roster.findIndex((c) => c.id === d.selectedChar); if (this.selected < 0) this.selected = 0;
    this.page = Math.floor(this.selected / 13); this.pageSlide = 0;
    this.previewFacing = Math.PI / 2;
    NT.Audio.playMusic('menu');
    this.layout(NT.Game.W, NT.Game.H);
  }
  get pages() { return Math.ceil(this.roster.length / 13); }
  get cur() { return this.roster[this.selected]; }
  slots(W, H) {
    const land = W >= H; const base = land ? H : W * 1.1;
    const cx = W / 2; const sp = land ? Math.min(W * 0.15, base * 0.27) : W * 0.2; const pr = land ? Math.min(0.066 * base, sp * 0.42) : sp * 0.44; const top = land ? 0.1 * H : 0.08 * H; const rowH = land ? 0.19 * H : pr * 2.35;
    const out = []; const cols = [-1, 0, 1], outer = [-2, 2];
    for (let r = 0; r < 5; r++) { const list = r % 2 === 0 ? cols : outer; const y = top + (r % 2 === 0 ? (r / 2) * rowH : ((r - 1) / 2) * rowH + rowH / 2); for (const c of list) out.push({ x: cx + c * sp, y, r: pr }); }
    return out;
  }
  layout(W, H) {
    this.ui.clear(); const land = W >= H; const base = land ? H : W * 1.1; const s = Math.min(W / 900, H / 560); const br = Math.max(30, 46 * Math.max(0.7, s)); this.br = br; this.base = base; this.land = land;
    this.slotPos = this.slots(W, H);
    this.slotPos.forEach((sl, i) => this.ui.add({ id: 'slot' + i, x: sl.x, y: sl.y, r: sl.r, silent: true, onTap: () => { const idx = this.page * 13 + i; if (idx < this.roster.length) this.select(idx); } }));
    const ay = land ? this.slotPos[6].y : this.slotPos[12].y + this.slotPos[12].r + br + 6; const ax = land ? Math.max(br + 10, this.slotPos[3].x - br * 2.2) : W / 2 - br * 2.2;
    this.ui.add({ id: 'prev', x: ax, y: ay, r: br * 0.85, onTap: () => this.flip(-1), draw: (ctx, b) => NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.arrowL, disabled: this.page === 0 }) });
    this.ui.add({ id: 'next', x: W - ax, y: ay, r: br * 0.85, onTap: () => this.flip(1), draw: (ctx, b) => NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.arrowR, disabled: this.page >= this.pages - 1 }) });
    const by = H - br - 16;
    this.ui.add({ id: 'back', x: br + 16, y: by, r: br, onTap: () => this.back(), draw: (ctx, b) => NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.back }) });
    this.ui.add({ id: 'buy', x: W - br * 3.6 - 16, y: by, r: br, onTap: () => this.buy(), draw: (ctx, b) => { const c = this.cur; const locked = !NT.Progression.isUnlocked(c.id); const can = locked && NT.Progression.canBuy(c); NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.cart, disabled: !locked, glow: can ? '#8fff8f' : null, glowAmt: 0.6 + 0.4 * Math.sin(this.t * 5) }); if (locked) NT.UI.goldText(ctx, NT.Util.fmtNum(NT.Progression.price(c)), b.x, b.y + b.r + 12, Math.max(11, b.r * 0.32), { mid: can ? '#8fff8f' : '#ff8f8f' }); } });
    this.ui.add({ id: 'play', x: W - br - 16, y: by, r: br, onTap: () => this.play(), draw: (ctx, b) => { const ok = NT.Progression.isUnlocked(this.cur.id); NT.UI.roundButton(ctx, b.x, b.y, b.r, { press: b.press, icon: NT.UI.Icons.play, disabled: !ok, glow: ok ? '#ffd86a' : null, glowAmt: 0.5 + 0.5 * Math.sin(this.t * 4) }); } });
    // info block positions
    const infoTop = land ? 0.56 * H : this.slotPos[12].y + this.slotPos[12].r + br * 2 + 24;
    this.info = { nameY: infoTop, rowsY: infoTop + 0.05 * base, rowH: 0.04 * base, labelX: W / 2 - 0.13 * W, valX: W / 2 + 0.1 * W, iconX: land ? W / 2 - 0.28 * W : W / 2 - 0.36 * W, iconY: infoTop + 0.12 * base, barX: W / 2 - Math.min(200, W * 0.22), barW: Math.min(400, W * 0.44), barY: land ? H - br - 26 : H - br * 2 - 40, barH: Math.max(26, 0.055 * base) };
    if (!land) { this.info.barY = by - br - 30; }
  }
  resize(w, h) { this.layout(w, h); }
  select(i) { if (i === this.selected) return; this.selected = i; this.selT = 0; NT.Audio.play('select'); if (NT.Progression.isUnlocked(this.cur.id)) { NT.Save.get().selectedChar = this.cur.id; NT.Save.save(); } }
  flip(dir) { const np = NT.Util.clamp(this.page + dir, 0, this.pages - 1); if (np === this.page) return; this.page = np; this.pageSlide = dir; this.pageSlideT = 1; NT.Audio.play('whoosh'); }
  back() { NT.Audio.play('back'); if (this.params.from === 'arena') NT.SceneManager.go(new NT.Scenes.ArenaSelect(), { arenaId: this.params.arenaId, round: this.params.round }, 'fade'); else NT.SceneManager.go(new NT.Scenes.Menu(), {}, 'fade'); }
  buy() {
    const c = this.cur; if (NT.Progression.isUnlocked(c.id)) return;
    if (!NT.Progression.canBuy(c)) { NT.Audio.play('error'); NT.SceneManager.pushOverlay(new NT.Overlays.Message('NOT ENOUGH STUDS', [`${c.name} costs ${NT.Util.fmtNum(NT.Progression.price(c))} studs.`, `You have ${NT.Util.fmtNum(NT.Save.get().studs)}.`, NT.Progression.unlockText(c) || ''], { icon: NT.UI.Icons.lock })); return; }
    NT.SceneManager.pushOverlay(new NT.Overlays.Confirm(`Buy ${c.name}?`, `${NT.Util.fmtNum(NT.Progression.price(c))} studs`, () => { NT.SceneManager.popOverlay(); if (NT.Progression.buy(c)) { NT.Audio.play('buy'); NT.Audio.play('unlock'); NT.Save.get().selectedChar = c.id; NT.Save.save(); this.unlockFx = { t: 0 }; NT.SceneManager.pushOverlay(new NT.Overlays.Message('UNLOCKED!', [`${c.name} joined your roster!`], { portrait: c.look })); } }));
  }
  play() {
    const c = this.cur;
    if (!NT.Progression.isUnlocked(c.id)) { NT.Audio.play('error'); NT.SceneManager.pushOverlay(new NT.Overlays.Message('LOCKED', [NT.Progression.unlockText(c) || '', `Or buy for ${NT.Util.fmtNum(NT.Progression.price(c))} studs.`], { icon: NT.UI.Icons.lock })); return; }
    NT.Save.get().selectedChar = c.id; NT.Save.save(); NT.Audio.play('select');
    if (this.params.from === 'arena' && !this.params.shop) NT.SceneManager.go(new NT.Scenes.Battle({ arenaId: this.params.arenaId, round: this.params.round, charId: c.id }), {}, 'iris', 0.6);
    else NT.SceneManager.go(new NT.Scenes.ArenaSelect(), { arenaId: this.params.arenaId, round: this.params.round }, 'iris');
  }
  update(dt) {
    this.t += dt; this.selT += dt; this.ui.update(dt); if (this.pageSlideT > 0) this.pageSlideT = Math.max(0, this.pageSlideT - dt * 3.5); if (this.unlockFx) { this.unlockFx.t += dt; if (this.unlockFx.t > 2) this.unlockFx = null; }
    const In = NT.Input;
    if (In.consumePressed('ArrowLeft')) this.select(Math.max(0, this.selected - 1)); if (In.consumePressed('ArrowRight')) this.select(Math.min(this.roster.length - 1, this.selected + 1));
    if (In.consumePressed('Enter') || In.consumePressed('Space')) this.play(); if (In.consumePressed('Escape')) this.back();
    this.page = Math.floor(this.selected / 13);
  }
  onPointerDown(p) { this.ui.onPointerDown(p); }
  onPointerMove(p) { this.ui.onPointerMove(p); }
  onPointerUp(p) { this.ui.onPointerUp(p); }
  render(ctx) {
    const W = NT.Game.W, H = NT.Game.H, UI = NT.UI, U = NT.Util; const base = this.base; const land = this.land;
    UI.menuBackground(ctx, W, H, this.t);
    // studs (top-right)
    const d = NT.Save.get(); ctx.save(); ctx.translate(W - 36, 34); ctx.scale(0.32, 0.32); UI.Icons.stud(ctx); ctx.restore(); UI.goldText(ctx, U.fmtNum(d.studs), W - 62, 34, 22, { align: 'right' });
    // portraits
    const slide = this.pageSlideT > 0 ? this.pageSlide * U.ease.outCubic(this.pageSlideT) * W * 0.5 : 0;
    for (let i = 0; i < 13; i++) {
      const idx = this.page * 13 + i; if (idx >= this.roster.length) break;
      const c = this.roster[idx]; const sl = this.slotPos[i]; const x = sl.x + slide; const unlocked = NT.Progression.isUnlocked(c.id); const sel = idx === this.selected;
      const pr = sl.r * (sel ? 1.08 + 0.03 * Math.sin(this.t * 6) : 1);
      ctx.save();
      if (sel) { ctx.shadowColor = '#ffd86a'; ctx.shadowBlur = 24; ctx.fillStyle = 'rgba(255,216,106,0.35)'; ctx.beginPath(); ctx.arc(x, sl.y, pr * 1.12, 0, U.TAU); ctx.fill(); ctx.shadowBlur = 0; }
      NT.Minifig.drawPortrait(ctx, c.look, x, sl.y, pr * 0.9, unlocked ? {} : { flat: '#2a1f3a', bg: '#3a2a4a', bg2: '#1a1020' });
      if (!unlocked) { ctx.save(); ctx.translate(x, sl.y + pr * 0.25); ctx.scale(pr / 90, pr / 90); UI.Icons.lock(ctx); ctx.restore(); }
      UI.goldRing(ctx, x, sl.y, pr * 0.93, pr * 0.12);
      ctx.restore();
    }
    // selected character info
    const c = this.cur; const unlocked = NT.Progression.isUnlocked(c.id); const inf = this.info; const E = NT.Elements[c.element];
    const fs = Math.max(12, 0.026 * base);
    UI.goldText(ctx, c.name, W / 2, inf.nameY, Math.max(18, 0.04 * base), { mid: '#fff0b0' });
    const rows = [['Special Move:', c.special.name], ['Ranged Attack:', c.features.ranged ? 'Yes' : 'No'], ['Dodge:', c.features.dodge ? 'Yes' : 'No'], ['Jump Slam:', c.features.jumpSlam ? 'Yes' : 'No']];
    rows.forEach(([l, v], i) => { const y = inf.rowsY + i * inf.rowH; UI.goldText(ctx, l, inf.labelX, y, fs, { align: 'left' }); UI.goldText(ctx, v, inf.valX, y, fs, { align: 'left', mid: '#fff0b0' }); });
    if (!unlocked) UI.text(ctx, NT.Progression.unlockText(c) || '', W / 2, inf.rowsY + 4 * inf.rowH + 4, { size: Math.max(11, 0.02 * base), color: '#ff9a9a', stroke: '#2a1408', strokeWidth: 3 });
    else if (land && inf.barY - (inf.rowsY + 4 * inf.rowH) > 26) UI.text(ctx, c.desc, W / 2, inf.rowsY + 4 * inf.rowH + 4, { size: Math.max(11, 0.02 * base), color: 'rgba(255,240,200,0.8)', weight: 'normal' });
    // special move icon (element colored)
    const ir = Math.max(26, 0.055 * base);
    UI.roundButton(ctx, inf.iconX, inf.iconY, ir, { icon: c.special.type === 'spinjitzu' ? UI.Icons.spin : UI.Icons.star, iconColor: E.c2, color: U.mix(E.c1, '#3b2382', 0.55), glow: E.c1, glowAmt: 0.5 });
    UI.text(ctx, E.name, inf.iconX, inf.iconY + ir + 12, { size: Math.max(11, 0.02 * base), color: '#ffe9a0', stroke: '#2a1408', strokeWidth: 3 });
    // level bar
    const li = NT.Progression.levelInfo(c.id); const lb = inf;
    UI.goldText(ctx, `Level: ${li.level}`, lb.barX - 16, lb.barY + lb.barH / 2, fs, { align: 'right' });
    UI.bar(ctx, lb.barX, lb.barY, lb.barW, lb.barH, li.next ? li.xp / li.next : 1, { label: li.next ? `${li.xp}/${li.next}` : 'MAX' });
    // stats summary
    const sx = land ? W / 2 + 0.28 * W : W / 2 + 0.36 * W; const sy = inf.iconY;
    const st = c.stats; const stR = ['HP ' + Math.round(st.hp * (1 + (li.level - 1) * 0.14)), 'ATK ' + (st.attack * (1 + (li.level - 1) * 0.1)).toFixed(0), 'DEF ' + st.defense, 'SPD ' + st.speed];
    stR.forEach((s, i) => UI.text(ctx, s, sx, sy - 1.5 * fs + i * fs * 1.05, { size: Math.max(11, fs * 0.85), color: '#ffe9a0', stroke: '#2a1408', strokeWidth: 3 }));
    // unlock fx
    if (this.unlockFx) { ctx.save(); ctx.globalAlpha = 1 - this.unlockFx.t / 2; ctx.strokeStyle = '#fff0b0'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, this.slotPos[Math.min(12, this.selected % 13)].y, this.unlockFx.t * 300, 0, U.TAU); ctx.stroke(); ctx.restore(); }
    this.ui.render(ctx);
    if (this.params.shop) UI.text(ctx, 'SHOP: select a locked character and tap the cart to buy', W / 2, H - 12, { size: Math.max(10, 0.018 * base), color: 'rgba(255,240,200,0.75)', weight: 'normal' });
  }
};
