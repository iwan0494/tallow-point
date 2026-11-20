// random.js — deterministic RNG (mulberry32) + helpers. Seed from URL (?seed=)
// so screenshots reproduce exactly. Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seed) {
    var next = mulberry32(seed);
    return {
      next: next,
      range: function (lo, hi) { return lo + next() * (hi - lo); },
      int: function (lo, hi) { return Math.floor(lo + next() * (hi - lo + 1)); },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      chance: function (p) { return next() < p; },
    };
  }

  // Seed from the query string (?seed=1) or the default 1337.
  function seedFromUrl() {
    try {
      var m = /[?&]seed=(\d+)/.exec(window.location.search || '');
      return m ? parseInt(m[1], 10) : 1337;
    } catch (e) { return 1337; }
  }

  TP.RNG = { makeRng: makeRng, seedFromUrl: seedFromUrl, mulberry32: mulberry32 };
})(window.TP);
