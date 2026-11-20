// Tallow Point — random.js
// RNG deterministik (mulberry32) + helper. Kota yang sama selalu muncul
// dari seed yang sama — penting supaya screenshot dan replay konsisten.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// RNG kecil dengan helper. Satu instance per subsistem supaya urutan
// pemakaian tidak saling menggeser (kota, lalu lintas, pejalan kaki).
export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    // Float di [min, max).
    range(min, max) {
      return min + next() * (max - min);
    },
    // Integer di [min, max] (inklusif).
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    // Ambil satu elemen array.
    pick(arr) {
      return arr[Math.floor(next() * arr.length)];
    },
    // true dengan peluang p (0..1).
    chance(p) {
      return next() < p;
    },
    // Acak urutan array (Fisher-Yates), kembalikan array baru.
    shuffle(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
}
