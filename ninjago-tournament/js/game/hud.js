/* ============================================================
   NT.HUD — in-battle HUD & touch controls, laid out to match the
   original: portrait + hearts + studs (top-left), opponent portrait
   with heart badge (top-right), combo counter (right), pause tab
   (left edge), joystick + Spinjitzu button (bottom-left), 2x2
   action buttons: shield / jump slam / kick / sword (bottom-right)
   ============================================================ */
NT.HUD = class HUD {
  constructor(battle) {
    this.battle = battle; this.ui = new NT.UI.UILayer();
    this.joystick = { active: false, dx: 0, dy: 0, mag: 0, ptr: null, ox: 0, oy: 0, kx: 0, ky: 0, flick: false, flickX: 0, flickY: 0, hist: [] };
    this.held = { block: false }; this.onAction = null; this.onPause = null;
    this.press = { attack: 0, kick: 0, jumpslam: 0, block: 0, spin: 0 };
    this.spinPulse = 0; this.comboScale = 0; this.studPop = 0; this.heartShake = 0;
    this.layout(NT.Game.W, NT.Game.H);
  }
  layout(W, H) {
    this.W = W; this.H = H; const st = NT.Save.get().settings; const land = W >= H; const base = land ? H : W * 0.82; const bs = st.buttonSize || 1;
    this.base = base; this.land = land;
    const r = 0.087 * base * bs; this.r = r;
    const L = st.leftHanded; const mx = (x) => (L ? W - x : x);
    const joy = { x: land ? 0.115 * W : 0.2 * W, y: land ? 0.8 * H : H - 0.19 * W, R: 0.15 * base * bs, kr: 0.062 * base * bs };
    if (!land) joy.x = Math.max(joy.R + 10, joy.x);
    joy.x = mx(joy.x); this.joy = joy;
    this.spinBtn = { x: mx((L ? W - joy.x : joy.x) + joy.R * 1.7), y: joy.y + joy.R * 0.45, r: 0.088 * base * bs };
    const cx = W - r * 1.45, cx2 = cx - r * 2.35, y1 = H - r * 1.35, y0 = y1 - r * 2.25;
    this.btns = { shield: { x: mx(cx2), y: y0 }, fist: { x: mx(cx), y: y0 }, kick: { x: mx(cx2), y: y1 }, sword: { x: mx(cx), y: y1 } };
    this.ui.clear();
    const add = (id, b, action, hold) => this.ui.add({ id, x: b.x, y: b.y, r, silent: true, hitScale: 1.1, onDown: () => { if (hold) this.held.block = true; else if (this.onAction) this.onAction(action); this.press[action] = 1; }, onUp: () => { if (hold) this.held.block = false; }, onDrag: (p, inside) => { if (hold && !inside) this.held.block = false; else if (hold && inside) this.held.block = true; } });
    add('shield', this.btns.shield, 'block', true); add('fist', this.btns.fist, 'jumpslam'); add('kick', this.btns.kick, 'kick'); add('sword', this.btns.sword, 'attack');
    this.ui.add({ id: 'spin', x: this.spinBtn.x, y: this.spinBtn.y, r: this.spinBtn.r, silent: true, onDown: () => { if (this.onAction) this.onAction('special'); this.press.spin = 1; } });
    // pause tab on the left edge (right edge when left-handed)
    this.pauseTab = { x: L ? W - 16 : 16, y: land ? 0.49 * H : 0.4 * H, w: 34, h: 0.1 * base };
    this.ui.add({ id: 'pause', x: this.pauseTab.x, y: this.pauseTab.y, w: 60, h: this.pauseTab.h + 20, shape: 'rect', onTap: () => { if (this.onPause) this.onPause(); } });
    // top HUD
    const pr = 0.072 * base; this.portrait = { x: L ? W - 0.067 * W : 0.067 * W, y: 0.11 * base, r: pr };
    if (!land) { this.portrait.x = L ? W - pr - 14 : pr + 14; this.portrait.y = pr + 14; }
    this.enemyPortrait = { x: L ? 0.067 * W : W - 0.067 * W, y: 0.11 * base, r: 0.066 * base };
    if (!land) { this.enemyPortrait.x = L ? this.enemyPortrait.r + 14 : W - this.enemyPortrait.r - 14; this.enemyPortrait.y = this.enemyPortrait.r + 14; }
    this.comboPos = { x: L ? 0.11 * W : 0.89 * W, y: land ? 0.47 * H : 0.33 * H };
    if (!land) this.comboPos.x = L ? 0.2 * W : 0.8 * W;
  }
  resize(W, H) { this.layout(W, H); }
  // ---- pointer handling ----
  onPointerDown(p) {
    if (this.ui.onPointerDown(p)) return true;
    const j = this.joy; const L = NT.Save.get().settings.leftHanded;
    const inZone = L ? p.x > this.W * 0.55 : p.x < this.W * 0.45;
    if (inZone && p.y > this.H * 0.3 && !j.active) {
      j.active = true; j.ptr = p.id; const near = Math.hypot(p.x - j.x, p.y - j.y) < j.R * 1.6;
      j.ox = near ? j.x : p.x; j.oy = near ? j.y : p.y; j.kx = p.x; j.ky = p.y; j.hist = [{ t: performance.now(), x: p.x, y: p.y }];
      this.updateJoy(p); p.target = 'joy'; return true;
    }
    return false;
  }
  onPointerMove(p) { if (p.target === 'joy') { this.updateJoy(p); return true; } return this.ui.onPointerMove(p); }
  onPointerUp(p) { if (p.target === 'joy') { const j = this.joystick; this.joy.active = false; this.joy.ptr = null; j.active = false; j.dx = j.dy = j.mag = 0; return true; } return this.ui.onPointerUp(p); }
  updateJoy(p) {
    const j = this.joy, js = this.joystick; const max = j.R * 0.75;
    let dx = p.x - j.ox, dy = p.y - j.oy; const d = Math.hypot(dx, dy);
    if (d > max) { dx *= max / d; dy *= max / d; }
    j.kx = j.ox + dx; j.ky = j.oy + dy;
    js.active = true; js.mag = Math.min(1, d / max); js.dx = d > 0 ? (dx / max) : 0; js.dy = d > 0 ? (dy / max) : 0;
    // normalize to unit direction scaled by magnitude
    const m = Math.hypot(js.dx, js.dy); if (m > 1) { js.dx /= m; js.dy /= m; }
    // flick detection
    const now = performance.now(); j.hist.push({ t: now, x: p.x, y: p.y }); while (j.hist.length && now - j.hist[0].t > 140) j.hist.shift();
    const h0 = j.hist[0]; const fd = Math.hypot(p.x - h0.x, p.y - h0.y);
    if (fd > j.R * 1.05 && now - h0.t < 140 && !js.flick && now - (js.lastFlick || 0) > 500) { js.flick = true; js.lastFlick = now; js.flickX = (p.x - h0.x) / fd; js.flickY = (p.y - h0.y) / fd; j.hist = [{ t: now, x: p.x, y: p.y }]; }
  }
  releaseAll() { this.ui.releaseAll(); this.held.block = false; this.joy.active = false; this.joystick.active = false; this.joystick.dx = this.joystick.dy = this.joystick.mag = 0; }
  update(dt) {
    this.ui.update(dt); for (const k in this.press) this.press[k] = Math.max(0, this.press[k] - dt * 5);
    this.spinPulse += dt; this.comboScale = Math.max(0, this.comboScale - dt * 4); this.studPop = Math.max(0, this.studPop - dt * 4); this.heartShake = Math.max(0, this.heartShake - dt * 3);
  }
  // ---- rendering ----
  render(ctx, world) {
    const UI = NT.UI, I = UI.Icons, U = NT.Util; const pl = world.player; const W = this.W, H = this.H; const base = this.base;
    const st = NT.Save.get().settings; const touch = NT.Input.touch || ('ontouchstart' in window);
    // --- joystick ---
    const j = this.joy; const jx = j.active ? j.ox : j.x, jy = j.active ? j.oy : j.y;
    ctx.save();
    ctx.globalAlpha = j.active ? 0.9 : 0.75;
    const g = ctx.createRadialGradient(jx, jy, j.R * 0.2, jx, jy, j.R); g.addColorStop(0, 'rgba(90,60,180,0.55)'); g.addColorStop(1, 'rgba(40,20,100,0.75)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(jx, jy, j.R, 0, U.TAU); ctx.fill();
    UI.goldRing(ctx, jx, jy, j.R - 4, 5);
    ctx.strokeStyle = 'rgba(224,177,74,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(jx, jy, j.R * 0.62, 0, U.TAU); ctx.stroke();
    const kx = j.active ? j.kx : j.x, ky = j.active ? j.ky : j.y;
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    const kg = ctx.createRadialGradient(kx - j.kr * 0.35, ky - j.kr * 0.4, j.kr * 0.1, kx, ky, j.kr); kg.addColorStop(0, '#fff2b0'); kg.addColorStop(0.5, '#f0c454'); kg.addColorStop(1, '#a86f14');
    ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, j.kr, 0, U.TAU); ctx.fill(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = 'rgba(120,70,0,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    // --- spinjitzu button with meter ---
    const sb = this.spinBtn; const meter = pl ? pl.spinMeter : 0; const full = meter >= 1;
    const E = pl ? (NT.Elements[pl.element] || NT.Elements.energy) : NT.Elements.energy;
    UI.roundButton(ctx, sb.x, sb.y, sb.r, { press: this.press.spin, icon: I.spin, iconColor: full ? E.c2 : '#dfe3e8', glow: full ? E.c1 : null, glowAmt: 0.7 + 0.3 * Math.sin(this.spinPulse * 8), disabled: !full && meter < 0.02 });
    // meter arc
    ctx.save(); ctx.lineWidth = Math.max(4, sb.r * 0.14); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(sb.x, sb.y, sb.r + ctx.lineWidth * 0.9, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    if (meter > 0) { ctx.strokeStyle = full ? E.c2 : E.c1; ctx.shadowColor = E.c1; ctx.shadowBlur = full ? 14 : 6; ctx.beginPath(); ctx.arc(sb.x, sb.y, sb.r + ctx.lineWidth * 0.9, -Math.PI / 2, -Math.PI / 2 + U.TAU * Math.min(1, meter)); ctx.stroke(); }
    ctx.restore();
    // --- action buttons ---
    const b = this.btns;
    UI.roundButton(ctx, b.shield.x, b.shield.y, this.r, { press: this.held.block ? 1 : this.press.block, icon: I.shield, glow: this.held.block ? '#8fd3ff' : null });
    UI.roundButton(ctx, b.fist.x, b.fist.y, this.r, { press: this.press.jumpslam, icon: I.fist, disabled: pl && !pl.features.jumpSlam });
    UI.roundButton(ctx, b.kick.x, b.kick.y, this.r, { press: this.press.kick, icon: I.kick });
    UI.roundButton(ctx, b.sword.x, b.sword.y, this.r, { press: this.press.attack, icon: I.sword });
    if (!touch && st.showHints) { const hs = Math.max(10, this.r * 0.26); const hint = (bt, t) => UI.text(ctx, t, bt.x, bt.y + this.r + hs * 0.9, { size: hs, color: '#ffe9a0', stroke: '#2a1408', strokeWidth: 3 }); hint(b.shield, 'U  block'); hint(b.fist, 'L  jump slam'); hint(b.kick, 'K  kick'); hint(b.sword, 'J  attack'); hint(sb, 'SPACE'); UI.text(ctx, 'WASD / arrows  ·  Shift dodge', jx, jy + j.R + hs, { size: hs, color: '#ffe9a0', stroke: '#2a1408', strokeWidth: 3 }); }
    // --- pause tab ---
    const pt = this.pauseTab; const L = st.leftHanded; ctx.save();
    ctx.fillStyle = '#e0952a'; ctx.beginPath(); if (!L) { ctx.moveTo(0, pt.y - pt.h / 2); ctx.lineTo(pt.w, pt.y - pt.h / 2 + 10); ctx.lineTo(pt.w, pt.y + pt.h / 2 - 10); ctx.lineTo(0, pt.y + pt.h / 2); } else { ctx.moveTo(W, pt.y - pt.h / 2); ctx.lineTo(W - pt.w, pt.y - pt.h / 2 + 10); ctx.lineTo(W - pt.w, pt.y + pt.h / 2 - 10); ctx.lineTo(W, pt.y + pt.h / 2); } ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 2; ctx.stroke();
    const px = L ? W - pt.w * 0.5 : pt.w * 0.5; ctx.fillStyle = '#3b2382'; ctx.beginPath(); ctx.arc(px, pt.y, 11, 0, U.TAU); ctx.fill(); ctx.strokeStyle = '#e0b14a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#e0b14a'; ctx.fillRect(px - 4, pt.y - 5, 3, 10); ctx.fillRect(px + 1, pt.y - 5, 3, 10);
    ctx.restore();
    // --- player portrait + hearts + studs ---
    const P = this.portrait;
    if (pl) {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10;
      NT.Minifig.drawPortrait(ctx, pl.look, P.x, P.y, P.r * 0.88);
      ctx.restore(); UI.goldRing(ctx, P.x, P.y, P.r * 0.92, P.r * 0.12);
      const hs = 0.058 * base; const hx0 = L ? P.x - P.r - hs * 0.9 : P.x + P.r + hs * 0.9; const hy = P.y - P.r * 0.45 + (this.heartShake > 0 ? Math.sin(this.heartShake * 40) * 3 : 0);
      const hpPer = pl.maxHp / pl.hearts;
      for (let i = 0; i < pl.hearts; i++) { const frac = U.clamp((pl.hp - i * hpPer) / hpPer, 0, 1); const x = L ? hx0 - i * hs * 1.15 : hx0 + i * hs * 1.15; UI.heart(ctx, x, hy, hs, frac); }
      // stud counter
      const sy = P.y + P.r * 0.45; const sx = L ? P.x - P.r - hs * 0.6 : P.x + P.r + hs * 0.6;
      ctx.save(); ctx.translate(sx, sy); const pop = 1 + this.studPop * 0.35; ctx.scale(0.00055 * base * pop, 0.00055 * base * pop); I.stud(ctx); ctx.restore();
      UI.goldText(ctx, U.fmtNum(world.studsCollected), L ? sx - hs * 0.8 : sx + hs * 0.8, sy, 0.036 * base, { align: L ? 'right' : 'left', mid: '#ffd66a' });
    }
    // --- opponent portrait + heart badge ---
    const EP = this.enemyPortrait; const champ = world.champion || (world.plan && NT.Characters.get(world.plan.champion));
    if (champ) {
      const look = champ.look || champ.def.look; const boss = world.champion; const frac = boss ? U.clamp(boss.hp / boss.maxHp, 0, 1) : 1;
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; NT.Minifig.drawPortrait(ctx, look, EP.x, EP.y, EP.r * 0.88, { bg: '#7a2a3a', bg2: '#2a0f1a', alpha: boss ? 1 : 0.8 }); ctx.restore();
      if (!boss) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(EP.x, EP.y, EP.r * 0.88, 0, U.TAU); ctx.fill(); }
      UI.goldRing(ctx, EP.x, EP.y, EP.r * 0.92, EP.r * 0.12);
      const bx = L ? EP.x - EP.r * 0.78 : EP.x + EP.r * 0.78, by = EP.y - EP.r * 0.72, br = EP.r * 0.5;
      ctx.save(); const bg = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br); bg.addColorStop(0, '#6a45c8'); bg.addColorStop(1, '#1e1148'); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bx, by, br, 0, U.TAU); ctx.fill(); UI.goldRing(ctx, bx, by, br - br * 0.1, br * 0.18);
      UI.heart(ctx, bx, by + br * 0.05, br * 1.05, frac); ctx.restore();
      if (boss && boss.hp > 0) { UI.text(ctx, boss.name, EP.x, EP.y + EP.r + 12, { size: Math.max(11, 0.024 * base), color: '#ffe9a0', stroke: '#2a1408', strokeWidth: 3 }); }
    }
    // --- combo counter ---
    if (pl && pl.combo >= 2) {
      const c = this.comboPos; const sc = 1 + this.comboScale * 0.35; const size = 0.09 * base * sc;
      ctx.save(); ctx.translate(c.x, c.y); ctx.transform(1, 0, -0.12, 1, 0, 0);
      UI.goldText(ctx, `${pl.combo}`, -size * 0.25, 0, size, { weight: '900', align: 'right', strokeWidth: size * 0.14, stroke: '#3a1a08', top: '#fff2b0', mid: '#f4b93a', bot: '#b86a14' });
      UI.goldText(ctx, 'x', size * 0.05, size * 0.12, size * 0.7, { weight: '900', align: 'left', strokeWidth: size * 0.1, stroke: '#3a1a08', top: '#fff2b0', mid: '#f4b93a', bot: '#b86a14' });
      ctx.restore();
    }
    // wave counter
    if (world.waveText) UI.text(ctx, world.waveText, W / 2, this.land ? 0.06 * H : 0.16 * H, { size: Math.max(12, 0.026 * base), color: '#ffe9a0', stroke: '#2a1408', strokeWidth: 3 });
  }
};
