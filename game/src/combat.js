// Tallow Point — combat.js
// Combat pemain: pistol saat jalan kaki (klik mouse / tombol F auto-aim),
// raycast ke polisi (cruiser + polisi jalan kaki), tracer + muzzle flash.
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-3).
// - Magasin 12 peluru, isi ulang otomatis 1,2 detik saat kosong.
// - Tembakan hanya saat jalan kaki (di dalam mobil, tombol tembak diabaikan).
// - Raycast THREE.Raycaster ke mesh polisi; hit = damage + percikan.
// - Tracer: pool 4 garis yang memudar 80 ms. Muzzle flash: satu PointLight
//   yang menyala 60 ms di ujung laras (posisi kamera).

import * as THREE from "three";
import { COMBAT } from "./config.js";

const TRACER_COUNT = 4;
const TRACER_LIFE = 0.08;

export class Combat {
  // hooks: {onShot(), onHit(ref, result), onKill(ref, result), onReload(), effects, audio}
  constructor(scene, camera, hooks) {
    this.scene = scene;
    this.camera = camera;
    this.hooks = hooks || {};
    this.ammo = COMBAT.magSize;
    this.reloading = false;
    this.reloadTimer = 0;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = COMBAT.range;
    this._tracerPool = [];
    this._tracerLife = new Float32Array(TRACER_COUNT);
    for (let i = 0; i < TRACER_COUNT; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(6), 3)
      );
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          color: 0xffe08a,
          transparent: true,
          opacity: 0,
        })
      );
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this._tracerPool.push(line);
    }
    this._tracerCursor = 0;
    // Muzzle flash: satu PointLight dipakai ulang.
    this.flash = new THREE.PointLight(0xffc27a, 0, 12, 1.5);
    scene.add(this.flash);
    this._flashTimer = 0;
  }

  get canShoot() {
    return !this.reloading && this.ammo > 0;
  }

  // Tembak ke arah tertentu (world space, ternormalisasi) dari posisi kamera.
  // shootables: [{mesh, ref}] dari police.shootables().
  // Kembalikan: "hit" | "kill" | "miss" | null (tidak bisa menembak).
  shoot(dir, shootables) {
    if (!this.canShoot) {
      if (this.ammo <= 0 && !this.reloading) this._startReload();
      return null;
    }
    this.ammo--;
    if (this.ammo <= 0) this._startReload();
    const origin = this.camera.position.clone();
    // Ujung laras: sedikit di depan-bawah kamera.
    const muzzle = origin.clone().addScaledVector(dir, 1.2);
    muzzle.y -= 0.25;
    this._showTracer(muzzle, dir);
    this._muzzleFlash(muzzle);
    if (this.hooks.audio) this.hooks.audio.gunshot();
    if (this.hooks.onShot) this.hooks.onShot();

    this.raycaster.set(origin, dir);
    const meshes = (shootables || []).map((s) => s.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return "miss";
    const hit = hits[0];
    // Cari shootable pemilik mesh yang kena (naik ke ancestor group).
    let target = null;
    let node = hit.object;
    while (node && !target) {
      target = (shootables || []).find((s) => s.mesh === node);
      node = node.parent;
    }
    if (!target) return "miss";
    // Percikan di titik kena.
    if (this.hooks.effects) {
      this.hooks.effects.impactSparks(hit.point.x, hit.point.y, hit.point.z, 2);
    }
    const dmg = target.ref.type === "cop" ? COMBAT.copDamage : COMBAT.cruiserDamage;
    const result = this.hooks.damageUnit
      ? this.hooks.damageUnit(target.ref, dmg)
      : null;
    if (result === "disabled" || result === "killed") {
      if (this.hooks.onKill) this.hooks.onKill(target.ref, result);
      return "kill";
    }
    if (this.hooks.onHit) this.hooks.onHit(target.ref, result);
    return "hit";
  }

  // Tembak dari tengah layar (klik mouse): raycast lewat titik klik.
  // ndcX/ndcY: koordinat normalized device (-1..1).
  shootFromScreen(ndcX, ndcY, shootables) {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const dir = this.raycaster.ray.direction.clone();
    return this.shoot(dir, shootables);
  }

  // Auto-aim (tombol F): cari unit polisi terdekat di depan kamera (< 35 m,
  // dalam 60 derajat), tembak ke arahnya.
  shootAutoAim(shootables) {
    if (!this.canShoot) {
      if (this.ammo <= 0 && !this.reloading) this._startReload();
      return null;
    }
    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    const origin = this.camera.position;
    let best = null;
    let bestScore = Infinity;
    for (const s of shootables || []) {
      const p = new THREE.Vector3();
      s.mesh.getWorldPosition(p);
      const to = p.clone().sub(origin);
      const dist = to.length();
      if (dist > 35 || dist < 1) continue;
      to.normalize();
      const dot = to.dot(camDir);
      if (dot < 0.5) continue; // di luar 60 derajat dari arah kamera.
      const score = dist + (1 - dot) * 20;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (!best) {
      // Tidak ada target: tembak lurus ke depan (tetap habiskan peluru).
      return this.shoot(camDir.clone(), shootables);
    }
    const dir = best.sub(origin).normalize();
    return this.shoot(dir, shootables);
  }

  _startReload() {
    this.reloading = true;
    this.reloadTimer = COMBAT.reloadTime;
    if (this.hooks.onReload) this.hooks.onReload();
  }

  _showTracer(muzzle, dir) {
    const line = this._tracerPool[this._tracerCursor];
    this._tracerCursor = (this._tracerCursor + 1) % TRACER_COUNT;
    const pos = line.geometry.attributes.position.array;
    pos[0] = muzzle.x;
    pos[1] = muzzle.y;
    pos[2] = muzzle.z;
    const end = muzzle.clone().addScaledVector(dir, COMBAT.range);
    pos[3] = end.x;
    pos[4] = end.y;
    pos[5] = end.z;
    line.geometry.attributes.position.needsUpdate = true;
    line.material.opacity = 0.9;
    line.visible = true;
    this._tracerLife[this._tracerPool.indexOf(line)] = TRACER_LIFE;
  }

  _muzzleFlash(muzzle) {
    this.flash.position.copy(muzzle);
    this.flash.intensity = 14;
    this._flashTimer = 0.06;
  }

  update(dt) {
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = COMBAT.magSize;
      }
    }
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
      if (this._flashTimer <= 0) this.flash.intensity = 0;
    }
    for (let i = 0; i < TRACER_COUNT; i++) {
      if (this._tracerLife[i] > 0) {
        this._tracerLife[i] -= dt;
        const line = this._tracerPool[i];
        if (this._tracerLife[i] <= 0) {
          line.visible = false;
          line.material.opacity = 0;
        } else {
          line.material.opacity = (this._tracerLife[i] / TRACER_LIFE) * 0.9;
        }
      }
    }
  }
}
