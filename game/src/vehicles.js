// Tallow Point — vehicles.js
// Kendaraan: fisika mengemudi pemain (arcade), lalu lintas AI di graf jalan,
// mobil parkir, dan carjacking.
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-2).
// - Mengemudi: model sepeda sederhana (yaw rate = speed/wheelBase * tan(steer)).
// - Lalu lintas: tiap mobil mengikuti edge graf jalan, berhenti sebentar di
//   simpang, melambat kalau ada mobil di depan. Berkendara di sisi kanan.
// - Carjacking: mobil parkir / lalu lintas dalam radius bisa diambil (E).
//   Pengemudi lalu lintas kabur (peds.js yang mengurus larinya).

import * as THREE from "three";
import { PLAYER, TRAFFIC } from "./config.js";
import { makeCarMesh } from "./city.js";
import { resolveCircleVsBuildings, clampToCity } from "./physics.js";
import { makeRng } from "./random.js";

const CAR_RADIUS = 1.9; // tabrakan lingkaran mobil vs bangunan.
const CAR_CAR_RADIUS = 2.0; // tabrakan mobil vs mobil.

const TRAFFIC_COLORS = [0x3a6a8a, 0x8a3a3a, 0x5a5a5a, 0x7a6a3a, 0x2a4a3a, 0x6a4a7a, 0x8a6a2a];

export class Vehicle {
  constructor(mesh, kind, color) {
    this.mesh = mesh;
    this.kind = kind; // "player" | "traffic" | "parked"
    this.color = color;
    this.pos = mesh.position; // Vector3, y selalu 0.
    this.heading = mesh.rotation.y || 0;
    this.speed = 0;
    // State lalu lintas (hanya untuk kind "traffic").
    this.fromNode = -1;
    this.toNode = -1;
    this.edgeT = 0;
    this.cruise = 8;
    this.pauseTimer = 0;
  }
}

export class VehicleManager {
  constructor(scene, city, buildingBoxes, rng) {
    this.scene = scene;
    this.city = city;
    this.buildingBoxes = buildingBoxes;
    this.rng = rng || makeRng(20261119 + 555);
    this.list = [];
    // Adjacency graf jalan: nodeId -> [nodeId tetangga].
    this.adj = new Map();
    for (const e of city.edges) {
      if (!this.adj.has(e.a)) this.adj.set(e.a, []);
      if (!this.adj.has(e.b)) this.adj.set(e.b, []);
      this.adj.get(e.a).push(e.b);
      this.adj.get(e.b).push(e.a);
    }
    // Callback saat mobil pemain menabrak keras: onImpact(speed) — dipakai
    // main.js untuk trauma shake (game-feel). Default: diam.
    this.onImpact = null;
  }

  get playerCar() {
    return this.list.find((v) => v.kind === "player") || null;
  }

  // Mobil pemain baru (coupe merah) di posisi + arah tertentu.
  spawnPlayerCar(x, z, heading) {
    const mesh = makeCarMesh(PLAYER.carColor, THREE);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const v = new Vehicle(mesh, "player", PLAYER.carColor);
    v.heading = heading;
    this.list.push(v);
    return v;
  }

  // Bungkus mesh mobil parkir yang sudah dibuat city.js jadi Vehicle.
  wrapParked(parkingMeshes) {
    const out = [];
    for (const mesh of parkingMeshes) {
      const v = new Vehicle(mesh, "parked", 0x888888);
      v.heading = mesh.rotation.y || 0;
      this.list.push(v);
      out.push(v);
    }
    return out;
  }

  // Spawn mobil lalu lintas di edge acak.
  spawnTraffic(count) {
    const out = [];
    for (let n = 0; n < count; n++) {
      const color = this.rng.pick(TRAFFIC_COLORS);
      const mesh = makeCarMesh(color, THREE);
      this.scene.add(mesh);
      const v = new Vehicle(mesh, "traffic", color);
      v.cruise = this.rng.range(TRAFFIC.speedMin, TRAFFIC.speedMax);
      v.speed = v.cruise * this.rng.range(0.6, 1.0);
      // Pilih edge acak, letakkan di tengah-tengah edge (hindari simpang).
      const edge = this.rng.pick(this.city.edges);
      v.fromNode = edge.a;
      v.toNode = edge.b;
      v.edgeT = this.rng.range(0.2, 0.8);
      this._placeOnEdge(v);
      this.list.push(v);
      out.push(v);
    }
    return out;
  }

  // Letakkan mobil lalu lintas di posisinya sekarang di edge + offset lajur.
  _placeOnEdge(v) {
    const a = this.city.nodes[v.fromNode];
    const b = this.city.nodes[v.toNode];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    const fx = dx / len;
    const fz = dz / len;
    // Sisi kanan jalan (relatif terhadap arah jalan).
    const rx = -fz;
    const rz = fx;
    v.pos.set(
      a.x + dx * v.edgeT + rx * TRAFFIC.laneOffset,
      0,
      a.z + dz * v.edgeT + rz * TRAFFIC.laneOffset
    );
    v.heading = Math.atan2(dx, dz);
    v.mesh.rotation.y = v.heading;
  }

  // Mobil terdekat yang bisa dicuri (parkir / lalu lintas) dalam radius.
  nearestStealable(x, z, maxDist, exclude) {
    let best = null;
    let bestD = maxDist;
    for (const v of this.list) {
      if (v === exclude) continue;
      if (v.kind !== "parked" && v.kind !== "traffic") continue;
      const d = Math.hypot(v.pos.x - x, v.pos.z - z);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best ? { vehicle: best, dist: bestD } : null;
  }

  // Lingkaran tabrakan semua mobil (untuk pemain jalan kaki).
  carCircles(exclude) {
    const out = [];
    for (const v of this.list) {
      if (v === exclude) continue;
      out.push({ x: v.pos.x, z: v.pos.z, r: CAR_CAR_RADIUS });
    }
    return out;
  }

  // Curi mobil: jadi mobil pemain, berhenti sejenak (pengemudi ditarik keluar).
  // Kembalikan true kalau mobil itu tadinya lalu lintas (ada pengemudi kabur).
  steal(vehicle) {
    const hadDriver = vehicle.kind === "traffic";
    vehicle.kind = "player";
    vehicle.speed = 0;
    vehicle.pauseTimer = 0;
    return hadDriver;
  }

  // Tinggalkan mobil: jadi mobil parkir, diam di tempat.
  abandon(vehicle) {
    vehicle.kind = "parked";
    vehicle.speed = 0;
  }

  // ---- Update ---------------------------------------------------------------
  update(dt, input, driving) {
    const playerCar = this.playerCar;
    if (driving && playerCar && input) {
      this._updatePlayerCar(dt, input, playerCar);
    }
    for (const v of this.list) {
      if (v.kind === "traffic") this._updateTraffic(dt, v);
    }
    // Tabrakan mobil-vs-mobil (lingkaran): dorong keluar + perlambat.
    for (let i = 0; i < this.list.length; i++) {
      for (let j = i + 1; j < this.list.length; j++) {
        const a = this.list[i];
        const b = this.list[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        const min = CAR_CAR_RADIUS * 2;
        if (d < min && d > 1e-6) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.pos.x -= nx * push;
          a.pos.z -= nz * push;
          b.pos.x += nx * push;
          b.pos.z += nz * push;
          const rel = Math.abs(a.speed - b.speed);
          a.speed *= 0.7;
          b.speed *= 0.7;
          if (rel > 5 && (a.kind === "player" || b.kind === "player") && this.onImpact) {
            this.onImpact(rel);
          }
        }
      }
    }
  }

  _updatePlayerCar(dt, input, car) {
    const prevSpeed = car.speed;
    // Gas / rem / mundur.
    if (input.throttle) {
      car.speed += PLAYER.carAccel * dt;
    } else if (input.brake) {
      if (car.speed > 0.5) car.speed -= PLAYER.brakeDecel * dt;
      else car.speed -= PLAYER.carAccel * 0.6 * dt;
    }
    // Hambatan gelinding.
    car.speed -= car.speed * PLAYER.drag * dt;
    if (input.handbrake) {
      car.speed -= Math.sign(car.speed) * PLAYER.handbrakeDecel * dt;
      if (Math.sign(car.speed) !== Math.sign(prevSpeed) && Math.abs(car.speed) < 0.5) {
        car.speed = 0;
      }
    }
    car.speed = Math.max(-PLAYER.reverseTopSpeed, Math.min(PLAYER.carTopSpeed, car.speed));

    // Belok (model sepeda): makin cepat makin kecil sudut roda.
    const steerInput = (input.steerLeft ? 1 : 0) - (input.steerRight ? 1 : 0);
    const speedFactor = Math.max(0.45, 1 - (Math.abs(car.speed) / PLAYER.carTopSpeed) * 0.55);
    const steerAngle =
      steerInput * PLAYER.maxSteer * speedFactor * (input.handbrake ? 1.6 : 1);
    const yawRate = (car.speed / PLAYER.wheelBase) * Math.tan(steerAngle);
    car.heading += yawRate * dt;
    car.mesh.rotation.y = car.heading;

    // Maju + tabrakan bangunan.
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    const hit = resolveCircleVsBuildings(car.pos, CAR_RADIUS, this.buildingBoxes);
    if (hit) {
      const impact = Math.abs(prevSpeed);
      car.speed *= 0.4;
      if (impact > 6 && this.onImpact) this.onImpact(impact);
    }
    clampToCity(car.pos, 4);
  }

  _updateTraffic(dt, v) {
    if (v.pauseTimer > 0) {
      v.pauseTimer -= dt;
      v.speed = 0;
      return;
    }
    // Melambat kalau ada mobil di depan dalam jarak followGap.
    let target = v.cruise;
    const fx = Math.sin(v.heading);
    const fz = Math.cos(v.heading);
    for (const other of this.list) {
      if (other === v) continue;
      const dx = other.pos.x - v.pos.x;
      const dz = other.pos.z - v.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < TRAFFIC.followGap && d > 0.01) {
        const ahead = (dx * fx + dz * fz) / d;
        if (ahead > 0.7) target = Math.min(target, Math.max(0, other.speed * 0.7));
      }
    }
    const rate = target > v.speed ? 6 : 12;
    v.speed += Math.max(-rate * dt, Math.min(rate * dt, target - v.speed));

    // Maju sepanjang edge.
    const a = this.city.nodes[v.fromNode];
    const b = this.city.nodes[v.toNode];
    const edgeLen = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    v.edgeT += (v.speed * dt) / edgeLen;
    if (v.edgeT >= 1) {
      // Sampai di simpang: pilih jalan lanjut (bukan balik arah kalau bisa).
      const next = this.adj.get(v.toNode) || [];
      const options = next.filter((n) => n !== v.fromNode);
      const pickFrom = options.length > 0 ? options : next;
      if (pickFrom.length === 0) {
        v.edgeT = 0;
        const tmp = v.fromNode;
        v.fromNode = v.toNode;
        v.toNode = tmp;
      } else {
        v.fromNode = v.toNode;
        v.toNode = this.rng.pick(pickFrom);
        v.edgeT = 0;
        if (this.rng.chance(TRAFFIC.pauseChance)) {
          v.pauseTimer = this.rng.range(TRAFFIC.pauseMin, TRAFFIC.pauseMax);
        }
      }
    }
    this._placeOnEdge(v);
  }
}
