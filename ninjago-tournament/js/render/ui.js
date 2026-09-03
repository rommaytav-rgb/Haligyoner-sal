/* ============================================================
   NT.UI — drawing toolkit for menus & HUD (gold/purple LEGO
   Ninjago Tournament style) + UILayer button manager + Icons
   ============================================================ */
NT.UI = (function () {
  const U = NT.Util;
  const FONT = '"Trebuchet MS", "Arial Rounded MT Bold", "Segoe UI", Arial, sans-serif';
  const GOLD = '#f0c454', GOLD_L = '#fff0a8', GOLD_D = '#b8801a', PURPLE = '#3b2382', PURPLE_D = '#1e1148', PURPLE_L = '#5a3ab8', INK = '#2a1408';

  function font(size, weight = 'bold', italic = false) { return `${italic ? 'italic ' : ''}${weight} ${Math.round(size)}px ${FONT}`; }

  function text(ctx, str, x, y, o = {}) {
    ctx.save();
    ctx.font = font(o.size || 16, o.weight || 'bold', o.italic);
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.baseline || 'middle';
    if (o.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = o.shadow; ctx.shadowOffsetY = 2; }
    if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.strokeWidth || Math.max(2, (o.size || 16) * 0.16); ctx.strokeStyle = o.stroke; ctx.strokeText(str, x, y); }
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = o.color || '#fff';
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function goldText(ctx, str, x, y, size, o = {}) {
    ctx.save();
    ctx.font = font(size, o.weight || 'bold', o.italic);
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.baseline || 'middle';
    ctx.lineJoin = 'round';
    if (o.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = size * 0.2; ctx.shadowOffsetY = size * 0.08; }
    ctx.lineWidth = o.strokeWidth || Math.max(2.5, size * 0.17); ctx.strokeStyle = o.stroke || INK; ctx.strokeText(str, x, y);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
    g.addColorStop(0, o.top || GOLD_L); g.addColorStop(0.45, o.mid || GOLD); g.addColorStop(1, o.bot || GOLD_D);
    ctx.fillStyle = g; ctx.fillText(str, x, y);
    ctx.restore();
  }
  function measure(ctx, str, size, weight = 'bold') { ctx.font = font(size, weight); return ctx.measureText(str).width; }

  // gold rim ring (portrait frames, button rims)
  function goldRing(ctx, x, y, r, w) {
    ctx.save();
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, '#fff0b0'); g.addColorStop(0.35, '#e8b942'); g.addColorStop(0.7, '#b07a1a'); g.addColorStop(1, '#f6d97a');
    ctx.strokeStyle = g; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,40,0,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r - w / 2, 0, U.TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r + w / 2, 0, U.TAU); ctx.stroke();
    ctx.restore();
  }

  // round purple button with gold rim
  function roundButton(ctx, x, y, r, o = {}) {
    ctx.save();
    const press = o.press || 0;
    const s = 1 - press * 0.08;
    ctx.translate(x, y); ctx.scale(s, s);
    if (o.disabled) ctx.globalAlpha *= 0.45;
    // drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = r * 0.35; ctx.shadowOffsetY = r * 0.12;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    const c1 = o.color ? U.shade(o.color, 0.25) : '#6a45c8', c2 = o.color || '#3b2382', c3 = o.color ? U.shade(o.color, -0.45) : '#1e1148';
    g.addColorStop(0, press ? U.shade(c1, 0.2) : c1); g.addColorStop(0.6, c2); g.addColorStop(1, c3);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, U.TAU); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // glossy highlight
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.ellipse(0, -r * 0.45, r * 0.6, r * 0.32, 0, 0, U.TAU); ctx.fill();
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = r * 0.6 * (o.glowAmt || 1); ctx.strokeStyle = o.glow; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * 0.96, 0, U.TAU); ctx.stroke(); ctx.shadowBlur = 0; }
    goldRing(ctx, 0, 0, r - r * 0.07, r * 0.13);
    if (o.icon) { ctx.save(); ctx.scale(r / 50, r / 50); if (o.iconScale) ctx.scale(o.iconScale, o.iconScale); o.icon(ctx, o.iconColor); ctx.restore(); }
    if (o.label) goldText(ctx, o.label, 0, 0, o.labelSize || r * 0.55);
    ctx.restore();
  }
  // pill/long button
  function pillButton(ctx, x, y, w, h, label, o = {}) {
    ctx.save();
    const press = o.press || 0; const s = 1 - press * 0.06;
    ctx.translate(x, y); ctx.scale(s, s);
    if (o.disabled) ctx.globalAlpha *= 0.45;
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = h * 0.3; ctx.shadowOffsetY = h * 0.1;
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    const base = o.color || '#3b2382';
    g.addColorStop(0, U.shade(base, press ? 0.45 : 0.3)); g.addColorStop(0.5, base); g.addColorStop(1, U.shade(base, -0.45));
    ctx.fillStyle = g; NT.Minifig.rr(ctx, -w / 2, -h / 2, w, h, h / 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; NT.Minifig.rr(ctx, -w / 2 + h * 0.2, -h / 2 + h * 0.1, w - h * 0.4, h * 0.35, h * 0.2); ctx.fill();
    const rg = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); rg.addColorStop(0, '#f6d97a'); rg.addColorStop(0.5, '#b07a1a'); rg.addColorStop(1, '#fff0b0');
    ctx.strokeStyle = rg; ctx.lineWidth = Math.max(3, h * 0.09); NT.Minifig.rr(ctx, -w / 2 + 2, -h / 2 + 2, w - 4, h - 4, h / 2 - 2); ctx.stroke();
    if (o.icon) { ctx.save(); ctx.translate(-w / 2 + h * 0.55, 0); ctx.scale(h / 110, h / 110); o.icon(ctx); ctx.restore(); }
    goldText(ctx, label, o.icon ? h * 0.25 : 0, 0, o.size || h * 0.45);
    ctx.restore();
  }
  // title scroll banner
  function scroll(ctx, x, y, w, h, title, o = {}) {
    ctx.save();
    const rw = h * 0.5;
    // paper
    const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, '#5a3ab8'); g.addColorStop(0.5, '#3b2382'); g.addColorStop(1, '#2a1660');
    ctx.fillStyle = g; ctx.fillRect(x - w / 2 + rw * 0.6, y - h / 2 + h * 0.08, w - rw * 1.2, h * 0.84);
    ctx.strokeStyle = '#e0b14a'; ctx.lineWidth = 2; ctx.strokeRect(x - w / 2 + rw * 0.6, y - h / 2 + h * 0.08, w - rw * 1.2, h * 0.84);
    // rollers
    for (const sx of [x - w / 2 + rw / 2, x + w / 2 - rw / 2]) {
      const rg = ctx.createLinearGradient(sx - rw / 2, 0, sx + rw / 2, 0);
      rg.addColorStop(0, '#9a6a1a'); rg.addColorStop(0.3, '#f6d97a'); rg.addColorStop(0.6, '#d9a83a'); rg.addColorStop(1, '#8a5a10');
      ctx.fillStyle = rg; NT.Minifig.rr(ctx, sx - rw / 2, y - h / 2, rw, h, rw * 0.3); ctx.fill();
      ctx.fillStyle = '#5a3a08'; ctx.fillRect(sx - rw * 0.35, y - h / 2 + h * 0.15, rw * 0.7, 2); ctx.fillRect(sx - rw * 0.35, y + h / 2 - h * 0.15 - 2, rw * 0.7, 2);
    }
    if (title) goldText(ctx, title, x, y, o.size || h * 0.42);
    ctx.restore();
  }
  function goldFrame(ctx, x, y, w, h, t) {
    ctx.save();
    t = t || Math.max(4, Math.min(w, h) * 0.02);
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#f6d97a'); g.addColorStop(0.4, '#c89030'); g.addColorStop(0.7, '#e8b942'); g.addColorStop(1, '#8a5a10');
    ctx.strokeStyle = g; ctx.lineWidth = t; ctx.strokeRect(x + t / 2, y + t / 2, w - t, h - t);
    ctx.strokeStyle = 'rgba(60,30,0,0.6)'; ctx.lineWidth = 1; ctx.strokeRect(x + t, y + t, w - 2 * t, h - 2 * t); ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }
  function panel(ctx, x, y, w, h, o = {}) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.c1 || '#3d2a7a'); g.addColorStop(1, o.c2 || '#1f1245');
    ctx.fillStyle = g; NT.Minifig.rr(ctx, x, y, w, h, o.r || 18); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.strokeStyle = '#e0b14a'; ctx.lineWidth = 3; NT.Minifig.rr(ctx, x + 2, y + 2, w - 4, h - 4, (o.r || 18) - 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,180,0.35)'; ctx.lineWidth = 1; NT.Minifig.rr(ctx, x + 6, y + 6, w - 12, h - 12, (o.r || 18) - 5); ctx.stroke();
    ctx.restore();
  }
  // progress bar (level bars)
  function bar(ctx, x, y, w, h, frac, o = {}) {
    ctx.save();
    ctx.fillStyle = '#1a0f3a'; NT.Minifig.rr(ctx, x, y, w, h, h * 0.25); ctx.fill();
    const iw = Math.max(0, (w - 8) * U.clamp(frac, 0, 1));
    if (iw > 0) { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, o.c1 || '#8a63ff'); g.addColorStop(1, o.c2 || '#4a2ea0'); ctx.fillStyle = g; NT.Minifig.rr(ctx, x + 4, y + 4, iw, h - 8, (h - 8) * 0.25); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.18)'; NT.Minifig.rr(ctx, x + 4, y + 4, iw, (h - 8) * 0.4, 3); ctx.fill(); }
    const rg = ctx.createLinearGradient(x, 0, x + w, 0); rg.addColorStop(0, '#f6d97a'); rg.addColorStop(0.5, '#b07a1a'); rg.addColorStop(1, '#fff0b0');
    ctx.strokeStyle = rg; ctx.lineWidth = 3; NT.Minifig.rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, h * 0.25); ctx.stroke();
    if (o.label) goldText(ctx, o.label, x + w / 2, y + h / 2, h * 0.55);
    ctx.restore();
  }
  // tournament medallion (numbered coin)
  function medallion(ctx, x, y, r, n, lit, o = {}) {
    ctx.save();
    if (lit && o.glow !== false) { ctx.shadowColor = '#ff5a3a'; ctx.shadowBlur = r * 0.9; }
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    if (lit) { g.addColorStop(0, '#ffe9a0'); g.addColorStop(0.5, '#e0b14a'); g.addColorStop(1, '#9a6a1a'); }
    else { g.addColorStop(0, '#8a6a3a'); g.addColorStop(0.5, '#6a4a2a'); g.addColorStop(1, '#3a2a1a'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.fill();
    ctx.shadowBlur = 0;
    if (!lit) ctx.globalAlpha *= 0.55;
    // meander ring marks
    ctx.strokeStyle = lit ? '#7a4a10' : '#2a1a0a'; ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, U.TAU); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * U.TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); ctx.lineTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95); ctx.stroke(); }
    // inner red disc
    const ig = ctx.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r * 0.66);
    if (lit) { ig.addColorStop(0, '#ff7a4a'); ig.addColorStop(1, '#8a1a10'); } else { ig.addColorStop(0, '#5a2a1a'); ig.addColorStop(1, '#2a1008'); }
    ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(x, y, r * 0.64, 0, U.TAU); ctx.fill();
    goldText(ctx, String(n), x, y + r * 0.02, r * 0.95, { stroke: '#3a1008' });
    ctx.restore();
  }

  // ---------- menu background (cached) ----------
  let bgCache = null;
  function menuBackground(ctx, W, H, t = 0) {
    if (!bgCache || bgCache.width !== Math.round(W) || bgCache.height !== Math.round(H)) {
      bgCache = U.makeCanvas(W, H);
      const c = bgCache.getContext('2d');
      const g = c.createLinearGradient(0, 0, W * 0.3, H);
      g.addColorStop(0, '#3b1d72'); g.addColorStop(0.45, '#5a2464'); g.addColorStop(1, '#8a2a3c');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // carved dragon-like swirls & meander
      const rng = U.seeded(7);
      c.lineCap = 'round'; c.lineJoin = 'round';
      const S = Math.max(W, H);
      for (let i = 0; i < 9; i++) {
        const cx = rng() * W, cy = rng() * H, r0 = S * (0.06 + rng() * 0.16), turns = 1.5 + rng() * 1.5, dir = rng() < 0.5 ? 1 : -1;
        c.beginPath();
        for (let a = 0; a < turns * U.TAU; a += 0.1) { const r = r0 * (1 - a / (turns * U.TAU) * 0.85); const x = cx + Math.cos(a * dir) * r, y = cy + Math.sin(a * dir) * r * 0.85; if (a === 0) c.moveTo(x, y); else c.lineTo(x, y); }
        c.strokeStyle = 'rgba(20,8,40,0.35)'; c.lineWidth = S * 0.028; c.stroke();
        c.strokeStyle = 'rgba(255,200,220,0.07)'; c.lineWidth = S * 0.028; c.save(); c.translate(-S * 0.006, -S * 0.006); c.stroke(); c.restore();
      }
      // meander band segments
      for (let i = 0; i < 14; i++) {
        const x0 = rng() * W, y0 = rng() * H, len = S * (0.08 + rng() * 0.2), ang = (rng() < 0.5 ? 0 : Math.PI / 2) + (rng() - 0.5) * 0.4, st = S * 0.02;
        c.save(); c.translate(x0, y0); c.rotate(ang);
        c.beginPath(); let x = 0;
        while (x < len) { c.moveTo(x, 0); c.lineTo(x + st * 2, 0); c.lineTo(x + st * 2, -st * 2); c.lineTo(x + st, -st * 2); c.lineTo(x + st, -st); c.lineTo(x + st * 1.5, -st); x += st * 2.6; }
        c.strokeStyle = 'rgba(20,8,40,0.3)'; c.lineWidth = st * 0.45; c.stroke();
        c.restore();
      }
      // vignette
      const v = c.createRadialGradient(W / 2, H / 2, S * 0.25, W / 2, H / 2, S * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
      c.fillStyle = v; c.fillRect(0, 0, W, H);
    }
    ctx.drawImage(bgCache, 0, 0);
    // subtle moving light sweep
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const sx = ((t * 0.08) % 1.6 - 0.3) * W;
    const lg = ctx.createLinearGradient(sx - W * 0.2, 0, sx + W * 0.2, H);
    lg.addColorStop(0, 'rgba(255,200,120,0)'); lg.addColorStop(0.5, 'rgba(255,200,120,0.05)'); lg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ---------- Icons (drawn centered, ~100 unit box) ----------
  const Icons = {
    sword(ctx) { // slash: gold sword with yellow starburst
      ctx.save(); ctx.rotate(-0.75);
      starburst(ctx, 12, -20, 22, 8);
      ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-6, 34); ctx.lineTo(-6, 18); ctx.stroke();
      ctx.fillStyle = '#e0b14a'; NT.Minifig.rr(ctx, -10, 14, 8, 22, 3); ctx.fill();
      ctx.fillStyle = '#c9a03a'; NT.Minifig.rr(ctx, -16, 12, 20, 5, 2); ctx.fill();
      ctx.fillStyle = '#e8c860'; NT.Minifig.poly(ctx, [-9, 12, -3, 12, -1, -34, -6, -40, -11, -34]); ctx.fill();
      ctx.fillStyle = '#fff0b0'; NT.Minifig.poly(ctx, [-6, 12, -3, 12, -1, -34, -6, -40]); ctx.fill();
      ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2; NT.Minifig.poly(ctx, [-9, 12, -3, 12, -1, -34, -6, -40, -11, -34]); ctx.stroke();
      ctx.restore();
    },
    shield(ctx) {
      ctx.save(); starburst(ctx, 22, -22, 18, 8);
      ctx.translate(-4, 4); ctx.rotate(-0.25);
      const g = ctx.createRadialGradient(-6, -6, 4, 0, 0, 30); g.addColorStop(0, '#f8e08a'); g.addColorStop(0.6, '#d9a83a'); g.addColorStop(1, '#8a5a10');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 26, 30, 0, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#fff0b0'; ctx.beginPath(); ctx.ellipse(-2, -3, 9, 10, 0, 0, U.TAU); ctx.fill(); ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { const a = (i / 8) * U.TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 20, Math.sin(a) * 24, 2, 0, U.TAU); ctx.fill(); }
      ctx.restore();
    },
    kick(ctx) { // golden leg with starburst
      ctx.save(); starburst(ctx, 20, -20, 18, 8);
      ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.fillStyle = '#e0b14a';
      ctx.beginPath(); ctx.moveTo(-34, 22); ctx.lineTo(-30, 8); ctx.lineTo(-4, 4); ctx.lineTo(10, -10); ctx.lineTo(26, -6); ctx.lineTo(16, 10); ctx.lineTo(-2, 18); ctx.lineTo(-20, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c99a30'; ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(26, -6); ctx.lineTo(16, 10); ctx.lineTo(4, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
    fist(ctx) { // jump slam: golden arm/fist pointing up
      ctx.save(); ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.fillStyle = '#e0b14a';
      ctx.beginPath(); ctx.moveTo(-10, 30); ctx.lineTo(-10, 0); ctx.lineTo(-18, 0); ctx.lineTo(0, -34); ctx.lineTo(18, 0); ctx.lineTo(10, 0); ctx.lineTo(10, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c99a30'; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(18, 0); ctx.lineTo(10, 0); ctx.lineTo(10, 30); ctx.lineTo(2, 30); ctx.lineTo(2, -20); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff0b0'; ctx.fillRect(-7, 6, 4, 20);
      ctx.restore();
    },
    spin(ctx, color) { // lightning bolt inside a gray tornado
      ctx.save();
      ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.fillStyle = '#7a7f86';
      // tornado swirl
      ctx.beginPath(); ctx.moveTo(-30, -10); ctx.quadraticCurveTo(0, -24, 30, -10); ctx.quadraticCurveTo(10, -2, 20, 6); ctx.quadraticCurveTo(-4, 12, 8, 24); ctx.quadraticCurveTo(-10, 30, -14, 40); ctx.quadraticCurveTo(-8, 22, -18, 14); ctx.quadraticCurveTo(-34, 4, -30, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4a4f56'; ctx.beginPath(); ctx.moveTo(-22, -8); ctx.quadraticCurveTo(0, -16, 22, -8); ctx.quadraticCurveTo(0, -2, -22, -8); ctx.fill();
      // bolt
      ctx.fillStyle = color || '#dfe3e8';
      ctx.beginPath(); ctx.moveTo(6, -40); ctx.lineTo(-12, -4); ctx.lineTo(0, -4); ctx.lineTo(-8, 22); ctx.lineTo(16, -12); ctx.lineTo(4, -12); ctx.lineTo(14, -40); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
    heart(ctx, color) {
      ctx.save(); ctx.strokeStyle = '#2a0808'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.fillStyle = color || '#e8202a';
      heartPath(ctx, 0, 0, 40); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.ellipse(-12, -14, 7, 4, -0.6, 0, U.TAU); ctx.fill();
      ctx.restore();
    },
    stud(ctx, color) { // silver LEGO stud seen from the side
      ctx.save(); ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      const base = color || '#d0d4da', dark = U.shade(base, -0.35), light = U.shade(base, 0.5);
      ctx.fillStyle = dark; NT.Minifig.rr(ctx, -6, -30, 26, 60, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = base; ctx.beginPath(); ctx.ellipse(-14, 0, 14, 30, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = light; ctx.beginPath(); ctx.ellipse(-18, -12, 4, 8, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = light; ctx.beginPath(); ctx.arc(8, 18, 3, 0, U.TAU); ctx.fill();
      ctx.restore();
    },
    coin(ctx) { // gold LEGO coin
      ctx.save();
      const g = ctx.createRadialGradient(-8, -10, 4, 0, 0, 38); g.addColorStop(0, '#fff0b0'); g.addColorStop(0.6, '#e8b942'); g.addColorStop(1, '#9a6a1a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 36, 34, 0, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#7a4a10'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 28, 26, 0, 0, U.TAU); ctx.stroke();
      text(ctx, 'LEGO', 0, 1, { size: 15, color: '#7a4a10', weight: '900', italic: true });
      ctx.restore();
    },
    gift(ctx) {
      ctx.save(); ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.fillStyle = '#e0b14a'; NT.Minifig.rr(ctx, -30, -4, 60, 38, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c99a30'; NT.Minifig.rr(ctx, -34, -14, 68, 14, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff0b0'; ctx.fillRect(-5, -14, 10, 48); ctx.strokeRect(-5, -14, 10, 48);
      ctx.fillStyle = '#e0b14a'; ctx.beginPath(); ctx.ellipse(-12, -24, 11, 8, -0.4, 0, U.TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.ellipse(12, -24, 11, 8, 0.4, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
    gear(ctx) {
      ctx.save(); ctx.fillStyle = '#e0b14a'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5;
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * U.TAU, a2 = a + U.TAU / 16; ctx.lineTo(Math.cos(a - 0.15) * 34, Math.sin(a - 0.15) * 34); ctx.lineTo(Math.cos(a + 0.15) * 34, Math.sin(a + 0.15) * 34); ctx.lineTo(Math.cos(a2 - 0.15) * 25, Math.sin(a2 - 0.15) * 25); ctx.lineTo(Math.cos(a2 + 0.15) * 25, Math.sin(a2 + 0.15) * 25); } ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3b2382'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.restore();
    },
    cart(ctx) {
      ctx.save(); ctx.strokeStyle = '#e0b14a'; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-34, -22); ctx.lineTo(-24, -22); ctx.lineTo(-14, 14); ctx.lineTo(22, 14); ctx.lineTo(30, -10); ctx.lineTo(-20, -10); ctx.stroke();
      ctx.fillStyle = '#e0b14a'; ctx.beginPath(); ctx.arc(-10, 28, 6, 0, U.TAU); ctx.arc(18, 28, 6, 0, U.TAU); ctx.fill();
      ctx.restore();
    },
    play(ctx) { ctx.save(); ctx.fillStyle = '#e0b14a'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; NT.Minifig.poly(ctx, [-18, -28, 26, 0, -18, 28]); ctx.fill(); ctx.stroke(); ctx.restore(); },
    back(ctx) { // return arrow (curved)
      ctx.save(); ctx.strokeStyle = '#e0b14a'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-20, -4); ctx.lineTo(14, -4); ctx.quadraticCurveTo(28, -4, 28, 10); ctx.quadraticCurveTo(28, 24, 14, 24); ctx.lineTo(0, 24); ctx.stroke();
      ctx.fillStyle = '#e0b14a'; NT.Minifig.poly(ctx, [-34, -4, -14, -22, -14, 14]); ctx.fill();
      ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    },
    restart(ctx) {
      ctx.save(); ctx.strokeStyle = '#e0b14a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, 24, -1.2, 4.2); ctx.stroke();
      ctx.fillStyle = '#e0b14a'; ctx.save(); ctx.translate(Math.cos(-1.2) * 24, Math.sin(-1.2) * 24); ctx.rotate(-1.2 + Math.PI / 2 + 0.3); NT.Minifig.poly(ctx, [-12, 0, 12, 0, 0, -16]); ctx.fill(); ctx.restore();
      ctx.restore();
    },
    pause(ctx) { ctx.save(); ctx.fillStyle = '#e0b14a'; NT.Minifig.rr(ctx, -16, -22, 11, 44, 3); ctx.fill(); NT.Minifig.rr(ctx, 5, -22, 11, 44, 3); ctx.fill(); ctx.restore(); },
    arrowL(ctx) { ctx.save(); ctx.fillStyle = '#e0b14a'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; NT.Minifig.poly(ctx, [-28, 0, 0, -26, 0, 26]); ctx.fill(); ctx.stroke(); NT.Minifig.poly(ctx, [0, 0, 28, -26, 28, 26]); ctx.fill(); ctx.stroke(); ctx.restore(); },
    arrowR(ctx) { ctx.save(); ctx.scale(-1, 1); Icons.arrowL(ctx); ctx.restore(); },
    lock(ctx) { ctx.save(); ctx.fillStyle = '#e0b14a'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; NT.Minifig.rr(ctx, -22, -4, 44, 34, 6); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#e0b14a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, -8, 14, Math.PI, U.TAU); ctx.stroke(); ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, -8, 17.5, Math.PI, U.TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -8, 10.5, Math.PI, U.TAU); ctx.stroke(); ctx.fillStyle = '#2a1408'; ctx.beginPath(); ctx.arc(0, 10, 5, 0, U.TAU); ctx.fill(); ctx.restore(); },
    check(ctx) { ctx.save(); ctx.strokeStyle = '#6fe06f'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-24, 2); ctx.lineTo(-6, 20); ctx.lineTo(26, -20); ctx.stroke(); ctx.restore(); },
    cross(ctx) { ctx.save(); ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-20, -20); ctx.lineTo(20, 20); ctx.moveTo(20, -20); ctx.lineTo(-20, 20); ctx.stroke(); ctx.restore(); },
    music(ctx) { ctx.save(); ctx.fillStyle = '#e0b14a'; ctx.strokeStyle = '#e0b14a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-8, 16); ctx.lineTo(-8, -24); ctx.lineTo(24, -30); ctx.lineTo(24, 10); ctx.stroke(); ctx.beginPath(); ctx.ellipse(-16, 18, 10, 7, -0.3, 0, U.TAU); ctx.ellipse(16, 12, 10, 7, -0.3, 0, U.TAU); ctx.fill(); ctx.restore(); },
    speaker(ctx) { ctx.save(); ctx.fillStyle = '#e0b14a'; NT.Minifig.poly(ctx, [-28, -10, -14, -10, 2, -26, 2, 26, -14, 10, -28, 10]); ctx.fill(); ctx.strokeStyle = '#e0b14a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(4, 0, 14, -0.9, 0.9); ctx.stroke(); ctx.beginPath(); ctx.arc(4, 0, 24, -0.9, 0.9); ctx.stroke(); ctx.restore(); },
    home(ctx) { ctx.save(); ctx.fillStyle = '#e0b14a'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; NT.Minifig.poly(ctx, [-32, 0, 0, -30, 32, 0, 22, 0, 22, 28, -22, 28, -22, 0]); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#3b2382'; ctx.fillRect(-7, 8, 14, 20); ctx.restore(); },
    star(ctx) { ctx.save(); ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * U.TAU, r = i % 2 ? 14 : 32; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); },
    xp(ctx) { ctx.save(); ctx.fillStyle = '#8a63ff'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (i / 8) * U.TAU, r = i % 2 ? 16 : 32; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke(); text(ctx, 'XP', 0, 1, { size: 20, color: '#fff', stroke: '#2a1408', strokeWidth: 3 }); ctx.restore(); },
    question(ctx) { ctx.save(); goldText(ctx, '?', 0, 2, 64); ctx.restore(); },
    keyboard(ctx) { ctx.save(); ctx.fillStyle = '#e0b14a'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2.5; NT.Minifig.rr(ctx, -34, -18, 68, 36, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#3b2382'; for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) ctx.fillRect(-28 + c * 10, -12 + r * 10, 7, 7); ctx.fillRect(-20, 8, 40, 5); ctx.restore(); },
  };
  function starburst(ctx, x, y, r, n) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#ffe14a'; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * U.TAU, rr = i % 2 ? r * 0.45 : r * (0.8 + ((i * 7) % 3) * 0.12); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  function heartPath(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.45);
    ctx.bezierCurveTo(x - s * 0.1, y + s * 0.35, x - s * 0.55, y + s * 0.05, x - s * 0.55, y - s * 0.2);
    ctx.bezierCurveTo(x - s * 0.55, y - s * 0.5, x - s * 0.15, y - s * 0.55, x, y - s * 0.28);
    ctx.bezierCurveTo(x + s * 0.15, y - s * 0.55, x + s * 0.55, y - s * 0.5, x + s * 0.55, y - s * 0.2);
    ctx.bezierCurveTo(x + s * 0.55, y + s * 0.05, x + s * 0.1, y + s * 0.35, x, y + s * 0.45);
    ctx.closePath();
  }
  // heart with fractional fill (for HUD)
  function heart(ctx, x, y, s, frac) {
    ctx.save();
    heartPath(ctx, x, y, s); ctx.fillStyle = '#4a1010'; ctx.fill();
    if (frac > 0) { ctx.save(); heartPath(ctx, x, y, s); ctx.clip(); const top = y - s * 0.55, bot = y + s * 0.45; ctx.fillStyle = '#ee2530'; ctx.fillRect(x - s, bot - (bot - top) * frac, s * 2, (bot - top) * frac + 1); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.ellipse(x - s * 0.26, y - s * 0.3, s * 0.15, s * 0.09, -0.6, 0, U.TAU); ctx.fill(); ctx.restore(); }
    heartPath(ctx, x, y, s); ctx.strokeStyle = '#2a0808'; ctx.lineWidth = Math.max(2, s * 0.08); ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }

  // ---------- UILayer: button management ----------
  class UILayer {
    constructor() { this.buttons = []; this.enabled = true; }
    add(b) { b.press = 0; b.pressed = false; b.ptr = null; b.visible = b.visible !== false; b.enabled = b.enabled !== false; this.buttons.push(b); return b; }
    get(id) { return this.buttons.find((b) => b.id === id); }
    clear() { this.buttons.length = 0; }
    hit(b, x, y) {
      if (!b.visible || !b.enabled) return false;
      if (b.shape === 'rect') return x >= b.x - b.w / 2 && x <= b.x + b.w / 2 && y >= b.y - b.h / 2 && y <= b.y + b.h / 2;
      const r = (b.r || 40) * (b.hitScale || 1.15);
      return (x - b.x) ** 2 + (y - b.y) ** 2 <= r * r;
    }
    onPointerDown(p) {
      if (!this.enabled) return false;
      for (let i = this.buttons.length - 1; i >= 0; i--) {
        const b = this.buttons[i];
        if (this.hit(b, p.x, p.y)) {
          b.pressed = true; b.ptr = p.id; p.target = b;
          if (b.onDown) b.onDown(p);
          if (!b.silent) NT.Audio.play('click');
          return true;
        }
      }
      return false;
    }
    onPointerMove(p) {
      for (const b of this.buttons) if (b.ptr === p.id) { const inside = this.hit(b, p.x, p.y); if (b.onDrag) b.onDrag(p, inside); if (!b.sticky) b.pressed = inside; return true; }
      return false;
    }
    onPointerUp(p) {
      for (const b of this.buttons) if (b.ptr === p.id) {
        b.ptr = null; const inside = this.hit(b, p.x, p.y); b.pressed = false;
        if (b.onUp) b.onUp(p, inside);
        if (inside && b.onTap && !NT.SceneManager.transitioning) b.onTap(p);
        return true;
      }
      return false;
    }
    update(dt) { for (const b of this.buttons) b.press = U.damp(b.press, b.pressed ? 1 : 0, 25, dt); }
    render(ctx) { for (const b of this.buttons) if (b.visible && b.draw) b.draw(ctx, b); }
    releaseAll() { for (const b of this.buttons) { b.ptr = null; b.pressed = false; } }
  }

  return { FONT, GOLD, GOLD_L, GOLD_D, PURPLE, PURPLE_D, PURPLE_L, INK, font, text, goldText, measure, goldRing, roundButton, pillButton, scroll, goldFrame, panel, bar, medallion, menuBackground, Icons, starburst, heart, heartPath, UILayer };
})();
