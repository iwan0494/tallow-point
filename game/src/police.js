// Wanted + police: heat rises with crime, cruisers chase on the road graph,
// roadblocks appear at 3+ stars, the helicopter joins at 4+ stars, and a
// busted check catches the player on foot at close range. Dispatch distances
// are exposed for the HUD board.

import { POLICE_UNITS, HELI_WANTED, ROADBLOCK_WANTED, WANTED_DECAY } from './config.js';
import { makeCar, makeHeli } from './vehicles.js';

export function createPolice(scene, rng) {
  const cruisers = [];
  const heli = makeHeli();
  heli.visible = false;
  scene.add(heli);
  let heliActive = false;
  let heliAngle = 0;
  let roadblock = null;
  let roadblockCars = [];
  let wanted = 0;
  let heat = 0; // 0..5, fractional; wanted = floor(heat) capped at 5
  let bustedTimer = 0;

  function spawnCruiser(x, z) {
    const mesh = makeCar(0x1a1a22, { police: true });
    scene.add(mesh);
    const c = {
      mesh, x, z, heading: 0, speed: 0,
      unit: POLICE_UNITS[cruisers.length % 4], // TALLOW-12 / 07 / 31 / 04 rotate
      stuck: 0,
    };
    mesh.position.set(x, 0, z);
    cruisers.push(c);
    return c;
  }

  function desiredCruisers() {
    if (wanted <= 0) return 0;
    return Math.min(2 + wanted, 6);
  }

  function addHeat(amount) {
    heat = Math.min(5, heat + amount);
    // Wanted is the ceiling of the heat: a fresh 2-star heat reads as 2 stars
    // until it has genuinely decayed below the level.
    const w = Math.min(5, Math.ceil(heat - 0.0001));
    if (w > wanted) {
      wanted = w;
      return true; // wanted went up
    }
    return false;
  }

  function step(dt, player, time) {
    // Heat decays slowly while the player is out of sight and not committing crimes.
    if (wanted > 0) {
      heat = Math.max(0, heat - WANTED_DECAY * dt);
      const w = Math.ceil(heat - 0.0001);
      if (w < wanted) wanted = w;
    }
    // Spawn / despawn cruisers to match the wanted level.
    const want = desiredCruisers();
    while (cruisers.length < want) {
      const a = rng.range(0, Math.PI * 2);
      spawnCruiser(player.x + Math.cos(a) * rng.range(30, 55), player.z + Math.sin(a) * rng.range(30, 55));
    }
    while (cruisers.length > want) {
      const c = cruisers.pop();
      c.mesh.visible = false;
      scene.remove(c.mesh);
    }
    // Chase: steer toward the player, faster with more stars.
    const chaseSpeed = 13 + wanted * 2.2;
    for (const c of cruisers) {
      const dx = player.x - c.x;
      const dz = player.z - c.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      c.speed = Math.min(chaseSpeed, c.speed + 9 * dt);
      if (dist < 4) c.speed *= 0.85;
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      // Light bar strobe: red and blue alternate.
      const phase = Math.floor(time * 6 + (c === cruisers[0] ? 0 : 1)) % 2 === 0;
      const red = c.mesh.getObjectByName('lightRed');
      const blue = c.mesh.getObjectByName('lightBlue');
      if (red) red.visible = phase;
      if (blue) blue.visible = !phase;
    }
    // Helicopter at 4+ stars: circles above the player, rotor spins, cone sweeps.
    heliActive = wanted >= HELI_WANTED;
    heli.visible = heliActive;
    if (heliActive) {
      heliAngle += dt * 0.35;
      const hx = player.x + Math.cos(heliAngle) * 26;
      const hz = player.z + Math.sin(heliAngle) * 26;
      heli.position.set(hx, 34, hz);
      heli.lookAt(player.x, 0, player.z);
      heli.userData.rotor.rotation.y += dt * 22;
      const cone = heli.userData.cone;
      cone.rotation.z = Math.sin(time * 0.9) * 0.45;
      // The cone tip should stay near the player: sweep the whole heli slightly.
      heli.position.x += Math.sin(time * 0.9) * 2;
    }
    // Roadblock at 3+ stars: three cruisers parked across the road ahead of
    // the player, facing the player. across 'x' means the cars line up along
    // x (blocking a north-south road); across 'z' lines them along z.
    const wantBlock = wanted >= ROADBLOCK_WANTED;
    if (wantBlock && !roadblock) {
      placeRoadblock(player.x + Math.sin(player.heading) * 45, player.z + Math.cos(player.heading) * 45, Math.abs(Math.sin(player.heading)) > 0.5 ? 'z' : 'x');
    } else if (!wantBlock && roadblock) {
      for (const m of roadblockCars) scene.remove(m);
      roadblockCars = [];
      roadblock = null;
    }
    // BUSTED: a cruiser within 3.5 m of the player on foot at 3+ stars.
    let busted = false;
    if (wanted >= 3 && !player.inCar) {
      for (const c of cruisers) {
        if (Math.hypot(c.x - player.x, c.z - player.z) < 3.5) {
          bustedTimer += dt;
          if (bustedTimer > 1.2) busted = true;
          break;
        }
      }
    } else {
      bustedTimer = 0;
    }
    return { busted };
  }

  /** Rows for the dispatch board: named unit + role + distance in metres. */
  function dispatchRows(player) {
    const rows = cruisers.slice(0, 4).map((c) => ({
      call: c.unit.call,
      role: c.unit.role,
      dist: Math.round(Math.hypot(c.x - player.x, c.z - player.z)),
    }));
    if (heliActive) {
      rows.unshift({
        call: 'AIR-1', role: 'SPOTLIGHT',
        dist: Math.round(Math.hypot(heli.position.x - player.x, heli.position.z - player.z)),
      });
    }
    return rows;
  }

  function placeRoadblock(x, z, across) {
    if (roadblock) {
      for (const m of roadblockCars) scene.remove(m);
    }
    roadblock = { x, z, across };
    roadblockCars = [];
    for (let i = -1; i <= 1; i += 1) {
      const mesh = makeCar(0x1a1a22, { police: true });
      scene.add(mesh);
      if (across === 'x') {
        mesh.position.set(x + i * 4.5, 0, z);
        mesh.rotation.y = Math.PI / 2;
      } else {
        mesh.position.set(x, 0, z + i * 4.5);
        mesh.rotation.y = 0;
      }
      roadblockCars.push(mesh);
    }
  }

  return {
    step, addHeat, dispatchRows, placeRoadblock,
    get wanted() {
      return wanted;
    },
    get heat() {
      return heat;
    },
    get heliActive() {
      return heliActive;
    },
    get cruisers() {
      return cruisers;
    },
    get heli() {
      return heli;
    },
    get roadblock() {
      return roadblock;
    },
    setWanted(n) {
      wanted = Math.max(0, Math.min(5, n));
      heat = wanted;
    },
    clear() {
      wanted = 0;
      heat = 0;
      bustedTimer = 0;
    },
  };
}
