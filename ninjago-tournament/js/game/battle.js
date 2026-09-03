/* ============================================================
   NT.Scenes.Battle — the arena fight: waves → champion → victory
   World: entities, projectiles, studs, zones, VFX, camera, HUD.
   ============================================================ */
NT.ArenaCache = {};
NT.Scenes = NT.Scenes || {};
NT.Scenes.Battle = class Battle {
  constructor(params) { this.params = params; }
  enter(params) {
    const U = NT.Util; const p = Object.assign({}, this.params, params);
    const d = NT.Save.get();
    this.arenaId = p.arenaId || d.currentArena; this.round = p.round != null ? p.round : d.currentRound; this.charId = p.charId || d.selectedChar;
    this.def = NT.Arenas.get(this.arenaId); this.plan = NT.Tournament.plan(this.arenaId, this.round);
    if (!NT.ArenaCache[this.arenaId]) NT.ArenaCache[this.arenaId] = new NT.ArenaRenderer(this.def);
    this.arena = NT.ArenaCache[this.arenaId];
    this.cam = new NT.Camera(); this.cam.resize(NT.Game.W, NT.Game.H);
    this.cam.bounds = this.def.shape === 'circle' ? { x: 0, z: 0, r: this.def.radius } : { x: 0, z: 0, r: Math.max(this.def.w, this.def.h) / 2 };
    this.vfx = new NT.VFX();
    this.entities = []; this.projectiles = []; this.studs = []; this.zones = [];
    this.time = 0; this.hitStop = 0; this.timeScale = 1; this.aiTokens = 0; this.maxTokens = 2 + Math.floor(NT.Tournament.arenaIndex(this.arenaId) / 3);
    this.studsCollected = 0; this.kills = 0; this.waveText = '';
    this.banners = []; this.spinBanner = null;
    const cdef = NT.Characters.get(this.charId) || NT.Characters.list[0];
    const lvl = NT.Save.charLevel(cdef.id).level;
    this.player = new NT.Fighter(cdef, { isPlayer: true, x: 0, z: 120, facing: -Math.PI / 2, level: lvl });
    this.entities.push(this.player);
    this.hud = new NT.HUD(this);
    this.controller = new NT.PlayerController(this.player, this.hud);
    this.hud.onAction = (a) => { if (this.phase === 'fight' || this.phase === 'champion' || this.phase === 'wave') this.controller.press(a, this); };
    this.hud.onPause = () => this.pause();
    this.champion = null; this.wave = -1; this.pending = []; this.phase = 'intro'; this.phaseT = 0;
    this.result = null; this.resultUI = null; this.spinjitzuBanner = null;
    this.cam.tx = this.player.x; this.cam.tz = this.player.z; this.cam.snap();
    NT.Audio.playMusic(this.plan.boss ? 'boss' : this.def.music);
    this.addBanner('round', `ROUND ${this.round + 1}`, this.def.name, 2.2);
    NT.Audio.play('gong');
    NT.Game.resize();
  }
  exit() { if (!this.hud) return; this.hud.releaseAll(); const hint = document.getElementById('rotate-hint'); if (hint) hint.classList.remove('show'); }
  resize(w, h) { if (!this.cam) return; this.cam.resize(w, h); this.hud.resize(w, h); if (this.resultUI) this.layoutResult(); }
  onSettingsChanged() { this.hud.layout(NT.Game.W, NT.Game.H); }
  onBlur() { if (this.phase === 'fight' || this.phase === 'wave' || this.phase === 'champion') this.pause(); }
  pause() { if (NT.SceneManager.topOverlay()) return; this.hud.releaseAll(); NT.SceneManager.pushOverlay(new NT.Overlays.Pause(this)); }
  restart() { NT.SceneManager.go(new NT.Scenes.Battle({ arenaId: this.arenaId, round: this.round, charId: this.charId }), {}, 'fade', 0.35); }
  exitToMenu() { NT.SceneManager.go(new NT.Scenes.ArenaSelect(), {}, 'iris'); }

  // ---------------- world helpers ----------------
  nearestEnemy(f, range, dir, arc) {
    let best = null, bd = range;
    for (const e of this.entities) { if (e === f || e.team === f.team || e.dead) continue; const d = f.distTo(e); if (d > bd) continue; if (dir != null && Math.abs(NT.Util.angleDiff(dir, f.angleTo(e))) > arc / 2) continue; bd = d; best = e; }
    return best;
  }
  spawnProjectile(owner, a) {
    const E = NT.Elements[owner.element] || NT.Elements.energy; const w = owner.look.weapon;
    const kind = w === 'shuriken' ? 'shuriken' : w === 'daggers' ? 'dagger' : w === 'bone' ? 'bone' : w === 'blaster' ? 'laser' : w === 'spear' ? 'dagger' : (owner.element === 'lightning' || owner.element === 'tech') ? 'bolt' : 'orb';
    const target = this.nearestEnemy(owner, 800); let dir = owner.facing; if (target) dir = owner.angleTo(target);
    this.projectiles.push({ x: owner.x + Math.cos(dir) * 24, y: 50 * owner.scale, z: owner.z + Math.sin(dir) * 24, vx: Math.cos(dir) * a.speed, vz: Math.sin(dir) * a.speed, owner, team: owner.team, dmg: owner.attackStat * a.dmg, life: 1.4, t: 0, kind, color: E.c1, color2: E.c2, dead: false, rot: 0 });
  }
  dropStuds(e, killer) {
    const n = e.def.studs || 3; const mult = 1 + Math.floor((this.player.combo || 0) / 10);
    for (let i = 0; i < n; i++) {
      const r = Math.random(); const val = r < 0.62 ? 10 : r < 0.92 ? 100 : r < 0.99 ? 1000 : 10000;
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 160;
      this.studs.push({ x: e.x, y: 30, z: e.z, vx: Math.cos(a) * s, vz: Math.sin(a) * s * 0.6, vy: 220 + Math.random() * 200, val: val * mult, t: 0, life: 12, magnet: false });
    }
  }
  addBanner(style, text, sub, dur) { this.banners.push({ style, text, sub, t: 0, dur }); }
  onSpinjitzu(f) { if (f.isPlayer) this.spinBanner = { t: 0 }; }
  onSpecial(f) { if (!f.isPlayer) { this.addBanner('special', f.special.name.toUpperCase(), f.name, 1.4); } else if (f.special.type !== 'spinjitzu') this.addBanner('special', f.special.name.toUpperCase(), null, 1.2); this.cam.tzoom = 1.08; setTimeout(() => { this.cam.tzoom = 1; }, 600); }
  onPlayerHit(pl, dmg) { this.hud.heartShake = 1; this.cam.shake(5, 0.2); }
  onComboMilestone(c) { this.hud.comboScale = 1; }
  onBossRage(f) { this.addBanner('special', 'ENRAGED!', f.name, 1.4); }
  onDeath(e, killer) {
    if (e.isPlayer) { this.setPhase('defeat'); return; }
    this.kills++;
    if (e.ai) e.ai.release(this);
    if (e === this.champion) { this.setPhase('victory'); }
  }

  // ---------------- phases ----------------
  setPhase(p) {
    this.phase = p; this.phaseT = 0;
    if (p === 'victory') {
      this.timeScale = 0.35; this.cam.tzoom = 1.35; NT.Audio.stopMusic(); NT.Audio.play('victory');
      this.player.setState('victory', 'victory'); this.player.attack = null; this.player.specialState = null; this.player.blockHeld = false;
      for (const e of this.entities) if (e !== this.player && !e.dead) { e.hp = 0; e.die(this, this.player); }
      this.addBanner('victory', 'VICTORY!', null, 3.2); this.hud.releaseAll();
    } else if (p === 'defeat') {
      this.timeScale = 0.45; this.cam.tzoom = 1.3; NT.Audio.stopMusic(); NT.Audio.play('defeat');
      this.addBanner('defeat', 'DEFEATED', null, 3.0); this.hud.releaseAll();
      for (const e of this.entities) if (!e.dead && !e.isPlayer) { e.moveInput.x = e.moveInput.z = 0; }
    } else if (p === 'champion_intro') {
      const cdef = NT.Characters.get(this.plan.champion);
      const sp = this.arena.randomPointOnEdge(90); const pl = this.player;
      // spawn on the far side of the player
      const a = Math.atan2(pl.z, pl.x) + Math.PI; const R = this.def.shape === 'circle' ? this.def.radius - 110 : Math.min(this.def.w, this.def.h) / 2 - 110;
      const bx = Math.cos(a) * R, bz = Math.sin(a) * R;
      const ch = new NT.Fighter(cdef, { x: bx, z: bz, level: 1, difficulty: this.plan.difficulty, champion: true, boss: this.plan.boss, facing: Math.atan2(pl.z - bz, pl.x - bx) });
      ch.ai = new NT.EnemyAI(ch, { ai: { aggression: 0.7, attackRate: 1.0, range: 70 + (cdef.look.scale - 1) * 40, blocks: 0.25, kind: 'boss', ranged: false }, boss: true });
      ch.setState('intro', 'intro'); ch.y = 300; ch.vy = 0;
      this.champion = ch; this.entities.push(ch);
      this.vfx.flash(bx, 40, bz, 120, '#ffffff');
      NT.Audio.play('boss_intro'); NT.Audio.playMusic('boss');
      this.addBanner('vs', 'VS', cdef.name, 2.4);
      this.cam.tzoom = 1.25;
    } else if (p === 'champion') { this.cam.tzoom = 1; this.addBanner('fight', 'FIGHT!', null, 1.0); this.waveText = this.plan.boss ? 'ARENA BOSS' : 'CHAMPION'; }
    else if (p === 'results') { this.buildResult(); }
  }
  startWave(i) {
    this.wave = i; const w = this.plan.waves[i]; this.pending = w.enemies.slice(); this.maxConcurrent = w.maxConcurrent;
    this.waveText = `WAVE ${i + 1} / ${this.plan.waves.length}`;
    if (i > 0) this.addBanner('wave', `WAVE ${i + 1}`, null, 1.2); else this.addBanner('fight', 'FIGHT!', null, 1.0);
    this.setPhase('wave'); this.spawnT = 0;
  }
  spawnPending() {
    if (!this.pending.length) return;
    const id = this.pending.shift(); const def = NT.Enemies.get(id);
    let sp, tries = 0; do { sp = this.arena.randomPointOnEdge(70); tries++; } while (tries < 10 && Math.hypot(sp.x - this.player.x, sp.z - this.player.z) < 260);
    const lvl = 1; const e = new NT.Fighter(def, { x: sp.x, z: sp.z, level: lvl, difficulty: this.plan.difficulty, facing: Math.atan2(this.player.z - sp.z, this.player.x - sp.x) });
    e.ai = new NT.EnemyAI(e, { ai: def.ai });
    e.y = 220; e.vy = 40; e.invuln = 0.7; e.setState('intro', 'intro'); e.stateT = 1.1; // drops in
    this.entities.push(e);
    this.vfx.dust(sp.x, sp.z, 3, 18);
  }
  liveEnemies() { let n = 0; for (const e of this.entities) if (!e.isPlayer && !e.dead) n++; return n; }

  // ---------------- update ----------------
  update(dt0) {
    const U = NT.Util;
    this.hud.update(dt0);
    this.controller.update(dt0, this);
    if (NT.Input.consumePressed('Escape') && (this.phase === 'wave' || this.phase === 'champion' || this.phase === 'fight')) { this.pause(); return; }
    for (const b of this.banners) b.t += dt0; this.banners = this.banners.filter((b) => b.t < b.dur);
    if (this.spinBanner) { this.spinBanner.t += dt0; if (this.spinBanner.t > 1.6) this.spinBanner = null; }
    this.phaseT += dt0;
    if (this.resultUI) { this.resultUI.update(dt0); this.resultT = (this.resultT || 0) + dt0; }
    // hit stop (freeze frames)
    if (this.hitStop > 0) { this.hitStop -= dt0; this.cam.update(dt0); return; }
    const dt = dt0 * this.timeScale; this.time += dt;
    // phase machine
    switch (this.phase) {
      case 'intro': if (this.phaseT > 1.6) this.startWave(0); break;
      case 'wave': {
        this.spawnT -= dt; if (this.pending.length && this.liveEnemies() < this.maxConcurrent && this.spawnT <= 0) { this.spawnPending(); this.spawnT = 0.5 + Math.random() * 0.4; }
        if (!this.pending.length && this.liveEnemies() === 0 && this.phaseT > 1) { if (this.wave + 1 < this.plan.waves.length) this.startWave(this.wave + 1); else this.setPhase('champion_intro'); }
        break;
      }
      case 'champion_intro': if (this.phaseT > 2.3) this.setPhase('champion'); break;
      case 'champion': break;
      case 'victory': if (this.phaseT > 1.2) this.timeScale = U.damp(this.timeScale, 1, 3, dt0); if (this.phaseT > 3.4) this.setPhase('results'); break;
      case 'defeat': if (this.phaseT > 1.0) this.timeScale = U.damp(this.timeScale, 0.8, 3, dt0); if (this.phaseT > 3.0 && !this.resultUI) this.buildDefeat(); break;
    }
    // entities
    for (const e of this.entities) { if (e.ai && this.phase !== 'defeat') e.ai.update(dt, this); e.update(dt, this); }
    this.physics(dt);
    // projectiles
    for (const p of this.projectiles) {
      p.t += dt; p.rot += dt * 20; p.x += p.vx * dt; p.z += p.vz * dt; if (p.t > p.life) p.dead = true;
      if (!this.arena.inside(p.x, p.z, -60)) p.dead = true;
      if (p.dead) continue;
      for (const e of this.entities) { if (e.team === p.team || e.dead) continue; if (Math.hypot(e.x - p.x, e.z - p.z) < e.radius + 16) { p.dead = true; const r = e.takeHit(p.owner, { dmg: p.dmg, kb: 160, stun: 0.4, dir: Math.atan2(p.vz, p.vx), element: true }, this); if (r === 'hit' || r === 'miss') this.vfx.sparks(p.x, p.y, p.z, 5, p.color, 180); break; } }
      if (p.dead) this.vfx.flash(p.x, p.y, p.z, 24, p.color);
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    // studs
    const pl = this.player;
    for (const s of this.studs) {
      s.t += dt; if (s.t > s.life) s.dead = true;
      if (s.magnet || (!pl.dead && Math.hypot(pl.x - s.x, pl.z - s.z) < 120 && s.t > 0.35)) {
        s.magnet = true; const dx = pl.x - s.x, dz = pl.z - s.z, dy = 40 - s.y, d = Math.hypot(dx, dz) || 1; const sp = 900;
        s.x += (dx / d) * sp * dt; s.z += (dz / d) * sp * dt; s.y += dy * 10 * dt;
        if (d < 22) { s.dead = true; this.studsCollected += s.val; this.hud.studPop = 1; NT.Audio.play(s.val >= 1000 ? 'stud_blue' : s.val >= 100 ? 'stud_gold' : 'stud', { minGap: 40 }); if (s.val >= 1000) this.vfx.floatText(pl.x, 60, pl.z, '+' + U.fmtNum(s.val), s.val >= 10000 ? '#d8b4ff' : '#8fd3ff', 20); }
      } else { s.vy -= 900 * dt; s.x += s.vx * dt; s.z += s.vz * dt; s.y += s.vy * dt; if (s.y < 0) { s.y = 0; s.vy = -s.vy * 0.45; s.vx *= 0.7; s.vz *= 0.7; if (Math.abs(s.vy) < 30) s.vy = 0; } this.arena.clamp(s, 10); }
    }
    this.studs = this.studs.filter((s) => !s.dead);
    // zones (clouds)
    for (const z of this.zones) { z.t += dt; z.tick += dt; if (z.tick > 0.5) { z.tick = 0; for (let i = 0; i < 3; i++) this.vfx.smoke(z.x + (Math.random() - 0.5) * z.r * 2, 5, z.z + (Math.random() - 0.5) * z.r * 1.5, 1, z.color); for (const e of this.entities) { if (e.team === z.team || e.dead) continue; if (Math.hypot(e.x - z.x, e.z - z.z) < z.r) { e.status.slow = 0.6; e.hp -= Math.max(1, Math.round(z.owner.attackStat * 0.35)); e.flash = 0.06; e.status.poison = Math.max(e.status.poison, 0.6); if (e.hp <= 0) e.die(this, z.owner); } } } }
    this.zones = this.zones.filter((z) => z.t < z.life);
    this.vfx.update(dt);
    this.arena.ambient(this.vfx, dt, this.cam);
    this.entities = this.entities.filter((e) => !e.remove);
    // camera
    let tx = pl.x, tz = pl.z; let n = 0, ex = 0, ez = 0;
    for (const e of this.entities) if (!e.isPlayer && !e.dead && e.distTo(pl) < 520) { ex += e.x; ez += e.z; n++; }
    if (n) { tx = U.lerp(pl.x, ex / n, 0.28); tz = U.lerp(pl.z, ez / n, 0.28); }
    if (this.phase === 'champion_intro' && this.champion) { tx = U.lerp(pl.x, this.champion.x, 0.7); tz = U.lerp(pl.z, this.champion.z, 0.7); }
    if (this.phase === 'victory' || this.phase === 'defeat' || this.phase === 'results') { tx = pl.x; tz = pl.z - 30; }
    this.cam.tx = tx; this.cam.tz = tz + (this.hud.land ? 30 : 60);
    this.cam.update(dt0);
  }
  physics(dt) {
    const es = this.entities;
    for (let i = 0; i < es.length; i++) {
      const a = es[i]; if (a.dead) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j]; if (b.dead) continue;
        const dx = b.x - a.x, dz = b.z - a.z; const d = Math.hypot(dx, dz); const min = a.radius + b.radius + 4;
        if (d < min && d > 0.001) { const push = (min - d) * 0.5; const wa = b.weight / (a.weight + b.weight), wb = a.weight / (a.weight + b.weight); const nx = dx / d, nz = dz / d; a.x -= nx * push * wa * 2; a.z -= nz * push * wa * 2; b.x += nx * push * wb * 2; b.z += nz * push * wb * 2; }
      }
      // obstacles
      for (const o of this.def.obstacles) { const dx = a.x - o.x, dz = a.z - o.z, d = Math.hypot(dx, dz), min = o.r + a.radius; if (d < min && d > 0.001) { a.x = o.x + (dx / d) * min; a.z = o.z + (dz / d) * min; } }
      if (this.arena.clamp(a, a.radius + 6)) { a.vx *= 0.5; a.vz *= 0.5; }
    }
  }

  // ---------------- results ----------------
  buildResult() {
    const pl = this.player; const hearts = pl.hp / pl.maxHp;
    this.levelBefore = NT.Progression.levelInfo(this.charId);
    const res = NT.Progression.awardVictory(this.plan, { maxCombo: pl.maxCombo, hearts, studsCollected: this.studsCollected, kills: this.kills, charId: this.charId });
    this.result = res; this.resultT = 0;
    this.resultUI = new NT.UI.UILayer(); this.layoutResult();
    NT.Audio.playMusic('menu');
    for (const u of res.unlocks) if (u.type === 'character') setTimeout(() => NT.Audio.play('unlock'), 900);
  }
  layoutResult() {
    if (!this.resultUI) return; const W = NT.Game.W, H = NT.Game.H; const s = Math.max(0.7, Math.min(W / 900, H / 640)); this.rs = s;
    this.resultUI.clear();
    if (this.result) this.resultUI.add({ id: 'continue', x: W / 2, y: H / 2 + 200 * s, w: 220 * s, h: 50 * s, shape: 'rect', onTap: () => NT.SceneManager.go(new NT.Scenes.TruePotential(), { charId: this.charId, result: this.result, plan: this.plan, before: this.levelBefore }, 'iris'), draw: (ctx, b) => NT.UI.pillButton(ctx, b.x, b.y, b.w, b.h, 'CONTINUE', { press: b.press, icon: NT.UI.Icons.play }) });
    else { this.resultUI.add({ id: 'retry', x: W / 2 - 110 * s, y: H / 2 + 120 * s, w: 190 * s, h: 50 * s, shape: 'rect', onTap: () => this.restart(), draw: (ctx, b) => NT.UI.pillButton(ctx, b.x, b.y, b.w, b.h, 'RETRY', { press: b.press, icon: NT.UI.Icons.restart, color: '#2a7a3a' }) });
      this.resultUI.add({ id: 'exit', x: W / 2 + 110 * s, y: H / 2 + 120 * s, w: 190 * s, h: 50 * s, shape: 'rect', onTap: () => this.exitToMenu(), draw: (ctx, b) => NT.UI.pillButton(ctx, b.x, b.y, b.w, b.h, 'EXIT', { press: b.press, icon: NT.UI.Icons.back, color: '#7a2a3a' }) }); }
  }
  buildDefeat() { this.result = null; this.defeatRes = NT.Progression.awardDefeat({ studsCollected: this.studsCollected, kills: this.kills }); this.resultUI = new NT.UI.UILayer(); this.layoutResult(); this.resultT = 0; }

  // ---------------- input ----------------
  onPointerDown(p) { if (this.resultUI) { this.resultUI.onPointerDown(p); return; } if (this.phase === 'victory' || this.phase === 'defeat') return; this.hud.onPointerDown(p); }
  onPointerMove(p) { if (this.resultUI) { this.resultUI.onPointerMove(p); return; } this.hud.onPointerMove(p); }
  onPointerUp(p) { if (this.resultUI) { this.resultUI.onPointerUp(p); return; } this.hud.onPointerUp(p); }
  onKeyDown(c) { if (this.resultUI && (c === 'Enter' || c === 'Space')) { const b = this.resultUI.get('continue') || this.resultUI.get('retry'); if (b) b.onTap(); } }

  // ---------------- render ----------------
  render(ctx) {
    const W = NT.Game.W, H = NT.Game.H, cam = this.cam, U = NT.Util;
    this.arena.renderSky(ctx, cam, W, H, this.time);
    this.arena.renderFloor(ctx, cam, W, H);
    // zones on the ground
    for (const z of this.zones) { const p = cam.project(z.x, 0, z.z); ctx.save(); ctx.globalAlpha = 0.28 * Math.min(1, z.t * 3) * Math.min(1, (z.life - z.t)); ctx.fillStyle = z.color; ctx.beginPath(); ctx.ellipse(p.x, p.y, z.r * p.k, z.r * p.k * (cam.H / cam.L), 0, 0, U.TAU); ctx.fill(); ctx.restore(); }
    this.vfx.renderGround(ctx, cam);
    // depth-sorted drawables
    const list = this.arena.drawables(cam, this.time);
    for (const e of this.entities) list.push({ z: e.z, draw: (c) => e.render(c, cam, this) });
    for (const p of this.projectiles) list.push({ z: p.z, draw: (c) => this.drawProjectile(c, p) });
    for (const s of this.studs) list.push({ z: s.z, draw: (c) => this.drawStud(c, s) });
    list.sort((a, b) => a.z - b.z);
    for (const d of list) d.draw(ctx);
    this.vfx.renderAir(ctx, cam);
    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (this.phase === 'victory' || this.phase === 'defeat' || this.phase === 'results') { ctx.fillStyle = `rgba(0,0,0,${Math.min(0.35, this.phaseT * 0.2)})`; ctx.fillRect(0, 0, W, H); }
    if (!this.resultUI) this.hud.render(ctx, this);
    this.renderBanners(ctx, W, H);
    if (this.resultUI) this.renderResult(ctx, W, H);
  }
  drawProjectile(ctx, p) {
    const cam = this.cam; const s = cam.project(p.x, p.y, p.z); const k = s.k; const U = NT.Util;
    ctx.save(); ctx.translate(s.x, s.y);
    const g = cam.project(p.x, 0, p.z); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, g.y - s.y, 8 * k, 3 * k, 0, 0, U.TAU); ctx.fill();
    ctx.scale(k, k);
    switch (p.kind) {
      case 'shuriken': ctx.rotate(p.rot); ctx.fillStyle = '#e4e9ee'; for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); NT.Minifig.poly(ctx, [0, 0, 6, -5, 0, -16, -6, -5]); ctx.fill(); } ctx.fillStyle = '#7a8290'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, U.TAU); ctx.fill(); break;
      case 'dagger': case 'bone': ctx.rotate(Math.atan2(p.vz * 0.6, p.vx) + Math.PI / 2 + (p.kind === 'bone' ? p.rot : 0)); ctx.fillStyle = p.kind === 'bone' ? '#f0eee6' : '#e4e9ee'; NT.Minifig.rr(ctx, -2.5, -14, 5, 28, 2.5); ctx.fill(); if (p.kind === 'dagger') { ctx.fillStyle = '#e0b14a'; ctx.fillRect(-5, 6, 10, 3); } else { ctx.beginPath(); ctx.arc(-3, -14, 3.5, 0, U.TAU); ctx.arc(3, -14, 3.5, 0, U.TAU); ctx.arc(-3, 14, 3.5, 0, U.TAU); ctx.arc(3, 14, 3.5, 0, U.TAU); ctx.fill(); } break;
      case 'laser': ctx.rotate(Math.atan2(p.vz * 0.6, p.vx)); ctx.shadowColor = '#ff3b3b'; ctx.shadowBlur = 12; ctx.fillStyle = '#ff5050'; NT.Minifig.rr(ctx, -16, -3, 32, 6, 3); ctx.fill(); ctx.fillStyle = '#fff'; NT.Minifig.rr(ctx, -12, -1.5, 24, 3, 1.5); ctx.fill(); break;
      case 'bolt': ctx.shadowColor = p.color; ctx.shadowBlur = 14; ctx.strokeStyle = p.color2; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-4, -8); ctx.lineTo(2, 4); ctx.lineTo(14, -4); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); break;
      default: { ctx.shadowColor = p.color; ctx.shadowBlur = 16; const gr = ctx.createRadialGradient(0, 0, 2, 0, 0, 12); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, p.color2); gr.addColorStop(1, p.color); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, 12, 0, U.TAU); ctx.fill(); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.ellipse(-p.vx * 0.03, -p.vz * 0.02, 10, 6, Math.atan2(p.vz * 0.6, p.vx), 0, U.TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  drawStud(ctx, s) {
    const cam = this.cam; const p = cam.project(s.x, s.y, s.z); const k = p.k; const U = NT.Util;
    const col = s.val >= 10000 ? ['#c9a0ff', '#8a3cff'] : s.val >= 1000 ? ['#8fd3ff', '#1f5fbf'] : s.val >= 100 ? ['#ffe08a', '#c8891a'] : ['#e8ecf0', '#8a929e'];
    const g = cam.project(s.x, 0, s.z);
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(g.x, g.y, 7 * k, 3 * k, 0, 0, U.TAU); ctx.fill();
    ctx.translate(p.x, p.y); ctx.scale(k, k); const r = s.val >= 1000 ? 9 : 8;
    if (s.t < 0.6) { ctx.shadowColor = col[0]; ctx.shadowBlur = 10; }
    ctx.fillStyle = col[1]; ctx.beginPath(); ctx.ellipse(0, 2, r, r * 0.55, 0, 0, U.TAU); ctx.fill(); ctx.fillRect(-r, -2, r * 2, 4);
    ctx.fillStyle = col[0]; ctx.beginPath(); ctx.ellipse(0, -2, r, r * 0.55, 0, 0, U.TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-r * 0.3, -3, r * 0.3, r * 0.15, 0, 0, U.TAU); ctx.fill();
    ctx.restore();
  }
  renderBanners(ctx, W, H) {
    const UI = NT.UI, U = NT.Util; const base = Math.min(W, H * 1.4);
    for (const b of this.banners) {
      const u = b.t / b.dur; const inT = Math.min(1, b.t / 0.3); const outT = U.clamp((b.dur - b.t) / 0.3, 0, 1);
      ctx.save();
      if (b.style === 'round') {
        const y = U.lerp(-80, H * 0.22, U.ease.outBack(inT)) - (1 - outT) * 60; ctx.globalAlpha = outT;
        UI.scroll(ctx, W / 2, y, Math.min(W * 0.7, 520), Math.max(44, base * 0.08), b.text, { size: base * 0.045 });
        UI.goldText(ctx, b.sub, W / 2, y + base * 0.07, base * 0.028, { mid: '#fff0b0' });
      } else if (b.style === 'fight' || b.style === 'victory' || b.style === 'defeat') {
        const sc = U.ease.outBack(inT) * (b.style === 'fight' ? 1 : 1); ctx.globalAlpha = outT; ctx.translate(W / 2, H * 0.36); ctx.scale(sc, sc);
        const col = b.style === 'defeat' ? { top: '#ff9a9a', mid: '#ff3a3a', bot: '#7a0a0a' } : b.style === 'victory' ? { top: '#fff6c8', mid: '#f4c542', bot: '#b0701a' } : { top: '#fff0b0', mid: '#ff9a2a', bot: '#b0401a' };
        UI.goldText(ctx, b.text, 0, 0, base * (b.style === 'fight' ? 0.12 : 0.1), Object.assign({ weight: '900', strokeWidth: base * 0.014 }, col));
      } else if (b.style === 'wave') {
        ctx.globalAlpha = outT; UI.goldText(ctx, b.text, W / 2, H * 0.3 - (1 - inT) * 30, base * 0.06, { weight: '900' });
      } else if (b.style === 'vs') {
        ctx.globalAlpha = Math.min(inT, outT); const pl = this.player, ch = this.champion;
        const pr = base * 0.07; const y = H * 0.24;
        UI.scroll(ctx, W / 2, y, Math.min(W * 0.82, 640), Math.max(46, base * 0.085), null);
        UI.goldText(ctx, 'VS', W / 2, y, base * 0.06, { weight: '900', top: '#fff', mid: '#ff5a5a', bot: '#8a0a0a', strokeWidth: base * 0.008 });
        const lx = W / 2 - base * 0.19, rx = W / 2 + base * 0.19;
        NT.Minifig.drawPortrait(ctx, pl.look, lx, y, pr * 0.85); UI.goldRing(ctx, lx, y, pr * 0.9, pr * 0.12);
        if (ch) { NT.Minifig.drawPortrait(ctx, ch.look, rx, y, pr * 0.85, { bg: '#7a2a3a', bg2: '#2a0f1a' }); UI.goldRing(ctx, rx, y, pr * 0.9, pr * 0.12); }
        UI.text(ctx, pl.name, lx, y + pr * 1.2, { size: base * 0.022, color: '#ffe9a0', stroke: '#2a1408', strokeWidth: 3 });
        UI.text(ctx, b.sub, rx, y + pr * 1.2, { size: base * 0.022, color: '#ff9a9a', stroke: '#2a1408', strokeWidth: 3 });
        if (this.plan.boss) UI.goldText(ctx, 'ARENA BOSS', W / 2, y + pr * 1.25, base * 0.03, { mid: '#ff5a5a', top: '#ffb0b0', bot: '#7a0a0a' });
      } else if (b.style === 'special') {
        ctx.globalAlpha = outT; const x = U.lerp(W * 0.2, W * 0.5, U.ease.outCubic(inT)); ctx.translate(x, H * 0.2);
        ctx.fillStyle = 'rgba(40,20,90,0.85)'; ctx.transform(1, 0, -0.3, 1, 0, 0); ctx.fillRect(-base * 0.24, -base * 0.03, base * 0.48, base * 0.06); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(x, H * 0.2);
        UI.text(ctx, b.text, 0, 0, { size: base * 0.036, color: '#fff', stroke: '#2a0a3a', strokeWidth: 4, italic: true, weight: '900' });
        if (b.sub) UI.text(ctx, b.sub, 0, base * 0.045, { size: base * 0.02, color: '#ffe9a0', stroke: '#2a1408', strokeWidth: 3 });
      }
      ctx.restore();
    }
    // SPINJITZU! banner (slanted purple ribbon with white italic text)
    if (this.spinBanner) {
      const t = this.spinBanner.t; const inT = Math.min(1, t / 0.25), outT = U.clamp((1.6 - t) / 0.3, 0, 1);
      const pl = this.player; const p = this.cam.project(pl.x, 90, pl.z);
      const x = U.lerp(p.x - W * 0.5, p.x - base * 0.02, U.ease.outCubic(inT)) + t * 20; const y = p.y - base * 0.06;
      ctx.save(); ctx.globalAlpha = outT; ctx.translate(x, y); ctx.rotate(-0.06);
      const bw = base * 0.36, bh = base * 0.07;
      ctx.fillStyle = '#4a2aa8'; ctx.beginPath(); ctx.moveTo(-bw / 2, -bh / 2 + 6); ctx.lineTo(bw / 2, -bh / 2 - 6); ctx.lineTo(bw / 2 - 10, bh / 2 - 4); ctx.lineTo(-bw / 2 + 12, bh / 2 + 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8a63ff'; ctx.lineWidth = 3; ctx.stroke();
      ctx.rotate(-0.04);
      UI.text(ctx, 'SPINJITZU!', 0, 2, { size: bh * 0.7, color: '#ffffff', stroke: '#1a0a3a', strokeWidth: bh * 0.12, italic: true, weight: '900' });
      ctx.restore();
    }
  }
  renderResult(ctx, W, H) {
    const UI = NT.UI, U = NT.Util; const s = this.rs || 1; const t = this.resultT || 0; const pop = U.ease.outBack(Math.min(1, t * 3));
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(pop, pop); ctx.translate(-W / 2, -H / 2);
    if (this.result) {
      const r = this.result; const pw = Math.min(W * 0.92, 560 * s), ph = 470 * s; const x0 = W / 2 - pw / 2, y0 = H / 2 - ph / 2 + 10 * s;
      UI.panel(ctx, x0, y0, pw, ph);
      UI.scroll(ctx, W / 2, y0, Math.min(pw * 0.85, 420 * s), 52 * s, `ROUND ${this.round + 1} COMPLETE`, { size: 22 * s });
      const rows = [['Studs collected', r.collected], ['Round bonus', r.base], [`Combo bonus (${this.player.maxCombo}x)`, r.comboBonus]];
      let y = y0 + 75 * s; const lx = x0 + 40 * s, rx = x0 + pw - 40 * s;
      rows.forEach(([label, val], i) => { const show = t > 0.4 + i * 0.35; if (!show) return; UI.text(ctx, label, lx, y, { size: 18 * s, color: '#fff', align: 'left' }); UI.goldText(ctx, '+' + U.fmtNum(val), rx, y, 20 * s, { align: 'right' }); y += 34 * s; });
      if (t > 1.6) { ctx.strokeStyle = '#e0b14a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, y - 8 * s); ctx.lineTo(rx, y - 8 * s); ctx.stroke(); UI.text(ctx, 'TOTAL STUDS', lx, y + 12 * s, { size: 20 * s, color: '#ffe9a0', align: 'left' }); ctx.save(); ctx.translate(rx - 150 * s, y + 12 * s); ctx.scale(0.28 * s, 0.28 * s); UI.Icons.stud(ctx); ctx.restore(); UI.goldText(ctx, '+' + U.fmtNum(r.studs), rx, y + 12 * s, 26 * s, { align: 'right', mid: '#ffd66a' }); }
      y += 56 * s;
      if (t > 2.0) { ctx.save(); ctx.translate(lx + 16 * s, y + 4 * s); ctx.scale(0.35 * s, 0.35 * s); UI.Icons.xp(ctx); ctx.restore(); UI.text(ctx, 'Experience', lx + 44 * s, y + 4 * s, { size: 18 * s, color: '#fff', align: 'left' }); UI.goldText(ctx, '+' + r.xp + ' XP', rx, y + 4 * s, 20 * s, { align: 'right', mid: '#c8a8ff' }); }
      y += 40 * s;
      if (t > 2.3) { let uy = y; for (const u of r.unlocks) { UI.goldText(ctx, u.type === 'character' ? `NEW CHARACTER: ${u.name}` : `NEW ARENA: ${u.name}`, W / 2, uy + 6 * s, 17 * s, { mid: '#8fff8f', top: '#e0ffe0', bot: '#2a7a2a' }); uy += 26 * s; } if (!r.unlocks.length && NT.Tournament.isTournamentComplete()) UI.goldText(ctx, 'TOURNAMENT OF ELEMENTS COMPLETE!', W / 2, uy + 6 * s, 17 * s); }
    } else {
      const pw = Math.min(W * 0.9, 480 * s), ph = 300 * s; const x0 = W / 2 - pw / 2, y0 = H / 2 - ph / 2 + 10 * s;
      UI.panel(ctx, x0, y0, pw, ph);
      UI.scroll(ctx, W / 2, y0, Math.min(pw * 0.85, 360 * s), 52 * s, 'DEFEATED', { size: 24 * s });
      UI.text(ctx, `${this.player.name} was defeated in Round ${this.round + 1}.`, W / 2, y0 + 80 * s, { size: 17 * s, color: '#fff' });
      UI.text(ctx, `Enemies defeated: ${this.kills}   ·   Best combo: ${this.player.maxCombo}x`, W / 2, y0 + 112 * s, { size: 15 * s, color: '#ffe9a0' });
      UI.goldText(ctx, `Studs kept: +${U.fmtNum(this.defeatRes ? this.defeatRes.studs : 0)}`, W / 2, y0 + 150 * s, 20 * s, { mid: '#ffd66a' });
    }
    this.resultUI.render(ctx);
    ctx.restore();
  }
};
