// Screenshot staging: ?shot=1..4 with &seed=1337. Each shot plays the real game
// forward from a seeded world and freezes a composed frame — title screen,
// map/stats screen, daytime beach chase, golden-hour helicopter chase — then
// sets window.__shotReady for the capture script.

export function stageShot(num, game) {
  const { player, police, missions, traffic, peds, render, camera, hud, state } = game;
  const THREE = window.THREE;

  function settle(seconds) {
    // Run the world forward so traffic, peds and the heli are mid-motion.
    const step = 1 / 60;
    for (let t = 0; t < seconds; t += step) {
      traffic.step(step, { x: player.player.x, z: player.player.z });
      peds.step(step, [{ x: player.player.x, z: player.player.z }]);
      police.step(step, player.player, t);
    }
  }

  function putHeroInCar(x, z, heading) {
    const p = player.player;
    p.inCar = true;
    p.carHeading = heading;
    p.heading = heading;
    const car = { mesh: player.carMesh, x, z, heading, speed: 14, isHero: true };
    player.carMesh.visible = true;
    player.carMesh.position.set(x, 0, z);
    player.carMesh.rotation.y = heading;
    player.pedMesh.visible = false;
    p.car = car;
    p.x = x;
    p.z = z;
    p.carSpeed = 14;
    p.camYaw = heading;
  }

  function placeCruiser(i, x, z, heading) {
    const c = police.cruisers[i];
    if (!c) return;
    c.x = x;
    c.z = z;
    c.heading = heading;
    c.speed = 12;
    c.mesh.position.set(x, 0, z);
    c.mesh.rotation.y = heading;
  }

  if (num === 1) {
    // TITLE SCREEN — golden hour skyline, hero Comet on the road below.
    render.setTimeOfDay('golden', game.city.sunDisc, game.city.sunGlow);
    state.clockHours = 17.8;
    putHeroInCar(0, -40, 0.12);
    state.cash = 12450;
    state.respect = 140;
    hud.setSaveSlot('ACT I — PALMA STRAND · 12%');
    hud.showScreen('title');
    game.screen = 'title';
    game.cameraPose = { mode: 'title', x: 0, z: -40 };
    settle(1.2);
    return;
  }

  if (num === 2) {
    // MAP / STATS SCREEN — career numbers, five districts, five missions.
    render.setTimeOfDay('golden', game.city.sunDisc, game.city.sunGlow);
    state.clockHours = 18.1;
    state.cash = 12450;
    state.respect = 140;
    state.carsStolen = 41;
    state.kmDriven = 48.2;
    state.missionsDone = 2;
    putHeroInCar(52, 52, -0.4);
    hud.showScreen('map');
    game.screen = 'map';
    game.cameraPose = { mode: 'top', x: 0, z: 0 };
    settle(0.6);
    return;
  }

  if (num === 3) {
    // DAYTIME BEACH CHASE — blue sky, sea, palms, big gold hero.
    render.setTimeOfDay('day', game.city.sunDisc, game.city.sunGlow);
    state.clockHours = 13.2;
    state.cash = 12950;
    state.respect = 140;
    state.condition = 87;
    missions.skipTo(0, 1, 89); // MISSION 1 OF 5 · COURIER RUN · STAGE 2/3 · 1:29 — Sunmere, matches the beach location
    police.setWanted(2);
    putHeroInCar(-156, 30, 0.08);
    // Traffic close around the hero so the beach road reads busy.
    traffic.cars[0].x = -156; traffic.cars[0].z = 52; traffic.cars[0].along = 'z'; traffic.cars[0].dir = 1;
    traffic.cars[1].x = -150.5; traffic.cars[1].z = 8; traffic.cars[1].along = 'z'; traffic.cars[1].dir = 1;
    traffic.cars[2].x = -104; traffic.cars[2].z = -20; traffic.cars[2].along = 'x'; traffic.cars[2].dir = 1;
    traffic.cars[3].x = -156; traffic.cars[3].z = -60; traffic.cars[3].along = 'z'; traffic.cars[3].dir = -1;
    settle(1.0);
    // Dispatch staging: TALLOW-12 ramming 8 m behind, TALLOW-07 roadblock 120 m ahead.
    // The ramming cruiser sits dead behind the hero; the camera is nudged 4 m
    // sideways so the cruiser reads as a chase, not a blockage.
    placeCruiser(0, -156, 22, 0.08);
    placeCruiser(1, -156, 150, Math.PI);
    placeCruiser(2, -150.5, 44, 0.08);
    police.cruisers[0].unit = { call: 'TALLOW-12', role: 'RAMMING' };
    police.cruisers[1].unit = { call: 'TALLOW-07', role: 'ROADBLOCK' };
    if (police.cruisers[2]) police.cruisers[2].unit = { call: 'TALLOW-04', role: 'SHORE WATCH' };
    if (police.cruisers[3]) police.cruisers[3].unit = { call: 'TALLOW-31', role: 'PIT' };
    camera.snap(player.player, { dist: 8.6, height: 2.7, pitch: 0.22 });
    render.camera.position.x += 4;
    render.camera.lookAt(player.player.x, 1.8, player.player.z + 8);
    game.screen = 'play';
    hud.showScreen('play');
    return;
  }

  // Shot 4 — GOLDEN-HOUR HELICOPTER CHASE (Vesper Docks), re-staged:
  // the hero runs EAST down road z=104, so the low western sun lights the
  // Comet's rear and flank gold, the street corridor (not a near dark wall)
  // fills the frame, and the heli hangs big and low in the upper centre
  // with its cone sweeping the road by the hero. The hero sits east of the
  // x=111.5 lamp pole, so no pole crosses the sightline to the heli.
  render.setTimeOfDay('golden', game.city.sunDisc, game.city.sunGlow);
  state.clockHours = 18.6;
  state.cash = 14150;
  state.respect = 165;
  state.condition = 87;
  missions.skipTo(3, 2, 96); // MISSION 4 OF 5 · NIGHT SHIFT · STAGE 3/3 · 1:36
  police.setWanted(4);
  putHeroInCar(130, 104, Math.PI / 2);
  // Traffic on the same east-west road: one oncoming in the south lane, one
  // eastbound in the far lane, one turning in from the north-south road.
  traffic.cars[0].x = 158; traffic.cars[0].z = 98; traffic.cars[0].along = 'x'; traffic.cars[0].dir = -1;
  traffic.cars[1].x = 146; traffic.cars[1].z = 110; traffic.cars[1].along = 'x'; traffic.cars[1].dir = 1;
  traffic.cars[2].x = 156; traffic.cars[2].z = 140; traffic.cars[2].along = 'z'; traffic.cars[2].dir = -1;
  settle(1.0);
  // Tight cruiser formation: ramming 8 m behind, PIT off the hero's right
  // flank, one behind-left, one head-on by the roadblock.
  placeCruiser(0, 122, 104, Math.PI / 2);
  placeCruiser(1, 138, 110, Math.PI / 2);
  placeCruiser(2, 116, 98, Math.PI / 2);
  placeCruiser(3, 152, 104, -Math.PI / 2);
  police.cruisers[0].unit = { call: 'TALLOW-12', role: 'RAMMING' };
  police.cruisers[1].unit = { call: 'TALLOW-31', role: 'PIT' };
  police.cruisers[2].unit = { call: 'TALLOW-07', role: 'ROADBLOCK' };
  if (police.cruisers[3]) police.cruisers[3].unit = { call: 'TALLOW-04', role: 'SHORE WATCH' };
  // Roadblock across the road ahead, east of the hero.
  police.placeRoadblock(168, 104, 'z');
  // Helicopter big, low and near the top-centre of the frame: ~36 m from the
  // camera, rotor disc ~235 px wide, cone sweeping the road by the hero.
  const heli = police.heli;
  heli.visible = true;
  heli.position.set(158, 9, 106);
  heli.lookAt(130, 0, 104);
  heli.userData.rotor.rotation.y = 1.2;
  const cone = heli.userData.cone;
  cone.scale.set(1.35, 0.75, 1.35);
  cone.material.opacity = 0.35;
  // Warm spotlight pool on the road where the cone lands.
  const pool = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.28, depthWrite: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(150, 0.12, 106);
  render.scene.add(pool);
  // Warm fill from behind the camera so the gold Comet reads gold, not a
  // dark silhouette, against the dusk street.
  const heroLight = new THREE.PointLight(0xffc98a, 60, 26, 1.6);
  heroLight.position.set(122, 4, 98);
  render.scene.add(heroLight);
  // Low close chase camera, nudged to the south kerb so the hero's lit flank
  // shows and the Comet fills ~25% of the frame width; the view axis is
  // turned a touch north so the near south facades slide out of frame, and
  // the hero sits right of centre, clear of the crew cards.
  camera.snap(player.player, { dist: 8, height: 2.6, pitch: 0.22 });
  render.camera.position.z -= 4;
  render.camera.lookAt(148, 2, 106);
  game.screen = 'play';
  hud.showScreen('play');
}
