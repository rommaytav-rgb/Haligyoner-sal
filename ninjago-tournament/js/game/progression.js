/* ============================================================
   NT.Progression — XP / True Potential levels, unlocks, shop,
   rewards, daily gift.
   ============================================================ */
NT.Progression = (function () {
  const LEVELS = [0, 750, 2000, 4000, 7000]; // xp needed to go from level i+1 to i+2 (index = level-1)
  const RANKS = ['Novice', 'Apprentice', 'Warrior', 'Master', 'Grandmaster'];
  const RANK_DESC = ['Starting level', 'Learning the way', 'Battle hardened', 'Master of the element', 'True Potential unlocked'];
  const MAX_LEVEL = 5;

  function xpToNext(level) { return level >= MAX_LEVEL ? null : LEVELS[level]; }
  function levelInfo(charId) { const l = NT.Save.charLevel(charId); return { level: l.level, xp: l.xp, next: xpToNext(l.level), rank: RANKS[l.level - 1], desc: RANK_DESC[l.level - 1] }; }
  function addXp(charId, amount) {
    const l = NT.Save.charLevel(charId); let gained = 0;
    if (l.level >= MAX_LEVEL) { l.xp = 0; NT.Save.save(); return { gained, level: l.level }; }
    l.xp += amount;
    while (l.level < MAX_LEVEL && l.xp >= LEVELS[l.level]) { l.xp -= LEVELS[l.level]; l.level++; gained++; }
    if (l.level >= MAX_LEVEL) l.xp = 0;
    NT.Save.save();
    return { gained, level: l.level };
  }

  function isUnlocked(charId) { return !!NT.Save.get().unlocked[charId]; }
  function unlock(charId) { const d = NT.Save.get(); if (d.unlocked[charId]) return false; d.unlocked[charId] = true; NT.Save.save(); return true; }
  function price(def) { return def.unlock.price != null ? def.unlock.price : 0; }
  function canBuy(def) { return !isUnlocked(def.id) && def.unlock.type !== 'default' && NT.Save.get().studs >= price(def); }
  function buy(def) { if (!canBuy(def)) return false; const d = NT.Save.get(); d.studs -= price(def); d.unlocked[def.id] = true; NT.Save.save(); return true; }
  function unlockText(def) {
    if (isUnlocked(def.id)) return null;
    if (def.unlock.type === 'boss') { const a = NT.Arenas.get(def.unlock.arena); return `Defeat in ${a.name} · Round ${def.unlock.round + 1}`; }
    return 'Available in the shop';
  }

  // called after a round victory
  function awardVictory(plan, result) {
    const d = NT.Save.get();
    const rw = NT.Tournament.reward(plan.arenaId, plan.round, result.maxCombo, result.hearts);
    const studs = rw.studs + rw.comboBonus + result.studsCollected;
    d.studs += studs; d.stats.studsEarned += studs; d.stats.wins++; d.stats.battles++; d.stats.kills += result.kills;
    if (result.maxCombo > d.stats.maxCombo) d.stats.maxCombo = result.maxCombo;
    const prog = NT.Save.arenaProgress(plan.arenaId);
    const unlocks = [];
    if (prog.cleared <= plan.round) prog.cleared = plan.round + 1;
    // champion unlock
    const champ = NT.Characters.get(plan.champion);
    if (champ && champ.unlock.type === 'boss' && champ.unlock.arena === plan.arenaId && champ.unlock.round === plan.round && unlock(champ.id)) unlocks.push({ type: 'character', id: champ.id, name: champ.name });
    // arena unlock
    const ai = NT.Tournament.arenaIndex(plan.arenaId);
    if (plan.round === NT.Tournament.ROUNDS - 1 && ai + 1 < NT.Tournament.arenaOrder.length) { const na = NT.Arenas.get(NT.Tournament.arenaOrder[ai + 1]); unlocks.push({ type: 'arena', id: na.id, name: na.name }); d.currentArena = na.id; d.currentRound = 0; }
    else if (plan.round < NT.Tournament.ROUNDS - 1) { d.currentArena = plan.arenaId; d.currentRound = Math.max(d.currentRound, plan.round + 1); if (d.currentArena !== plan.arenaId) d.currentRound = plan.round + 1; }
    const xp = addXp(result.charId, rw.xp);
    NT.Save.save();
    return { studs, base: rw.studs, comboBonus: rw.comboBonus, collected: result.studsCollected, xp: rw.xp, levelsGained: xp.gained, level: xp.level, unlocks };
  }
  function awardDefeat(result) {
    const d = NT.Save.get(); const studs = Math.floor(result.studsCollected * 0.5);
    d.studs += studs; d.stats.losses++; d.stats.battles++; d.stats.kills += result.kills; NT.Save.save();
    return { studs };
  }

  // daily gift
  const GIFT_INTERVAL = 20 * 60 * 60 * 1000;
  function giftReady() { return Date.now() - NT.Save.get().lastGift >= GIFT_INTERVAL; }
  function giftCountdown() { const ms = GIFT_INTERVAL - (Date.now() - NT.Save.get().lastGift); if (ms <= 0) return 'READY'; const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000); return `${h}h ${m}m`; }
  function claimGift() {
    if (!giftReady()) return null;
    const d = NT.Save.get(); d.giftStreak = (d.giftStreak || 0) + 1; d.lastGift = Date.now();
    const table = [5000, 8000, 12000, 20000, 30000, 50000];
    const amount = table[Math.min(table.length - 1, d.giftStreak - 1)] + Math.floor(Math.random() * 3) * 1000;
    d.studs += amount; NT.Save.save();
    return { studs: amount, streak: d.giftStreak };
  }

  return { LEVELS, RANKS, RANK_DESC, MAX_LEVEL, xpToNext, levelInfo, addXp, isUnlocked, unlock, price, canBuy, buy, unlockText, awardVictory, awardDefeat, giftReady, giftCountdown, claimGift };
})();
