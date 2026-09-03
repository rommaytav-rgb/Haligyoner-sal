/* ============================================================
   NT.EnemyAI — grunt / ranged / heavy / boss behaviours.
   Uses "attack tokens" so only a few enemies attack at once and
   the rest circle, wait and reposition.
   ============================================================ */
NT.EnemyAI = class EnemyAI {
  constructor(f, opts = {}) {
    this.f = f; this.p = Object.assign({ aggression: 0.5, attackRate: 1.2, range: 64, ranged: false, blocks: 0, kind: 'grunt' }, opts.ai || {});
    this.isBoss = !!opts.boss;
    this.mode = 'approach'; this.modeT = 0; this.cool = 0.8 + Math.random() * 0.8; this.token = false;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1; this.waitT = 0; this.thinkT = 0;
    this.specialCool = this.isBoss ? 6 + Math.random() * 3 : 999;
    this.phase = 1; this.blockT = 0; this.dodgeCool = 0;
    this.enraged = false;
  }
  release(world) { if (this.token) { this.token = false; world.aiTokens = Math.max(0, world.aiTokens - 1); } }
  update(dt, world) {
    const f = this.f, U = NT.Util; const pl = world.player;
    this.modeT += dt; this.cool -= dt; this.thinkT -= dt; this.dodgeCool -= dt; this.specialCool -= dt;
    if (f.dead || !pl || pl.dead) { f.moveInput.x = f.moveInput.z = 0; this.release(world); if (f.state !== 'victory' && pl && pl.dead && !f.dead && f.stateT > 1) { f.setState('victory', 'victory'); } return; }
    if (f.state === 'intro' || f.state === 'frozen') { f.moveInput.x = f.moveInput.z = 0; return; }
    if (f.state === 'attack' || f.state === 'special') { f.moveInput.x = f.moveInput.z = 0; return; }
    if (f.busy) { f.moveInput.x = f.moveInput.z = 0; this.release(world); return; }
    // boss phase 2
    if (this.isBoss && !this.enraged && f.hp < f.maxHp * 0.5) { this.enraged = true; f.aura = 1; f.speed *= 1.18; this.p.attackRate *= 0.75; world.vfx.flash(f.x, 50, f.z, 120, '#ff4a3a'); world.vfx.ring(f.x, f.z, 140, '#ff4a3a', 0.6, 12); NT.Audio.play('boss_intro'); world.cam.shake(6, 0.3); world.onBossRage && world.onBossRage(f); }

    const d = f.distTo(pl); const ang = f.angleTo(pl);
    const melee = this.p.range + pl.radius; const ranged = this.p.ranged;
    // blocking reaction: when the player winds up an attack facing us
    if (f.blockHeld) { this.blockT -= dt; if (this.blockT <= 0) f.setBlock(false, world); f.moveInput.x = f.moveInput.z = 0; f.facing = ang; return; }
    if (this.p.blocks > 0 && pl.state === 'attack' && pl.attack && pl.attackT < 0.08 && d < 140 && pl.inFront(f, 2.2) && Math.random() < this.p.blocks) { f.setBlock(true, world); this.blockT = 0.55; f.facing = ang; return; }
    // boss dodge
    if (this.isBoss && f.features.dodge && this.dodgeCool <= 0 && pl.state === 'attack' && pl.attack && pl.attackT < 0.06 && d < 150 && Math.random() < 0.35) { this.dodgeCool = 2.5; f.moveInput.x = Math.cos(ang + Math.PI / 2 * this.strafeDir); f.moveInput.z = Math.sin(ang + Math.PI / 2 * this.strafeDir); f.dodge(world); return; }
    // boss special
    if (this.isBoss && this.specialCool <= 0 && d < 260 && f.canAct) { this.specialCool = 9 + Math.random() * 4; f.useSpecial(world); return; }

    // choose mode
    if (this.thinkT <= 0) {
      this.thinkT = 0.35 + Math.random() * 0.5;
      const wantRange = ranged ? 300 : melee - 6;
      if (ranged) {
        if (d < 150) this.mode = 'retreat';
        else if (d > 380) this.mode = 'approach';
        else this.mode = Math.random() < 0.5 ? 'strafe' : 'hold';
      } else {
        if (d > wantRange + 30) this.mode = (this.token || world.aiTokens < world.maxTokens || d > 260) ? 'approach' : 'strafe';
        else this.mode = this.token ? 'attack' : (Math.random() < 0.6 ? 'strafe' : 'hold');
        if (!this.token && world.aiTokens < world.maxTokens && d < wantRange + 90 && this.cool <= 0 && Math.random() < 0.55 + this.p.aggression * 0.4) { this.token = true; world.aiTokens++; this.mode = 'approach'; }
      }
      if (Math.random() < 0.25) this.strafeDir *= -1;
    }
    let mx = 0, mz = 0;
    if (this.mode === 'approach') { if (d > (ranged ? 300 : melee - 8)) { mx = Math.cos(ang); mz = Math.sin(ang); } else if (!ranged && this.token) this.mode = 'attack'; }
    else if (this.mode === 'retreat') { mx = -Math.cos(ang); mz = -Math.sin(ang); }
    else if (this.mode === 'strafe') { const sa = ang + (Math.PI / 2) * this.strafeDir; mx = Math.cos(sa) * 0.7; mz = Math.sin(sa) * 0.7; if (d > melee + 120) { mx += Math.cos(ang) * 0.5; mz += Math.sin(ang) * 0.5; } if (d < melee - 20) { mx -= Math.cos(ang) * 0.6; mz -= Math.sin(ang) * 0.6; } }
    else if (this.mode === 'hold') { mx = mz = 0; if (d < melee - 24) { mx = -Math.cos(ang) * 0.5; mz = -Math.sin(ang) * 0.5; } }
    // attack
    if (!ranged && this.token && d <= melee + 10 && this.cool <= 0 && f.canAct) {
      f.moveInput.x = f.moveInput.z = 0; f.facing = ang;
      const kind = this.p.kind;
      let did = false;
      if (this.isBoss) {
        const r = Math.random();
        if (r < 0.5) did = f.doAction('light', world);
        else if (r < 0.7) did = f.doAction('kick', world);
        else if (r < 0.85 && f.features.jumpSlam) did = f.doAction('jumpslam', world);
        else did = f.doAction('heavy', world);
        if (did && Math.random() < 0.6) f.buffered = 'light';
      } else if (kind === 'heavy') { did = f.doAction(Math.random() < 0.6 ? 'heavy' : 'light', world); }
      else { did = f.doAction('light', world); if (did && Math.random() < this.p.aggression) f.buffered = 'light'; }
      this.cool = this.p.attackRate * (0.7 + Math.random() * 0.6) * (this.isBoss ? 0.7 : 1);
      this.release(world); this.mode = 'strafe'; this.thinkT = 0.6;
      return;
    }
    if (this.isBoss && d > 170 && d < 420 && this.cool <= 0 && f.canAct && Math.random() < 0.02) { f.moveInput.x = f.moveInput.z = 0; f.facing = ang; f.doAction(f.features.ranged && Math.random() < 0.5 ? 'ranged' : 'jumpslam', world); this.cool = this.p.attackRate; return; }
    if (ranged && this.cool <= 0 && d > 120 && d < 520 && f.canAct && Math.random() < 0.9) {
      f.moveInput.x = f.moveInput.z = 0; f.facing = ang; f.doAction('ranged', world); this.cool = this.p.attackRate * (1 + Math.random() * 0.8); return;
    }
    // token timeout
    if (this.token && this.modeT > 4) { this.release(world); }
    // avoid stacking on the player when not attacking
    if (!this.token && d < melee - 10 && !ranged) { mx -= Math.cos(ang) * 0.8; mz -= Math.sin(ang) * 0.8; }
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    f.moveInput.x = mx; f.moveInput.z = mz;
    if (!(mx || mz)) f.facing = U.angleLerp(f.facing, ang, Math.min(1, dt * 8));
  }
};
