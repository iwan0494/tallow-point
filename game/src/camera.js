// camera.js — third-person chase camera: exponential follow, deadzone,
// look-ahead, spring-arm pull-in on buildings, trauma shake on top.
// Never a bird's-eye overview: the camera stays low, street level, behind
// the player/car so the action fills the frame. Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  // NOTE: the heading getter is named getCamHeading on purpose. An earlier
  // build had `var camHeading = 0` colliding with `function camHeading()`,
  // which broke on-foot controls entirely.
  function createCamera(camera, city) {
    var state = {
      focus: new THREE.Vector3(0, 1.5, 0),
      yaw: 0,
      trauma: 0,
      t: 0,
      rate: 9,            // follow rate (fixed from 5.5: cruisers were out of frame)
      distDrive: 10,      // driving: 10 m back, 4 m up (closer than before)
      heightDrive: 4,
      distWalk: 6,
      heightWalk: 2.6,
    };

    function getCamHeading() { return state.yaw; }

    function addTrauma(amount) {
      state.trauma = Math.min(state.trauma + amount, 1);
    }

    // AABB pull-in: shorten the boom when a building blocks the camera ray.
    function pullIn(from, to, colliders) {
      var best = 1;
      var dx = to.x - from.x, dz = to.z - from.z;
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        var tmin = 0, tmax = 1;
        if (Math.abs(dx) > 1e-6) {
          var tx1 = (c.minX - from.x) / dx, tx2 = (c.maxX - from.x) / dx;
          tmin = Math.max(tmin, Math.min(tx1, tx2));
          tmax = Math.min(tmax, Math.max(tx1, tx2));
        } else if (from.x < c.minX || from.x > c.maxX) continue;
        if (Math.abs(dz) > 1e-6) {
          var tz1 = (c.minZ - from.z) / dz, tz2 = (c.maxZ - from.z) / dz;
          tmin = Math.max(tmin, Math.min(tz1, tz2));
          tmax = Math.min(tmax, Math.max(tz1, tz2));
        } else if (from.z < c.minZ || from.z > c.maxZ) continue;
        if (tmax >= tmin && tmin < best) best = Math.max(tmin - 0.05, 0.15);
      }
      return best;
    }

    function update(dt, target, heading, driving) {
      // Deadzone: ignore tiny target wobble so the frame does not twitch.
      var dx = target.x - state.focus.x, dz = target.z - state.focus.z;
      var dist = Math.sqrt(dx * dx + dz * dz);
      var goal = new THREE.Vector3(target.x, target.y + 1.4, target.z);
      if (dist > 0.6) {
        // Look-ahead: aim a little ahead of the direction of travel.
        var lead = driving ? 3.5 : 1.2;
        goal.x += Math.sin(heading) * lead;
        goal.z += Math.cos(heading) * lead;
      }
      var k = 1 - Math.exp(-state.rate * dt);
      state.focus.lerp(goal, k);
      state.yaw = heading;

      var distCam = driving ? state.distDrive : state.distWalk;
      var heightCam = driving ? state.heightDrive : state.heightWalk;
      var back = new THREE.Vector3(
        state.focus.x - Math.sin(heading) * distCam,
        state.focus.y + heightCam,
        state.focus.z - Math.cos(heading) * distCam
      );
      var pull = pullIn(state.focus, back, city.colliders);
      back.lerpVectors(state.focus, back, pull);
      if (back.y < 1.2) back.y = 1.2;

      // Trauma shake rides on top of the smooth follow (summed sines, real dt).
      state.t += dt * 30;
      if (state.trauma > 0) {
        state.trauma = Math.max(state.trauma - 1.2 * dt, 0);
        var sh = state.trauma * state.trauma;
        back.x += 0.35 * sh * Math.sin(state.t * 1.7);
        back.y += 0.25 * sh * Math.sin(state.t * 2.3);
      }

      camera.position.copy(back);
      camera.lookAt(state.focus.x, state.focus.y, state.focus.z);
    }

    // Hard cut (teleport / respawn / staging): reset smoothing so the camera
    // does not whip across the city.
    function snap(target, heading, driving) {
      state.focus.set(target.x, target.y + 1.4, target.z);
      state.yaw = heading;
      state.trauma = 0;
      update(0.016, target, heading, driving);
    }

    return {
      update: update, snap: snap, addTrauma: addTrauma,
      getCamHeading: getCamHeading, state: state,
    };
  }

  TP.Camera = { create: createCamera };
})(window.TP);
