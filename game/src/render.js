// render.js — renderer, golden-hour lighting, sky gradient, shadows.
// The sun sits low (+110,50,30) so facades facing the camera glow warm and
// shadows stretch long. The shadow frustum follows the player so shadows
// stay sharp wherever the action is. Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  var cfg = TP.Config;

  function makeSkyTexture() {
    var c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#7a3a6e');   // magenta dusk overhead
    grad.addColorStop(0.55, '#c65a7a'); // rose
    grad.addColorStop(0.8, '#ff8c42');  // orange horizon
    grad.addColorStop(1, '#ffd27a');    // low gold
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function setupRenderer(canvas) {
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cfg.exposure;
    return renderer;
  }

  function setupScene() {
    var scene = new THREE.Scene();
    scene.background = makeSkyTexture();
    scene.fog = new THREE.Fog(cfg.fogColor, 120, 420);

    // Warm low sun: the key light. Intensity 2.6, long shadows.
    var sun = new THREE.DirectionalLight(cfg.sunColor, cfg.sunIntensity);
    sun.position.set(cfg.sunPos.x, cfg.sunPos.y, cfg.sunPos.z);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var sc = sun.shadow.camera;
    sc.near = 1; sc.far = 400;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    scene.add(sun.target);

    // Hemisphere fill: warm sky, dark ground — lifts the shadow side.
    var hemi = new THREE.HemisphereLight(cfg.hemiSky, cfg.hemiGround, cfg.hemiIntensity);
    scene.add(hemi);

    return { scene: scene, sun: sun, hemi: hemi };
  }

  // Keep the sun + shadow frustum centred on the player so shadows stay crisp.
  function followPlayer(sun, px, pz) {
    sun.position.set(px + cfg.sunPos.x, cfg.sunPos.y, pz + cfg.sunPos.z);
    sun.target.position.set(px, 0, pz);
    sun.target.updateMatrixWorld();
  }

  function resize(renderer, camera) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  TP.Render = {
    setupRenderer: setupRenderer, setupScene: setupScene,
    followPlayer: followPlayer, resize: resize,
  };
})(window.TP);
