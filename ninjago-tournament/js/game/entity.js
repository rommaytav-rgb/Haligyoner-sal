/* ============================================================
   NT.Fighter — shared entity for players, grunts and bosses.
   Combat: attack chains, kick, jump slam, block/parry, dodge,
   ranged, specials (spinjitzu / burst / dash strikes / cloud),
   hit reactions, knockdown, elemental status, death break-apart.
   ============================================================ */
NT.Attacks = {
  light1: { anim: 'attack1', dur: 0.34, hit: [0.10, 0.20], range: 78, arc: 1.9, dmg: 1.0, kb: 150, stun: 0.36, sfx: 'swing', chain: 'light2', lunge: 90 },
  light2: { anim: 'attack2', dur: 0.36, hit: [0.10, 0.21], range: 80, arc: 2.0, dmg: 1.0, kb: 170, stun: 0.38, sfx: 'swing2', chain: 'light3', lunge: 100 },
  light3: { anim: 'attack3', dur: 0.56, hit: [0.20, 0.32], range: 88, arc: 2.3, dmg: 1.8, kb: 430, stun: 0.9, knockdown: true, heavy: true, sfx: 'swing3', lunge: 140, element: true },
  kick:   { anim: 'kick', dur: 0.46, hit: [0.14, 0.26], range: 80, arc: 2.2, dmg: 1.3, kb: 360, stun: 0.8, knockdown: true, heavy: true, sfx: 'kick', lunge: 110 },
  jumpslam: { anim: 'jumpslam', dur: 0.98, hit: [0.55, 0.62], aoe: 150, dmg: 2.0, kb: 400, stun: 1.0, knockdown: true, heavy: true, radial: true, sfx: 'slam', airborne: [0.0, 0.55], jumpH: 120, element: true },
  ranged: { anim: 'throw', dur: 0.42, spawn: 0.16, dmg: 0.8, speed: 640, sfx: 'throw' },
  // enemy-flavoured
  grunt1: { anim: 'attack1', dur: 0.5, hit: [0.24, 0.34], range: 76, arc: 1.9, dmg: 1.0, kb: 170, stun: 0.4, sfx: 'swing', chain: 'grunt2', lunge: 70, windup: 0.22 },
  grunt2: { anim: 'attack2', dur: 0.5, hit: [0.22, 0.32], range: 78, arc: 2.0, dmg: 1.0, kb: 260, stun: 0.5, sfx: 'swing2', lunge: 70, windup: 0.2 },
  heavy_swing: { anim: 'attack3', dur: 0.95, hit: [0.48, 0.6], range: 96, arc: 2.4, dmg: 1.7, kb: 420, stun: 1.0, knockdown: true, heavy: true, sfx: 'swing3', lunge: 90, windup: 0.46 },
  boss1: { anim: 'attack1', dur: 0.4, hit: [0.16, 0.26], range: 84, arc: 2.0, dmg: 1.0, kb: 180, stun: 0.4, sfx: 'swing', chain: 'boss2', lunge: 100, windup: 0.14 },
  boss2: { anim: 'attack2', dur: 0.42, hit: [0.16, 0.27], range: 86, arc: 2.0, dmg: 1.0, kb: 200, stun: 0.42, sfx: 'swing2', chain: 'boss3', lunge: 100, windup: 0.14 },
  boss3: { anim: 'attack3', dur: 0.7, hit: [0.32, 0.44], range: 94, arc: 2.3, dmg: 1.8, kb: 440, stun: 0.95, knockdown: true, heavy: true, sfx: 'swing3', lunge: 140, windup: 0.3, element: true },
};

NT.Fighter = class Fighter {
  constructor(def, opts = {}) {
    const U = NT.Util;
    this.def = def; this.look = def.look; this.id = def.id; this.name = def.name; this.element = def.element || 'venom';
    this.isPlayer = !!opts.isPlayer; this.team = opts.team || (this.isPlayer ? 'player' : 'enemy');
    this.isBoss = !!opts.boss; this.isChampion = !!opts.champion;
    this.x = opts.x || 0; this.z = opts.z || 0; this.y = 0; this.vx = 0; this.vz = 0; this.vy = 0;
    this.facing = opts.facing != null ? opts.facing : Math.PI / 2;
    this.scale = def.look.scale || 1;
    this.radius = 20 * this.scale;
    this.weight = (def.ai && def.ai.weight) || (this.isBoss ? 1.8 : 1) * this.scale;
    const lvl = opts.level || 1; const diff = opts.difficulty || 1;
    const lvlMul = 1 + (lvl - 1) * 0.14;
    this.maxHp = Math.round(def.stats.hp * lvlMul * diff * (this.isChampion ? 1.6 : 1) * (this.isBoss ? 1.4 : 1));
    this.hp = this.maxHp;
    this.attackStat = def.stats.attack * (1 + (lvl - 1) * 0.1) * (this.isPlayer ? 1 : diff * 0.9);
    this.defense = def.stats.defense * (1 + (lvl - 1) * 0.15);
    this.speed = def.stats.speed;
    this.features = def.features || { ranged: false, dodge: true, jumpSlam: true };
    this.special = def.special || { type: 'spinjitzu' };
    this.state = 'idle'; this.stateT = 0; this.anim = 'idle'; this.animT = 0; this.walkPhase = 0;
    this.moveInput = { x: 0, z: 0 }; this.moving = false;
    this.attack = null; this.attackT = 0; this.hitSet = null; this.spawned = false;
    this.comboStep = 0; this.chainTimer = 0; this.buffered = null;
    this.hitstun = 0; this.invuln = 0; this.flash = 0; this.blockHeld = false; this.blockT = -1; this.blocking = false;
    this.knockTimer = 0; this.lyingDir = 1; this.airborne = false;
    this.spinMeter = this.isPlayer ? 0 : 0.35; this.specialState = null;
    this.status = { burn: 0, freeze: 0, poison: 0, shock: 0, slow: 0 };
    this.combo = 0; this.comboTimer = 0; this.maxCombo = 0;
    this.dead = false; this.deadT = 0; this.remove = false;
    this.trail = [];
    this.hearts = this.isPlayer ? Math.min(5, 3 + Math.floor((lvl - 1) / 2)) : 0;
    if (this.isPlayer) { this.maxHp = Math.round(this.maxHp * (this.hearts / 3)); this.hp = this.maxHp; }
    this.afterimages = [];
    this.tint = null; this.aura = 0; this.introT = 0;
    this.stepT = 0;
  }

  // ---------------- state helpers ----------------
  setState(s, anim) { this.state = s; this.stateT = 0; if (anim) { this.anim = anim; this.animT = 0; } }
  get busy() { return ['attack', 'hit', 'knockdown', 'getup', 'dodge', 'special', 'dead', 'victory', 'defeat', 'intro', 'frozen'].includes(this.state); }
  get canAct() { return (this.state === 'idle' || this.state === 'move' || this.state === 'block') && this.status.freeze <= 0 && !this.dead; }
  get alive() { return !this.dead; }
  faceTo(x, z) { this.facing = Math.atan2(z - this.z, x - this.x); }
  distTo(e) { return Math.hypot(e.x - this.x, e.z - this.z); }
  angleTo(e) { return Math.atan2(e.z - this.z, e.x - this.x); }
  inFront(e, arc = Math.PI) { return Math.abs(NT.Util.angleDiff(this.facing, this.angleTo(e))) <= arc / 2; }

  // ---------------- actions ----------------
  startAttack(key, world) {
    const def = NT.Attacks[key]; if (!def) return false;
    this.attack = Object.assign({ key }, def); this.attackT = 0; this.hitSet = new Set(); this.spawned = false;
    this.setState('attack', def.anim); this.blocking = false; this.chainTimer = 0; this.buffered = null;
    if (def.airborne) { this.airborne = true; this.vy = 0; }
    return true;
  }
  tryAttack(world, kind = 'light') {
    if (this.dead) return false;
    if (this.state === 'attack' && this.attack) {
      // chain / buffer
      if (kind === 'light' && this.attack.chain && this.attackT >= this.attack.dur * 0.45) { this.buffered = 'light'; return true; }
      if (this.attackT >= this.attack.dur * 0.55) { this.buffered = kind; return true; }
      return false;
    }
    if (!this.canAct) { if (this.state === 'hit' && this.hitstun < 0.12) { this.buffered = kind; } return false; }
    return this.doAction(kind, world);
  }
  doAction(kind, world) {
    if (kind === 'light') {
      // ranged if enemies are far
      const near = world.nearestEnemy(this, 130), far = world.nearestEnemy(this, 560);
      if (this.features.ranged && !near && far) { this.faceTo(far.x, far.z); return this.startAttack('ranged', world); }
      this.autoFace(world, 200);
      const key = this.isPlayer ? 'light1' : (this.isBoss ? 'boss1' : 'grunt1');
      this.comboStep = 1; NT.Audio.play(NT.Attacks[key].sfx);
      return this.startAttack(key, world);
    }
    if (kind === 'kick') { this.autoFace(world, 200); NT.Audio.play('swing2'); return this.startAttack('kick', world); }
    if (kind === 'jumpslam') { if (!this.features.jumpSlam) return this.doAction('kick', world); this.autoFace(world, 260); NT.Audio.play('jump'); return this.startAttack('jumpslam', world); }
    if (kind === 'heavy') { this.autoFace(world, 200); NT.Audio.play('swing3'); return this.startAttack('heavy_swing', world); }
    if (kind === 'ranged') { const far = world.nearestEnemy(this, 700); if (far) this.faceTo(far.x, far.z); return this.startAttack('ranged', world); }
    if (kind === 'dodge') return this.dodge(world);
    if (kind === 'special') return this.useSpecial(world);
    return false;
  }
  autoFace(world, range) {
    const mi = this.moveInput;
    if (mi.x || mi.z) { this.facing = Math.atan2(mi.z, mi.x); const e = world.nearestEnemy(this, range, this.facing, 1.6); if (e) this.faceTo(e.x, e.z); return; }
    const e = world.nearestEnemy(this, range); if (e) this.faceTo(e.x, e.z);
  }
  dodge(world) {
    if (!this.features.dodge || !this.canAct) return false;
    const mi = this.moveInput; let a;
    if (mi.x || mi.z) a = Math.atan2(mi.z, mi.x); else a = this.facing + Math.PI;
    this.dodgeDir = a; this.setState('dodge', 'dodge'); this.invuln = 0.36; this.blocking = false;
    this.vx = Math.cos(a) * 560; this.vz = Math.sin(a) * 560;
    NT.Audio.play('dodge'); world.vfx.dust(this.x, this.z, 4, 20);
    return true;
  }
  setBlock(held, world) {
    if (held && !this.blockHeld) this.blockT = 0;
    this.blockHeld = held;
  }
  useSpecial(world) {
    if (this.dead) return false;
    if (this.isPlayer && this.spinMeter < 1) { NT.Audio.play('error', { minGap: 300 }); return false; }
    if (!this.canAct && this.state !== 'attack') return false;
    this.spinMeter = 0; this.blocking = false;
    const sp = this.special; const E = NT.Elements[this.element] || NT.Elements.energy;
    const color = sp.color || E.c1;
    this.specialState = { type: sp.type, t: 0, tick: 0, color, color2: E.c2, dashes: 0 };
    this.setState('special', sp.type === 'spinjitzu' ? 'spin' : sp.type === 'burst' ? 'charge' : sp.type === 'cloud' ? 'charge' : 'dash');
    this.invuln = 0.5;
    if (sp.type === 'spinjitzu') { NT.Audio.play('spin_start'); world.vfx.flash(this.x, 40, this.z, 80, color); world.vfx.ring(this.x, this.z, 120, color, 0.5, 10); world.onSpinjitzu && world.onSpinjitzu(this); }
    else if (sp.type === 'burst') { NT.Audio.play('energy'); }
    else if (sp.type === 'dash_strikes') { NT.Audio.play('whoosh'); this.invuln = 1.4; }
    else if (sp.type === 'cloud') { NT.Audio.play('energy'); }
    world.onSpecial && world.onSpecial(this);
    return true;
  }

  // ---------------- damage ----------------
  takeHit(attacker, info, world) {
    if (this.dead || this.invuln > 0) return 'miss';
    const dirA = info.dir != null ? info.dir : (attacker ? Math.atan2(this.z - attacker.z, this.x - attacker.x) : this.facing + Math.PI);
    // blocking?
    const fromFront = attacker ? this.inFront(attacker, Math.PI * 1.1) : true;
    if (this.blocking && fromFront && !info.unblockable) {
      const parry = this.blockT >= 0 && this.blockT < 0.18;
      const px = this.x + Math.cos(this.facing) * 26, pz = this.z + Math.sin(this.facing) * 26;
      world.vfx.sparks(px, 50, pz, parry ? 14 : 7, parry ? '#ffffff' : '#ffe14a', 220); world.vfx.star(px, 55, pz, parry ? 44 : 26, '#8fd3ff');
      NT.Audio.play(parry ? 'parry' : 'block');
      this.vx += Math.cos(dirA) * info.kb * 0.35; this.vz += Math.sin(dirA) * info.kb * 0.35;
      if (attacker && attacker.state === 'attack') { attacker.hitstun = parry ? 1.0 : 0.35; attacker.setState('hit', 'hit'); attacker.attack = null; attacker.vx -= Math.cos(dirA) * 160; attacker.vz -= Math.sin(dirA) * 160; if (parry) { attacker.flash = 0.2; world.hitStop = Math.max(world.hitStop, 0.08); } }
      if (this.isPlayer && parry) { this.spinMeter = Math.min(1, this.spinMeter + 0.12); this.addCombo(world); }
      return parry ? 'parry' : 'block';
    }
    let dmg = Math.max(1, Math.round(info.dmg - this.defense * 0.5));
    if (this.state === 'knockdown') dmg = Math.round(dmg * 0.6);
    this.hp -= dmg;
    this.flash = 0.14; this.blocking = false; this.attack = null; this.buffered = null; this.specialState = this.state === 'special' && this.specialState && this.specialState.type === 'spinjitzu' ? this.specialState : null;
    if (this.specialState && this.specialState.type === 'spinjitzu' && info.heavy) this.specialState = null;
    if (this.state === 'special' && !this.specialState) this.state = 'idle';
    // push
    const kbMul = 1 / Math.max(0.5, this.weight) * (this.isBoss ? 0.55 : 1);
    this.vx += Math.cos(dirA) * info.kb * kbMul; this.vz += Math.sin(dirA) * info.kb * kbMul;
    if (info.knockdown && !(this.isBoss && Math.random() < 0.5) && this.state !== 'special') {
      this.setState('knockdown', 'knockdown'); this.knockTimer = info.stun + 0.5; this.vy = 160 * kbMul; this.y = Math.max(this.y, 1);
      this.lyingDir = Math.cos(dirA - this.facing) > 0 ? -1 : 1;
    } else if (this.state !== 'special') {
      this.setState('hit', 'hit'); this.hitstun = info.stun * (this.isBoss ? 0.6 : 1);
    }
    if (this.isPlayer) { this.combo = 0; this.comboTimer = 0; NT.Audio.play('hurt'); world.onPlayerHit && world.onPlayerHit(this, dmg); }
    else NT.Audio.play(info.heavy ? 'heavy' : (Math.random() < 0.5 ? 'hit' : 'hit2'));
    // vfx at contact
    const cx = (attacker ? (attacker.x + this.x) / 2 : this.x), cz = (attacker ? (attacker.z + this.z) / 2 : this.z);
    world.vfx.star(cx, 55 * this.scale, cz, info.heavy ? 48 : 30, info.heavy ? '#ffb040' : '#ffe14a');
    world.vfx.sparks(cx, 50, cz, info.heavy ? 10 : 5, '#fff3a0', info.heavy ? 320 : 200);
    if (info.element && attacker) { world.vfx.element(attacker.element, this.x, 30, this.z, 6); this.applyElement(attacker.element, attacker, world); }
    world.hitStop = Math.max(world.hitStop, info.heavy ? 0.07 : 0.035);
    if (info.heavy) world.cam.shake(info.knockdown ? 7 : 4, 0.25);
    if (attacker && attacker.isPlayer) { attacker.addCombo(world); attacker.spinMeter = Math.min(1, attacker.spinMeter + (info.heavy ? 0.07 : 0.045)); if (attacker.spinMeter >= 1 && attacker.spinMeter - 0.07 < 1) NT.Audio.play('combo'); }
    if (this.hp <= 0) this.die(world, attacker);
    return 'hit';
  }
  applyElement(el, attacker, world) {
    if (this.dead) return;
    switch (el) {
      case 'fire': case 'amber': this.status.burn = 2.0; break;
      case 'ice': case 'water': if (!this.isBoss || Math.random() < 0.4) { this.status.freeze = this.isBoss ? 0.8 : 1.4; this.setState('frozen', 'hit'); NT.Audio.play('ice'); } break;
      case 'lightning': case 'tech': case 'sound': this.status.shock = 0.5; this.hitstun = Math.max(this.hitstun, 0.5); NT.Audio.play('lightning'); for (const o of world.entities) { if (o !== this && o.team === this.team && !o.dead && o.distTo(this) < 140) { world.vfx.add({ type: 'bolt', x: this.x, y: 50, z: this.z, x2: o.x, y2: 50, z2: o.z, color: '#9df4ff', life: 0.2, width: 3 }); o.takeHit(attacker, { dmg: attacker.attackStat * 0.5, kb: 120, stun: 0.4, dir: Math.atan2(o.z - this.z, o.x - this.x) }, world); } } break;
      case 'poison': case 'venom': case 'nature': this.status.poison = 3.0; break;
      case 'earth': case 'stone': case 'metal': case 'gravity': this.vx *= 1.4; this.vz *= 1.4; world.cam.shake(6, 0.2); break;
      default: break;
    }
  }
  addCombo(world) { this.combo++; this.comboTimer = 2.4; if (this.combo > this.maxCombo) this.maxCombo = this.combo; if (this.combo % 10 === 0) { NT.Audio.play('combo'); world.onComboMilestone && world.onComboMilestone(this.combo); } }
  die(world, killer) {
    if (this.dead) return; this.dead = true; this.deadT = 0; this.hp = 0; this.attack = null; this.specialState = null;
    this.setState('dead', 'dead'); this.blocking = false;
    NT.Audio.play('break');
    world.vfx.breakApart(this);
    world.vfx.dust(this.x, this.z, 6, 26);
    if (!this.isPlayer) { world.dropStuds(this, killer); }
    world.onDeath && world.onDeath(this, killer);
  }

  // ---------------- update ----------------
  update(dt, world) {
    const U = NT.Util;
    this.stateT += dt; this.animT += dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.blockT >= 0) this.blockT += dt;
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) this.combo = 0; }
    // status effects
    for (const k of ['burn', 'poison', 'shock', 'slow']) if (this.status[k] > 0) this.status[k] -= dt;
    if (this.status.burn > 0 || this.status.poison > 0) { this.dotT = (this.dotT || 0) + dt; if (this.dotT > 0.5) { this.dotT = 0; const el = this.status.burn > 0 ? 'fire' : 'poison'; world.vfx.element(el, this.x, 20, this.z, 3); if (!this.dead) { this.hp -= Math.max(1, Math.round(this.maxHp * 0.02)); this.flash = 0.06; if (this.hp <= 0) this.die(world, world.player); } } }
    if (this.status.freeze > 0) { this.status.freeze -= dt; if (this.status.freeze <= 0 && this.state === 'frozen') this.setState('idle', 'idle'); }
    if (this.dead) { this.deadT += dt; if (this.deadT > 0.05 && !this.isPlayer) this.remove = true; this.vx = this.vz = 0; return; }

    // ---- state machine ----
    const st = this.state;
    if (st === 'intro') { if (this.stateT > 1.6) this.setState('idle', 'idle'); }
    else if (st === 'hit') { this.hitstun -= dt; if (this.hitstun <= 0) { this.setState('idle', 'idle'); if (this.buffered) { const b = this.buffered; this.buffered = null; this.doAction(b, world); } } }
    else if (st === 'knockdown') {
      this.knockTimer -= dt;
      if (this.y <= 0 && this.knockTimer <= 0) { this.setState('getup', 'getup'); this.invuln = 0.35; }
    }
    else if (st === 'getup') { if (this.stateT > 0.35) this.setState('idle', 'idle'); }
    else if (st === 'dodge') { if (this.stateT > 0.38) this.setState('idle', 'idle'); else if (this.stateT > 0.1 && (this.stateT * 60 | 0) % 3 === 0) this.afterimages.push({ x: this.x, z: this.z, facing: this.facing, t: 0, pose: this.pose() }); }
    else if (st === 'attack') this.updateAttack(dt, world);
    else if (st === 'special') this.updateSpecial(dt, world);
    else if (st === 'frozen') { /* wait */ }
    else if (st === 'victory' || st === 'defeat') { /* anim only */ }
    else {
      // idle / move / block
      this.blocking = this.blockHeld && this.canAct;
      if (this.blocking && st !== 'block') this.setState('block', 'block');
      if (!this.blocking && st === 'block') this.setState('idle', 'idle');
      if (this.buffered && this.canAct) { const b = this.buffered; this.buffered = null; this.doAction(b, world); }
    }

    // ---- movement ----
    const mi = this.moveInput; const wants = (mi.x || mi.z) && (this.state === 'idle' || this.state === 'move' || this.state === 'block' || (this.state === 'special' && this.specialState && this.specialState.type === 'spinjitzu'));
    let spd = this.speed * (this.status.slow > 0 ? 0.5 : 1) * (this.blocking ? 0.45 : 1) * (this.state === 'special' ? 1.3 : 1);
    if (wants) {
      const tvx = mi.x * spd, tvz = mi.z * spd;
      this.vx = U.damp(this.vx, tvx, 14, dt); this.vz = U.damp(this.vz, tvz, 14, dt);
      if (!this.blocking && this.state !== 'special') this.facing = U.angleLerp(this.facing, Math.atan2(mi.z, mi.x), Math.min(1, dt * 18));
      if (this.state === 'idle') this.setState('move', 'run');
      this.walkPhase += dt * spd * 0.045;
      this.stepT += dt; if (this.stepT > 0.26 && this.isPlayer) { this.stepT = 0; NT.Audio.play('step', { minGap: 120 }); }
    } else {
      const fr = this.state === 'knockdown' ? 3 : (this.state === 'attack' || this.state === 'dodge' || this.state === 'hit') ? 6 : 12;
      this.vx = U.damp(this.vx, 0, fr, dt); this.vz = U.damp(this.vz, 0, fr, dt);
      if (this.state === 'move') this.setState('idle', 'idle');
    }
    this.moving = wants;
    this.x += this.vx * dt; this.z += this.vz * dt;
    // vertical
    if (this.y > 0 || this.vy > 0) { this.vy -= 900 * dt; this.y += this.vy * dt; if (this.y <= 0) { this.y = 0; this.vy = 0; if (this.state === 'knockdown') { world.vfx.dust(this.x, this.z, 5, 22); NT.Audio.play('land', { minGap: 80 }); } } }
    // afterimages
    for (let i = this.afterimages.length - 1; i >= 0; i--) { this.afterimages[i].t += dt; if (this.afterimages[i].t > 0.25) this.afterimages.splice(i, 1); }
    // weapon trail
    if (this.state === 'attack' && this.attack && this.attack.hit && !this.attack.aoe && this.attackT >= this.attack.hit[0] - 0.04 && this.attackT <= this.attack.hit[1] + 0.05) {
      this.trail.push({ x: this.x, z: this.z, facing: this.facing, t: 0, u: this.attackT / this.attack.dur });
    }
    for (let i = this.trail.length - 1; i >= 0; i--) { this.trail[i].t += dt; if (this.trail[i].t > 0.12) this.trail.splice(i, 1); }
  }
  updateAttack(dt, world) {
    const a = this.attack; if (!a) { this.setState('idle', 'idle'); return; }
    const prev = this.attackT; this.attackT += dt; const t = this.attackT;
    // lunge forward at hit start
    if (a.lunge && prev < a.hit[0] && t >= a.hit[0]) { this.vx += Math.cos(this.facing) * a.lunge * 2.2; this.vz += Math.sin(this.facing) * a.lunge * 2.2; NT.Audio.play(a.sfx, { minGap: 20 }); }
    if (a.windup && prev < a.windup * 0.5 && t >= a.windup * 0.5 && !this.isPlayer) { this.flash = 0.08; }
    // jump slam arc
    if (a.airborne) {
      const [a0, a1] = a.airborne; if (t < a1) { const u = (t - a0) / (a1 - a0); this.y = Math.sin(u * Math.PI) * a.jumpH; this.vx += Math.cos(this.facing) * 260 * dt * 3; this.vz += Math.sin(this.facing) * 260 * dt * 3; }
      else if (prev < a1) { this.y = 0; NT.Audio.play('slam'); world.vfx.shockwave(this.x, this.z, a.aoe, NT.Elements[this.element] ? NT.Elements[this.element].c1 : '#ffe14a'); world.vfx.element(this.element, this.x, 10, this.z, 10); world.cam.shake(8, 0.3); }
    }
    // ranged spawn
    if (a.spawn != null && !this.spawned && t >= a.spawn) { this.spawned = true; NT.Audio.play('throw'); world.spawnProjectile(this, a); }
    // hit window
    if (a.hit && t >= a.hit[0] && t <= a.hit[1]) {
      for (const e of world.entities) {
        if (e === this || e.team === this.team || e.dead || this.hitSet.has(e)) continue;
        const d = this.distTo(e);
        let ok = false, dir;
        if (a.radial) { ok = d <= a.aoe + e.radius; dir = Math.atan2(e.z - this.z, e.x - this.x); }
        else { ok = d <= a.range + e.radius && this.inFront(e, a.arc); dir = this.facing; }
        if (!ok) continue;
        this.hitSet.add(e);
        e.takeHit(this, { dmg: this.attackStat * a.dmg, kb: a.kb, stun: a.stun, knockdown: a.knockdown, heavy: a.heavy, dir, element: a.element }, world);
      }
    }
    // chaining
    if (this.buffered === 'light' && a.chain && t >= a.dur * 0.55) { this.buffered = null; NT.Audio.play(NT.Attacks[a.chain].sfx); this.autoFace(world, 200); this.startAttack(a.chain, world); return; }
    if (this.buffered && this.buffered !== 'light' && t >= a.dur * 0.7) { const b = this.buffered; this.buffered = null; this.attack = null; this.setState('idle', 'idle'); this.doAction(b, world); return; }
    if (t >= a.dur) { this.attack = null; this.airborne = false; this.setState('idle', 'idle'); }
  }
  updateSpecial(dt, world) {
    const s = this.specialState; if (!s) { this.setState('idle', 'idle'); return; }
    s.t += dt; const E = NT.Elements[this.element] || NT.Elements.energy;
    if (s.type === 'spinjitzu') {
      const dur = this.isPlayer ? 4.6 : 3.2;
      s.tick += dt;
      if (s.tick > 0.14) { s.tick = 0;
        if (Math.random() < 0.9) world.vfx.element(this.element, this.x + (Math.random() - 0.5) * 60, 10 + Math.random() * 60, this.z + (Math.random() - 0.5) * 40, 2);
        for (const e of world.entities) { if (e === this || e.team === this.team || e.dead) continue; if (e.distTo(this) <= 96 + e.radius) { const last = s.t >= dur - 0.3; e.takeHit(this, { dmg: this.attackStat * (last ? 1.4 : 0.55), kb: last ? 460 : 260, stun: 0.5, knockdown: last, heavy: last, dir: Math.atan2(e.z - this.z, e.x - this.x), element: Math.random() < 0.35, unblockable: true }, world); } }
        for (const p of world.projectiles) if (p.team !== this.team && Math.hypot(p.x - this.x, p.z - this.z) < 90) p.dead = true;
      }
      if (s.t >= dur) { this.specialState = null; this.setState('idle', 'idle'); world.vfx.ring(this.x, this.z, 100, s.color, 0.4, 8); }
    } else if (s.type === 'burst') {
      if (s.t < 0.75) { if (Math.random() < 0.6) world.vfx.add({ type: 'orb', x: this.x + (Math.random() - 0.5) * 140, y: 0, z: this.z + (Math.random() - 0.5) * 100, vy: 120, g: -60, life: 0.5, size: 5, color: s.color }); }
      else if (!s.fired) { s.fired = true; this.anim = 'burst'; this.animT = 0; NT.Audio.play('burst'); NT.Audio.play(this.element === 'tech' ? 'lightning' : 'energy');
        world.vfx.flash(this.x, 50, this.z, 260, s.color); world.vfx.ring(this.x, this.z, 250, s.color, 0.6, 18); world.vfx.ring(this.x, this.z, 160, '#ffffff', 0.4, 8); world.vfx.element(this.element, this.x, 30, this.z, 16); world.cam.shake(12, 0.4);
        for (const e of world.entities) { if (e === this || e.team === this.team || e.dead) continue; if (e.distTo(this) <= 240 + e.radius) e.takeHit(this, { dmg: this.attackStat * 2.6, kb: 520, stun: 1.0, knockdown: true, heavy: true, dir: Math.atan2(e.z - this.z, e.x - this.x), element: true, unblockable: true }, world); } }
      if (s.t >= 1.25) { this.specialState = null; this.setState('idle', 'idle'); }
    } else if (s.type === 'dash_strikes') {
      const step = 0.24; const idx = Math.floor(s.t / step);
      if (idx > s.dashes - 1 + 1 && s.dashes < 5) {
        s.dashes++;
        const e = world.nearestEnemy(this, 420);
        for (let i = 0; i < 3; i++) this.afterimages.push({ x: this.x, z: this.z, facing: this.facing, t: -i * 0.03, pose: this.pose() });
        if (e) { const a = Math.atan2(this.z - e.z, this.x - e.x) + (Math.random() - 0.5) * 2.2; this.x = e.x + Math.cos(a) * (e.radius + 34); this.z = e.z + Math.sin(a) * (e.radius + 34); this.faceTo(e.x, e.z); world.arena.clamp(this, 30);
          e.takeHit(this, { dmg: this.attackStat * 1.1, kb: s.dashes === 5 ? 420 : 160, stun: 0.5, knockdown: s.dashes === 5, heavy: s.dashes === 5, dir: this.facing, element: true, unblockable: true }, world);
        } else { this.x += Math.cos(this.facing) * 120; this.z += Math.sin(this.facing) * 120; world.arena.clamp(this, 30); }
        NT.Audio.play('swing3'); world.vfx.smoke(this.x, 20, this.z, 3, s.color); world.vfx.flash(this.x, 40, this.z, 50, s.color);
        this.anim = 'dash'; this.animT = 0;
      }
      if (s.t >= step * 5 + 0.2) { this.specialState = null; this.setState('idle', 'idle'); }
    } else if (s.type === 'cloud') {
      if (s.t > 0.5 && !s.fired) { s.fired = true; world.zones.push({ x: this.x, z: this.z, r: 170, t: 0, life: 5.5, team: this.team, owner: this, color: s.color, tick: 0 }); NT.Audio.play('fire'); world.vfx.ring(this.x, this.z, 170, s.color, 0.6, 12); for (let i = 0; i < 12; i++) world.vfx.smoke(this.x + (Math.random() - 0.5) * 200, 10, this.z + (Math.random() - 0.5) * 160, 1, s.color); }
      if (s.t >= 0.9) { this.specialState = null; this.setState('idle', 'idle'); }
    }
  }

  // ---------------- animation pose ----------------
  pose() {
    const t = this.animT, U = NT.Util; const a = this.anim; const p = { armL: 0.15, armR: 0.15, weaponAngle: Math.PI };
    const ph = this.walkPhase;
    switch (a) {
      case 'idle': p.bob = Math.sin(this.stateT * 2.6) * 1.2; p.armL = 0.18 + Math.sin(this.stateT * 2.6) * 0.03; p.armR = 0.22; p.weaponAngle = Math.PI + 0.25; if (this.blocking) { p.armL = 1.4; p.armLFwd = 0.7; p.armR = 1.2; p.armRFwd = 0.7; p.crouch = 0.2; p.weaponAngle = Math.PI - 1.2; } break;
      case 'run': p.legL = Math.sin(ph); p.legR = -Math.sin(ph); p.armLFwd = Math.max(0, -Math.sin(ph)) * 0.5; p.armRFwd = Math.max(0, Math.sin(ph)) * 0.4; p.armL = 0.35; p.armR = 0.4; p.bob = -Math.abs(Math.sin(ph)) * 2.5; p.lean = 0.08; p.sideStep = 1; p.weaponAngle = Math.PI + 0.5; if (this.blocking) { p.armL = 1.4; p.armLFwd = 0.7; p.armR = 1.2; p.armRFwd = 0.7; p.crouch = 0.2; p.weaponAngle = Math.PI - 1.2; } break;
      case 'block': p.armL = 1.4; p.armLFwd = 0.7; p.armR = 1.2; p.armRFwd = 0.7; p.crouch = 0.2; p.weaponAngle = Math.PI - 1.2; p.bob = 1; break;
      case 'attack1': { const u = U.clamp(t / 0.34, 0, 1); const s = U.ease.outCubic(Math.min(1, u * 1.6)); p.armR = U.lerp(2.7, -0.5, s); p.armRFwd = 0.35; p.weaponAngle = U.lerp(Math.PI + 0.5, Math.PI - 0.8, s); p.lean = U.lerp(-0.12, 0.2, s); p.armL = 0.6; p.legL = 0.4; p.legR = -0.3; p.sideStep = 1; break; }
      case 'attack2': { const u = U.clamp(t / 0.36, 0, 1); const s = U.ease.outCubic(Math.min(1, u * 1.6)); p.armR = U.lerp(-0.6, 2.6, s); p.armRFwd = 0.4; p.weaponAngle = U.lerp(Math.PI - 0.9, Math.PI + 0.7, s); p.lean = U.lerp(0.2, -0.1, s); p.armL = 0.9; p.armLFwd = 0.3; p.legL = -0.3; p.legR = 0.4; p.sideStep = 1; break; }
      case 'attack3': { const u = U.clamp(t / 0.56, 0, 1); const s = U.ease.inCubic(Math.min(1, u * 2.4)); p.armR = U.lerp(3.1, 0.9, s); p.armRFwd = U.lerp(0.1, 0.75, s); p.armL = U.lerp(2.4, 0.5, s); p.armLFwd = U.lerp(0, 0.5, s); p.weaponAngle = U.lerp(Math.PI - 0.2, Math.PI - 0.1, s); p.lean = U.lerp(-0.25, 0.35, s); p.crouch = s * 0.35; p.legL = 0.5; p.legR = -0.3; p.sideStep = 1; p.bob = u < 0.4 ? -6 * (u / 0.4) : -6 * (1 - (u - 0.4) / 0.6); break; }
      case 'kick': { const u = U.clamp(t / 0.46, 0, 1); const s = Math.sin(Math.min(1, u * 1.5) * Math.PI); p.legR = s * 1.0; p.legL = -0.2; p.sideStep = 1; p.lean = -0.28 * s; p.bob = -4 * s; p.armL = 1.2 * s + 0.2; p.armR = 0.9 * s + 0.2; p.weaponAngle = Math.PI + 0.6; p.crouch = 0.15; break; }
      case 'jumpslam': { const u = U.clamp(t / 0.98, 0, 1); if (u < 0.55) { const s = u / 0.55; p.armL = U.lerp(0.4, 2.9, U.ease.outQuad(s)); p.armR = U.lerp(0.4, 2.9, U.ease.outQuad(s)); p.legL = -0.6; p.legR = 0.4; p.weaponAngle = Math.PI; p.lean = -0.1; } else { const s = U.clamp((u - 0.55) / 0.25, 0, 1); p.crouch = U.lerp(0.7, 0.2, s); p.armL = 1.0; p.armLFwd = 0.8; p.armR = 1.0; p.armRFwd = 0.8; p.lean = 0.3 * (1 - s); p.weaponAngle = Math.PI - 0.3; p.legL = 0.5; p.legR = -0.5; } break; }
      case 'throw': { const u = U.clamp(t / 0.42, 0, 1); const s = U.ease.outCubic(Math.min(1, u * 2)); p.armR = U.lerp(2.6, 0.8, s); p.armRFwd = U.lerp(0, 0.85, s); p.weaponAngle = Math.PI; p.lean = U.lerp(-0.1, 0.22, s); p.armL = 0.7; p.legL = 0.4; p.sideStep = 1; p.weaponHide = u > 0.35 && this.look.weapon === 'shuriken'; break; }
      case 'hit': { const u = U.clamp(t / 0.35, 0, 1); p.lean = -0.35 * (1 - u); p.headTilt = -0.25 * (1 - u); p.armL = 0.9 * (1 - u) + 0.2; p.armR = 0.9 * (1 - u) + 0.2; p.legL = -0.3; p.legR = 0.3; p.sideStep = 1; p.bob = 2 * (1 - u); break; }
      case 'knockdown': { const u = U.clamp(t / 0.3, 0, 1); p.lying = u; p.lyingDir = this.lyingDir; p.armL = 1.6; p.armR = 1.6; p.legL = 0.3; p.legR = -0.3; p.weaponAngle = Math.PI + 0.4; break; }
      case 'getup': { const u = U.clamp(t / 0.35, 0, 1); p.lying = 1 - U.ease.outCubic(u); p.lyingDir = this.lyingDir; p.crouch = 0.5 * (1 - u); p.armL = 0.8; p.armR = 0.6; break; }
      case 'dodge': { const u = U.clamp(t / 0.38, 0, 1); p.lying = Math.sin(u * Math.PI); p.lyingDir = Math.cos((this.dodgeDir || 0) - this.facing) > 0 ? 1 : -1; p.crouch = 0.6; p.armL = 1.2; p.armR = 1.2; p.headTilt = 0.3; break; }
      case 'spin': { p.spin = 1; break; }
      case 'charge': { const u = U.clamp(t / 0.75, 0, 1); p.armL = U.lerp(1.2, 2.9, u); p.armR = U.lerp(1.2, 2.9, u); p.crouch = 0.4 * (1 - u); p.bob = Math.sin(t * 40) * u * 1.5; p.weaponAngle = Math.PI; break; }
      case 'burst': { const u = U.clamp(t / 0.5, 0, 1); p.armL = 2.0; p.armR = 2.0; p.armLFwd = 0.4; p.armRFwd = 0.4; p.crouch = 0.4 * u; p.lean = 0.1; break; }
      case 'dash': { const u = U.clamp(t / 0.24, 0, 1); p.lean = 0.4 * (1 - u); p.armR = U.lerp(2.6, -0.4, U.ease.outCubic(u)); p.armRFwd = 0.5; p.armL = 1.0; p.legL = 0.9; p.legR = -0.9; p.sideStep = 1; p.weaponAngle = Math.PI - 0.6; break; }
      case 'victory': { const u = t % 1.4; const j = Math.max(0, Math.sin(u / 1.4 * Math.PI * 2)); p.bob = -j * 14; p.armL = 2.9; p.armR = 2.9; p.weaponAngle = Math.PI; p.legL = -0.3 * j; p.legR = -0.3 * j; break; }
      case 'defeat': { const u = U.clamp(t / 0.6, 0, 1); p.crouch = 0.95 * u; p.lean = 0.35 * u; p.headTilt = 0.35 * u; p.armL = 0.3; p.armR = 0.3; p.weaponAngle = Math.PI + 1.2; break; }
      case 'intro': { const u = t % 1.6; p.armR = 2.7; p.armRFwd = 0.1; p.weaponAngle = Math.PI + Math.sin(u * 4) * 0.2; p.armL = 0.5; p.lean = -0.05; p.bob = Math.sin(t * 3) * 1.5; break; }
      case 'dead': { p.crouch = 1; break; }
      default: break;
    }
    if (this.status.freeze > 0) { p.bob = 0; p.armL = 1.0; p.armR = 1.0; }
    return p;
  }

  // ---------------- render ----------------
  render(ctx, cam, world) {
    const U = NT.Util; const pr = cam.project(this.x, this.y, this.z); const k = pr.k * this.scale;
    const ground = cam.project(this.x, 0, this.z);
    // shadow
    ctx.save(); ctx.globalAlpha = 0.35 * (1 - Math.min(1, this.y / 300)); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(ground.x, ground.y, 24 * k * (1 + this.y / 400), 9 * k * (1 + this.y / 400), 0, 0, U.TAU); ctx.fill(); ctx.restore();
    // afterimages
    for (const ai of this.afterimages) { const q = cam.project(ai.x, 0, ai.z); ctx.save(); ctx.translate(q.x, q.y); ctx.scale(q.k * this.scale, q.k * this.scale); NT.Minifig.draw(ctx, this.look, ai.pose, { facing: ai.facing, flat: this.specialState ? this.specialState.color : '#8fd3ff', alpha: 0.35 * (1 - ai.t / 0.25) }); ctx.restore(); }
    if (this.dead) return;
    // target ring for the current champion
    if (this.isChampion && !this.isPlayer) { ctx.save(); ctx.strokeStyle = 'rgba(255,80,80,0.55)'; ctx.lineWidth = 2.5 * k; ctx.setLineDash([6 * k, 5 * k]); ctx.beginPath(); ctx.ellipse(ground.x, ground.y, 34 * k, 13 * k, 0, 0, U.TAU); ctx.stroke(); ctx.restore(); }
    // spinjitzu tornado
    if (this.specialState && this.specialState.type === 'spinjitzu') { this.renderTornado(ctx, cam, pr, k); return; }
    // swing trail
    if (this.trail.length > 1 && this.attack) this.renderTrail(ctx, cam);
    // block shield glow
    if (this.blocking) { ctx.save(); const bx = ground.x + Math.cos(this.facing) * 26 * k, by = pr.y - 50 * k + Math.sin(this.facing) * 10 * k; ctx.globalAlpha = 0.55; ctx.fillStyle = '#8fd3ff'; ctx.shadowColor = '#8fd3ff'; ctx.shadowBlur = 14 * k; ctx.beginPath(); ctx.ellipse(bx, by, 16 * k, 30 * k, 0, 0, U.TAU); ctx.fill(); ctx.restore(); }
    // figure
    ctx.save(); ctx.translate(pr.x, pr.y); ctx.scale(k, k);
    const pose = this.pose();
    if (this.status.freeze > 0) { NT.Minifig.draw(ctx, this.look, pose, { facing: this.facing }); NT.Minifig.draw(ctx, this.look, pose, { facing: this.facing, flat: '#9ad9ff', alpha: 0.55 }); }
    else NT.Minifig.draw(ctx, this.look, pose, { facing: this.facing });
    if (this.flash > 0) NT.Minifig.draw(ctx, this.look, pose, { facing: this.facing, flat: '#ffffff', alpha: Math.min(1, this.flash * 6) });
    if (this.status.burn > 0) { ctx.fillStyle = 'rgba(255,120,30,0.25)'; ctx.beginPath(); ctx.ellipse(0, -55, 26, 45, 0, 0, U.TAU); ctx.fill(); }
    if (this.status.poison > 0) { ctx.fillStyle = 'rgba(120,220,40,0.22)'; ctx.beginPath(); ctx.ellipse(0, -55, 26, 45, 0, 0, U.TAU); ctx.fill(); }
    ctx.restore();
    // boss rage aura
    if (this.aura > 0) { ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(world.time * 12); ctx.strokeStyle = '#ff4a3a'; ctx.lineWidth = 3 * k; ctx.shadowColor = '#ff4a3a'; ctx.shadowBlur = 12 * k; ctx.beginPath(); ctx.ellipse(ground.x, ground.y, 36 * k, 14 * k, 0, 0, U.TAU); ctx.stroke(); ctx.restore(); }
    // charge glow for burst
    if (this.specialState && (this.specialState.type === 'burst' || this.specialState.type === 'cloud')) { ctx.save(); const u = Math.min(1, this.specialState.t / 0.75); ctx.globalAlpha = 0.5 * u; ctx.fillStyle = this.specialState.color; ctx.shadowColor = this.specialState.color; ctx.shadowBlur = 30 * k; ctx.beginPath(); ctx.ellipse(pr.x, pr.y - 55 * k, 40 * k * u, 60 * k * u, 0, 0, U.TAU); ctx.fill(); ctx.restore(); }
  }
  renderTrail(ctx, cam) {
    const U = NT.Util; const tr = this.trail; const E = NT.Elements[this.element] || NT.Elements.energy;
    ctx.save(); ctx.globalAlpha = 0.6; ctx.lineCap = 'round';
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i]; const rem = 1 - b.t / 0.12;
      const ang0 = a.facing + (a.u - 0.5) * 2.4, ang1 = b.facing + (b.u - 0.5) * 2.4;
      const p0 = cam.project(a.x + Math.cos(ang0) * 62, 50, a.z + Math.sin(ang0) * 62), p1 = cam.project(b.x + Math.cos(ang1) * 62, 50, b.z + Math.sin(ang1) * 62);
      const q0 = cam.project(a.x + Math.cos(ang0) * 30, 50, a.z + Math.sin(ang0) * 30), q1 = cam.project(b.x + Math.cos(ang1) * 30, 50, b.z + Math.sin(ang1) * 30);
      ctx.fillStyle = U.rgba(this.isPlayer ? E.c2 : '#ffffff', 0.5 * rem);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(q1.x, q1.y); ctx.lineTo(q0.x, q0.y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  renderTornado(ctx, cam, pr, k) {
    const U = NT.Util; const s = this.specialState; const t = s.t; const E = NT.Elements[this.element] || NT.Elements.energy;
    const c1 = s.color, c2 = s.color2 || E.c2;
    ctx.save(); ctx.translate(pr.x, pr.y); ctx.scale(k, k);
    const grow = Math.min(1, t * 4);
    // ground swirl
    ctx.globalAlpha = 0.5 * grow; ctx.strokeStyle = c2; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 60 * grow, 22 * grow, 0, 0, U.TAU); ctx.stroke();
    ctx.strokeStyle = c1; ctx.lineWidth = 5; ctx.setLineDash([26, 18]); ctx.lineDashOffset = -t * 400; ctx.beginPath(); ctx.ellipse(0, 0, 68 * grow, 26 * grow, 0, 0, U.TAU); ctx.stroke(); ctx.setLineDash([]);
    // faint spinning ninja
    ctx.globalAlpha = 0.3; NT.Minifig.draw(ctx, this.look, { armL: 2.0, armR: 2.0, legL: 0.5, legR: -0.5 }, { facing: t * 22 });
    // stacked cone layers
    ctx.globalAlpha = 1;
    const layers = 7;
    for (let i = 0; i < layers; i++) {
      const u = i / (layers - 1); const y = -12 - u * 105 * grow; const rw = (20 + u * 50) * grow, rh = rw * 0.38;
      const wob = Math.sin(t * 28 + i * 1.3) * 5;
      const g = ctx.createLinearGradient(-rw, 0, rw, 0); const ph = (t * 6 + i * 0.5) % 1;
      g.addColorStop(0, U.rgba(c1, 0.85)); g.addColorStop(Math.max(0.01, Math.min(0.99, ph)), U.rgba(c2, 0.95)); g.addColorStop(1, U.rgba(c1, 0.85));
      ctx.fillStyle = g; ctx.shadowColor = c1; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.ellipse(wob, y, rw, rh, 0, 0, U.TAU); ctx.fill();
      ctx.shadowBlur = 0; ctx.strokeStyle = U.rgba('#ffffff', 0.35); ctx.lineWidth = 1.5; ctx.stroke();
    }
    // spiral stroke
    ctx.strokeStyle = U.rgba('#ffffff', 0.6); ctx.lineWidth = 2.5; ctx.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.2) { const u = a / (Math.PI * 6); const r = (20 + u * 50) * grow; ctx.lineTo(Math.cos(a + t * 20) * r, -12 - u * 105 * grow + Math.sin(a + t * 20) * r * 0.38); }
    ctx.stroke();
    // top ring/outer glow lines
    ctx.strokeStyle = U.rgba(c2, 0.8); ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { const a = t * 15 + i * 2.1; ctx.beginPath(); ctx.ellipse(Math.cos(a) * 10, -60 - i * 25, 74 * grow, 26 * grow, 0, a, a + 1.6); ctx.stroke(); }
    ctx.restore();
  }
};
