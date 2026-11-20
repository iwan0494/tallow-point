// Tallow Point — main.js (browser entry, R5-3)
// Gameplay inti R5-2 + polisi & misi R5-3: wanted 1-5, cruiser + roadblock +
// helikopter, BUSTED/DEAD + respawn, 5 misi cerita, combat, save, audio, juice.
// Fondasi R5-1: kota 7x7, kamera chase third-person, lighting golden-hour.

import * as THREE from "three";
import { GAME, PLAYER, CLOCK, START, CARJACK, POLICE, SAVE, STAGING, CAMERA } from "./config.js";
import { makeRng } from "./random.js";
import { resolveCircleVsBuildings, clampToCity, turnToward } from "./physics.js";
import {
  generateCity,
  buildCityMeshes,
  centerLoopWaypoints,
  districtAt,
  roadLine,
  blockCenter,
} from "./city.js";
import { ChaseCamera } from "./camera.js";
import { createRenderer, createScene, followSunTarget } from "./render.js";
import { Input } from "./input.js";
import { Player } from "./player.js";
import { VehicleManager } from "./vehicles.js";
import { PedManager } from "./peds.js";
import { HUD } from "./hud.js";
import { Wanted, PoliceManager } from "./police.js";
import { MissionManager } from "./missions.js";
import { Combat } from "./combat.js";
import { AudioSys } from "./audio.js";
import { SaveManager } from "./save.js";
import { Effects } from "./effects.js";

const canvas = document.querySelector("#game");
const loading = document.querySelector("#loading");

// ---- Menu awal (R5-4) -------------------------------------------------------
// Panel judul + MULAI + kontrol. Game JALAN di belakang menu (auto-drive +
// wanted 2) supaya begitu MULAI ditekan, frame pertama langsung beraksi.
const menuEl = document.querySelector("#menu");
const startBtn = document.querySelector("#start-btn");
let menuOpen = true;
function hideMenu() {
  if (!menuOpen) return;
  menuOpen = false;
  if (menuEl) menuEl.classList.add("hidden");
}
if (startBtn) startBtn.addEventListener("click", hideMenu);
window.addEventListener("keydown", (e) => {
  if (menuOpen && e.code === "Enter") hideMenu();
});

let renderer;
try {
  renderer = createRenderer(canvas);
} catch (err) {
  loading.textContent = "WebGL tidak tersedia di browser ini: " + err.message;
  throw err;
}

const { scene, sun } = createScene();
const camera = new THREE.PerspectiveCamera(
  62,
  window.innerWidth / window.innerHeight,
  0.1,
  1200
);
scene.add(camera);

// ---- Kota ------------------------------------------------------------------
const city = generateCity(GAME.seed);
const { group: cityGroup, buildingBoxes, parkingCars } = buildCityMeshes(city, THREE);
scene.add(cityGroup);

// ---- Input + HUD + efek + audio --------------------------------------------
const input = new Input(canvas);
const hud = new HUD();
const effects = new Effects(scene);
const audio = new AudioSys();

// ---- Kendaraan ---------------------------------------------------------------
// Start di jalan utama sebelah safehouse (Crater Row), langsung mengemudi
// supaya frame pertama sudah beraksi: mobil jalan, kamera chase di belakang.
const waypoints = centerLoopWaypoints(city);
const start = waypoints[3]; // simpang (-23, 23), di jalan vertikal x = -23.
const vehicles = new VehicleManager(scene, city, buildingBoxes, makeRng(GAME.seed + 555));
const playerCar = vehicles.spawnPlayerCar(start.x, start.z, Math.PI);
vehicles.wrapParked(parkingCars);
vehicles.spawnTraffic(10);

// Mobil yang pernah dikemudikan pemain (= "mobil sendiri"): masuk lagi ke
// mobil ini BUKAN carjacking — tanpa toast, tanpa trauma, tanpa objektif.
const drivenCars = new Set([playerCar.mesh.uuid]);

// ---- Pemain jalan kaki -------------------------------------------------------
const player = new Player(THREE);
scene.add(player.mesh);
player.mesh.visible = false; // mulai di dalam mobil.

// ---- Pejalan kaki ------------------------------------------------------------
const peds = new PedManager(scene, city, makeRng(GAME.seed + 999));
peds.spawn(16);

// ---- Kamera ------------------------------------------------------------------
const chase = new ChaseCamera(camera, buildingBoxes);
chase.snapTo(playerCar.pos, playerCar.heading);

// ---- Auto-drive (R5-4) -------------------------------------------------------
// Mobil jalan sendiri mengikuti loop tengah sampai pemain pegang kendali
// (gas/belok/rem). Dipakai staging pembuka + screenshot: frame pertama
// langsung bergerak, bukan mobil diam.
const driveWaypoints = centerLoopWaypoints(city); // (3,3)->(4,3)->(4,4)->(3,4).
let autoDrive = true;
let autoDriveIdx = 0; // start di (3,4) menghadap -Z, target pertama (3,3).
function updateAutoDrive(dt, car) {
  const wp = driveWaypoints[autoDriveIdx];
  const dx = wp.x - car.pos.x;
  const dz = wp.z - car.pos.z;
  if (Math.hypot(dx, dz) < 6) {
    autoDriveIdx = (autoDriveIdx + 1) % driveWaypoints.length;
    return;
  }
  const desired = Math.atan2(dx, dz);
  car.heading = turnToward(car.heading, desired, 2.2 * dt);
  car.mesh.rotation.y = car.heading;
  const target = STAGING.autoDriveSpeed;
  car.speed += Math.max(-8 * dt, Math.min(8 * dt, target - car.speed));
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  const hit = resolveCircleVsBuildings(car.pos, 1.9, buildingBoxes);
  if (hit) car.speed *= 0.4;
  clampToCity(car.pos, 4);
}

// ---- Wanted + polisi ---------------------------------------------------------
const wanted = new Wanted();
const police = new PoliceManager(scene, city, buildingBoxes, makeRng(GAME.seed + 3131), {
  onImpact: (speed) => {
    chase.addTrauma(Math.min(0.5, speed / 30));
    audio.impact(speed);
  },
  onPlayerDamage: (amount, source) => damagePlayer(amount, source),
  onBusted: (reason) => doBusted(reason),
  onHeat: (n) => wanted.addHeat(n),
  effects,
});

// ---- State game --------------------------------------------------------------
const state = {
  mode: "driving", // "driving" | "onFoot"
  cash: START.cash,
  life: START.life,
  armor: START.armor,
  clockMinutes: CLOCK.startMinutes,
  district: "Crater Row",
  objective: "Kenali Crater Row — curi sebuah mobil (E)",
  missionTitle: "KENALI CRATER ROW",
  objectiveDone: false,
  missionTimer: null,
  objectiveX: city.safehouse ? city.safehouse.x : 0,
  objectiveZ: city.safehouse ? city.safehouse.z : 0,
  policeText: "",
  policeUnits: [],
  overlay: null, // null | "BUSTED" | "DEAD"
  frames: 0,
  fps: 0,
  speedKmh: 0,
  saveTimer: 0,
};

// Posisi pemain saat ini (mobil atau jalan kaki).
function playerPos() {
  const car = vehicles.playerCar;
  if (state.mode === "driving" && car) return { x: car.pos.x, z: car.pos.z };
  return { x: player.pos.x, z: player.pos.z };
}

function districtNameAt(x, z) {
  const bx = Math.max(
    0,
    Math.min(
      GAME.grid - 1,
      Math.floor((x + GAME.halfCity - GAME.roadWidth) / GAME.roadPitch)
    )
  );
  const bz = Math.max(
    0,
    Math.min(
      GAME.grid - 1,
      Math.floor((z + GAME.halfCity - GAME.roadWidth) / GAME.roadPitch)
    )
  );
  return districtAt(bx, bz).name;
}

// ---- Save / load -------------------------------------------------------------
function saveGame() {
  const p = playerPos();
  SaveManager.save({
    cash: state.cash,
    life: state.life,
    armor: state.armor,
    missionIndex: missions.index,
    playerX: p.x,
    playerZ: p.z,
    clockMinutes: state.clockMinutes,
  });
}

// ---- Misi --------------------------------------------------------------------
const missions = new MissionManager(scene, city, vehicles, peds, makeRng(GAME.seed + 777), {
  onComplete: (def, reward) => {
    state.cash += reward;
    if (def.id === "chauffeur") {
      state.armor = Math.min(100, state.armor + 50); // misi 5: +50 armor.
    }
    const p = playerPos();
    effects.goldBurst(p.x, 1.2, p.z);
    audio.missionDone();
    hud.showToast(reward > 0 ? `Misi selesai! +$${reward}` : "Misi selesai!");
    saveGame();
  },
  onFail: (def, reason) => {
    hud.showToast(`Misi gagal: ${reason} — coba lagi`);
  },
  onStartWanted: (stars) => wanted.setStars(stars),
  onClearWanted: () => wanted.clear(),
  onPickup: () => hud.showToast("Penumpang naik! Antar ke safehouse"),
  onAllDone: (bonus) => {
    state.cash += bonus;
    hud.showToast(`Semua misi selesai! Bonus +$${bonus}`);
    audio.missionDone();
    saveGame();
  },
});

// ---- Combat ------------------------------------------------------------------
const combat = new Combat(scene, camera, {
  audio,
  effects,
  damageUnit: (ref, dmg) => police.damageUnit(ref, dmg),
  onHit: () => wanted.addHeat(POLICE.heatShoot),
  onKill: (ref, result) => {
    wanted.addHeat(POLICE.heatShoot + POLICE.heatKill);
    hud.showToast(result === "killed" ? "Polisi dilumpuhkan!" : "Cruiser dilumpuhkan!");
    chase.addTrauma(0.4);
    hitStop(0.06);
  },
  onShot: () => chase.addTrauma(0.12),
});

// ---- Load save (kecuali ?fresh=1 untuk smoke test) ---------------------------
const fresh = location.search.includes("fresh=1");
const saved = fresh ? null : SaveManager.load();
let startMissionIndex = 0;
if (saved) {
  state.cash = saved.cash;
  state.life = saved.life;
  state.armor = saved.armor;
  state.clockMinutes = saved.clockMinutes;
  startMissionIndex = Math.max(0, Math.min(5, saved.missionIndex || 0)); // 5 = semua misi selesai (valid).
  // Lanjut jalan kaki di posisi tersimpan; mobil di-spawn ulang di safehouse.
  state.mode = "onFoot";
  player.place(saved.playerX, saved.playerZ, Math.PI);
  player.mesh.visible = true;
  const drop = { x: roadLine(3), z: blockCenter(4) };
  playerCar.pos.set(drop.x + 4, 0, drop.z);
  playerCar.heading = Math.PI;
  playerCar.mesh.rotation.y = Math.PI;
  playerCar.speed = 0;
  chase.snapTo(player.pos, player.heading);
  hud.showToast("Save dimuat — lanjutkan permainan");
}
missions.start(startMissionIndex);

// R5-4 staging pembuka (spec C): game baru = pemain sudah di coupe merah,
// di jalan utama, wanted 2 bintang aktif, cruiser mengejar. Bukan kota
// kosong, bukan menu kosong. (Save lama tidak di-staging — lanjutkan.)
if (!saved) {
  wanted.setStars(STAGING.openingWanted);
}

// ---- Kerusakan pemain / BUSTED / DEAD / respawn ------------------------------
let dmgAccum = 0;
function damagePlayer(amount, source) {
  if (state.overlay || amount <= 0) return;
  let remaining = amount;
  // Armor menyerap 60% damage lebih dulu.
  if (state.armor > 0) {
    const absorbed = Math.min(state.armor, remaining * 0.6);
    state.armor -= absorbed;
    remaining -= absorbed;
  }
  if (remaining > 0) {
    state.life -= remaining;
    dmgAccum += remaining;
    if (dmgAccum > 6) {
      dmgAccum = 0;
      hud.damageFlash(0.3);
    }
  }
  if (state.life <= 0) {
    state.life = 0;
    doDead();
  }
}

function applyCashLoss() {
  const loss = Math.floor(state.cash * POLICE.bustedCashLoss);
  state.cash -= loss;
  return loss;
}

function doBusted(reason) {
  if (state.overlay) return;
  state.overlay = "BUSTED";
  const loss = applyCashLoss();
  // Toast selalu "BUSTED!" — `reason` internal ("debug" dari hook test,
  // "surrounded" dari polisi) jangan bocor ke layar pemain.
  hud.showToast(`BUSTED! -$${loss}`);
  hud.setOverlay("BUSTED");
  audio.busted();
  wanted.clear();
  police.clearAll();
  saveGame();
}

function doDead() {
  if (state.overlay) return;
  state.overlay = "DEAD";
  const loss = applyCashLoss();
  hud.showToast(`WASTED! -$${loss}`);
  hud.setOverlay("DEAD");
  audio.busted();
  wanted.clear();
  police.clearAll();
  saveGame();
}

function respawn() {
  if (!state.overlay) return;
  state.overlay = null;
  hud.setOverlay(null);
  state.life = START.life;
  wanted.clear();
  police.clearAll();
  // Pemain jalan kaki di jalan dekat safehouse Crater Row.
  const drop = { x: roadLine(3), z: blockCenter(4) };
  player.place(drop.x, drop.z, Math.PI);
  player.mesh.visible = true;
  state.mode = "onFoot";
  // Mobil pemain dipindah ke dekat safehouse (jadi mobil parkir milik sendiri).
  const car = vehicles.playerCar;
  if (car) {
    car.pos.set(drop.x + 4, 0, drop.z);
    car.heading = Math.PI;
    car.mesh.rotation.y = Math.PI;
    car.speed = 0;
    vehicles.abandon(car);
  }
  chase.snapTo(player.pos, player.heading);
  missions.restart();
  saveGame();
  hud.showToast("Kembali ke Crater Row");
}

// ---- Carjacking --------------------------------------------------------------
// E saat mengemudi: keluar mobil (hanya kalau mobil hampir berhenti).
// E saat jalan kaki: curi mobil terdekat dalam radius CARJACK.
let crashHeatCooldown = 0;
function addCrashHeat() {
  if (crashHeatCooldown > 0) return;
  crashHeatCooldown = POLICE.heatCrashCooldown;
  wanted.addHeat(POLICE.heatCrash);
}

vehicles.onImpact = (speed) => {
  chase.addTrauma(Math.min(0.5, speed / 30));
  audio.impact(speed);
  addCrashHeat();
};

function handleInteract() {
  if (state.mode === "driving") {
    const car = vehicles.playerCar;
    if (!car) return;
    if (Math.abs(car.speed) > 3) {
      hud.showToast("Terlalu cepat untuk keluar!");
      return;
    }
    // Keluar di sisi kiri mobil.
    const lx = Math.cos(car.heading);
    const lz = -Math.sin(car.heading);
    player.place(
      car.pos.x + lx * CARJACK.exitOffset,
      car.pos.z + lz * CARJACK.exitOffset,
      car.heading
    );
    player.mesh.visible = true;
    vehicles.abandon(car);
    state.mode = "onFoot";
    return;
  }
  // Jalan kaki: cari mobil terdekat yang bisa dicuri.
  const found = vehicles.nearestStealable(player.pos.x, player.pos.z, CARJACK.radius, null);
  if (!found) {
    hud.showToast("Tidak ada mobil di dekatmu");
    return;
  }
  const car = found.vehicle;
  const isOwn = drivenCars.has(car.mesh.uuid);
  const hadDriver = vehicles.steal(car);
  drivenCars.add(car.mesh.uuid);
  if (hadDriver) {
    // Pengemudi kabur menjauhi pemain.
    const away = Math.atan2(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    peds.spawnFleeing(car.pos.x, car.pos.z, away);
  }
  player.mesh.visible = false;
  input.orbitYaw = 0;
  state.mode = "driving";
  chase.snapTo(car.pos, car.heading);
  if (isOwn) {
    // Kembali ke mobil sendiri: diam-diam, bukan curian.
    return;
  }
  // Curian sungguhan — juice (game-feel): trauma kecil + hit-stop singkat
  // supaya curian terasa, plus toast. Wanted naik, tapi ganti mobil bikin
  // polisi kehilangan jejak sebentar (decay lebih cepat).
  chase.addTrauma(0.3);
  hitStop(0.06);
  audio.impact(4);
  wanted.addHeat(POLICE.heatCarjack);
  wanted.freshCar();
  missions.notifyCarjack(car);
  hud.showToast(hadDriver ? "Mobil dicuri! Pengemudi kabur!" : "Mobil dicuri!");
}

// Tembak dengan klik mouse (jalan kaki): pointerup tanpa drag berarti klik.
let pointerDownPos = null;
canvas.addEventListener("pointerdown", (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("pointerup", (e) => {
  if (!pointerDownPos) return;
  const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  pointerDownPos = null;
  if (moved > 6) return; // drag kamera, bukan klik tembak.
  if (state.mode !== "onFoot" || state.overlay) return;
  const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
  const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
  combat.shootFromScreen(ndcX, ndcY, police.shootables());
});

// Hit-stop (game-feel): perlambat waktu sebentar, pakai waktu nyata supaya
// tidak pernah macet. Hanya pemanggil terbaru yang memulihkan.
let hitStopTimer = 0;
let hitStopId = 0;
let timeScale = 1;
function hitStop(duration) {
  const id = ++hitStopId;
  timeScale = 0.1;
  hitStopTimer = duration;
  setTimeout(() => {
    if (id === hitStopId) {
      timeScale = 1;
      hitStopTimer = 0;
    }
  }, duration * 1000);
}

// ---- Loop --------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);
let fpsAccum = 0;
let fpsFrames = 0;
let fpsTime = 0;

function updateHudState() {
  const car = vehicles.playerCar;
  const p = playerPos();
  const heading = state.mode === "driving" && car ? car.heading : player.heading;
  state.speedKmh = state.mode === "driving" && car ? Math.abs(car.speed) * 3.6 : 0;
  state.district = districtNameAt(p.x, p.z);
  const pc = police.activeCount;
  const parts = [];
  if (pc.cruisers) parts.push(`CRUISER ×${pc.cruisers}`);
  if (pc.roadblock) parts.push(`ROADBLOCK ×${pc.roadblock}`);
  if (pc.cops) parts.push(`POLISI ×${pc.cops}`);
  if (pc.heli) parts.push("HELI ×1");
  state.policeText = parts.length ? "POLISI: " + parts.join(" · ") : "";
  state.policeUnits = police.units;
  return {
    wanted: wanted.stars,
    cash: state.cash,
    clockMinutes: state.clockMinutes,
    district: state.district,
    life: state.life,
    armor: state.armor,
    speedKmh: state.speedKmh,
    driving: state.mode === "driving",
    objective: state.objective,
    objectiveDone: state.objectiveDone,
    missionTitle: state.missionTitle,
    missionTimer: state.missionTimer,
    policeText: state.policeText,
    policeUnits: state.policeUnits,
    playerX: p.x,
    playerZ: p.z,
    playerHeading: heading,
    vehicles: vehicles.list,
    objectiveX: state.objectiveX,
    objectiveZ: state.objectiveZ,
    fps: state.fps,
  };
}

renderer.setAnimationLoop(() => {
  timer.update();
  const rawDt = Math.min(Math.max(timer.getDelta(), 0), 0.1);
  const dt = rawDt * timeScale;

  // Hitung frame + fps DI SINI (sebelum cabang overlay) supaya counter
  // tetap jalan saat BUSTED/DEAD — kalau tidak, wait_for_function yang
  // menunggu frame berikutnya tidak pernah terpenuhi saat overlay aktif.
  state.frames++;
  fpsAccum += rawDt;
  fpsFrames++;
  fpsTime += rawDt;
  if (fpsTime >= 0.5) {
    state.fps = Math.round(fpsFrames / fpsAccum);
    fpsAccum = 0;
    fpsFrames = 0;
    fpsTime = 0;
  }

  // Mute (M) selalu bisa; respawn (R) hanya saat overlay BUSTED/DEAD.
  if (input.pressed("KeyM")) {
    audio.setMuted(!audio.muted);
    hud.showToast(audio.muted ? "Suara: mati" : "Suara: nyala");
  }
  if (state.overlay) {
    if (input.pressed("KeyR")) respawn();
    hud.update(dt, updateHudState());
    renderer.render(scene, camera);
    input.endFrame();
    return;
  }

  // Jam game terus berjalan (golden-hour tetap, siklus siang/malam di R5-4).
  state.clockMinutes += CLOCK.minutesPerSecond * dt;
  if (crashHeatCooldown > 0) crashHeatCooldown -= dt;

  // Interaksi (E) — edge-triggered, sekali per penekanan.
  if (input.interact) handleInteract();
  // Tembak auto-aim (F) saat jalan kaki.
  if (input.pressed("KeyF") && state.mode === "onFoot") {
    combat.shootAutoAim(police.shootables());
  }

  // Update pemain / mobil.
  if (state.mode === "driving") {
    const car = vehicles.playerCar;
    if (car) {
      if (autoDrive) {
        // Input apa pun mematikan auto-drive — kendali penuh ke pemain.
        if (input.throttle || input.brake || input.steerLeft || input.steerRight) {
          autoDrive = false;
        }
      }
      if (autoDrive) {
        vehicles.update(dt, input, false); // lalu lintas + tabrakan tetap jalan.
        updateAutoDrive(dt, car);
      } else {
        vehicles.update(dt, input, true);
      }
      chase.update(dt, car.pos, car.heading, Math.abs(car.speed), "driving");
      followSunTarget(sun, car.pos);
    }
  } else {
    const move = input.moveVector();
    player.update(dt, move, chase.yaw, buildingBoxes, vehicles.carCircles(null));
    vehicles.update(dt, input, false);
    const camHeading = player.heading + input.orbitYaw;
    chase.update(dt, player.pos, camHeading, player.speed, "onFoot");
    followSunTarget(sun, player.pos);
  }

  // Pejalan kaki (menghindar dari semua kendaraan yang bergerak).
  peds.update(dt, vehicles.list);

  // Wanted: turun perlahan hanya saat bersembunyi (tidak ada polisi dekat).
  const p = playerPos();
  const hidden = police.nearestPoliceDist(p.x, p.z) > POLICE.hiddenRange;
  wanted.update(dt, hidden);

  // Polisi: kejar, roadblock, helikopter, tangkap, tembak.
  const car = vehicles.playerCar;
  police.update(dt, {
    playerX: p.x,
    playerZ: p.z,
    playerHeading: state.mode === "driving" && car ? car.heading : player.heading,
    playerSpeed: state.mode === "driving" && car ? Math.abs(car.speed) : player.speed,
    mode: state.mode,
    playerCar: car,
    vehicles: vehicles.list,
    wanted,
    time: state.frames,
  });

  // R5-4: kamera menengadah sedikit saat helikopter aktif supaya heli masuk frame.
  chase.setPitchUp(police.heli ? CAMERA.pitchUpHeli : 0);

  // Misi cerita.
  const mStatus = missions.update(dt, {
    playerX: p.x,
    playerZ: p.z,
    mode: state.mode,
    playerCar: car,
    wantedStars: wanted.stars,
  });
  state.objective = mStatus.objective;
  state.missionTitle = mStatus.title;
  state.objectiveDone = mStatus.done;
  state.missionTimer = mStatus.timer;
  state.objectiveX = mStatus.targetX;
  state.objectiveZ = mStatus.targetZ;

  // Combat (reload, tracer, muzzle flash) + efek + audio.
  combat.update(dt);
  effects.update(dt);
  audio.update(dt, {
    speed: state.mode === "driving" && car ? Math.abs(car.speed) : 0,
    driving: state.mode === "driving",
    siren: police.sirenOn,
  });

  // Auto-save tiap 10 detik.
  state.saveTimer += dt;
  if (state.saveTimer >= SAVE.autoSaveSeconds) {
    state.saveTimer = 0;
    saveGame();
  }

  hud.update(dt, updateHudState());
  renderer.render(scene, camera);

  input.endFrame();
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (loading) loading.remove();

// Hook debug untuk verifikasi headless (Playwright) dan konsol.
// debug.teleportPlayer dipakai HANYA oleh smoke test headless untuk menaruh
// pemain di dekat mobil target sebelum uji carjacking (bukan cheat game).
window.__game = {
  renderer,
  scene,
  camera,
  chase,
  city,
  state,
  player,
  vehicles,
  peds,
  hud,
  input,
  sun,
  wanted,
  police,
  missions,
  combat,
  audio,
  effects,
  get playerCar() {
    return vehicles.playerCar;
  },
  get car() {
    const c = vehicles.playerCar;
    return c ? c.mesh : null;
  },
  debug: {
    teleportPlayer(x, z) {
      if (state.mode !== "onFoot") return false;
      player.place(x, z, player.heading);
      return true;
    },
    teleportCar(x, z, heading) {
      const car = vehicles.playerCar;
      if (!car) return false;
      car.pos.set(x, 0, z);
      car.heading = heading === undefined ? car.heading : heading;
      car.mesh.rotation.y = car.heading;
      car.speed = 0;
      return true;
    },
    teleportToObjective() {
      const car = vehicles.playerCar;
      if (state.mode === "driving" && car) {
        return this.teleportCar(state.objectiveX, state.objectiveZ, car.heading);
      }
      return this.teleportPlayer(state.objectiveX, state.objectiveZ);
    },
    setWanted(n) {
      wanted.setStars(n);
      return wanted.stars;
    },
    addHeat(n) {
      wanted.addHeat(n);
      return wanted.stars;
    },
    startMission(i) {
      missions.start(i);
      return missions.index;
    },
    damagePlayer(n) {
      damagePlayer(n, "debug");
      return state.life;
    },
    setLife(n) {
      state.life = n;
      return state.life;
    },
    forceBusted() {
      doBusted("debug");
      return state.overlay;
    },
    respawn() {
      respawn();
      return state.overlay;
    },
    clearSave() {
      SaveManager.clear();
      return true;
    },
    newLife() {
      SaveManager.clear();
      location.reload();
    },
    // R5-4: tutup menu awal (dipakai capture screenshot).
    startGame() {
      hideMenu();
      return true;
    },
    setAutoDrive(on) {
      autoDrive = !!on;
      return autoDrive;
    },
    // R5-4 staging screenshot: tempatkan adegan yang sinematik.
    // kind: "cover" (wanted 2 + 2 cruiser flank), "chase" (wanted 3 + 2 cruiser),
    // "police" (wanted 4 + 2 cruiser + roadblock + heli), "city" (wanted 0).
    // Pemain selalu di coupe MERAH terang di jalan lurus x=-23 menghadap -Z.
    stageShot(kind) {
      hideMenu();
      if (state.overlay) {
        state.overlay = null;
        hud.setOverlay(null);
      }
      const drop = { x: roadLine(3), z: roadLine(5) }; // (-23, 69), jalan lurus ke -Z.
      let car = vehicles.playerCar;
      if (!car || car.color !== PLAYER.carColor) {
        if (car) vehicles.abandon(car);
        car = vehicles.spawnPlayerCar(drop.x, drop.z, Math.PI);
        drivenCars.add(car.mesh.uuid);
      } else {
        car.pos.set(drop.x, 0, drop.z);
        car.heading = Math.PI;
        car.mesh.rotation.y = Math.PI;
        car.speed = 0;
      }
      if (state.mode !== "driving") {
        player.mesh.visible = false;
        state.mode = "driving";
      }
      input.orbitYaw = 0;
      chase.snapTo(car.pos, car.heading);
      autoDrive = true;
      autoDriveIdx = 0; // target (3,3), lurus ke -Z dari z=69.
      police.clearAll();
      wanted.clear();
      if (kind === "cover") {
        wanted.setStars(2);
        police.stageFlankers(car.pos.x, car.pos.z, car.heading, 2);
      } else if (kind === "chase") {
        wanted.setStars(3);
        police.stageFlankers(car.pos.x, car.pos.z, car.heading, 2);
      } else if (kind === "police") {
        wanted.setStars(4);
        police.stageFlankers(car.pos.x, car.pos.z, car.heading, 2);
        police.stageRoadblock(car.pos.x, car.pos.z, car.heading);
      }
      return kind;
    },
    // R5-4: tempatkan lalu lintas di jalan yang sama di depan pemain.
    // Mobil diletakkan 30/46/62 m di depan, searah pemain (dua pertama) dan
    // berlawanan arah (ketiga, paling jauh supaya tidak cepat bertemu).
    stageTraffic(count) {
      const car = vehicles.playerCar;
      if (!car) return 0;
      let placed = 0;
      for (const v of vehicles.list) {
        if (placed >= count) break;
        if (v.kind !== "traffic") continue;
        const d = 30 + placed * 16;
        const z = car.pos.z - d; // pemain menghadap -Z: depan = z mengecil.
        const j = Math.max(0, Math.min(GAME.grid - 1, Math.floor((z - roadLine(0)) / GAME.roadPitch)));
        const dirPlus = placed === 2; // hanya mobil ketiga yang berlawanan arah.
        if (dirPlus) {
          v.fromNode = city.nodeId(3, j);
          v.toNode = city.nodeId(3, j + 1);
          v.edgeT = (z - roadLine(j)) / GAME.roadPitch;
        } else {
          v.fromNode = city.nodeId(3, j + 1);
          v.toNode = city.nodeId(3, j);
          v.edgeT = (roadLine(j + 1) - z) / GAME.roadPitch;
        }
        v.pauseTimer = 0;
        v.speed = v.cruise;
        placed++;
      }
      return placed;
    },
    // R5-4: tempatkan pejalan kaki di trotoar blok di sisi jalan pemain.
    stagePeds(count) {
      return peds.stageOnBlocks(
        [
          { bx: 2, bz: 4 },
          { bx: 3, bz: 4 },
          { bx: 2, bz: 3 },
          { bx: 3, bz: 3 },
        ],
        count
      );
    },
    framing() {
      const v = new THREE.Vector3();
      const out = [];
      const proj = (x, y, z, kind) => {
        v.set(x, y, z).project(camera);
        out.push({ kind, x: +v.x.toFixed(2), y: +v.y.toFixed(2), z: +v.z.toFixed(2) });
      };
      for (const u of police.units) {
        // Heli diproyeksikan di ketinggian terbangnya, bukan di tanah.
        proj(u.x, u.kind === "heli" ? POLICE.heliHeight : 1.2, u.z, u.kind);
      }
      const car = vehicles.playerCar;
      if (car) proj(car.pos.x, 1.2, car.pos.z, "player");
      for (const t of vehicles.list) {
        if (t.kind === "traffic") proj(t.pos.x, 1.0, t.pos.z, "traffic");
      }
      return out;
    },
  },
};
