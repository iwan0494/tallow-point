// Tallow Point — player.js
// Pemain jalan kaki: mesh karakter + kontrol kamera-relatif + tabrakan.
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-2).
// Gerak relatif terhadap yaw kamera (W = menjauhi kamera). Badan berputar
// halus ke arah gerak; kaki mengayun saat berjalan (animasi sederhana).

import * as THREE from "three";
import { PLAYER } from "./config.js";
import { resolveCircleVsBuildings, clampToCity, turnToward } from "./physics.js";

const RADIUS = 0.45; // tabrakan lingkaran pemain.

// Karakter sederhana tapi terbaca dari kamera chase: jaket oranye terang,
// celana gelap, kepala + topi. Tinggi ~1,8 m.
export function makePlayerMesh(THREE) {
  const g = new THREE.Group();
  g.name = "player";
  const jacket = new THREE.MeshStandardMaterial({ color: 0xff7b2f, roughness: 0.7 });
  const denim = new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a077, roughness: 0.6 });
  const cap = new THREE.MeshStandardMaterial({ color: 0x1e2a3a, roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), jacket);
  torso.position.y = 1.12;
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skin);
  head.position.y = 1.62;
  head.castShadow = true;
  g.add(head);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.36), cap);
  hat.position.y = 1.8;
  g.add(hat);

  const legGeo = new THREE.BoxGeometry(0.2, 0.78, 0.22);
  const legL = new THREE.Mesh(legGeo, denim);
  legL.position.set(-0.14, 0.39, 0);
  legL.castShadow = true;
  const legR = new THREE.Mesh(legGeo, denim);
  legR.position.set(0.14, 0.39, 0);
  legR.castShadow = true;
  g.add(legL);
  g.add(legR);

  const armGeo = new THREE.BoxGeometry(0.15, 0.58, 0.18);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.34, 1.12, 0);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.34, 1.12, 0);
  g.add(armL);
  g.add(armR);

  return { group: g, legL, legR, armL, armR };
}

export class Player {
  constructor(THREE) {
    const parts = makePlayerMesh(THREE);
    this.mesh = parts.group;
    this.legL = parts.legL;
    this.legR = parts.legR;
    this.armL = parts.armL;
    this.armR = parts.armR;
    this.pos = this.mesh.position; // Vector3, y selalu 0.
    this.heading = Math.PI; // menghadap -Z di awal (seperti mobil R5-1).
    this.speed = 0;
    this.walkPhase = 0;
  }

  place(x, z, heading) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.mesh.rotation.y = heading;
  }

  // dt: detik. move: {x,z} kamera-relatif dari input, atau null.
  // camYaw: yaw kamera (radian, 0 = +Z). buildingBoxes: AABB gedung.
  // carCircles: [{x, z, r}] mobil yang tidak boleh ditembus.
  update(dt, move, camYaw, buildingBoxes, carCircles) {
    let targetSpeed = 0;
    if (move) {
      // Kamera-relatif: maju (W) = menjauhi kamera, kanan (D) = kanan kamera.
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      const wx = sin * move.z + cos * move.x;
      const wz = cos * move.z - sin * move.x;
      const desired = Math.atan2(wx, wz);
      this.heading = turnToward(this.heading, desired, 9.0 * dt);
      targetSpeed = PLAYER.walkSpeed;
      this._moveX = wx;
      this._moveZ = wz;
    } else {
      this._moveX = 0;
      this._moveZ = 0;
    }
    // Akselerasi / deselerasi halus (tidak langsung berhenti).
    const rate = targetSpeed > this.speed ? 14 : 18;
    this.speed += Math.max(-rate * dt, Math.min(rate * dt, targetSpeed - this.speed));
    if (this.speed > 0.05) {
      this.pos.x += Math.sin(this.heading) * this.speed * dt;
      this.pos.z += Math.cos(this.heading) * this.speed * dt;
    }
    resolveCircleVsBuildings(this.pos, RADIUS, buildingBoxes);
    if (carCircles) {
      for (const c of carCircles) {
        const dx = this.pos.x - c.x;
        const dz = this.pos.z - c.z;
        const d = Math.hypot(dx, dz);
        const min = RADIUS + c.r;
        if (d < min && d > 1e-6) {
          this.pos.x += (dx / d) * (min - d);
          this.pos.z += (dz / d) * (min - d);
        }
      }
    }
    clampToCity(this.pos, 4);

    // Animasi jalan: kaki + lengan mengayun sebanding dengan kecepatan.
    this.mesh.rotation.y = this.heading;
    const swing = this.speed > 0.2;
    this.walkPhase += dt * this.speed * 2.1;
    const amp = swing ? Math.min(0.55, this.speed * 0.09) : 0;
    const s = Math.sin(this.walkPhase) * amp;
    this.legL.rotation.x = s;
    this.legR.rotation.x = -s;
    this.armL.rotation.x = -s * 0.7;
    this.armR.rotation.x = s * 0.7;
  }
}
