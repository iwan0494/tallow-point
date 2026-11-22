// Tallow Point — boot and the one loop.
// Screens: title, map, play, paused, busted, wasted.
// ?seed=N fixes the world. ?shot=1..4 (with &seed=N) stages that scene, paints
// it twice and sets window.__shotReady for a screenshot.

import { createRandom } from './random.js';
import { createRender } from './render.js';
import { buildCity } from './city.js';
import { createPhysics } from './physics.js';
import { createTraffic } from './traffic.js';
import { createPeds } from './peds.js';
import { createPlayer } from './player.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createCamera } from './camera.js';
import { createHud } from './hud.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_ENTER, ACTION_MISSION, ACTION_RESPAWN, ACTION_MAP, ACTION_PAUSE, ACTION_CONFIRM, ACTION_PUNCH, ACTION_SHOOT } from './input.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { districtAtPoint, HERO_CAR_COLOR } from './config.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotParam = Number.parseInt(params.get('shot') ?? '', 10);
const shot = Number.isInteger(shotParam) && shotParam >= 1 && shotParam <= 4 ? shotParam : 0;
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const rng = createRandom(seed);
const render = createRender(canvas);
const scene = render.scene;
const city = buildCity(scene, rng);
const physics = createPhysics(city.colliders);
const traffic = createTraffic(scene, rng, physics);
const peds = createPeds(scene, rng);
const police = createPolice(scene, rng);
const missions = createMissions();
const effects = createEffects(scene);
const audio = createAudio();
const input = createInput(canvas);
const hud = createHud();
const cameraRig = createCamera(render.camera);
const playerApi = createPlayer(scene, 2, -52);
const player = playerApi.player;
const combat = createCombat(scene, effects, audio, police, peds);

// Mission beacon: a gold pillar of light at the current objective.
const beacon = new THREE.Mesh(
  new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
);
beacon.visible = false;
scene.add(beacon);
const beaconBase = new THREE.Mesh(
  new THREE.RingGeometry(2.2, 4.2, 24),
  new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
);
beaconBase.rotation.x = -Math.PI / 2;
beaconBase.visible = false;
scene.add(beaconBase);

const state = {
  cash: 250,
  respect: 140,
  condition: 87,
  carsStolen: 0,
  kmDriven: 0,
  act: 'ACT I — PALMA STRAND · 12%',
  weaponIndex: 0,
  clockHours: 17.5,
  missionsDone: 0,
};
const save = loadSave();
if (save) {
  state.cash = save.cash ?? 250;
  state.respect = save.respect ?? 140;
  state.condition = save.condition ?? 87;
  state.carsStolen = save.carsStolen ?? 0;
  state.kmDriven = save.kmDriven ?? 0;
  state.act = save.act || state.act;
  if (typeof save.x === 'number' && typeof save.z === 'number') {
    playerApi.teleport(save.x, save.z, save.heading ?? 0);
  }
}

const game = {
  player: playerApi, police, missions, traffic, peds, render, camera: cameraRig,
  hud, state, city, screen: 'title', cameraPose: null, time: 0,
};

let screen = save ? 'title' : 'title';
let pausedFrom = null;
let saveTimer = 0;
let toastShown = false;

function hudState() {
  return {
    player, police, missions,
    cash: state.cash, respect: state.respect, condition: state.condition,
    weaponIndex: state.weaponIndex, clockHours: state.clockHours,
    district: districtAtPoint(player.x, player.z),
    carsStolen: state.carsStolen, kmDriven: state.kmDriven,
    act: state.act, missionsDone: Math.max(state.missionsDone, missions.done),
  };
}

function startGame(fresh) {
  if (fresh) {
    clearSave();
    state.cash = 250;
    state.respect = 140;
    state.condition = 87;
    state.carsStolen = 0;
    state.kmDriven = 0;
    state.act = 'ACT I — PALMA STRAND · 12%';
    playerApi.heal();
    playerApi.teleport(2, -52, 0);
    police.clear();
  }
  audio.unlock();
  screen = 'play';
  hud.showScreen('play');
  if (!toastShown) {
    hud.toast('Welcome to Tallow Point — press M to start a job, E to steal a car.');
    toastShown = true;
  }
}

function respawn() {
  playerApi.heal();
  playerApi.teleport(2, -52, 0);
  police.clear();
  state.cash = Math.max(0, state.cash - 100);
  state.condition = 87;
  screen = 'play';
  hud.showScreen('play');
  hud.toast('Back on the streets of Tallow Point.');
}

function missionEvent(ev) {
  if (ev.event === 'stage') {
    state.respect = Math.min(250, state.respect + 10);
    hud.toast(`STAGE ${ev.stage + 1}/3 — ${ev.mission.name}: keep moving.`);
    audio.tick();
  } else if (ev.event === 'complete') {
    state.cash += ev.mission.payout;
    state.respect = Math.min(250, state.respect + 25);
    state.condition = Math.min(100, state.condition + 5);
    hud.toast(`MISSION COMPLETE — ${ev.mission.name} · +$${ev.mission.payout}`);
    audio.cash();
    writeSave({ ...state, player, missionsDone: missions.done });
  } else if (ev.event === 'failed') {
    hud.toast(`MISSION FAILED — ${ev.mission.name} ran out of time. Press M to retry.`);
    audio.busted();
  }
}

function shootTargets() {
  const meshes = [];
  for (const ped of [...peds.peds, ...peds.beachgoers]) {
    ped.mesh.userData.ped = ped;
    meshes.push(ped.mesh);
  }
  for (const c of police.cruisers) {
    c.mesh.userData.cruiser = c;
    meshes.push(c.mesh);
  }
  for (const car of traffic.cars) {
    car.mesh.userData.traffic = car;
    meshes.push(car.mesh);
  }
  return meshes;
}

function handleActions(actions) {
  if (screen === 'title') {
    if (actions & ACTION_CONFIRM) startGame(false);
    return;
  }
  if (screen === 'map') {
    if (actions & (ACTION_MAP | ACTION_CONFIRM | ACTION_PAUSE)) {
      screen = pausedFrom || 'play';
      hud.showScreen(screen === 'play' ? 'play' : screen);
      pausedFrom = null;
    }
    return;
  }
  if (screen === 'pause') {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      screen = 'play';
      hud.showScreen('play');
    }
    return;
  }
  if (screen === 'busted' || screen === 'wasted') {
    if (actions & (ACTION_RESPAWN | ACTION_CONFIRM)) respawn();
    return;
  }
  // screen === 'play'
  if (actions & ACTION_PAUSE) {
    screen = 'pause';
    hud.showScreen('pause');
    return;
  }
  if (actions & ACTION_MAP) {
    pausedFrom = 'play';
    screen = 'map';
    hud.showScreen('map');
    return;
  }
  if (actions & ACTION_MISSION) {
    const m = missions.start();
    if (m) {
      hud.toast(`MISSION ${m.n} OF 5 — ${m.name}: ${m.objective}`);
      audio.tick();
    }
  }
  if (actions & ACTION_ENTER) {
    audio.unlock();
    if (player.inCar) {
      playerApi.exitCar();
      hud.toast('You left the car.');
    } else {
      const nearHero = Math.hypot(player.x - playerApi.carMesh.position.x, player.z - playerApi.carMesh.position.z) < 5.5
        && playerApi.carMesh.visible;
      if (nearHero) {
        playerApi.enterCar({ mesh: playerApi.carMesh, x: playerApi.carMesh.position.x, z: playerApi.carMesh.position.z, heading: player.carHeading, speed: 0 }, true);
        hud.toast('COMET GT — yours again.');
        audio.tick();
      } else {
        const target = traffic.nearestParked(player.x, player.z, 5.5);
        if (target) {
          traffic.removeParked(target);
          playerApi.enterCar(target, false);
          state.carsStolen += 1;
          state.condition = 72;
          police.addHeat(1);
          hud.toast('Car stolen — Tallow PD has your plate.');
          audio.steal();
        }
      }
    }
  }
  if (actions & ACTION_PUNCH) {
    const hit = combat.punch(player, [...peds.peds, ...peds.beachgoers], police.cruisers);
    if (hit) hud.toast(hit.kind === 'ped' ? 'Pedestrian down — the heat is on you.' : 'You swung at a cop.');
  }
  if (actions & ACTION_SHOOT) {
    const res = combat.shoot(render.camera, player, shootTargets());
    if (res && res.hit && res.kind === 'ped') hud.toast('Pedestrian down — the heat is on you.');
  }
}

function update(dt) {
  game.time += dt;
  state.clockHours = (state.clockHours + dt / 120) % 24;
  const actions = input.takeActions();
  handleActions(actions);
  if (screen === 'title') {
    // The city lives behind the title: traffic and peds move, camera drifts.
    traffic.step(dt, null);
    peds.step(dt, []);
    cameraRig.orbitShot(game.time, 0, -40);
    hud.tickToast(dt);
    return;
  }
  if (screen === 'map' || screen === 'pause') {
    hud.tickToast(dt);
    return;
  }
  if (screen === 'busted' || screen === 'wasted') {
    hud.tickToast(dt);
    return;
  }
  // screen === 'play'
  player.camYaw = cameraRig.yaw;
  playerApi.step(dt, input, physics, effects, audio, (speed) => {
    state.condition = Math.max(20, state.condition - speed * 0.4);
    police.addHeat(0.15);
  });
  traffic.step(dt, player);
  const threats = [{ x: player.x, z: player.z }];
  peds.step(dt, threats);
  const { busted } = police.step(dt, player, game.time);
  combat.update(dt);
  // Cruiser rams: damage the hero and the player on foot.
  for (const c of police.cruisers) {
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (player.inCar && d < 3.4) {
      state.condition = Math.max(5, state.condition - 6 * dt);
      if (Math.random() < dt * 2) {
        effects.sparks(new THREE.Vector3(player.x, 1, player.z), 4, 0xffc21a);
        audio.crash();
      }
    } else if (!player.inCar && d < 2.4) {
      if (playerApi.damage(9 * dt)) {
        screen = 'wasted';
        hud.showScreen('wasted');
        audio.busted();
      }
    }
  }
  const ev = missions.update(dt, player);
  if (ev.event !== 'idle' && ev.event !== 'active') missionEvent(ev);
  // Mission beacon.
  if (missions.active) {
    const mp = missions.markerPos;
    beacon.visible = true;
    beaconBase.visible = true;
    beacon.position.set(mp.x, 30, mp.z);
    beaconBase.position.set(mp.x, 0.12, mp.z);
    beacon.material.opacity = 0.22 + Math.sin(game.time * 3) * 0.08;
  } else {
    beacon.visible = false;
    beaconBase.visible = false;
  }
  // Context prompt.
  if (!player.inCar) {
    const nearHero = Math.hypot(player.x - playerApi.carMesh.position.x, player.z - playerApi.carMesh.position.z) < 5.5 && playerApi.carMesh.visible;
    const nearParked = traffic.nearestParked(player.x, player.z, 5.5);
    if (nearParked) hud.setPrompt('Press E to steal this car');
    else if (nearHero) hud.setPrompt('Press E to drive the COMET GT');
    else hud.setPrompt(missions.active ? '' : 'Press M to start a mission · TAB for the city map');
  } else {
    hud.setPrompt('');
  }
  if (busted) {
    state.cash = Math.max(0, state.cash - 150);
    screen = 'busted';
    hud.showScreen('busted');
    audio.busted();
  }
  if (!player.alive && screen === 'play') {
    screen = 'wasted';
    hud.showScreen('wasted');
    audio.busted();
  }
  // Autosave.
  saveTimer += dt;
  if (saveTimer > 15) {
    saveTimer = 0;
    writeSave({ ...state, player, missionsDone: missions.done });
  }
  effects.update(dt);
  hud.tickToast(dt);
  // Camera follows after everything moved.
  const camTarget = {
    x: player.x, z: player.z, heading: player.heading,
    speed: player.inCar ? player.carSpeed : 0, inCar: player.inCar,
  };
  const shake = effects.shakeOffset(dt);
  cameraRig.frame(dt, camTarget, player.inCar ? {} : {});
  render.camera.position.x += shake.x;
  render.camera.position.y += shake.y;
  render.followSun(player.x, player.z);
  hud.update(hudState());
}

// Weapon keys 1-4 and mute N.
window.addEventListener('keydown', (event) => {
  if (event.code === 'Digit1') state.weaponIndex = 0;
  if (event.code === 'Digit2') state.weaponIndex = 1;
  if (event.code === 'Digit3') state.weaponIndex = 2;
  if (event.code === 'Digit4') state.weaponIndex = 3;
  if (event.code === 'KeyN') {
    const muted = audio.toggleMute();
    hud.toast(muted ? 'Sound off.' : 'Sound on.');
  }
});

// Title screen buttons.
function bindButton(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
}
bindButton('btn-continue', () => startGame(false));
bindButton('btn-new', () => startGame(true));
bindButton('btn-map', () => {
  pausedFrom = 'title';
  screen = 'map';
  hud.showScreen('map');
  hud.update(hudState());
});
bindButton('btn-resume', () => {
  screen = 'play';
  hud.showScreen('play');
});
bindButton('btn-quit-title', () => {
  screen = 'title';
  hud.showScreen('title');
  render.setTimeOfDay('golden', city.sunDisc, city.sunGlow);
});
bindButton('btn-respawn', () => respawn());
bindButton('btn-respawn2', () => respawn());

hud.setSaveSlot(save ? `${state.act} · SAVED` : 'ACT I — PALMA STRAND · 12%');
hud.showScreen('title');
hud.update(hudState());
render.setTimeOfDay('golden', city.sunDisc, city.sunGlow);
Object.assign(window, { renderer: render.renderer, scene, __game: game });

function renderShotFrame() {
  if (game.cameraPose?.mode === 'title') {
    render.camera.position.set(28, 9, -8);
    render.camera.lookAt(-30, 4, -55);
  } else if (game.cameraPose?.mode === 'top') {
    render.camera.position.set(0, 280, 0.1);
    render.camera.lookAt(0, 0, 0);
  }
  // The sun is infinitely far in reality: hang its disc in the frame, up-left
  // of the camera's view, so every shot has a sun (low and warm at golden
  // hour, high and white at noon) instead of an empty sky band.
  const dir = new THREE.Vector3();
  render.camera.getWorldDirection(dir);
  const left = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  const sunPos = render.camera.position.clone().addScaledVector(dir, 380)
    .addScaledVector(left, render.mode === 'day' ? 90 : 150);
  sunPos.y += render.mode === 'day' ? 90 : 64;
  city.sunDisc.position.copy(sunPos);
  city.sunDisc.lookAt(render.camera.position);
  city.sunGlow.position.copy(sunPos).addScaledVector(dir, -2);
  city.sunGlow.lookAt(render.camera.position);
  hud.update(hudState());
  render.render();
}

if (shot) {
  stageShot(shot, game);
  let painted = 0;
  function paint() {
    renderShotFrame();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
} else {
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    while (accumulator >= STEP) {
      update(STEP);
      accumulator -= STEP;
    }
    if (screen === 'title') render.render();
    else if (screen === 'map' || screen === 'pause' || screen === 'busted' || screen === 'wasted') render.render();
    else render.render();
  }
  requestAnimationFrame(frame);
}
