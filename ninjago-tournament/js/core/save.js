/* ============================================================
   NT.Save — localStorage persistence
   ============================================================ */
NT.Save = (function () {
  const KEY = 'ninjago_tournament_save_v1';
  let data = null;

  function defaults() {
    return {
      version: 1,
      studs: 0,
      unlocked: { lloyd: true, kai: true, jay: true, cole: true, zane: true },
      levels: {},          // charId -> { level, xp }
      progress: {},        // arenaId -> { cleared: n }
      currentArena: 'chens_arena',
      currentRound: 0,
      selectedChar: 'lloyd',
      settings: { music: true, sfx: true, shake: true, leftHanded: false, buttonSize: 1, showHints: true },
      lastGift: 0,
      giftStreak: 0,
      stats: { wins: 0, losses: 0, kills: 0, maxCombo: 0, studsEarned: 0, battles: 0 },
      seenIntro: false,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        data = Object.assign(defaults(), parsed);
        data.settings = Object.assign(defaults().settings, parsed.settings || {});
        data.stats = Object.assign(defaults().stats, parsed.stats || {});
        data.unlocked = Object.assign(defaults().unlocked, parsed.unlocked || {});
      } else data = defaults();
    } catch (e) { data = defaults(); }
    return data;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
  }
  function reset() { data = defaults(); save(); return data; }
  function get() { return data || load(); }

  function charLevel(id) {
    const d = get();
    if (!d.levels[id]) d.levels[id] = { level: 1, xp: 0 };
    return d.levels[id];
  }
  function arenaProgress(id) {
    const d = get();
    if (!d.progress[id]) d.progress[id] = { cleared: 0 };
    return d.progress[id];
  }

  return { load, save, reset, get, charLevel, arenaProgress, defaults };
})();
