/* ============================================================
   NT.Minifig — procedural LEGO minifigure renderer.
   Local space: feet at (0,0), up = -y, total height ~110 units.
   draw(ctx, look, pose, opts)
     pose: { bob, lean, legL, legR, armL, armR, armLFwd, armRFwd,
             headTilt, crouch, lying, weaponAngle, weaponHide, squash }
     opts: { facing (rad; 0 = +x, PI/2 = toward camera), flash, alpha,
             flat (single color), only (part), noShadowArm }
   ============================================================ */
NT.Minifig = (function () {
  const U = NT.Util;
  const HEIGHT = 110;
  const PART_CENTER = { head: [0, -90], torso: [0, -56], legs: [0, -18], armL: [-22, -56], armR: [22, -56], weapon: [30, -75] };

  function palette(look, flat) {
    if (flat) return new Proxy({}, { get: () => flat });
    if (look._pal) return look._pal;
    const p = {};
    p.skin = look.skin; p.skinD = U.shade(look.skin, -0.25);
    p.torso = look.torso; p.torsoD = U.shade(look.torso, -0.3); p.torsoL = U.shade(look.torso, 0.18);
    p.legs = look.legs; p.legsD = U.shade(look.legs, -0.3); p.legsL = U.shade(look.legs, 0.12);
    const bare = look.torsoPrint === 'ninja_tournament' || look.torsoPrint === 'vest';
    p.arms = look.arms || (bare ? look.skin : look.torso); p.armsD = U.shade(p.arms, -0.28);
    p.hands = look.hands || look.skin;
    p.accent = look.accent; p.accentD = U.shade(look.accent, -0.3);
    p.hair = look.hairColor; p.hairD = U.shade(look.hairColor, -0.3); p.hairL = U.shade(look.hairColor, 0.2);
    p.weapon = look.weaponColor; p.weaponD = U.shade(look.weaponColor, -0.35); p.weaponL = U.shade(look.weaponColor, 0.3);
    p.mask = look.mask || look.torso; p.maskD = U.shade(p.mask, -0.3);
    p.hood = look.hood || look.torso; p.hoodD = U.shade(p.hood, -0.3);
    p.ink = '#141414'; p.white = '#ffffff'; p.gold = '#e0b14a'; p.goldD = '#9a7420';
    look._pal = p;
    return p;
  }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); }

  // ---------------- LEGS ----------------
  function drawLegs(ctx, p, pose, front) {
    const dir = front ? 1 : -1;
    const crouch = pose.crouch || 0;
    const legH = 30 - crouch * 9;
    const hipY = -38 + crouch * 9;
    // hips
    ctx.fillStyle = p.legsD; rr(ctx, -16, hipY, 32, 9, 2); ctx.fill();
    ctx.fillStyle = p.legs; rr(ctx, -14, hipY + 1, 28, 6, 2); ctx.fill();
    const legs = [[-1, pose.legL || 0], [1, pose.legR || 0]];
    // draw back leg first
    legs.sort((a, b) => (a[1] * dir) - (b[1] * dir));
    for (const [side, v] of legs) {
      const fwd = v * dir; // + = toward camera
      const h = legH * (1 - 0.22 * Math.abs(v));
      const x = side * 8 + v * (pose.sideStep || 0) * 6;
      const top = hipY + 8;
      const bottom = top + h + fwd * 5;
      const w = 14;
      ctx.fillStyle = fwd < -0.2 ? p.legsD : p.legs;
      rr(ctx, x - w / 2, top, w, Math.max(6, bottom - top), 2); ctx.fill();
      // foot
      ctx.fillStyle = p.legsD; rr(ctx, x - w / 2 - 1, bottom - 5, w + 2, 5, 2); ctx.fill();
      // knee highlight
      ctx.fillStyle = p.legsL; ctx.globalAlpha *= 0.5; rr(ctx, x - w / 2 + 2, top + 2, 3, Math.max(2, bottom - top - 10), 1.5); ctx.fill(); ctx.globalAlpha /= 0.5;
    }
  }

  // ---------------- TORSO ----------------
  function drawTorso(ctx, p, look, front) {
    const print = look.torsoPrint;
    // trapezoid: bottom y=-40 (w30), top y=-74 (w38)
    poly(ctx, [-15, -40, 15, -40, 19, -74, -19, -74]);
    ctx.fillStyle = p.torso; ctx.fill();
    // side shading
    ctx.save(); ctx.clip();
    ctx.fillStyle = p.torsoD; ctx.globalAlpha *= 0.35; ctx.fillRect(12, -76, 10, 40); ctx.globalAlpha /= 0.35;
    ctx.fillStyle = p.torsoL; ctx.globalAlpha *= 0.25; ctx.fillRect(-19, -76, 6, 40); ctx.globalAlpha /= 0.25;
    if (front) drawPrint(ctx, p, look, print);
    else drawBackPrint(ctx, p, look, print);
    ctx.restore();
    // neck stud
    ctx.fillStyle = p.skinD; rr(ctx, -5, -78, 10, 5, 1); ctx.fill();
  }
  function drawPrint(ctx, p, look, print) {
    ctx.lineWidth = 2;
    switch (print) {
      case 'ninja': case 'dx': case 'zx': case 'ninja_tournament': {
        // gi wrap: two diagonal lines forming a V + sash
        ctx.strokeStyle = p.torsoD; ctx.beginPath(); ctx.moveTo(-12, -72); ctx.lineTo(0, -56); ctx.lineTo(12, -72); ctx.stroke();
        ctx.fillStyle = p.accent; ctx.fillRect(-16, -50, 32, 5);
        ctx.fillStyle = p.accentD; ctx.fillRect(-3, -50, 6, 5);
        if (print === 'ninja_tournament') {
          // sleeveless vest edge + element emblem
          ctx.strokeStyle = p.torsoD; ctx.beginPath(); ctx.moveTo(-17, -74); ctx.lineTo(-14, -60); ctx.moveTo(17, -74); ctx.lineTo(14, -60); ctx.stroke();
          ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(0, -61, 4, 0, U.TAU); ctx.fill();
          ctx.fillStyle = p.torsoD; ctx.beginPath(); ctx.arc(0, -61, 2, 0, U.TAU); ctx.fill();
        }
        if (print === 'dx') { ctx.strokeStyle = p.gold; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-8, -66); ctx.quadraticCurveTo(8, -70, 6, -58); ctx.quadraticCurveTo(-4, -60, 2, -52); ctx.stroke(); }
        if (print === 'zx') { ctx.fillStyle = '#c9ced4'; poly(ctx, [-19, -74, -6, -74, -9, -66, -19, -64]); ctx.fill(); poly(ctx, [19, -74, 6, -74, 9, -66, 19, -64]); ctx.fill(); ctx.fillStyle = '#8a9199'; ctx.fillRect(-19, -66, 8, 2); ctx.fillRect(11, -66, 8, 2); }
        break;
      }
      case 'kimono': case 'robe': {
        ctx.fillStyle = p.accent; poly(ctx, [-13, -74, -8, -74, 3, -46, -3, -46]); ctx.fill(); poly(ctx, [13, -74, 8, -74, -1, -50, -5, -50]); ctx.fill();
        ctx.fillStyle = p.torsoD; ctx.fillRect(-16, -48, 32, 6);
        if (print === 'robe') { ctx.fillStyle = p.accent; ctx.fillRect(-16, -48, 32, 2); }
        break;
      }
      case 'armor': {
        ctx.fillStyle = p.torsoL; poly(ctx, [-12, -70, 12, -70, 10, -48, -10, -48]); ctx.fill();
        ctx.strokeStyle = p.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -66); ctx.lineTo(10, -66); ctx.moveTo(-9, -58); ctx.lineTo(9, -58); ctx.stroke();
        ctx.fillStyle = p.accent; ctx.fillRect(-16, -46, 32, 4);
        break;
      }
      case 'suit': {
        ctx.fillStyle = p.accent; ctx.fillRect(-2, -74, 4, 32);
        ctx.strokeStyle = p.torsoD; ctx.beginPath(); ctx.moveTo(-10, -74); ctx.lineTo(-7, -44); ctx.moveTo(10, -74); ctx.lineTo(7, -44); ctx.stroke();
        break;
      }
      case 'vest': {
        ctx.fillStyle = p.torsoD; poly(ctx, [-8, -74, 8, -74, 8, -40, -8, -40]); ctx.fill();
        ctx.strokeStyle = p.torsoL; ctx.lineWidth = 1.5; for (let y = -70; y < -42; y += 6) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(8, y); ctx.stroke(); }
        break;
      }
      case 'cultist': {
        ctx.fillStyle = p.accent;
        for (let y = -70; y < -42; y += 8) { for (let x = -12; x <= 12; x += 8) { poly(ctx, [x - 3, y, x + 3, y, x, y + 5]); ctx.fill(); } }
        ctx.fillStyle = p.torsoD; ctx.fillRect(-16, -46, 32, 5);
        break;
      }
      case 'scales': {
        ctx.strokeStyle = p.torsoD; ctx.lineWidth = 1.5;
        for (let y = -70; y < -40; y += 6) { for (let x = -12; x <= 12; x += 6) { ctx.beginPath(); ctx.arc(x + ((y / 6) % 2 ? 3 : 0), y, 3, 0, Math.PI); ctx.stroke(); } }
        ctx.fillStyle = p.accent; ctx.fillRect(-16, -47, 32, 4);
        break;
      }
      case 'ribs': {
        ctx.strokeStyle = '#efece0'; ctx.lineWidth = 2.5;
        for (let i = 0; i < 4; i++) { const y = -68 + i * 7; ctx.beginPath(); ctx.moveTo(-12, y + 2); ctx.quadraticCurveTo(0, y - 3, 12, y + 2); ctx.stroke(); }
        ctx.fillRect(-1.5, -72, 3, 30);
        break;
      }
      case 'nindroid': {
        ctx.strokeStyle = p.accent; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-10, -70); ctx.lineTo(-10, -58); ctx.lineTo(-4, -52); ctx.lineTo(-4, -44); ctx.moveTo(10, -70); ctx.lineTo(10, -58); ctx.lineTo(4, -52); ctx.lineTo(4, -44); ctx.stroke();
        ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(0, -62, 3, 0, U.TAU); ctx.fill();
        break;
      }
      case 'stone': {
        ctx.strokeStyle = p.accent; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-12, -66); ctx.lineTo(-4, -56); ctx.lineTo(-12, -46); ctx.moveTo(12, -66); ctx.lineTo(4, -56); ctx.lineTo(12, -46); ctx.stroke();
        ctx.fillStyle = p.torsoD; ctx.fillRect(-16, -46, 32, 4);
        break;
      }
      case 'titanium': {
        ctx.strokeStyle = p.accent; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-14, -70); ctx.lineTo(-14, -50); ctx.moveTo(14, -70); ctx.lineTo(14, -50); ctx.stroke();
        ctx.fillStyle = p.accent; poly(ctx, [0, -66, 5, -63, 5, -57, 0, -54, -5, -57, -5, -63]); ctx.fill();
        ctx.fillStyle = p.torsoD; ctx.fillRect(-16, -48, 32, 4);
        break;
      }
      default: { ctx.fillStyle = p.torsoD; ctx.fillRect(-16, -47, 32, 4); }
    }
  }
  function drawBackPrint(ctx, p, look, print) {
    if (['ninja', 'dx', 'zx', 'ninja_tournament'].includes(print)) { ctx.fillStyle = p.accent; ctx.fillRect(-16, -50, 32, 5); ctx.fillStyle = p.accentD; ctx.beginPath(); ctx.arc(0, -47, 4, 0, U.TAU); ctx.fill(); }
    else if (print === 'ribs') { ctx.strokeStyle = '#efece0'; ctx.lineWidth = 2.5; ctx.fillStyle = '#efece0'; ctx.fillRect(-1.5, -72, 3, 30); }
    else { ctx.fillStyle = p.torsoD; ctx.fillRect(-16, -47, 32, 4); }
  }

  // ---------------- ARMS ----------------
  function drawArm(ctx, p, side, angle, fwd, opts) {
    // side: -1 left, +1 right ; angle: 0 down, + raised outward ; fwd 0..1 toward camera
    const sx = side * 18 + (opts.shoulderY ? 0 : 0);
    const sy = opts.shoulderY || -68;
    const len = 27 * (1 - 0.5 * fwd);
    const a = angle * side; // outward positive
    const ex = sx + Math.sin(a) * len * side * (side > 0 ? 1 : 1);
    const ey = sy + Math.cos(a) * len;
    // sleeve
    ctx.strokeStyle = opts.dark ? p.armsD : p.arms; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
    // shoulder cap
    ctx.fillStyle = opts.dark ? p.armsD : p.arms; ctx.beginPath(); ctx.arc(sx, sy, 5.5, 0, U.TAU); ctx.fill();
    // hand
    const hr = 5.5 * (1 + 0.35 * fwd);
    ctx.fillStyle = p.hands; ctx.beginPath(); ctx.arc(ex, ey, hr, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = p.skinD; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ex, ey, hr * 0.55, a + 0.5, a + 2.6); ctx.stroke();
    return { x: ex, y: ey, a };
  }

  // ---------------- WEAPONS ----------------
  function drawWeapon(ctx, p, look, hand, angle) {
    const w = look.weapon;
    if (!w || w === 'none') return;
    ctx.save(); ctx.translate(hand.x, hand.y); ctx.rotate(angle);
    // blade points along -y (up) from grip at origin
    ctx.lineCap = 'round';
    switch (w) {
      case 'katana': case 'sword': {
        ctx.fillStyle = '#3a2a1a'; rr(ctx, -2.5, -2, 5, 12, 2); ctx.fill();          // grip
        ctx.fillStyle = p.gold; rr(ctx, -6, -5, 12, 3.5, 1); ctx.fill();               // guard
        ctx.fillStyle = p.weapon; poly(ctx, [-2.5, -5, 2.5, -5, 2.5, -40, 0, -47, -2.5, -40]); ctx.fill();
        ctx.fillStyle = p.weaponL; poly(ctx, [0, -5, 2.5, -5, 2.5, -40, 0, -47]); ctx.fill();
        if (w === 'sword') { ctx.fillStyle = p.weaponD; ctx.fillRect(-0.7, -38, 1.4, 30); }
        break;
      }
      case 'dualswords': {
        ctx.fillStyle = '#3a2a1a'; rr(ctx, -2.5, -2, 5, 12, 2); ctx.fill();
        ctx.fillStyle = p.gold; rr(ctx, -6, -5, 12, 3.5, 1); ctx.fill();
        ctx.fillStyle = p.weapon; poly(ctx, [-2.5, -5, 2.5, -5, 3, -34, 0, -42, -3, -34]); ctx.fill();
        ctx.fillStyle = p.weaponL; poly(ctx, [0, -5, 2.5, -5, 3, -34, 0, -42]); ctx.fill();
        break;
      }
      case 'fangblade': {
        ctx.fillStyle = '#3a2a1a'; rr(ctx, -2.5, -2, 5, 12, 2); ctx.fill();
        ctx.fillStyle = p.weapon; ctx.beginPath(); ctx.moveTo(-3, -5); ctx.quadraticCurveTo(-14, -25, -2, -46); ctx.quadraticCurveTo(-6, -25, 3, -5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = p.weaponL; ctx.beginPath(); ctx.moveTo(-1, -8); ctx.quadraticCurveTo(-9, -24, -2, -42); ctx.quadraticCurveTo(-4, -24, 1, -8); ctx.closePath(); ctx.fill();
        break;
      }
      case 'nunchucks': {
        ctx.fillStyle = '#3a2a1a'; rr(ctx, -2.5, -2, 5, 14, 2); ctx.fill();
        ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(10, -10, 14, -6); ctx.stroke();
        ctx.save(); ctx.translate(14, -6); ctx.rotate(1.2); ctx.fillStyle = '#3a2a1a'; rr(ctx, -2.5, -2, 5, 14, 2); ctx.fill(); ctx.fillStyle = p.weapon; ctx.fillRect(-2.5, -2, 5, 3); ctx.restore();
        ctx.fillStyle = p.weapon; ctx.fillRect(-2.5, -2, 5, 3);
        break;
      }
      case 'scythe': {
        ctx.fillStyle = '#4a3320'; rr(ctx, -2, -46, 4, 66, 2); ctx.fill();
        ctx.fillStyle = p.weapon; ctx.beginPath(); ctx.moveTo(-2, -46); ctx.quadraticCurveTo(-24, -44, -30, -30); ctx.quadraticCurveTo(-18, -38, -2, -40); ctx.closePath(); ctx.fill();
        ctx.fillStyle = p.gold; ctx.fillRect(-3, -48, 6, 4);
        break;
      }
      case 'spear': {
        ctx.fillStyle = '#4a3320'; rr(ctx, -2, -50, 4, 74, 2); ctx.fill();
        ctx.fillStyle = p.weapon; poly(ctx, [-4, -50, 4, -50, 0, -64]); ctx.fill();
        ctx.fillStyle = p.gold; ctx.fillRect(-3, -51, 6, 3);
        break;
      }
      case 'staff': case 'sitar': {
        ctx.fillStyle = p.weapon; rr(ctx, -2.2, -50, 4.4, 72, 2); ctx.fill();
        ctx.fillStyle = p.gold; ctx.fillRect(-3, -50, 6, 3); ctx.fillRect(-3, 18, 6, 3);
        if (w === 'sitar') { ctx.fillStyle = '#7a4a1a'; ctx.beginPath(); ctx.ellipse(0, 10, 9, 12, 0, 0, U.TAU); ctx.fill(); ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-1, -48); ctx.lineTo(-1, 16); ctx.moveTo(1, -48); ctx.lineTo(1, 16); ctx.stroke(); }
        break;
      }
      case 'axe': {
        ctx.fillStyle = '#4a3320'; rr(ctx, -2, -40, 4, 56, 2); ctx.fill();
        ctx.fillStyle = p.weapon; ctx.beginPath(); ctx.moveTo(2, -40); ctx.quadraticCurveTo(20, -42, 18, -24); ctx.quadraticCurveTo(12, -30, 2, -26); ctx.closePath(); ctx.fill();
        ctx.fillStyle = p.weaponD; ctx.fillRect(-3, -42, 6, 4);
        break;
      }
      case 'hammer': {
        ctx.fillStyle = '#4a3320'; rr(ctx, -2.5, -40, 5, 58, 2); ctx.fill();
        ctx.fillStyle = p.weapon; rr(ctx, -12, -48, 24, 12, 3); ctx.fill();
        ctx.fillStyle = p.weaponL; rr(ctx, -10, -47, 20, 3, 1); ctx.fill();
        break;
      }
      case 'mace': {
        ctx.fillStyle = '#4a3320'; rr(ctx, -2, -34, 4, 50, 2); ctx.fill();
        ctx.fillStyle = p.weapon; ctx.beginPath(); ctx.arc(0, -40, 8, 0, U.TAU); ctx.fill();
        ctx.fillStyle = p.weaponD; for (let i = 0; i < 6; i++) { const a = (i / 6) * U.TAU; poly(ctx, [Math.cos(a) * 7, -40 + Math.sin(a) * 7, Math.cos(a + 0.3) * 7, -40 + Math.sin(a + 0.3) * 7, Math.cos(a + 0.15) * 12, -40 + Math.sin(a + 0.15) * 12]); ctx.fill(); }
        break;
      }
      case 'pickaxe': {
        ctx.fillStyle = '#4a3320'; rr(ctx, -2, -40, 4, 56, 2); ctx.fill();
        ctx.fillStyle = p.weapon; ctx.beginPath(); ctx.moveTo(-18, -34); ctx.quadraticCurveTo(0, -48, 18, -34); ctx.lineTo(16, -31); ctx.quadraticCurveTo(0, -42, -16, -31); ctx.closePath(); ctx.fill();
        break;
      }
      case 'bone': {
        ctx.fillStyle = p.weapon; rr(ctx, -2.5, -34, 5, 44, 2.5); ctx.fill();
        for (const y of [-34, 10]) { ctx.beginPath(); ctx.arc(-3, y, 3.5, 0, U.TAU); ctx.arc(3, y, 3.5, 0, U.TAU); ctx.fill(); }
        break;
      }
      case 'shuriken': {
        ctx.fillStyle = p.weapon;
        for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate((i * Math.PI) / 2); poly(ctx, [0, 0, 5, -4, 0, -14, -5, -4]); ctx.fill(); ctx.restore(); }
        ctx.fillStyle = p.weaponD; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, U.TAU); ctx.fill();
        break;
      }
      case 'daggers': {
        ctx.fillStyle = '#3a2a1a'; rr(ctx, -2, -1, 4, 8, 1.5); ctx.fill();
        ctx.fillStyle = p.gold; rr(ctx, -5, -3, 10, 2.5, 1); ctx.fill();
        ctx.fillStyle = p.weapon; poly(ctx, [-2, -3, 2, -3, 0, -22]); ctx.fill();
        break;
      }
      case 'claws': {
        ctx.fillStyle = p.weapon;
        for (let i = -1; i <= 1; i++) { poly(ctx, [i * 4 - 1.5, -4, i * 4 + 1.5, -4, i * 4, -20]); ctx.fill(); }
        break;
      }
      case 'gauntlets': {
        ctx.fillStyle = p.weapon; rr(ctx, -8, -8, 16, 14, 4); ctx.fill();
        ctx.fillStyle = p.weaponD; for (let i = 0; i < 3; i++) ctx.fillRect(-6 + i * 5, -6, 3, 3);
        break;
      }
      case 'blaster': {
        ctx.fillStyle = p.weapon; rr(ctx, -3, -26, 6, 30, 2); ctx.fill();
        ctx.fillStyle = '#ff3b3b'; rr(ctx, -2, -30, 4, 5, 1); ctx.fill();
        ctx.fillStyle = p.weaponD; rr(ctx, -5, -14, 10, 6, 2); ctx.fill();
        break;
      }
    }
    ctx.restore();
  }

  // ---------------- HEAD ----------------
  function drawHead(ctx, p, look, pose, front, fxAbs) {
    const type = look.head;
    const cx = 0, top = -104, w = 28, h = 28;
    const eyeShift = fxAbs * 4; // eyes drift toward facing direction
    // base head
    if (type === 'snake') {
      ctx.fillStyle = p.skin; rr(ctx, cx - 15, top - 4, 30, 34, 8); ctx.fill();
      ctx.fillStyle = p.skinD; rr(ctx, cx - 12, top + 18, 24, 12, 5); ctx.fill(); // jaw
      if (front) {
        ctx.fillStyle = '#ffe14a'; ctx.beginPath(); ctx.ellipse(cx - 6 + eyeShift, top + 8, 4, 3, 0, 0, U.TAU); ctx.ellipse(cx + 6 + eyeShift, top + 8, 4, 3, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#141414'; ctx.fillRect(cx - 7 + eyeShift, top + 6, 1.5, 4); ctx.fillRect(cx + 5 + eyeShift, top + 6, 1.5, 4);
        ctx.fillStyle = '#ffffff'; poly(ctx, [cx - 6, top + 22, cx - 3, top + 22, cx - 4.5, top + 28]); ctx.fill(); poly(ctx, [cx + 3, top + 22, cx + 6, top + 22, cx + 4.5, top + 28]); ctx.fill();
        ctx.strokeStyle = '#141414'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 9, top + 21); ctx.lineTo(cx + 9, top + 21); ctx.stroke();
      }
      return;
    }
    const headColor = type === 'hood' ? p.hood : type === 'skull' ? '#f0eee6' : p.skin;
    ctx.fillStyle = headColor; rr(ctx, cx - w / 2, top, w, h, 7); ctx.fill();
    // cylinder side shading
    ctx.fillStyle = 'rgba(0,0,0,0.13)'; rr(ctx, cx + w / 2 - 6, top, 6, h, 5); ctx.fill();
    if (type === 'hood') {
      // eye band
      if (front) { ctx.fillStyle = p.skin; rr(ctx, cx - 11, top + 8, 22, 9, 3); ctx.fill(); }
      ctx.fillStyle = p.hoodD; ctx.fillRect(cx - 14, top + 17, 28, 1.5);
      // hood tail at back
      ctx.fillStyle = p.hood; rr(ctx, cx - 6, top + 18, 12, 12, 3); ctx.fill();
    }
    if (type === 'mask' || (look.mask && type === 'face')) {
      // cloth mask covering nose & mouth
      ctx.fillStyle = p.mask; rr(ctx, cx - 14, top + 14, 28, 14, 5); ctx.fill();
      ctx.fillStyle = p.maskD; ctx.fillRect(cx - 14, top + 14, 28, 1.5);
    }
    if (type === 'robot') {
      ctx.fillStyle = p.skinD; rr(ctx, cx - 14, top + 6, 28, 13, 3); ctx.fill();
      if (front) {
        const c = look.face === 'robot_red' ? '#ff3b3b' : look.face === 'robot_green' ? '#3fffb0' : '#5fd0ff';
        ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 6;
        rr(ctx, cx - 10 + eyeShift, top + 9, 7, 5, 2); ctx.fill(); rr(ctx, cx + 3 + eyeShift, top + 9, 7, 5, 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = p.skinD; ctx.fillRect(cx - 6, top + 22, 12, 2);
      }
      return;
    }
    if (!front) {
      // back of head
      if (type === 'skull') { ctx.fillStyle = '#d8d4c4'; ctx.fillRect(cx - 1, top + 4, 2, 20); }
      return;
    }
    if (type === 'skull') {
      ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.ellipse(cx - 6 + eyeShift, top + 11, 4.5, 5, 0, 0, U.TAU); ctx.ellipse(cx + 6 + eyeShift, top + 11, 4.5, 5, 0, 0, U.TAU); ctx.fill();
      ctx.fillStyle = look.face === 'skull' && look.accent === '#c8102e' ? '#ff3b3b' : '#ffe14a'; ctx.beginPath(); ctx.arc(cx - 6 + eyeShift, top + 11, 1.6, 0, U.TAU); ctx.arc(cx + 6 + eyeShift, top + 11, 1.6, 0, U.TAU); ctx.fill();
      ctx.fillStyle = '#141414'; poly(ctx, [cx - 2, top + 16, cx + 2, top + 16, cx, top + 19]); ctx.fill();
      ctx.strokeStyle = '#141414'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 8, top + 22); ctx.lineTo(cx + 8, top + 22); for (let x = -6; x <= 6; x += 3) { ctx.moveTo(cx + x, top + 20); ctx.lineTo(cx + x, top + 25); } ctx.stroke();
      return;
    }
    // ---- standard face ----
    const ey = type === 'hood' ? top + 12 : top + 11;
    const ex = cx + eyeShift;
    ctx.fillStyle = '#141414';
    ctx.beginPath(); ctx.arc(ex - 5.5, ey, 2.1, 0, U.TAU); ctx.arc(ex + 5.5, ey, 2.1, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ex - 4.8, ey - 0.7, 0.7, 0, U.TAU); ctx.arc(ex + 6.2, ey - 0.7, 0.7, 0, U.TAU); ctx.fill();
    // brows
    ctx.strokeStyle = '#141414'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    const f = look.face;
    ctx.beginPath();
    if (f === 'angry' || f === 'evil' || f === 'evil_red' || f === 'stern') { ctx.moveTo(ex - 9, ey - 6); ctx.lineTo(ex - 2.5, ey - 3.5); ctx.moveTo(ex + 9, ey - 6); ctx.lineTo(ex + 2.5, ey - 3.5); }
    else if (f === 'smirk') { ctx.moveTo(ex - 9, ey - 4.5); ctx.lineTo(ex - 2.5, ey - 4.5); ctx.moveTo(ex + 9, ey - 6); ctx.lineTo(ex + 2.5, ey - 4); }
    else { ctx.moveTo(ex - 9, ey - 4.5); ctx.lineTo(ex - 2.5, ey - 5); ctx.moveTo(ex + 9, ey - 4.5); ctx.lineTo(ex + 2.5, ey - 5); }
    ctx.stroke();
    if (f === 'evil_red') { ctx.fillStyle = '#ff2a2a'; ctx.beginPath(); ctx.arc(ex - 5.5, ey, 2.1, 0, U.TAU); ctx.arc(ex + 5.5, ey, 2.1, 0, U.TAU); ctx.fill(); }
    // mouth (hidden under a mask / hood)
    const masked = type === 'hood' || look.mask;
    if (!masked) {
      const my = top + 20;
      ctx.beginPath();
      if (f === 'smile' || f === 'calm') { ctx.arc(ex, my - 2, 5, 0.3, Math.PI - 0.3); }
      else if (f === 'grin') { ctx.arc(ex, my - 3, 6, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, my - 3, 6, 0.4, Math.PI - 0.4); ctx.closePath(); ctx.fill(); ctx.beginPath(); }
      else if (f === 'angry' || f === 'evil' || f === 'evil_red') { ctx.arc(ex, my + 3, 5, Math.PI + 0.4, U.TAU - 0.4); }
      else if (f === 'smirk') { ctx.moveTo(ex - 4, my); ctx.quadraticCurveTo(ex + 1, my + 1, ex + 5, my - 3); }
      else { ctx.moveTo(ex - 4, my); ctx.lineTo(ex + 4, my); }
      ctx.stroke();
    }
    // extras on face
    const ext = look.extras || [];
    if (ext.includes('shades')) { ctx.fillStyle = '#141414'; rr(ctx, ex - 11, ey - 3.5, 9, 6, 2); ctx.fill(); rr(ctx, ex + 2, ey - 3.5, 9, 6, 2); ctx.fill(); ctx.fillRect(ex - 2, ey - 2, 4, 1.5); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(ex - 9, ey - 2.5, 3, 1.5); ctx.fillRect(ex + 4, ey - 2.5, 3, 1.5); }
    if (ext.includes('eyepatch')) { ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.ellipse(ex + 5.5, ey, 4.5, 3.8, 0, 0, U.TAU); ctx.fill(); ctx.strokeStyle = '#141414'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex - 13, ey - 4); ctx.lineTo(ex + 13, ey + 1); ctx.stroke(); }
    if (ext.includes('gasmask')) { ctx.fillStyle = '#3a3a3a'; rr(ctx, ex - 9, top + 15, 18, 11, 4); ctx.fill(); ctx.fillStyle = p.accent; ctx.beginPath(); ctx.arc(ex - 4, top + 21, 2.5, 0, U.TAU); ctx.arc(ex + 4, top + 21, 2.5, 0, U.TAU); ctx.fill(); }
    if (ext.includes('beard')) { ctx.fillStyle = p.hair; ctx.beginPath(); ctx.moveTo(cx - 13, top + 16); ctx.quadraticCurveTo(cx - 12, top + 30, cx, top + 30); ctx.quadraticCurveTo(cx + 12, top + 30, cx + 13, top + 16); ctx.quadraticCurveTo(cx, top + 22, cx - 13, top + 16); ctx.fill(); }
    if (ext.includes('beard_long')) { ctx.fillStyle = '#f2efe4'; ctx.beginPath(); ctx.moveTo(cx - 12, top + 17); ctx.quadraticCurveTo(cx - 10, top + 48, cx, top + 52); ctx.quadraticCurveTo(cx + 10, top + 48, cx + 12, top + 17); ctx.quadraticCurveTo(cx, top + 24, cx - 12, top + 17); ctx.fill(); }
    if (ext.includes('mustache')) { ctx.strokeStyle = p.hair; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(ex - 7, top + 18); ctx.quadraticCurveTo(ex, top + 14, ex + 7, top + 18); ctx.stroke(); }
    if (ext.includes('goatee')) { ctx.fillStyle = '#e8dcae'; poly(ctx, [ex - 3, top + 24, ex + 3, top + 24, ex, top + 34]); ctx.fill(); }
    if (ext.includes('scar')) { ctx.strokeStyle = '#a04040'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex + 8, ey - 7); ctx.lineTo(ex + 10, ey + 6); ctx.stroke(); }
  }

  // ---------------- HAIR / HATS ----------------
  function drawHairBack(ctx, p, look, front) {
    const s = look.hair; const top = -104;
    if (s === 'long') { ctx.fillStyle = p.hair; rr(ctx, -17, top - 2, 34, 42, 8); ctx.fill(); }
    if (s === 'ponytail') { ctx.fillStyle = p.hair; ctx.beginPath(); ctx.moveTo(front ? -8 : 0, top + 4); ctx.quadraticCurveTo(-26, top + 10, -18, top + 40); ctx.quadraticCurveTo(-14, top + 22, -4, top + 14); ctx.closePath(); ctx.fill(); }
    if (s === 'crown_snake') { ctx.fillStyle = '#efe6cf'; rr(ctx, -19, top - 6, 38, 40, 10); ctx.fill(); }
    if (s === 'helmet_samurai') { ctx.fillStyle = p.hair; rr(ctx, -20, top + 14, 40, 10, 3); ctx.fill(); }
  }
  function drawHair(ctx, p, look, front) {
    const s = look.hair; const top = -104;
    ctx.fillStyle = p.hair;
    switch (s) {
      case 'none': case 'bald': ctx.fillStyle = look.head === 'skull' ? '#e0ddd0' : (look.head === 'robot' ? p.skinD : p.skin); rr(ctx, -5, top - 4, 10, 5, 1.5); ctx.fill(); break;
      case 'short': rr(ctx, -15, top - 5, 30, 11, 6); ctx.fill(); ctx.fillRect(-15, top + 4, 3, 8); ctx.fillRect(12, top + 4, 3, 8); break;
      case 'flat': rr(ctx, -15, top - 6, 30, 10, 2); ctx.fill(); ctx.fillRect(-15, top + 2, 3, 6); ctx.fillRect(12, top + 2, 3, 6); break;
      case 'slick': ctx.beginPath(); ctx.moveTo(-15, top + 6); ctx.quadraticCurveTo(-16, top - 8, 4, top - 7); ctx.quadraticCurveTo(18, top - 8, 17, top + 10); ctx.lineTo(13, top + 10); ctx.quadraticCurveTo(12, top - 2, -2, top - 1); ctx.quadraticCurveTo(-10, top, -12, top + 6); ctx.closePath(); ctx.fill(); break;
      case 'spiky': rr(ctx, -15, top - 4, 30, 10, 5); ctx.fill(); for (let i = 0; i < 5; i++) { const x = -12 + i * 6; poly(ctx, [x - 3, top - 2, x + 3, top - 2, x + (i - 2) * 1.5, top - 12 - (i === 2 ? 3 : 0)]); ctx.fill(); } break;
      case 'shaggy': ctx.beginPath(); ctx.moveTo(-17, top + 10); ctx.quadraticCurveTo(-18, top - 8, 0, top - 8); ctx.quadraticCurveTo(18, top - 8, 17, top + 10); ctx.lineTo(14, top + 12); ctx.lineTo(12, top + 6); ctx.lineTo(8, top + 9); ctx.lineTo(4, top + 5); ctx.lineTo(0, top + 9); ctx.lineTo(-4, top + 5); ctx.lineTo(-8, top + 9); ctx.lineTo(-12, top + 6); ctx.lineTo(-14, top + 12); ctx.closePath(); ctx.fill(); break;
      case 'curly': for (let i = 0; i < 6; i++) { const a = Math.PI + (i / 5) * Math.PI; ctx.beginPath(); ctx.arc(Math.cos(a) * 13, top + 2 + Math.sin(a) * 9, 5.5, 0, U.TAU); ctx.fill(); } rr(ctx, -13, top - 4, 26, 8, 4); ctx.fill(); break;
      case 'long': rr(ctx, -16, top - 5, 32, 12, 6); ctx.fill(); break;
      case 'ponytail': rr(ctx, -15, top - 5, 30, 11, 6); ctx.fill(); break;
      case 'bun': rr(ctx, -15, top - 4, 30, 10, 6); ctx.fill(); ctx.beginPath(); ctx.arc(0, top - 8, 6, 0, U.TAU); ctx.fill(); ctx.fillStyle = p.accent; ctx.fillRect(-2, top - 14, 4, 6); break;
      case 'mohawk': rr(ctx, -4, top - 14, 8, 18, 3); ctx.fill(); break;
      case 'headband': ctx.fillStyle = p.hair; rr(ctx, -15, top - 5, 30, 10, 5); ctx.fill(); ctx.fillStyle = p.accent; ctx.fillRect(-15, top + 3, 30, 4); break;
      case 'conical': ctx.fillStyle = '#e8d9a0'; poly(ctx, [-27, top + 4, 27, top + 4, 0, top - 16]); ctx.fill(); ctx.fillStyle = '#c9b980'; poly(ctx, [-27, top + 4, 27, top + 4, 0, top - 1]); ctx.fill(); break;
      case 'jester': ctx.fillStyle = '#c8102e'; poly(ctx, [-15, top + 2, 0, top - 2, -22, top - 20]); ctx.fill(); ctx.fillStyle = '#1f5fbf'; poly(ctx, [15, top + 2, 0, top - 2, 22, top - 20]); ctx.fill(); ctx.fillStyle = '#c8102e'; poly(ctx, [-6, top - 2, 6, top - 2, 0, top - 24]); ctx.fill(); ctx.fillStyle = '#1f5fbf'; rr(ctx, -15, top - 3, 30, 7, 3); ctx.fill(); ctx.fillStyle = '#e0b14a'; for (const [x, y] of [[-22, top - 20], [22, top - 20], [0, top - 24]]) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, U.TAU); ctx.fill(); } break;
      case 'helmet_snake': ctx.fillStyle = p.hair; rr(ctx, -17, top - 8, 34, 26, 8); ctx.fill(); ctx.fillStyle = p.hairD; rr(ctx, -17, top + 10, 34, 8, 3); ctx.fill(); ctx.fillStyle = p.hairL; for (let i = 0; i < 4; i++) { poly(ctx, [-9 + i * 6, top - 6, -3 + i * 6, top - 6, -6 + i * 6, top - 16]); ctx.fill(); } ctx.fillStyle = '#ffffff'; poly(ctx, [-16, top + 14, -12, top + 14, -14, top + 22]); ctx.fill(); poly(ctx, [12, top + 14, 16, top + 14, 14, top + 22]); ctx.fill(); break;
      case 'helmet_stone': ctx.fillStyle = p.hair; rr(ctx, -17, top - 8, 34, 16, 8); ctx.fill(); ctx.fillStyle = p.hairD; rr(ctx, -19, top + 4, 38, 5, 2); ctx.fill(); ctx.fillStyle = p.hairL; poly(ctx, [-2, top - 8, 2, top - 8, 0, top - 18]); ctx.fill(); break;
      case 'helmet_samurai': ctx.fillStyle = p.hair; rr(ctx, -17, top - 8, 34, 16, 8); ctx.fill(); ctx.fillStyle = p.hairD; rr(ctx, -22, top + 4, 44, 6, 2); ctx.fill(); ctx.fillStyle = '#e0b14a'; poly(ctx, [-3, top - 6, -12, top - 22, -8, top - 22, -1, top - 8]); ctx.fill(); poly(ctx, [3, top - 6, 12, top - 22, 8, top - 22, 1, top - 8]); ctx.fill(); ctx.fillStyle = '#c8102e'; ctx.fillRect(-4, top - 12, 8, 6); break;
      case 'helmet_horn': ctx.fillStyle = p.hair; rr(ctx, -17, top - 8, 34, 16, 8); ctx.fill(); ctx.fillStyle = '#e8e2cc'; poly(ctx, [-14, top - 2, -10, top - 4, -22, top - 20]); ctx.fill(); poly(ctx, [14, top - 2, 10, top - 4, 22, top - 20]); ctx.fill(); break;
      case 'helmet_bone': ctx.fillStyle = '#e8e2cc'; rr(ctx, -17, top - 8, 34, 16, 8); ctx.fill(); for (let i = 0; i < 4; i++) { const x = -12 + i * 8; poly(ctx, [x - 3, top - 6, x + 3, top - 6, x + (i - 1.5) * 4, top - 22]); ctx.fill(); } ctx.fillStyle = '#141414'; ctx.fillRect(-17, top + 4, 34, 3); break;
      case 'crown_snake': ctx.fillStyle = '#e0b14a'; rr(ctx, -16, top - 6, 32, 7, 2); ctx.fill(); ctx.fillStyle = '#c8102e'; for (let i = 0; i < 3; i++) { poly(ctx, [-10 + i * 10 - 3, top - 6, -10 + i * 10 + 3, top - 6, -10 + i * 10, top - 16]); ctx.fill(); } ctx.fillStyle = '#efe6cf'; rr(ctx, -19, top + 1, 5, 24, 2); ctx.fill(); rr(ctx, 14, top + 1, 5, 24, 2); ctx.fill(); break;
      default: rr(ctx, -15, top - 5, 30, 11, 6); ctx.fill();
    }
  }

  // ---------------- MAIN DRAW ----------------
  function draw(ctx, look, pose, opts) {
    pose = pose || {}; opts = opts || {};
    const p = palette(look, opts.flat);
    const facing = opts.facing == null ? Math.PI / 2 : opts.facing;
    const fx = Math.cos(facing), fz = Math.sin(facing);
    const front = fz > -0.25;
    const mirror = (fx < 0) !== !front;
    const fxAbs = Math.abs(fx);
    const bodySx = 0.74 + 0.26 * Math.abs(fz);
    const only = opts.only;
    ctx.save();
    if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
    if (pose.lying) { ctx.translate(0, -8); ctx.rotate(pose.lying * (pose.lyingDir || 1) * 1.45); ctx.translate(0, 8); ctx.scale(1, 1 - pose.lying * 0.15); }
    if (mirror) ctx.scale(-1, 1);
    if (pose.bob) ctx.translate(0, pose.bob);
    if (pose.squash) ctx.scale(1 + pose.squash, 1 - pose.squash);
    ctx.scale(bodySx * (look.scaleX || 1), 1);
    const armL = pose.armL || 0, armR = pose.armR || 0, armLF = pose.armLFwd || 0, armRF = pose.armRFwd || 0;
    const wAngle = pose.weaponAngle == null ? Math.PI : pose.weaponAngle;
    const hasFour = (look.extras || []).includes('fourarms');

    const upper = () => { ctx.save(); ctx.translate(0, -40); if (pose.lean) ctx.rotate(pose.lean); ctx.translate(0, 40); if (pose.crouch) ctx.translate(0, pose.crouch * 9); };
    const upperEnd = () => ctx.restore();

    // far arm (left) first (behind torso) — in back view the left arm is nearer, swap
    const drawArmSide = (side) => {
      const a = side < 0 ? armL : armR, f = side < 0 ? armLF : armRF;
      const hand = drawArm(ctx, p, side, a, f, { dark: side < 0 && front });
      if (hasFour) drawArm(ctx, p, side, a * 0.6 + 0.4, f * 0.5, { dark: true, shoulderY: -56 });
      if (side > 0 && !pose.weaponHide && (!only || only === 'weapon')) drawWeapon(ctx, p, look, hand, hand.a + wAngle);
      return hand;
    };

    if (!only || only === 'legs') { if (!only) {} drawLegs(ctx, p, pose, front); }
    if (only === 'legs') { ctx.restore(); return; }
    upper();
    if (!only || only === 'armL') { if (front) drawArmSide(-1); else drawArmSide(1); }
    if (!only || only === 'torso') drawTorso(ctx, p, look, front);
    if (!only || only === 'armR' || only === 'weapon') { if (front) drawArmSide(1); else drawArmSide(-1); }
    if (!only || only === 'head') {
      ctx.save(); if (pose.headTilt) { ctx.translate(0, -78); ctx.rotate(pose.headTilt); ctx.translate(0, 78); }
      drawHairBack(ctx, p, look, front);
      drawHead(ctx, p, look, pose, front, fxAbs * (mirror ? 1 : 1));
      drawHair(ctx, p, look, front);
      ctx.restore();
    }
    upperEnd();
    ctx.restore();
  }

  function drawPortrait(ctx, look, cx, cy, r, opts) {
    opts = opts || {};
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, U.TAU); ctx.clip();
    const g = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, opts.bg || '#5a3a9a'); g.addColorStop(1, opts.bg2 || '#20123f');
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const s = (r / 21) * (opts.zoom || 1);
    ctx.translate(cx, cy + r * 0.12 + 90 * s);
    ctx.scale(s, s);
    draw(ctx, look, { armL: 0.15, armR: 0.15 }, { facing: Math.PI / 2, flat: opts.flat, alpha: opts.alpha });
    ctx.restore();
  }

  return { draw, drawPortrait, palette, HEIGHT, PART_CENTER, rr, poly };
})();
