// Tallow Point — physics.js
// Helper tabrakan lingkaran-vs-AABB (XZ) untuk pemain, mobil, dan pejalan kaki.
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-2).
// Bangunan diwakili AABB {minX,maxX,minZ,maxZ,top}; semua tabrakan dihitung
// di bidang XZ, tinggi hanya dipakai kamera (bukan di sini).

import { GAME } from "./config.js";

// Kembalikan vektor dorong-keluar {x, z} kalau lingkaran (px,pz,r) menembus
// kotak, atau null kalau tidak bersentuhan. Dorongan mengarah keluar dari
// kotak lewat sisi terdekat.
export function circleVsBox(px, pz, r, box) {
  const cx = Math.max(box.minX, Math.min(px, box.maxX));
  const cz = Math.max(box.minZ, Math.min(pz, box.maxZ));
  const dx = px - cx;
  const dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    return { x: dx * push, z: dz * push };
  }
  // Pusat lingkaran di dalam kotak: dorong lewat sisi terdekat.
  const left = px - box.minX;
  const right = box.maxX - px;
  const top = pz - box.minZ;
  const bottom = box.maxZ - pz;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: -(left + r), z: 0 };
  if (m === right) return { x: right + r, z: 0 };
  if (m === top) return { x: 0, z: -(top + r) };
  return { x: 0, z: bottom + r };
}

// Dorong posisi (objek dengan .x/.z) keluar dari semua AABB bangunan.
// Kembalikan true kalau ada tabrakan (dipakai untuk bunyi/efek).
export function resolveCircleVsBuildings(pos, radius, boxes) {
  let hit = false;
  for (const box of boxes) {
    // Lewati kotak yang jauh (cepat).
    if (
      pos.x < box.minX - radius ||
      pos.x > box.maxX + radius ||
      pos.z < box.minZ - radius ||
      pos.z > box.maxZ + radius
    ) {
      continue;
    }
    const push = circleVsBox(pos.x, pos.z, radius, box);
    if (push) {
      pos.x += push.x;
      pos.z += push.z;
      hit = true;
    }
  }
  return hit;
}

// Jaga posisi tetap di dalam kota (dengan margin dari tepi).
export function clampToCity(pos, margin) {
  const lim = GAME.halfCity + 60 - (margin || 0);
  pos.x = Math.max(-lim, Math.min(lim, pos.x));
  pos.z = Math.max(-lim, Math.min(lim, pos.z));
}

// Sudut terpendek dari a ke b (radian, -PI..PI). Dipakai belok + putar badan.
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Putar sudut `a` menuju `b` paling jauh `maxStep` radian.
export function turnToward(a, b, maxStep) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}
