// traffic.js — ambient traffic: cars follow the road graph, pause at
// intersections, and yield nothing. Plus parked cars the player can steal.
// Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  var TYPES = ['sedan', 'sedan', 'taxi', 'van', 'sedan', 'taxi', 'truck', 'sedan'];

  function nearestNode(graph, x, z) {
    var best = 0, bd = Infinity;
    for (var i = 0; i < graph.nodes.length; i++) {
      var n = graph.nodes[i];
      var d = TP.Physics.dist2(x, z, n.x, n.z);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function neighbours(graph, nodeId) {
    var out = [];
    var gx = nodeId % (TP.Config.grid + 1);
    var gy = Math.floor(nodeId / (TP.Config.grid + 1));
    var W = TP.Config.grid + 1;
    if (gx > 0) out.push(nodeId - 1);
    if (gx < TP.Config.grid) out.push(nodeId + 1);
    if (gy > 0) out.push(nodeId - W);
    if (gy < TP.Config.grid) out.push(nodeId + W);
    return out;
  }

  function createTraffic(scene, city, rng) {
    var graph = city.graph;
    var cars = [];
    var parked = [];

    // 14 moving cars, spread over the graph.
    for (var i = 0; i < 14; i++) {
      var n = rng.int(0, graph.nodes.length - 1);
      var nd = graph.nodes[n];
      var car = TP.Vehicles.makeCar(
        scene, TYPES[i % TYPES.length],
        nd.x + rng.range(-2, 2), nd.z + rng.range(-2, 2),
        rng.range(0, Math.PI * 2), {}
      );
      car.node = n;
      var nb = neighbours(graph, n);
      car.targetNode = nb[rng.int(0, nb.length - 1)];
      car.speed = rng.range(6, 11);
      cars.push(car);
    }

    // 8 parked cars along roads (stealable). One of them is the gold Comet
    // for mission 3 — flagged _gold so the mission can find it.
    var parkedSpots = [
      [25, -60, 'sedan'], [-25, 20, 'taxi'], [70, 60, 'van'], [-70, -20, 'sedan'],
      [20, 110, 'sedan'], [-110, 70, 'truck'], [110, -70, 'sedan'], [-20, -110, 'taxi'],
    ];
    parkedSpots.forEach(function (s, idx) {
      var type = s[2];
      var gold = idx === 6; // the Comet slot (north-east) — mission 3 target
      if (gold) type = 'comet';
      var car = TP.Vehicles.makeCar(
        scene, type, s[0], s[1], rng.range(0, Math.PI * 2),
        { parked: true, gold: gold }
      );
      parked.push(car);
    });

    function update(dt) {
      cars.forEach(function (car) {
        if (car.wait > 0) { car.wait -= dt; return; }
        var target = graph.nodes[car.targetNode];
        if (!target) return;
        var dx = target.x - car.pos.x, dz = target.z - car.pos.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        if (d < 3) {
          // Reached the node: pick a new neighbour (not the one we came from).
          var nb = neighbours(graph, car.targetNode).filter(function (n) { return n !== car.node; });
          car.node = car.targetNode;
          car.targetNode = nb.length ? nb[rng.int(0, nb.length - 1)] : car.node;
          if (rng.chance(0.25)) car.wait = rng.range(0.5, 2);
          return;
        }
        var want = Math.atan2(dx, dz);
        var diff = want - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        car.heading += TP.Physics.clamp(diff, -1.6 * dt, 1.6 * dt);
        car.pos.x += Math.sin(car.heading) * car.speed * dt;
        car.pos.z += Math.cos(car.heading) * car.speed * dt;
        TP.Vehicles.syncCar(car);
      });
      parked.forEach(function (car) { TP.Vehicles.syncCar(car); });
    }

    return { cars: cars, parked: parked, update: update };
  }

  TP.Traffic = { create: createTraffic, nearestNode: nearestNode };
})(window.TP);
