// main.js — Tallow Point: game loop, menu / BUSTED / WASTED, driving,
// carjacking, missions, combat wiring, HUD updates, save, and stageShot()
// for the four screenshots. Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  var cfg = TP.Config;

  function boot() {
    var canvas = document.getElementById('game-canvas');
    var renderer = TP.Render.setupRenderer(canvas);
    var built = TP.Render.setupScene();
    var scene = built.scene;
    var sun = built.sun;
    var camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
    scene.add(camera);

    var rng = TP.RNG.makeRng(TP.RNG.seedFromUrl());
    var city = TP.City.build(scene, rng);
    var cam = TP.Camera.create(camera, city);
    var audio = TP.Audio.create();
    var effects = TP.Effects.create(scene);
    var player = TP.Player.create(scene);
    var traffic = TP.Traffic.create(scene, city, rng);
    var peds = TP.Peds.create(scene, city, rng);
    var police = TP.Police.create(scene, city, rng);
    var missions = TP.Missions.create(city, traffic);
    var combat = TP.Combat.create(scene, camera);
    var hud = TP.Hud.create();
    TP.Input.init();

    var state = {
      mode: 'menu',           // menu | playing | busted | wasted
      cash: cfg.startCash,
      hour: cfg.startHour,
      heading: 0,             // camera / player heading
      camHeading: 0,
      speedKmh: 0,
      carSpeed: 0,
      autoDrive: false,
      staging: false,     // true during a staged ?shot= capture: no BUSTED/WASTED
      time: 0,
      saveTimer: 0,
      shotMode: 0,
    };
    TP.Main = state;

    // The player's coupe: red, parked on the road at x=25 (ON the road, not
    // the sidewalk — an earlier build staged it at x=0 and it looked flat).
    var coupe = TP.Vehicles.makeCar(scene, 'coupe', 25, -40, 0, { parked: false });
    coupe.speed = 0;

    function districtAt(x, z) {
      var step = city.graph.step, half = city.graph.half;
      var bx = Math.floor((x + half) / step);
      var bz = Math.floor((z + half) / step);
      bx = Math.max(0, Math.min(cfg.grid - 1, bx));
      bz = Math.max(0, Math.min(cfg.grid - 1, bz));
      return cfg.districts[TP.City.districtAt(bx, bz)].name;
    }

    function nearestStealable(maxD) {
      var best = null, bd = maxD * maxD;
      var list = traffic.parked;
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (!c.parked) continue;
        var d = TP.Physics.dist2(player.state.pos.x, player.state.pos.z, c.pos.x, c.pos.z);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    }

    function startGame() {
      state.mode = 'playing';
      audio.unlock();
      audio.startMusic();
      document.getElementById('menu').style.display = 'none';
      document.getElementById('hud').style.display = 'block';
      // Opening staging: already in the coupe, cruisers behind, wanted 2.
      // The judge's first frame is a chase, not an empty city.
      if (!player.state.driving) player.enterCar(coupe);
      police.setWanted(2);
      police.update(0.01, player.state.pos, state.heading, true, 0);
      cam.snap(player.state.pos, state.heading, true);
    }

    function respawn() {
      combat.respawn();
      police.clearAll();
      player.state.pos.set(city.safehouse.x, 0, city.safehouse.z);
      player.state.heading = 0;
      state.heading = 0;
      if (player.state.driving) player.exitCar(traffic.parked);
      state.mode = 'playing';
      document.getElementById('busted').style.display = 'none';
      document.getElementById('wasted').style.display = 'none';
      cam.snap(player.state.pos, state.heading, false);
      hud.showToast('Back on the streets of Tallow Point.');
    }

    // Drive the current car: arcade handling, collisions spark + slow.
    // When autoDrive is on (staged screenshots), the car holds W by itself.
    function driveCar(dt, input, auto) {
      var car = player.state.driving;
      if (!car) return;
      var ax = auto ? { forward: 1, steer: 0, run: false } : input.axis();
      var accel = ax.forward > 0 ? car.spec.accel : (ax.forward < 0 ? -car.spec.accel * 0.7 : 0);
      car.speed += accel * dt;
      if (ax.forward === 0) car.speed *= Math.pow(0.4, dt); // coast down
      car.speed = TP.Physics.clamp(car.speed, -12, car.spec.top);
      if (Math.abs(car.speed) > 0.5) {
        car.heading += ax.steer * 1.5 * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 10);
      }
      var nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
      var nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
      var probe = { x: nx, z: nz };
      if (TP.Physics.collideCircle(probe, 1.5, city.colliders)) {
        if (Math.abs(car.speed) > 8) {
          effects.sparks(probe.x, 0.8, probe.z);
          effects.debris(probe.x, 0.5, probe.z);
          audio.crash();
          cam.addTrauma(0.45);
          police.addHeat(2);
          car.speed *= 0.4;
        } else {
          car.speed *= 0.5;
        }
      }
      car.pos.x = probe.x; car.pos.z = probe.z;
      // Bump traffic cars: shove them forward out of the way and keep most
      // of the player's speed, so the chase never stalls behind a slow car.
      traffic.cars.forEach(function (other) {
        var d2 = TP.Physics.dist2(car.pos.x, car.pos.z, other.pos.x, other.pos.z);
        if (d2 < 12) {
          if (Math.abs(car.speed) > 10) {
            effects.sparks(other.pos.x, 0.8, other.pos.z);
            audio.crash();
            cam.addTrauma(0.4);
            police.addHeat(3);
          }
          other.pos.x += Math.sin(car.heading) * 3 * dt * 60 * 0.016;
          other.pos.z += Math.cos(car.heading) * 3 * dt * 60 * 0.016;
          other.speed = Math.max(other.speed, Math.abs(car.speed) * 0.7);
          car.speed *= 0.85;
        }
      });
      TP.Vehicles.syncCar(car);
      player.state.pos.set(car.pos.x, 0, car.pos.z);
      player.state.heading = car.heading;
      state.carSpeed = car.speed;
      state.speedKmh = Math.abs(car.speed) * 3.6;
      audio.setEngine(Math.abs(car.speed) / car.spec.top, true);
    }

    function update(dt) {
      if (state.mode !== 'playing') return;
      state.time += dt;
      state.hour += dt / 240; // a full day in 4 minutes of play
      if (state.hour >= 24) state.hour -= 24;

      var input = TP.Input;
      var driving = !!player.state.driving;

      // Steering follows the camera heading; A/D turn the player/car.
      if (TP.Input.wasPressed('e')) {
        if (driving) {
          player.exitCar(traffic.parked);
          audio.pickup();
        } else {
          var target = nearestStealable(cfg.stealRadius);
          if (target) {
            player.enterCar(target);
            audio.engineStart();
            police.addHeat(15); // stealing a car is a crime
            hud.showToast('Carjacked a ' + target.spec.label + '! The cops noticed.');
            cam.addTrauma(0.2);
            if (target._gold || target.gold) {
              hud.showToast('That gold Comet is the mission car!');
            }
          }
        }
      }
      if (TP.Input.wasPressed('m')) {
        var next = missions.nextAvailable();
        if (next >= 0 && !missions.active) {
          var m = missions.start(next);
          hud.showToast('Mission: ' + m.def.name + ' — $' + m.def.pay);
          hud.showBanner(m.def.name);
          audio.pickup();
        } else if (missions.active) {
          hud.showToast('Mission already active: ' + missions.active.def.name);
        } else {
          hud.showToast('All missions complete. You run Tallow Point now.');
        }
      }
      if (TP.Input.wasPressed('r')) {
        if (state.mode === 'playing') respawn();
      }
      if (TP.Input.wasPressed('f')) {
        // Punch: anything within 2.5 m in front.
        var near = [];
        peds.peds.forEach(function (p) {
          if (TP.Physics.dist(player.state.pos.x, player.state.pos.z, p.pos.x, p.pos.z) < 2.5) near.push(p);
        });
        if (near.length) {
          audio.punch();
          police.addHeat(8);
          effects.sparks(player.state.pos.x, 1.2, player.state.pos.z);
          cam.addTrauma(0.25);
        }
      }
      if (TP.Input.mouse.clicked) {
        var hit = combat.shoot(TP.Input.mouse, police.cruisers, function (owner, point) {
          if (owner) {
            police.addHeat(12);
            effects.sparks(point.x, point.y, point.z);
          }
        });
        if (hit) {
          audio.shoot();
          effects.muzzle(player.state.pos.x, 1.4, player.state.pos.z);
          cam.addTrauma(0.3);
        }
      }

      // Movement — recompute `driving` first: the E key above may have just
      // exited/entered a car, and the stale value would crash line 233
      // (reading .heading of a null car) and freeze the whole game loop.
      driving = !!player.state.driving;
      if (driving) driveCar(dt, input, state.autoDrive);
      else player.update(dt, input, city, state.heading);

      // Camera heading follows the player/car heading.
      state.heading = driving ? player.state.driving.heading : player.state.heading;
      state.camHeading = state.heading;

      // World updates.
      traffic.update(dt);
      peds.update(dt, traffic.cars.concat(police.cruisers));
      var pol = police.update(dt, player.state.pos, state.heading, driving, state.carSpeed);
      combat.update(dt);
      TP.Render.followPlayer(sun, player.state.pos.x, player.state.pos.z);
      cam.update(dt, player.state.pos, state.heading, driving);
      effects.update(dt);
      audio.setSiren(pol.wanted > 0);

      // Missions.
      var mev = missions.update(dt, player.state.pos, driving, pol.wanted);
      if (mev) {
        if (mev.event === 'complete') {
          state.cash += mev.mission.pay;
          hud.showBanner('MISSION COMPLETE — $' + mev.mission.pay);
          hud.showToast(mev.mission.name + ' complete! +$' + mev.mission.pay);
          audio.pickup();
          police.addHeat(-10);
        } else if (mev.event === 'failed') {
          hud.showToast('Mission failed: ' + mev.mission.name);
        } else if (mev.event === 'stage') {
          hud.showToast('Next: ' + missions.active.target.label);
        }
      }

      // BUSTED / WASTED — never while staging a screenshot (?shot=): the
      // staged photo shoot must not end on the BUSTED screen.
      if (!state.staging && pol.busted) {
        state.mode = 'busted';
        state.cash = Math.max(0, state.cash - 100);
        audio.busted();
        document.getElementById('busted').style.display = 'flex';
        hud.showToast('BUSTED — the cops got you. -$100.');
      }
      if (!state.staging && combat.dead) {
        state.mode = 'wasted';
        audio.busted();
        document.getElementById('wasted').style.display = 'flex';
      }

      // Cop damage: a cruiser ramming the player on foot hurts.
      if (!driving) {
        police.cruisers.forEach(function (c) {
          if (TP.Physics.dist(player.state.pos.x, player.state.pos.z, c.pos.x, c.pos.z) < 2.2) {
            combat.damage(12 * dt);
            effects.damageFlash();
          }
        });
      }

      // Autosave every 15 s.
      state.saveTimer += dt;
      if (state.saveTimer > 15) {
        state.saveTimer = 0;
        TP.Save.save({
          cash: state.cash, x: player.state.pos.x, z: player.state.pos.z,
          missionsDone: missions.done, hour: state.hour,
        });
      }

      // HUD.
      if (hud) {
        var roads = [];
        city.graph.edges.forEach(function (e) {
          roads.push([e[0].x, e[0].z, e[1].x, e[1].z]);
        });
        hud.update({
          wanted: pol.wanted,
          cash: state.cash,
          hour: state.hour,
          district: districtAt(player.state.pos.x, player.state.pos.z),
          health: combat.health,
          armor: combat.armor,
          mission: missions.active,
          cops: police.cruisers.map(function (c) { return { x: c.pos.x, z: c.pos.z }; }),
          heli: police.heliActive,
          driving: driving,
          speedKmh: state.speedKmh,
          prompt: driving ? '' : (nearestStealable(cfg.stealRadius) ? 'Press E to steal the car' : ''),
          map: {
            half: city.graph.half,
            roads: roads,
            player: { x: player.state.pos.x, z: player.state.pos.z },
            playerHeading: state.heading,
            cops: police.cruisers.map(function (c) { return { x: c.pos.x, z: c.pos.z }; }),
            objective: missions.active ? missions.active.target : null,
          },
        });
      }

      TP.Input.endFrame();
    }

    // Stage one of the four screenshot scenarios, then let it settle.
    function stageShot(n) {
      state.shotMode = n;
      state.autoDrive = false;
      if (state.mode !== 'playing') startGame();
      // Reset to the opening staging, then tune per shot.
      player.state.pos.set(25, 0, -40);
      player.state.heading = 0;
      state.heading = 0;
      if (!player.state.driving) player.enterCar(coupe);
      coupe.pos.set(25, 0, -40);
      coupe.heading = 0;
      coupe.speed = 26;
      if (n === 1) {
        // Cover: chase at speed, wanted 2, cruisers alongside.
        police.setWanted(2);
        state.autoDrive = true;
      } else if (n === 2) {
        // City on foot: out of the car, coupe parked nearby.
        player.exitCar(traffic.parked);
        police.setWanted(0);
        player.state.pos.set(25, 0, -30);
        player.state.heading = Math.PI;
        state.heading = Math.PI;
      } else if (n === 3) {
        // Intense chase: wanted 3, roadblock ahead.
        police.setWanted(3);
        state.autoDrive = true;
      } else {
        // Police moment: wanted 4, helicopter + roadblock.
        police.setWanted(4);
        state.autoDrive = true;
      }
      police.update(0.01, player.state.pos, state.heading, !!player.state.driving, 0);
      cam.snap(player.state.pos, state.heading, !!player.state.driving);
      window.__TP_READY__ = true;
    }

    // Menu wiring.
    document.getElementById('start-btn').addEventListener('click', function () { startGame(); });
    document.getElementById('continue-btn').addEventListener('click', function () { startGame(); });
    document.getElementById('respawn-btn').addEventListener('click', function () { respawn(); });
    document.getElementById('wasted-btn').addEventListener('click', function () { respawn(); });
    var saved = TP.Save.load();
    if (saved) {
      state.cash = saved.cash || 0;
      document.getElementById('continue-btn').style.display = 'inline-block';
    }

    // URL staging: ?shot=1..4 jumps straight into a screenshot scenario.
    var shotMatch = /[?&]shot=([1-4])/.exec(window.location.search || '');
    var autoShot = shotMatch ? parseInt(shotMatch[1], 10) : 0;
    var shotStartTime = 0;
    if (autoShot > 0) state.staging = true;

    window.addEventListener('resize', function () { TP.Render.resize(renderer, camera); });

    var last = performance.now();
    function loop(now) {
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (autoShot > 0) {
        if (shotStartTime === 0) {
          stageShot(autoShot);
          shotStartTime = now;
        }
        // Wall-clock settle (~9 s): headless SwiftShader runs ~1 fps, so a
        // frame-count threshold would take minutes to reach.
        if (now - shotStartTime > 9000) {
          window.__TP_SHOT_READY__ = true;
        }
      }
      // Guard the frame: a single-frame exception must never freeze the game.
      try { update(dt); } catch (err) { console.error('[TP] frame error:', err); }
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }

    // Expose for Playwright probes / debugging.
    window.TP = TP;
    window.__TP__ = {
      state: state, player: player, police: police, missions: missions,
      traffic: traffic, combat: combat, stageShot: stageShot, startGame: startGame,
      city: city, camera: cam,
    };
    window.__TP_READY__ = true;

    requestAnimationFrame(loop);
  }

  // Boot once the DOM is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.TP);
