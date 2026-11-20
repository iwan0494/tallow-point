// police.js — wanted 1-5, cruiser pursuit AI, roadblocks, helicopter,
// BUSTED. Heat rises on crimes and decays when hidden; cruisers chase on
// the road graph and switch to direct pursuit up close; roadblocks appear
// at 3+ stars; the helicopter joins at 4-5 stars and hovers ahead of the
// player so it stays in frame. Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  function createPolice(scene, city, rng) {
    var graph = city.graph;
    var cruisers = [];
    var barriers = [];      // roadblock barrier meshes (separate from cars)
    var blockCars = [];     // roadblock cars (separate from cruisers)
    var heli = null;
    var heliLight = null;
    var wanted = 0;
    var heat = 0;
    var bustedTimer = 0;

    // Helicopter: body + rotor + a spotlight cone that sweeps the road.
    function makeHeli() {
      var g = new THREE.Group();
      var bodyMat = new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.4, metalness: 0.6 });
      var body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5.2), bodyMat);
      body.castShadow = true;
      g.add(body);
      var tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4), bodyMat);
      tail.position.set(0, 0.2, -4.2);
      g.add(tail);
      var rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), bodyMat);
      rotor.position.y = 1.1;
      g.add(rotor);
      var glass = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.8, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x182028, roughness: 0.15, metalness: 0.8 })
      );
      glass.position.set(0, 0.2, 2.0);
      g.add(glass);
      var spot = new THREE.SpotLight(0xfff2c0, 60, 90, 0.35, 0.4, 1.2);
      spot.position.set(0, -0.8, 1);
      var tgt = new THREE.Object3D();
      tgt.position.set(0, -22, 0);
      g.add(tgt);
      spot.target = tgt;
      g.add(spot);
      scene.add(g);
      return { group: g, rotor: rotor, spot: spot, target: tgt };
    }

    function spawnCruiser(px, pz) {
      var angle = rng.range(0, Math.PI * 2);
      var d = rng.range(45, 70);
      var car = TP.Vehicles.makeCar(
        scene, 'sedan', px + Math.sin(angle) * d, pz + Math.cos(angle) * d,
        rng.range(0, Math.PI * 2), { police: true }
      );
      // Cruisers start at speed 25 (not 0) so they keep up with a 42 m/s
      // coupe instead of falling behind the camera frustum.
      car.speed = 25;
      car.node = TP.Traffic.nearestNode(graph, car.pos.x, car.pos.z);
      cruisers.push(car);
      return car;
    }

    function desiredCruisers() {
      if (wanted <= 0) return 0;
      return Math.min(2 + wanted, 7);
    }

    function clearRoadblocks() {
      // Barriers and roadblock cars are tracked separately from cruisers:
      // an earlier build removed cruiser meshes here by mistake.
      barriers.forEach(function (b) { scene.remove(b); });
      blockCars.forEach(function (c) { scene.remove(c.mesh); });
      barriers = [];
      blockCars = [];
    }

    function makeRoadblock(px, pz, heading) {
      clearRoadblocks();
      var ahead = 70; // 70 m ahead (was 42): the player can react, and the
      // car does not stop dead inside the block in screenshots.
      var bx = px + Math.sin(heading) * ahead;
      var bz = pz + Math.cos(heading) * ahead;
      var pxn = Math.cos(heading), pzn = -Math.sin(heading);
      for (var i = -1; i <= 1; i++) {
        var car = TP.Vehicles.makeCar(
          scene, 'sedan', bx + pxn * i * 5, bz + pzn * i * 5,
          heading + Math.PI / 2, { police: true }
        );
        blockCars.push(car);
      }
      var barMat = new THREE.MeshStandardMaterial({
        color: 0xe86a10, emissive: 0xe86a10, emissiveIntensity: 0.7,
      });
      for (var j = -1; j <= 1; j++) {
        var bar = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1, 0.5), barMat);
        bar.position.set(bx + pxn * j * 5, 0.5, bz + pzn * j * 5);
        bar.rotation.y = heading;
        bar.castShadow = true;
        scene.add(bar);
        barriers.push(bar);
      }
    }

    function update(dt, playerPos, playerHeading, driving, carSpeed) {
      // Heat decays slowly when the player hides; wanted follows heat.
      heat = Math.max(0, heat - 1.0 * dt);
      var target = heat < 1 ? 0 : heat < 25 ? 1 : heat < 50 ? 2 : heat < 80 ? 3 : heat < 120 ? 4 : 5;
      if (target !== wanted) {
        wanted = target;
        if (wanted >= 3 && barriers.length === 0) {
          makeRoadblock(playerPos.x, playerPos.z, playerHeading);
        }
        if (wanted < 3) clearRoadblocks();
      }

      // Keep the right number of cruisers.
      var want = desiredCruisers();
      while (cruisers.length < want) spawnCruiser(playerPos.x, playerPos.z);
      while (cruisers.length > want) {
        var gone = cruisers.pop();
        scene.remove(gone.mesh);
      }

      // Cruiser AI: follow the graph far away, direct pursuit up close.
      cruisers.forEach(function (car) {
        var dx = playerPos.x - car.pos.x, dz = playerPos.z - car.pos.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        var maxSpd = 46; // faster than the coupe (42) so chases stay close
        if (d < 55) {
          // Direct pursuit: steer at the player, accelerate hard.
          var wantH = Math.atan2(dx, dz);
          var diff = wantH - car.heading;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          car.heading += TP.Physics.clamp(diff, -2.2 * dt, 2.2 * dt);
          car.speed = Math.min(car.speed + 26 * dt, maxSpd);
        } else {
          // Graph pursuit: drive to the player's nearest node.
          var node = TP.Traffic.nearestNode(graph, playerPos.x, playerPos.z);
          var nd = graph.nodes[node];
          var gx = nd.x - car.pos.x, gz = nd.z - car.pos.z;
          var gd = Math.sqrt(gx * gx + gz * gz);
          if (gd > 4) {
            var wh = Math.atan2(gx, gz);
            var df = wh - car.heading;
            while (df > Math.PI) df -= Math.PI * 2;
            while (df < -Math.PI) df += Math.PI * 2;
            car.heading += TP.Physics.clamp(df, -1.8 * dt, 1.8 * dt);
            car.speed = Math.min(car.speed + 18 * dt, 34);
          }
        }
        car.pos.x += Math.sin(car.heading) * car.speed * dt;
        car.pos.z += Math.cos(car.heading) * car.speed * dt;
        TP.Physics.collideCircle(car.pos, 1.4, city.colliders);
        TP.Vehicles.syncCar(car);

        // BUSTED: a cruiser catches the player on foot at 3+ stars.
        if (!driving && wanted >= 3 && d < 4) bustedTimer += dt;
        else bustedTimer = Math.max(0, bustedTimer - dt);
      });

      // Helicopter at 4-5 stars: hovers 50 m ahead of the player, 22 m up,
      // so it stays inside the camera frame (not directly overhead).
      if (wanted >= 4) {
        if (!heli) heli = makeHeli();
        var hx = playerPos.x + Math.sin(playerHeading) * 50;
        var hz = playerPos.z + Math.cos(playerHeading) * 50;
        var k = 1 - Math.exp(-2.0 * dt);
        heli.group.position.x += (hx - heli.group.position.x) * k;
        heli.group.position.z += (hz - heli.group.position.z) * k;
        heli.group.position.y += (22 - heli.group.position.y) * k;
        heli.group.rotation.y = playerHeading;
        heli.rotor.rotation.y += dt * 22;
      } else if (heli) {
        scene.remove(heli.group);
        heli = null;
      }

      return { wanted: wanted, busted: bustedTimer > 1.2, cruisers: cruisers.length };
    }

    function addHeat(amount) { heat = Math.min(heat + amount, 150); }

    // Set the wanted level by heat only; update() drives the transition
    // (and spawns the roadblock at 3+ stars). Setting `wanted` directly
    // would skip the transition and no roadblock would ever appear.
    function setWanted(n) {
      heat = n <= 0 ? 0 : n === 1 ? 10 : n === 2 ? 30 : n === 3 ? 60 : n === 4 ? 100 : 130;
    }
    function clearAll() {
      cruisers.forEach(function (c) { scene.remove(c.mesh); });
      cruisers = [];
      clearRoadblocks();
      if (heli) { scene.remove(heli.group); heli = null; }
      wanted = 0; heat = 0; bustedTimer = 0;
    }

    return {
      update: update, addHeat: addHeat, setWanted: setWanted, clearAll: clearAll,
      get wanted() { return wanted; },
      get heat() { return heat; },
      get cruisers() { return cruisers; },
      get heliActive() { return !!heli; },
    };
  }

  TP.Police = { create: createPolice };
})(window.TP);
