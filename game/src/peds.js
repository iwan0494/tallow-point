// Pedestrians: sidewalk walkers who stroll, pause, and flee with their arms up
// when a car or a gunshot comes close. Beachgoers cluster on the sand in Sunmere.

import { HALF, PED_COUNT, BEACHGOER_COUNT, ROADS } from './config.js';
import { makePed } from './vehicles.js';

const SHIRTS = [0xe8e8e8, 0xff5a5a, 0x35c8ff, 0xffc21a, 0x2fae8f, 0xff2fa0, 0x7a5cff, 0xe05a2b];
const SKINS = [0xc98d64, 0x8a5a3b, 0xe8b88a, 0x6e4423, 0xd9a066];

export function createPeds(scene, rng) {
  const peds = [];
  const beachgoers = [];

  function spawn(x, z, beach) {
    const mesh = makePed(rng.pick(SHIRTS), rng.pick(SKINS));
    scene.add(mesh);
    const ped = {
      mesh, x, z, heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.4), state: 'walk', panic: 0,
      targetX: x, targetZ: z, beach: !!beach, bob: rng.range(0, 6),
    };
    mesh.position.set(x, 0, z);
    (beach ? beachgoers : peds).push(ped);
    return ped;
  }

  for (let i = 0; i < PED_COUNT; i += 1) {
    const road = rng.pick(ROADS);
    const along = rng.chance(0.5);
    const t = rng.range(-HALF, HALF);
    const side = rng.chance(0.5) ? 8 : -8;
    spawn(along ? road + side : t, along ? t : road + side, false);
  }
  for (let i = 0; i < BEACHGOER_COUNT; i += 1) {
    spawn(rng.range(-HALF - 60, -HALF - 15), rng.range(-160, 160), true);
  }

  function step(dt, threats) {
    for (const ped of [...peds, ...beachgoers]) {
      ped.bob += dt * 6;
      // Flee from the nearest threat (player car, gunshot, police).
      let fleeX = 0;
      let fleeZ = 0;
      for (const t of threats) {
        const dx = ped.x - t.x;
        const dz = ped.z - t.z;
        const d = Math.hypot(dx, dz);
        if (d < 14 && d > 0.01) {
          fleeX += (dx / d) * (14 - d);
          fleeZ += (dz / d) * (14 - d);
        }
      }
      if (fleeX !== 0 || fleeZ !== 0) {
        ped.state = 'flee';
        ped.panic = 1;
        ped.heading = Math.atan2(fleeX, fleeZ);
        ped.x += Math.sin(ped.heading) * 5.5 * dt;
        ped.z += Math.cos(ped.heading) * 5.5 * dt;
      } else {
        ped.panic = Math.max(0, ped.panic - dt * 0.5);
        ped.state = ped.panic > 0.3 ? 'walk' : 'walk';
        // Stroll toward a random nearby target, then pick a new one.
        const dx = ped.targetX - ped.x;
        const dz = ped.targetZ - ped.z;
        const d = Math.hypot(dx, dz);
        if (d < 1.5) {
          if (ped.beach) {
            ped.targetX = ped.x + rng.range(-25, 25);
            ped.targetZ = ped.z + rng.range(-25, 25);
            ped.targetX = Math.max(-HALF - 62, Math.min(-HALF - 14, ped.targetX));
            ped.targetZ = Math.max(-168, Math.min(168, ped.targetZ));
          } else {
            ped.targetX = ped.x + rng.range(-30, 30);
            ped.targetZ = ped.z + rng.range(-30, 30);
          }
        } else {
          ped.heading = Math.atan2(dx, dz);
          ped.x += Math.sin(ped.heading) * ped.speed * dt;
          ped.z += Math.cos(ped.heading) * ped.speed * dt;
        }
      }
      ped.x = Math.max(-HALF - 64, Math.min(HALF + 4, ped.x));
      ped.z = Math.max(-HALF - 4, Math.min(HALF + 4, ped.z));
      ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.bob)) * (ped.state === 'flee' ? 0.14 : 0.05), ped.z);
      ped.mesh.rotation.y = ped.heading;
      // Arms up while fleeing.
      ped.mesh.rotation.z = ped.state === 'flee' ? 0.12 : 0;
    }
  }

  return {
    peds, beachgoers,
    step,
    nearest(x, z, maxDist) {
      let best = null;
      let bestD = maxDist;
      for (const ped of [...peds, ...beachgoers]) {
        const d = Math.hypot(ped.x - x, ped.z - z);
        if (d < bestD) { bestD = d; best = ped; }
      }
      return best;
    },
    remove(ped) {
      const list = ped.beach ? beachgoers : peds;
      const i = list.indexOf(ped);
      if (i >= 0) list.splice(i, 1);
      ped.mesh.visible = false;
    },
  };
}
