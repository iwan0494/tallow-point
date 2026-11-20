// Tallow Point — hud.js
// HUD + minimap (DOM + canvas 2D). Kaya dan terbaca di screenshot 1024x576.
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-2).
// Prinsip (skill frontend-design): satu aksen emas, teks putih dengan bayangan,
// panel semi-transparan, hierarki jelas — bintang wanted besar kiri atas,
// uang + jam kanan atas, objektif misi tengah atas, LIFE/ARMOR kiri bawah,
// speedometer + minimap kanan bawah.
// Minimap: seluruh kota, segitiga pemain BESAR, mobil titik putih, objektif
// berlian emas. Update teks di-throttle 100 ms; minimap digambar tiap frame.

import { GAME } from "./config.js";

const MAX_STARS = 5;

function formatCash(n) {
  return "$" + Math.floor(n).toLocaleString("en-US");
}

function formatClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

export class HUD {
  constructor() {
    this.el = {
      wanted: document.querySelector("#hud-wanted"),
      stars: document.querySelector("#hud-stars"),
      district: document.querySelector("#hud-district"),
      cash: document.querySelector("#hud-cash"),
      clock: document.querySelector("#hud-clock"),
      missionTitle: document.querySelector("#mission-title"),
      missionObjective: document.querySelector("#mission-objective"),
      lifeFill: document.querySelector("#life-fill"),
      lifeText: document.querySelector("#life-text"),
      armorFill: document.querySelector("#armor-fill"),
      armorText: document.querySelector("#armor-text"),
      speedNum: document.querySelector("#speed-num"),
      modeChip: document.querySelector("#mode-chip"),
      toast: document.querySelector("#toast"),
      hint: document.querySelector("#hint"),
      minimap: document.querySelector("#minimap"),
      policeList: document.querySelector("#police-list"),
      missionTimer: document.querySelector("#mission-timer"),
      damageFlash: document.querySelector("#damage-flash"),
      bustedOverlay: document.querySelector("#busted-overlay"),
      bustedTitle: document.querySelector("#busted-title"),
      bustedSub: document.querySelector("#busted-sub"),
      crosshair: document.querySelector("#crosshair"),
    };
    // Bintang wanted: 5 span, diisi sesuai level.
    this.starSpans = [];
    if (this.el.stars) {
      for (let i = 0; i < MAX_STARS; i++) {
        const s = document.createElement("span");
        s.className = "star";
        s.textContent = "★";
        this.el.stars.appendChild(s);
        this.starSpans.push(s);
      }
    }
    this.minimapCtx = this.el.minimap ? this.el.minimap.getContext("2d") : null;
    this._textTimer = 0;
    this._toastTimer = 0;
    this._hintTimer = 14; // hint kontrol menghilang setelah 14 detik.
    this._lastWanted = -1;
    this._lastObjective = "";
    this._lastMissionTitle = "";
    this._lastPoliceText = "";
    this._lastTimerText = "";
    this._flash = 0; // 0..1, opacity flash merah saat tertembak.
    this._overlay = null; // null | "BUSTED" | "DEAD".
  }

  // Flash merah singkat saat pemain tertembak (game-feel).
  damageFlash(amount) {
    this._flash = Math.min(0.65, this._flash + (amount || 0.35));
  }

  // Layar penuh BUSTED / DEAD + petunjuk respawn (R).
  setOverlay(kind) {
    if (kind === this._overlay) return;
    this._overlay = kind;
    if (!this.el.bustedOverlay) return;
    if (!kind) {
      this.el.bustedOverlay.classList.remove("show");
      return;
    }
    if (this.el.bustedTitle) {
      this.el.bustedTitle.textContent = kind === "BUSTED" ? "BUSTED" : "WASTED";
      this.el.bustedTitle.classList.toggle("dead", kind === "DEAD");
    }
    if (this.el.bustedSub) {
      this.el.bustedSub.textContent =
        kind === "BUSTED"
          ? "Ditangkap polisi — uang berkurang 10%"
          : "Nyawamu habis — uang berkurang 10%";
    }
    this.el.bustedOverlay.classList.add("show");
  }

  // Pesan tengah layar (mis. "Mobil dicuri!"), menghilang sendiri.
  showToast(text, ms) {
    if (!this.el.toast) return;
    this.el.toast.textContent = text;
    this.el.toast.classList.add("show");
    this._toastTimer = (ms || 2500) / 1000;
  }

  // state: {wanted, cash, clockMinutes, district, life, armor, speedKmh,
  //   driving, objective, objectiveDone, missionTitle, missionTimer,
  //   policeText, policeUnits, playerX, playerZ, playerHeading,
  //   vehicles, objectiveX, objectiveZ, fps}
  update(dt, state) {
    // Flash merah: memudar dengan waktu nyata.
    if (this._flash > 0) {
      this._flash = Math.max(0, this._flash - dt * 1.6);
      if (this.el.damageFlash) {
        this.el.damageFlash.style.opacity = this._flash.toFixed(2);
      }
    }
    // Crosshair: hanya saat jalan kaki (mode tembak).
    if (this.el.crosshair) {
      this.el.crosshair.classList.toggle("hidden", !!state.driving);
    }
    // Toast: hitung mundur lalu sembunyikan.
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0 && this.el.toast) {
        this.el.toast.classList.remove("show");
      }
    }
    // Hint kontrol: sembunyikan setelah 14 detik.
    if (this._hintTimer > 0) {
      this._hintTimer -= dt;
      if (this._hintTimer <= 0 && this.el.hint) {
        this.el.hint.classList.add("hidden");
      }
    }
    // Teks: cukup 10x per detik (hemat CPU di SwiftShader).
    this._textTimer -= dt;
    if (this._textTimer <= 0) {
      this._textTimer = 0.1;
      this._updateText(state);
    }
    this._drawMinimap(state);
  }

  _updateText(state) {
    // Bintang wanted.
    if (state.wanted !== this._lastWanted) {
      this._lastWanted = state.wanted;
      this.starSpans.forEach((s, i) => {
        s.classList.toggle("on", i < state.wanted);
      });
      if (this.el.wanted) {
        this.el.wanted.classList.toggle("hot", state.wanted >= 3);
        this.el.wanted.classList.toggle("active", state.wanted > 0);
      }
    }
    if (this.el.district) this.el.district.textContent = state.district || "";
    if (this.el.cash) this.el.cash.textContent = formatCash(state.cash);
    if (this.el.clock) this.el.clock.textContent = formatClock(state.clockMinutes);
    // Objektif misi.
    if (state.objective !== this._lastObjective) {
      this._lastObjective = state.objective;
      if (this.el.missionObjective) this.el.missionObjective.textContent = state.objective;
      if (this.el.missionObjective) {
        this.el.missionObjective.classList.toggle("done", !!state.objectiveDone);
      }
    }
    // Judul misi (berubah tiap misi).
    if (state.missionTitle && state.missionTitle !== this._lastMissionTitle) {
      this._lastMissionTitle = state.missionTitle;
      if (this.el.missionTitle) this.el.missionTitle.textContent = state.missionTitle;
    }
    // Timer misi (mis. kurir 75 detik -> "01:15").
    const timerText =
      state.missionTimer === null || state.missionTimer === undefined
        ? ""
        : "⏱ " +
          String(Math.floor(Math.max(0, state.missionTimer) / 60)).padStart(2, "0") +
          ":" +
          String(Math.floor(Math.max(0, state.missionTimer) % 60)).padStart(2, "0");
    if (timerText !== this._lastTimerText) {
      this._lastTimerText = timerText;
      if (this.el.missionTimer) {
        this.el.missionTimer.textContent = timerText;
        this.el.missionTimer.classList.toggle("urgent", !!state.missionTimer && state.missionTimer < 15);
      }
    }
    // Daftar unit polisi (hanya saat wanted > 0).
    const policeText = state.policeText || "";
    if (policeText !== this._lastPoliceText) {
      this._lastPoliceText = policeText;
      if (this.el.policeList) {
        this.el.policeList.textContent = policeText;
        this.el.policeList.classList.toggle("hidden", policeText === "");
      }
    }
    // LIFE / ARMOR.
    if (this.el.lifeFill) {
      this.el.lifeFill.style.width = Math.max(0, Math.min(100, state.life)) + "%";
      this.el.lifeFill.classList.toggle("low", state.life <= 30);
    }
    if (this.el.lifeText) this.el.lifeText.textContent = Math.round(state.life);
    if (this.el.armorFill) {
      this.el.armorFill.style.width = Math.max(0, Math.min(100, state.armor)) + "%";
    }
    if (this.el.armorText) this.el.armorText.textContent = Math.round(state.armor);
    // Speedometer + mode.
    if (this.el.speedNum) {
      this.el.speedNum.textContent = state.driving ? Math.round(state.speedKmh) : 0;
    }
    if (this.el.modeChip) {
      this.el.modeChip.textContent = state.driving ? "MENGEMUDI" : "JALAN KAKI";
    }
  }

  _drawMinimap(state) {
    const ctx = this.minimapCtx;
    const canvas = this.el.minimap;
    if (!ctx || !canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    const half = GAME.halfCity + 40;
    const toMap = (x, z) => [
      ((x + half) / (half * 2)) * W,
      ((z + half) / (half * 2)) * H,
    ];

    // Latar: ungu gelap (sunset) + blok kota.
    ctx.fillStyle = "#241a2e";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#4a3a52";
    const blockPx = (GAME.blockSize / (half * 2)) * W;
    for (let bz = 0; bz < GAME.grid; bz++) {
      for (let bx = 0; bx < GAME.grid; bx++) {
        const cx = -GAME.halfCity + GAME.roadWidth + GAME.blockSize / 2 + bx * GAME.roadPitch;
        const cz = -GAME.halfCity + GAME.roadWidth + GAME.blockSize / 2 + bz * GAME.roadPitch;
        const [mx, my] = toMap(cx - GAME.blockSize / 2, cz - GAME.blockSize / 2);
        ctx.fillRect(mx, my, blockPx, blockPx);
      }
    }
    // Jalan: garis gelap di antara blok.
    ctx.strokeStyle = "#171019";
    ctx.lineWidth = Math.max(2, (GAME.roadWidth / (half * 2)) * W * 0.8);
    for (let i = 0; i <= GAME.grid; i++) {
      const line = -GAME.halfCity + GAME.roadWidth / 2 + i * GAME.roadPitch;
      const [x1] = toMap(line, 0);
      const [, y1] = toMap(0, line);
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y1);
      ctx.lineTo(W, y1);
      ctx.stroke();
    }
    // Titik objektif: berlian emas.
    if (state.objectiveX !== undefined) {
      const [ox, oy] = toMap(state.objectiveX, state.objectiveZ);
      ctx.fillStyle = "#ffd23e";
      ctx.beginPath();
      ctx.moveTo(ox, oy - 6);
      ctx.lineTo(ox + 6, oy);
      ctx.lineTo(ox, oy + 6);
      ctx.lineTo(ox - 6, oy);
      ctx.closePath();
      ctx.fill();
    }
    // Mobil lain: titik putih kecil. Mobil pemain tidak digambar di sini
    // (segitiga pemain yang menandainya).
    if (state.vehicles) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const v of state.vehicles) {
        if (v.kind === "player") continue;
        const [vx, vy] = toMap(v.pos.x, v.pos.z);
        ctx.fillRect(vx - 1.5, vy - 1.5, 3, 3);
      }
    }
    // Polisi: cruiser = kotak biru, roadblock = kotak oranye, polisi jalan
    // kaki = titik merah, helikopter = berlian cyan. Berkedip merah-biru.
    if (state.policeUnits) {
      const blink = Math.floor(performance.now() / 200) % 2 === 0;
      for (const u of state.policeUnits) {
        const [ux, uy] = toMap(u.x, u.z);
        if (u.kind === "cruiser") {
          ctx.fillStyle = blink ? "#3a6aff" : "#ff3a3a";
          ctx.fillRect(ux - 3, uy - 3, 6, 6);
        } else if (u.kind === "roadblock") {
          ctx.fillStyle = "#ff8a2a";
          ctx.fillRect(ux - 3, uy - 3, 6, 6);
        } else if (u.kind === "cop") {
          ctx.fillStyle = "#ff3a3a";
          ctx.beginPath();
          ctx.arc(ux, uy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (u.kind === "heli") {
          ctx.fillStyle = "#4dd8ff";
          ctx.beginPath();
          ctx.moveTo(ux, uy - 5);
          ctx.lineTo(ux + 5, uy);
          ctx.lineTo(ux, uy + 5);
          ctx.lineTo(ux - 5, uy);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    // Pemain: segitiga BESAR kuning, berputar sesuai arah hadap.
    const [px, py] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    // Heading 0 = +Z (bawah di minimap, karena z+ ke bawah) — putar segitiga
    // supaya ujungnya menunjuk arah hadap pemain.
    ctx.rotate(Math.atan2(Math.sin(state.playerHeading), Math.cos(state.playerHeading)) + Math.PI);
    ctx.fillStyle = "#ffd23e";
    ctx.strokeStyle = "#1a1024";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 8);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
