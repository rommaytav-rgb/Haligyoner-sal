/* ============================================================
   Modal overlays: Pause, Settings, Confirm, Message
   ============================================================ */
NT.Overlays = (function () {
  const UI = NT.UI, U = NT.Util;

  class Base {
    constructor() { this.ui = new UI.UILayer(); this.t = 0; this.blocksUpdate = true; }
    enter() { this.t = 0; this.layout(NT.Game.W, NT.Game.H); }
    resize(w, h) { this.layout(w, h); }
    update(dt) { this.t += dt; this.ui.update(dt); }
    onPointerDown(p) { this.ui.onPointerDown(p); }
    onPointerMove(p) { this.ui.onPointerMove(p); }
    onPointerUp(p) { this.ui.onPointerUp(p); }
    onKeyDown(c) { NT.Input.consumePressed(c); if (c === 'Escape' && this.onEscape) this.onEscape(); }
    dim(ctx, W, H, a = 0.62) { ctx.fillStyle = `rgba(4,2,12,${a * Math.min(1, this.t * 6)})`; ctx.fillRect(0, 0, W, H); }
    pop() { return U.ease.outBack(Math.min(1, this.t * 4)); }
    close() { NT.SceneManager.popOverlay(); }
  }

  class Pause extends Base {
    constructor(battle) { super(); this.battle = battle; }
    layout(W, H) {
      this.ui.clear(); const s = Math.min(W / 900, H / 600); const cx = W / 2, cy = H * 0.55; const bw = Math.min(360, W * 0.6) * Math.max(0.8, s), bh = 54 * Math.max(0.8, s), gap = bh + 16;
      const items = [['Resume', () => this.close()], ['Restart', () => { this.close(); this.battle.restart(); }], ['Settings', () => NT.SceneManager.pushOverlay(new Settings())], ['Exit', () => { this.close(); this.battle.exitToMenu(); }]];
      items.forEach(([label, fn], i) => this.ui.add({ id: label, x: cx, y: cy - gap * 1.5 + i * gap, w: bw, h: bh, shape: 'rect', onTap: fn, draw: (ctx, b) => UI.pillButton(ctx, b.x, b.y, b.w, b.h, label, { press: b.press, color: label === 'Exit' ? '#7a2a3a' : undefined }) }));
      this.cx = cx; this.cy = cy; this.s = Math.max(0.8, s);
    }
    onEscape() { this.close(); }
    render(ctx) {
      const W = NT.Game.W, H = NT.Game.H; this.dim(ctx, W, H);
      const p = this.pop(); ctx.save(); ctx.translate(this.cx, this.cy); ctx.scale(p, p); ctx.translate(-this.cx, -this.cy);
      const pw = Math.min(520, W * 0.8) * this.s / Math.max(0.8, this.s), ph = 330 * this.s;
      UI.panel(ctx, this.cx - pw / 2, this.cy - ph / 2 - 20 * this.s, pw, ph + 40 * this.s);
      UI.scroll(ctx, this.cx, this.cy - ph / 2 - 20 * this.s, Math.min(400, pw * 0.85), 54 * this.s, 'PAUSED');
      this.ui.render(ctx);
      ctx.restore();
    }
  }

  class Settings extends Base {
    layout(W, H) {
      this.ui.clear(); const s = Math.max(0.75, Math.min(W / 900, H / 640)); this.s = s; const cx = W / 2, cy = H * 0.52; this.cx = cx; this.cy = cy;
      const st = NT.Save.get().settings;
      const rows = [['music', 'Music'], ['sfx', 'Sound Effects'], ['shake', 'Screen Shake'], ['leftHanded', 'Left-handed Controls'], ['showHints', 'Control Hints']];
      const rowH = 50 * s; const top = cy - rowH * 2.6;
      this.rows = rows; this.top = top; this.rowH = rowH;
      rows.forEach(([key, label], i) => this.ui.add({ id: key, x: cx + 150 * s, y: top + i * rowH, w: 120 * s, h: 40 * s, shape: 'rect', onTap: () => { st[key] = !st[key]; NT.Save.save(); NT.Audio.applySettings(); if (key === 'leftHanded' || key === 'showHints') NT.Game.notifySettings(); }, draw: (ctx, b) => UI.pillButton(ctx, b.x, b.y, b.w, b.h, st[key] ? 'ON' : 'OFF', { press: b.press, color: st[key] ? '#2a7a3a' : '#5a3a3a', size: b.h * 0.5 }) }));
      // button size
      this.ui.add({ id: 'size', x: cx + 150 * s, y: top + rows.length * rowH, w: 120 * s, h: 40 * s, shape: 'rect', onTap: () => { st.buttonSize = st.buttonSize >= 1.2 ? 0.85 : st.buttonSize >= 1 ? 1.2 : 1; NT.Save.save(); NT.Game.notifySettings(); }, draw: (ctx, b) => UI.pillButton(ctx, b.x, b.y, b.w, b.h, st.buttonSize >= 1.2 ? 'LARGE' : st.buttonSize >= 1 ? 'NORMAL' : 'SMALL', { press: b.press, size: b.h * 0.42 }) });
      this.ui.add({ id: 'reset', x: cx - 90 * s, y: top + (rows.length + 1.4) * rowH, w: 220 * s, h: 44 * s, shape: 'rect', onTap: () => NT.SceneManager.pushOverlay(new Confirm('Reset ALL progress?', 'Studs, unlocks and levels will be lost.', () => { NT.Save.reset(); NT.Audio.applySettings(); NT.Game.notifySettings(); NT.SceneManager.popOverlay(); NT.SceneManager.popOverlay(); NT.SceneManager.go(new NT.Scenes.Menu(), {}, 'fade'); })), draw: (ctx, b) => UI.pillButton(ctx, b.x, b.y, b.w, b.h, 'Reset Progress', { press: b.press, color: '#7a2a3a', size: b.h * 0.42 }) });
      this.ui.add({ id: 'close', x: cx + 150 * s, y: top + (rows.length + 1.4) * rowH, w: 140 * s, h: 44 * s, shape: 'rect', onTap: () => this.close(), draw: (ctx, b) => UI.pillButton(ctx, b.x, b.y, b.w, b.h, 'Close', { press: b.press, size: b.h * 0.45 }) });
    }
    onEscape() { this.close(); }
    render(ctx) {
      const W = NT.Game.W, H = NT.Game.H; this.dim(ctx, W, H, 0.7); const s = this.s;
      const p = this.pop(); ctx.save(); ctx.translate(this.cx, this.cy); ctx.scale(p, p); ctx.translate(-this.cx, -this.cy);
      const pw = Math.min(W * 0.92, 560 * s), ph = 460 * s;
      UI.panel(ctx, this.cx - pw / 2, this.cy - ph / 2, pw, ph);
      UI.scroll(ctx, this.cx, this.cy - ph / 2, Math.min(pw * 0.8, 360 * s), 52 * s, 'SETTINGS');
      this.rows.forEach(([key, label], i) => UI.goldText(ctx, label, this.cx - 60 * s, this.top + i * this.rowH, 20 * s, { align: 'right' }));
      UI.goldText(ctx, 'Button Size', this.cx - 60 * s, this.top + this.rows.length * this.rowH, 20 * s, { align: 'right' });
      this.ui.render(ctx);
      UI.text(ctx, 'Keyboard: WASD/Arrows move · J attack · K kick · L jump slam · U block · Shift dodge · Space Spinjitzu · Esc pause', this.cx, this.cy + ph / 2 - 22 * s, { size: 11 * s, color: 'rgba(255,240,200,0.7)', weight: 'normal' });
      ctx.restore();
    }
  }

  class Confirm extends Base {
    constructor(title, msg, onYes, onNo) { super(); this.title = title; this.msg = msg; this.onYes = onYes; this.onNo = onNo; }
    layout(W, H) {
      this.ui.clear(); const s = Math.max(0.75, Math.min(W / 900, H / 640)); this.s = s; const cx = W / 2, cy = H / 2; this.cx = cx; this.cy = cy;
      this.ui.add({ id: 'yes', x: cx - 90 * s, y: cy + 60 * s, w: 150 * s, h: 46 * s, shape: 'rect', onTap: () => { if (this.onYes) this.onYes(); else this.close(); }, draw: (ctx, b) => UI.pillButton(ctx, b.x, b.y, b.w, b.h, 'Yes', { press: b.press, color: '#2a7a3a' }) });
      this.ui.add({ id: 'no', x: cx + 90 * s, y: cy + 60 * s, w: 150 * s, h: 46 * s, shape: 'rect', onTap: () => { this.close(); if (this.onNo) this.onNo(); }, draw: (ctx, b) => UI.pillButton(ctx, b.x, b.y, b.w, b.h, 'No', { press: b.press, color: '#7a2a3a' }) });
    }
    onEscape() { this.close(); }
    render(ctx) {
      const W = NT.Game.W, H = NT.Game.H; this.dim(ctx, W, H, 0.5); const s = this.s;
      const p = this.pop(); ctx.save(); ctx.translate(this.cx, this.cy); ctx.scale(p, p); ctx.translate(-this.cx, -this.cy);
      const pw = Math.min(W * 0.9, 480 * s), ph = 230 * s;
      UI.panel(ctx, this.cx - pw / 2, this.cy - ph / 2, pw, ph);
      UI.goldText(ctx, this.title, this.cx, this.cy - 55 * s, 26 * s);
      UI.text(ctx, this.msg, this.cx, this.cy - 10 * s, { size: 16 * s, color: '#fff' });
      this.ui.render(ctx); ctx.restore();
    }
  }

  class Message extends Base {
    constructor(title, lines, opts = {}) { super(); this.title = title; this.lines = Array.isArray(lines) ? lines : [lines]; this.opts = opts; }
    layout(W, H) {
      this.ui.clear(); const s = Math.max(0.75, Math.min(W / 900, H / 640)); this.s = s; const cx = W / 2, cy = H / 2; this.cx = cx; this.cy = cy;
      const ph = (170 + this.lines.length * 26 + (this.opts.icon ? 70 : 0)) * s; this.ph = ph;
      this.ui.add({ id: 'ok', x: cx, y: cy + ph / 2 - 42 * s, w: 160 * s, h: 46 * s, shape: 'rect', onTap: () => { this.close(); if (this.opts.onClose) this.opts.onClose(); }, draw: (ctx, b) => UI.pillButton(ctx, b.x, b.y, b.w, b.h, this.opts.button || 'OK', { press: b.press }) });
    }
    onEscape() { this.close(); if (this.opts.onClose) this.opts.onClose(); }
    render(ctx) {
      const W = NT.Game.W, H = NT.Game.H; this.dim(ctx, W, H, 0.55); const s = this.s;
      const p = this.pop(); ctx.save(); ctx.translate(this.cx, this.cy); ctx.scale(p, p); ctx.translate(-this.cx, -this.cy);
      const pw = Math.min(W * 0.9, 520 * s), ph = this.ph;
      UI.panel(ctx, this.cx - pw / 2, this.cy - ph / 2, pw, ph);
      UI.scroll(ctx, this.cx, this.cy - ph / 2, Math.min(pw * 0.8, 380 * s), 52 * s, this.title, { size: 22 * s });
      let y = this.cy - ph / 2 + 70 * s;
      if (this.opts.icon) { ctx.save(); ctx.translate(this.cx, y + 25 * s); ctx.scale(s * 0.7, s * 0.7); this.opts.icon(ctx); ctx.restore(); y += 70 * s; }
      if (this.opts.portrait) { NT.Minifig.drawPortrait(ctx, this.opts.portrait, this.cx, y + 30 * s, 40 * s); UI.goldRing(ctx, this.cx, y + 30 * s, 40 * s, 5 * s); y += 80 * s; }
      for (const l of this.lines) { UI.text(ctx, l, this.cx, y, { size: 17 * s, color: '#fff' }); y += 26 * s; }
      this.ui.render(ctx); ctx.restore();
    }
  }

  return { Base, Pause, Settings, Confirm, Message };
})();
