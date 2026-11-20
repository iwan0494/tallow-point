// Tallow Point — gta6-01 entry program (Node 22, standard library only).
// Copies game/ and screenshots/ from this repository to the output
// directory and writes /output/dossier.json with the kit's vendored
// library. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Before writing the dossier it refuses the two failure modes that sank
// the previous round: a vendored three.js module build (three.module.js /
// three.core.js) must not be in game/, and the minified three.min.js must
// stay under 1 MiB. The game itself loads three.js from the global THREE
// object that vendor/three.min.js provides via a plain <script> tag.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotDir = join(here, 'screenshots');

function fail(message: string): never {
  console.error('main.ts: ' + message);
  process.exit(1);
}

// 1. The forbidden module builds must not be in the game.
for (const bad of ['vendor/three.module.js', 'vendor/three.core.js']) {
  if (existsSync(join(gameDir, bad))) {
    fail('forbidden vendored file present: game/' + bad +
      ' — use the minified vendor/three.min.js instead');
  }
}

// 2. The minified three.js must exist and stay small.
const threeMin = join(gameDir, 'vendor', 'three.min.js');
if (!existsSync(threeMin)) fail('missing game/vendor/three.min.js');
const threeBytes = statSync(threeMin).size;
if (threeBytes >= 1024 * 1024) {
  fail('game/vendor/three.min.js is ' + threeBytes + ' bytes (>= 1 MiB)');
}

// 3. The game entry point must exist.
if (!existsSync(join(gameDir, 'index.html'))) fail('missing game/index.html');

// 4. Screenshots: 3 or 4 PNGs, each at most 256 KiB.
if (!existsSync(shotDir)) fail('missing screenshots/ directory');
const shots = readdirSync(shotDir).filter((f) => f.endsWith('.png')).sort();
if (shots.length < 3 || shots.length > 4) {
  fail('expected 3 or 4 screenshots, found ' + shots.length);
}
for (const shot of shots) {
  const size = statSync(join(shotDir, shot)).size;
  if (size > 262144) fail('screenshot ' + shot + ' is ' + size + ' bytes (> 256 KiB)');
}

// 5. Hand the game in.
mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse (more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB
// of game files, in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log('dossier written: ' + shots.length + ' screenshots, three.min.js ' +
  threeBytes + ' bytes, game/ handed in.');
