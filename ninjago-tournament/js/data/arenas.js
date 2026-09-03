/* ============================================================
   NT.Arenas — arena definitions (floor style, decor, bounds, sky)
   ============================================================ */
NT.Arenas = (function () {
  const list = [
    { id: 'chens_arena', name: "Chen's Island Arena", floor: 'stone_rings', shape: 'circle', radius: 520,
      sky: ['#0b1022', '#1a2447', '#33456f'], wall: 'stands', music: 'battle', ambient: 'torches',
      obstacles: [{ x: 0, z: -40, r: 30 }],
      decor: [{ type: 'pillar', x: 0, z: -40 }, ...torchRing(560, 12)],
      pool: ['thug', 'thug', 'thug_brawler', 'cultist', 'cultist_spear', 'kabuki'], heavy: 'anacondrai' },
    { id: 'chens_palace', name: "Chen's Palace Dojo", floor: 'wood', shape: 'rect', w: 980, h: 720,
      sky: ['#2a0c08', '#5a1c10', '#8a3018'], wall: 'dojo', music: 'battle', ambient: 'lanterns',
      obstacles: [],
      decor: [{ type: 'redpillar', x: -420, z: -330 }, { type: 'redpillar', x: 420, z: -330 }, { type: 'redpillar', x: -420, z: 330 }, { type: 'redpillar', x: 420, z: 330 },
        { type: 'lantern', x: -200, z: -370 }, { type: 'lantern', x: 200, z: -370 }, { type: 'shrine', x: 0, z: -400 }, { type: 'lantern', x: -480, z: 0 }, { type: 'lantern', x: 480, z: 0 }],
      pool: ['cultist', 'cultist', 'cultist_spear', 'kabuki', 'thug_brawler', 'serpentine'], heavy: 'anacondrai' },
    { id: 'jungle_ruins', name: 'Island Jungle Ruins', floor: 'mossy', shape: 'circle', radius: 500,
      sky: ['#07130c', '#0f2a18', '#1c4a2a'], wall: 'jungle', music: 'battle', ambient: 'fireflies',
      obstacles: [{ x: -260, z: -180, r: 34 }, { x: 250, z: 160, r: 34 }],
      decor: [{ type: 'ruin', x: -260, z: -180 }, { type: 'ruin', x: 250, z: 160 }, ...ring('tree', 560, 10, 0.3), { type: 'statue', x: 0, z: -470 }],
      pool: ['serpentine', 'serpentine', 'serpentine_fang', 'cultist', 'cultist_spear', 'thug'], heavy: 'anacondrai' },
    { id: 'skulkin_caves', name: 'Underworld Caves', floor: 'rock', shape: 'circle', radius: 500,
      sky: ['#0a0303', '#2a0a06', '#4a1208'], wall: 'cave', music: 'boss', ambient: 'embers',
      obstacles: [{ x: 220, z: -220, r: 36 }],
      decor: [{ type: 'stalagmite', x: 220, z: -220 }, ...ring('stalagmite', 560, 9, 0.4), { type: 'bones', x: -300, z: 120 }, { type: 'bones', x: 150, z: 300 }, { type: 'lava', x: -150, z: -350 }],
      pool: ['skulkin', 'skulkin', 'skulkin', 'skulkin_axe', 'skulkin_archer'], heavy: 'stone_giant' },
    { id: 'dark_island', name: 'Dark Island Temple', floor: 'darkstone', shape: 'rect', w: 960, h: 760,
      sky: ['#0a0616', '#1d0f38', '#3a1a5a'], wall: 'temple', music: 'boss', ambient: 'darkmatter',
      obstacles: [],
      decor: [{ type: 'stonestatue', x: -400, z: -330 }, { type: 'stonestatue', x: 400, z: -330 }, { type: 'stonestatue', x: -400, z: 330 }, { type: 'stonestatue', x: 400, z: 330 }, { type: 'brazier', x: -150, z: -400 }, { type: 'brazier', x: 150, z: -400 }, { type: 'brazier', x: -480, z: 0 }, { type: 'brazier', x: 480, z: 0 }],
      pool: ['stone_warrior', 'stone_warrior', 'stone_scout', 'stone_warrior', 'nindroid'], heavy: 'stone_giant' },
    { id: 'ninjago_city', name: 'Ninjago City Rooftop', floor: 'metal', shape: 'rect', w: 1000, h: 700,
      sky: ['#050a1a', '#0e1a3a', '#1d2f5a'], wall: 'city', music: 'battle', ambient: 'neon',
      obstacles: [{ x: -300, z: 200, r: 44 }, { x: 320, z: -220, r: 44 }],
      decor: [{ type: 'vent', x: -300, z: 200 }, { type: 'vent', x: 320, z: -220 }, { type: 'neon', x: -450, z: -360 }, { type: 'neon', x: 450, z: -360, alt: true }, { type: 'antenna', x: 0, z: -380 }, { type: 'crate', x: 480, z: 120 }, { type: 'crate', x: -480, z: -80 }],
      pool: ['nindroid', 'nindroid', 'nindroid_blaster', 'nindroid', 'stone_scout', 'thug_brawler'], heavy: 'nindroid_heavy' },
    { id: 'anacondrai_arena', name: 'Arena of Elements', floor: 'stone_rings_dark', shape: 'circle', radius: 520,
      sky: ['#12061e', '#2a0f44', '#4a1a6a'], wall: 'stands_dark', music: 'boss', ambient: 'purpleflames',
      obstacles: [{ x: 0, z: -40, r: 30 }],
      decor: [{ type: 'pillar', x: 0, z: -40, dark: true }, ...torchRing(560, 12, true), { type: 'snakestatue', x: -420, z: -420 }, { type: 'snakestatue', x: 420, z: -420 }],
      pool: ['anacondrai', 'cultist', 'cultist_spear', 'serpentine_fang', 'stone_warrior', 'nindroid', 'skulkin_axe'], heavy: 'anacondrai' },
  ];
  function torchRing(r, n, purple) {
    const out = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.PI / n; out.push({ type: 'torch', x: Math.cos(a) * r, z: Math.sin(a) * r, purple: !!purple }); }
    return out;
  }
  function ring(type, r, n, jitter) {
    const out = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (Math.sin(i * 7.3) * jitter); const rr = r + Math.cos(i * 3.1) * 40; out.push({ type, x: Math.cos(a) * rr, z: Math.sin(a) * rr, v: i % 3 }); }
    return out;
  }
  const byId = {}; for (const a of list) byId[a.id] = a;
  return { list, byId, get: (id) => byId[id] };
})();
