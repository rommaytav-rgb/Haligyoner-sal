/* ============================================================
   NT.Tournament — the Tournament of Elements structure.
   Each arena has 5 rounds; each round = waves of grunts followed
   by a champion (an elemental master / villain). Round 5's
   champion is the arena boss. Defeating a champion unlocks them.
   ============================================================ */
NT.Tournament = (function () {
  const ROUNDS = 5;
  const champions = {
    chens_arena:      ['kapau', 'chope', 'karlof', 'eyezor', 'clouse'],
    chens_palace:     ['griffin', 'ash', 'zugu', 'skylor', 'chen'],
    jungle_ruins:     ['bolobo', 'tox', 'shade', 'chamille', 'pythor'],
    skulkin_caves:    ['krazi', 'nuckal', 'kruncha', 'frakjaw', 'samukai'],
    dark_island:      ['jacob', 'gravis', 'kozu', 'neuro', 'lord_garmadon'],
    ninjago_city:     ['min_droid', 'paleman', 'dareth', 'pixal', 'cryptor'],
    anacondrai_arena: ['wu', 'nya', 'lord_garmadon', 'clouse', 'chen_anacondrai'],
  };
  const arenaOrder = NT.Arenas.list.map((a) => a.id);

  function arenaIndex(id) { return arenaOrder.indexOf(id); }
  function difficulty(arenaId, round) { return 1 + arenaIndex(arenaId) * 0.28 + round * 0.09; }

  // Build the wave plan for a round
  function plan(arenaId, round) {
    const arena = NT.Arenas.get(arenaId);
    const ai = arenaIndex(arenaId);
    const rng = NT.Util.seeded(ai * 100 + round * 7 + 13);
    const waveCount = round === 4 ? 3 : 2 + Math.floor(round / 2);
    const waves = [];
    for (let w = 0; w < waveCount; w++) {
      const count = Math.min(7, 2 + Math.floor(round * 0.8) + w + Math.floor(ai / 2));
      const enemies = [];
      for (let i = 0; i < count; i++) enemies.push(arena.pool[Math.floor(rng() * arena.pool.length)]);
      if ((w === waveCount - 1 && round >= 2) || (ai >= 3 && w >= 1 && rng() < 0.5)) enemies.push(arena.heavy);
      waves.push({ enemies, maxConcurrent: Math.min(6, 3 + Math.floor(round / 2) + Math.floor(ai / 3)) });
    }
    return { arenaId, round, waves, champion: champions[arenaId][round], boss: round === ROUNDS - 1, difficulty: difficulty(arenaId, round) };
  }

  function isArenaUnlocked(arenaId) {
    const i = arenaIndex(arenaId);
    if (i === 0) return true;
    const prev = arenaOrder[i - 1];
    return NT.Save.arenaProgress(prev).cleared >= ROUNDS;
  }
  function isArenaComplete(arenaId) { return NT.Save.arenaProgress(arenaId).cleared >= ROUNDS; }
  function isTournamentComplete() { return arenaOrder.every(isArenaComplete); }

  function reward(arenaId, round, combo, hearts) {
    const d = difficulty(arenaId, round);
    const base = Math.round(1500 * d * (1 + round * 0.35));
    const comboBonus = Math.round(Math.min(combo, 150) * 12 * d);
    const xp = Math.round(120 * d * (1 + round * 0.3) + (round === ROUNDS - 1 ? 200 : 0));
    return { studs: base, comboBonus, xp };
  }

  return { ROUNDS, champions, arenaOrder, arenaIndex, difficulty, plan, isArenaUnlocked, isArenaComplete, isTournamentComplete, reward };
})();
