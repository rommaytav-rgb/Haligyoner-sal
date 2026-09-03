/* ============================================================
   NT.Audio — WebAudio SFX + procedural music.
   Every sound is synthesized so the game ships with no
   copyrighted audio. Drop files into assets/audio/<name>.mp3
   (see MANIFEST) and they will be used instead of synthesis.
   ============================================================ */
NT.Audio = (function () {
  let ctx = null, master = null, sfxGain = null, musicGain = null, unlocked = false;
  const buffers = {};   // name -> AudioBuffer (from files, optional)
  const MANIFEST = ['click', 'back', 'whoosh', 'swing', 'swing2', 'swing3', 'hit', 'hit2', 'heavy', 'kick', 'slam', 'block', 'parry', 'dodge',
    'spin_start', 'stud', 'stud_gold', 'stud_blue', 'hurt', 'break', 'victory', 'defeat', 'gong', 'unlock', 'levelup', 'fire', 'ice', 'lightning',
    'earth', 'energy', 'step', 'throw', 'boss_intro', 'combo', 'select', 'gift', 'buy', 'error', 'jump', 'land', 'burst'];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.connect(master);
      musicGain = ctx.createGain(); musicGain.connect(master);
      applySettings();
      loadFiles();
      return true;
    } catch (e) { return false; }
  }
  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!unlocked) { unlocked = true; startMusicIfPending(); }
  }
  function applySettings() {
    if (!ctx) return;
    const s = NT.Save.get().settings;
    sfxGain.gain.value = s.sfx ? 1 : 0;
    musicGain.gain.value = s.music ? 0.55 : 0;
  }
  function loadFiles() {
    // optional real audio files (replaceable assets) — only probed over http(s)
    if (!/^https?:/.test(location.protocol)) return;
    const base = 'assets/audio/';
    for (const n of MANIFEST) {
      fetch(base + n + '.mp3').then((r) => (r.ok ? r.arrayBuffer() : null)).then((ab) => {
        if (!ab) return;
        return ctx.decodeAudioData(ab).then((buf) => { buffers[n] = buf; });
      }).catch(() => {});
    }
  }

  // ---------- synthesis helpers ----------
  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    const len = ctx.sampleRate * 1.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function env(g, t0, a, d, peak = 1, sustain = 0, r = 0.05, hold = 0) {
    g.gain.cancelScheduledValues(t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t0 + a + d);
    if (hold > 0) g.gain.setValueAtTime(Math.max(0.0001, sustain), t0 + a + d + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + hold + r);
  }
  function osc(type, f0, t0, dur, gain = 0.3, f1 = null, dest = null) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 != null) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.1);
    return { o, g };
  }
  function noiseBurst(t0, dur, gain, filterType = 'bandpass', f0 = 1000, f1 = null, q = 1, dest = null) {
    const s = ctx.createBufferSource(); s.buffer = noise();
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.setValueAtTime(f0, t0); f.Q.value = q;
    if (f1 != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(dest || sfxGain);
    s.start(t0); s.stop(t0 + dur + 0.1);
    return { s, g, f };
  }

  const SYNTH = {
    click(t) { const { g } = osc('square', 900, t, 0.06, 0.2, 600); env(g, t, 0.003, 0.05, 0.25); const n = noiseBurst(t, 0.04, 0.1, 'highpass', 3000); env(n.g, t, 0.002, 0.03, 0.15); },
    select(t) { const a = osc('triangle', 660, t, 0.12, 0.3, 880); env(a.g, t, 0.005, 0.1, 0.3); const b = osc('triangle', 990, t + 0.06, 0.15, 0.25); env(b.g, t + 0.06, 0.005, 0.12, 0.25); },
    back(t) { const a = osc('triangle', 700, t, 0.12, 0.3, 420); env(a.g, t, 0.005, 0.1, 0.3); },
    whoosh(t) { const n = noiseBurst(t, 0.35, 0.3, 'bandpass', 400, 2400, 0.8); env(n.g, t, 0.05, 0.25, 0.35); },
    swing(t) { const n = noiseBurst(t, 0.16, 0.3, 'bandpass', 1800, 500, 1.2); env(n.g, t, 0.01, 0.13, 0.35); },
    swing2(t) { const n = noiseBurst(t, 0.16, 0.3, 'bandpass', 2200, 600, 1.2); env(n.g, t, 0.01, 0.13, 0.35); },
    swing3(t) { const n = noiseBurst(t, 0.24, 0.35, 'bandpass', 2600, 400, 1.0); env(n.g, t, 0.01, 0.2, 0.45); const o = osc('sawtooth', 300, t, 0.2, 0.08, 120); env(o.g, t, 0.01, 0.18, 0.1); },
    hit(t) { const o = osc('square', 220, t, 0.09, 0.3, 90); env(o.g, t, 0.002, 0.08, 0.35); const n = noiseBurst(t, 0.08, 0.3, 'lowpass', 2500, 400); env(n.g, t, 0.002, 0.07, 0.4); },
    hit2(t) { const o = osc('square', 260, t, 0.09, 0.3, 100); env(o.g, t, 0.002, 0.08, 0.35); const n = noiseBurst(t, 0.09, 0.3, 'bandpass', 1500, 300, 0.7); env(n.g, t, 0.002, 0.08, 0.4); },
    heavy(t) { const o = osc('sine', 140, t, 0.3, 0.6, 40); env(o.g, t, 0.003, 0.25, 0.7); const n = noiseBurst(t, 0.2, 0.4, 'lowpass', 1800, 200); env(n.g, t, 0.003, 0.18, 0.5); },
    kick(t) { const o = osc('sine', 200, t, 0.15, 0.5, 60); env(o.g, t, 0.003, 0.13, 0.55); const n = noiseBurst(t, 0.1, 0.3, 'bandpass', 900, 300); env(n.g, t, 0.002, 0.09, 0.35); },
    slam(t) { const o = osc('sine', 90, t, 0.5, 0.8, 30); env(o.g, t, 0.005, 0.45, 0.9); const n = noiseBurst(t, 0.4, 0.5, 'lowpass', 1200, 100); env(n.g, t, 0.005, 0.35, 0.6); },
    block(t) { const o = osc('triangle', 1400, t, 0.12, 0.25, 900); env(o.g, t, 0.002, 0.1, 0.3); const n = noiseBurst(t, 0.1, 0.25, 'highpass', 2500); env(n.g, t, 0.002, 0.08, 0.3); },
    parry(t) { const o = osc('triangle', 2000, t, 0.25, 0.3, 1500); env(o.g, t, 0.002, 0.2, 0.35); const o2 = osc('sine', 3000, t, 0.3, 0.15, 2400); env(o2.g, t, 0.002, 0.28, 0.2); },
    dodge(t) { const n = noiseBurst(t, 0.22, 0.25, 'bandpass', 600, 1800, 1); env(n.g, t, 0.02, 0.18, 0.3); },
    jump(t) { const o = osc('sine', 300, t, 0.18, 0.2, 700); env(o.g, t, 0.01, 0.15, 0.25); },
    land(t) { const o = osc('sine', 120, t, 0.15, 0.4, 50); env(o.g, t, 0.003, 0.12, 0.45); },
    spin_start(t) { const n = noiseBurst(t, 0.9, 0.35, 'bandpass', 300, 3000, 1.5); env(n.g, t, 0.15, 0.7, 0.4); const o = osc('sawtooth', 120, t, 0.9, 0.12, 700); env(o.g, t, 0.1, 0.75, 0.15); },
    stud(t) { const o = osc('sine', 1900, t, 0.09, 0.22, 2600); env(o.g, t, 0.002, 0.08, 0.25); },
    stud_gold(t) { const o = osc('sine', 2200, t, 0.12, 0.25, 3200); env(o.g, t, 0.002, 0.1, 0.28); const o2 = osc('sine', 3300, t + 0.04, 0.1, 0.15); env(o2.g, t + 0.04, 0.002, 0.08, 0.18); },
    stud_blue(t) { [1500, 2000, 2500, 3000].forEach((f, i) => { const o = osc('sine', f, t + i * 0.04, 0.12, 0.2); env(o.g, t + i * 0.04, 0.002, 0.1, 0.22); }); },
    hurt(t) { const o = osc('sawtooth', 400, t, 0.18, 0.2, 150); env(o.g, t, 0.003, 0.15, 0.25); const n = noiseBurst(t, 0.12, 0.3, 'lowpass', 1500, 300); env(n.g, t, 0.003, 0.1, 0.35); },
    break(t) { for (let i = 0; i < 5; i++) { const tt = t + i * 0.03; const o = osc('square', 900 + Math.random() * 1200, tt, 0.05, 0.12, 300); env(o.g, tt, 0.002, 0.045, 0.14); } const n = noiseBurst(t, 0.25, 0.35, 'highpass', 1800); env(n.g, t, 0.003, 0.2, 0.4); },
    victory(t) { const seq = [523, 659, 784, 1047, 784, 1047, 1319]; seq.forEach((f, i) => { const tt = t + i * 0.13; const o = osc('triangle', f, tt, 0.35, 0.3); env(o.g, tt, 0.01, 0.3, 0.32); const h = osc('sine', f * 2, tt, 0.3, 0.1); env(h.g, tt, 0.01, 0.25, 0.1); }); },
    defeat(t) { const seq = [392, 349, 311, 262]; seq.forEach((f, i) => { const tt = t + i * 0.3; const o = osc('sawtooth', f, tt, 0.5, 0.18, f * 0.94); env(o.g, tt, 0.02, 0.45, 0.2); }); },
    gong(t) { const o = osc('sine', 180, t, 1.8, 0.5, 160); env(o.g, t, 0.005, 1.6, 0.6); const o2 = osc('triangle', 270, t, 1.4, 0.2, 250); env(o2.g, t, 0.005, 1.2, 0.25); const n = noiseBurst(t, 0.3, 0.3, 'bandpass', 1200, 200); env(n.g, t, 0.003, 0.25, 0.35); },
    boss_intro(t) { const o = osc('sawtooth', 70, t, 1.2, 0.35, 55); env(o.g, t, 0.05, 1.0, 0.4); const o2 = osc('square', 140, t + 0.2, 0.8, 0.12, 100); env(o2.g, t + 0.2, 0.05, 0.7, 0.15); const n = noiseBurst(t, 1.0, 0.3, 'lowpass', 600, 150); env(n.g, t, 0.1, 0.8, 0.3); },
    unlock(t) { [660, 880, 1100, 1320, 1760].forEach((f, i) => { const tt = t + i * 0.09; const o = osc('triangle', f, tt, 0.4, 0.28); env(o.g, tt, 0.005, 0.35, 0.3); }); },
    levelup(t) { [523, 659, 784, 1047].forEach((f, i) => { const tt = t + i * 0.1; const o = osc('square', f, tt, 0.25, 0.12); env(o.g, tt, 0.005, 0.2, 0.14); const s = osc('sine', f, tt, 0.4, 0.25); env(s.g, tt, 0.005, 0.35, 0.3); }); },
    fire(t) { const n = noiseBurst(t, 0.6, 0.4, 'lowpass', 900, 300, 0.7); env(n.g, t, 0.03, 0.5, 0.45); const o = osc('sawtooth', 90, t, 0.5, 0.15, 50); env(o.g, t, 0.02, 0.45, 0.2); },
    ice(t) { const n = noiseBurst(t, 0.5, 0.3, 'highpass', 4000); env(n.g, t, 0.01, 0.4, 0.35); [2500, 3200, 4100].forEach((f, i) => { const o = osc('sine', f, t + i * 0.05, 0.3, 0.12); env(o.g, t + i * 0.05, 0.005, 0.25, 0.14); }); },
    lightning(t) { const n = noiseBurst(t, 0.35, 0.5, 'highpass', 1500); env(n.g, t, 0.003, 0.3, 0.55); const o = osc('square', 60, t, 0.3, 0.25, 40); env(o.g, t, 0.003, 0.25, 0.3); },
    earth(t) { const o = osc('sine', 60, t, 0.7, 0.8, 25); env(o.g, t, 0.01, 0.6, 0.9); const n = noiseBurst(t, 0.6, 0.5, 'lowpass', 500, 80); env(n.g, t, 0.01, 0.5, 0.6); },
    energy(t) { const o = osc('sine', 300, t, 0.6, 0.3, 1200); env(o.g, t, 0.05, 0.5, 0.35); const o2 = osc('triangle', 150, t, 0.6, 0.2, 600); env(o2.g, t, 0.05, 0.5, 0.25); },
    burst(t) { const o = osc('sine', 200, t, 0.5, 0.6, 30); env(o.g, t, 0.005, 0.45, 0.7); const n = noiseBurst(t, 0.5, 0.5, 'bandpass', 800, 100, 0.6); env(n.g, t, 0.005, 0.4, 0.6); },
    step(t) { const n = noiseBurst(t, 0.06, 0.12, 'lowpass', 900, 300); env(n.g, t, 0.003, 0.05, 0.12); },
    throw(t) { const n = noiseBurst(t, 0.2, 0.25, 'bandpass', 2500, 900, 1.5); env(n.g, t, 0.005, 0.17, 0.3); },
    combo(t) { const o = osc('triangle', 1200, t, 0.12, 0.2, 1800); env(o.g, t, 0.003, 0.1, 0.22); },
    gift(t) { [784, 988, 1175, 1568].forEach((f, i) => { const tt = t + i * 0.08; const o = osc('triangle', f, tt, 0.3, 0.25); env(o.g, tt, 0.005, 0.25, 0.28); }); },
    buy(t) { [880, 1175, 1760].forEach((f, i) => { const tt = t + i * 0.07; const o = osc('sine', f, tt, 0.25, 0.25); env(o.g, tt, 0.005, 0.2, 0.28); }); },
    error(t) { const o = osc('square', 220, t, 0.18, 0.15, 180); env(o.g, t, 0.005, 0.15, 0.18); const o2 = osc('square', 220, t + 0.2, 0.18, 0.15, 160); env(o2.g, t + 0.2, 0.005, 0.15, 0.18); },
  };

  const lastPlay = {};
  function play(name, opts = {}) {
    if (!ctx || !unlocked) return;
    if (!NT.Save.get().settings.sfx) return;
    const now = performance.now();
    const minGap = opts.minGap != null ? opts.minGap : 35;
    if (lastPlay[name] && now - lastPlay[name] < minGap) return;
    lastPlay[name] = now;
    const t = ctx.currentTime + (opts.delay || 0);
    if (buffers[name]) {
      const s = ctx.createBufferSource(); s.buffer = buffers[name];
      const g = ctx.createGain(); g.gain.value = opts.volume != null ? opts.volume : 1;
      s.playbackRate.value = opts.rate || 1;
      s.connect(g); g.connect(sfxGain); s.start(t);
      return;
    }
    const fn = SYNTH[name];
    if (fn) { try { fn(t); } catch (e) { /* ignore */ } }
  }

  // ---------- procedural music ----------
  let music = { track: null, timer: null, step: 0, nextTime: 0, pending: null };
  const TRACKS = {
    menu: { bpm: 96, drone: 110, scale: [0, 2, 4, 7, 9], pattern: 'menu' },
    battle: { bpm: 128, drone: 82, scale: [0, 3, 5, 7, 10], pattern: 'battle' },
    boss: { bpm: 140, drone: 65, scale: [0, 1, 5, 7, 8], pattern: 'boss' },
    victory: null,
  };
  function playMusic(name) {
    if (!name || !TRACKS[name]) { stopMusic(); return; }
    if (music.track === name) return;
    if (!ctx || !unlocked) { music.pending = name; return; }
    stopMusic();
    music.track = name; music.step = 0; music.nextTime = ctx.currentTime + 0.05;
    music.timer = setInterval(schedule, 90);
    schedule();
  }
  function startMusicIfPending() { if (music.pending) { const p = music.pending; music.pending = null; playMusic(p); } }
  function stopMusic() { if (music.timer) clearInterval(music.timer); music.timer = null; music.track = null; }
  function drum(t, kind) {
    if (kind === 'taiko') { const o = osc('sine', 110, t, 0.35, 0.9, 45, musicGain); env(o.g, t, 0.004, 0.3, 0.9); const n = noiseBurst(t, 0.12, 0.35, 'lowpass', 900, 200, 1, musicGain); env(n.g, t, 0.003, 0.1, 0.35); }
    else if (kind === 'low') { const o = osc('sine', 70, t, 0.5, 1.0, 35, musicGain); env(o.g, t, 0.004, 0.45, 1.0); }
    else if (kind === 'click') { const n = noiseBurst(t, 0.05, 0.25, 'highpass', 5000, null, 1, musicGain); env(n.g, t, 0.002, 0.04, 0.25); }
    else if (kind === 'snap') { const n = noiseBurst(t, 0.12, 0.4, 'bandpass', 2200, 800, 1.2, musicGain); env(n.g, t, 0.002, 0.1, 0.4); const o = osc('triangle', 380, t, 0.08, 0.3, 200, musicGain); env(o.g, t, 0.002, 0.07, 0.3); }
  }
  function pluck(t, f, dur = 0.5, vol = 0.18) { const o = osc('triangle', f, t, dur, vol, null, musicGain); env(o.g, t, 0.01, dur * 0.8, vol); const h = osc('sine', f * 2, t, dur * 0.6, vol * 0.3, null, musicGain); env(h.g, t, 0.01, dur * 0.5, vol * 0.3); }
  function schedule() {
    if (!music.track || !ctx) return;
    const tr = TRACKS[music.track];
    const beat = 60 / tr.bpm / 2; // 8th notes
    while (music.nextTime < ctx.currentTime + 0.35) {
      const s = music.step, t = music.nextTime, bar = s % 16;
      if (tr.pattern === 'menu') {
        if (bar === 0) { const o = osc('sine', tr.drone, t, beat * 16, 0.12, null, musicGain); env(o.g, t, 0.5, beat * 14, 0.12, 0.08, 0.5); }
        if (bar % 4 === 0) drum(t, 'taiko');
        if (bar === 6 || bar === 14) drum(t, 'click');
        if ([0, 3, 6, 10, 12].includes(bar) && Math.random() < 0.8) { const deg = tr.scale[Math.floor(Math.random() * tr.scale.length)]; pluck(t, tr.drone * 4 * Math.pow(2, deg / 12), beat * 3, 0.12); }
      } else if (tr.pattern === 'battle') {
        if (bar === 0 || bar === 8) { const o = osc('sawtooth', tr.drone, t, beat * 8, 0.05, null, musicGain); env(o.g, t, 0.05, beat * 7, 0.05, 0.03, 0.2); }
        if ([0, 3, 6, 8, 10, 13].includes(bar)) drum(t, 'taiko');
        if (bar === 4 || bar === 12) drum(t, 'snap');
        if (bar % 2 === 1) drum(t, 'click');
        if ((bar === 2 || bar === 9 || bar === 14) && Math.random() < 0.7) { const deg = tr.scale[Math.floor(Math.random() * tr.scale.length)]; pluck(t, tr.drone * 4 * Math.pow(2, deg / 12), beat * 2, 0.1); }
      } else if (tr.pattern === 'boss') {
        if (bar === 0 || bar === 8) { const o = osc('sawtooth', tr.drone, t, beat * 8, 0.07, null, musicGain); env(o.g, t, 0.05, beat * 7, 0.07, 0.04, 0.2); const o2 = osc('square', tr.drone * 1.5, t, beat * 8, 0.03, null, musicGain); env(o2.g, t, 0.05, beat * 7, 0.03, 0.02, 0.2); }
        if ([0, 2, 3, 6, 8, 10, 11, 14].includes(bar)) drum(t, 'taiko');
        if (bar === 4 || bar === 12) drum(t, 'low');
        if (bar % 2 === 1) drum(t, 'click');
        if ((bar === 1 || bar === 5 || bar === 9 || bar === 13) && Math.random() < 0.8) { const deg = tr.scale[Math.floor(Math.random() * tr.scale.length)]; pluck(t, tr.drone * 4 * Math.pow(2, deg / 12), beat * 1.5, 0.09); }
      }
      music.nextTime += beat; music.step++;
    }
  }

  function duck(amount = 0.3, dur = 1.5) { if (!ctx) return; const t = ctx.currentTime; musicGain.gain.cancelScheduledValues(t); const base = NT.Save.get().settings.music ? 0.55 : 0; musicGain.gain.setValueAtTime(base * amount, t); musicGain.gain.linearRampToValueAtTime(base, t + dur); }

  return { unlock, play, playMusic, stopMusic, applySettings, duck, MANIFEST, get ready() { return unlocked; } };
})();
