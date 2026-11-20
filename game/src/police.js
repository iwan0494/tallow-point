// Tallow Point — police.js
// Sistem wanted 1-5 + polisi: cruiser kejar, roadblock, helikopter,
// polisi jalan kaki, penangkapan (BUSTED).
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-3).
// - Wanted = heat 0..100, bintang dari ambang config. Naik saat kejahatan,
//   turun perlahan hanya saat bersembunyi (tidak ada polisi < 45 m).
// - Cruiser mengejar lewat graf jalan (pilih simpang yang mendekati pemain,
//   jarak Manhattan di grid) dan beralih ke mode "ram" saat dekat (< 12 m).
// - Roadblock (bintang >= 3): 2 cruiser melintang di jalan di depan pemain.
// - Helikopter (bintang >= 4): mengikuti dari udara + kerucut spotlight.
// - Polisi jalan kaki (bintang >= 3, pemain jalan kaki): lari mengejar,
//   menembak dari jarak, menangkap kalau sangat dekat.
// - BUSTED: ditangkap jalan kaki, atau mobil berhenti dikepung cruiser.
// - Strobo merah-biru: emissive berkedip bergantian (0,2 detik).

import * as THREE from "three";
import { POLICE } from "./config.js";
import { makeCarMesh, roadLine } from "./city.js";
import { makePedMesh } from "./peds.js";
import { resolveCircleVsBuildings, clampToCity, turnToward } from "./physics.js";
import { makeRng } from "./random.js";

const CRUISER_RADIUS = 1.9;
const COP_RADIUS = 0.45;

function heatToStars(heat) {
  const t = POLICE.heatThresholds;
  if (heat >= t[4]) return 5;
  if (heat >= t[3]) return 4;
  if (heat >= t[2]) return 3;
  if (heat >= t[1]) return 2;
  if (heat > 0) return 1;
  return 0;
}

// ---- Wanted ----------------------------------------------------------------
export class Wanted {
  constructor() {
    this.heat = 0;
    this.stars = 0;
    this.freshCarTimer = 0;
    this.graceTimer = 0; // selama > 0, heat tidak decay (kejahatan baru).
  }

  addHeat(n) {
    this.heat = Math.min(100, this.heat + n);
    this.stars = heatToStars(this.heat);
    this.graceTimer = POLICE.heatGrace;
  }

  // Paksa level bintang (dipakai misi + debug). n = 0..5.
  setStars(n) {
    if (n <= 0) {
      this.heat = 0;
    } else {
      this.heat = POLICE.heatThresholds[n - 1] + 1;
    }
    this.stars = heatToStars(this.heat);
    // Force-set dianggap kejahatan segar juga: beri masa tenggang supaya
    // bintang tidak langsung decay sebelum polisi sempat mengejar.
    this.graceTimer = POLICE.heatGrace;
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
    this.freshCarTimer = 0;
    this.graceTimer = 0;
  }

  // Ganti mobil: polisi kehilangan jejak sebentar (decay lebih cepat).
  freshCar() {
    this.freshCarTimer = POLICE.freshCarTime;
  }

  update(dt, hidden) {
    if (this.freshCarTimer > 0) this.freshCarTimer -= dt;
    if (this.graceTimer > 0) this.graceTimer -= dt;
    // Decay hanya saat bersembunyi DAN masa tenggang sudah habis.
    if (hidden && this.heat > 0 && this.graceTimer <= 0) {
      const rate =
        POLICE.decayHidden *
        (this.freshCarTimer > 0 ? POLICE.decayFreshCar : 1);
      this.heat = Math.max(0, this.heat - rate * dt);
      this.stars = heatToStars(this.heat);
    }
  }
}

// ---- Mesh polisi ------------------------------------------------------------
function makeCruiserMesh(THREE) {
  const g = makeCarMesh(0x14181f, THREE); // hitam gelap.
  g.name = "cruiser";
  // Lightbar merah-biru di atas kabin. R5-4: lebih besar (0.9 m) + strobo
  // lebih terang supaya terbaca di screenshot dari kejauhan.
  const barGeo = new THREE.BoxGeometry(0.9, 0.24, 0.55);
  const matR = new THREE.MeshStandardMaterial({
    color: 0x220000,
    emissive: 0xff2211,
    emissiveIntensity: 0,
  });
  const matB = new THREE.MeshStandardMaterial({
    color: 0x000022,
    emissive: 0x2266ff,
    emissiveIntensity: 0,
  });
  const r = new THREE.Mesh(barGeo, matR);
  r.position.set(-0.45, 1.32, -0.25);
  const b = new THREE.Mesh(barGeo, matB);
  b.position.set(0.45, 1.32, -0.25);
  g.add(r);
  g.add(b);
  // Push bar depan.
  const push = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.3, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.7 })
  );
  push.position.set(0, 0.45, 2.15);
  g.add(push);
  return { group: g, matR, matB };
}

function makeHeliMesh(THREE) {
  const g = new THREE.Group();
  g.name = "heli";
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a2028,
    roughness: 0.4,
    metalness: 0.5,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.2), bodyMat);
  body.castShadow = true;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.5), bodyMat);
  tail.position.set(0, 0.2, -4.0);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.8), bodyMat);
  fin.position.set(0, 0.6, -6.0);
  g.add(fin);
  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.08, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })
  );
  rotor.position.y = 1.0;
  g.add(rotor);
  const tailRotor = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 1.6, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })
  );
  tailRotor.position.set(0.32, 0.6, -5.8);
  g.add(tailRotor);
  // Kerucut spotlight ke bawah (apex di heli, alas di tanah).
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(7, POLICE.heliHeight, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff2bb,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  cone.position.y = -POLICE.heliHeight / 2;
  g.add(cone);
  // Beacon merah berkedip di bawah badan.
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2211, emissiveIntensity: 2 })
  );
  beacon.position.y = -0.85;
  g.add(beacon);
  return { group: g, rotor, tailRotor, beacon };
}

// ---- Cruiser ----------------------------------------------------------------
class Cruiser {
  constructor(mesh, matR, matB) {
    this.mesh = mesh;
    this.matR = matR;
    this.matB = matB;
    this.pos = mesh.position;
    this.heading = 0;
    this.speed = 0;
    this.hp = POLICE.cruiserHp;
    this.disabled = false;
    this.disableTimer = 0;
    this.mode = "chase"; // "chase" | "ram"
    this.fromNode = -1;
    this.toNode = -1;
    this.edgeT = 0;
    this.targetNode = -1;
    this.retargetTimer = 0;
    this.strobePhase = 0;
    this.flankSide = 0; // R5-4: -1 kiri / +1 kanan, diset saat spawn (flanking).
  }
}

// ---- Polisi jalan kaki -------------------------------------------------------
class Cop {
  constructor(mesh, legL, legR) {
    this.mesh = mesh;
    this.legL = legL;
    this.legR = legR;
    this.pos = mesh.position;
    this.heading = 0;
    this.speed = POLICE.copSpeed;
    this.hp = 50;
    this.down = false;
    this.downTimer = 0;
    this.walkPhase = 0;
    this.shootTimer = 0;
  }
}

// ---- Manager -----------------------------------------------------------------
export class PoliceManager {
  // hooks: {onImpact(speed), onPlayerDamage(amount, source), onBusted(reason), effects}
  constructor(scene, city, buildingBoxes, rng, hooks) {
    this.scene = scene;
    this.city = city;
    this.buildingBoxes = buildingBoxes;
    this.rng = rng || makeRng(20261119 + 3131);
    this.hooks = hooks || {};
    this.cruisers = [];
    this.cops = [];
    this.roadblock = null; // {x, z, heading, cruisers: [Cruiser]}
    this.heli = null; // {group, rotor, tailRotor, beacon}
    this.arrestProgress = 0;
    this.surroundedTimer = 0;
    this._heatCooldown = 0;
    this._smokeTimer = 0;
    this._roadblockTimer = 0;
    this._time = 0;
    // Adjacency graf jalan (seperti vehicles.js).
    this.adj = new Map();
    for (const e of city.edges) {
      if (!this.adj.has(e.a)) this.adj.set(e.a, []);
      if (!this.adj.has(e.b)) this.adj.set(e.b, []);
      this.adj.get(e.a).push(e.b);
      this.adj.get(e.b).push(e.a);
    }
  }

  get sirenOn() {
    return this.cruisers.some((c) => !c.disabled) || this.heli !== null;
  }

  get activeCount() {
    return {
      cruisers: this.cruisers.filter((c) => !c.disabled).length,
      cops: this.cops.filter((c) => !c.down).length,
      heli: this.heli ? 1 : 0,
      roadblock: this.roadblock ? this.roadblock.cruisers.length : 0,
    };
  }

  // Semua unit polisi untuk HUD + minimap: [{x, z, kind}].
  get units() {
    const out = [];
    for (const c of this.cruisers) {
      if (!c.disabled) out.push({ x: c.pos.x, z: c.pos.z, kind: "cruiser" });
    }
    if (this.roadblock) {
      for (const c of this.roadblock.cruisers) {
        out.push({ x: c.pos.x, z: c.pos.z, kind: "roadblock" });
      }
    }
    for (const c of this.cops) {
      if (!c.down) out.push({ x: c.pos.x, z: c.pos.z, kind: "cop" });
    }
    if (this.heli) {
      out.push({ x: this.heli.group.position.x, z: this.heli.group.position.z, kind: "heli" });
    }
    return out;
  }

  nearestPoliceDist(x, z) {
    let best = Infinity;
    for (const u of this.units) {
      const d = Math.hypot(u.x - x, u.z - z);
      if (d < best) best = d;
    }
    return best;
  }

  // Mesh yang bisa ditembak pemain (combat): [{mesh, ref}].
  shootables() {
    const out = [];
    for (const c of this.cruisers) {
      if (!c.disabled) out.push({ mesh: c.mesh, ref: { type: "cruiser", obj: c } });
    }
    if (this.roadblock) {
      for (const c of this.roadblock.cruisers) {
        out.push({ mesh: c.mesh, ref: { type: "cruiser", obj: c } });
      }
    }
    for (const c of this.cops) {
      if (!c.down) out.push({ mesh: c.mesh, ref: { type: "cop", obj: c } });
    }
    return out;
  }

  // Terima damage dari tembakan pemain. Kembalikan "disabled" | "killed" | "hit".
  damageUnit(ref, dmg) {
    if (ref.type === "cruiser") {
      const c = ref.obj;
      if (c.disabled) return null;
      c.hp -= dmg;
      if (c.hp <= 0) {
        c.disabled = true;
        c.speed = 0;
        c.disableTimer = 20;
        if (this.hooks.effects) {
          this.hooks.effects.smokePuff(c.pos.x, c.pos.y + 0.5, c.pos.z);
        }
        return "disabled";
      }
      return "hit";
    }
    if (ref.type === "cop") {
      const c = ref.obj;
      if (c.down) return null;
      c.hp -= dmg;
      if (c.hp <= 0) {
        c.down = true;
        c.downTimer = 3;
        c.mesh.rotation.x = -Math.PI / 2; // jatuh telentang.
        c.mesh.position.y = 0.3;
        return "killed";
      }
      return "hit";
    }
    return null;
  }

  // ---- Spawn / despawn ------------------------------------------------------
  _nearestNode(x, z) {
    let best = 0;
    let bestD = Infinity;
    for (const n of this.city.nodes) {
      const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z);
      if (d < bestD) {
        bestD = d;
        best = n.id;
      }
    }
    return best;
  }

  _nodeCoords(id) {
    return { i: id % (7 + 1), j: Math.floor(id / (7 + 1)) };
  }

  _spawnCruiserNear(x, z, minDist, maxDist) {
    const { group, matR, matB } = makeCruiserMesh(THREE);
    this.scene.add(group);
    const c = new Cruiser(group, matR, matB);
    // Cari simpang 40-70 m dari pemain.
    let node = -1;
    for (let tries = 0; tries < 20; tries++) {
      const cand = this.rng.pick(this.city.nodes);
      const d = Math.hypot(cand.x - x, cand.z - z);
      if (d >= minDist && d <= maxDist) {
        node = cand.id;
        break;
      }
    }
    if (node < 0) node = this._nearestNode(x, z);
    const n = this.city.nodes[node];
    c.pos.set(n.x, 0, n.z);
    c.heading = Math.atan2(x - n.x, z - n.z);
    c.mesh.rotation.y = c.heading;
    // R5-4: slot flank bergantian kiri/kanan supaya cruiser mengapit pemain.
    if (!this._flankSeq) this._flankSeq = 0;
    c.flankSide = this._flankSeq % 2 === 0 ? -1 : 1;
    this._flankSeq++;
    c.fromNode = node;
    const neighbors = this.adj.get(node) || [];
    c.toNode = neighbors.length > 0 ? this.rng.pick(neighbors) : node;
    c.edgeT = 0;
    c.speed = 6;
    this.cruisers.push(c);
    return c;
  }

  _removeCruiser(c) {
    this.scene.remove(c.mesh);
    const i = this.cruisers.indexOf(c);
    if (i >= 0) this.cruisers.splice(i, 1);
  }

  _spawnCop(x, z) {
    const stubRng = { pick: () => 0x223a55, range: (a, b) => a, int: (a) => a, chance: () => false, next: () => 0.5, shuffle: (a) => a };
    const parts = makePedMesh(THREE, stubRng);
    this.scene.add(parts.group);
    const cop = new Cop(parts.group, parts.legL, parts.legR);
    cop.pos.set(x, 0, z);
    cop.heading = Math.atan2(x, z);
    this.cops.push(cop);
    return cop;
  }

  _removeCop(cop) {
    this.scene.remove(cop.mesh);
    const i = this.cops.indexOf(cop);
    if (i >= 0) this.cops.splice(i, 1);
  }

  _makeRoadblock(px, pz, heading) {
    this._clearRoadblock();
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const ax = px + fx * POLICE.roadblockAhead;
    const az = pz + fz * POLICE.roadblockAhead;
    // Snap ke jalan terdekat: kalau maju dominan Z, jalan vertikal (snap x).
    let bx;
    let bz;
    let roadHeading;
    if (Math.abs(fz) >= Math.abs(fx)) {
      let best = roadLine(0);
      let bestD = Infinity;
      for (let i = 0; i <= 7; i++) {
        const d = Math.abs(roadLine(i) - ax);
        if (d < bestD) {
          bestD = d;
          best = roadLine(i);
        }
      }
      bx = best;
      bz = az;
      roadHeading = 0; // jalan membujur Z; cruiser melintang (menghadap X).
    } else {
      let best = roadLine(0);
      let bestD = Infinity;
      for (let i = 0; i <= 7; i++) {
        const d = Math.abs(roadLine(i) - az);
        if (d < bestD) {
          bestD = d;
          best = roadLine(i);
        }
      }
      bx = ax;
      bz = best;
      roadHeading = Math.PI / 2;
    }
    const cruisers = [];
    for (const off of [-2.6, 2.6]) {
      const { group, matR, matB } = makeCruiserMesh(THREE);
      this.scene.add(group);
      const c = new Cruiser(group, matR, matB);
      // Melintang: posisi digeser tegak lurus arah jalan.
      const px2 = bx + Math.cos(roadHeading) * off;
      const pz2 = bz - Math.sin(roadHeading) * off;
      c.pos.set(px2, 0, pz2);
      c.heading = roadHeading + Math.PI / 2;
      c.mesh.rotation.y = c.heading;
      c.speed = 0;
      cruisers.push(c);
    }
    // R5-4: cone oranye di garis roadblock supaya terbaca sebagai blokade.
    const cones = [];
    const coneGeo = new THREE.ConeGeometry(0.45, 0.95, 10);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xcc5510,
      emissive: 0xff6a1a,
      emissiveIntensity: 1.4,
      roughness: 0.6,
    });
    const cx = Math.cos(roadHeading); // arah tegak lurus jalan.
    const cz = -Math.sin(roadHeading);
    for (const off of [-4.2, -1.4, 1.4, 4.2]) {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(bx + cx * off, 0.48, bz + cz * off);
      cone.castShadow = true;
      this.scene.add(cone);
      cones.push(cone);
    }
    this.roadblock = { x: bx, z: bz, heading: roadHeading, cruisers, cones };
    this._roadblockTimer = 12; // R5-4: 18 -> 12 detik, roadblock dipasang ulang lebih cepat.
  }

  _clearRoadblock() {
    if (!this.roadblock) return;
    for (const c of this.roadblock.cruisers) this.scene.remove(c.mesh);
    if (this.roadblock.cones) {
      for (const cone of this.roadblock.cones) this.scene.remove(cone);
    }
    this.roadblock = null;
  }

  // ---- Staging visual (R5-4) ------------------------------------------------
  // Tempatkan cruiser langsung di slot flank (kiri/kanan pemain) supaya
  // langsung TERLIHAT di frame — dipakai staging cover/chase/police.
  stageFlankers(px, pz, heading, count) {
    const fwdX = Math.sin(heading);
    const fwdZ = Math.cos(heading);
    const rightX = -Math.cos(heading);
    const rightZ = Math.sin(heading);
    const out = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const { group, matR, matB } = makeCruiserMesh(THREE);
      this.scene.add(group);
      const c = new Cruiser(group, matR, matB);
      c.flankSide = side;
      const sx = px + fwdX * POLICE.flankLong + rightX * side * POLICE.flankLateral;
      const sz = pz + fwdZ * POLICE.flankLong + rightZ * side * POLICE.flankLateral;
      c.pos.set(sx, 0, sz);
      c.heading = heading;
      c.mesh.rotation.y = heading;
      c.speed = 6;
      c.mode = "chase";
      const node = this._nearestNode(sx, sz);
      c.fromNode = node;
      const neighbors = this.adj.get(node) || [];
      c.toNode = neighbors.length > 0 ? neighbors[0] : node;
      c.edgeT = 0;
      this.cruisers.push(c);
      out.push(c);
    }
    return out;
  }

  // Paksa roadblock muncul di depan pemain sekarang (staging screenshot).
  stageRoadblock(px, pz, heading) {
    this._makeRoadblock(px, pz, heading);
    return this.roadblock;
  }

  // R5-4: heli spawn LANGSUNG di depan-atas pemain (bukan di belakang
  // kamera) supaya langsung masuk frame begitu bintang 4 tercapai.
  _spawnHeli(px, pz, heading) {
    if (this.heli) return;
    const { group, rotor, tailRotor, beacon } = makeHeliMesh(THREE);
    const hx = px + Math.sin(heading || 0) * POLICE.heliAhead;
    const hz = pz + Math.cos(heading || 0) * POLICE.heliAhead;
    group.position.set(hx, POLICE.heliHeight, hz);
    this.scene.add(group);
    this.heli = { group, rotor, tailRotor, beacon };
  }

  _clearHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.group);
    this.heli = null;
  }

  clearAll() {
    for (const c of this.cruisers.slice()) this._removeCruiser(c);
    for (const c of this.cops.slice()) this._removeCop(c);
    this._clearRoadblock();
    this._clearHeli();
    this.arrestProgress = 0;
    this.surroundedTimer = 0;
  }

  // ---- Update ---------------------------------------------------------------
  // ctx: {playerX, playerZ, playerHeading, playerSpeed, mode, playerCar, vehicles, wanted, time}
  update(dt, ctx) {
    this._time += dt;
    if (this._heatCooldown > 0) this._heatCooldown -= dt;
    const stars = ctx.wanted.stars;
    const px = ctx.playerX;
    const pz = ctx.playerZ;

    // Jumlah cruiser mengikuti bintang.
    const wantCruisers = POLICE.cruisersPerStar[stars] || 0;
    const activeCruisers = this.cruisers.filter((c) => !c.disabled);
    if (activeCruisers.length < wantCruisers) {
      this._spawnCruiserNear(px, pz, 40, 75);
    } else if (activeCruisers.length > wantCruisers) {
      // Kelebihan: hapus yang terjauh (bukan yang lumpuh — itu tetap di jalan).
      let far = null;
      let farD = -1;
      for (const c of activeCruisers) {
        const d = Math.hypot(c.pos.x - px, c.pos.z - pz);
        if (d > farD) {
          farD = d;
          far = c;
        }
      }
      if (far) this._removeCruiser(far);
    }
    // Cruiser lumpuh hilang setelah 20 detik.
    for (const c of this.cruisers.slice()) {
      if (c.disabled) {
        c.disableTimer -= dt;
        if (c.disableTimer <= 0) this._removeCruiser(c);
      }
    }
    // Asap berkala dari cruiser lumpuh.
    this._smokeTimer -= dt;
    if (this._smokeTimer <= 0) {
      this._smokeTimer = 0.5;
      for (const c of this.cruisers) {
        if (c.disabled && this.hooks.effects) {
          this.hooks.effects.smokePuff(c.pos.x, c.pos.y + 0.5, c.pos.z);
        }
      }
    }

    // Roadblock di bintang >= 3.
    if (stars >= POLICE.roadblockMinStars) {
      if (!this.roadblock) {
        this._makeRoadblock(px, pz, ctx.playerHeading);
      } else {
        this._roadblockTimer -= dt;
        const past = Math.hypot(this.roadblock.x - px, this.roadblock.z - pz);
        // R5-4: pasang ulang lebih cepat (45 m / 12 detik, bukan 90 m / 18)
        // supaya roadblock selalu ada di depan pemain, bukan tertinggal jauh.
        if (this._roadblockTimer <= 0 || past > 45) {
          this._makeRoadblock(px, pz, ctx.playerHeading);
        }
      }
    } else if (this.roadblock) {
      this._clearRoadblock();
    }

    // Helikopter di bintang >= 4.
    if (stars >= POLICE.heliMinStars) {
      if (!this.heli) this._spawnHeli(px, pz, ctx.playerHeading);
    } else if (this.heli) {
      this._clearHeli();
    }
    if (this.heli) {
      const h = this.heli.group.position;
      // R5-4: heli mengikuti di DEPAN pemain (masuk frame) — bukan di
      // belakang kamera. Spotlight jatuh di jalan di depan pemain.
      const tx = px + Math.sin(ctx.playerHeading) * POLICE.heliAhead;
      const tz = pz + Math.cos(ctx.playerHeading) * POLICE.heliAhead;
      h.x += (tx - h.x) * Math.min(1, 1.2 * dt);
      h.z += (tz - h.z) * Math.min(1, 1.2 * dt);
      h.y += (POLICE.heliHeight - h.y) * Math.min(1, 1.5 * dt);
      this.heli.rotor.rotation.y += dt * 22;
      this.heli.tailRotor.rotation.x += dt * 30;
      this.heli.beacon.material.emissiveIntensity = Math.floor(this._time * 3) % 2 === 0 ? 2.5 : 0.2;
    }

    // Polisi jalan kaki (bintang >= 3, pemain jalan kaki): maksimal 2.
    if (stars >= 3 && ctx.mode === "onFoot") {
      const aliveCops = this.cops.filter((c) => !c.down);
      if (aliveCops.length < POLICE.copMax) {
        // Spawn di simpang terdekat di belakang pemain.
        const node = this._nearestNode(px, pz);
        const n = this.city.nodes[node];
        this._spawnCop(n.x + 6, n.z + 6);
      }
    } else if (ctx.mode === "driving") {
      // Pemain masuk mobil: polisi jalan kaki mundur (hapus yang masih jauh).
      for (const c of this.cops.slice()) {
        if (!c.down && Math.hypot(c.pos.x - px, c.pos.z - pz) > 30) {
          this._removeCop(c);
        }
      }
    }

    // Strobo semua cruiser (termasuk roadblock): merah-biru bergantian.
    // R5-4: emissive 3.2 -> 5.0 supaya strobo terbaca dari kejauhan.
    const phase = Math.floor(this._time * 5) % 2;
    const strobe = (c) => {
      if (c.disabled) {
        c.matR.emissiveIntensity = 0;
        c.matB.emissiveIntensity = 0;
        return;
      }
      c.matR.emissiveIntensity = phase === 0 ? 5.0 : 0.15;
      c.matB.emissiveIntensity = phase === 1 ? 5.0 : 0.15;
    };
    for (const c of this.cruisers) strobe(c);
    if (this.roadblock) for (const c of this.roadblock.cruisers) strobe(c);

    // Update tiap cruiser.
    for (const c of this.cruisers) {
      if (!c.disabled) this._updateCruiser(dt, c, ctx);
    }
    // Update polisi jalan kaki.
    for (const cop of this.cops.slice()) {
      if (cop.down) {
        cop.downTimer -= dt;
        if (cop.downTimer <= 0) this._removeCop(cop);
        continue;
      }
      this._updateCop(dt, cop, ctx);
    }

    // Penangkapan (BUSTED) + tembakan polisi ke pemain.
    this._updateArrest(dt, ctx);
  }

  _updateCruiser(dt, c, ctx) {
    const px = ctx.playerX;
    const pz = ctx.playerZ;
    const distToPlayer = Math.hypot(c.pos.x - px, c.pos.z - pz);

    // Posisi relatif terhadap arah hadap pemain: long > 0 = cruiser di
    // belakang pemain, lat = sisi (kanan pemain = +).
    const fwdX = Math.sin(ctx.playerHeading);
    const fwdZ = Math.cos(ctx.playerHeading);
    const rightX = -Math.cos(ctx.playerHeading);
    const rightZ = Math.sin(ctx.playerHeading);
    const relX = px - c.pos.x;
    const relZ = pz - c.pos.z;
    const longRel = relX * fwdX + relZ * fwdZ;
    const latRel = relX * rightX + relZ * rightZ;

    // Mode ram HANYA kalau cruiser tepat di belakang pemain (bukan dari
    // samping — dari samping ia mengapit, bukan menabrak lurus).
    if (c.mode === "chase" && distToPlayer < 12 && longRel > 0 && Math.abs(latRel) < 3.5) {
      c.mode = "ram";
    }
    if (c.mode === "ram" && (distToPlayer > 20 || Math.abs(latRel) > 6)) c.mode = "chase";

    // R5-4 FLANK: cruiser yang sudah dekat mengapit di sisi pemain (masuk
    // frame di tepi kiri/kanan) — bukan mengejar dari belakang kamera.
    if (c.mode === "chase" && distToPlayer < POLICE.flankRange) {
      const side = c.flankSide || 1;
      const tx = px + fwdX * POLICE.flankLong + rightX * side * POLICE.flankLateral;
      const tz = pz + fwdZ * POLICE.flankLong + rightZ * side * POLICE.flankLateral;
      const dx = tx - c.pos.x;
      const dz = tz - c.pos.z;
      const dSlot = Math.hypot(dx, dz);
      const desired = Math.atan2(dx, dz);
      c.heading = turnToward(c.heading, desired, 4.5 * dt);
      // Kejar slot kalau jauh, samakan kecepatan pemain kalau sudah di slot.
      const playerSpeed = ctx.playerSpeed || 0;
      const targetSpeed =
        dSlot > 6
          ? Math.min(POLICE.cruiserTopSpeed, playerSpeed + 3)
          : Math.max(0, playerSpeed);
      const rate = targetSpeed > c.speed ? POLICE.cruiserAccel : 12;
      c.speed += Math.max(-rate * dt, Math.min(rate * dt, targetSpeed - c.speed));
      c.pos.x += Math.sin(c.heading) * c.speed * dt;
      c.pos.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.rotation.y = c.heading;
      resolveCircleVsBuildings(c.pos, CRUISER_RADIUS, this.buildingBoxes);
      clampToCity(c.pos, 4);
    } else if (c.mode === "ram") {
      const desired = Math.atan2(px - c.pos.x, pz - c.pos.z);
      c.heading = turnToward(c.heading, desired, 3.5 * dt);
      c.speed = Math.min(POLICE.cruiserTopSpeed, c.speed + POLICE.cruiserAccel * dt);
      c.pos.x += Math.sin(c.heading) * c.speed * dt;
      c.pos.z += Math.cos(c.heading) * c.speed * dt;
      c.mesh.rotation.y = c.heading;
      resolveCircleVsBuildings(c.pos, CRUISER_RADIUS, this.buildingBoxes);
      clampToCity(c.pos, 4);
    } else {
      // Kejar lewat graf jalan menuju simpang terdekat pemain.
      c.retargetTimer -= dt;
      if (c.retargetTimer <= 0 || c.targetNode < 0) {
        c.targetNode = this._nearestNode(px, pz);
        c.retargetTimer = 0.5;
      }
      c.speed = Math.min(POLICE.cruiserTopSpeed, c.speed + POLICE.cruiserAccel * dt);
      const a = this.city.nodes[c.fromNode];
      const b = this.city.nodes[c.toNode];
      const edgeLen = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      c.edgeT += (c.speed * dt) / edgeLen;
      if (c.edgeT >= 1) {
        const arrived = c.toNode;
        const prev = c.fromNode;
        c.fromNode = arrived;
        if (arrived === c.targetNode) {
          c.mode = "ram";
        } else {
          const next = this.adj.get(arrived) || [];
          const target = this._nodeCoords(c.targetNode);
          let best = -1;
          let bestD = Infinity;
          for (const n of next) {
            if (n === prev && next.length > 1) continue; // jangan balik arah.
            const nc = this._nodeCoords(n);
            const d = Math.abs(nc.i - target.i) + Math.abs(nc.j - target.j);
            if (d < bestD) {
              bestD = d;
              best = n;
            }
          }
          if (best < 0) best = next.length > 0 ? next[0] : arrived;
          c.toNode = best;
        }
        c.edgeT = 0;
      }
      // Letakkan di edge (tengah jalan).
      const na = this.city.nodes[c.fromNode];
      const nb = this.city.nodes[c.toNode];
      const dx = nb.x - na.x;
      const dz = nb.z - na.z;
      c.pos.set(na.x + dx * c.edgeT, 0, na.z + dz * c.edgeT);
      c.heading = Math.atan2(dx, dz);
      c.mesh.rotation.y = c.heading;
    }

    // Tabrakan dengan mobil pemain: dorong + perlambat + percikan + heat.
    const car = ctx.playerCar;
    if (car && car.kind === "player") {
      const dx = car.pos.x - c.pos.x;
      const dz = car.pos.z - c.pos.z;
      const d = Math.hypot(dx, dz);
      const min = CRUISER_RADIUS + 2.0;
      if (d < min && d > 1e-6) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const nz = dz / d;
        car.pos.x += nx * push;
        car.pos.z += nz * push;
        c.pos.x -= nx * push;
        c.pos.z -= nz * push;
        const rel = Math.abs(car.speed - c.speed);
        car.speed *= POLICE.ramSlow;
        if (rel > 5) {
          if (this.hooks.onImpact) this.hooks.onImpact(rel);
          if (this.hooks.effects) {
            this.hooks.effects.impactSparks(
              (car.pos.x + c.pos.x) / 2,
              0.5,
              (car.pos.z + c.pos.z) / 2,
              rel
            );
          }
          if (rel > 8 && this._heatCooldown <= 0) {
            this._heatCooldown = POLICE.heatCrashCooldown;
            if (this.hooks.onHeat) this.hooks.onHeat(POLICE.heatRam);
            // Cruiser juga rusak kalau ditabrak keras.
            c.hp -= POLICE.cruiserRamDamage;
            if (c.hp <= 0 && !c.disabled) {
              c.disabled = true;
              c.speed = 0;
              c.disableTimer = 20;
            }
          }
        }
      }
    }
  }

  _updateCop(dt, cop, ctx) {
    const px = ctx.playerX;
    const pz = ctx.playerZ;
    const dx = px - cop.pos.x;
    const dz = pz - cop.pos.z;
    const d = Math.hypot(dx, dz);
    cop.heading = turnToward(cop.heading, Math.atan2(dx, dz), 6 * dt);
    cop.mesh.rotation.y = cop.heading;
    if (d > 2) {
      cop.pos.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.pos.z += Math.cos(cop.heading) * cop.speed * dt;
      resolveCircleVsBuildings(cop.pos, COP_RADIUS, this.buildingBoxes);
      clampToCity(cop.pos, 4);
    }
    // Animasi lari.
    cop.walkPhase += dt * cop.speed * 2.6;
    const s = Math.sin(cop.walkPhase) * 0.55;
    cop.legL.rotation.x = s;
    cop.legR.rotation.x = -s;
    // Menembak kalau dalam jangkauan dan pemain jalan kaki.
    if (ctx.mode === "onFoot" && d < POLICE.copShootRange) {
      if (this.hooks.onPlayerDamage) {
        this.hooks.onPlayerDamage(POLICE.copDamagePerSec * dt, "cop");
      }
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0) {
        cop.shootTimer = 0.5;
        if (this.hooks.effects) {
          this.hooks.effects.burst(cop.pos.x, 1.4, cop.pos.z, {
            count: 3,
            color: 0xffe08a,
            speed: 2,
            up: 1,
            life: 0.15,
            gravity: 0,
          });
        }
      }
    }
  }

  _updateArrest(dt, ctx) {
    const px = ctx.playerX;
    const pz = ctx.playerZ;
    let arresting = false;

    if (ctx.mode === "onFoot") {
      // Polisi jalan kaki sangat dekat.
      for (const cop of this.cops) {
        if (cop.down) continue;
        if (Math.hypot(cop.pos.x - px, cop.pos.z - pz) < POLICE.arrestRange) {
          arresting = true;
          break;
        }
      }
      // Cruiser berhenti menahan pemain jalan kaki (bintang >= 3).
      if (!arresting && ctx.wanted.stars >= 3) {
        for (const c of this.cruisers) {
          if (c.disabled) continue;
          if (
            Math.hypot(c.pos.x - px, c.pos.z - pz) < POLICE.cruiserArrestRange &&
            Math.abs(c.speed) < 2
          ) {
            arresting = true;
            break;
          }
        }
      }
      if (arresting) {
        this.arrestProgress += dt / POLICE.arrestTime;
      } else {
        this.arrestProgress = Math.max(0, this.arrestProgress - dt * 0.5);
      }
      if (this.arrestProgress >= 1 && this.hooks.onBusted) {
        this.arrestProgress = 0;
        this.hooks.onBusted("Ditangkap polisi");
      }
      // Cruiser menembak pemain jalan kaki dari jarak menengah.
      if (ctx.wanted.stars >= 3 && this.hooks.onPlayerDamage) {
        for (const c of this.cruisers) {
          if (c.disabled) continue;
          const d = Math.hypot(c.pos.x - px, c.pos.z - pz);
          if (d < POLICE.cruiserShootRange && d > 6) {
            this.hooks.onPlayerDamage(POLICE.cruiserDamagePerSec * dt, "cruiser");
            break;
          }
        }
      }
      this.surroundedTimer = 0;
    } else {
      // Mengemudi: mobil berhenti dikepung >= 2 cruiser.
      this.arrestProgress = 0;
      const car = ctx.playerCar;
      if (car && Math.abs(car.speed) < 1) {
        let near = 0;
        for (const c of this.cruisers) {
          if (c.disabled) continue;
          if (Math.hypot(c.pos.x - px, c.pos.z - pz) < POLICE.surroundedRange) near++;
        }
        if (near >= 2) {
          this.surroundedTimer += dt;
          if (this.surroundedTimer >= POLICE.surroundedTime && this.hooks.onBusted) {
            this.surroundedTimer = 0;
            this.hooks.onBusted("Dikepung polisi");
          }
        } else {
          this.surroundedTimer = 0;
        }
      } else {
        this.surroundedTimer = 0;
      }
    }
  }
}
