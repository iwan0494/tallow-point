// Tallow Point — city.js
// Generasi kota 7x7 + graf jalan + mesh Three.js.
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-1).
// Deterministik: seed yang sama -> kota yang sama.

import { GAME, DISTRICTS, WORLD, GOLDEN_HOUR } from "./config.js";
import { makeRng } from "./random.js";

// ---- Koordinat dunia -------------------------------------------------------
// Garis tengah jalan ke-i (i = 0..7), dari barat (-X) ke timur dan utara (-Z)
// ke selatan. Blok ke-i (i = 0..6) berada di antara jalan i dan i+1.
export function roadLine(i) {
  return -GAME.halfCity + GAME.roadWidth / 2 + i * GAME.roadPitch;
}
export function blockCenter(i) {
  return -GAME.halfCity + GAME.roadWidth + GAME.blockSize / 2 + i * GAME.roadPitch;
}

// Distrik untuk satu blok (bx, bz), region half-open [x0,x1) x [z0,z1).
export function districtAt(bx, bz) {
  for (const d of DISTRICTS) {
    const r = d.region;
    if (bx >= r.x0 && bx < r.x1 && bz >= r.z0 && bz < r.z1) return d;
  }
  return DISTRICTS[3]; // fallback: Crater Row.
}

// ---- Generasi data kota (tanpa THREE) --------------------------------------
export function generateCity(seed) {
  const rng = makeRng(seed);

  // Graf jalan: 8x8 simpang, edge ke tetangga kanan/bawah.
  const nodes = [];
  const nodeId = (i, j) => j * (GAME.grid + 1) + i;
  for (let j = 0; j <= GAME.grid; j++) {
    for (let i = 0; i <= GAME.grid; i++) {
      nodes.push({ id: nodeId(i, j), i, j, x: roadLine(i), z: roadLine(j) });
    }
  }
  const edges = [];
  for (let j = 0; j <= GAME.grid; j++) {
    for (let i = 0; i <= GAME.grid; i++) {
      if (i < GAME.grid) edges.push({ a: nodeId(i, j), b: nodeId(i + 1, j) });
      if (j < GAME.grid) edges.push({ a: nodeId(i, j), b: nodeId(i, j + 1) });
    }
  }

  // Blok + bangunan.
  const blocks = [];
  const buildings = [];
  const safehouseBlock = { bx: 3, bz: 4 }; // Crater Row, dekat tengah-selatan.
  for (let bz = 0; bz < GAME.grid; bz++) {
    for (let bx = 0; bx < GAME.grid; bx++) {
      const district = districtAt(bx, bz);
      const cx = blockCenter(bx);
      const cz = blockCenter(bz);
      blocks.push({ bx, bz, district: district.id, x: cx, z: cz });
      const isSafehouse = bx === safehouseBlock.bx && bz === safehouseBlock.bz;
      // 1-4 bangunan per blok, tergantung jenis distrik.
      const count =
        district.id === "northline" ? rng.int(1, 2) : rng.int(2, 4);
      const slots = makeRng(seed + bx * 131 + bz * 17).shuffle([
        [-0.22, -0.22],
        [0.22, -0.22],
        [-0.22, 0.22],
        [0.22, 0.22],
      ]);
      for (let k = 0; k < count; k++) {
        const kind = rng.pick(district.kinds);
        const w = kind === "tower" ? rng.range(12, 16) : rng.range(8, 15);
        const d = kind === "tower" ? rng.range(12, 16) : rng.range(8, 15);
        const h = rng.range(district.height[0], district.height[1]);
        const x = cx + slots[k][0] * GAME.blockSize;
        const z = cz + slots[k][1] * GAME.blockSize;
        const color = rng.pick(district.palette);
        buildings.push({
          bx,
          bz,
          district: district.id,
          kind,
          x,
          z,
          w,
          d,
          h,
          color,
          roughness: district.roughness,
          rooftop: kind === "tower" || kind === "office" ? rng.chance(0.7) : false,
          safehouse: isSafehouse && k === 0,
        });
      }
    }
  }

  // Tempat parkir: beberapa titik di tepi jalan utama.
  const parking = [];
  const parkRng = makeRng(seed + 777);
  for (let n = 0; n < 12; n++) {
    const along = parkRng.pick([0, 1, 2, 3]); // jalan vertikal mana
    const j = parkRng.int(0, GAME.grid);
    const x = roadLine(2 + along) + (parkRng.chance(0.5) ? 1 : -1) * (GAME.roadWidth / 2 + 1.6);
    const z = roadLine(j) + parkRng.range(-14, 14);
    parking.push({ x, z, heading: parkRng.chance(0.5) ? 0 : Math.PI, color: parkRng.pick([0x3a6a8a, 0x8a3a3a, 0x5a5a5a, 0x7a6a3a, 0x2a4a3a]) });
  }

  // Lampu jalan: dua di tiap simpang (sudut diagonal).
  const lamps = [];
  for (let j = 0; j <= GAME.grid; j++) {
    for (let i = 0; i <= GAME.grid; i++) {
      const x = roadLine(i);
      const z = roadLine(j);
      lamps.push({ x: x + 5.4, z: z + 5.4 });
      lamps.push({ x: x - 5.4, z: z - 5.4 });
    }
  }

  const safehouse = buildings.find((b) => b.safehouse);
  return { nodes, edges, blocks, buildings, parking, lamps, safehouse, nodeId };
}

// Rute auto-drive R5-1: keliling blok tengah (bx=3, bz=3) lewat 4 simpangnya.
export function centerLoopWaypoints(city) {
  const ids = [
    city.nodeId(3, 3),
    city.nodeId(4, 3),
    city.nodeId(4, 4),
    city.nodeId(3, 4),
  ];
  return ids.map((id) => city.nodes[id]);
}

// ---- Tekstur fasad (canvas, tanpa network) ---------------------------------
// Jendela gelap + sebagian menyala hangat (sunset) — dipakai sebagai map dan
// emissiveMap supaya jendela yang menyala benar-benar bercahaya.
function makeFacadeTextures(kind, rng) {
  const W = 128;
  const H = 256;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = W;
  colorCanvas.height = H;
  const emissiveCanvas = document.createElement("canvas");
  emissiveCanvas.width = W;
  emissiveCanvas.height = H;
  const c = colorCanvas.getContext("2d");
  const e = emissiveCanvas.getContext("2d");
  c.fillStyle = "#8a8a8a"; // abu netral — diwarnai material.color.
  c.fillRect(0, 0, W, H);
  e.fillStyle = "#000000";
  e.fillRect(0, 0, W, H);
  const cols = kind === "warehouse" || kind === "house" ? 4 : 6;
  const rows = kind === "house" ? 3 : 10;
  const cw = W / cols;
  const ch = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cw + cw * 0.22;
      const y = r * ch + ch * 0.24;
      const w = cw * 0.56;
      const h = ch * 0.52;
      const lit = rng.chance(kind === "house" ? 0.35 : 0.28);
      if (lit) {
        c.fillStyle = "#ffd9a0";
        e.fillStyle = "#ffbe78";
      } else {
        c.fillStyle = "#2a2f38";
        e.fillStyle = "#000000";
      }
      c.fillRect(x, y, w, h);
      e.fillRect(x, y, w, h);
    }
  }
  return { colorCanvas, emissiveCanvas };
}

// ---- Mesh ------------------------------------------------------------------
export function buildCityMeshes(city, THREE) {
  const group = new THREE.Group();
  group.name = "city";
  const rng = makeRng(GAME.seed + 4242);

  // Tanah: aspal gelap besar, menerima bayangan.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GAME.halfCity * 2 + 240, GAME.halfCity * 2 + 240),
    new THREE.MeshStandardMaterial({ color: WORLD.groundAsphalt, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Marka jalan: garis kuning putus-putus di tengah tiap jalan (tekstur canvas).
  const dashCanvas = document.createElement("canvas");
  dashCanvas.width = 16;
  dashCanvas.height = 64;
  const dc = dashCanvas.getContext("2d");
  dc.fillStyle = "#000000";
  dc.fillRect(0, 0, 16, 64);
  dc.fillStyle = "#d8c96a";
  dc.fillRect(6, 4, 4, 32);
  const dashTex = new THREE.CanvasTexture(dashCanvas);
  dashTex.wrapS = THREE.RepeatWrapping;
  dashTex.wrapT = THREE.RepeatWrapping;
  const roadLen = GAME.halfCity * 2;
  const dashMat = new THREE.MeshBasicMaterial({ map: dashTex, transparent: true });
  for (let i = 0; i <= GAME.grid; i++) {
    for (const horizontal of [true, false]) {
      const tex = dashTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, Math.round(roadLen / 12));
      const mat = dashMat.clone();
      mat.map = tex;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.5, roadLen), mat);
      strip.rotation.x = -Math.PI / 2;
      if (horizontal) strip.rotation.z = Math.PI / 2;
      strip.position.set(
        horizontal ? 0 : roadLine(i),
        0.02,
        horizontal ? roadLine(i) : 0
      );
      group.add(strip);
    }
  }

  // Trotoar per blok: slab sedikit terangkat, warna hangat keabu-abuan.
  const sidewalkGeo = new THREE.BoxGeometry(GAME.blockSize + 2, 0.35, GAME.blockSize + 2);
  const sidewalkMat = new THREE.MeshStandardMaterial({ color: WORLD.sidewalk, roughness: 0.9 });
  for (const b of city.blocks) {
    const slab = new THREE.Mesh(sidewalkGeo, sidewalkMat);
    slab.position.set(b.x, 0.17, b.z);
    slab.receiveShadow = true;
    group.add(slab);
  }

  // Bangunan: kotak dengan tekstur fasad (jendela menyala) + rooftop untuk tower.
  const facadeCache = {};
  function facadeFor(kind) {
    if (!facadeCache[kind]) {
      const t = makeFacadeTextures(kind, makeRng(GAME.seed + kind.length * 97));
      const map = new THREE.CanvasTexture(t.colorCanvas);
      map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      const emissiveMap = new THREE.CanvasTexture(t.emissiveCanvas);
      emissiveMap.wrapS = THREE.RepeatWrapping;
      emissiveMap.wrapT = THREE.RepeatWrapping;
      facadeCache[kind] = { map, emissiveMap };
    }
    return facadeCache[kind];
  }
  const buildingBoxes = []; // AABB untuk spring-arm kamera (anti-clip).
  for (const b of city.buildings) {
    const { map, emissiveMap } = facadeFor(b.kind);
    const m = map.clone();
    m.needsUpdate = true;
    m.repeat.set(Math.max(1, Math.round(b.w / 9)), Math.max(1, Math.round(b.h / 9)));
    const em = emissiveMap.clone();
    em.needsUpdate = true;
    em.repeat.copy(m.repeat);
    const mat = new THREE.MeshStandardMaterial({
      color: b.safehouse ? WORLD.safehouseColor : b.color,
      roughness: b.roughness,
      metalness: b.kind === "tower" ? 0.45 : 0.05,
      map: m,
      emissiveMap: em,
      emissive: new THREE.Color(GOLDEN_HOUR.lampColor),
      emissiveIntensity: 0.85,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    mesh.position.set(b.x, b.h / 2 + 0.35, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `building-${b.district}-${b.kind}`;
    group.add(mesh);
    buildingBoxes.push({
      minX: b.x - b.w / 2,
      maxX: b.x + b.w / 2,
      minZ: b.z - b.d / 2,
      maxZ: b.z + b.d / 2,
      top: b.h + 0.35,
    });
    if (b.rooftop) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(b.w * 0.45, 2.2, b.d * 0.45),
        new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.9 })
      );
      roof.position.set(b.x, b.h + 0.35 + 1.1, b.z);
      roof.castShadow = true;
      group.add(roof);
    }
    if (b.safehouse) {
      // Papan kecil di safehouse supaya mudah dikenali. R5-4: diperkecil
      // (4x1 -> 2.2x0.55), dinaikkan (y 3.4 -> 4.6), diredupkan (1.6 -> 0.9)
      // supaya dari dekat tidak terlihat seperti persegi glitch.
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.55, 0.25),
        new THREE.MeshStandardMaterial({
          color: 0x111111,
          emissive: 0x66d9ff,
          emissiveIntensity: 0.9,
        })
      );
      sign.position.set(b.x, 4.6, b.z + b.d / 2 + 0.2);
      group.add(sign);
    }
  }

  // Lampu jalan: InstancedMesh tiang + kepala menyala.
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.2, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e1e22, roughness: 0.6, metalness: 0.6 });
  const headGeo = new THREE.BoxGeometry(0.7, 0.22, 0.3);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    emissive: GOLDEN_HOUR.lampColor,
    emissiveIntensity: GOLDEN_HOUR.lampEmissiveIntensity,
  });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, city.lamps.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, city.lamps.length);
  const dummy = new THREE.Object3D();
  city.lamps.forEach((lamp, idx) => {
    dummy.position.set(lamp.x, 2.6, lamp.z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(idx, dummy.matrix);
    dummy.position.set(lamp.x, 5.25, lamp.z);
    dummy.updateMatrix();
    heads.setMatrixAt(idx, dummy.matrix);
  });
  poles.castShadow = false;
  group.add(poles);
  group.add(heads);

  // Mobil parkir statis (R5-2: mesh dikembalikan supaya VehicleManager
  // bisa membungkusnya jadi Vehicle yang bisa dicuri).
  const parkingCars = [];
  for (const p of city.parking) {
    const car = makeCarMesh(p.color, THREE);
    car.position.set(p.x, 0, p.z);
    car.rotation.y = p.heading;
    group.add(car);
    parkingCars.push(car);
  }

  return { group, buildingBoxes, parkingCars };
}

// ---- Mobil (coupe) ----------------------------------------------------------
// Maju ke +Z saat rotation.y = 0. Dipakai untuk mobil pemain, parkir, lalu lintas.
export function makeCarMesh(color, THREE) {
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.32,
    metalness: 0.55,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x141c26,
    roughness: 0.12,
    metalness: 0.9,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), paint);
  body.position.y = 0.5;
  body.castShadow = true;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.0), glass);
  cabin.position.set(0, 1.0, -0.25);
  cabin.castShadow = true;
  car.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  for (const [x, z] of [[-0.88, 1.35], [0.88, 1.35], [-0.88, -1.35], [0.88, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.34, z);
    wheel.castShadow = true;
    car.add(wheel);
  }
  // Lampu depan menyala (sunset) + lampu belakang merah.
  const headMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    emissive: 0xfff2cc,
    emissiveIntensity: 2.4,
  });
  for (const x of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
    hl.position.set(x, 0.55, 2.12);
    car.add(hl);
  }
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x220000,
    emissive: 0xff2211,
    emissiveIntensity: 1.8,
  });
  for (const x of [-0.6, 0.6]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.08), tailMat);
    tl.position.set(x, 0.58, -2.12);
    car.add(tl);
  }
  return car;
}
