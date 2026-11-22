// Combat: raycast shooting from the camera through the crosshair, punching at
// close range, damage to peds and cruisers, and the wanted heat every violent
// act earns. Shots and punches are the events the game-feel layer listens to.

export function createCombat(scene, effects, audio, police, peds) {
  const THREE = window.THREE;
  const raycaster = new THREE.Raycaster();
  let shotCooldown = 0;

  function shoot(camera, player, targetMeshes) {
    if (shotCooldown > 0) return null;
    shotCooldown = 0.28;
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    raycaster.far = 90;
    const hits = raycaster.intersectObjects(targetMeshes, true);
    audio.gunshot();
    // Muzzle flash at the player's gun, roughly at the camera's lower right.
    const muzzlePos = new THREE.Vector3();
    camera.getWorldPosition(muzzlePos);
    muzzlePos.y -= 0.4;
    effects.muzzle(muzzlePos);
    effects.addTrauma(0.22);
    police.addHeat(0.35);
    if (!hits.length) return { hit: false };
    const hit = hits[0];
    effects.sparks(hit.point, 8, 0xff5a3c);
    // Walk up to the hit object's owner: a ped, a cruiser or a traffic car.
    let obj = hit.object;
    let owner = null;
    while (obj) {
      if (obj.userData.ped) { owner = { kind: 'ped', ped: obj.userData.ped }; break; }
      if (obj.userData.cruiser) { owner = { kind: 'cruiser', cruiser: obj.userData.cruiser }; break; }
      if (obj.userData.traffic) { owner = { kind: 'traffic', car: obj.userData.traffic }; break; }
      obj = obj.parent;
    }
    if (owner && owner.kind === 'ped') {
      peds.remove(owner.ped);
      police.addHeat(0.6);
      return { hit: true, kind: 'ped' };
    }
    if (owner && owner.kind === 'cruiser') {
      police.addHeat(0.25);
      return { hit: true, kind: 'cruiser' };
    }
    return { hit: true, kind: 'world' };
  }

  function punch(player, pedsList, policeList) {
    audio.punch();
    effects.addTrauma(0.12);
    // A punch lands on the nearest ped or cop within 2.2 m in front.
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    let best = null;
    let bestD = 2.4;
    for (const ped of pedsList) {
      const dx = ped.x - player.x;
      const dz = ped.z - player.z;
      const d = Math.hypot(dx, dz);
      const facing = (dx * fx + dz * fz) / (d || 1);
      if (d < bestD && facing > 0.4) { bestD = d; best = { kind: 'ped', ped }; }
    }
    for (const c of policeList) {
      const dx = c.x - player.x;
      const dz = c.z - player.z;
      const d = Math.hypot(dx, dz);
      const facing = (dx * fx + dz * fz) / (d || 1);
      if (d < bestD && facing > 0.4) { bestD = d; best = { kind: 'cruiser', cruiser: c }; }
    }
    if (best) {
      police.addHeat(0.5);
      const pos = new THREE.Vector3(
        player.x + fx * 1.6, 1.2, player.z + fz * 1.6,
      );
      effects.sparks(pos, 6, 0xffe27a);
      if (best.kind === 'ped') peds.remove(best.ped);
      return best;
    }
    return null;
  }

  function update(dt) {
    shotCooldown = Math.max(0, shotCooldown - dt);
  }

  return { shoot, punch, update };
}
