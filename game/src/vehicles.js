// vehicles.js — car factory: six types (coupe, sedan, taxi, van, truck,
// Comet) built from boxes + cylinder wheels, with headlights, taillights
// and police strobes. One shared shape language, different paint, size and
// speed. Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  var TYPES = {
    coupe: { color: 0xc02028, len: 4.4, wid: 1.9, top: 42, accel: 22, label: 'Coupe' },
    sedan: { color: 0x3a5a8a, len: 4.6, wid: 1.9, top: 34, accel: 16, label: 'Sedan' },
    taxi:  { color: 0xe8b820, len: 4.6, wid: 1.9, top: 34, accel: 16, label: 'Taxi' },
    van:   { color: 0x8a8a92, len: 5.2, wid: 2.1, top: 30, accel: 13, label: 'Van' },
    truck: { color: 0x5a6b52, len: 6.2, wid: 2.3, top: 28, accel: 11, label: 'Truck' },
    comet: { color: 0xd8a020, len: 4.3, wid: 1.9, top: 48, accel: 26, label: 'Comet' },
  };

  function buildCarMesh(type, opts) {
    var t = TYPES[type] || TYPES.sedan;
    var g = new THREE.Group();
    var paint = new THREE.MeshStandardMaterial({
      color: (opts && opts.color) || t.color,
      roughness: 0.35, metalness: 0.55,
    });
    var glass = new THREE.MeshStandardMaterial({
      color: 0x182028, roughness: 0.15, metalness: 0.8,
    });
    var dark = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });

    var body = new THREE.Mesh(new THREE.BoxGeometry(t.wid, 0.75, t.len), paint);
    body.position.y = 0.65; body.castShadow = true;
    g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(t.wid * 0.85, 0.6, t.len * 0.45), glass);
    cabin.position.set(0, 1.3, -t.len * 0.05); cabin.castShadow = true;
    g.add(cabin);

    // Wheels.
    var wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    var spots = [
      [-t.wid / 2, t.len * 0.32], [t.wid / 2, t.len * 0.32],
      [-t.wid / 2, -t.len * 0.32], [t.wid / 2, -t.len * 0.32],
    ];
    spots.forEach(function (s) {
      var w = new THREE.Mesh(wheelGeo, dark);
      w.position.set(s[0], 0.38, s[1]);
      w.castShadow = true;
      g.add(w);
    });

    // Headlights (warm) + taillights (red).
    var headMat = new THREE.MeshStandardMaterial({
      color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.6,
    });
    var tailMat = new THREE.MeshStandardMaterial({
      color: 0xaa1010, emissive: 0xcc1818, emissiveIntensity: 1.2,
    });
    [-1, 1].forEach(function (s) {
      var h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), headMat);
      h.position.set(s * (t.wid / 2 - 0.35), 0.7, t.len / 2);
      g.add(h);
      var tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), tailMat);
      tl.position.set(s * (t.wid / 2 - 0.35), 0.7, -t.len / 2);
      g.add(tl);
    });

    // Police strobes (red/blue) when this car is a cruiser.
    var strobes = null;
    if (opts && opts.police) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.5), dark);
      bar.position.set(0, 1.68, -0.1);
      g.add(bar);
      var red = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.18, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xcc1010, emissive: 0xff2020, emissiveIntensity: 2 })
      );
      red.position.set(-0.28, 1.68, -0.1);
      var blue = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.18, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x1020cc, emissive: 0x2040ff, emissiveIntensity: 2 })
      );
      blue.position.set(0.28, 1.68, -0.1);
      g.add(red); g.add(blue);
      strobes = { red: red, blue: blue, phase: 0 };
    }

    return { group: g, type: t, strobes: strobes };
  }

  // A drivable / traffic car: position, heading, speed, mesh.
  function makeCar(scene, type, x, z, heading, opts) {
    var built = buildCarMesh(type, opts);
    built.group.position.set(x, 0, z);
    built.group.rotation.y = heading || 0;
    scene.add(built.group);
    var car = {
      mesh: built.group,
      strobes: built.strobes,
      type: type,
      spec: TYPES[type] || TYPES.sedan,
      pos: new THREE.Vector3(x, 0, z),
      heading: heading || 0,
      speed: 0,
      parked: !!(opts && opts.parked),
      police: !!(opts && opts.police),
      gold: !!(opts && opts.gold),
      _gold: !!(opts && opts.gold),
      node: -1,          // road-graph node for traffic AI
      targetNode: -1,
      wait: 0,
    };
    return car;
  }

  function syncCar(car) {
    car.mesh.position.set(car.pos.x, 0, car.pos.z);
    car.mesh.rotation.y = car.heading;
    if (car.strobes) {
      car.strobes.phase += 0.35;
      var on = Math.sin(car.strobes.phase) > 0;
      car.strobes.red.material.emissiveIntensity = on ? 3 : 0.3;
      car.strobes.blue.material.emissiveIntensity = on ? 0.3 : 3;
    }
  }

  TP.Vehicles = { makeCar: makeCar, syncCar: syncCar, TYPES: TYPES };
})(window.TP);
