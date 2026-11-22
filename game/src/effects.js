// Juice: trauma-based screen shake, spark/smoke particles and muzzle flashes.
// Shake is a camera offset only — it never moves a body. Particles are plain
// three.js meshes pooled and recycled, so the effect layer costs nothing to keep.

export function createEffects(scene) {
  const THREE = window.THREE;
  let trauma = 0;
  let shakeTime = 0;
  const particles = [];
  const pool = [];

  function spawnParticle(pos, vel, color, size, life) {
    let p = pool.pop();
    if (!p) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }),
      );
      scene.add(mesh);
      p = { mesh, vel: new THREE.Vector3(), life: 0, maxLife: 1 };
    }
    p.mesh.visible = true;
    p.mesh.position.copy(pos);
    p.mesh.scale.setScalar(size);
    p.mesh.material.color.setHex(color);
    p.mesh.material.opacity = 1;
    p.vel.copy(vel);
    p.life = life;
    p.maxLife = life;
    particles.push(p);
  }

  return {
    addTrauma(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    /** Decaying shake offset (real time) for the camera. */
    shakeOffset(dt) {
      if (trauma <= 0) return { x: 0, y: 0 };
      trauma = Math.max(0, trauma - dt * 1.4);
      const s = trauma * trauma;
      shakeTime += dt * 31;
      return {
        x: 0.45 * s * Math.sin(shakeTime * 1.7),
        y: 0.32 * s * Math.sin(shakeTime * 2.3),
      };
    },
    sparks(pos, count, color) {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const v = new THREE.Vector3(Math.cos(a) * (2 + Math.random() * 6), 1 + Math.random() * 4, Math.sin(a) * (2 + Math.random() * 6));
        spawnParticle(pos, v, color || 0xffc21a, 0.14 + Math.random() * 0.16, 0.4 + Math.random() * 0.3);
      }
    },
    smoke(pos, count) {
      for (let i = 0; i < count; i += 1) {
        const v = new THREE.Vector3((Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2);
        spawnParticle(pos, v, 0x888888, 0.5 + Math.random() * 0.5, 0.9 + Math.random() * 0.6);
      }
    },
    muzzle(pos) {
      spawnParticle(pos, new THREE.Vector3(0, 0.4, 0), 0xffe27a, 0.5, 0.08);
      this.sparks(pos, 4, 0xffe27a);
    },
    update(dt) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
          pool.push(p);
          particles.splice(i, 1);
          continue;
        }
        p.vel.y -= 6 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.material.opacity = p.life / p.maxLife;
        p.mesh.rotation.x += dt * 4;
        p.mesh.rotation.y += dt * 5;
      }
    },
  };
}
