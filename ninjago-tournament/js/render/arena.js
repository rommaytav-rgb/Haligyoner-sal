/* ============================================================
   NT.ArenaRenderer — floor texture (world-space, pre-rendered),
   perspective strip rendering, sky/backdrop, decor billboards.
   ============================================================ */
NT.ArenaRenderer = class ArenaRenderer {
  constructor(def) {
    this.def = def;
    this.ts = 0.7; // texels per world unit
    this.margin = 420;
    const b = this.bounds();
    this.ox = b.x0; this.oz = b.z0;
    this.texW = Math.round((b.x1 - b.x0) * this.ts); this.texH = Math.round((b.z1 - b.z0) * this.ts);
    this.tex = NT.Util.makeCanvas(this.texW, this.texH);
    this.buildFloor();
    this.ambientT = 0;
  }
  bounds() {
    const d = this.def, m = this.margin;
    if (d.shape === 'circle') return { x0: -d.radius - m, x1: d.radius + m, z0: -d.radius - m, z1: d.radius + m };
    return { x0: -d.w / 2 - m, x1: d.w / 2 + m, z0: -d.h / 2 - m, z1: d.h / 2 + m };
  }
  inside(x, z, pad = 0) {
    const d = this.def;
    if (d.shape === 'circle') return Math.hypot(x, z) <= d.radius - pad;
    return Math.abs(x) <= d.w / 2 - pad && Math.abs(z) <= d.h / 2 - pad;
  }
  clamp(e, pad) {
    const d = this.def;
    if (d.shape === 'circle') { const r = Math.hypot(e.x, e.z), m = d.radius - pad; if (r > m) { e.x *= m / r; e.z *= m / r; return true; } return false; }
    let hit = false;
    const mx = d.w / 2 - pad, mz = d.h / 2 - pad;
    if (e.x > mx) { e.x = mx; hit = true; } if (e.x < -mx) { e.x = -mx; hit = true; }
    if (e.z > mz) { e.z = mz; hit = true; } if (e.z < -mz) { e.z = -mz; hit = true; }
    return hit;
  }
  randomPointOnEdge(inset = 40) {
    const d = this.def, a = Math.random() * Math.PI * 2;
    if (d.shape === 'circle') { const r = d.radius - inset; return { x: Math.cos(a) * r, z: Math.sin(a) * r }; }
    return { x: Math.cos(a) * (d.w / 2 - inset), z: Math.sin(a) * (d.h / 2 - inset) };
  }

  // ---------------- FLOOR TEXTURE ----------------
  buildFloor() {
    const c = this.tex.getContext('2d'); const d = this.def; const ts = this.ts; const U = NT.Util;
    const rng = U.seeded(hash(d.id));
    const W = this.texW, H = this.texH;
    const w2s = (x, z) => [(x - this.ox) * ts, (z - this.oz) * ts];
    c.save(); c.scale(ts, ts); c.translate(-this.ox, -this.oz); // draw in world units
    const R = d.radius || 0;
    switch (d.floor) {
      case 'stone_rings': case 'stone_rings_dark': {
        const dark = d.floor === 'stone_rings_dark';
        // outer ground: arena stands (tiers)
        c.fillStyle = dark ? '#1a1024' : '#1e2226'; c.fillRect(this.ox, this.oz, W / ts, H / ts);
        for (let i = 0; i < 6; i++) { const rr = R + 30 + i * 62; c.fillStyle = i % 2 ? (dark ? '#2a1a3a' : '#2e3438') : (dark ? '#241530' : '#282d31'); c.beginPath(); c.arc(0, 0, rr + 62, 0, U.TAU); c.arc(0, 0, rr, 0, U.TAU, true); c.fill();
          // crowd dots
          for (let j = 0; j < 90; j++) { const a = rng() * U.TAU, r2 = rr + 8 + rng() * 46; c.fillStyle = U.pick(dark ? ['#4a2a6a', '#3a2050', '#6a3a8a', '#5a2a5a'] : ['#4a5a6a', '#6a5a4a', '#5a4a6a', '#3a4a5a', '#7a6a5a']); c.beginPath(); c.arc(Math.cos(a) * r2, Math.sin(a) * r2, 4 + rng() * 3, 0, U.TAU); c.fill(); } }
        // arena rim
        c.fillStyle = dark ? '#3a2a4a' : '#4a5258'; c.beginPath(); c.arc(0, 0, R + 30, 0, U.TAU); c.fill();
        c.fillStyle = dark ? '#2a1e38' : '#353c42'; c.beginPath(); c.arc(0, 0, R + 12, 0, U.TAU); c.fill();
        // floor base
        const base = dark ? '#4e4a5c' : '#606b73';
        c.fillStyle = base; c.beginPath(); c.arc(0, 0, R, 0, U.TAU); c.fill();
        // ring tiles
        const ringW = 68; const grout = dark ? '#2a2334' : '#3b4349';
        for (let ri = 0; ri * ringW < R; ri++) {
          const r0 = ri * ringW, r1 = Math.min(R, (ri + 1) * ringW);
          const sectors = ri === 0 ? 1 : Math.max(8, Math.round((r0 + ringW / 2) * U.TAU / 95));
          for (let si = 0; si < sectors; si++) {
            const a0 = (si / sectors) * U.TAU, a1 = ((si + 1) / sectors) * U.TAU;
            c.beginPath(); c.arc(0, 0, r1, a0, a1); c.arc(0, 0, r0, a1, a0, true); c.closePath();
            const v = (rng() - 0.5) * 0.12; c.fillStyle = U.shade(base, v); c.fill();
            c.strokeStyle = grout; c.lineWidth = 3; c.stroke();
          }
        }
        // meander pattern along ring centers
        c.strokeStyle = dark ? 'rgba(180,140,220,0.35)' : 'rgba(170,150,110,0.55)'; c.lineWidth = 4; c.lineCap = 'butt';
        for (let ri = 1; ri * ringW < R; ri += 1) {
          const rc = ri * ringW + ringW / 2 - 6; const period = 30; const n = Math.round(rc * U.TAU / period);
          c.beginPath();
          for (let i = 0; i < n; i++) { const a = (i / n) * U.TAU, a2 = ((i + 0.5) / n) * U.TAU, a3 = ((i + 1) / n) * U.TAU; const ra = rc - 10, rb = rc + 10;
            c.moveTo(Math.cos(a) * ra, Math.sin(a) * ra); c.lineTo(Math.cos(a) * rb, Math.sin(a) * rb); c.lineTo(Math.cos(a2) * rb, Math.sin(a2) * rb); c.lineTo(Math.cos(a2) * rc, Math.sin(a2) * rc); c.lineTo(Math.cos(a3) * rc, Math.sin(a3) * rc); c.lineTo(Math.cos(a3) * ra, Math.sin(a3) * ra); }
          c.stroke();
        }
        // central medallion
        c.strokeStyle = dark ? 'rgba(200,160,255,0.45)' : 'rgba(190,170,120,0.6)'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 56, 0, U.TAU); c.stroke();
        c.beginPath(); for (let a = 0; a < U.TAU * 3; a += 0.15) { const r = 8 + a * 2.4; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.stroke();
        // grime / noise
        for (let i = 0; i < 1400; i++) { const a = rng() * U.TAU, r = Math.sqrt(rng()) * R; c.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.07)'; c.fillRect(Math.cos(a) * r, Math.sin(a) * r, 2 + rng() * 6, 1 + rng() * 3); }
        // vignette toward edge
        const vg = c.createRadialGradient(0, 0, R * 0.55, 0, 0, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, dark ? 'rgba(20,0,40,0.55)' : 'rgba(0,0,0,0.45)'); c.fillStyle = vg; c.beginPath(); c.arc(0, 0, R, 0, U.TAU); c.fill();
        if (dark) { const pg = c.createRadialGradient(0, 0, 0, 0, 0, R); pg.addColorStop(0, 'rgba(140,60,255,0.18)'); pg.addColorStop(1, 'rgba(140,60,255,0)'); c.fillStyle = pg; c.beginPath(); c.arc(0, 0, R, 0, U.TAU); c.fill(); }
        break;
      }
      case 'wood': {
        c.fillStyle = '#2a1008'; c.fillRect(this.ox, this.oz, W / ts, H / ts);
        const w = d.w, h = d.h;
        // outer deck (dark planks)
        c.fillStyle = '#4a2410'; c.fillRect(-w / 2 - 120, -h / 2 - 120, w + 240, h + 240);
        for (let x = -w / 2 - 120; x < w / 2 + 120; x += 34) { c.fillStyle = `rgba(0,0,0,${0.15 + rng() * 0.15})`; c.fillRect(x, -h / 2 - 120, 3, h + 240); }
        // main floor tiles (warm orange wood, like the dojo)
        const tile = 150;
        for (let x = -w / 2; x < w / 2; x += tile) for (let z = -h / 2; z < h / 2; z += tile) {
          const tw = Math.min(tile, w / 2 - x), th = Math.min(tile, h / 2 - z);
          c.fillStyle = U.shade('#c47a30', (rng() - 0.5) * 0.18); c.fillRect(x, z, tw, th);
          c.strokeStyle = '#5a2a10'; c.lineWidth = 5; c.strokeRect(x, z, tw, th);
          // grain
          c.strokeStyle = 'rgba(90,40,10,0.35)'; c.lineWidth = 1.5;
          for (let i = 0; i < 6; i++) { const gy = z + 12 + i * (th / 6); c.beginPath(); c.moveTo(x + 6, gy); c.bezierCurveTo(x + tw * 0.3, gy + (rng() - 0.5) * 12, x + tw * 0.7, gy + (rng() - 0.5) * 12, x + tw - 6, gy); c.stroke(); }
        }
        // border trim
        c.strokeStyle = '#e0b14a'; c.lineWidth = 6; c.strokeRect(-w / 2, -h / 2, w, h);
        c.strokeStyle = '#8a1a1a'; c.lineWidth = 14; c.strokeRect(-w / 2 - 14, -h / 2 - 14, w + 28, h + 28);
        const vg = c.createRadialGradient(0, 0, Math.min(w, h) * 0.3, 0, 0, Math.max(w, h) * 0.75); vg.addColorStop(0, 'rgba(255,160,60,0.12)'); vg.addColorStop(1, 'rgba(40,10,0,0.55)'); c.fillStyle = vg; c.fillRect(-w / 2 - 120, -h / 2 - 120, w + 240, h + 240);
        break;
      }
      case 'mossy': {
        c.fillStyle = '#0c1a10'; c.fillRect(this.ox, this.oz, W / ts, H / ts);
        // jungle floor outside: dark green with leaves
        for (let i = 0; i < 900; i++) { const a = rng() * U.TAU, r = R + 10 + rng() * 380; c.fillStyle = U.pick(['#183a22', '#1f4a2a', '#123018', '#2a5a30']); c.beginPath(); c.ellipse(Math.cos(a) * r, Math.sin(a) * r, 14 + rng() * 18, 8 + rng() * 10, rng() * 3, 0, U.TAU); c.fill(); }
        c.fillStyle = '#4a5a48'; c.beginPath(); c.arc(0, 0, R + 6, 0, U.TAU); c.fill();
        c.fillStyle = '#6a7466'; c.beginPath(); c.arc(0, 0, R, 0, U.TAU); c.fill();
        // cobblestones
        for (let i = 0; i < 2200; i++) { const a = rng() * U.TAU, r = Math.sqrt(rng()) * (R - 8); const sw = 22 + rng() * 26, sh = 16 + rng() * 18; c.fillStyle = U.shade('#7a8478', (rng() - 0.5) * 0.3); c.beginPath(); c.ellipse(Math.cos(a) * r, Math.sin(a) * r, sw / 2, sh / 2, rng() * 3, 0, U.TAU); c.fill(); c.strokeStyle = 'rgba(30,40,30,0.5)'; c.lineWidth = 2; c.stroke(); }
        // moss patches
        for (let i = 0; i < 160; i++) { const a = rng() * U.TAU, r = Math.sqrt(rng()) * R; c.fillStyle = `rgba(60,140,60,${0.25 + rng() * 0.3})`; c.beginPath(); c.ellipse(Math.cos(a) * r, Math.sin(a) * r, 20 + rng() * 40, 12 + rng() * 26, rng() * 3, 0, U.TAU); c.fill(); }
        // carved ruin circle
        c.strokeStyle = 'rgba(200,190,140,0.35)'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 150, 0, U.TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 90, 0, U.TAU); c.stroke();
        const vg = c.createRadialGradient(0, 0, R * 0.5, 0, 0, R); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,20,0,0.5)'); c.fillStyle = vg; c.beginPath(); c.arc(0, 0, R, 0, U.TAU); c.fill();
        break;
      }
      case 'rock': {
        c.fillStyle = '#140604'; c.fillRect(this.ox, this.oz, W / ts, H / ts);
        for (let i = 0; i < 700; i++) { const a = rng() * U.TAU, r = R + rng() * 400; c.fillStyle = U.pick(['#2a0e08', '#3a140a', '#1e0a06']); c.beginPath(); c.ellipse(Math.cos(a) * r, Math.sin(a) * r, 30 + rng() * 40, 20 + rng() * 30, rng() * 3, 0, U.TAU); c.fill(); }
        c.fillStyle = '#4a2a20'; c.beginPath(); c.arc(0, 0, R + 8, 0, U.TAU); c.fill();
        c.fillStyle = '#5a3a2a'; c.beginPath(); c.arc(0, 0, R, 0, U.TAU); c.fill();
        for (let i = 0; i < 1800; i++) { const a = rng() * U.TAU, r = Math.sqrt(rng()) * R; c.fillStyle = U.shade('#5e3d2c', (rng() - 0.5) * 0.35); c.beginPath(); c.ellipse(Math.cos(a) * r, Math.sin(a) * r, 18 + rng() * 30, 12 + rng() * 20, rng() * 3, 0, U.TAU); c.fill(); }
        // lava cracks
        c.lineCap = 'round';
        for (let i = 0; i < 14; i++) { let x = Math.cos(rng() * U.TAU) * R * 0.8, z = Math.sin(rng() * U.TAU) * R * 0.8; c.beginPath(); c.moveTo(x, z); for (let j = 0; j < 8; j++) { x += (rng() - 0.5) * 90; z += (rng() - 0.5) * 90; c.lineTo(x, z); } c.strokeStyle = 'rgba(255,90,20,0.25)'; c.lineWidth = 14; c.stroke(); c.strokeStyle = '#ff7a2a'; c.lineWidth = 3; c.stroke(); c.strokeStyle = '#ffd08a'; c.lineWidth = 1; c.stroke(); }
        const vg = c.createRadialGradient(0, 0, R * 0.4, 0, 0, R); vg.addColorStop(0, 'rgba(255,80,0,0.08)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)'); c.fillStyle = vg; c.beginPath(); c.arc(0, 0, R, 0, U.TAU); c.fill();
        break;
      }
      case 'darkstone': {
        const w = d.w, h = d.h;
        c.fillStyle = '#0a0612'; c.fillRect(this.ox, this.oz, W / ts, H / ts);
        c.fillStyle = '#1c1428'; c.fillRect(-w / 2 - 100, -h / 2 - 100, w + 200, h + 200);
        const tile = 130;
        for (let x = -w / 2; x < w / 2; x += tile) for (let z = -h / 2; z < h / 2; z += tile) {
          c.fillStyle = U.shade('#3a3446', (rng() - 0.5) * 0.2); c.fillRect(x, z, tile, tile);
          c.strokeStyle = '#151020'; c.lineWidth = 4; c.strokeRect(x, z, tile, tile);
          if (rng() < 0.22) { c.strokeStyle = 'rgba(160,90,255,0.6)'; c.lineWidth = 3; c.lineCap = 'round'; const cx = x + tile / 2, cz = z + tile / 2; c.beginPath(); c.moveTo(cx - 25, cz - 25); c.lineTo(cx + 25, cz + 25); c.moveTo(cx + 25, cz - 25); c.lineTo(cx - 10, cz + 10); c.moveTo(cx - 30, cz + 5); c.lineTo(cx + 30, cz + 5); c.stroke(); }
        }
        // central seal
        c.strokeStyle = 'rgba(180,100,255,0.5)'; c.lineWidth = 8; c.beginPath(); c.arc(0, 0, 160, 0, U.TAU); c.stroke(); c.lineWidth = 4; c.beginPath(); c.arc(0, 0, 110, 0, U.TAU); c.stroke();
        for (let i = 0; i < 4; i++) { const a = (i / 4) * U.TAU + Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(a) * 110, Math.sin(a) * 110); c.lineTo(Math.cos(a) * 160, Math.sin(a) * 160); c.stroke(); }
        c.strokeStyle = '#6a4a8a'; c.lineWidth = 12; c.strokeRect(-w / 2 - 12, -h / 2 - 12, w + 24, h + 24);
        const vg = c.createRadialGradient(0, 0, 100, 0, 0, Math.max(w, h) * 0.7); vg.addColorStop(0, 'rgba(140,60,255,0.12)'); vg.addColorStop(1, 'rgba(0,0,10,0.6)'); c.fillStyle = vg; c.fillRect(-w / 2 - 100, -h / 2 - 100, w + 200, h + 200);
        break;
      }
      case 'metal': {
        const w = d.w, h = d.h;
        c.fillStyle = '#05070f'; c.fillRect(this.ox, this.oz, W / ts, H / ts);
        c.fillStyle = '#2a2f3a'; c.fillRect(-w / 2 - 60, -h / 2 - 60, w + 120, h + 120);
        const tile = 120;
        for (let x = -w / 2; x < w / 2; x += tile) for (let z = -h / 2; z < h / 2; z += tile) {
          c.fillStyle = U.shade('#4a525e', (rng() - 0.5) * 0.18); c.fillRect(x, z, tile, tile);
          c.strokeStyle = '#1f242c'; c.lineWidth = 4; c.strokeRect(x, z, tile, tile);
          c.fillStyle = '#7a8290'; for (const [rx, rz] of [[10, 10], [tile - 10, 10], [10, tile - 10], [tile - 10, tile - 10]]) { c.beginPath(); c.arc(x + rx, z + rz, 4, 0, U.TAU); c.fill(); }
        }
        // hazard stripes on edges
        c.save(); c.beginPath(); c.rect(-w / 2, -h / 2, w, 40); c.rect(-w / 2, h / 2 - 40, w, 40); c.clip();
        for (let x = -w / 2 - 40; x < w / 2 + 40; x += 60) { c.fillStyle = '#e8c02a'; c.beginPath(); c.moveTo(x, -h / 2); c.lineTo(x + 30, -h / 2); c.lineTo(x - 10, h / 2); c.lineTo(x - 40, h / 2); c.closePath(); c.fill(); }
        c.restore();
        // helipad-style circle
        c.strokeStyle = 'rgba(232,192,42,0.55)'; c.lineWidth = 14; c.beginPath(); c.arc(0, 0, 170, 0, U.TAU); c.stroke();
        c.fillStyle = 'rgba(232,192,42,0.5)'; c.fillRect(-60, -12, 120, 24);
        c.strokeStyle = '#e8c02a'; c.lineWidth = 8; c.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
        const vg = c.createRadialGradient(0, 0, 100, 0, 0, Math.max(w, h) * 0.75); vg.addColorStop(0, 'rgba(120,180,255,0.08)'); vg.addColorStop(1, 'rgba(0,0,10,0.6)'); c.fillStyle = vg; c.fillRect(-w / 2 - 60, -h / 2 - 60, w + 120, h + 120);
        break;
      }
    }
    c.restore();
    // ground decals from decor (lava pools, bones)
    c.save(); c.scale(ts, ts); c.translate(-this.ox, -this.oz);
    for (const dc of d.decor) {
      if (dc.type === 'lava') { const g = c.createRadialGradient(dc.x, dc.z, 10, dc.x, dc.z, 90); g.addColorStop(0, '#ffd070'); g.addColorStop(0.4, '#ff6a1a'); g.addColorStop(1, 'rgba(120,20,0,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(dc.x, dc.z, 90, 70, 0.3, 0, U.TAU); c.fill(); }
      if (dc.type === 'bones') { c.fillStyle = '#e8e2cc'; for (let i = 0; i < 7; i++) { c.save(); c.translate(dc.x + (rng() - 0.5) * 80, dc.z + (rng() - 0.5) * 50); c.rotate(rng() * 3); NT.Minifig.rr(c, -18, -3, 36, 6, 3); c.fill(); c.beginPath(); c.arc(-18, -3, 4, 0, U.TAU); c.arc(-18, 3, 4, 0, U.TAU); c.arc(18, -3, 4, 0, U.TAU); c.arc(18, 3, 4, 0, U.TAU); c.fill(); c.restore(); } c.beginPath(); c.arc(dc.x + 20, dc.z - 10, 12, 0, U.TAU); c.fill(); c.fillStyle = '#141414'; c.beginPath(); c.arc(dc.x + 16, dc.z - 12, 3, 0, U.TAU); c.arc(dc.x + 25, dc.z - 12, 3, 0, U.TAU); c.fill(); }
    }
    c.restore();
    function hash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  }

  // ---------------- SKY / BACKDROP ----------------
  renderSky(ctx, cam, W, H, t) {
    const d = this.def; const hy = cam.horizonY();
    const g = ctx.createLinearGradient(0, 0, 0, Math.max(hy, 10));
    g.addColorStop(0, d.sky[0]); g.addColorStop(0.7, d.sky[1]); g.addColorStop(1, d.sky[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, Math.max(hy, 10) + 2);
    ctx.fillStyle = d.sky[2]; ctx.fillRect(0, hy, W, H - hy);
    const px = -cam.x * 0.12; // parallax
    ctx.save();
    switch (d.wall) {
      case 'stands': case 'stands_dark': {
        const dark = d.wall === 'stands_dark';
        // arena wall band with torches
        for (let i = 3; i >= 0; i--) { const y = hy - 20 - i * 26; ctx.fillStyle = dark ? ['#2a1840', '#33204a', '#3d2858', '#472f66'][i] : ['#20262e', '#2a323a', '#343d46', '#3e4852'][i]; ctx.fillRect(0, y, W, 26 + i * 4);
          for (let x = ((px * (0.6 + i * 0.1)) % 46 + 46) % 46 - 46; x < W; x += 46) { ctx.fillStyle = dark ? 'rgba(200,120,255,0.18)' : 'rgba(255,220,150,0.15)'; ctx.beginPath(); ctx.arc(x + i * 11, y + 12, 5, 0, 6.283); ctx.fill(); } }
        for (let x = ((px % 180) + 180) % 180 - 180; x < W + 100; x += 180) { const f = 0.7 + 0.3 * Math.sin(t * 9 + x); ctx.fillStyle = dark ? `rgba(190,110,255,${0.8 * f})` : `rgba(255,190,80,${0.9 * f})`; ctx.shadowColor = dark ? '#b06cff' : '#ffb040'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.ellipse(x, hy - 62, 6, 10 * f, 0, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 3, hy - 54, 6, 30); }
        // stars
        for (let i = 0; i < 40; i++) { const sx = ((i * 97 + px * 0.2) % W + W) % W, sy = (i * 53) % Math.max(20, hy - 130); ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * ((i * 7) % 3) / 2})`; ctx.fillRect(sx, sy, 2, 2); }
        break;
      }
      case 'dojo': {
        // paper screens and red pillars
        ctx.fillStyle = '#5a1c10'; ctx.fillRect(0, hy - 150, W, 150);
        for (let x = ((px % 220) + 220) % 220 - 220; x < W + 220; x += 220) { ctx.fillStyle = '#f0dcb0'; ctx.fillRect(x + 30, hy - 130, 140, 120); ctx.strokeStyle = '#6a2a10'; ctx.lineWidth = 4; for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(x + 30 + i * 35, hy - 130); ctx.lineTo(x + 30 + i * 35, hy - 10); ctx.stroke(); } for (let i = 0; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(x + 30, hy - 130 + i * 40); ctx.lineTo(x + 170, hy - 130 + i * 40); ctx.stroke(); }
          ctx.fillStyle = '#a81a1a'; ctx.fillRect(x, hy - 160, 30, 160); ctx.fillStyle = '#e0b14a'; ctx.fillRect(x, hy - 160, 30, 8); ctx.fillRect(x, hy - 80, 30, 6); }
        ctx.fillStyle = '#3a0c06'; ctx.fillRect(0, hy - 175, W, 25);
        break;
      }
      case 'jungle': {
        for (let layer = 0; layer < 3; layer++) { const col = ['#0a1c10', '#123020', '#1a4028'][layer]; const pxl = px * (0.3 + layer * 0.3); ctx.fillStyle = col;
          for (let x = ((pxl % 150) + 150) % 150 - 150; x < W + 150; x += 150) { const h = 120 + ((x * 7 + layer * 31) % 60) + layer * 30; ctx.beginPath(); ctx.arc(x + layer * 40, hy - h * 0.6, 50 + layer * 12, 0, 6.283); ctx.fill(); ctx.fillRect(x + layer * 40 - 8, hy - h * 0.6, 16, h); } }
        ctx.fillStyle = '#0d2214'; ctx.fillRect(0, hy - 20, W, 20);
        break;
      }
      case 'cave': {
        ctx.fillStyle = '#1e0806'; for (let x = ((px % 90) + 90) % 90 - 90; x < W + 90; x += 90) { const h = 60 + ((x * 13) % 80); ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x, h); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = '#2a0c08'; ctx.fillRect(0, hy - 90, W, 90);
        for (let x = ((px % 130) + 130) % 130 - 130; x < W + 130; x += 130) { ctx.fillStyle = '#3a1410'; ctx.beginPath(); ctx.moveTo(x - 40, hy); ctx.lineTo(x, hy - 150 - ((x * 7) % 60)); ctx.lineTo(x + 40, hy); ctx.closePath(); ctx.fill(); }
        const lg = ctx.createLinearGradient(0, hy - 60, 0, hy); lg.addColorStop(0, 'rgba(255,80,20,0)'); lg.addColorStop(1, 'rgba(255,80,20,0.35)'); ctx.fillStyle = lg; ctx.fillRect(0, hy - 60, W, 60);
        break;
      }
      case 'temple': {
        ctx.fillStyle = '#150c24'; ctx.fillRect(0, hy - 200, W, 200);
        for (let x = ((px % 160) + 160) % 160 - 160; x < W + 160; x += 160) { ctx.fillStyle = '#2a1a44'; ctx.fillRect(x, hy - 190, 40, 190); ctx.fillStyle = '#3d2860'; ctx.fillRect(x - 6, hy - 200, 52, 14); ctx.fillStyle = '#b06cff'; ctx.shadowColor = '#b06cff'; ctx.shadowBlur = 12; ctx.fillRect(x + 14, hy - 120, 12, 12); ctx.shadowBlur = 0; }
        ctx.fillStyle = '#0e0818'; ctx.fillRect(0, hy - 30, W, 30);
        break;
      }
      case 'city': {
        for (let layer = 0; layer < 2; layer++) { const pxl = px * (0.3 + layer * 0.4); const col = layer ? '#131c36' : '#0a1024';
          for (let x = ((pxl % 110) + 110) % 110 - 110; x < W + 110; x += 110) { const h = 100 + ((x * 11 + layer * 17) % 160) + layer * 40; const w = 60 + ((x * 3) % 40); ctx.fillStyle = col; ctx.fillRect(x, hy - h, w, h);
            for (let wy = hy - h + 10; wy < hy - 10; wy += 16) for (let wx = x + 8; wx < x + w - 8; wx += 14) { if (((wx * 7 + wy * 3) % 5) < 2) { ctx.fillStyle = layer ? '#ffe08a' : '#8ab0ff'; ctx.fillRect(wx, wy, 6, 8); } } } }
        // neon glow strip
        for (let x = ((px % 420) + 420) % 420 - 420; x < W + 420; x += 420) { ctx.fillStyle = '#ff3fa8'; ctx.shadowColor = '#ff3fa8'; ctx.shadowBlur = 16; ctx.fillRect(x + 40, hy - 140, 60, 18); ctx.fillStyle = '#3fffe0'; ctx.shadowColor = '#3fffe0'; ctx.fillRect(x + 220, hy - 200, 22, 90); ctx.shadowBlur = 0; }
        ctx.fillStyle = '#0a0e1c'; ctx.fillRect(0, hy - 24, W, 24);
        break;
      }
    }
    ctx.restore();
  }

  // ---------------- FLOOR (perspective strips) ----------------
  renderFloor(ctx, cam, W, H) {
    const hy = cam.horizonY();
    const yStart = Math.max(0, Math.floor(hy) + 6);
    const strip = H > 700 ? 6 : 4;
    const ts = this.ts, texW = this.texW, texH = this.texH;
    const worldW = texW / ts;
    ctx.imageSmoothingEnabled = true;
    for (let sy = yStart; sy < H; sy += strip) {
      const dz0 = cam.dzForScreenY(sy), dz1 = cam.dzForScreenY(sy + strip);
      if (!isFinite(dz0) || !isFinite(dz1) || dz0 > dz1) continue;
      let ty0 = (cam.z + dz0 - this.oz) * ts, ty1 = (cam.z + dz1 - this.oz) * ts;
      if (ty1 <= 0 || ty0 >= texH) continue;
      let dy0 = sy, dy1 = sy + strip;
      if (ty0 < 0) { dy0 += ((0 - ty0) / (ty1 - ty0)) * (dy1 - dy0); ty0 = 0; }
      if (ty1 > texH) { dy1 -= ((ty1 - texH) / (ty1 - ty0)) * (dy1 - dy0); ty1 = texH; }
      const k = cam.kAt((dz0 + dz1) / 2);
      const sx = cam.cx + (this.ox - cam.x) * k + cam.shakeX;
      const sw = worldW * k;
      if (sx + sw < 0 || sx > W) continue;
      const sh = Math.max(1, ty1 - ty0);
      ctx.drawImage(this.tex, 0, ty0, texW, sh, sx, dy0, sw, Math.max(1, dy1 - dy0) + 0.6);
    }
  }

  // ---------------- DECOR BILLBOARDS ----------------
  drawables(cam, t) {
    const out = []; const d = this.def; const U = NT.Util;
    // wall ring / edge
    if (d.shape === 'circle') {
      const n = 40, R = d.radius + 10, wh = d.wall === 'jungle' ? 0 : 34;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * U.TAU, a1 = ((i + 1) / n) * U.TAU;
        const zc = Math.sin((a0 + a1) / 2) * R;
        if (zc > R * 0.45) continue; // skip the near wall so it never covers the action
        out.push({ z: zc - 1, draw: (ctx) => {
          const p0 = cam.project(Math.cos(a0) * R, 0, Math.sin(a0) * R), p1 = cam.project(Math.cos(a1) * R, 0, Math.sin(a1) * R);
          const q0 = cam.project(Math.cos(a0) * R, wh, Math.sin(a0) * R), q1 = cam.project(Math.cos(a1) * R, wh, Math.sin(a1) * R);
          ctx.fillStyle = d.wall === 'stands_dark' ? '#3a2a4a' : d.wall === 'cave' ? '#3a1a12' : '#4a5258'; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q0.x, q0.y); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = d.wall === 'stands_dark' ? '#5a4470' : d.wall === 'cave' ? '#5a2a1a' : '#6a737a'; ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q1.x, q1.y - 3 * q1.k); ctx.lineTo(q0.x, q0.y - 3 * q0.k); ctx.closePath(); ctx.fill();
        } });
      }
    }
    for (const dc of d.decor) {
      if (dc.type === 'lava' || dc.type === 'bones') continue;
      out.push({ z: dc.z, x: dc.x, draw: (ctx) => this.drawDecor(ctx, cam, dc, t) });
    }
    return out;
  }
  drawDecor(ctx, cam, dc, t) {
    const p = cam.project(dc.x, 0, dc.z); const k = p.k; const U = NT.Util; const rr = NT.Minifig.rr, poly = NT.Minifig.poly;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(k, k);
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    switch (dc.type) {
      case 'pillar': { // wooden pillar with a red (or purple) snake wrapped around it
        ctx.beginPath(); ctx.ellipse(0, 0, 40, 16, 0, 0, U.TAU); ctx.fill();
        const h = 480, w = 56;
        const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, '#5a3a1e'); g.addColorStop(0.35, '#9a6a3a'); g.addColorStop(0.7, '#7a4e28'); g.addColorStop(1, '#3a2210');
        ctx.fillStyle = g; rr(ctx, -w / 2, -h, w, h, 6); ctx.fill();
        ctx.strokeStyle = 'rgba(40,20,5,0.5)'; ctx.lineWidth = 1.5; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 6 + i * 11, -h + 10); ctx.lineTo(-w / 2 + 8 + i * 11, -6); ctx.stroke(); }
        // snake coils
        const sc = dc.dark ? ['#7a2fb0', '#4a1a70'] : ['#b8202a', '#6a1018'];
        for (let i = 0; i < 6; i++) { const y = -h + 60 + i * 72; ctx.fillStyle = sc[0]; ctx.beginPath(); ctx.moveTo(-w / 2 - 6, y + 22); ctx.quadraticCurveTo(0, y - 12, w / 2 + 6, y - 2); ctx.lineTo(w / 2 + 6, y + 14); ctx.quadraticCurveTo(0, y + 6, -w / 2 - 6, y + 38); ctx.closePath(); ctx.fill(); ctx.fillStyle = sc[1]; for (let s = 0; s < 6; s++) { ctx.beginPath(); ctx.arc(-w / 2 + 6 + s * 10, y + 20 - s * 3.5, 3, 0, U.TAU); ctx.fill(); } }
        // snake head at the top
        ctx.fillStyle = sc[0]; ctx.beginPath(); ctx.ellipse(w / 2 + 4, -h + 30, 18, 11, 0.4, 0, U.TAU); ctx.fill(); ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.arc(w / 2 + 10, -h + 25, 3, 0, U.TAU); ctx.fill();
        break;
      }
      case 'torch': {
        ctx.beginPath(); ctx.ellipse(0, 0, 10, 4, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#3a2a1a'; rr(ctx, -4, -90, 8, 90, 3); ctx.fill();
        ctx.fillStyle = '#5a5a5a'; rr(ctx, -8, -100, 16, 14, 3); ctx.fill();
        const f = 0.8 + 0.2 * Math.sin(t * 11 + dc.x); const c1 = dc.purple ? '#b06cff' : '#ff9a2a', c2 = dc.purple ? '#e0c0ff' : '#ffe08a';
        ctx.shadowColor = c1; ctx.shadowBlur = 20;
        ctx.fillStyle = c1; ctx.beginPath(); ctx.ellipse(0, -112, 9 * f, 18 * f, Math.sin(t * 7) * 0.2, 0, U.TAU); ctx.fill();
        ctx.fillStyle = c2; ctx.beginPath(); ctx.ellipse(0, -108, 4 * f, 9 * f, 0, 0, U.TAU); ctx.fill();
        break;
      }
      case 'redpillar': {
        ctx.beginPath(); ctx.ellipse(0, 0, 30, 12, 0, 0, U.TAU); ctx.fill();
        const g = ctx.createLinearGradient(-24, 0, 24, 0); g.addColorStop(0, '#6a1010'); g.addColorStop(0.4, '#c82a2a'); g.addColorStop(1, '#5a0c0c');
        ctx.fillStyle = g; rr(ctx, -24, -300, 48, 300, 4); ctx.fill();
        ctx.fillStyle = '#e0b14a'; for (const y of [-300, -220, -120, -30]) ctx.fillRect(-26, y, 52, 10);
        ctx.fillStyle = '#3a2a1a'; rr(ctx, -36, -316, 72, 18, 4); ctx.fill();
        break;
      }
      case 'lantern': {
        ctx.beginPath(); ctx.ellipse(0, 0, 10, 4, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#3a2a1a'; rr(ctx, -3, -150, 6, 150, 2); ctx.fill(); ctx.fillRect(-3, -150, 30, 4);
        const f = 0.85 + 0.15 * Math.sin(t * 3 + dc.x);
        ctx.shadowColor = '#ffb040'; ctx.shadowBlur = 25 * f;
        ctx.fillStyle = '#ff6a2a'; rr(ctx, 12, -146, 30, 40, 12); ctx.fill();
        ctx.fillStyle = '#ffd08a'; rr(ctx, 18, -140, 18, 28, 8); ctx.fill();
        ctx.shadowBlur = 0; ctx.fillStyle = '#e0b14a'; ctx.fillRect(14, -150, 26, 4); ctx.fillRect(14, -106, 26, 4);
        break;
      }
      case 'shrine': {
        ctx.beginPath(); ctx.ellipse(0, 0, 80, 14, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#a81a1a'; ctx.fillRect(-70, -150, 14, 150); ctx.fillRect(56, -150, 14, 150);
        ctx.fillStyle = '#5a0c0c'; ctx.fillRect(-84, -166, 168, 14); ctx.fillRect(-74, -140, 148, 8);
        ctx.fillStyle = '#e0b14a'; ctx.fillRect(-84, -170, 168, 4);
        ctx.fillStyle = '#e0b14a'; ctx.beginPath(); ctx.arc(0, -100, 14, 0, U.TAU); ctx.fill(); ctx.fillStyle = '#5a0c0c'; ctx.beginPath(); ctx.arc(0, -100, 8, 0, U.TAU); ctx.fill();
        break;
      }
      case 'ruin': {
        ctx.beginPath(); ctx.ellipse(0, 0, 36, 14, 0, 0, U.TAU); ctx.fill();
        const g = ctx.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, '#4a5a48'); g.addColorStop(0.4, '#8a9a86'); g.addColorStop(1, '#3a4a38');
        ctx.fillStyle = g; poly(ctx, [-30, 0, 30, 0, 26, -120, 8, -150, -14, -134, -28, -110]); ctx.fill();
        ctx.fillStyle = 'rgba(60,140,60,0.6)'; ctx.beginPath(); ctx.ellipse(-12, -60, 14, 30, 0.3, 0, U.TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(16, -20, 10, 18, -0.4, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-28, -40); ctx.lineTo(28, -44); ctx.moveTo(-26, -80); ctx.lineTo(24, -84); ctx.stroke();
        break;
      }
      case 'tree': {
        ctx.beginPath(); ctx.ellipse(0, 0, 40, 14, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#3a2a14'; poly(ctx, [-16, 0, 16, 0, 10, -180, -8, -180]); ctx.fill();
        const cols = ['#1c5a2a', '#2a7a3a', '#166020'];
        for (let i = 0; i < 5; i++) { const a = (i / 5) * U.TAU; ctx.fillStyle = cols[i % 3]; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 50, -190 + Math.sin(a) * 26, 60, 40, a * 0.3, 0, U.TAU); ctx.fill(); }
        ctx.fillStyle = '#2a8a3a'; ctx.beginPath(); ctx.ellipse(0, -200, 55, 40, 0, 0, U.TAU); ctx.fill();
        // vine
        ctx.strokeStyle = '#3a8a3a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(30, -170); ctx.quadraticCurveTo(50, -100, 34, -30); ctx.stroke();
        break;
      }
      case 'statue': case 'stonestatue': case 'snakestatue': {
        ctx.beginPath(); ctx.ellipse(0, 0, 40, 16, 0, 0, U.TAU); ctx.fill();
        const stone = dc.type === 'snakestatue' ? '#5a3a7a' : dc.type === 'stonestatue' ? '#3a3a44' : '#6a7a68';
        ctx.fillStyle = U.shade(stone, -0.3); rr(ctx, -40, -30, 80, 30, 4); ctx.fill();
        ctx.fillStyle = stone; rr(ctx, -34, -38, 68, 10, 3); ctx.fill();
        if (dc.type === 'snakestatue') { ctx.fillStyle = stone; ctx.beginPath(); ctx.moveTo(-20, -38); ctx.quadraticCurveTo(-40, -120, 0, -150); ctx.quadraticCurveTo(50, -180, 30, -220); ctx.quadraticCurveTo(70, -220, 60, -190); ctx.lineTo(24, -180); ctx.quadraticCurveTo(10, -120, 20, -38); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#b06cff'; ctx.shadowColor = '#b06cff'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(52, -206, 4, 0, U.TAU); ctx.fill(); ctx.shadowBlur = 0; }
        else { // giant stone minifig silhouette
          ctx.save(); ctx.translate(0, -38); ctx.scale(1.6, 1.6);
          const look = dc.type === 'stonestatue' ? { skin: '#3a3a44', torso: '#3a3a44', legs: '#30303a', accent: '#3a3a44', hair: 'helmet_samurai', hairColor: '#30303a', head: 'stone', face: 'angry', extras: [], weapon: 'sword', weaponColor: '#4a4a54', torsoPrint: 'stone', scale: 1 }
            : { skin: '#6a7a68', torso: '#6a7a68', legs: '#5a6a58', accent: '#6a7a68', hair: 'conical', hairColor: '#6a7a68', head: 'face', face: 'calm', extras: ['beard_long'], weapon: 'staff', weaponColor: '#5a6a58', torsoPrint: 'kimono', scale: 1 };
          NT.Minifig.draw(ctx, look, { armR: 0.4, armL: 0.2, weaponAngle: Math.PI }, { facing: Math.PI / 2, flat: dc.type === 'statue' ? '#5f6f5d' : null });
          if (dc.type === 'stonestatue') { ctx.fillStyle = '#ff3030'; ctx.shadowColor = '#ff3030'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(-5.5, -93, 2.5, 0, U.TAU); ctx.arc(5.5, -93, 2.5, 0, U.TAU); ctx.fill(); }
          ctx.restore();
        }
        break;
      }
      case 'stalagmite': {
        ctx.beginPath(); ctx.ellipse(0, 0, 34, 12, 0, 0, U.TAU); ctx.fill();
        const hh = 110 + (dc.v || 0) * 30; const g = ctx.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, '#3a1a12'); g.addColorStop(0.45, '#7a3a26'); g.addColorStop(1, '#2a100a');
        ctx.fillStyle = g; poly(ctx, [-32, 0, 32, 0, 14, -hh * 0.6, 4, -hh, -10, -hh * 0.7]); ctx.fill();
        ctx.fillStyle = 'rgba(255,120,40,0.25)'; poly(ctx, [-20, 0, 20, 0, 6, -30]); ctx.fill();
        break;
      }
      case 'brazier': {
        ctx.beginPath(); ctx.ellipse(0, 0, 24, 9, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#2a2a34'; poly(ctx, [-12, 0, 12, 0, 6, -70, -6, -70]); ctx.fill();
        ctx.fillStyle = '#3a3a48'; ctx.beginPath(); ctx.ellipse(0, -80, 30, 14, 0, 0, U.TAU); ctx.fill(); ctx.fillStyle = '#20202a'; ctx.beginPath(); ctx.ellipse(0, -84, 24, 8, 0, 0, U.TAU); ctx.fill();
        const f = 0.8 + 0.2 * Math.sin(t * 10 + dc.z);
        ctx.shadowColor = '#b06cff'; ctx.shadowBlur = 24; ctx.fillStyle = '#9a4cff'; ctx.beginPath(); ctx.ellipse(0, -104, 16 * f, 26 * f, Math.sin(t * 6) * 0.2, 0, U.TAU); ctx.fill(); ctx.fillStyle = '#e8d0ff'; ctx.beginPath(); ctx.ellipse(0, -98, 7 * f, 12 * f, 0, 0, U.TAU); ctx.fill();
        break;
      }
      case 'vent': {
        ctx.beginPath(); ctx.ellipse(0, 0, 50, 18, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#5a6270'; rr(ctx, -44, -62, 88, 62, 4); ctx.fill(); ctx.fillStyle = '#7a8290'; rr(ctx, -44, -70, 88, 12, 3); ctx.fill();
        ctx.fillStyle = '#2a2f3a'; for (let i = 0; i < 5; i++) ctx.fillRect(-36, -54 + i * 10, 72, 4);
        // steam
        ctx.fillStyle = `rgba(220,230,255,${0.12 + 0.06 * Math.sin(t * 3)})`; ctx.beginPath(); ctx.ellipse(10 * Math.sin(t), -90 - (t * 20 % 30), 22, 14, 0, 0, U.TAU); ctx.fill();
        break;
      }
      case 'neon': {
        ctx.beginPath(); ctx.ellipse(0, 0, 30, 10, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#2a2f3a'; ctx.fillRect(-6, -200, 12, 200);
        ctx.fillStyle = '#1a1e28'; rr(ctx, -60, -230, 120, 70, 6); ctx.fill();
        const c = dc.alt ? '#3fffe0' : '#ff3fa8'; const blink = Math.sin(t * 2.5 + dc.x) > -0.85 ? 1 : 0.3;
        ctx.shadowColor = c; ctx.shadowBlur = 18 * blink; ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.globalAlpha = blink;
        ctx.beginPath(); ctx.moveTo(-44, -210); ctx.lineTo(-44, -180); ctx.moveTo(-44, -195); ctx.lineTo(-30, -195); ctx.moveTo(-30, -210); ctx.lineTo(-30, -180); ctx.moveTo(-12, -180); ctx.lineTo(-12, -210); ctx.lineTo(8, -180); ctx.lineTo(8, -210); ctx.moveTo(26, -210); ctx.lineTo(26, -180); ctx.moveTo(26, -210); ctx.lineTo(44, -210); ctx.moveTo(26, -195); ctx.lineTo(40, -195); ctx.stroke();
        break;
      }
      case 'antenna': {
        ctx.beginPath(); ctx.ellipse(0, 0, 24, 8, 0, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = '#8a929e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(0, -260); ctx.lineTo(20, 0); ctx.moveTo(-14, -80); ctx.lineTo(14, -80); ctx.moveTo(-8, -160); ctx.lineTo(8, -160); ctx.stroke();
        const on = Math.sin(t * 4) > 0; ctx.fillStyle = on ? '#ff3030' : '#5a1010'; ctx.shadowColor = '#ff3030'; ctx.shadowBlur = on ? 16 : 0; ctx.beginPath(); ctx.arc(0, -266, 6, 0, U.TAU); ctx.fill();
        break;
      }
      case 'crate': {
        ctx.beginPath(); ctx.ellipse(0, 0, 40, 14, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#a06a2a'; rr(ctx, -34, -60, 68, 60, 3); ctx.fill(); ctx.fillStyle = '#c8883a'; rr(ctx, -34, -66, 68, 10, 3); ctx.fill();
        ctx.strokeStyle = '#5a3a10'; ctx.lineWidth = 3; ctx.strokeRect(-30, -54, 60, 48); ctx.beginPath(); ctx.moveTo(-30, -54); ctx.lineTo(30, -6); ctx.moveTo(30, -54); ctx.lineTo(-30, -6); ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  // ambient particles per arena
  ambient(vfx, dt, cam) {
    this.ambientT += dt;
    const d = this.def;
    if (this.ambientT < 0.12) return; this.ambientT = 0;
    const px = cam.x + (Math.random() - 0.5) * 1100, pz = cam.z + (Math.random() - 0.5) * 700;
    switch (d.ambient) {
      case 'embers': vfx.add({ type: 'spark', x: px, y: 0, z: pz, vy: 40 + Math.random() * 60, vx: (Math.random() - 0.5) * 30, g: -10, life: 1.5 + Math.random(), size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? '#ff8a2a' : '#ffd08a' }); break;
      case 'fireflies': vfx.add({ type: 'orb', x: px, y: 20 + Math.random() * 80, z: pz, vy: 10, vx: (Math.random() - 0.5) * 40, vz: (Math.random() - 0.5) * 40, g: 0, life: 1.8 + Math.random(), size: 3, color: '#c8ff8a' }); break;
      case 'darkmatter': vfx.add({ type: 'orb', x: px, y: 0, z: pz, vy: 25 + Math.random() * 30, g: -15, life: 1.6 + Math.random(), size: 3, color: '#b06cff' }); break;
      case 'purpleflames': vfx.add({ type: 'spark', x: px, y: 0, z: pz, vy: 40 + Math.random() * 60, vx: (Math.random() - 0.5) * 30, g: -10, life: 1.4 + Math.random(), size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? '#b06cff' : '#e0c0ff' }); break;
      case 'neon': if (Math.random() < 0.3) vfx.add({ type: 'spark', x: px, y: 60 + Math.random() * 100, z: pz, vy: -20, g: 0, life: 1.5, size: 1.5, color: '#8ab0ff' }); break;
      case 'torches': if (Math.random() < 0.4) vfx.add({ type: 'spark', x: px, y: 0, z: pz, vy: 30 + Math.random() * 40, g: -8, life: 1.2 + Math.random(), size: 1.5 + Math.random() * 1.5, color: '#ffd08a' }); break;
      case 'lanterns': if (Math.random() < 0.3) vfx.add({ type: 'spark', x: px, y: 20, z: pz, vy: 15 + Math.random() * 20, g: -5, life: 1.8, size: 1.5, color: '#ffe0a0' }); break;
    }
  }
};
