# Tallow Point

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/iwan0494/tallow-point/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/iwan0494/tallow-point/reward.svg)](https://make.fun/c/gta6-01)

An open-world crime game in the browser, built for the make.fun **gta6-01**
bounty ("Make GTA 6"). Explore a sun-soaked 3D city on foot and by car,
steal cars, outrun the police, and work through five story missions — all
from static files, with no network request while playing.

## The city

Tallow Point is a 7×7-block city in five districts, each with its own
character: **Kessel Wharf** (warehouses on the west edge), **Northline**
(office towers), **Moraine Heights** (apartments), **Crater Row** (shops and
your safehouse) and **Sunmere** (houses in the south). Roads link every
block, traffic follows the road graph, and pedestrians walk the sidewalks.

## Features

- Walk and drive: a coupe of your own, parked cars and traffic to steal.
- Carjacking: walk up to a parked or stopped car and take it.
- Wanted system, 1–5 stars: heat rises when you steal, crash or speed past
  the police; cruisers chase you, roadblocks appear at 3 stars, and a police
  helicopter circles at 4–5 stars.
- Five story missions with HUD objectives and cash rewards.
- Combat on foot, LIFE and ARMOR, BUSTED and DEAD screens with respawn.
- HUD with cash, LIFE/ARMOR bars, clock, wanted stars and a live minimap.
- Golden-hour lighting, street lamps, and a save in localStorage.
- Procedural sound: engine, crashes, gunfire, sirens and a simple score —
  all generated locally, no audio files.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Walk / drive (S brakes, then reverses) |
| Shift | Run (on foot) |
| Mouse drag | Turn |
| E | Steal / enter / exit car |
| F | Punch (melee, on foot) |
| Space | Shoot (pistol, on foot) |
| R | Respawn after BUSTED / DEAD |

## Play it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into the output directory and
writes `dossier.json` with the vendored make.fun library.

## Tech

Three.js (vendored under `game/vendor/`), plain ES modules, no build step,
no network. The game is original work: its city, names, story and art are
its own, nothing from any commercial game.
