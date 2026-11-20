// Tallow Point — effects.js
// Partikel percikan / asap (game-feel) + flash layar saat tertembak.
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-3).
// - Satu pool THREE.Points (240 partikel) dipakai ulang semua ledakan —
//   tanpa alokasi per frame, tanpa tekstur, tanpa network.
// - Partikel mati diparkir di y = -999. Warna memudar seiring umur.
// - Flash merah layar diurus HUD (DOM); modul ini hanya memicu lewat
//   callback onDamageFlash yang dipasang main.js.

import * as THREE from "three";

const MAX_PARTICLES = 240;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.vel = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES); // sisa umur, detik.
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.baseColor = new Float32Array(MAX_PARTICLES * 3);
    this.gravity = new Float32Array(MAX_PARTICLES);
    this.cursor = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.positions[i * 3 + 1] = -999;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = "effects-particles";
    scene.add(this.points);
  }

  // Ledakan kecil di satu titik. opts: count, color (hex), speed, up,
  // life (detik), gravity (m/s^2, positif = jatuh).
  burst(x, y, z, opts) {
    const o = opts || {};
    const count = o.count || 10;
    const speed = o.speed || 6;
    const up = o.up === undefined ? 3 : o.up;
    const life = o.life || 0.6;
    const gravity = o.gravity === undefined ? 12 : o.gravity;
    const col = new THREE.Color(o.color === undefined ? 0xffa040 : o.color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      const i3 = i * 3;
      this.positions[i3] = x;
      this.positions[i3 + 1] = y;
      this.positions[i3 + 2] = z;
      // Arah acak di bidang XZ + komponen naik.
      const a = Math.random() * Math.PI * 2;
      const r = speed * (0.4 + Math.random() * 0.6);
      this.vel[i3] = Math.cos(a) * r;
      this.vel[i3 + 1] = up * (0.4 + Math.random() * 0.8);
      this.vel[i3 + 2] = Math.sin(a) * r;
      this.life[i] = life * (0.6 + Math.random() * 0.7);
      this.maxLife[i] = this.life[i];
      this.baseColor[i3] = col.r;
      this.baseColor[i3 + 1] = col.g;
      this.baseColor[i3 + 2] = col.b;
      this.gravity[i] = gravity;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  // Percikan tabrakan: oranye terang, cepat, jatuh.
  impactSparks(x, y, z, strength) {
    this.burst(x, y + 0.6, z, {
      count: Math.round(8 + strength),
      color: 0xffb040,
      speed: 5 + strength * 0.4,
      up: 3.5,
      life: 0.55,
      gravity: 14,
    });
  }

  // Asap dari cruiser yang lumpuh: abu-abu, lambat, naik.
  smokePuff(x, y, z) {
    this.burst(x, y + 1.0, z, {
      count: 5,
      color: 0x555555,
      speed: 1.2,
      up: 2.2,
      life: 1.4,
      gravity: -1.5, // negatif = naik.
    });
  }

  // Kilau emas saat misi selesai: naik, lambat, hangat.
  goldBurst(x, y, z) {
    this.burst(x, y + 1.2, z, {
      count: 26,
      color: 0xffd23e,
      speed: 3.5,
      up: 4.5,
      life: 1.1,
      gravity: 4,
    });
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      const i3 = i * 3;
      if (this.life[i] <= 0) {
        this.positions[i3 + 1] = -999;
        this.colors[i3] = 0;
        this.colors[i3 + 1] = 0;
        this.colors[i3 + 2] = 0;
        continue;
      }
      this.vel[i3 + 1] -= this.gravity[i] * dt;
      this.positions[i3] += this.vel[i3] * dt;
      this.positions[i3 + 1] += this.vel[i3 + 1] * dt;
      this.positions[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.positions[i3 + 1] < 0.05) {
        this.positions[i3 + 1] = 0.05;
        this.vel[i3 + 1] *= -0.3; // pantul kecil di tanah.
      }
      // Memudar seiring umur.
      const f = this.life[i] / this.maxLife[i];
      this.colors[i3] = this.baseColor[i3] * f;
      this.colors[i3 + 1] = this.baseColor[i3 + 1] * f;
      this.colors[i3 + 2] = this.baseColor[i3 + 2] * f;
    }
    if (any) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }
  }
}
