// Chase camera: exponential smoothing (1 - exp(-rate*dt), never a fixed lerp),
// look-ahead in the direction of travel, a low close framing while driving so
// the hero car fills the frame, and a snap-to for staged shots and respawns.

export function createCamera(camera) {
  const THREE = window.THREE;
  const pos = new THREE.Vector3(0, 9, -16);
  const look = new THREE.Vector3(0, 1.5, 0);
  let yaw = 0;
  let pitch = 0.32;
  let dist = 13;
  let height = 4.6;

  function frame(dt, target, opts = {}) {
    const wantDist = opts.dist ?? (target.inCar ? 12.5 : 8.5);
    const wantHeight = opts.height ?? (target.inCar ? 4.2 : 3.4);
    const wantPitch = opts.pitch ?? 0.30;
    dist += (wantDist - dist) * (1 - Math.exp(-4 * dt));
    height += (wantHeight - height) * (1 - Math.exp(-4 * dt));
    pitch += (wantPitch - pitch) * (1 - Math.exp(-4 * dt));
    // Yaw eases toward the target heading: the camera sits BEHIND the target
    // (target - forward * dist) and looks ahead past it — a chase view.
    let dy = target.heading - yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    yaw += dy * (1 - Math.exp(-2.6 * dt));
    const speed = target.speed ?? target.carSpeed ?? 0;
    const lookAhead = Math.min(10, Math.abs(speed) * 0.45);
    const lx = target.x + Math.sin(target.heading) * lookAhead;
    const lz = target.z + Math.cos(target.heading) * lookAhead;
    const cx = target.x - Math.sin(yaw) * dist * Math.cos(pitch);
    const cz = target.z - Math.cos(yaw) * dist * Math.cos(pitch);
    const cy = height + Math.sin(pitch) * dist * 0.4;
    const t = 1 - Math.exp(-7 * dt);
    pos.x += (cx - pos.x) * t;
    pos.y += (cy - pos.y) * t;
    pos.z += (cz - pos.z) * t;
    look.x += (lx - look.x) * (1 - Math.exp(-9 * dt));
    look.y += (1.6 - look.y) * (1 - Math.exp(-9 * dt));
    look.z += (lz - look.z) * (1 - Math.exp(-9 * dt));
    camera.position.copy(pos);
    camera.lookAt(look);
    return { yaw };
  }

  /** Hard-cut the camera (teleports, staged shots): no whip across the map. */
  function snap(target, opts = {}) {
    const d = opts.dist ?? (target.inCar ? 12.5 : 8.5);
    const h = opts.height ?? (target.inCar ? 4.2 : 3.4);
    yaw = target.heading;
    dist = d;
    height = h;
    const cx = target.x - Math.sin(yaw) * d;
    const cz = target.z - Math.cos(yaw) * d;
    pos.set(cx, h + 1.2, cz);
    look.set(target.x, 1.6, target.z);
    camera.position.copy(pos);
    camera.lookAt(look);
  }

  /** Free framing for the title screen: a slow drift over the skyline. */
  function orbitShot(time, cx, cz) {
    const a = time * 0.05;
    camera.position.set(cx + Math.cos(a) * 60, 26 + Math.sin(time * 0.11) * 4, cz + Math.sin(a) * 60);
    camera.lookAt(cx, 8, cz);
  }

  return {
    frame, snap, orbitShot,
    get yaw() {
      return yaw;
    },
    set yaw(v) {
      yaw = v;
    },
  };
}
