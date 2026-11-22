// Tallow Point city: a 7x7 block grid with five districts that look different,
// a beach and sea on the west edge, a harbour on the east, roads with lane marks
// and zebra crossings, street props, a sun disc, clouds and a distant skyline.
// Everything is built from boxes and cylinders — no external assets.

import { BLOCK, ROAD, PITCH, GRID, BLOCKS, BLOCK_CENTERS, HALF, ROADS, DISTRICTS, districtAt } from './config.js';

export function buildCity(scene, rng) {
  const THREE = window.THREE;
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  const mats = new Map();
  function mat(color, rough, metal) {
    const key = `${color}|${rough}|${metal}`;
    if (!mats.has(key)) {
      mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough ?? 0.85, metalness: metal ?? 0.05 }));
    }
    return mats.get(key);
  }
  function box(w, h, d, color, x, y, z, opts) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts?.material || mat(color, opts?.rough, opts?.metal));
    m.position.set(x, y, z);
    if (opts?.rotY) m.rotation.y = opts.rotY;
    m.castShadow = !!opts?.cast;
    m.receiveShadow = true;
    (opts?.parent || group).add(m);
    return m;
  }

  // --- Ground: asphalt city slab, sand beach, blue sea ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 16, HALF * 2 + 16),
    new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const sand = new THREE.Mesh(new THREE.PlaneGeometry(86, HALF * 2 + 16),
    new THREE.MeshStandardMaterial({ color: 0xe8d29a, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-HALF - 8 - 43, 0.02, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(180, HALF * 2 + 200),
    new THREE.MeshStandardMaterial({ color: 0x1f7fb8, roughness: 0.25, metalness: 0.35 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-HALF - 8 - 86 - 90, 0.05, 0);
  group.add(sea);

  // Marina water strip on the east edge.
  const marina = new THREE.Mesh(new THREE.PlaneGeometry(60, HALF * 2 + 16),
    new THREE.MeshStandardMaterial({ color: 0x2a6d9e, roughness: 0.3, metalness: 0.3 }));
  marina.rotation.x = -Math.PI / 2;
  marina.position.set(HALF + 8 + 30, 0.04, 0);
  group.add(marina);

  // --- Roads: darker strips with centre dashes and zebra crossings ---
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2c2c31, roughness: 0.95 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5c542 });
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
  for (const r of ROADS) {
    const ns = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, HALF * 2 + 16), roadMat);
    ns.rotation.x = -Math.PI / 2;
    ns.position.set(r, 0.06, 0);
    ns.receiveShadow = true;
    group.add(ns);
    const ew = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 16, ROAD), roadMat);
    ew.rotation.x = -Math.PI / 2;
    ew.position.set(0, 0.06, r);
    ew.receiveShadow = true;
    group.add(ew);
    // Centre dashes along both directions.
    for (let t = -HALF; t <= HALF; t += 12) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), dashMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(r, 0.09, t);
      group.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), dashMat);
      d2.rotation.x = -Math.PI / 2;
      d2.position.set(t, 0.09, r);
      group.add(d2);
    }
  }
  // Zebra crossings at the central intersections.
  for (const rx of [-52, 0, 52]) {
    for (const rz of [-52, 0, 52]) {
      for (let i = -2; i <= 2; i += 1) {
        const z1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 4.5), zebraMat);
        z1.rotation.x = -Math.PI / 2;
        z1.position.set(rx + i * 2.2, 0.09, rz + 8);
        group.add(z1);
      }
    }
  }

  // --- Buildings: one or two per block, palette + height per district ---
  // Lit window bands (warm in golden hour, cyan in Neon Mile).
  const windowMats = [];
  function litWindows(color, emissive) {
    const m = new THREE.MeshStandardMaterial({
      color, roughness: 0.4, metalness: 0.3, emissive, emissiveIntensity: 0.9,
    });
    windowMats.push(m);
    return m;
  }

  for (let col = 0; col < BLOCKS; col += 1) {
    for (let row = 0; row < BLOCKS; row += 1) {
      const d = districtAt(col, row);
      const bx = BLOCK_CENTERS[col];
      const bz = BLOCK_CENTERS[row];
      // Central plaza: the four middle blocks are one open square with a
      // fountain, where the two main roads cross.
      if (col >= 2 && col <= 3 && row >= 2 && row <= 3) {
        if (col === 2 && row === 2) {
          const plaza = new THREE.Mesh(new THREE.PlaneGeometry(84, 84),
            new THREE.MeshStandardMaterial({ color: 0x9a8f7a, roughness: 0.9 }));
          plaza.rotation.x = -Math.PI / 2;
          plaza.position.set(0, 0.07, 0);
          plaza.receiveShadow = true;
          group.add(plaza);
          const fountain = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 1.2, 12),
            mat(0x7fb8c9, 0.3, 0.1));
          fountain.position.set(14, 0.6, 14);
          fountain.castShadow = true;
          group.add(fountain);
          colliders.push({ minX: 9, maxX: 19, minZ: 9, maxZ: 19 });
        }
        continue;
      }
      const twins = rng.chance(0.45);
      const spots = twins ? [[-8, -6], [9, 8]] : [[0, 0]];
      for (const [ox, oz] of spots) {
        const w = twins ? 16 + rng.range(0, 5) : 26 + rng.range(0, 8);
        const dep = twins ? 14 + rng.range(0, 5) : 24 + rng.range(0, 8);
        const h = rng.range(d.height[0], d.height[1]);
        const color = rng.pick(d.palette);
        const x = bx + ox;
        const z = bz + oz;
        const b = box(w, h, dep, color, x, h / 2, z, { cast: true });
        colliders.push({ minX: x - w / 2 - 0.4, maxX: x + w / 2 + 0.4, minZ: z - dep / 2 - 0.4, maxZ: z + dep / 2 + 0.4 });
        // Lit window band near the top — warm in golden hour, cyan in Neon Mile.
        const winColor = d.id === 'neon' ? 0x7fe8ff : 0xffe9a8;
        const winEmissive = d.id === 'neon' ? 0x1a5a66 : 0x664411;
        const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, Math.max(1.2, h * 0.12), 0.3),
          litWindows(winColor, winEmissive));
        band.position.set(x, h * 0.78, z + dep / 2 + 0.16);
        group.add(band);
        const band2 = band.clone();
        band2.position.set(x, h * 0.78, z - dep / 2 - 0.16);
        group.add(band2);
        // Roof box / AC unit.
        if (rng.chance(0.6)) box(w * 0.3, 1.4, dep * 0.3, 0x555560, x + w * 0.2, h + 0.7, z, {});
        // District prop on the roof or beside the building.
        if (d.prop === 'neon' && rng.chance(0.55)) {
          const neon = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.1, 0.4),
            new THREE.MeshBasicMaterial({ color: rng.pick([0xff2fa0, 0x22d3ee, 0xffc21a]) }));
          neon.position.set(x, h * 0.45, z + dep / 2 + 0.25);
          group.add(neon);
        }
        if (d.prop === 'smoke' && rng.chance(0.4)) {
          const chimney = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, h * 0.55, 8),
            mat(0x5a4a42, 0.9));
          chimney.position.set(x + w * 0.3, h * 0.27 + h * 0.5, z - dep * 0.3);
          chimney.castShadow = true;
          group.add(chimney);
        }
        if (d.prop === 'container' && rng.chance(0.6)) {
          // Keep containers inside the block so they never land on a road.
          const cColor = rng.pick([0xb46bff, 0x2fae8f, 0xe05a2b, 0x35c8ff]);
          box(7, 2.6, 2.6, cColor, bx + 11, 1.3, bz + 9, { cast: true, rotY: rng.range(-0.3, 0.3) });
        }
      }
      // Street props per district, at the block corners.
      if (d.prop === 'palm') {
        for (const [px, pz] of [[-16, -16], [16, 16], [-16, 16]]) {
          makePalm(group, bx + px, bz + pz);
        }
      }
      if (d.prop === 'crane' && rng.chance(0.7)) {
        makeCrane(group, bx + 14, bz - 14);
      }
    }
  }

  // Palms along the beach front.
  for (let z = -160; z <= 160; z += 26) {
    makePalm(group, -HALF - 22, z + rng.range(-4, 4));
    if (rng.chance(0.5)) makePalm(group, -HALF - 34, z + 12);
  }
  // Beach umbrellas + towels.
  for (let i = 0; i < 8; i += 1) {
    const z = rng.range(-150, 150);
    const x = rng.range(-HALF - 55, -HALF - 25);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), mat(0xdddddd, 0.6));
    pole.position.set(x, 1.2, z);
    group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1, 8),
      mat(rng.pick([0xff5a5a, 0x35c8ff, 0xffc21a, 0x2fae8f]), 0.7));
    top.position.set(x, 2.6, z);
    group.add(top);
  }

  // --- Street lamps + hydrants along the main roads ---
  for (const r of [-104, 0, 104]) {
    for (let t = -156; t <= 156; t += 52) {
      makeLamp(group, r + 7.5, t);
      makeLamp(group, -7.5, r === 0 ? t : r);
      if (rng.chance(0.4)) {
        const hyd = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 8), mat(0xd23c2e, 0.5, 0.3));
        hyd.position.set(r - 7.5, 0.45, t + 10);
        hyd.castShadow = true;
        group.add(hyd);
      }
    }
  }

  // --- Sky: sun disc, clouds, distant skyline silhouettes ---
  const sky = new THREE.Group();
  sky.name = 'sky';
  scene.add(sky);
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(14, 32),
    new THREE.MeshBasicMaterial({ color: 0xffdf8a, fog: false, side: THREE.DoubleSide }));
  sunDisc.name = 'sunDisc';
  sky.add(sunDisc);
  const sunGlow = new THREE.Mesh(new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.35, fog: false, side: THREE.DoubleSide }));
  sunGlow.name = 'sunGlow';
  sky.add(sunGlow);
  const clouds = [];
  for (let i = 0; i < 14; i += 1) {
    const c = new THREE.Group();
    const n = 3 + rng.int(0, 3);
    for (let j = 0; j < n; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(4, 9), 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }));
      puff.position.set(j * rng.range(5, 8) - n * 3, rng.range(-1, 1.5), rng.range(-2, 2));
      puff.scale.y = 0.45;
      c.add(puff);
    }
    c.position.set(rng.range(-320, 320), rng.range(70, 130), rng.range(-320, 320));
    c.name = 'cloud';
    sky.add(c);
    clouds.push(c);
  }
  // Distant skyline ring, dark silhouettes so the horizon is never empty.
  for (let i = 0; i < 26; i += 1) {
    const a = (i / 26) * Math.PI * 2 + rng.range(-0.1, 0.1);
    const dist = rng.range(300, 380);
    const h = rng.range(30, 90);
    const w = rng.range(18, 40);
    const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, w),
      new THREE.MeshBasicMaterial({ color: 0x2a2038, fog: true }));
    s.position.set(Math.cos(a) * dist, h / 2 - 2, Math.sin(a) * dist);
    sky.add(s);
  }

  function makePalm(parent, x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 7, 6), mat(0x7a5a38, 0.9));
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = rng.range(-0.08, 0.08);
    trunk.castShadow = true;
    parent.add(trunk);
    for (let i = 0; i < 6; i += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), mat(0x2f9e5f, 0.8));
      const a = (i / 6) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.8, 7.2, z + Math.sin(a) * 1.8);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      parent.add(leaf);
    }
  }
  function makeLamp(parent, x, z) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), mat(0x2a2a2e, 0.6, 0.4));
    pole.position.set(x, 3.25, z);
    pole.castShadow = true;
    parent.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    head.position.set(x, 6.6, z);
    parent.add(head);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.12), mat(0x2a2a2e, 0.6, 0.4));
    arm.position.set(x - 0.8, 6.4, z);
    parent.add(arm);
  }
  function makeCrane(parent, x, z) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(2, 16, 2), mat(0xd8a13c, 0.6, 0.3));
    base.position.set(x, 8, z);
    base.castShadow = true;
    parent.add(base);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(22, 1.2, 1.2), mat(0xd8a13c, 0.6, 0.3));
    arm.position.set(x + 8, 15.5, z);
    arm.castShadow = true;
    parent.add(arm);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 4), mat(0x222222, 0.8));
    cable.position.set(x + 16, 12, z);
    parent.add(cable);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), mat(0x35c8ff, 0.6, 0.3));
    hook.position.set(x + 16, 8.5, z);
    parent.add(hook);
  }

  return { group, colliders, sky, sunDisc, sunGlow, clouds };
}
