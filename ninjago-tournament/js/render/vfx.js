/* ============================================================
   NT.VFX — particle & effect system (world-space, projected)
   ============================================================ */
NT.VFX = class VFX {
  constructor() { this.ground = []; this.air = []; this.max = 420; }
  clear() { this.ground.length = 0; this.air.length = 0; }
  add(p) {
    const arr = p.layer === 'ground' ? this.ground : this.air;
    if (arr.length >= this.max) arr.shift();
    p.t = 0; p.life = p.life || 0.5; p.y = p.y || 0; p.vx = p.vx || 0; p.vy = p.vy || 0; p.vz = p.vz || 0; p.g = p.g == null ? 0 : p.g;
    arr.push(p); return p;
  }
  // ---- helpers for common effects ----
  sparks(x, y, z, n, color, speed = 260) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random()); this.add({ type: 'spark', x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s * 0.6, vy: 120 + Math.random() * 220, g: 900, life: 0.25 + Math.random() * 0.3, size: 3 + Math.random() * 3, color }); }
  }
  star(x, y, z, size = 40, color = '#ffe14a') { this.add({ type: 'star', x, y, z, size, color, life: 0.22, rot: Math.random() * 6 }); }
  flash(x, y, z, size, color) { this.add({ type: 'flash', x, y, z, size, color, life: 0.15 }); }
  dust(x, z, n = 4, size = 24, color = '#b8b0a0') { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 90; this.add({ type: 'puff', layer: 'air', x, y: 4, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s * 0.6, vy: 20 + Math.random() * 30, g: -20, life: 0.4 + Math.random() * 0.3, size: size * (0.6 + Math.random() * 0.6), color }); } }
  ring(x, z, radius, color, life = 0.45, width = 8) { this.add({ type: 'ring', layer: 'ground', x, y: 0, z, radius, color, life, width }); }
  shockwave(x, z, radius, color) { this.ring(x, z, radius, color, 0.5, 14); this.ring(x, z, radius * 0.6, '#ffffff', 0.3, 6); this.dust(x, z, 10, 34); }
  smoke(x, y, z, n = 6, color = '#6a6a6a') { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 60; this.add({ type: 'puff', x, y: y + Math.random() * 30, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s * 0.5, vy: 40 + Math.random() * 50, g: -30, life: 0.6 + Math.random() * 0.5, size: 26 + Math.random() * 20, color }); } }
  element(el, x, y, z, n = 6) {
    const E = NT.Elements[el] || NT.Elements.energy;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 160;
      switch (el) {
        case 'fire': case 'amber': this.add({ type: 'flame', x, y: y + Math.random() * 20, z, vx: Math.cos(a) * s * 0.6, vz: Math.sin(a) * s * 0.4, vy: 140 + Math.random() * 120, g: 40, life: 0.4 + Math.random() * 0.35, size: 12 + Math.random() * 12, color: i % 2 ? E.c1 : E.c2 }); break;
        case 'ice': case 'water': this.add({ type: 'shard', x, y: y + 10, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s * 0.6, vy: 120 + Math.random() * 160, g: 600, life: 0.5 + Math.random() * 0.3, size: 8 + Math.random() * 8, color: i % 2 ? E.c1 : E.c2, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12 }); break;
        case 'lightning': case 'tech': case 'sound': this.add({ type: 'bolt', x, y: y + 20, z, x2: x + Math.cos(a) * (40 + Math.random() * 70), y2: y + Math.random() * 60, z2: z + Math.sin(a) * 40, color: i % 2 ? E.c1 : E.c2, life: 0.12 + Math.random() * 0.12, width: 2 + Math.random() * 2 }); break;
        case 'earth': case 'stone': case 'metal': case 'brown': this.add({ type: 'rock', x, y: y + 5, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s * 0.6, vy: 160 + Math.random() * 200, g: 900, life: 0.6 + Math.random() * 0.4, size: 6 + Math.random() * 8, color: i % 2 ? E.c1 : NT.Util.shade(E.c1, -0.3), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 }); break;
        case 'smoke': case 'shadow': this.smoke(x, y, z, 2, E.c1); break;
        default: this.add({ type: 'orb', x, y: y + 15 + Math.random() * 20, z, vx: Math.cos(a) * s * 0.7, vz: Math.sin(a) * s * 0.5, vy: 60 + Math.random() * 100, g: -60, life: 0.45 + Math.random() * 0.3, size: 5 + Math.random() * 7, color: i % 2 ? E.c1 : E.c2 });
      }
    }
  }
  // LEGO break-apart: parts fly off with physics
  breakApart(fighter) {
    const look = fighter.look;
    const parts = ['head', 'torso', 'legs', 'armL', 'armR']; if (look.weapon && look.weapon !== 'none') parts.push('weapon');
    for (const part of parts) {
      const c = NT.Minifig.PART_CENTER[part]; const a = Math.random() * Math.PI * 2, s = 120 + Math.random() * 200;
      this.add({ type: 'part', x: fighter.x + c[0] * 0.3, y: -c[1] * look.scale * 0.9, z: fighter.z + 2, vx: Math.cos(a) * s, vz: Math.sin(a) * s * 0.5, vy: 260 + Math.random() * 260, g: 1100, life: 1.6, size: look.scale, look, part, rot: 0, vr: (Math.random() - 0.5) * 16, facing: fighter.facing, bounced: false });
    }
    this.sparks(fighter.x, 30, fighter.z, 8, '#ffffff', 200);
  }
  floatText(x, y, z, str, color = '#ffe14a', size = 22) { this.add({ type: 'text', x, y: y + 40, z, vy: 60, g: -40, life: 0.9, str, color, size }); }

  update(dt) {
    for (const arr of [this.ground, this.air]) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.t += dt;
        if (p.t >= p.life) { arr.splice(i, 1); continue; }
        if (p.type === 'bolt' || p.type === 'ring' || p.type === 'star' || p.type === 'flash') continue;
        p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0 && (p.type === 'part' || p.type === 'rock' || p.type === 'shard')) {
          p.y = 0; p.vy = -p.vy * 0.35; p.vx *= 0.6; p.vz *= 0.6; p.vr *= 0.5;
          if (!p.bounced) { p.bounced = true; if (p.type === 'part') NT.Audio.play('step', { minGap: 60 }); }
        } else if (p.y < 0) { p.y = 0; p.vy = 0; }
        if (p.vr) p.rot += p.vr * dt;
      }
    }
  }
  renderGround(ctx, cam) { for (const p of this.ground) this.drawOne(ctx, cam, p); }
  renderAir(ctx, cam) { for (const p of this.air) this.drawOne(ctx, cam, p); }
  drawOne(ctx, cam, p) {
    const s = cam.project(p.x, p.y, p.z); const k = s.k; const life = p.t / p.life; const rem = 1 - life;
    ctx.save();
    switch (p.type) {
      case 'spark': { ctx.globalAlpha = rem; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(s.x, s.y, p.size * k * (0.5 + rem * 0.5), 0, 6.283); ctx.fill(); break; }
      case 'orb': { ctx.globalAlpha = rem; ctx.shadowColor = p.color; ctx.shadowBlur = 10 * k; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(s.x, s.y, p.size * k * rem, 0, 6.283); ctx.fill(); break; }
      case 'flame': { ctx.globalAlpha = rem * 0.9; const r = p.size * k * (0.4 + rem * 0.6); const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r); g.addColorStop(0, '#fff6b0'); g.addColorStop(0.4, p.color); g.addColorStop(1, 'rgba(255,80,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * 1.3, 0, 0, 6.283); ctx.fill(); break; }
      case 'puff': { ctx.globalAlpha = rem * 0.55; const r = p.size * k * (0.5 + life * 0.8); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.283); ctx.fill(); ctx.globalAlpha = rem * 0.25; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(s.x - r * 0.3, s.y - r * 0.3, r * 0.5, 0, 6.283); ctx.fill(); break; }
      case 'shard': { ctx.globalAlpha = rem; ctx.translate(s.x, s.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; const r = p.size * k; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.5, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.5, 0); ctx.closePath(); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1; ctx.stroke(); break; }
      case 'rock': { ctx.globalAlpha = Math.min(1, rem * 2); ctx.translate(s.x, s.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; const r = p.size * k; ctx.beginPath(); ctx.moveTo(-r, -r * 0.6); ctx.lineTo(r * 0.3, -r); ctx.lineTo(r, 0); ctx.lineTo(r * 0.4, r * 0.9); ctx.lineTo(-r * 0.7, r * 0.6); ctx.closePath(); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-r * 0.5, -r * 0.6, r * 0.6, r * 0.3); break; }
      case 'bolt': { const s2 = cam.project(p.x2, p.y2, p.z2); ctx.globalAlpha = rem; ctx.strokeStyle = p.color; ctx.lineWidth = p.width * k; ctx.shadowColor = p.color; ctx.shadowBlur = 8 * k; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(s.x, s.y); const segs = 4; for (let i = 1; i <= segs; i++) { const t = i / segs; const jx = (i < segs ? (Math.random() - 0.5) * 18 * k : 0); const jy = (i < segs ? (Math.random() - 0.5) * 18 * k : 0); ctx.lineTo(s.x + (s2.x - s.x) * t + jx, s.y + (s2.y - s.y) * t + jy); } ctx.stroke(); break; }
      case 'ring': { const r = p.radius * k * NT.Util.ease.outCubic(life); ctx.globalAlpha = rem * 0.9; ctx.strokeStyle = p.color; ctx.lineWidth = p.width * k * rem; ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * (cam.H / cam.L), 0, 0, 6.283); ctx.stroke(); break; }
      case 'star': { const sc = NT.Util.ease.outBack(Math.min(1, life * 2)) * (1 - Math.max(0, life - 0.6) * 2.5); ctx.translate(s.x, s.y); ctx.rotate(p.rot); ctx.scale(sc * k * p.size / 30, sc * k * p.size / 30); ctx.fillStyle = p.color; ctx.strokeStyle = '#2a1408'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283, rr = i % 2 ? 14 : 30 + ((i * 5) % 3) * 5; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 6.283); ctx.fill(); break; }
      case 'flash': { ctx.globalAlpha = rem * 0.8; ctx.globalCompositeOperation = 'lighter'; const r = p.size * k * (0.6 + life); const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, p.color); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.283); ctx.fill(); break; }
      case 'part': { ctx.globalAlpha = Math.min(1, rem * 3); ctx.translate(s.x, s.y); ctx.rotate(p.rot); const sc = k * p.size; ctx.scale(sc, sc); const c = NT.Minifig.PART_CENTER[p.part]; ctx.translate(-c[0], -c[1]); NT.Minifig.draw(ctx, p.look, {}, { facing: p.facing, only: p.part }); break; }
      case 'text': { ctx.globalAlpha = rem; NT.UI.goldText(ctx, p.str, s.x, s.y, p.size * Math.max(0.6, k), { mid: p.color }); break; }
    }
    ctx.restore();
  }
};
