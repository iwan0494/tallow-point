# tallow-point

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/iwan0494/tallow-point/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/iwan0494/tallow-point/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Tallow Point: sun-soaked open-world crime — 5 story missions, Tallow PD dispatch with roadblocks and Air One, weapon slots, respect ranks, saves, radio.

An original open-world crime game in the spirit of GTA 6, built with three.js and played offline in a desktop browser from static files. No Rockstar names, characters, maps or assets — the city, characters, vehicles, story and sound are all original.

## The city

Tallow Point is a 7×7-block coastal city with five districts that each look and feel different:

- **Sunmere / Palma Strand** — beachfront, palms, surf shacks, FRIENDLY · 74
- **Crater Row / The Foundry** — brickworks, chimneys and scrap yards, NEUTRAL · 58
- **Neon Mile / Downtown** — glass towers, casinos and neon signs, NEUTRAL · 52
- **Marina Row / The Harbor** — docks, cranes and blue harbour light, FRIENDLY · 66
- **Vesper Docks / The Yards** — warehouses, containers and locked gates, HOSTILE · 31

## What is in the game

- **Drive and steal cars** — the gold Comet GT is yours; any parked car can be carjacked with E. Traffic follows the road graph, pedestrians stroll the sidewalks and flee when trouble comes, beachgoers crowd the sand in Sunmere.
- **Five story missions** — Courier Run, Hot Pursuit, Boost the Comet, Night Shift and Kingpin ($500–$1,900), each in three stages with an objective, a timer and a payout, handed out by five named fixers: Sinta Marlowe, Bram Oka, Lena Voss, Raka Dune and Nadia Ferrante.
- **Tallow PD** — a wanted system from 1 to 5 stars. Named units answer by role: TALLOW-12 ramming, TALLOW-07 roadblock, TALLOW-31 PIT, TALLOW-04 shore watch and AIR-1, the helicopter with a sweeping searchlight. Roadblocks appear at 3 stars, the helicopter at 4, and getting caught on foot means BUSTED.
- **Combat** — shoot with the mouse, punch with F, LIFE and ARMOR bars, and every violent act raises the heat.
- **Progression** — respect ranks (Rookie → Wheelman → Shot Caller → Fixer → Kingpin) with an RP bar, four weapon slots with ammo, prices and locks, the Comet's condition %, a four-person crew with abilities, district standings, career stats and Radio Tallow 98.4.
- **HUD and map** — wanted stars, cash, clock, district card, mission panel, fixer dialog, dispatch board, minimap with the player, police and objective markers, and a full city-map screen (Tab) with standings, career stats and the mission list.
- **Save** — progress autosaves to localStorage; CONTINUE resumes it, NEW GAME starts over.
- **Sound** — engine hum, police sirens, gunshots, crashes, horns and a radio groove, all synthesized locally with WebAudio. No audio files, no network.
- **Screens** — a title screen with a named save slot, a map/stats screen, a daytime beach chase and a golden-hour helicopter chase.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network request.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Drive / walk |
| Shift | Run on foot |
| E | Enter, exit or steal a car |
| M | Start the next mission |
| Mouse click | Shoot |
| F | Punch |
| Tab | City map & stats |
| 1–4 | Weapon slots |
| N | Mute |
| Esc / P | Pause |
| R | Respawn after BUSTED / WASTED |

## Tech

- three.js r160 (vendored UMD build under `game/vendor/`, MIT — see `game/vendor/THREE-LICENSE.txt`)
- Plain ES modules, no bundler, no build step
- Screenshots are staged from the real game with `?shot=N&seed=1337` (see `shots.json`)

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
