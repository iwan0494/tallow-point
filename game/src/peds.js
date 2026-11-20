// peds.js — 22 pedestrians strolling the sidewalks. They walk a leg, wait,
// then pick a new direction; when a car comes close they step aside.
// Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  var SHIRTS = [0xc04040, 0x40a040, 0x4080c0, 0xd8a020, 0x8040a0, 0xe0e0e0, 0x303030];

  function createPeds(scene, city, rng) {
    var peds = [];
    var graph = city.graph;

    for (var i = 0; i < 22; i++) {
      var n = graph.nodes[rng.int(0, graph.nodes.length - 1)];
      var g = new THREE.Group();
      var shirt = new THREE.MeshStandardMaterial({
        color: SHIRTS[i % SHIRTS.length], roughness: 0.8,
      });
      var skin = new THREE.MeshStandardMaterial({ color: 0xd8a075, roughness: 0.8 });
      var torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.35), shirt);
      torso.position.y = 1.0; torso.castShadow = true;
      var head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
      head.position.y = 1.6; head.castShadow = true;
      var legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.26),
        new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.9 }));
      legL.position.set(-0.15, 0.3, 0);
      var legR = legL.clone();
      legR.position.x = 0.15;
      g.add(torso); g.add(head); g.add(legL); g.add(legR);
      g.position.set(n.x + rng.range(-4, 4), 0, n.z + rng.range(-4, 4));
      scene.add(g);
      peds.push({
        mesh: g, legL: legL, legR: legR,
        pos: new THREE.Vector3(g.position.x, 0, g.position.z),
        heading: rng.range(0, Math.PI * 2),
        speed: rng.range(0.8, 1.6),
        wait: rng.range(0, 3),
        phase: rng.range(0, 6),
      });
    }

    function update(dt, cars) {
      peds.forEach(function (p) {
        // Waiting: stand still, legs settle. The wait timer counts down
        // and only then does the ped walk again (no stuck else-branch).
        if (p.wait > 0) {
          p.wait -= dt;
          p.legL.rotation.x = 0;
          p.legR.rotation.x = 0;
          return;
        }
        // Step aside if a car is close and approaching.
        var dodge = false;
        for (var i = 0; i < cars.length; i++) {
          var c = cars[i];
          if (TP.Physics.dist2(p.pos.x, p.pos.z, c.pos.x, c.pos.z) < 36) {
            p.heading = Math.atan2(p.pos.x - c.pos.x, p.pos.z - c.pos.z);
            dodge = true;
            break;
          }
        }
        if (!dodge && Math.random() < dt * 0.08) {
          p.heading += (Math.random() - 0.5) * 1.2;
        }
        p.pos.x += Math.sin(p.heading) * p.speed * dt;
        p.pos.z += Math.cos(p.heading) * p.speed * dt;
        // Keep peds inside the city.
        var lim = city.graph.half + 20;
        if (Math.abs(p.pos.x) > lim || Math.abs(p.pos.z) > lim) {
          p.heading += Math.PI;
          p.pos.x = TP.Physics.clamp(p.pos.x, -lim, lim);
          p.pos.z = TP.Physics.clamp(p.pos.z, -lim, lim);
        }
        if (Math.random() < dt * 0.05) p.wait = rng.range(1, 4);
        p.phase += dt * p.speed * 4;
        p.legL.rotation.x = Math.sin(p.phase) * 0.45;
        p.legR.rotation.x = -Math.sin(p.phase) * 0.45;
        p.mesh.position.copy(p.pos);
        p.mesh.rotation.y = p.heading;
      });
    }

    return { peds: peds, update: update };
  }

  TP.Peds = { create: createPeds };
})(window.TP);
