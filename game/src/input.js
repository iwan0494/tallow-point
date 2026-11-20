// Tallow Point — input.js
// Keyboard + mouse (drag orbit) untuk R5-2.
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-2).
// - Keyboard: WASD / panah (jalan + mengemudi), E (masuk/keluar/curi mobil),
//   Space (rem tangan), R (respawn — dipakai R5-3, sudah didengar di sini).
// - Mouse: drag di canvas = orbit kamera saat jalan kaki (yaw + pitch kecil).
// - `pressed(code)` = edge-triggered: true sekali per penekanan, lalu habis
//   saat `endFrame()` dipanggil di akhir tiap frame game.

const PREVENT_DEFAULT = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
]);

export class Input {
  constructor(canvas) {
    this.down = new Set();
    this.justPressed = new Set();
    this.orbitYaw = 0; // radian, diakumulasi dari drag mouse.
    this.orbitPitch = 0; // radian, diklem kecil.
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;

    window.addEventListener("keydown", (e) => {
      if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (!this.down.has(e.code)) this.justPressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener("blur", () => {
      this.down.clear();
    });

    if (canvas) {
      canvas.addEventListener("pointerdown", (e) => {
        this._dragging = true;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!this._dragging) return;
        const dx = e.clientX - this._lastX;
        const dy = e.clientY - this._lastY;
        this._lastX = e.clientX;
        this._lastY = e.clientY;
        this.orbitYaw -= dx * 0.005;
        this.orbitPitch = Math.max(
          -0.25,
          Math.min(0.35, this.orbitPitch + dy * 0.003)
        );
      });
      const stop = () => {
        this._dragging = false;
      };
      canvas.addEventListener("pointerup", stop);
      canvas.addEventListener("pointercancel", stop);
    }
  }

  isDown(code) {
    return this.down.has(code);
  }

  // true kalau tombol baru ditekan sejak frame sebelumnya.
  pressed(code) {
    return this.justPressed.has(code);
  }

  // Dipanggil di akhir tiap frame game: edge trigger habis masa berlakunya.
  endFrame() {
    this.justPressed.clear();
  }

  // Arah jalan/mengemudi dari WASD/panah, relatif terhadap yaw kamera.
  // Kembalikan {x, z} ternormalisasi di bidang XZ (x = kanan, z = maju),
  // atau null kalau tidak ada tombol gerak yang ditekan.
  moveVector() {
    let x = 0;
    let z = 0;
    if (this.isDown("KeyW") || this.isDown("ArrowUp")) z += 1;
    if (this.isDown("KeyS") || this.isDown("ArrowDown")) z -= 1;
    if (this.isDown("KeyA") || this.isDown("ArrowLeft")) x -= 1;
    if (this.isDown("KeyD") || this.isDown("ArrowRight")) x += 1;
    if (x === 0 && z === 0) return null;
    const len = Math.hypot(x, z);
    return { x: x / len, z: z / len };
  }

  get throttle() {
    return this.isDown("KeyW") || this.isDown("ArrowUp");
  }

  get brake() {
    return this.isDown("KeyS") || this.isDown("ArrowDown");
  }

  get steerLeft() {
    return this.isDown("KeyA") || this.isDown("ArrowLeft");
  }

  get steerRight() {
    return this.isDown("KeyD") || this.isDown("ArrowRight");
  }

  get handbrake() {
    return this.isDown("Space");
  }

  get interact() {
    return this.pressed("KeyE");
  }
}
