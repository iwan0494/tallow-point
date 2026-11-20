// Tallow Point — camera.js
// Kamera chase third-person (skill camera-systems).
// Ditulis fresh dari R5_SPEC_2026-11-19.md (R5-1).
// Prinsip: follow dengan 1 - exp(-rate*dt) (BUKAN lerp tetap per frame),
// deadzone kecil, look-ahead ke arah gerak, spring-arm anti-clip supaya
// kamera tidak menembus bangunan. Shake (game-feel) menumpang di atas
// follow — tidak pernah ditulis ke dalam target follow.

import * as THREE from "three";
import { CAMERA } from "./config.js";

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _dir = new THREE.Vector3();

function dampFactor(rate, dt) {
  return 1 - Math.exp(-rate * dt);
}

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Uji segmen (p0 -> p1) terhadap AABB gedung (XZ + tinggi). Kembalikan
// parameter t terkecil saat segmen masuk kotak, atau null kalau tidak kena.
// Dipakai spring-arm: kamera ditarik masuk tepat sebelum titik tabrakan.
function segmentHitsBox(p0, p1, box) {
  let tMin = 0;
  let tMax = 1;
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dz = p1.z - p0.z;
  const axes = [
    [p0.x, dx, box.minX, box.maxX],
    [p0.y, dy, 0, box.top],
    [p0.z, dz, box.minZ, box.maxZ],
  ];
  for (const [p, d, lo, hi] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (p < lo || p > hi) return null;
    } else {
      let t1 = (lo - p) / d;
      let t2 = (hi - p) / d;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) return null;
    }
  }
  return tMin;
}

export class ChaseCamera {
  constructor(camera, buildingBoxes) {
    this.camera = camera;
    this.buildingBoxes = buildingBoxes;
    this.focus = new THREE.Vector3(0, 1.5, 0); // titik yang diikuti (XZ + tinggi).
    this.yaw = Math.PI; // menghadap +Z di awal (mobil menghadap +Z).
    this.distance = CAMERA.driving.distance;
    this.height = CAMERA.driving.height;
    this.mode = "driving";
    this.trauma = 0; // game-feel: 0..1, decay tiap frame (real time).
    this._shakeT = 0;
    this._snapNext = true; // potong keras saat pertama kali / teleport.
    this.pitchUp = 0; // R5-4: meter lookAt dinaikkan (kamera menengadah) saat heli aktif.
    this._pitchUpTarget = 0;
  }

  // R5-4: naikkan titik pandang supaya helikopter masuk frame.
  setPitchUp(meters) {
    this._pitchUpTarget = meters;
  }

  setMode(mode) {
    if (mode !== this.mode && (mode === "driving" || mode === "onFoot")) {
      this.mode = mode;
    }
  }

  // Potong kamera langsung ke target (dipakai saat spawn / respawn / teleport).
  snapTo(targetPos, heading) {
    this.yaw = heading;
    this.focus.set(targetPos.x, targetPos.y + 1.4, targetPos.z);
    this._snapNext = true;
  }

  // Trauma shake (game-feel): hit kecil 0.15, sedang 0.4, besar 0.8.
  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  // targetPos: posisi target (Vector3). heading: arah hadap target (radian,
  // 0 = +Z). speed: laju target (m/s) untuk look-ahead. dt: detik.
  update(dt, targetPos, heading, speed, mode) {
    this.setMode(mode || "driving");
    const cfg = this.mode === "driving" ? CAMERA.driving : CAMERA.onFoot;

    // 1. Yaw mengikuti heading target (dihaluskan).
    this.yaw = lerpAngle(this.yaw, heading, dampFactor(4.5, dt));

    // 2. Fokus = target + look-ahead ke arah gerak.
    const lead = Math.min(cfg.lookAhead, cfg.lookAhead * (speed / 8) + 0.4);
    _v1.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(lead);
    _v2.set(targetPos.x + _v1.x, targetPos.y + 1.4, targetPos.z + _v1.z);

    // 3. Deadzone: fokus hanya bergerak kalau target keluar dari radiusnya.
    const dx = _v2.x - this.focus.x;
    const dz = _v2.z - this.focus.z;
    const distXZ = Math.hypot(dx, dz);
    if (distXZ > CAMERA.deadzone) {
      const overflow = distXZ - CAMERA.deadzone;
      const t = dampFactor(cfg.followRate, dt) * (overflow / distXZ);
      this.focus.x += dx * t;
      this.focus.z += dz * t;
    }
    this.focus.y += (_v2.y - this.focus.y) * dampFactor(cfg.followRate, dt);

    // 4. Jarak + tinggi dihaluskan saat ganti mode (jalan kaki <-> mobil).
    this.distance += (cfg.distance - this.distance) * dampFactor(3.0, dt);
    this.height += (cfg.height - this.height) * dampFactor(3.0, dt);

    // 5. Posisi kamera yang diinginkan: di belakang target, setinggi height.
    _dir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    _v1.copy(this.focus).addScaledVector(_dir, this.distance);
    _v1.y = this.focus.y + this.height;

    // 6. Spring-arm: tarik kamera masuk kalau segmen fokus->kamera menembus gedung.
    let reach = 1;
    for (const box of this.buildingBoxes) {
      // Lewati kotak yang jauh dari segmen (cepat, tanpa hitung detail).
      if (
        Math.min(this.focus.x, _v1.x) > box.maxX + 1 ||
        Math.max(this.focus.x, _v1.x) < box.minX - 1 ||
        Math.min(this.focus.z, _v1.z) > box.maxZ + 1 ||
        Math.max(this.focus.z, _v1.z) < box.minZ - 1
      ) {
        continue;
      }
      const t = segmentHitsBox(this.focus, _v1, box);
      if (t !== null && t < reach) reach = Math.max(0, t - 0.04);
    }
    // Jarak minimum supaya kamera tidak menempel ke target.
    const fullLen = this.distance;
    const pulledLen = Math.max(CAMERA.minDistance, fullLen * reach);
    _v1.copy(this.focus).addScaledVector(_dir, pulledLen);
    _v1.y = this.focus.y + this.height * (pulledLen / fullLen);

    // 7. Posisikan kamera (dihaluskan), atau potong keras kalau diminta.
    if (this._snapNext) {
      this.camera.position.copy(_v1);
      this._snapNext = false;
    } else {
      this.camera.position.lerp(_v1, dampFactor(cfg.followRate * 1.4, dt));
    }

    // 8. Shake (game-feel): offset dari trauma^2, summed sines, decay real-time.
    this.trauma = Math.max(0, this.trauma - 1.2 * dt);
    this._shakeT += dt * 30;
    const shake = this.trauma * this.trauma;
    const ox = 0.35 * shake * Math.sin(this._shakeT * 1.7);
    const oy = 0.25 * shake * Math.sin(this._shakeT * 2.3);
    const oz = 0.35 * shake * Math.sin(this._shakeT * 1.3);

    // R5-4: pitch-up dihaluskan menuju target (heli aktif -> menengadah).
    this.pitchUp += (this._pitchUpTarget - this.pitchUp) * dampFactor(2.5, dt);

    this.camera.position.x += ox;
    this.camera.position.y += oy;
    this.camera.position.z += oz;
    this.camera.lookAt(
      this.focus.x + ox * 0.5,
      this.focus.y + 1.1 + this.pitchUp,
      this.focus.z + oz * 0.5
    );
  }
}
