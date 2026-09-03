/* ============================================================
   NT.Enemies — enemy archetypes (grunts). Champions/bosses use
   NT.Characters entries with boss AI.
   ============================================================ */
NT.Enemies = (function () {
  const Y = '#f2c94c';
  const list = [];
  function add(e) {
    e.look = Object.assign({ skin: Y, torsoPrint: 'plain', hair: 'short', hairColor: '#222222', head: 'face', face: 'angry', extras: [], weapon: 'none', weaponColor: '#c9ced4', scale: 1, accent: '#444444' }, e.look);
    e.stats = Object.assign({ hp: 40, attack: 6, defense: 0, speed: 200 }, e.stats);
    e.ai = Object.assign({ aggression: 0.5, attackRate: 1.2, range: 62, ranged: false, blocks: 0, kind: 'grunt', weight: 1 }, e.ai);
    e.studs = e.studs || 3;
    e.xp = e.xp || 10;
    list.push(e);
    return e;
  }
  // Chen's gray-skinned mercenaries (seen in the arena)
  add({ id: 'thug', name: "Chen's Thug", element: 'venom',
    look: { skin: '#8d9296', torso: '#5a5f64', legs: '#2a2a2a', accent: '#1a1a1a', hair: 'flat', hairColor: '#111111', face: 'angry', torsoPrint: 'vest', weapon: 'none' },
    stats: { hp: 34, attack: 6, defense: 0, speed: 210 }, ai: { aggression: 0.55, attackRate: 1.3 }, studs: 3, xp: 8 });
  add({ id: 'thug_brawler', name: 'Arena Brawler', element: 'venom',
    look: { skin: '#8d9296', torso: '#3a3f44', legs: '#2a2a2a', accent: '#c8102e', hair: 'mohawk', hairColor: '#111111', face: 'angry', torsoPrint: 'vest', weapon: 'none', scale: 1.08 },
    stats: { hp: 55, attack: 8, defense: 1, speed: 205 }, ai: { aggression: 0.6, attackRate: 1.1, blocks: 0.15 }, studs: 4, xp: 12 });
  add({ id: 'cultist', name: 'Anacondrai Cultist', element: 'venom',
    look: { torso: '#6a2fa8', legs: '#e6b422', accent: '#e6b422', hair: 'helmet_snake', hairColor: '#6a2fa8', face: 'grin', torsoPrint: 'cultist', weapon: 'sword' },
    stats: { hp: 45, attack: 7, defense: 0, speed: 225 }, ai: { aggression: 0.6, attackRate: 1.2, range: 66 }, studs: 4, xp: 12 });
  add({ id: 'cultist_spear', name: 'Cultist Spearman', element: 'venom',
    look: { torso: '#6a2fa8', legs: '#4a1f7a', accent: '#e6b422', hair: 'helmet_snake', hairColor: '#4a1f7a', face: 'smirk', torsoPrint: 'cultist', weapon: 'spear' },
    stats: { hp: 40, attack: 7, defense: 0, speed: 215 }, ai: { aggression: 0.45, attackRate: 1.5, range: 80, ranged: true, kind: 'ranged' }, studs: 4, xp: 14 });
  add({ id: 'anacondrai', name: 'Anacondrai Warrior', element: 'venom',
    look: { skin: '#a56cff', torso: '#6a2fa8', legs: '#4a1f7a', accent: '#e0b14a', hair: 'none', head: 'snake', face: 'evil', torsoPrint: 'scales', weapon: 'fangblade', weaponColor: '#e0b14a', scale: 1.25 },
    stats: { hp: 120, attack: 11, defense: 2, speed: 195 }, ai: { aggression: 0.65, attackRate: 1.6, range: 76, blocks: 0.2, kind: 'heavy', weight: 2.2 }, studs: 8, xp: 30 });
  add({ id: 'stone_warrior', name: 'Stone Warrior', element: 'stone',
    look: { skin: '#8f9498', torso: '#5a5f64', legs: '#3a3f44', accent: '#c8102e', hair: 'helmet_stone', hairColor: '#4a4f54', head: 'stone', face: 'angry', torsoPrint: 'stone', weapon: 'sword' },
    stats: { hp: 65, attack: 8, defense: 2, speed: 195 }, ai: { aggression: 0.55, attackRate: 1.4, range: 66, blocks: 0.35, weight: 1.4 }, studs: 5, xp: 16 });
  add({ id: 'stone_scout', name: 'Stone Scout', element: 'stone',
    look: { skin: '#8f9498', torso: '#4a4f54', legs: '#3a3f44', accent: '#c8102e', hair: 'helmet_stone', hairColor: '#3a3f44', head: 'stone', face: 'stern', torsoPrint: 'stone', weapon: 'daggers', scale: 0.95 },
    stats: { hp: 45, attack: 7, defense: 1, speed: 240 }, ai: { aggression: 0.4, attackRate: 1.4, range: 60, ranged: true, kind: 'ranged' }, studs: 4, xp: 14 });
  add({ id: 'stone_giant', name: 'Stone Swordsman', element: 'stone',
    look: { skin: '#8f9498', torso: '#5a5f64', legs: '#3a3f44', accent: '#c8102e', hair: 'helmet_samurai', hairColor: '#3a3f44', head: 'stone', face: 'angry', torsoPrint: 'stone', weapon: 'sword', scale: 1.28 },
    stats: { hp: 140, attack: 12, defense: 3, speed: 185 }, ai: { aggression: 0.65, attackRate: 1.7, range: 80, blocks: 0.4, kind: 'heavy', weight: 2.5 }, studs: 9, xp: 34 });
  add({ id: 'skulkin', name: 'Skulkin', element: 'bone',
    look: { skin: '#f0eee6', torso: '#1a1a1a', legs: '#1a1a1a', accent: '#5a5a5a', hair: 'none', head: 'skull', face: 'skull', torsoPrint: 'ribs', weapon: 'bone', weaponColor: '#f0eee6' },
    stats: { hp: 32, attack: 6, defense: 0, speed: 245 }, ai: { aggression: 0.7, attackRate: 1.1, range: 62, weight: 0.8 }, studs: 3, xp: 10 });
  add({ id: 'skulkin_axe', name: 'Skulkin Warrior', element: 'bone',
    look: { skin: '#f0eee6', torso: '#1f3f8f', legs: '#1a1a1a', accent: '#c8102e', hair: 'helmet_horn', hairColor: '#5a5a5a', head: 'skull', face: 'skull', torsoPrint: 'ribs', weapon: 'axe' },
    stats: { hp: 55, attack: 8, defense: 1, speed: 225 }, ai: { aggression: 0.6, attackRate: 1.3, range: 70 }, studs: 4, xp: 14 });
  add({ id: 'skulkin_archer', name: 'Skulkin Bone Thrower', element: 'bone',
    look: { skin: '#f0eee6', torso: '#8a1a2a', legs: '#1a1a1a', accent: '#c8102e', hair: 'none', head: 'skull', face: 'skull', torsoPrint: 'ribs', weapon: 'bone', weaponColor: '#f0eee6' },
    stats: { hp: 35, attack: 7, defense: 0, speed: 220 }, ai: { aggression: 0.4, attackRate: 1.5, range: 60, ranged: true, kind: 'ranged' }, studs: 4, xp: 14 });
  add({ id: 'nindroid', name: 'Nindroid', element: 'tech',
    look: { skin: '#2a2a2a', torso: '#2a2a2a', legs: '#1a1a1a', accent: '#ff3b3b', hair: 'none', head: 'robot', face: 'robot_red', torsoPrint: 'nindroid', weapon: 'sword' },
    stats: { hp: 60, attack: 8, defense: 1, speed: 250 }, ai: { aggression: 0.65, attackRate: 1.1, range: 66, blocks: 0.25 }, studs: 5, xp: 16 });
  add({ id: 'nindroid_blaster', name: 'Nindroid Blaster', element: 'tech',
    look: { skin: '#2a2a2a', torso: '#3a3a3a', legs: '#1a1a1a', accent: '#ff3b3b', hair: 'none', head: 'robot', face: 'robot_red', torsoPrint: 'nindroid', weapon: 'blaster', weaponColor: '#5a5a5a' },
    stats: { hp: 45, attack: 7, defense: 1, speed: 235 }, ai: { aggression: 0.45, attackRate: 1.3, range: 60, ranged: true, kind: 'ranged' }, studs: 5, xp: 16 });
  add({ id: 'nindroid_heavy', name: 'Nindroid Warrior', element: 'tech',
    look: { skin: '#2a2a2a', torso: '#3a3a3a', legs: '#1a1a1a', accent: '#ff3b3b', hair: 'none', head: 'robot', face: 'robot_red', torsoPrint: 'nindroid', weapon: 'hammer', scale: 1.2 },
    stats: { hp: 120, attack: 11, defense: 3, speed: 205 }, ai: { aggression: 0.6, attackRate: 1.6, range: 78, blocks: 0.3, kind: 'heavy', weight: 2.2 }, studs: 8, xp: 30 });
  add({ id: 'serpentine', name: 'Serpentine', element: 'poison',
    look: { skin: '#5aa15a', torso: '#3a7a3a', legs: '#2a5a2a', accent: '#e6b422', hair: 'none', head: 'snake', face: 'evil', torsoPrint: 'scales', weapon: 'staff', weaponColor: '#e6b422' },
    stats: { hp: 48, attack: 7, defense: 0, speed: 230 }, ai: { aggression: 0.55, attackRate: 1.25, range: 68 }, studs: 4, xp: 13 });
  add({ id: 'serpentine_fang', name: 'Fangpyre', element: 'poison',
    look: { skin: '#c8102e', torso: '#8a1a2a', legs: '#5a1a1a', accent: '#f4f4f4', hair: 'none', head: 'snake', face: 'evil', torsoPrint: 'scales', weapon: 'fangblade', weaponColor: '#c9ced4' },
    stats: { hp: 55, attack: 8, defense: 1, speed: 240 }, ai: { aggression: 0.65, attackRate: 1.2, range: 68 }, studs: 5, xp: 15 });
  add({ id: 'kabuki', name: "Chen's Kabuki", element: 'venom',
    look: { skin: '#f4f4f4', torso: '#c8102e', legs: '#1a1a1a', accent: '#e0b14a', hair: 'bun', hairColor: '#111111', face: 'smirk', torsoPrint: 'kimono', weapon: 'daggers', weaponColor: '#e0b14a' },
    stats: { hp: 42, attack: 7, defense: 0, speed: 260 }, ai: { aggression: 0.5, attackRate: 1.2, range: 62, ranged: true, kind: 'ranged' }, studs: 4, xp: 13 });

  const byId = {}; for (const e of list) byId[e.id] = e;
  return { list, byId, get: (id) => byId[id] };
})();
