// Save / load: cash, respect, missions completed, current district, hero condition
// and the player's position, in localStorage. A missing or corrupt save is ignored.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.round(state.cash),
      respect: Math.round(state.respect),
      missionsDone: state.missionsDone,
      condition: Math.round(state.condition),
      carsStolen: state.carsStolen,
      kmDriven: Math.round(state.kmDriven * 10) / 10,
      x: Math.round(state.player.x * 10) / 10,
      z: Math.round(state.player.z * 10) / 10,
      heading: Math.round(state.player.heading * 100) / 100,
      inCar: state.player.inCar,
      act: state.act,
      savedAt: new Date().toISOString(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: the game then simply does not persist.
  }
}
