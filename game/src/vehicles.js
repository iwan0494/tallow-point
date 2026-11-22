// Vehicle factories: the gold hero Comet GT, traffic cars, police cruisers with
// glowing light bars, and the police helicopter with a spinning rotor and a
// searchlight cone. All built from boxes, cylinders and spheres — no assets.

export function makeCar(color, opts = {}) {
  const THREE = window.THREE;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color, roughness: opts.rough ?? 0.38, metalness: opts.metal ?? 0.45,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x18222e, roughness: 0.12, metalness: 0.9,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.15, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 1.1), bodyMat);
  hood.position.set(0, 0.92, 1.55);
  g.add(hood);
  // Headlights (warm emissive) and taillights (red emissive).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  for (const sx of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
    h.position.set(sx, 0.68, 2.22);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tailMat);
    t.position.set(sx, 0.68, -2.22);
    g.add(t);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c8, roughness: 0.3, metalness: 0.8 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, wheelMat);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    wheel.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    wheel.position.set(wx, 0.36, wz);
    g.add(wheel);
    wheels.push(wheel);
  }
  if (opts.police) {
    // White doors + black hood/trunk read as a cruiser at a glance.
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.4 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.4, 1.6), doorMat);
    door.position.set(0, 0.66, 0.1);
    g.add(door);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.1, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x1a4fd6 }));
    stripe.position.set(0, 0.62, 0.1);
    g.add(stripe);
    // Light bar: red left, blue right, emissive so it glows in the frame.
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.16, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 }));
    bar.position.set(0, 1.5, -0.25);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.44),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.32, 1.6, -0.25);
    red.name = 'lightRed';
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.44),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.set(0.32, 1.6, -0.25);
    blue.name = 'lightBlue';
    g.add(blue);
  }
  g.userData.wheels = wheels;
  return g;
}

export function makeHeli() {
  const THREE = window.THREE;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x6a93b8, roughness: 0.4, metalness: 0.5,
    emissive: 0x1e3040, emissiveIntensity: 0.5,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.0, 5.2), bodyMat);
  body.position.y = 0;
  body.castShadow = true;
  g.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x9fd4f2, roughness: 0.1, metalness: 0.8 }));
  glass.position.set(0, 0.3, 2.2);
  g.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5.0), bodyMat);
  tail.position.set(0, 0.3, -4.6);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.6, 1.0), bodyMat);
  fin.position.set(0, 1.0, -6.8);
  g.add(fin);
  // Skids.
  for (const sx of [-1.0, 1.0]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.5 }));
    skid.position.set(sx, -1.35, 0.4);
    g.add(skid);
  }
  // Main rotor: two long blades + a blurred disc for motion.
  const rotor = new THREE.Group();
  rotor.position.y = 1.35;
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.55), bladeMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  g.add(rotor);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.4, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 1.38;
  g.add(disc);
  // Searchlight cone + bright lamp, aimed down-forward.
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.8, 16, 20, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xfff6c9, transparent: true, opacity: 0.30, side: THREE.DoubleSide, depthWrite: false,
    }));
  cone.position.set(0, -8.5, 4);
  cone.rotation.x = 0.35;
  cone.name = 'spotCone';
  g.add(cone);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfffbe0 }));
  lamp.position.set(0, -1.1, 1.6);
  g.add(lamp);
  // "TALLOW PD" belly marking: a white band.
  const band = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.5, 2.0),
    new THREE.MeshBasicMaterial({ color: 0xf2f2f2 }));
  band.position.set(0, -0.4, 0.4);
  g.add(band);
  // Red / blue police beacons under the belly so the heli reads as AIR-1.
  const beaconRed = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  beaconRed.position.set(-0.9, -1.05, 0.5);
  g.add(beaconRed);
  const beaconBlue = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x2244ff }));
  beaconBlue.position.set(0.9, -1.05, 0.5);
  g.add(beaconBlue);
  g.userData.rotor = rotor;
  g.userData.cone = cone;
  return g;
}

/** A simple standing person: capsule body, head, coloured shirt. */
export function makePed(shirtColor, skinColor) {
  const THREE = window.THREE;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.85, 4, 8),
    new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 }));
  body.position.y = 0.95;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshStandardMaterial({ color: skinColor || 0xc98d64, roughness: 0.7 }));
  head.position.y = 1.78;
  head.castShadow = true;
  g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.9 }));
  legs.position.y = 0.28;
  g.add(legs);
  // Arms, slightly out — beachgoers and fleeing peds read as alive.
  for (const sx of [-0.42, 0.42]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 6),
      new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 }));
    arm.position.set(sx, 1.15, 0);
    arm.rotation.z = sx > 0 ? -0.5 : 0.5;
    g.add(arm);
  }
  g.userData.body = body;
  return g;
}
