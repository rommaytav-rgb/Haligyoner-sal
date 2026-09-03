# LEGO NINJAGO: Tournament — playable browser replica

A fan-made, from-scratch recreation of the 2015 mobile game **LEGO NINJAGO: Tournament** that runs in any
mobile or desktop browser. No engine, no build step, no external dependencies: open `index.html`
(or host the folder on GitHub Pages) and play.

> Every asset is generated procedurally (LEGO minifigures, arenas, UI, effects and sound are all drawn /
> synthesized in code). Nothing is extracted from the original game.

## Play

* **Touch**: left joystick moves (flick the stick to dodge), right-hand buttons are Shield (hold to block /
  parry), Jump Slam, Kick and Sword. The Spinjitzu button next to the joystick fires the special move when the
  meter is full. The orange tab on the left edge pauses.
* **Keyboard**: WASD / arrows move · `J` attack · `K` kick · `L` jump slam · `U` block · `Shift` dodge ·
  `Space` Spinjitzu / special · `Esc` pause.
* **Combat**: sword ×3 = combo finisher, kicks and jump slams knock enemies down, block just before a hit to
  parry. Characters with a ranged attack throw automatically when enemies are far away. Combo hits fill the
  Spinjitzu meter and multiply stud drops.
* **Tournament**: 7 arenas × 5 rounds. Each round is waves of grunts followed by a champion (an elemental
  master or villain); round 5 is the arena boss. Defeating a champion unlocks them as a playable character.
  Wins award studs and XP; XP raises a character's **True Potential** level (Novice → Grandmaster, more hearts
  and damage). Studs buy characters in the shop (cart button). The gift box gives a daily stud bonus.
* Progress is saved in the browser (localStorage).

## Structure

```
index.html            entry point (plain <script> tags, works from file:// and any static host)
css/style.css
js/core/    utils, save (localStorage), audio (WebAudio synth + optional file overrides), input (multitouch +
            keyboard), scene manager (transitions, overlays), camera (perspective ground projection)
js/data/    characters (46 playable, data-driven), enemies (grunt archetypes), arenas (7), tournament plan
js/render/  minifig (procedural LEGO figure renderer + poses), ui (gold/purple widgets & icons), vfx, arena
js/game/    entity (fighter: combat, specials, status, animation), ai, player controller, progression, hud,
            battle scene (waves, champions, banners, results)
js/scenes/  boot/menu, arena select, character select + shop, true potential, overlays (pause/settings)
tools/build.js   bundles everything into dist/ninjago-tournament.html (single file)
assets/audio/    optional: drop <name>.mp3 files here (see NT.Audio.MANIFEST) to replace synthesized sounds
```

## Build a single-file version

```
node tools/build.js
```

## Notes

* Fan project for educational purposes. LEGO and NINJAGO are trademarks of the LEGO Group; this project is not
  affiliated with or endorsed by LEGO.
