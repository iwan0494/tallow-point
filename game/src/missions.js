// Tallow Point — missions.js
// 5 misi cerita berurutan: intro (curii mobil) -> kurir -> kejar-kejaran ->
// curi mobil target -> antar orang. Tiap misi: objektif di HUD, beacon 3D
// emas + penanda minimap, reward cash, misi berikutnya terbuka.
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-3).
// - Beacon: silinder cahaya + octahedron berputar di titik target.
// - Misi gagal (waktu kurir habis) = diulang dari awal misi yang sama.
// - Setelah misi ke-5: free roam + bonus $500.

import * as THREE from "three";
import { MISSIONS } from "./config.js";
import { makeCarMesh, roadLine, blockCenter } from "./city.js";
import { makePedMesh } from "./peds.js";
import { makeRng } from "./random.js";

const DEFS = [
  {
    id: "intro",
    title: "KENALI CRATER ROW",
    objective: "Curi sebuah mobil (E)",
    reward: 0,
  },
  {
    id: "courier",
    title: "KURIR: ANTAR PAKET",
    objective: "Antar paket ke Sunmere sebelum waktu habis",
    reward: 150,
  },
  {
    id: "escape",
    title: "KEJAR-KEJARAN",
    objective: "Kabur dari polisi — bertahan 30 detik dengan wanted 2+",
    reward: 200,
  },
  {
    id: "targetcar",
    title: "CURI MOBIL TARGET",
    objective: "Curi coupe emas di Kessel Wharf, bawa ke safehouse",
    reward: 250,
  },
  {
    id: "chauffeur",
    title: "ANTAR ORANG",
    objective: "Jemput penumpang di Moraine Heights, antar ke Crater Row",
    reward: 300,
  },
];

function makeBeacon(THREE) {
  const g = new THREE.Group();
  g.name = "mission-beacon";
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(2.5, 2.5, 30, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd23e,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  cyl.position.y = 15;
  g.add(cyl);
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshStandardMaterial({
      color: 0xffd23e,
      emissive: 0xffb400,
      emissiveIntensity: 1.6,
      roughness: 0.3,
      metalness: 0.6,
    })
  );
  gem.position.y = 4;
  g.add(gem);
  return { group: g, gem };
}

export class MissionManager {
  // hooks: {onComplete(def, reward), onFail(def, reason), onStartWanted(stars), onClearWanted()}
  constructor(scene, city, vehicles, peds, rng, hooks) {
    this.scene = scene;
    this.city = city;
    this.vehicles = vehicles;
    this.peds = peds;
    this.rng = rng || makeRng(20261119 + 777);
    this.hooks = hooks || {};
    this.index = 0; // misi aktif (0..4); 5 = semua selesai.
    this.phase = "go"; // "go" | "steal" | "pickup" | "deliver"
    this.timer = null; // detik tersisa (null = tanpa batas waktu).
    this.targetX = city.safehouse ? city.safehouse.x : 0;
    this.targetZ = city.safehouse ? city.safehouse.z : 0;
    this.targetCar = null;
    this.passenger = null; // mesh ped penumpang.
    this.beacon = null;
    this.allDone = false;
    this._time = 0;
  }

  get current() {
    return this.index < DEFS.length ? DEFS[this.index] : null;
  }

  // Titik di jalan dekat safehouse (bisa dicapai mobil): jalan vertikal
  // di barat blok safehouse, setinggi tengah blok.
  _safehouseDrop() {
    const sh = this.city.safehouse;
    if (!sh) return { x: 0, z: 0 };
    return { x: roadLine(3), z: blockCenter(4) };
  }

  start(index) {
    this.index = index;
    this.allDone = index >= DEFS.length;
    this.phase = "go";
    this.timer = null;
    this._clearBeacon();
    this._clearTargetCar();
    this._clearPassenger();
    if (this.allDone) {
      this.targetX = this.city.safehouse ? this.city.safehouse.x : 0;
      this.targetZ = this.city.safehouse ? this.city.safehouse.z : 0;
      return;
    }
    const def = DEFS[index];
    if (def.id === "intro") {
      // Tanpa target — selesai saat pemain mencuri mobil pertama.
      this.targetX = this.city.safehouse ? this.city.safehouse.x : 0;
      this.targetZ = this.city.safehouse ? this.city.safehouse.z : 0;
    } else if (def.id === "courier") {
      this.targetX = roadLine(6);
      this.targetZ = roadLine(6);
      this.timer = MISSIONS.courierTime;
      this._makeBeacon(this.targetX, this.targetZ);
    } else if (def.id === "escape") {
      this.timer = MISSIONS.escapeTime;
      if (this.hooks.onStartWanted) this.hooks.onStartWanted(2);
      const drop = this._safehouseDrop();
      this.targetX = drop.x;
      this.targetZ = drop.z;
    } else if (def.id === "targetcar") {
      this.phase = "steal";
      const x = roadLine(1) + 3.4;
      const z = roadLine(5) + 8;
      const mesh = makeCarMesh(0xd9a03a, THREE); // coupe EMAS.
      mesh.position.set(x, 0, z);
      mesh.rotation.y = 0;
      this.scene.add(mesh);
      const wrapped = this.vehicles.wrapParked([mesh]);
      const car = wrapped[0];
      car.isTarget = true;
      this.targetCar = car;
      this.targetX = x;
      this.targetZ = z;
      this._makeBeacon(x, z);
    } else if (def.id === "chauffeur") {
      this.phase = "pickup";
      const x = roadLine(6) + 6;
      const z = roadLine(1) + 6;
      const stubRng = {
        pick: () => 0xd9a03a,
        range: (a) => a,
        int: (a) => a,
        chance: () => false,
        next: () => 0.5,
        shuffle: (a) => a,
      };
      const parts = makePedMesh(THREE, stubRng);
      parts.group.position.set(x, 0, z);
      this.scene.add(parts.group);
      this.passenger = parts.group;
      this.targetX = x;
      this.targetZ = z;
      this._makeBeacon(x, z);
    }
  }

  // Misi aktif dimulai ulang dari awal (setelah gagal / respawn).
  restart() {
    this.start(this.index);
  }

  // Dipanggil main.js saat pemain mencuri mobil (kendaraan apa pun).
  notifyCarjack(vehicle) {
    const def = this.current;
    if (!def) return;
    if (def.id === "intro") {
      this._complete();
      return;
    }
    if (def.id === "targetcar" && this.phase === "steal" && vehicle === this.targetCar) {
      this.phase = "deliver";
      const drop = this._safehouseDrop();
      this.targetX = drop.x;
      this.targetZ = drop.z;
      this._makeBeacon(drop.x, drop.z);
    }
  }

  _makeBeacon(x, z) {
    this._clearBeacon();
    const b = makeBeacon(THREE);
    b.group.position.set(x, 0, z);
    this.scene.add(b.group);
    this.beacon = b;
  }

  _clearBeacon() {
    if (!this.beacon) return;
    this.scene.remove(this.beacon.group);
    this.beacon = null;
  }

  _clearTargetCar() {
    // Mobil target yang belum dicuri ikut dihapus saat misi di-restart;
    // kalau sudah dicuri (kind player/parked di tangan pemain), biarkan.
    if (this.targetCar && this.targetCar.kind === "parked") {
      this.scene.remove(this.targetCar.mesh);
      const i = this.vehicles.list.indexOf(this.targetCar);
      if (i >= 0) this.vehicles.list.splice(i, 1);
    }
    this.targetCar = null;
  }

  _clearPassenger() {
    if (!this.passenger) return;
    this.scene.remove(this.passenger);
    this.passenger = null;
  }

  _complete() {
    const def = this.current;
    if (!def) return;
    const reward = def.reward;
    this._clearBeacon();
    if (def.id === "targetcar") this.targetCar = null;
    if (def.id === "chauffeur") this._clearPassenger();
    if (def.id === "escape" && this.hooks.onClearWanted) {
      this.hooks.onClearWanted();
    }
    if (this.hooks.onComplete) this.hooks.onComplete(def, reward);
    this.index++;
    if (this.index >= DEFS.length) {
      this.allDone = true;
      if (this.hooks.onAllDone) this.hooks.onAllDone(MISSIONS.finalBonus);
      const drop = this._safehouseDrop();
      this.targetX = drop.x;
      this.targetZ = drop.z;
      this.timer = null;
    } else {
      this.start(this.index);
    }
  }

  _fail(reason) {
    const def = this.current;
    if (this.hooks.onFail) this.hooks.onFail(def, reason);
    this.start(this.index); // ulang misi yang sama.
  }

  // ctx: {playerX, playerZ, mode, playerCar, wantedStars}
  // Kembalikan: {objective, title, done, timer, targetX, targetZ, allDone}
  update(dt, ctx) {
    this._time += dt;
    if (this.beacon) {
      this.beacon.gem.rotation.y += dt * 2.2;
      this.beacon.gem.position.y = 4 + Math.sin(this._time * 2.5) * 0.5;
    }
    const def = this.current;
    if (!def || this.allDone) {
      return {
        objective: "Semua misi selesai — jelajahi Tallow Point sesukamu",
        title: "✓ SEMUA MISI SELESAI",
        done: true,
        timer: null,
        targetX: this.targetX,
        targetZ: this.targetZ,
        allDone: true,
      };
    }
    const px = ctx.playerX;
    const pz = ctx.playerZ;

    if (def.id === "courier") {
      if (this.timer !== null) {
        this.timer -= dt;
        if (this.timer <= 0) {
          this._fail("Waktu habis — paket tidak sampai");
          return this._status();
        }
      }
      if (Math.hypot(px - this.targetX, pz - this.targetZ) < MISSIONS.targetRadius) {
        this._complete();
        return this._status();
      }
    } else if (def.id === "escape") {
      if (this.timer !== null) {
        this.timer -= dt;
        if (this.timer <= 0) {
          this._complete();
          return this._status();
        }
      }
    } else if (def.id === "targetcar") {
      if (this.phase === "steal") {
        // Beacon mengikuti mobil target kalau mobilnya bergerak (mis. ditabrak).
        if (this.targetCar) {
          this.targetX = this.targetCar.pos.x;
          this.targetZ = this.targetCar.pos.z;
          if (this.beacon) {
            this.beacon.group.position.set(this.targetX, 0, this.targetZ);
          }
        }
      } else if (this.phase === "deliver") {
        const drop = this._safehouseDrop();
        if (
          this.targetCar &&
          Math.hypot(this.targetCar.pos.x - drop.x, this.targetCar.pos.z - drop.z) <
            MISSIONS.targetRadius + 2
        ) {
          this._complete();
          return this._status();
        }
      }
    } else if (def.id === "chauffeur") {
      if (this.phase === "pickup") {
        if (
          ctx.mode === "driving" &&
          this.passenger &&
          Math.hypot(px - this.targetX, pz - this.targetZ) < MISSIONS.pickupRadius
        ) {
          // Penumpang naik.
          this._clearPassenger();
          this.phase = "deliver";
          const drop = this._safehouseDrop();
          this.targetX = drop.x;
          this.targetZ = drop.z;
          this._makeBeacon(drop.x, drop.z);
          if (this.hooks.onPickup) this.hooks.onPickup();
        }
      } else if (this.phase === "deliver") {
        const drop = this._safehouseDrop();
        if (Math.hypot(px - drop.x, pz - drop.z) < MISSIONS.targetRadius) {
          this._complete();
          return this._status();
        }
      }
    }
    return this._status();
  }

  _status() {
    const def = this.current;
    if (!def || this.allDone) {
      return {
        objective: "Semua misi selesai — jelajahi Tallow Point sesukamu",
        title: "✓ SEMUA MISI SELESAI",
        done: true,
        timer: null,
        targetX: this.targetX,
        targetZ: this.targetZ,
        allDone: true,
      };
    }
    let objective = def.objective;
    if (def.id === "targetcar" && this.phase === "deliver") {
      objective = "Bawa coupe emas ke safehouse Crater Row";
    } else if (def.id === "chauffeur" && this.phase === "deliver") {
      objective = "Antar penumpang ke safehouse Crater Row";
    }
    return {
      objective,
      title: def.title,
      done: false,
      timer: this.timer,
      targetX: this.targetX,
      targetZ: this.targetZ,
      allDone: false,
    };
  }
}
