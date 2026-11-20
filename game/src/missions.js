// missions.js — five story missions in order: Courier, Hot Pursuit, Boost
// the Comet, Night Shift, Kingpin. Each has a target, a timer and a payout;
// completing one unlocks the next and pays cash. Classic script, TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  var cfg = TP.Config;

  function createMissions(city, traffic) {
    var defs = cfg.missions;
    var active = null;      // {def, target:{x,z,label}, timeLeft, stage}
    var done = 0;
    var graph = city.graph;

    function nodePos(n) { return graph.nodes[n]; }

    function startMission(idx) {
      var def = defs[idx];
      if (!def) return null;
      var target = null;
      if (idx === 0) {
        // Courier: drop-off in Sunmere (south).
        target = { x: 0, z: graph.half - 20, label: 'Drop-off Sunmere' };
      } else if (idx === 1) {
        // Hot Pursuit: survive — the target is "stay free", marked on self.
        target = { x: 0, z: 0, label: 'Lose the cops' };
      } else if (idx === 2) {
        // Boost the Comet: the gold Comet parked north-east.
        var gold = traffic.parked.find(function (c) { return c._gold || c.gold; });
        if (gold) target = { x: gold.pos.x, z: gold.pos.z, label: 'Gold Comet' };
        else target = { x: 110, z: -70, label: 'Gold Comet' };
      } else if (idx === 3) {
        // Night Shift: taxi fares — first stop in Northline.
        target = { x: -40, z: -graph.half + 20, label: 'Fare 1/3 — Northline' };
      } else {
        // Kingpin: Kessel Wharf (west).
        target = { x: -graph.half + 20, z: 0, label: 'Kessel Wharf meet' };
      }
      active = { def: def, idx: idx, target: target, timeLeft: def.time, stage: 0 };
      return active;
    }

    function update(dt, playerPos, driving, wanted) {
      if (!active) return null;
      active.timeLeft -= dt;
      if (active.timeLeft <= 0) {
        var failed = active;
        active = null;
        return { event: 'failed', mission: failed.def };
      }
      var t = active.target;
      var d = TP.Physics.dist(playerPos.x, playerPos.z, t.x, t.z);
      if (active.idx === 1) {
        // Hot Pursuit completes when the wanted level drops to 0.
        if (wanted === 0) {
          var won = active; active = null; done++;
          return { event: 'complete', mission: won.def };
        }
        return null;
      }
      if (active.idx === 2) {
        // Boost the Comet: reach the gold Comet, then drive it to the safehouse.
        if (active.stage === 0 && d < 8) {
          active.stage = 1;
          active.target = {
            x: city.safehouse.x, z: city.safehouse.z, label: 'Bring it home — Crater Row',
          };
          active.timeLeft = Math.max(active.timeLeft, 90);
          return { event: 'stage', mission: active.def };
        }
        if (active.stage === 1 && d < 10 && driving) {
          var won2 = active; active = null; done++;
          return { event: 'complete', mission: won2.def };
        }
        return null;
      }
      if (active.idx === 3) {
        // Night Shift: three fare stops in sequence.
        if (d < 8) {
          active.stage++;
          if (active.stage >= 3) {
            var won3 = active; active = null; done++;
            return { event: 'complete', mission: won3.def };
          }
          var stops = [
            { x: -40, z: -graph.half + 20, label: 'Fare 1/3 — Northline' },
            { x: 80, z: 40, label: 'Fare 2/3 — Moraine Heights' },
            { x: -80, z: 100, label: 'Fare 3/3 — Sunmere' },
          ];
          active.target = stops[active.stage];
          return { event: 'stage', mission: active.def };
        }
        return null;
      }
      if (d < 8) {
        var won4 = active; active = null; done++;
        return { event: 'complete', mission: won4.def };
      }
      return null;
    }

    function nextAvailable() { return done < defs.length ? done : -1; }

    return {
      start: startMission, update: update, nextAvailable: nextAvailable,
      get active() { return active; },
      get done() { return done; },
      get defs() { return defs; },
    };
  }

  TP.Missions = { create: createMissions };
})(window.TP);
