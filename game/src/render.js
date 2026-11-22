// Renderer + lighting rig. One warm directional sun (golden hour) or a high noon
// sun (daytime beach), a hemisphere fill, ACES tone mapping and PCF shadows.
// setTimeOfDay('golden' | 'day') re-lights the whole scene for the shot plan.

import { HALF } from './config.js';

export function createRender(canvas) {
  const THREE = window.THREE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xff9a52);
  scene.fog = new THREE.Fog(0xff9a52, 220, 520);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 8, -14);

  const hemi = new THREE.HemisphereLight(0xffd9a8, 0x3a2f2a, 0.9);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffb45e, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 420;
  sun.shadow.camera.left = -130;
  sun.shadow.camera.right = 130;
  sun.shadow.camera.top = 130;
  sun.shadow.camera.bottom = -130;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.4;
  scene.add(sun);
  scene.add(sun.target);

  // A cool fill from the opposite side so shadowed faces never go black.
  const fill = new THREE.DirectionalLight(0x8fb8ff, 0.9);
  fill.position.set(-60, 80, -80);
  scene.add(fill);

  let mode = 'golden';

  function setTimeOfDay(next, sunDisc, sunGlow) {
    mode = next;
    if (next === 'day') {
      scene.background.setHex(0x6fc3ef);
      scene.fog.color.setHex(0x9fd4f2);
      scene.fog.near = 260;
      scene.fog.far = 700;
      hemi.color.setHex(0xbfe3ff);
      hemi.groundColor.setHex(0x8a7a5a);
      hemi.intensity = 1.1;
      sun.color.setHex(0xfff2cf);
      sun.intensity = 3.0;
      sun.position.set(60, 190, 40);
      sun.target.position.set(0, 0, 0);
      fill.intensity = 0.7;
      renderer.toneMappingExposure = 1.0;
      if (sunDisc) {
        sunDisc.position.set(120, 220, -260);
        sunDisc.material.color.setHex(0xfff6c9);
        sunDisc.scale.setScalar(1.4);
        sunDisc.lookAt(camera.position);
      }
      if (sunGlow) {
        sunGlow.position.copy(sunDisc.position).multiplyScalar(1.001);
        sunGlow.material.opacity = 0.25;
        sunGlow.lookAt(camera.position);
      }
    } else {
      // Golden hour: low warm sun in the west, orange-violet sky.
      scene.background.setHex(0xff9a52);
      scene.fog.color.setHex(0xff9a52);
      scene.fog.near = 220;
      scene.fog.far = 520;
      hemi.color.setHex(0xffd9a8);
      hemi.groundColor.setHex(0x3a2f2a);
      hemi.intensity = 0.9;
      sun.color.setHex(0xffb45e);
      sun.intensity = 2.6;
      sun.position.set(-180, 55, -40);
      sun.target.position.set(0, 0, 0);
      fill.intensity = 0.9;
      renderer.toneMappingExposure = 1.05;
      if (sunDisc) {
        sunDisc.position.set(-300, 42, -120);
        sunDisc.material.color.setHex(0xffdf8a);
        sunDisc.scale.setScalar(1.6);
        sunDisc.lookAt(camera.position);
      }
      if (sunGlow) {
        sunGlow.position.copy(sunDisc.position).multiplyScalar(1.001);
        sunGlow.material.opacity = 0.4;
        sunGlow.lookAt(camera.position);
      }
    }
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  // Keep the shadow frustum centred on the action.
  function followSun(x, z) {
    sun.position.x = x + (mode === 'day' ? 60 : -180);
    sun.position.z = z + (mode === 'day' ? 40 : -40);
    sun.position.y = mode === 'day' ? 190 : 55;
    sun.target.position.set(x, 0, z);
    sun.target.updateMatrixWorld();
  }

  return {
    renderer, scene, camera, sun, hemi,
    get mode() {
      return mode;
    },
    setTimeOfDay,
    followSun,
    resize,
    render() {
      renderer.render(scene, camera);
    },
  };
}
