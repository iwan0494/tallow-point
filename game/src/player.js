// player.js — the on-foot character: WASD movement, run, jump, a simple
// walk-cycle bob, and carjacking (enter/exit). Exiting a car parks it in
// parkedCars so the player can steal it back again. Classic script, TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  var cfg = TP.Config;

  function createPlayer(scene) {
    var group = new THREE.Group();
    group.name = 'player';

    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a6db0, roughness: 0.7 });
    var skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a075, roughness: 0.8 });
    var pantsMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.85 });

    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), bodyMat);
    torso.position.y = 1.05; torso.castShadow = true;
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
    head.position.y = 1.75; head.castShadow = true;
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), pantsMat);
    legL.position.set(-0.18, 0.35, 0); legL.castShadow = true;
    var legR = legL.clone();
    legR.position.x = 0.18;
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), bodyMat);
    armL.position.set(-0.48, 1.05, 0); armL.castShadow = true;
    var armR = armL.clone();
    armR.position.x = 0.48;

    group.add(torso); group.add(head);
    group.add(legL); group.add(legR); group.add(armL); group.add(armR);
    scene.add(group);

    var state = {
      pos: new THREE.Vector3(25, 0, -40),
      heading: 0,
      speed: 0,
      walking: false,
      driving: null,      // vehicle object when driving, else null
      walkPhase: 0,
    };

    function update(dt, input, city, heading) {
      if (state.driving) return;
      var ax = input.axis();
      var moving = ax.forward !== 0 || ax.steer !== 0;
      state.walking = moving;
      var sp = ax.run ? cfg.playerRun : cfg.playerSpeed;
      if (moving) {
        // Turn with A/D, move with W/S relative to the camera heading.
        state.heading = heading + (ax.steer !== 0 ? -ax.steer * 2.4 * dt : 0);
        var fwd = ax.forward;
        var nx = state.pos.x + Math.sin(state.heading) * fwd * sp * dt;
        var nz = state.pos.z + Math.cos(state.heading) * fwd * sp * dt;
        var probe = { x: nx, z: nz };
        TP.Physics.collideCircle(probe, 0.6, city.colliders);
        state.pos.x = probe.x; state.pos.z = probe.z;
        state.speed = sp * Math.abs(fwd);
        state.walkPhase += dt * sp * 1.6;
      } else {
        state.speed = 0;
      }
      group.position.copy(state.pos);
      group.rotation.y = state.heading;
      // Walk cycle: legs + arms swing, body bobs.
      var sw = state.walking ? Math.sin(state.walkPhase) * 0.5 : 0;
      legL.rotation.x = sw; legR.rotation.x = -sw;
      armL.rotation.x = -sw * 0.7; armR.rotation.x = sw * 0.7;
      torso.position.y = 1.05 + (state.walking ? Math.abs(Math.sin(state.walkPhase)) * 0.06 : 0);
    }

    // Leave the car: the car becomes a parked, stealable car again, so the
    // player can get back into their own coupe (earlier builds lost it).
    function exitCar(parkedCars) {
      if (!state.driving) return null;
      var car = state.driving;
      state.driving = null;
      car.parked = true;
      if (parkedCars && parkedCars.indexOf(car) === -1) parkedCars.push(car);
      // Step out to the side of the car.
      state.pos.set(
        car.pos.x + Math.cos(car.heading) * 2.2,
        0,
        car.pos.z - Math.sin(car.heading) * 2.2
      );
      state.heading = car.heading;
      group.position.copy(state.pos);
      group.visible = true;
      return car;
    }

    function enterCar(car) {
      state.driving = car;
      car.parked = false;
      group.visible = false;
      state.pos.set(car.pos.x, 0, car.pos.z);
    }

    return {
      group: group, state: state, update: update,
      exitCar: exitCar, enterCar: enterCar,
    };
  }

  TP.Player = { create: createPlayer };
})(window.TP);
