/* ============================================================
   NT.Characters — data-driven playable roster
   Every entry: id, name, element, look (appearance), stats,
   special, features, unlock. Levels scale stats (see Progression).
   ============================================================ */
NT.Elements = {
  fire:        { name: 'Fire',         c1: '#ff6a12', c2: '#ffd23a', glow: '#ff9a3a' },
  ice:         { name: 'Ice',          c1: '#dff6ff', c2: '#8fd3ff', glow: '#cfeeff' },
  lightning:   { name: 'Lightning',    c1: '#5fe9ff', c2: '#c6fbff', glow: '#9df4ff' },
  earth:       { name: 'Earth',        c1: '#b87a2a', c2: '#e6b25a', glow: '#d9a04a' },
  energy:      { name: 'Energy',       c1: '#5ef23a', c2: '#c9ff8a', glow: '#8dff5a' },
  golden:      { name: 'Golden Power', c1: '#ffd53a', c2: '#fff4b8', glow: '#ffe680' },
  creation:    { name: 'Creation',     c1: '#ffe38a', c2: '#ffffff', glow: '#fff0b0' },
  destruction: { name: 'Destruction',  c1: '#8a3cff', c2: '#d8b4ff', glow: '#b07cff' },
  water:       { name: 'Water',        c1: '#2f86ff', c2: '#a8d8ff', glow: '#5fa8ff' },
  amber:       { name: 'Amber',        c1: '#ff9a1f', c2: '#ffd98a', glow: '#ffb84a' },
  metal:       { name: 'Metal',        c1: '#8f9aa6', c2: '#e4e9ee', glow: '#c9d2da' },
  speed:       { name: 'Speed',        c1: '#ffb52a', c2: '#fff0a0', glow: '#ffd26a' },
  smoke:       { name: 'Smoke',        c1: '#5a5a5a', c2: '#b9b9b9', glow: '#8a8a8a' },
  shadow:      { name: 'Shadow',       c1: '#2a1a3d', c2: '#6b4d8f', glow: '#4a2f6b' },
  mind:        { name: 'Mind',         c1: '#c59bff', c2: '#f0e4ff', glow: '#d8b8ff' },
  light:       { name: 'Light',        c1: '#fff7c8', c2: '#ffffff', glow: '#ffffff' },
  form:        { name: 'Form',         c1: '#ff5fb0', c2: '#ffc0e4', glow: '#ff8fc8' },
  sound:       { name: 'Sound',        c1: '#7ac8ff', c2: '#e0f4ff', glow: '#a8dcff' },
  nature:      { name: 'Nature',       c1: '#3ea83e', c2: '#b8f08a', glow: '#7ad47a' },
  gravity:     { name: 'Gravity',      c1: '#4b3aa8', c2: '#a89cf0', glow: '#7b6bd8' },
  poison:      { name: 'Poison',       c1: '#7ad41a', c2: '#d6ff8a', glow: '#a8f04a' },
  bone:        { name: 'Skulkin',      c1: '#e9e5d4', c2: '#ffffff', glow: '#f4f1e6' },
  stone:       { name: 'Stone',        c1: '#7d8288', c2: '#c9cdd1', glow: '#a2a7ac' },
  tech:        { name: 'Nindroid',     c1: '#ff3b3b', c2: '#ffb0b0', glow: '#ff6b6b' },
  venom:       { name: 'Anacondrai',   c1: '#8f4fd6', c2: '#e2c8ff', glow: '#b48aff' },
  brown:       { name: 'Brown Ninja',  c1: '#8a5a2a', c2: '#e0b070', glow: '#c08a4a' },
};

NT.Characters = (function () {
  const Y = '#f2c94c'; // classic LEGO skin
  const list = [];
  function add(c) {
    c.look = Object.assign({ skin: Y, torsoPrint: 'ninja', arms: null, hands: null, hair: 'short', hairColor: '#222222', head: 'face', face: 'stern', extras: [], weapon: 'katana', weaponColor: '#c9ced4', scale: 1, hood: null, mask: null, accent: '#e0b14a' }, c.look);
    c.stats = Object.assign({ hp: 100, attack: 10, defense: 0, speed: 250 }, c.stats);
    c.features = Object.assign({ ranged: false, dodge: true, jumpSlam: true }, c.features);
    c.special = Object.assign({ type: 'spinjitzu', name: NT.Elements[c.element].name + ' Spinjitzu' }, c.special || {});
    c.unlock = c.unlock || { type: 'studs', price: 25000 };
    c.desc = c.desc || '';
    list.push(c);
    return c;
  }

  // ---------------- The Ninja (Tournament suits) ----------------
  add({ id: 'lloyd', name: 'Lloyd (Tournament)', element: 'energy', unlock: { type: 'default' },
    look: { torso: '#2f9e44', legs: '#2f9e44', accent: '#e0b14a', hair: 'shaggy', hairColor: '#e8d37a', mask: '#2f9e44', face: 'stern', weapon: 'katana', weaponColor: '#f0c040', torsoPrint: 'ninja_tournament' },
    stats: { hp: 110, attack: 11, defense: 1, speed: 255 }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'The Green Ninja. Balanced and powerful.' });
  add({ id: 'kai', name: 'Kai (Tournament)', element: 'fire', unlock: { type: 'default' },
    look: { torso: '#c8102e', legs: '#c8102e', accent: '#e0b14a', hair: 'spiky', hairColor: '#3a2416', mask: '#c8102e', face: 'grin', weapon: 'katana', torsoPrint: 'ninja_tournament' },
    stats: { hp: 100, attack: 13, defense: 0, speed: 260 }, features: { ranged: false, dodge: true, jumpSlam: true }, desc: 'The Red Ninja. Hits hard and fast.' });
  add({ id: 'jay', name: 'Jay (Tournament)', element: 'lightning', unlock: { type: 'default' },
    look: { torso: '#1f5fbf', legs: '#1f5fbf', accent: '#e0b14a', hair: 'curly', hairColor: '#7a4a2a', mask: '#1f5fbf', face: 'smile', weapon: 'nunchucks', weaponColor: '#c9ced4', torsoPrint: 'ninja_tournament' },
    stats: { hp: 95, attack: 10, defense: 0, speed: 285 }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'The Blue Ninja. Fastest of the ninja.' });
  add({ id: 'cole', name: 'Cole (Tournament)', element: 'earth', unlock: { type: 'default' },
    look: { torso: '#1a1a1a', legs: '#1a1a1a', accent: '#e0b14a', hair: 'short', hairColor: '#111111', mask: '#1a1a1a', face: 'stern', weapon: 'scythe', weaponColor: '#c9ced4', torsoPrint: 'ninja_tournament' },
    stats: { hp: 125, attack: 14, defense: 2, speed: 230 }, features: { ranged: false, dodge: false, jumpSlam: true }, desc: 'The Black Ninja. Strong as a rock.' });
  add({ id: 'zane', name: 'Zane (Titanium)', element: 'ice', unlock: { type: 'default' },
    look: { skin: '#c7ccd2', torso: '#c7ccd2', legs: '#9aa1a8', accent: '#3a8cff', hair: 'none', head: 'robot', mask: '#8a9199', face: 'robot', weapon: 'shuriken', weaponColor: '#e4e9ee', torsoPrint: 'titanium' },
    stats: { hp: 105, attack: 11, defense: 1, speed: 250 }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'The Titanium Ninja. Cool under pressure.' });
  add({ id: 'nya', name: 'Nya (Samurai X)', element: 'water', unlock: { type: 'studs', price: 40000 },
    look: { torso: '#b0102a', legs: '#2a2a2a', accent: '#e0b14a', hair: 'ponytail', hairColor: '#111111', face: 'smile', weapon: 'spear', weaponColor: '#e0b14a', torsoPrint: 'armor' },
    stats: { hp: 100, attack: 12, defense: 1, speed: 265 }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'Samurai X. Master of water.' });
  add({ id: 'wu', name: 'Sensei Wu', element: 'creation', unlock: { type: 'boss', arena: 'anacondrai_arena', round: 0, price: 60000 },
    look: { torso: '#f4efe0', legs: '#f4efe0', accent: '#e0b14a', hair: 'conical', hairColor: '#e8dcae', face: 'calm', extras: ['beard_long'], weapon: 'staff', weaponColor: '#9a6a2a', torsoPrint: 'kimono' },
    stats: { hp: 120, attack: 12, defense: 2, speed: 240 }, special: { type: 'spinjitzu', name: 'Creation Spinjitzu' }, features: { ranged: false, dodge: true, jumpSlam: true }, desc: 'The wise master of Spinjitzu.' });
  add({ id: 'garmadon', name: 'Sensei Garmadon', element: 'destruction', unlock: { type: 'studs', price: 55000 },
    look: { torso: '#2a2a2a', legs: '#2a2a2a', accent: '#8a3cff', hair: 'slick', hairColor: '#b0b0b0', face: 'stern', extras: ['beard'], weapon: 'staff', weaponColor: '#3a2a1a', torsoPrint: 'kimono' },
    stats: { hp: 120, attack: 13, defense: 1, speed: 240 }, features: { ranged: false, dodge: true, jumpSlam: true }, desc: 'Reformed, but Destruction still answers his call.' });
  add({ id: 'lord_garmadon', name: 'Lord Garmadon', element: 'destruction', unlock: { type: 'boss', arena: 'dark_island', round: 4, price: 120000 },
    look: { skin: '#1a1a1a', torso: '#1a1a1a', legs: '#1a1a1a', accent: '#8a3cff', hair: 'helmet_bone', hairColor: '#e8e2cc', face: 'evil_red', extras: ['fourarms'], weapon: 'dualswords', weaponColor: '#c9ced4', torsoPrint: 'ribs', scale: 1.12 },
    stats: { hp: 200, attack: 16, defense: 3, speed: 235 }, features: { ranged: true, dodge: false, jumpSlam: true }, desc: 'Four arms. Four weapons. Pure destruction.' });
  add({ id: 'golden_lloyd', name: 'Lloyd (Golden Ninja)', element: 'golden', unlock: { type: 'studs', price: 250000 },
    look: { torso: '#e6b422', legs: '#e6b422', accent: '#fff2a8', hood: '#e6b422', head: 'hood', face: 'stern', weapon: 'katana', weaponColor: '#ffd94a', torsoPrint: 'ninja' },
    stats: { hp: 140, attack: 16, defense: 2, speed: 265 }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'The Ultimate Spinjitzu Master.' });
  add({ id: 'kai_dx', name: 'Kai DX', element: 'fire', unlock: { type: 'studs', price: 30000 },
    look: { torso: '#c8102e', legs: '#c8102e', accent: '#e0b14a', hood: '#c8102e', head: 'hood', face: 'stern', weapon: 'katana', torsoPrint: 'dx' },
    stats: { hp: 100, attack: 13, defense: 0, speed: 260 }, desc: 'Dragon eXtreme. Classic red hood.' });
  add({ id: 'jay_zx', name: 'Jay ZX', element: 'lightning', unlock: { type: 'studs', price: 30000 },
    look: { torso: '#1f5fbf', legs: '#1f5fbf', accent: '#c9ced4', hood: '#1f5fbf', head: 'hood', face: 'smile', weapon: 'nunchucks', torsoPrint: 'zx' },
    stats: { hp: 95, attack: 10, defense: 1, speed: 285 }, features: { ranged: true }, desc: 'ZX armor with silver shoulder guards.' });
  add({ id: 'cole_zx', name: 'Cole ZX', element: 'earth', unlock: { type: 'studs', price: 30000 },
    look: { torso: '#1a1a1a', legs: '#1a1a1a', accent: '#c9ced4', hood: '#1a1a1a', head: 'hood', face: 'stern', weapon: 'hammer', torsoPrint: 'zx' },
    stats: { hp: 125, attack: 15, defense: 2, speed: 225 }, features: { ranged: false, dodge: false }, desc: 'ZX armor. Bigger hammer.' });
  add({ id: 'zane_zx', name: 'Zane ZX', element: 'ice', unlock: { type: 'studs', price: 30000 },
    look: { torso: '#f4f4f4', legs: '#f4f4f4', accent: '#c9ced4', hood: '#f4f4f4', head: 'hood', face: 'stern', weapon: 'shuriken', torsoPrint: 'zx' },
    stats: { hp: 105, attack: 11, defense: 1, speed: 250 }, features: { ranged: true }, desc: 'The White Ninja in ZX armor.' });
  add({ id: 'dareth', name: 'Dareth', element: 'brown', unlock: { type: 'boss', arena: 'ninjago_city', round: 2, price: 20000 },
    look: { torso: '#7a4a1e', legs: '#7a4a1e', accent: '#e0b14a', hair: 'slick', hairColor: '#3a2416', face: 'grin', extras: ['shades'], weapon: 'none', torsoPrint: 'ninja' },
    stats: { hp: 90, attack: 8, defense: 0, speed: 270 }, special: { type: 'dash_strikes', name: 'Brown Ninja Rush' }, features: { ranged: false, dodge: true, jumpSlam: false }, desc: 'The Brown Ninja. Believe it.' });

  // ---------------- Chen's Tournament ----------------
  add({ id: 'skylor', name: 'Skylor', element: 'amber', unlock: { type: 'boss', arena: 'chens_palace', round: 3, price: 50000 },
    look: { torso: '#ff8c1a', legs: '#ff8c1a', accent: '#1a1a1a', hair: 'ponytail', hairColor: '#c8401a', mask: '#ff8c1a', face: 'smirk', weapon: 'daggers', weaponColor: '#e0b14a', torsoPrint: 'ninja_tournament' },
    stats: { hp: 100, attack: 12, defense: 1, speed: 275 }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'Master of Amber. Absorbs any power.' });
  add({ id: 'chen', name: 'Master Chen', element: 'venom', unlock: { type: 'boss', arena: 'chens_palace', round: 4, price: 100000 },
    look: { torso: '#6a2fa8', legs: '#8a1a2a', accent: '#e0b14a', hair: 'crown_snake', hairColor: '#e8dcae', face: 'evil', extras: ['goatee'], weapon: 'staff', weaponColor: '#e0b14a', torsoPrint: 'robe' },
    stats: { hp: 150, attack: 14, defense: 2, speed: 240 }, special: { type: 'burst', name: 'Overload', color: '#b06cff' }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'Host of the Tournament of Elements. Special: Overload.' });
  add({ id: 'chen_anacondrai', name: 'Anacondrai Chen', element: 'venom', unlock: { type: 'boss', arena: 'anacondrai_arena', round: 4, price: 300000 },
    look: { skin: '#a56cff', torso: '#6a2fa8', legs: '#4a1f7a', accent: '#e0b14a', hair: 'none', head: 'snake', face: 'evil', weapon: 'staff', weaponColor: '#e0b14a', torsoPrint: 'scales', scale: 1.15 },
    stats: { hp: 220, attack: 17, defense: 3, speed: 245 }, special: { type: 'burst', name: 'Anacondrai Overload', color: '#b06cff' }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'Chen, transformed by the Anacondrai spell.' });
  add({ id: 'clouse', name: 'Clouse', element: 'destruction', unlock: { type: 'boss', arena: 'chens_arena', round: 4, price: 80000 },
    look: { torso: '#2a1f3a', legs: '#2a1f3a', accent: '#6a2fa8', hair: 'slick', hairColor: '#9a9a9a', face: 'stern', weapon: 'none', torsoPrint: 'robe' },
    stats: { hp: 140, attack: 13, defense: 2, speed: 245 }, special: { type: 'burst', name: 'Dark Magic', color: '#8a3cff' }, features: { ranged: true, dodge: true, jumpSlam: false }, desc: "Chen's sorcerer. Master of dark magic." });
  add({ id: 'pythor', name: 'Pythor', element: 'venom', unlock: { type: 'boss', arena: 'jungle_ruins', round: 4, price: 90000 },
    look: { skin: '#e6dcf5', torso: '#e6dcf5', legs: '#b9a3e3', accent: '#6a2fa8', hair: 'none', head: 'snake', face: 'evil', weapon: 'fangblade', weaponColor: '#e0b14a', torsoPrint: 'scales', scale: 1.08 },
    stats: { hp: 150, attack: 14, defense: 2, speed: 260 }, special: { type: 'cloud', name: 'Venom Cloud', color: '#a8f04a' }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'Last of the Anacondrai.' });
  add({ id: 'eyezor', name: 'Eyezor', element: 'venom', unlock: { type: 'boss', arena: 'chens_arena', round: 3, price: 35000 },
    look: { torso: '#3a2a4a', legs: '#2a2a2a', accent: '#6a2fa8', hair: 'mohawk', hairColor: '#111111', face: 'angry', extras: ['eyepatch'], weapon: 'axe', weaponColor: '#c9ced4', torsoPrint: 'cultist' },
    stats: { hp: 130, attack: 13, defense: 1, speed: 250 }, special: { type: 'burst', name: 'Cultist Fury', color: '#8f4fd6' }, features: { ranged: false, dodge: true, jumpSlam: true }, desc: "Chen's one-eyed enforcer." });
  add({ id: 'zugu', name: 'Zugu', element: 'venom', unlock: { type: 'boss', arena: 'chens_palace', round: 2, price: 35000 },
    look: { torso: '#6a2fa8', legs: '#4a1f7a', accent: '#e0b14a', hair: 'helmet_snake', hairColor: '#6a2fa8', face: 'angry', weapon: 'hammer', weaponColor: '#c9ced4', torsoPrint: 'cultist', scale: 1.22 },
    stats: { hp: 180, attack: 16, defense: 3, speed: 215 }, special: { type: 'burst', name: 'Ground Pound', color: '#d9a04a' }, features: { ranged: false, dodge: false, jumpSlam: true }, desc: 'Big, strong, and very loud.' });
  add({ id: 'chope', name: 'Chope', element: 'venom', unlock: { type: 'boss', arena: 'chens_arena', round: 1, price: 25000 },
    look: { torso: '#6a2fa8', legs: '#e6b422', accent: '#e6b422', hair: 'helmet_snake', hairColor: '#6a2fa8', face: 'grin', weapon: 'sword', weaponColor: '#c9ced4', torsoPrint: 'cultist' },
    stats: { hp: 100, attack: 11, defense: 0, speed: 265 }, special: { type: 'dash_strikes', name: 'Snake Strike', color: '#8f4fd6' }, features: { ranged: false, dodge: true, jumpSlam: true }, desc: "Kapau's best friend and rival." });
  add({ id: 'kapau', name: 'Kapau', element: 'venom', unlock: { type: 'boss', arena: 'chens_arena', round: 0, price: 25000 },
    look: { torso: '#6a2fa8', legs: '#e6b422', accent: '#e6b422', hair: 'helmet_snake', hairColor: '#6a2fa8', face: 'smirk', weapon: 'spear', weaponColor: '#c9ced4', torsoPrint: 'cultist' },
    stats: { hp: 100, attack: 11, defense: 0, speed: 260 }, special: { type: 'dash_strikes', name: 'Snake Strike', color: '#8f4fd6' }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'Dreams of becoming a true Anacondrai.' });

  // ---------------- Elemental Masters ----------------
  add({ id: 'karlof', name: 'Karlof', element: 'metal', unlock: { type: 'boss', arena: 'chens_arena', round: 2, price: 45000 },
    look: { torso: '#5a6069', legs: '#3a3f46', accent: '#c9ced4', hair: 'bald', hairColor: '#f2c94c', face: 'angry', extras: ['mustache'], weapon: 'gauntlets', weaponColor: '#9aa4ad', torsoPrint: 'armor', scale: 1.15 },
    stats: { hp: 170, attack: 16, defense: 4, speed: 215 }, special: { type: 'burst', name: 'Metal Crush', color: '#c9d2da' }, features: { ranged: false, dodge: false, jumpSlam: true }, desc: 'Master of Metal. Karlof smash!' });
  add({ id: 'griffin', name: 'Griffin Turner', element: 'speed', unlock: { type: 'boss', arena: 'chens_palace', round: 0, price: 45000 },
    look: { torso: '#e8a51a', legs: '#c8401a', accent: '#1a1a1a', hair: 'spiky', hairColor: '#1a1a1a', face: 'grin', extras: ['shades'], weapon: 'none', torsoPrint: 'suit' },
    stats: { hp: 90, attack: 10, defense: 0, speed: 330 }, special: { type: 'dash_strikes', name: 'Speed Rush', color: '#ffd26a' }, features: { ranged: false, dodge: true, jumpSlam: false }, desc: 'Master of Speed. Blink and you miss him.' });
  add({ id: 'ash', name: 'Ash', element: 'smoke', unlock: { type: 'boss', arena: 'chens_palace', round: 1, price: 45000 },
    look: { torso: '#3a3a3a', legs: '#2a2a2a', accent: '#8a8a8a', hood: '#3a3a3a', head: 'hood', face: 'stern', weapon: 'none', torsoPrint: 'ninja' },
    stats: { hp: 100, attack: 12, defense: 1, speed: 280 }, special: { type: 'dash_strikes', name: 'Smoke Teleport', color: '#9a9a9a' }, features: { ranged: false, dodge: true, jumpSlam: true }, desc: 'Master of Smoke. Now you see him...' });
  add({ id: 'shade', name: 'Shade', element: 'shadow', unlock: { type: 'boss', arena: 'jungle_ruins', round: 2, price: 45000 },
    look: { torso: '#1a1a2a', legs: '#1a1a2a', accent: '#4a2f6b', hair: 'short', hairColor: '#111111', face: 'stern', weapon: 'daggers', weaponColor: '#4a4a5a', torsoPrint: 'suit' },
    stats: { hp: 105, attack: 13, defense: 1, speed: 275 }, special: { type: 'cloud', name: 'Shadow Veil', color: '#4a2f6b' }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'Master of Shadow. Strikes from the dark.' });
  add({ id: 'neuro', name: 'Neuro', element: 'mind', unlock: { type: 'boss', arena: 'dark_island', round: 3, price: 45000 },
    look: { torso: '#f0f0f0', legs: '#3a2a5a', accent: '#8a3cff', hair: 'headband', hairColor: '#111111', face: 'calm', weapon: 'none', torsoPrint: 'suit' },
    stats: { hp: 95, attack: 11, defense: 1, speed: 255 }, special: { type: 'burst', name: 'Mind Blast', color: '#d8b8ff' }, features: { ranged: true, dodge: true, jumpSlam: false }, desc: 'Master of Mind. He already knows your move.' });
  add({ id: 'paleman', name: 'Paleman', element: 'light', unlock: { type: 'boss', arena: 'ninjago_city', round: 1, price: 45000 },
    look: { skin: '#f7ecd0', torso: '#f7ecd0', legs: '#e8dcae', accent: '#c8a850', hair: 'flat', hairColor: '#e8dcae', face: 'calm', extras: ['shades'], weapon: 'none', torsoPrint: 'suit' },
    stats: { hp: 95, attack: 11, defense: 1, speed: 265 }, special: { type: 'burst', name: 'Blinding Flash', color: '#ffffff' }, features: { ranged: true, dodge: true, jumpSlam: false }, desc: 'Master of Light. Hard to look at.' });
  add({ id: 'chamille', name: 'Chamille', element: 'form', unlock: { type: 'boss', arena: 'jungle_ruins', round: 3, price: 45000 },
    look: { torso: '#3a1a4a', legs: '#2a1a3a', accent: '#ff5fb0', hair: 'long', hairColor: '#5ee04a', face: 'smirk', weapon: 'claws', weaponColor: '#c9ced4', torsoPrint: 'suit' },
    stats: { hp: 100, attack: 12, defense: 1, speed: 275 }, special: { type: 'dash_strikes', name: 'Shapeshift Strike', color: '#ff8fc8' }, features: { ranged: false, dodge: true, jumpSlam: true }, desc: 'Master of Form. Never the same twice.' });
  add({ id: 'jacob', name: 'Jacob', element: 'sound', unlock: { type: 'boss', arena: 'dark_island', round: 0, price: 40000 },
    look: { torso: '#5a3a8a', legs: '#2a2a2a', accent: '#e0b14a', hair: 'shaggy', hairColor: '#3a2416', face: 'calm', extras: ['shades'], weapon: 'sitar', weaponColor: '#9a6a2a', torsoPrint: 'robe' },
    stats: { hp: 95, attack: 10, defense: 1, speed: 250 }, special: { type: 'burst', name: 'Sonic Boom', color: '#a8dcff' }, features: { ranged: true, dodge: true, jumpSlam: false }, desc: 'Master of Sound. Hears everything.' });
  add({ id: 'bolobo', name: 'Bolobo', element: 'nature', unlock: { type: 'boss', arena: 'jungle_ruins', round: 0, price: 40000 },
    look: { torso: '#3a6a2a', legs: '#5a3a1a', accent: '#a8f04a', hair: 'shaggy', hairColor: '#7a5a2a', face: 'stern', extras: ['beard'], weapon: 'staff', weaponColor: '#7a5a2a', torsoPrint: 'robe', scale: 1.08 },
    stats: { hp: 130, attack: 13, defense: 2, speed: 235 }, special: { type: 'cloud', name: 'Vine Trap', color: '#7ad47a' }, features: { ranged: false, dodge: false, jumpSlam: true }, desc: 'Master of Nature. One with the jungle.' });
  add({ id: 'gravis', name: 'Gravis', element: 'gravity', unlock: { type: 'boss', arena: 'dark_island', round: 1, price: 40000 },
    look: { torso: '#3a3a5a', legs: '#2a2a3a', accent: '#a89cf0', hair: 'bald', hairColor: '#f2c94c', face: 'calm', weapon: 'none', torsoPrint: 'robe' },
    stats: { hp: 110, attack: 12, defense: 2, speed: 240 }, special: { type: 'burst', name: 'Gravity Well', color: '#7b6bd8' }, features: { ranged: true, dodge: false, jumpSlam: true }, desc: 'Master of Gravity. Down is a suggestion.' });
  add({ id: 'tox', name: 'Tox', element: 'poison', unlock: { type: 'boss', arena: 'jungle_ruins', round: 1, price: 40000 },
    look: { torso: '#2a3a1a', legs: '#1a1a1a', accent: '#a8f04a', hair: 'ponytail', hairColor: '#7ad41a', face: 'smirk', extras: ['gasmask'], weapon: 'daggers', weaponColor: '#7ad41a', torsoPrint: 'suit' },
    stats: { hp: 95, attack: 12, defense: 1, speed: 270 }, special: { type: 'cloud', name: 'Toxic Cloud', color: '#a8f04a' }, features: { ranged: true, dodge: true, jumpSlam: false }, desc: 'Master of Poison. Do not breathe in.' });

  // ---------------- Skulkin ----------------
  add({ id: 'samukai', name: 'Samukai', element: 'bone', unlock: { type: 'boss', arena: 'skulkin_caves', round: 4, price: 90000 },
    look: { skin: '#f0eee6', torso: '#1a1a1a', legs: '#1a1a1a', accent: '#c8102e', hair: 'none', head: 'skull', face: 'skull', extras: ['fourarms'], weapon: 'dualswords', weaponColor: '#c9ced4', torsoPrint: 'ribs', scale: 1.25 },
    stats: { hp: 190, attack: 15, defense: 2, speed: 240 }, special: { type: 'spinjitzu', name: 'Skull Whirl' }, features: { ranged: true, dodge: false, jumpSlam: true }, desc: 'King of the Underworld. Four arms, four blades.' });
  add({ id: 'kruncha', name: 'Kruncha', element: 'bone', unlock: { type: 'boss', arena: 'skulkin_caves', round: 2, price: 30000 },
    look: { skin: '#f0eee6', torso: '#3a3a3a', legs: '#1a1a1a', accent: '#5a5a5a', hair: 'helmet_horn', hairColor: '#5a5a5a', head: 'skull', face: 'skull', weapon: 'axe', weaponColor: '#c9ced4', torsoPrint: 'ribs', scale: 1.1 },
    stats: { hp: 140, attack: 14, defense: 2, speed: 230 }, special: { type: 'spinjitzu', name: 'Bone Whirl' }, features: { ranged: false, dodge: false, jumpSlam: true }, desc: 'Skulkin general. Not the brains of the outfit.' });
  add({ id: 'nuckal', name: 'Nuckal', element: 'bone', unlock: { type: 'boss', arena: 'skulkin_caves', round: 1, price: 30000 },
    look: { skin: '#f0eee6', torso: '#1f3f8f', legs: '#1a1a1a', accent: '#c8102e', hair: 'spiky', hairColor: '#e0e0e0', head: 'skull', face: 'skull', weapon: 'mace', weaponColor: '#c9ced4', torsoPrint: 'ribs' },
    stats: { hp: 110, attack: 12, defense: 1, speed: 275 }, special: { type: 'dash_strikes', name: 'Bone Rush', color: '#f4f1e6' }, features: { ranged: false, dodge: true, jumpSlam: true }, desc: 'Skulkin general. Definitely not the brains either.' });
  add({ id: 'krazi', name: 'Krazi', element: 'bone', unlock: { type: 'boss', arena: 'skulkin_caves', round: 0, price: 25000 },
    look: { skin: '#f0eee6', torso: '#1f3f8f', legs: '#1a1a1a', accent: '#c8102e', hair: 'jester', hairColor: '#c8102e', head: 'skull', face: 'skull', weapon: 'pickaxe', weaponColor: '#5a5a5a', torsoPrint: 'ribs' },
    stats: { hp: 95, attack: 11, defense: 0, speed: 290 }, special: { type: 'dash_strikes', name: 'Krazi Frenzy', color: '#f4f1e6' }, features: { ranged: false, dodge: true, jumpSlam: true }, desc: 'The craziest of the Skulkin.' });
  add({ id: 'frakjaw', name: 'Frakjaw', element: 'bone', unlock: { type: 'boss', arena: 'skulkin_caves', round: 3, price: 30000 },
    look: { skin: '#f0eee6', torso: '#8a1a2a', legs: '#1a1a1a', accent: '#c8102e', hair: 'helmet_horn', hairColor: '#8a1a2a', head: 'skull', face: 'skull', weapon: 'bone', weaponColor: '#f0eee6', torsoPrint: 'ribs' },
    stats: { hp: 120, attack: 13, defense: 1, speed: 255 }, special: { type: 'burst', name: 'Bone Storm', color: '#f4f1e6' }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'Skulkin fire warrior.' });

  // ---------------- Stone Army / Nindroids ----------------
  add({ id: 'kozu', name: 'General Kozu', element: 'stone', unlock: { type: 'boss', arena: 'dark_island', round: 2, price: 70000 },
    look: { skin: '#8f9498', torso: '#5a5f64', legs: '#3a3f44', accent: '#c8102e', hair: 'helmet_samurai', hairColor: '#3a3f44', head: 'stone', face: 'angry', extras: ['fourarms'], weapon: 'dualswords', weaponColor: '#c9ced4', torsoPrint: 'stone', scale: 1.22 },
    stats: { hp: 200, attack: 16, defense: 4, speed: 220 }, special: { type: 'burst', name: 'Stone Quake', color: '#a2a7ac' }, features: { ranged: false, dodge: false, jumpSlam: true }, desc: 'General of the indestructible Stone Army.' });
  add({ id: 'cryptor', name: 'General Cryptor', element: 'tech', unlock: { type: 'boss', arena: 'ninjago_city', round: 4, price: 90000 },
    look: { skin: '#2a2a2a', torso: '#2a2a2a', legs: '#1a1a1a', accent: '#ff3b3b', hair: 'none', head: 'robot', face: 'robot_red', weapon: 'sword', weaponColor: '#c9ced4', torsoPrint: 'nindroid', scale: 1.1 },
    stats: { hp: 170, attack: 15, defense: 3, speed: 260 }, special: { type: 'burst', name: 'Overcharge', color: '#ff6b6b' }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'Leader of the Nindroid army.' });
  add({ id: 'min_droid', name: 'Min-Droid', element: 'tech', unlock: { type: 'boss', arena: 'ninjago_city', round: 0, price: 20000 },
    look: { skin: '#2a2a2a', torso: '#2a2a2a', legs: '#1a1a1a', accent: '#ff3b3b', hair: 'none', head: 'robot', face: 'robot_red', weapon: 'blaster', weaponColor: '#5a5a5a', torsoPrint: 'nindroid', scale: 0.82 },
    stats: { hp: 80, attack: 9, defense: 1, speed: 300 }, special: { type: 'dash_strikes', name: 'Micro Rush', color: '#ff6b6b' }, features: { ranged: true, dodge: true, jumpSlam: false }, desc: 'Small. Angry. Surprisingly dangerous.' });
  add({ id: 'pixal', name: 'P.I.X.A.L.', element: 'tech', unlock: { type: 'boss', arena: 'ninjago_city', round: 3, price: 50000 },
    look: { skin: '#c7ccd2', torso: '#e8ecf0', legs: '#8a9199', accent: '#3fbf9f', hair: 'ponytail', hairColor: '#b8bcc4', head: 'robot', face: 'robot_green', weapon: 'daggers', weaponColor: '#3fbf9f', torsoPrint: 'titanium' },
    stats: { hp: 100, attack: 11, defense: 2, speed: 280 }, special: { type: 'burst', name: 'System Overload', color: '#5fe0c0' }, features: { ranged: true, dodge: true, jumpSlam: true }, desc: 'Primary Interactive X-ternal Assistant Life-form.' });

  const byId = {};
  for (const c of list) byId[c.id] = c;
  return { list, byId, get: (id) => byId[id] };
})();
