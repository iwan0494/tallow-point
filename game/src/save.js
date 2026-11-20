// save.js — autosave to localStorage (cash, position, mission progress,
// wanted). NEW LIFE wipes it. Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  var KEY = 'tallow-point-save-v1';

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        cash: state.cash,
        x: state.x, z: state.z,
        missionsDone: state.missionsDone,
        hour: state.hour,
        savedAt: Date.now(),
      }));
      return true;
    } catch (e) { return false; }
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) { return null; }
  }

  function clear() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  function has() {
    try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
  }

  TP.Save = { save: save, load: load, clear: clear, has: has, KEY: KEY };
})(window.TP);
