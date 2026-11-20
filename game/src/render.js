// Tallow Point — render.js
// Renderer + pencahayaan golden-hour (skill threejs-materials-lighting).
// Ditulis fresh dari R5_SPEC_2026-11-19.md (R5-1).
// Matahari rendah hangat (key 2.7) + hemisphere fill + ACES + bayangan PCF 2048
// + kubah langit gradasi oranye-ungu + lampu jalan emissive.

import * as THREE from "three";
import { GOLDEN_HOUR } from "./config.js";

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // lembut sejak r182.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = GOLDEN_HOUR.toneMappingExposure;
  return renderer;
}

// Kubah langit: gradasi zenit ungu -> horizon oranye + piringan matahari
// yang bersinar di arah matahari terbenam. Shader kecil, tanpa tekstur.
export function createSky() {
  const geo = new THREE.SphereGeometry(900, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: new THREE.Color(GOLDEN_HOUR.skyZenith) },
      mid: { value: new THREE.Color(GOLDEN_HOUR.skyMid) },
      horizon: { value: new THREE.Color(GOLDEN_HOUR.skyHorizon) },
      sunDir: { value: sunDirection() },
      sunColor: { value: new THREE.Color(GOLDEN_HOUR.sunDiscColor) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      uniform vec3 zenith;
      uniform vec3 mid;
      uniform vec3 horizon;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      void main() {
        float h = clamp(vDir.y, -0.08, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.28, h));
        col = mix(col, zenith, smoothstep(0.22, 0.75, h));
        float sunAmount = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 90.0);
        float glow = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 7.0);
        col += sunColor * (sunAmount * 1.4 + glow * 0.55);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = "sky";
  return sky;
}

// Arah matahari dari elevasi + azimuth (derajat). 0 derajat azimuth = +Z
// (selatan), 270 = -X (barat). Sunset di barat, rendah di horizon.
export function sunDirection() {
  const el = THREE.MathUtils.degToRad(GOLDEN_HOUR.sunElevationDeg);
  const az = THREE.MathUtils.degToRad(GOLDEN_HOUR.sunAzimuthDeg);
  return new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az)
  );
}

export function createGoldenHourLights(scene) {
  // Key: matahari terbenam, hangat, intensitas ~2.7, bayangan panjang.
  const sun = new THREE.DirectionalLight(GOLDEN_HOUR.sunColor, GOLDEN_HOUR.sunIntensity);
  const dir = sunDirection();
  sun.position.copy(dir).multiplyScalar(GOLDEN_HOUR.sunDistance);
  sun.castShadow = true;
  sun.shadow.mapSize.set(GOLDEN_HOUR.shadowMapSize, GOLDEN_HOUR.shadowMapSize);
  const cam = sun.shadow.camera;
  const f = GOLDEN_HOUR.shadowFrustum;
  cam.left = -f;
  cam.right = f;
  cam.top = f;
  cam.bottom = -f;
  cam.near = 10;
  cam.far = GOLDEN_HOUR.sunDistance + 260;
  sun.shadow.bias = GOLDEN_HOUR.shadowBias;
  sun.shadow.normalBias = GOLDEN_HOUR.shadowNormalBias;
  scene.add(sun);
  scene.add(sun.target);

  // Fill: hemisphere langit hangat / tanah gelap.
  const hemi = new THREE.HemisphereLight(
    GOLDEN_HOUR.hemiSky,
    GOLDEN_HOUR.hemiGround,
    GOLDEN_HOUR.hemiIntensity
  );
  scene.add(hemi);

  // Bounce fill dari timur (tanpa bayangan): mengangkat sisi yang
  // membelakangi matahari supaya fasad tetap terbaca, bukan siluet hitam.
  const bounceEl = THREE.MathUtils.degToRad(GOLDEN_HOUR.bounceElevationDeg);
  const bounceAz = THREE.MathUtils.degToRad(GOLDEN_HOUR.bounceAzimuthDeg);
  const bounce = new THREE.DirectionalLight(
    GOLDEN_HOUR.bounceColor,
    GOLDEN_HOUR.bounceIntensity
  );
  bounce.position.set(
    Math.cos(bounceEl) * Math.sin(bounceAz),
    Math.sin(bounceEl),
    Math.cos(bounceEl) * Math.cos(bounceAz)
  ).multiplyScalar(200);
  scene.add(bounce);

  return { sun, hemi, bounce };
}

// Pindahkan frustum bayangan mengikuti titik fokus (pemain/mobil) supaya
// bayangan tetap tajam di area yang terlihat, bukan tersebar se-kota.
export function followSunTarget(sun, focus) {
  const dir = sunDirection();
  sun.position.copy(focus).addScaledVector(dir, GOLDEN_HOUR.sunDistance);
  sun.target.position.copy(focus);
  sun.target.updateMatrixWorld();
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(GOLDEN_HOUR.fogColor, GOLDEN_HOUR.fogDensity);
  scene.add(createSky());
  const lights = createGoldenHourLights(scene);
  return { scene, ...lights };
}
