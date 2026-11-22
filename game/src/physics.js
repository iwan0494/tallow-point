// Cheap 2D collision: building footprints are axis-aligned boxes, cars and
// pedestrians are circles. No physics engine — just push-out and a speed penalty.

import { HALF } from './config.js';

export function createPhysics(colliders) {
  // colliders: [{ minX, maxX, minZ, maxZ }]
  function collideCircle(pos, radius) {
    let hit = false;
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (radius - d) / d;
          pos.x += dx * push;
          pos.z += dz * push;
        } else {
          pos.x += radius;
        }
      }
    }
    // Keep everything inside the city + beach.
    pos.x = Math.max(-430, Math.min(HALF + 8, pos.x));
    pos.z = Math.max(-HALF - 8, Math.min(HALF + 8, pos.z));
    return hit;
  }

  function collideCars(a, b, radiusSum) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radiusSum * radiusSum || d2 < 0.0001) return false;
    const d = Math.sqrt(d2);
    const push = (radiusSum - d) / 2 / d;
    a.x -= dx * push;
    a.z -= dz * push;
    b.x += dx * push;
    b.z += dz * push;
    return true;
  }

  return { collideCircle, collideCars };
}
