// effects.js — juice: spark particles on crashes, skid marks, debris puffs,
// a muzzle flash and a damage vignette flash. All visual-only, pooled so
// nothing allocates per frame. Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  var MAX_PARTICLES = 240;

  function createEffects(scene) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(MAX_PARTICLES * 3);
    var col = new Float32Array(MAX_PARTICLES * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var mat = new THREE.PointsMaterial({
      size: 0.5, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false,
    });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    var parts = [];
    for (var i = 0; i < MAX_PARTICLES; i++) {
      parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
      pos[i * 3 + 1] = -100; // park dead particles underground
    }

    var flashEl = null;

    function spawn(x, y, z, n, color, speed, up) {
      var made = 0;
      for (var i = 0; i < MAX_PARTICLES && made < n; i++) {
        var p = parts[i];
        if (p.alive) continue;
        p.alive = true;
        p.x = x; p.y = y; p.z = z;
        var a = Math.random() * Math.PI * 2;
        var s = speed * (0.4 + Math.random() * 0.8);
        p.vx = Math.cos(a) * s;
        p.vz = Math.sin(a) * s;
        p.vy = (up || 3) * Math.random();
        p.life = 0; p.max = 0.4 + Math.random() * 0.5;
        col[i * 3] = ((color >> 16) & 255) / 255;
        col[i * 3 + 1] = ((color >> 8) & 255) / 255;
        col[i * 3 + 2] = (color & 255) / 255;
        made++;
      }
      geo.attributes.color.needsUpdate = true;
    }

    function update(dt) {
      for (var i = 0; i < MAX_PARTICLES; i++) {
        var p = parts[i];
        if (!p.alive) continue;
        p.life += dt;
        if (p.life >= p.max) {
          p.alive = false;
          pos[i * 3 + 1] = -100;
          continue;
        }
        p.vy -= 12 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
        pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      }
      geo.attributes.position.needsUpdate = true;
    }

    function sparks(x, y, z) { spawn(x, y, z, 14, 0xffc860, 7, 4); }
    function debris(x, y, z) { spawn(x, y, z, 22, 0x8a7a6a, 5, 3); }
    function muzzle(x, y, z) { spawn(x, y, z, 6, 0xfff2a8, 10, 1); }

    // Red flash overlay for damage feedback (DOM, fades fast).
    function damageFlash() {
      if (!flashEl) {
        flashEl = document.createElement('div');
        flashEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;' +
          'background:radial-gradient(ellipse at center,transparent 55%,rgba(200,0,0,0.45));' +
          'opacity:0;transition:opacity 0.12s;z-index:5';
        var wrap = document.getElementById('game-wrap') || document.body;
        wrap.appendChild(flashEl);
      }
      flashEl.style.opacity = '1';
      setTimeout(function () { if (flashEl) flashEl.style.opacity = '0'; }, 130);
    }

    return {
      update: update, sparks: sparks, debris: debris,
      muzzle: muzzle, damageFlash: damageFlash,
    };
  }

  TP.Effects = { create: createEffects };
})(window.TP);
