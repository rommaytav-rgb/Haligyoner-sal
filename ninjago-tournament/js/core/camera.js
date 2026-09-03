/* ============================================================
   NT.Camera — perspective camera over the arena plane.
   World: x right, z toward viewer (down the screen), y up.
   ============================================================ */
NT.Camera = class Camera {
  constructor() {
    this.x = 0; this.z = 0;           // look-at point on ground
    this.tx = 0; this.tz = 0;         // target
    this.H = 960; this.D = 820;       // eye height & distance behind look-at
    this.zoom = 1; this.tzoom = 1;
    this.shakeAmp = 0; this.shakeT = 0; this.shakeX = 0; this.shakeY = 0;
    this.W = 800; this.Hs = 600; this.cx = 400; this.cy = 330;
    this.baseFocal = 1;
    this.bounds = null; // {x, z, r} circle
    this.recalc();
  }
  resize(W, H) {
    this.W = W; this.Hs = H;
    this.cx = W / 2; this.cy = H * 0.5;
    // scale so that ~880 world units fit the screen width on landscape, ~620 on portrait
    const landscape = W >= H;
    const fitW = landscape ? 1340 : 860;
    this.baseFocal = (W / fitW) * this.L;
    this.recalc();
  }
  recalc() {
    this.L = Math.hypot(this.H, this.D);
    this.focal = (this.baseFocal || this.L) * this.zoom;
    this.L2 = this.L * this.L;
  }
  // scale factor k for ground row at dz (world z - cam z)
  kAt(dz) { return (this.focal * this.L) / (this.L2 - dz * this.D); }
  project(x, y, z) {
    const dz = z - this.z;
    const dx = x - this.x;
    const L = this.L, D = this.D, Hc = this.H;
    const pz = (-(y - Hc) * Hc - (dz - D) * D) / L;
    const py = ((y - Hc) * D - (dz - D) * Hc) / L;
    const inv = this.focal / Math.max(40, pz);
    return { x: this.cx + dx * inv + this.shakeX, y: this.cy - py * inv + this.shakeY, k: inv, pz };
  }
  // inverse ground mapping for a screen row (returns dz)
  dzForScreenY(sy) {
    const d = sy - this.shakeY - this.cy;
    return (d * this.L2) / (this.focal * this.H + d * this.D);
  }
  horizonY() { return this.cy - (this.focal * this.H) / this.D + this.shakeY; }

  shake(amp, dur = 0.3) { if (!NT.Save.get().settings.shake) amp *= 0.25; this.shakeAmp = Math.max(this.shakeAmp, amp); this.shakeT = Math.max(this.shakeT, dur); }

  update(dt) {
    const U = NT.Util;
    let tx = this.tx, tz = this.tz;
    if (this.bounds) {
      // keep the camera from drifting too far outside the arena
      const b = this.bounds, dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz), max = b.r * 0.55;
      if (d > max) { tx = b.x + (dx / d) * max; tz = b.z + (dz / d) * max; }
    }
    this.x = U.damp(this.x, tx, 6, dt);
    this.z = U.damp(this.z, tz, 6, dt);
    this.zoom = U.damp(this.zoom, this.tzoom, 4, dt);
    this.recalc();
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.min(1, this.shakeT * 4);
      this.shakeX = (Math.random() * 2 - 1) * a;
      this.shakeY = (Math.random() * 2 - 1) * a;
      if (this.shakeT <= 0) { this.shakeAmp = 0; this.shakeX = this.shakeY = 0; }
    }
  }
  snap() { this.x = this.tx; this.z = this.tz; this.zoom = this.tzoom; this.recalc(); }
};
