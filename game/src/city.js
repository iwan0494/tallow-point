// city.js — Tallow Point: 7x7 block grid, 5 districts, road graph, facades.
// Builds the ground, roads, buildings (canvas-texture facades), street lamps,
// parked-car slots and the safehouse. Exposes the road graph for traffic,
// police and missions. Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  var cfg = TP.Config;

  // Road graph: intersections on a 8x8 lattice (64 nodes). A node sits at each
  // crossing of the roads that run between blocks. Roads run along block edges.
  function buildGraph() {
    var step = cfg.block + cfg.road;
    var nodes = [];
    var half = (cfg.grid * step) / 2;
    for (var gy = 0; gy <= cfg.grid; gy++) {
      for (var gx = 0; gx <= cfg.grid; gx++) {
        nodes.push({ x: -half + gx * step, z: -half + gy * step, id: nodes.length });
      }
    }
    function nodeAt(gx, gy) { return nodes[gy * (cfg.grid + 1) + gx]; }
    var edges = [];
    for (var y = 0; y <= cfg.grid; y++) {
      for (var x = 0; x <= cfg.grid; x++) {
        if (x < cfg.grid) edges.push([nodeAt(x, y), nodeAt(x + 1, y)]);
        if (y < cfg.grid) edges.push([nodeAt(x, y), nodeAt(x, y + 1)]);
      }
    }
    return { nodes: nodes, edges: edges, step: step, half: half };
  }

  // Which district owns a block (row-major, 7x7). West = wharf, north = towers,
  // centre-north = apartments, centre = shops/safehouse, south = houses.
  function districtAt(bx, bz) {
    if (bx <= 1) return 0;                    // Kessel Wharf (west edge)
    if (bz <= 1) return 1;                    // Northline (north edge)
    if (bz <= 3) return 2;                    // Moraine Heights
    if (bz <= 4) return 3;                    // Crater Row (centre, safehouse)
    return 4;                                 // Sunmere (south)
  }

  // Canvas texture for a building facade: warm windows on a coloured wall.
  function facadeTexture(rng, base, accent) {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = '#' + base.toString(16).padStart(6, '0');
    g.fillRect(0, 0, 128, 256);
    g.fillStyle = '#' + accent.toString(16).padStart(6, '0');
    g.fillRect(0, 0, 128, 10);
    var cols = 4, rows = 8;
    for (var r = 0; r < rows; r++) {
      for (var col = 0; col < cols; col++) {
        var lit = rng.chance(0.55);
        g.fillStyle = lit ? '#ffd27a' : '#2a2438';
        g.fillRect(10 + col * 30, 22 + r * 28, 20, 16);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function buildCity(scene, rng) {
    var graph = buildGraph();
    var group = new THREE.Group();
    group.name = 'city';
    var colliders = [];   // {minX,maxX,minZ,maxZ} building footprints
    var buildings = [];

    // Ground slab: warm dark brown so roads read against it, but light
    // enough that golden-hour light still shows (a near-black ground
    // swallowed the road in the first screenshots).
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(graph.half * 2 + 120, graph.half * 2 + 120),
      new THREE.MeshStandardMaterial({ color: 0x4a4036, roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    group.add(ground);

    // Roads: asphalt strips along every grid line, with a pale centre line.
    // Kept mid-grey (not near-black) so the sun still models them.
    var roadMat = new THREE.MeshStandardMaterial({ color: 0x3d3a36, roughness: 0.9 });
    var lineMat = new THREE.MeshStandardMaterial({ color: 0xd8c98a, roughness: 0.8 });
    var span = graph.half * 2;
    for (var i = 0; i <= cfg.grid; i++) {
      var p = -graph.half + i * graph.step;
      var h = new THREE.Mesh(new THREE.BoxGeometry(span, 0.1, cfg.road), roadMat);
      h.position.set(0, 0.05, p); h.receiveShadow = true; group.add(h);
      var v = new THREE.Mesh(new THREE.BoxGeometry(cfg.road, 0.1, span), roadMat);
      v.position.set(p, 0.05, 0); v.receiveShadow = true; group.add(v);
      var hl = new THREE.Mesh(new THREE.BoxGeometry(span, 0.12, 0.5), lineMat);
      hl.position.set(0, 0.06, p); group.add(hl);
      var vl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, span), lineMat);
      vl.position.set(p, 0.06, 0); group.add(vl);
    }

    // Buildings: one or two per block, height and colour by district.
    var heights = [10, 26, 16, 9, 7];
    for (var bz = 0; bz < cfg.grid; bz++) {
      for (var bx = 0; bx < cfg.grid; bx++) {
        var d = cfg.districts[districtAt(bx, bz)];
        var cx = -graph.half + bx * graph.step + graph.step / 2;
        var cz = -graph.half + bz * graph.step + graph.step / 2;
        var n = rng.chance(0.35) ? 2 : 1;
        for (var k = 0; k < n; k++) {
          var w = rng.range(14, 22), dep = rng.range(14, 22);
          var hgt = heights[districtAt(bx, bz)] * rng.range(0.7, 1.5);
          var ox = n === 2 ? (k === 0 ? -9 : 9) : 0;
          var tex = facadeTexture(rng, d.color, d.accent);
          var mat = new THREE.MeshStandardMaterial({
            map: tex, roughness: 0.85, metalness: 0.05,
          });
          var b = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, dep), mat);
          b.position.set(cx + ox, hgt / 2, cz);
          b.castShadow = true; b.receiveShadow = true;
          group.add(b);
          buildings.push(b);
          colliders.push({
            minX: cx + ox - w / 2, maxX: cx + ox + w / 2,
            minZ: cz - dep / 2, maxZ: cz + dep / 2,
          });
        }
      }
    }

    // Street lamps: emissive heads, lit because it is sunset.
    var lampMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.6 });
    var glowMat = new THREE.MeshStandardMaterial({
      color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 2.2,
    });
    var lamps = [];
    graph.nodes.forEach(function (nd) {
      if ((nd.id % 3) !== 0) return;
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
      pole.position.set(nd.x + 4, 3, nd.z + 4);
      pole.castShadow = true;
      group.add(pole);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), glowMat);
      head.position.set(nd.x + 4, 6.2, nd.z + 4);
      group.add(head);
      lamps.push(head);
    });

    // Safehouse: a warm shopfront in Crater Row (block 3,3), marked by a sign.
    var safe = { x: -graph.half + 3 * graph.step + graph.step / 2, z: -graph.half + 3 * graph.step + graph.step / 2 };
    var sign = new THREE.Mesh(
      new THREE.BoxGeometry(10, 2, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x2a5a8a, emissive: 0x2a5a8a, emissiveIntensity: 0.8 })
    );
    sign.position.set(safe.x, 7.5, safe.z - 11);
    group.add(sign);

    scene.add(group);
    return {
      group: group, graph: graph, colliders: colliders,
      buildings: buildings, lamps: lamps, safehouse: safe,
    };
  }

  TP.City = { build: buildCity, buildGraph: buildGraph, districtAt: districtAt };
})(window.TP);
