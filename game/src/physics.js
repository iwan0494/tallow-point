// physics.js — AABB / circle collision against building footprints, plus
// small helpers (dist2, clamp, lerp). Pure math, no Three.js state.
// Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist2(ax, az, bx, bz) {
    var dx = ax - bx, dz = az - bz;
    return dx * dx + dz * dz;
  }
  function dist(ax, az, bx, bz) { return Math.sqrt(dist2(ax, az, bx, bz)); }

  // Push a circle (x,z,r) out of every AABB collider it overlaps. Returns
  // true when any collision happened (so the caller can spark / thud).
  function collideCircle(pos, r, colliders) {
    var hit = false;
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      var cx = clamp(pos.x, c.minX, c.maxX);
      var cz = clamp(pos.z, c.minZ, c.maxZ);
      var dx = pos.x - cx, dz = pos.z - cz;
      var d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 1e-8) {
          var d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * r;
          pos.z = cz + (dz / d) * r;
        } else {
          // Dead centre: push out along the smallest penetration axis.
          var px = Math.min(pos.x - c.minX + r, c.maxX - pos.x + r);
          var pz = Math.min(pos.z - c.minZ + r, c.maxZ - pos.z + r);
          if (px < pz) pos.x = (pos.x - c.minX < c.maxX - pos.x) ? c.minX - r : c.maxX + r;
          else pos.z = (pos.z - c.minZ < c.maxZ - pos.z) ? c.minZ - r : c.maxZ + r;
        }
      }
    }
    return hit;
  }

  // Point inside any collider?
  function insideAny(x, z, colliders) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i];
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return true;
    }
    return false;
  }

  TP.Physics = {
    clamp: clamp, lerp: lerp, dist: dist, dist2: dist2,
    collideCircle: collideCircle, insideAny: insideAny,
  };
})(window.TP);
