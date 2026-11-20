// Tallow Point — peds.js
// Pejalan kaki AI: berjalan di trotoar mengelilingi blok, menghindar dari
// mobil yang mendekat, dan pengemudi yang kabur saat mobilnya dicuri.
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-2).
// - Trotoar = keliling blok (persegi panjang di tepi blok + 1 m ke luar).
// - Menghindar: kalau ada kendaraan cepat dalam 5 m dan mengarah ke pejalan
//   kaki, pejalan kaki melangkah menjauh dari kendaraan selama ~1,2 detik.
// - Kabur (flee): lari menjauhi titik carjacking 4,5 m/s, lalu dihapus.

import * as THREE from "three";
import { GAME, PEDS } from "./config.js";
import { makeRng } from "./random.js";

const SHIRTS = [0x3a6a8a, 0x8a3a3a, 0x5a7a3a, 0x7a5a8a, 0xc0c0c0, 0x2a2a2a, 0xd9a03a];

// Pejalan kaki sederhana: badan + kepala, tinggi ~1,7 m.
export function makePedMesh(THREE, rng) {
  const g = new THREE.Group();
  g.name = "ped";
  const shirt = new THREE.MeshStandardMaterial({
    color: rng.pick(SHIRTS),
    roughness: 0.85,
  });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc99a72, roughness: 0.6 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.26), shirt);
  torso.position.y = 1.05;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), skin);
  head.position.y = 1.52;
  head.castShadow = true;
  g.add(head);
  const legGeo = new THREE.BoxGeometry(0.18, 0.72, 0.2);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.12, 0.36, 0);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.12, 0.36, 0);
  g.add(legL);
  g.add(legR);
  return { group: g, legL, legR };
}

export class Ped {
  constructor(mesh, legL, legR) {
    this.mesh = mesh;
    this.legL = legL;
    this.legR = legR;
    this.pos = mesh.position;
    this.heading = 0;
    this.speed = 1.2;
    this.mode = "walk"; // "walk" | "dodge" | "flee"
    this.dodgeTimer = 0;
    this.fleeTimer = 0;
    this.walkPhase = 0;
    // Rute trotoar: 4 sudut keliling blok, arah acak.
    this.corners = [];
    this.corner = 0;
    this.dodgeTarget = null;
  }
}

export class PedManager {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng || makeRng(20261119 + 999);
    this.list = [];
  }

  // Spawn pejalan kaki di trotoar blok acak.
  spawn(count) {
    const out = [];
    for (let n = 0; n < count; n++) {
      const ped = this._makePed();
      const bx = this.rng.int(0, GAME.grid - 1);
      const bz = this.rng.int(0, GAME.grid - 1);
      this._assignBlock(ped, bx, bz);
      this.list.push(ped);
      out.push(ped);
    }
    return out;
  }

  _makePed() {
    const parts = makePedMesh(THREE, this.rng);
    this.scene.add(parts.group);
    return new Ped(parts.group, parts.legL, parts.legR);
  }

  // Keliling blok: 4 sudut di tepi trotoar (blok + 1 m ke luar).
  _assignBlock(ped, bx, bz) {
    const cx = -GAME.halfCity + GAME.roadWidth + GAME.blockSize / 2 + bx * GAME.roadPitch;
    const cz = -GAME.halfCity + GAME.roadWidth + GAME.blockSize / 2 + bz * GAME.roadPitch;
    const h = GAME.blockSize / 2 + 1.0;
    let corners = [
      { x: cx - h, z: cz - h },
      { x: cx + h, z: cz - h },
      { x: cx + h, z: cz + h },
      { x: cx - h, z: cz + h },
    ];
    if (this.rng.chance(0.5)) corners = corners.reverse();
    ped.corners = corners;
    ped.corner = this.rng.int(0, 3);
    const start = corners[ped.corner];
    ped.pos.set(start.x, 0, start.z);
    ped.speed = this.rng.range(PEDS.walkMin, PEDS.walkMax);
    ped.mode = "walk";
  }

  // R5-4 staging screenshot: pindahkan pejalan kaki ke trotoar blok-blok
  // tertentu (di sisi jalan yang sedang difoto) supaya terlihat di frame.
  stageOnBlocks(blocks, count) {
    let placed = 0;
    for (const ped of this.list) {
      if (placed >= count) break;
      if (ped.mode !== "walk") continue;
      const b = blocks[placed % blocks.length];
      this._assignBlock(ped, b.bx, b.bz);
      placed++;
    }
    return placed;
  }

  // Pengemudi yang mobilnya dicuri: lari menjauhi titik itu, lalu hilang.
  spawnFleeing(x, z, awayHeading) {
    const ped = this._makePed();
    ped.pos.set(x, 0, z);
    ped.heading = awayHeading;
    ped.speed = PEDS.fleeSpeed;
    ped.mode = "flee";
    ped.fleeTimer = PEDS.fleeTime;
    this.list.push(ped);
    return ped;
  }

  update(dt, vehicles) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const ped = this.list[i];
      if (ped.mode === "flee") {
        ped.fleeTimer -= dt;
        if (ped.fleeTimer <= 0) {
          this.scene.remove(ped.mesh);
          this.list.splice(i, 1);
          continue;
        }
        ped.pos.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.pos.z += Math.cos(ped.heading) * ped.speed * dt;
        ped.mesh.rotation.y = ped.heading;
        this._animate(ped, dt);
        continue;
      }

      // Menghindar: kendaraan cepat dalam 5 m yang mengarah ke pejalan kaki.
      if (ped.mode === "walk" && vehicles) {
        const threat = this._findThreat(ped, vehicles);
        if (threat) {
          const dx = ped.pos.x - threat.x;
          const dz = ped.pos.z - threat.z;
          const d = Math.hypot(dx, dz) || 1;
          ped.dodgeTarget = {
            x: ped.pos.x + (dx / d) * 2.5,
            z: ped.pos.z + (dz / d) * 2.5,
          };
          ped.mode = "dodge";
          ped.dodgeTimer = 1.2;
        }
      }

      if (ped.mode === "dodge") {
        ped.dodgeTimer -= dt;
        const t = ped.dodgeTarget;
        const dx = t.x - ped.pos.x;
        const dz = t.z - ped.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.3 && ped.dodgeTimer > 0) {
          const sp = PEDS.walkMax * 1.6;
          ped.pos.x += (dx / d) * sp * dt;
          ped.pos.z += (dz / d) * sp * dt;
          ped.heading = Math.atan2(dx, dz);
          ped.mesh.rotation.y = ped.heading;
          this._animate(ped, dt);
        } else {
          ped.mode = "walk";
          ped.dodgeTarget = null;
          // Lanjut dari sudut terdekat supaya tidak jalan memotong blok.
          let best = 0;
          let bestD = Infinity;
          ped.corners.forEach((c, idx) => {
            const dd = Math.hypot(c.x - ped.pos.x, c.z - ped.pos.z);
            if (dd < bestD) {
              bestD = dd;
              best = idx;
            }
          });
          ped.corner = best;
        }
        continue;
      }

      // Jalan normal: menuju sudut berikutnya di keliling blok.
      const target = ped.corners[ped.corner];
      const dx = target.x - ped.pos.x;
      const dz = target.z - ped.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.8) {
        ped.corner = (ped.corner + 1) % ped.corners.length;
      } else {
        ped.pos.x += (dx / d) * ped.speed * dt;
        ped.pos.z += (dz / d) * ped.speed * dt;
        ped.heading = Math.atan2(dx, dz);
        ped.mesh.rotation.y = ped.heading;
        this._animate(ped, dt);
      }
    }
  }

  // Kendaraan yang mengancam: cepat (>2 m/s), dekat (<5 m), mengarah ke ped.
  _findThreat(ped, vehicles) {
    for (const v of vehicles) {
      if (Math.abs(v.speed) < 2) continue;
      const dx = ped.pos.x - v.pos.x;
      const dz = ped.pos.z - v.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 5 || d < 0.01) continue;
      const fx = Math.sin(v.heading);
      const fz = Math.cos(v.heading);
      const toward = (dx * fx + dz * fz) / d;
      if (toward < -0.5) return { x: v.pos.x, z: v.pos.z };
    }
    return null;
  }

  _animate(ped, dt) {
    ped.walkPhase += dt * ped.speed * 2.4;
    const s = Math.sin(ped.walkPhase) * 0.4;
    ped.legL.rotation.x = s;
    ped.legR.rotation.x = -s;
  }
}
