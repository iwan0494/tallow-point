// Tallow Point — shared constants and content data.
// Every name, district, mission, fixer, crew member, weapon and police unit in the
// game is defined here, once, so the HUD, the map screen and the 3D city all agree.

export const GAME_TITLE = 'TALLOW POINT';
export const RADIO_STATION = 'RADIO TALLOW 98.4';
export const RADIO_SONG = "'Golden Hour'";
export const HERO_CAR_NAME = 'COMET GT';
export const HERO_CAR_COLOR = 0xffc21a; // sun-gold hero coupe

// City geometry: roads on a 52 m pitch; building blocks sit in the gaps BETWEEN
// roads, so no building ever covers a road. Block centres (6 per side):
export const BLOCK_CENTERS = [-130, -78, -26, 26, 78, 130];
export const BLOCKS = 6;
export const BLOCK = 40; // building block side, metres
export const ROAD = 12; // road width, metres
export const PITCH = BLOCK + ROAD; // 52 m between road centrelines
export const GRID = 7; // roads per side
export const HALF = (GRID * PITCH - ROAD) / 2; // 176 m, city edge
// Road centreline coordinates, west (-x) to east (+x), south (-z) to north (+z).
export const ROADS = [-156, -104, -52, 0, 52, 104, 156];

// Five districts. Each one owns a rectangle of blocks and a visual identity that
// must read differently from the others at a glance: facade palette, building
// height band, street prop and neon accent.
export const DISTRICTS = [
  {
    id: 'sunmere', name: 'SUNMERE', sub: 'PALMA STRAND', standing: 74, mood: 'FRIENDLY',
    cols: [0, 1], rows: [0, 1, 2, 3, 4, 5],
    palette: [0xf2d8a0, 0xffe9c4, 0xe8c98f, 0xfff3d6], facade: 0xf6ddab,
    height: [6, 14], accent: 0x2fae8f, prop: 'palm', blurb: 'Beachfront, palms and surf shacks.',
  },
  {
    id: 'crater', name: 'CRATER ROW', sub: 'THE FOUNDRY', standing: 58, mood: 'NEUTRAL',
    cols: [2, 3], rows: [0, 1, 2],
    palette: [0x8a4a38, 0x6e3b2c, 0x9c5a40, 0x7a4636], facade: 0x8a4a38,
    height: [8, 18], accent: 0xff7a2f, prop: 'smoke', blurb: 'Brickworks, chimneys and scrap yards.',
  },
  {
    id: 'neon', name: 'NEON MILE', sub: 'DOWNTOWN', standing: 52, mood: 'NEUTRAL',
    cols: [4, 5], rows: [0, 1, 2],
    palette: [0x2b2f4a, 0x3a2f5e, 0x1f2440, 0x4a2f6e], facade: 0x2b2f4a,
    height: [22, 46], accent: 0xff2fa0, prop: 'neon', blurb: 'Glass towers, casinos and neon signs.',
  },
  {
    id: 'marina', name: 'MARINA ROW', sub: 'THE HARBOR', standing: 66, mood: 'FRIENDLY',
    cols: [2, 3], rows: [3, 4, 5],
    palette: [0x3f6d8e, 0x2f5a78, 0x55889f, 0x6b9db5], facade: 0x3f6d8e,
    height: [10, 24], accent: 0x35c8ff, prop: 'crane', blurb: 'Docks, cranes and blue harbour light.',
  },
  {
    id: 'vesper', name: 'VESPER DOCKS', sub: 'THE YARDS', standing: 31, mood: 'HOSTILE',
    cols: [4, 5], rows: [3, 4, 5],
    palette: [0x3a2f52, 0x2c2340, 0x4a3560, 0x241c33], facade: 0x3a2f52,
    height: [7, 15], accent: 0xb46bff, prop: 'container', blurb: 'Warehouses, containers and locked gates.',
  },
];

// The five story missions. Each has a number, a stage count, a fixer, a payout,
// a home district and a one-line objective.
export const MISSIONS = [
  {
    n: 1, name: 'COURIER RUN', fixer: 'Sinta Marlowe', district: 'sunmere',
    payout: 500, time: 150, objective: 'Reach the drop-off in Sunmere',
    dialog: 'Drop it clean and the Strand is yours.',
  },
  {
    n: 2, name: 'HOT PURSUIT', fixer: 'Bram Oka', district: 'crater',
    payout: 800, time: 150, objective: 'Outrun the Tallow PD tail in Crater Row',
    dialog: 'They called Air One. Don’t stop.',
  },
  {
    n: 3, name: 'BOOST THE COMET', fixer: 'Lena Voss', district: 'neon',
    payout: 1200, time: 180, objective: 'Steal the gold Comet on Neon Mile',
    dialog: 'The Comet is yours if you can take it.',
  },
  {
    n: 4, name: 'NIGHT SHIFT', fixer: 'Raka Dune', district: 'vesper',
    payout: 1500, time: 180, objective: 'Lose the heat at Vesper Docks',
    dialog: 'Docks close at midnight. Move.',
  },
  {
    n: 5, name: 'KINGPIN', fixer: 'Nadia Ferrante', district: 'neon',
    payout: 1900, time: 210, objective: 'Take the score to the Neon Mile',
    dialog: 'One last score, then we own the Mile.',
  },
];

// Fixers, with a portrait colour and initials for the HUD portrait tiles.
export const FIXERS = {
  'Sinta Marlowe': { initials: 'SM', color: '#2fae8f', role: 'FIXER · SUNMERE' },
  'Bram Oka': { initials: 'BO', color: '#e05a2b', role: 'FIXER · CRATER ROW' },
  'Lena Voss': { initials: 'LV', color: '#c98a1b', role: 'FIXER · NEON MILE' },
  'Raka Dune': { initials: 'RD', color: '#7a5cff', role: 'FIXER · VESPER DOCKS' },
  'Nadia Ferrante': { initials: 'NF', color: '#ff2fa0', role: 'FIXER · NEON MILE' },
};

// Crew cards shown on the HUD: name, ability and portrait colour.
export const CREW = [
  { name: 'Sinta', role: 'Driver', ability: 'SWAP PLATES', initials: 'SM', color: '#2fae8f' },
  { name: 'Bram', role: 'Muscle', ability: 'RAMMING', initials: 'BO', color: '#e05a2b' },
  { name: 'Lena', role: 'Mechanic', ability: 'QUICK FIX', initials: 'LV', color: '#c98a1b' },
  { name: 'Raka', role: 'Lookout', ability: 'SPOTTER', initials: 'RD', color: '#7a5cff' },
];

// Weapon slots: name, ammo, price, locked state.
export const WEAPONS = [
  { name: 'PISTOL', ammo: '12/48', price: 0, locked: false },
  { name: 'SMG', ammo: '30/90', price: 450, locked: false },
  { name: 'SHOTGUN', ammo: '6/24', price: 1200, locked: true },
  { name: 'RIFLE', ammo: '0/0', price: 2500, locked: true },
];

// Named police units with their tactical role.
export const POLICE_UNITS = [
  { call: 'TALLOW-12', role: 'RAMMING' },
  { call: 'TALLOW-07', role: 'ROADBLOCK' },
  { call: 'TALLOW-31', role: 'PIT' },
  { call: 'TALLOW-04', role: 'SHORE WATCH' },
  { call: 'AIR-1', role: 'SPOTLIGHT' },
];

export const RESPECT_RANKS = ['ROOKIE', 'WHEELMAN', 'SHOT CALLER', 'FIXER', 'KINGPIN'];
export const RESPECT_MAX = 250;

export const TRAFFIC_COUNT = 14;
export const PARKED_COUNT = 8;
export const PED_COUNT = 22;
export const BEACHGOER_COUNT = 10;

export const SAVE_KEY = 'tallow-point-save-v8';
export const BEST_KEY = 'tallow-point-best-v8';

// Tuning.
export const PLAYER_WALK_SPEED = 7;
export const PLAYER_RUN_SPEED = 11;
export const CAR_TOP_SPEED = 34;
export const CAR_ACCEL = 16;
export const CAR_BRAKE = 26;
export const CAR_TURN = 1.9;
export const WANTED_DECAY = 0.012; // stars per second while hidden
export const HELI_WANTED = 4;
export const ROADBLOCK_WANTED = 3;

/** Which district owns block (col, row)? col/row are 0..5, west to east, south to north. */
export function districtAt(col, row) {
  for (const d of DISTRICTS) {
    if (d.cols.includes(col) && d.rows.includes(row)) return d;
  }
  return DISTRICTS[0];
}

/** District that contains world point (x, z). Block col/row from the gap grid. */
export function districtAtPoint(x, z) {
  const col = Math.max(0, Math.min(BLOCKS - 1, Math.floor((x + 150) / PITCH)));
  const row = Math.max(0, Math.min(BLOCKS - 1, Math.floor((z + 150) / PITCH)));
  return districtAt(col, row);
}
