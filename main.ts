// Tallow Point — main.ts (kit entry, R5)
// Dijalankan kit: `MAKEFUN_OUTPUT_DIR=out node main.ts` (Node 24, type-stripping).
// Tugasnya: verifikasi file game ada + tulis dossier.json ke output dir.
// Tanpa network, tanpa server — hanya baca file lokal lalu tulis dossier.
// Screenshot (4 buah) + dossier final dikerjakan R5-4.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dirname, ".");
const OUT = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "out");

const REQUIRED_FILES: string[] = [
  "game/index.html",
  "game/vendor/three.module.js",
  "game/src/config.js",
  "game/src/random.js",
  "game/src/city.js",
  "game/src/camera.js",
  "game/src/render.js",
  "game/src/main.js",
  "game/src/input.js",
  "game/src/physics.js",
  "game/src/player.js",
  "game/src/vehicles.js",
  "game/src/peds.js",
  "game/src/hud.js",
  "game/src/police.js",
  "game/src/missions.js",
  "game/src/combat.js",
  "game/src/audio.js",
  "game/src/save.js",
  "game/src/effects.js",
  "game/screenshots/1-start.png",
  "game/screenshots/2-city.png",
  "game/screenshots/3-chase.png",
  "game/screenshots/4-police.png",
];

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFiles(dir: string, base: string): { path: string; bytes: number; sha256: string }[] {
  const out: { path: string; bytes: number; sha256: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    const rel = join(base, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === ".git") continue;
      out.push(...listFiles(full, rel));
    } else if (entry.isFile()) {
      out.push({ path: rel, bytes: statSync(full).size, sha256: sha256(full) });
    }
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : 1));
}

function main(): void {
  const missing = REQUIRED_FILES.filter((f) => !existsSync(join(REPO, f)));
  if (missing.length > 0) {
    console.error(`main.ts: file game hilang: ${missing.join(", ")}`);
    process.exit(1);
  }
  const files = listFiles(REPO, "");
  const gameFiles = files.filter((f) => f.path.startsWith("game/"));
  const totalBytes = gameFiles.reduce((sum, f) => sum + f.bytes, 0);

  const dossier = {
    name: "Tallow Point",
    competition: "gta6-01",
    round: 5,
    entry: "game/index.html",
    engine: "three.js 0.187.0 (vendored, tanpa network)",
    gameFiles,
    gameTotalBytes: totalBytes,
    screenshots: [
      "game/screenshots/1-start.png",
      "game/screenshots/2-city.png",
      "game/screenshots/3-chase.png",
      "game/screenshots/4-police.png",
    ],
    notes:
      "R5-1: fondasi + kamera chase third-person + lighting golden-hour. " +
      "R5-2: gameplay inti — pemain jalan kaki, mengemudi + carjacking, " +
      "lalu lintas + pejalan kaki AI, HUD + minimap. " +
      "R5-3: polisi & misi — wanted 1-5, cruiser kejar + roadblock + " +
      "helikopter, BUSTED/DEAD + respawn, 5 misi cerita, combat, save, " +
      "audio WebAudio, juice (partikel, strobo, flash). " +
      "R5-4: polish visual — cruiser flanking (terlihat di frame), heli " +
      "di depan pemain + kamera menengadah, roadblock + cone, staging " +
      "pembuka wanted 2 + auto-drive, menu awal, 4 screenshot final " +
      "1280x720 (<=256 KiB) + dossier final.",
  };

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "dossier.json"), JSON.stringify(dossier, null, 2) + "\n");
  console.log(`main.ts: OK — ${gameFiles.length} file game, ${totalBytes} byte -> ${join(OUT, "dossier.json")}`);
}

main();
