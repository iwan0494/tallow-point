// Tallow Point — save.js
// Save / load localStorage (uang, posisi, misi, nyawa).
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-3).
// - Semua akses localStorage dibungkus try/catch (mode privat / headless
//   bisa menolak) — game tidak boleh crash karena save gagal.
// - Saat load, wanted selalu 0 (polisi bubar) dan pemain jalan kaki di
//   posisi tersimpan; mobil pemain di-spawn ulang dekat safehouse.
// - Versi save (v:1) supaya save lama yang tidak cocok diabaikan.

import { SAVE } from "./config.js";

export const SaveManager = {
  // state: {cash, life, armor, missionIndex, playerX, playerZ, clockMinutes}
  save(state) {
    try {
      const data = {
        v: 1,
        cash: Math.floor(state.cash || 0),
        life: Math.round(state.life || 100),
        armor: Math.round(state.armor || 0),
        missionIndex: state.missionIndex || 0,
        playerX: state.playerX || 0,
        playerZ: state.playerZ || 0,
        clockMinutes: state.clockMinutes || 0,
        savedAt: Date.now(),
      };
      window.localStorage.setItem(SAVE.key, JSON.stringify(data));
      return true;
    } catch (err) {
      return false;
    }
  },

  load() {
    try {
      const raw = window.localStorage.getItem(SAVE.key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.v !== 1) return null;
      if (typeof data.cash !== "number" || typeof data.playerX !== "number") {
        return null;
      }
      return data;
    } catch (err) {
      return null;
    }
  },

  clear() {
    try {
      window.localStorage.removeItem(SAVE.key);
    } catch (err) {}
  },

  exists() {
    return this.load() !== null;
  },
};
