# Elemental Ninjas – Pixel-Art Open-World PvE Game

## 0. Context and constraints

- The folder contains `ninjas-pixel.html`. It holds the sprite engine (`drawChar`, `blit`, layouts) and the pixel data for 5 playable ninjas (`CHARS`) and 3 enemies (`ENEMIES`), with idle / walk / attack animations. **Reuse it as-is.** Copy the engine and the data objects into the game. Do not redraw or restyle any character.
- Deliverable: **one self-contained HTML file** (`game.html`). HTML5 Canvas, vanilla JS, no external images, no libraries. All tiles, effects and UI are drawn in code in the same 16-bit pixel-art style.
- Target: mobile phone, portrait orientation. Canvas scaled with `image-rendering: pixelated`.
- Controls: virtual joystick (left thumb), and on the right three buttons: **Attack**, **Ability** (with cooldown ring), **Dodge** (with cooldown ring). Keyboard for desktop testing: WASD / arrows, Space = attack, E = ability, Shift = dodge.
- UI language: **Hebrew (RTL)**. Character names stay in English.
- Persistence: auto-save to `localStorage` (coins, character levels, unlocked characters, character shards, chest states, defeated bosses, unlocked maps).
- Architecture: all content lives in data objects at the top of the file — `CHARS`, `ENEMIES`, `MAPS`, `TIERS`. Adding a map or an enemy must never require touching the engine.
- Performance: cap at 25 active enemies; enemies far outside the camera are not updated; object pool for projectiles and particles; target 60 fps on a mid-range phone.

## 1. Game overview

A fast, arcade-style **PvE action game** with a top-down 3/4 view. The player explores **huge maps**, fights large numbers of skeletons, occasionally meets a **rare boss**, collects coins and character shards, levels characters up, and unlocks new ninjas. Combat should feel fast, punchy and addictive — many hits, many enemies, constant feedback. Not a slow fighting game.

## 2. Main menu

Pixel logo, then three options:

1. **Choose Map** — one card per map: name, level range (e.g. "Levels 1–6"), bosses found there, locked/unlocked. Future maps show as locked with "Coming soon".
2. **My Characters** — all 5 ninjas with level, upgrade button, unlock progress (shards).
3. **Settings** — vibration on/off, damage numbers on/off, reset save.

**Map entry rule:** a map can only be entered with a character whose level is **inside the map's level range**. Below range → "Too weak for this map". Above range → "Too strong — move on to the next map". This keeps the balance system intact.

## 3. Levels and scaling

- Each character has a **level 1–30**. Levels are bought with coins collected from enemies. Cost of level *n*: `40 * n * n` coins.
- Each level grants **+8% HP and +8% damage** over the base stats.
- Map tiers: **Map 1 = levels 1–6**, **Map 2 (future) = levels 6–12**, then 12–18, etc.
- Enemies scale per map through a single `TIERS` table (HP and damage multipliers per map tier). Map 1 uses multiplier 1.0.

Base stats at level 1:

| Character | Role | HP | DMG | Move speed | Attack rate |
|---|---|---|---|---|---|
| CLAY | Tank | 180 | 12 | 3.0 | 2.0 / s |
| BECK | Fast striker | 130 | 14 | 4.5 | 3.2 / s |
| BOREAS | Control / slow | 100 | 13 | 3.2 | 2.4 / s |
| APOLLO | Glass cannon | 95 | 20 | 3.4 | 2.2 / s |
| SHADE | Balanced | 140 | 16 | 3.6 | 2.6 / s |

Attack rates are deliberately high. Holding the attack button keeps attacking.

## 4. Movement and combat feel (high priority)

Invest real effort here. The game must feel physical.

- **Momentum movement:** acceleration and deceleration, a small slide when stopping, sprite faces the movement direction, body bob from the sprite engine while running. Sand slows movement slightly, stone paths speed it up slightly.
- **Attacks with weight:** every attack performs a short forward **lunge** and a small recoil. On hit apply **hit-stop** of 40–60 ms (freeze the frame). The target receives **knockback** along the hit direction with friction — it slides and stops, never teleports.
- **Hit reaction:** white flash, **stagger** (150 ms of no movement), floating damage number that pops up and falls.
- **Combo:** three consecutive basic attacks form a combo; the third hits for **+50%** with a larger animation and a light screen shake.
- **Dodge:** 0.3 s roll with invulnerability, 1 s cooldown. Essential against bosses.
- **Real projectiles:** ice ball, shadow bolt and water strike travel with velocity, leave a particle trail and burst on impact. No instant hits.
- **Camera:** follows with lerp, leads slightly in the movement direction, shakes on heavy hits and on boss spawn.

## 5. Playable characters

### Basic attacks
- **CLAY** — short dagger slash in a 90° arc; every hit knocks the target back a little.
- **BECK** — very fast water strike hitting every enemy in a short line ahead.
- **BOREAS** — fires an **ice ball** (long range). Target is **slowed 40%** (movement and attack rate) for 2 s, tinted blue.
- **APOLLO** — **flame cone** forward. Damage scales with distance: point-blank = 100%, max range = 40%. Applies burn: 3 dmg/s for 2 s.
- **SHADE** — throws a **purple shadow bolt** (medium range) that pierces one enemy and continues to a second.

### Abilities (cooldowns)
- **CLAY – Stone Wall** (8 s): slams the ground; enemies in radius are knocked back and stunned 1 s; Clay takes 50% less damage for 3 s. Screen shake + sand particles.
- **BECK – Tidal Dash** (5 s): dashes ~5 tiles forward, 150% damage to everything in the path, leaves a water trail granting +30% speed for 3 s.
- **BOREAS – Frost Nova** (9 s): freezes all enemies in a medium radius for 2 s (no movement, no attacks, white-blue tint). Hits on frozen enemies deal double damage.
- **APOLLO – Inferno** (7 s): fire burst around him, 200% damage in a short radius plus burn 5 dmg/s for 3 s.
- **SHADE – Shadow Step** (8 s): vanishes for 1.5 s (invulnerable), reappears behind the nearest enemy and lands a **x3 critical hit**. Purple smoke on vanish and reappear.

## 6. Enemies (sprites from the file)

Enemies must feel alive: patrol, notice, surround, telegraph, react.

### Skeleton (common, appears in numbers)
- HP 40, DMG 8, speed 2.5. Sword, short range.
- **Behavior:** wanders near its camp when the player is not seen; on sight raises the sword and runs; skeletons **surround** the player (each one claims a different angle) instead of stacking; every attack has a **0.3 s telegraph** (sword raised); on hit → stagger and recoil; some retreat a few steps at 20% HP and then return.
- **Shield:** 25% chance to block a hit coming from the front (block animation + "Blocked!" text).
- Death: falls apart into bones that fade after 1 s. Drops 5–8 coins.
- Spawns from **bone piles** on the map: up to 4 per pile, pile refills after 40 s.

### Hippo boss (rare)
- HP 600, DMG 25, speed 1.8. Drops 200 coins + CLAY shards.
- **Spawn:** each map has 3–4 possible lair points near the river. On map entry the hippo spawns at a random one with **~20% chance**, or is guaranteed after **5 minutes** of play on the map. Spawn announcement: "Something heavy is coming…" + ground shake.
- **Abilities:** (1) 360° chain-flail swing with a 0.8 s telegraph (red circle); (2) charge in a straight line toward the player, knocking back anything hit; (3) below 50% HP: stomp that sends expanding shockwave rings the player must step between.

### Crocodile boss (very rare)
- HP 500, DMG 22, speed 2.6. Drops 250 coins + APOLLO shards.
- **Spawn:** 3 possible lair points in the swamp. **~5% chance** on map entry, or guaranteed after **12 minutes** spent in the swamp. Announcement: swamp darkens, bubbles rise, then it bursts out of the water.
- **Abilities:** (1) cleaver slam along a line (telegraph line then damage); (2) 360° tail spin with knockback; (3) lunge bite — fast dash followed by 3 consecutive bites; (4) at 50% HP summons 3 skeletons.

Boss rules: big HP bar with name at the top of the screen, background darkens slightly, every ability has a clear **telegraph** shape on the floor so it can be dodged.

## 7. Character unlocking (hard by design)

- Start with **SHADE** only.
- Every other character requires **10 character shards** (pixel icon of that character):
  - **CLAY** — shards drop from the hippo (2–3 per kill).
  - **APOLLO** — shards drop from the crocodile (3–4 per kill).
  - **BECK** — 1 shard per **golden chest**; 4–5 golden chests per map, refilled once per day.
  - **BOREAS** — 1 shard per **50 skeleton kills** (hidden counter) plus 3 shards in the secret chest in the far corner of the map.
- The characters screen shows shard progress (e.g. 7/10) and where shards come from.

## 8. Maps (huge)

- Each map is **at least 200 × 150 tiles** (16 px tiles), defined as data: a list of **biome regions** (shape, size, tile type, decoration density) and a list of **objects** (camps, chests, lair points, village). The engine builds the tile grid from the regions, sprinkles trees/rocks per biome, and draws everything in code.
- Tiles: grass, dirt, sand, water, swamp, stone path, trees, rocks, village houses, bone piles, chests (normal / golden / secret).
- **Minimap** in a corner; tap to open the **full map** with fog of war over unexplored areas.

### Map 1 – "Bone Shore" (levels 1–6)
- **Village** at the center: respawn point, upgrade NPC, character-select NPC, signposts.
- **Forest** all around the village: scattered skeletons, normal chests.
- **Beach** along the east: dense skeleton camps, golden chests.
- **River** in the north with 3 possible hippo lair points.
- **Swamp** in the south, winding paths, 3 possible crocodile lair points.
- **Hidden corner** in the north-west behind a wall of trees: the BOREAS secret chest.
- Clear paths between areas, but plenty of open ground to explore.

## 9. HUD and feedback

HP bar, coins, level, character icon, cooldown rings for ability and dodge, HP bar above every enemy, floating damage numbers, element-colored particles, screen shake, hit-stop. Death: "You fell" screen, respawn in the village with full HP, lose 10% of coins.

## 10. Build order

Build step by step and show me each step before continuing:

1. Main menu + huge map generation + momentum movement + camera + joystick.
2. Skeletons: surrounding AI, telegraph, shield, stagger, knockback, death, coins. Hit-stop and damage numbers.
3. All 5 characters: fast basic attacks, combo, projectiles, abilities, dodge.
4. Levels, coins, shards, characters screen, map level-range check, save/load.
5. Both bosses with random rare spawning.
6. Chests, minimap, fog of war, polish.

## 11. Code architecture (so we can keep adding content)

- Single file, but organized into clearly separated sections with header comments: `DATA` (CHARS, ENEMIES, MAPS, TIERS), `SPRITE ENGINE` (from ninjas-pixel.html), `INPUT`, `WORLD` (map generation, tiles, camera), `ENTITIES` (player, enemies, projectiles, particles, chests), `COMBAT` (hitboxes, damage, status effects, knockback, hit-stop), `UI` (menus, HUD, characters screen), `SAVE`, `LOOP`.
- Fixed-timestep update (60 Hz) with render interpolation; hit-stop implemented as a time-scale on the update, not by blocking the loop.
- A simple game state machine: `MENU`, `MAP_SELECT`, `CHARACTERS`, `PLAYING`, `PAUSED`, `DEAD`, `BOSS_INTRO`.
- Every enemy is a data entry plus a small behavior function; every ability is a data entry (cooldown, cost, icon color) plus a function. Adding a new enemy or ability = one data entry + one function.
- Status effects (slow, freeze, burn, stun, shield) go through one generic system with duration, tint and per-tick logic.
- Hitboxes: circles for bodies, arcs / lines / circles for attacks. Draw them when debug mode is on.

## 12. Audio (synthesized, no files)

Use the Web Audio API to synthesize all sounds in code: hit, block, projectile, ability per element, coin pickup, chest open, level up, hurt, death, boss roar, boss intro drum. Short retro-style sounds. A simple looping chiptune-style bass line for the map and a tenser one during boss fights. Mute toggle in settings. Audio starts only after the first user tap (mobile autoplay rules).

## 13. Onboarding

The first 30 seconds must teach without text walls: spawn in the village, an arrow points to the first bone pile just outside it with 2 skeletons; short hint bubbles appear once ("Hold to attack", "Swipe the button to dodge", "Try your ability"). After the first kill, a coin flies to the HUD counter. Hints never show again after being completed.

## 14. Debug mode (for testing with me)

A hidden toggle (tap the version number 5 times in Settings): god mode, +1000 coins, +10 shards, spawn hippo / crocodile next to the player, unlock all characters, show hitboxes and FPS. Nothing from debug mode is saved to localStorage.

## 15. Working rules

- Ask me before deciding anything that is not written here.
- After each build step, list what was implemented, what is stubbed, and any known bugs.
- Keep a `TODO / NEXT MAPS` comment block at the end of the file listing the hooks for future content (new map data, new enemy types, new abilities).
