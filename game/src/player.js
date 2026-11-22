// The player: on foot (WASD walk/run, third-person) and in a car (arcade driving
// with acceleration, braking, steering that scales down with speed, and
// collision shake). Entering a car, carjacking a parked car and getting busted
// all live here.

import { PLAYER_WALK_SPEED, PLAYER_RUN_SPEED, CAR_TOP_SPEED, CAR_ACCEL, CAR_BRAKE, CAR_TURN, HERO_CAR_COLOR } from './config.js';
import { makeCar, makePed } from './vehicles.js';

export function createPlayer(scene, startX, startZ) {
  const THREE = window.THREE;
  const pedMesh = makePed(0xffc21a, 0xc98d64);
  scene.add(pedMesh);
  // The player's own car: the gold Comet GT.
  const carMesh = makeCar(HERO_CAR_COLOR);
  scene.add(carMesh);

  const player = {
    x: startX, z: startZ, heading: 0,
    speed: 0, inCar: false, car: null,
    life: 100, armor: 50, alive: true,
    mesh: pedMesh, carMesh,
    carSpeed: 0, carHeading: 0,
    moving: false,
  };
  pedMesh.position.set(startX, 0, startZ);
  // The hero car waits on the same road, a few metres ahead, facing north.
  carMesh.position.set(startX - 2, 0, startZ + 12);
  carMesh.rotation.y = 0;
  carMesh.visible = true; // the hero car sits parked on the street from the start

  function enterCar(car, isHero) {
    player.inCar = true;
    player.car = car;
    player.carHeading = car.heading;
    player.carSpeed = 0;
    player.x = car.x;
    player.z = car.z;
    pedMesh.visible = false;
    if (isHero) {
      carMesh.visible = true;
      carMesh.position.set(car.x, 0, car.z);
      carMesh.rotation.y = car.heading;
      player.car = { mesh: carMesh, x: car.x, z: car.z, heading: car.heading, speed: 0, isHero: true };
    } else {
      car.mesh.visible = true;
      player.car = car;
    }
    return player.car;
  }

  function exitCar() {
    if (!player.inCar || !player.car) return;
    player.inCar = false;
    const c = player.car;
    player.x = c.x + Math.sin(c.heading + Math.PI / 2) * 2.5;
    player.z = c.z + Math.cos(c.heading + Math.PI / 2) * 2.5;
    player.heading = c.heading;
    player.speed = 0;
    pedMesh.visible = true;
    pedMesh.position.set(player.x, 0, player.z);
    pedMesh.rotation.y = player.heading;
    if (!c.isHero) {
      // The stolen car stays where it was left, parked.
      c.parked = true;
      c.speed = 0;
    } else {
      carMesh.visible = true;
    }
    player.car = null;
  }

  function step(dt, input, physics, effects, audio, onCrash) {
    if (!player.alive) return;
    if (player.inCar && player.car) {
      const c = player.car;
      const drive = input.drive();
      const prevSpeed = c.speed;
      if (drive.fwd > 0) c.speed += CAR_ACCEL * dt;
      else if (drive.fwd < 0) c.speed -= CAR_BRAKE * dt * 0.9;
      else {
        // Rolling drag.
        c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 8 * dt);
      }
      c.speed = Math.max(-12, Math.min(CAR_TOP_SPEED, c.speed));
      const steerAmount = drive.steer * CAR_TURN * dt * Math.min(1, Math.abs(c.speed) / 8 + 0.25);
      // A turns left (heading grows toward +x when facing +z), D turns right.
      c.heading += steerAmount * (c.speed >= 0 ? 1 : -1);
      // NOTE: heading sign tuned so A turns left, D turns right while driving forward.
      const nx = c.x + Math.sin(c.heading) * c.speed * dt;
      const nz = c.z + Math.cos(c.heading) * c.speed * dt;
      const probe = { x: nx, z: nz };
      const hitWall = physics.collideCircle(probe, 2.2);
      if (hitWall && Math.abs(c.speed) > 6) {
        effects.sparks(new THREE.Vector3(probe.x, 1, probe.z), 10, 0xffc21a);
        effects.addTrauma(0.35);
        audio.crash();
        if (onCrash) onCrash(Math.abs(c.speed));
        c.speed *= 0.35;
      }
      c.x = probe.x;
      c.z = probe.z;
      player.x = c.x;
      player.z = c.z;
      player.carSpeed = c.speed;
      player.moving = Math.abs(c.speed) > 0.5;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.heading;
      const spin = c.speed * dt * 2.4;
      for (const w of c.mesh.userData.wheels) w.rotation.x += spin;
      audio.setEngine(true, Math.abs(c.speed) / CAR_TOP_SPEED);
      audio.radioBeat(dt);
      if (Math.abs(prevSpeed) > 1) player.kmDriven = (player.kmDriven || 0) + Math.abs(c.speed) * dt / 1000;
    } else {
      const walk = input.walk();
      const run = input.shift;
      const speed = run ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
      let mx = 0;
      let mz = 0;
      if (walk.fwd !== 0 || walk.steer !== 0) {
        // Movement is camera-relative: forward is away from the camera.
        const camYaw = player.camYaw || 0;
        const f = walk.fwd;
        const s = walk.steer;
        mx = Math.sin(camYaw) * f + Math.cos(camYaw) * s;
        mz = Math.cos(camYaw) * f - Math.sin(camYaw) * s;
        const len = Math.hypot(mx, mz) || 1;
        mx /= len;
        mz /= len;
        player.heading = Math.atan2(mx, mz);
      }
      player.moving = mx !== 0 || mz !== 0;
      const nx = player.x + mx * speed * dt;
      const nz = player.z + mz * speed * dt;
      const probe = { x: nx, z: nz };
      physics.collideCircle(probe, 0.6);
      player.x = probe.x;
      player.z = probe.z;
      pedMesh.position.set(player.x, Math.abs(Math.sin(performance.now() / 130)) * (player.moving ? 0.06 : 0), player.z);
      pedMesh.rotation.y = player.heading;
      audio.setEngine(false, 0);
    }
  }

  return {
    player, pedMesh, carMesh,
    enterCar, exitCar, step,
    teleport(x, z, heading) {
      player.x = x;
      player.z = z;
      if (heading !== undefined) player.heading = heading;
      if (player.inCar && player.car) {
        player.car.x = x;
        player.car.z = z;
        player.car.heading = player.heading;
        player.car.mesh.position.set(x, 0, z);
        player.car.mesh.rotation.y = player.heading;
      }
      pedMesh.position.set(x, 0, z);
    },
    damage(amount) {
      if (!player.alive) return false;
      let rest = amount;
      if (player.armor > 0) {
        const absorbed = Math.min(player.armor, rest);
        player.armor -= absorbed;
        rest -= absorbed;
      }
      player.life -= rest;
      if (player.life <= 0) {
        player.life = 0;
        player.alive = false;
        return true;
      }
      return false;
    },
    heal() {
      player.life = 100;
      player.armor = 50;
      player.alive = true;
    },
  };
}
