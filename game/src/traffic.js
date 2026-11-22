// Traffic: cars that drive the road graph, turn at intersections and keep a
// little distance. Parked cars sit at the kerb and are the carjacking targets.

import { ROADS, HALF, TRAFFIC_COUNT, PARKED_COUNT } from './config.js';
import { makeCar } from './vehicles.js';

const TRAFFIC_COLORS = [0xd23c2e, 0x2f6fd6, 0xe8e8e8, 0x3a3a40, 0x7a5cff, 0x2fae8f, 0xc98a1b, 0x8a8f96];

export function createTraffic(scene, rng, physics) {
  const cars = [];
  const parked = [];

  function randomRoadPoint() {
    if (rng.chance(0.5)) {
      return { x: rng.pick(ROADS), z: rng.range(-HALF, HALF), along: 'z' };
    }
    return { x: rng.range(-HALF, HALF), z: rng.pick(ROADS), along: 'x' };
  }

  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const mesh = makeCar(rng.pick(TRAFFIC_COLORS));
    scene.add(mesh);
    const p = randomRoadPoint();
    const dir = rng.chance(0.5) ? 1 : -1;
    const car = {
      mesh, x: p.x, z: p.z, along: p.along, dir,
      speed: rng.range(7, 12), heading: p.along === 'z' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      stopped: 0, isTraffic: true,
    };
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.heading;
    cars.push(car);
  }

  for (let i = 0; i < PARKED_COUNT; i += 1) {
    const mesh = makeCar(rng.pick(TRAFFIC_COLORS));
    scene.add(mesh);
    const road = rng.pick(ROADS);
    const along = rng.chance(0.5) ? 'z' : 'x';
    const t = rng.range(-140, 140);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = along === 'z' ? road + side * 4.6 : t;
    const z = along === 'z' ? t : road + side * 4.6;
    const heading = along === 'z' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    const car = { mesh, x, z, heading, speed: 0, parked: true, isTraffic: false };
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    parked.push(car);
  }

  function step(dt, playerPos) {
    for (const car of cars) {
      // A car ahead in the same lane makes this one wait a beat.
      let blocked = false;
      for (const other of cars) {
        if (other === car || other.along !== car.along) continue;
        const ahead = car.along === 'z'
          ? (other.z - car.z) * car.dir
          : (other.x - car.x) * car.dir;
        const lateral = car.along === 'z' ? Math.abs(other.x - car.x) : Math.abs(other.z - car.z);
        if (ahead > 0 && ahead < 9 && lateral < 3) { blocked = true; break; }
      }
      if (blocked) {
        car.stopped += dt;
      } else {
        car.stopped = 0;
        const v = car.speed * dt;
        if (car.along === 'z') car.z += car.dir * v;
        else car.x += car.dir * v;
      }
      // Wrap around the city edge and sometimes turn at an intersection.
      if (car.along === 'z' && (car.z > HALF + 4 || car.z < -HALF - 4)) {
        car.z = car.dir > 0 ? -HALF - 2 : HALF + 2;
        car.x = rng.pick(ROADS);
      }
      if (car.along === 'x' && (car.x > HALF + 4 || car.x < -HALF - 4)) {
        car.x = car.dir > 0 ? -HALF - 2 : HALF + 2;
        car.z = rng.pick(ROADS);
      }
      const nearRoad = ROADS.reduce((best, r) => {
        const d = car.along === 'z' ? Math.abs(car.z - r) : Math.abs(car.x - r);
        return d < best.d ? { r, d } : best;
      }, { r: 0, d: 999 });
      if (nearRoad.d < 1.2 && rng.chance(dt * 0.12)) {
        // Turn onto the crossing road.
        if (car.along === 'z') {
          car.along = 'x';
          car.z = nearRoad.r;
          car.dir = rng.chance(0.5) ? 1 : -1;
          car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.along = 'z';
          car.x = nearRoad.r;
          car.dir = rng.chance(0.5) ? 1 : -1;
          car.heading = car.dir > 0 ? 0 : Math.PI;
        }
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      // Wheel spin for life.
      const spin = car.speed * dt * 2.4;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    }
    // Gentle push-out between traffic and the player so cars never overlap.
    if (playerPos) {
      for (const car of cars) {
        const dx = car.x - playerPos.x;
        const dz = car.z - playerPos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 16 && d2 > 0.001) {
          const d = Math.sqrt(d2);
          car.x += (dx / d) * (4 - d) * 0.5;
          car.z += (dz / d) * (4 - d) * 0.5;
        }
      }
    }
  }

  return {
    cars, parked,
    step,
    nearestParked(x, z, maxDist) {
      let best = null;
      let bestD = maxDist;
      for (const car of parked) {
        const d = Math.hypot(car.x - x, car.z - z);
        if (d < bestD) { bestD = d; best = car; }
      }
      return best;
    },
    removeParked(car) {
      const i = parked.indexOf(car);
      if (i >= 0) parked.splice(i, 1);
    },
  };
}
