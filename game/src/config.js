// Tallow Point — GTA VI (make.fun gta6-01, ronde 5)
// config.js — semua konstanta game di satu tempat.
// Ditulis fresh dari R5_SPEC_2026-11-19.md + R4_SPEC_2026-11-19.md (R5-1).
// Nilai di sini adalah "sumber kebenaran" untuk kota, kamera, dan golden-hour.

export const GAME = {
  title: "Tallow Point",
  subtitle: "GTA VI — Vice City",
  seed: 20261119,
  // Ukuran dunia (meter). Kota 7x7 blok; jalan di antara blok.
  grid: 7,
  blockSize: 36,
  roadWidth: 10,
  // Jarak antar garis tengah jalan = blockSize + roadWidth.
  get roadPitch() {
    return this.blockSize + this.roadWidth;
  },
  // Setengah lebar kota total (meter): 7 blok + 8 jalan, dibagi dua.
  get halfCity() {
    return (this.grid * this.blockSize + (this.grid + 1) * this.roadWidth) / 2;
  },
};

// Nama + karakter 5 distrik. Tiap distrik punya palet bangunan sendiri.
export const DISTRICTS = [
  {
    id: "kessel",
    name: "Kessel Wharf",
    // Barat: gudang + dermaga, bangunan rendah lebar, warna kusam.
    region: { x0: 0, x1: 2, z0: 0, z1: 7 },
    kinds: ["warehouse", "warehouse", "kiosk"],
    palette: [0x8a7a68, 0x7a6a5c, 0x9a8a74, 0x6e6258],
    height: [6, 14],
    roughness: 0.9,
  },
  {
    id: "northline",
    name: "Northline",
    // Utara: menara kaca + kantor, bangunan tinggi.
    region: { x0: 2, x1: 5, z0: 0, z1: 2 },
    kinds: ["tower", "tower", "office"],
    palette: [0x5a6a7a, 0x6a7a8a, 0x4a5a6a, 0x7a8a9a],
    height: [22, 48],
    roughness: 0.35,
  },
  {
    id: "moraine",
    name: "Moraine Heights",
    // Timur laut: apartemen menengah, warna hangat.
    region: { x0: 5, x1: 7, z0: 0, z1: 3 },
    kinds: ["apartment", "apartment", "house"],
    palette: [0xa08a6a, 0x8a7a6a, 0xb09a7a, 0x7a6a5a],
    height: [10, 24],
    roughness: 0.7,
  },
  {
    id: "crater",
    name: "Crater Row",
    // Tengah-selatan: toko + safehouse pemain, bangunan rendah ramai.
    region: { x0: 2, x1: 5, z0: 2, z1: 7 },
    kinds: ["shop", "shop", "apartment"],
    palette: [0x9a7a5a, 0x8a6a4a, 0xa88a62, 0x7a5a42],
    height: [8, 18],
    roughness: 0.75,
  },
  {
    id: "sunmere",
    name: "Sunmere",
    // Tenggara: rumah + kios, bangunan paling rendah, warna terang.
    region: { x0: 5, x1: 7, z0: 3, z1: 7 },
    kinds: ["house", "house", "kiosk", "shop"],
    palette: [0xb09a80, 0xc0a888, 0x9a8a72, 0xa89a82],
    height: [5, 11],
    roughness: 0.8,
  },
];

// Golden hour / sunset — pencahayaan default ronde 5 (bukan siang biru).
export const GOLDEN_HOUR = {
  // Matahari rendah di barat (arah -X), hangat oranye.
  sunColor: 0xffb168,
  sunIntensity: 2.7,
  sunElevationDeg: 13,
  sunAzimuthDeg: 262, // 270 = barat persis; sedikit ke selatan supaya bayangan miring.
  sunDistance: 320,
  // Cahaya isi: langit hangat, tanah gelap.
  hemiSky: 0xffd9a8,
  hemiGround: 0x3a2a1e,
  hemiIntensity: 1.0, // R5-4: 0.85 -> 1.0, fasad sisi gelap tetap terbaca.
  // Bounce fill dari timur (berlawanan matahari, tanpa bayangan): mengangkat
  // sisi bangunan yang membelakangi matahari supaya tidak hitam pekat.
  bounceColor: 0xff9a6a,
  bounceIntensity: 0.85, // R5-4: 0.6 -> 0.85, tetap sunset, bukan siang.
  bounceElevationDeg: 28,
  bounceAzimuthDeg: 82, // timur, sedikit ke selatan.
  // Langit: gradasi zenit ungu senja -> horizon oranye.
  skyZenith: 0x2a1a52,
  skyMid: 0x7a3a68,
  skyHorizon: 0xff9a3c,
  sunDiscColor: 0xffd9a0,
  // Kabut hangat tipis di kejauhan (warna horizon, bukan biru).
  fogColor: 0x6a3a4a,
  fogDensity: 0.0011,
  // Tone mapping ACES, exposure sedikit di atas 1 supaya hangatnya keluar.
  toneMappingExposure: 1.12,
  shadowMapSize: 2048,
  shadowFrustum: 95, // setengah lebar frustum bayangan yang mengikuti pemain.
  shadowBias: -0.0004,
  shadowNormalBias: 0.03,
  // Lampu jalan menyala karena ini sunset.
  lampColor: 0xffc27a,
  lampEmissiveIntensity: 2.2,
};

// Kamera chase third-person (skill camera-systems).
export const CAMERA = {
  fov: 62,
  near: 0.1,
  far: 1200,
  // Mode jalan kaki: dekat ke bahu.
  onFoot: { distance: 6.5, height: 3.1, followRate: 7.0, lookAhead: 1.6 },
  // Mode mengemudi: lebih jauh + lebih rendah (nuansa kejar-kejaran).
  driving: { distance: 10.5, height: 3.9, followRate: 5.0, lookAhead: 4.5 },
  deadzone: 0.7, // meter; kamera diam kalau target bergerak di dalam radius ini.
  minDistance: 1.6, // spring-arm tidak boleh lebih dekat dari ini (anti-clip).
  pitchClamp: { min: -0.12, max: 0.5 }, // radian, sudut kamera di atas target.
  pitchUpHeli: 2.6, // R5-4: meter lookAt dinaikkan saat heli aktif supaya heli masuk frame.
};

// Pemain + kendaraan (R5-1: mobil coupe auto-drive untuk verifikasi kamera).
export const PLAYER = {
  startDistrict: "crater", // safehouse di Crater Row.
  carColor: 0xc22424, // coupe merah — terbaca jelas di golden-hour.
  carTopSpeed: 26, // m/s (~94 km/jam).
  carAccel: 14,
  autoDriveSpeed: 9, // m/s saat demo R5-1 (cukup cepat untuk kamera bergerak).
  walkSpeed: 5,
  // Handling mengemudi (R5-2): model arcade sederhana.
  maxSteer: 0.55, // radian roda depan.
  wheelBase: 2.6, // meter, untuk laju belok.
  reverseTopSpeed: 8, // m/s mundur.
  brakeDecel: 22, // m/s^2 saat rem (S).
  drag: 0.5, // hambatan gelinding, per detik.
  handbrakeDecel: 30, // m/s^2 saat Space.
};

// Lalu lintas AI (R5-2): mobil mengikuti graf jalan.
export const TRAFFIC = {
  count: 10,
  speedMin: 6,
  speedMax: 10,
  pauseChance: 0.25, // peluang berhenti sebentar di tiap simpang.
  pauseMin: 1.0,
  pauseMax: 2.5,
  laneOffset: 1.8, // berkendara di sisi kanan jalan.
  followGap: 7, // meter: melambat kalau ada mobil di depan sedekat ini.
};

// Pejalan kaki AI (R5-2): berjalan di trotoar mengelilingi blok.
export const PEDS = {
  count: 16,
  walkMin: 1.0,
  walkMax: 1.6,
  fleeSpeed: 4.5, // pengemudi yang mobilnya dicuri lari sekencang ini.
  fleeTime: 4.0, // detik sebelum pengemudi yang kabur dihapus.
};

// Carjacking (R5-2).
export const CARJACK = {
  radius: 3.5, // meter: mobil terdekat dalam radius ini bisa dicuri (E).
  exitOffset: 2.6, // meter: pemain muncul di sisi kiri mobil saat keluar.
};

// Jam game (R5-2): mulai golden-hour 18:37, 1 menit game per 3 detik nyata.
export const CLOCK = {
  startMinutes: 18 * 60 + 37,
  minutesPerSecond: 1 / 3,
};

// State awal pemain (R5-2). Misi + uang bertambah di R5-3.
export const START = {
  cash: 500,
  life: 100,
  armor: 0,
  wanted: 0,
};

// Warna dunia.
export const WORLD = {
  groundAsphalt: 0x232326, // aspal gelap.
  sidewalk: 0x8a8578, // trotoar hangat keabu-abuan.
  roadMarking: 0xd8c96a, // marka tengah kuning pudar.
  roadMarkingEdge: 0xcfcfc8, // garis tepi putih pudar.
  safehouseColor: 0x2a6a8a, // safehouse dibedakan (biru kehijauan).
};

// Polisi & wanted 1-5 (R5-3). Heat 0..100; bintang dari ambang heat.
export const POLICE = {
  heatThresholds: [0, 15, 35, 60, 85], // heat minimal untuk bintang 1..5.
  heatCarjack: 18, // mencuri mobil.
  heatRam: 8, // menabrak cruiser polisi.
  heatShoot: 10, // menembak polisi.
  heatKill: 15, // melumpuhkan polisi (bonus di atas heatShoot).
  heatCrash: 6, // menabrak mobil lalu lintas keras.
  heatCrashCooldown: 2, // detik antar penambahan heat tabrakan.
  heatGrace: 4, // detik game setelah kejahatan: heat TIDAK decay (polisi
  // baru saja melihat kejahatan, pemain belum bisa "bersembunyi").
  decayHidden: 3, // heat/detik saat bersembunyi (tidak ada polisi dekat).
  decayFreshCar: 2, // pengali decay 5 detik setelah ganti mobil (jejak hilang).
  freshCarTime: 5,
  hiddenRange: 45, // meter: polisi terjauh dianggap "bersembunyi".
  cruisersPerStar: [0, 1, 2, 3, 4, 5],
  cruiserTopSpeed: 14, // m/s, sedikit lebih cepat dari lalu lintas.
  cruiserAccel: 9,
  cruiserHp: 100,
  cruiserRamDamage: 20, // kerusakan cruiser saat ditabrak keras pemain.
  ramSlow: 0.55, // mobil pemain melambat segini saat ditabrak cruiser.
  arrestRange: 2.4, // meter: polisi jalan kaki menangkap.
  arrestTime: 2.0, // detik di dalam jangkauan sampai BUSTED.
  cruiserArrestRange: 3.2, // meter: cruiser menahan pemain jalan kaki.
  cruiserArrestTime: 3.0,
  surroundedRange: 6, // meter: mobil berhenti dikepung cruiser.
  surroundedTime: 4,
  copShootRange: 20, // meter: polisi jalan kaki menembak.
  copDamagePerSec: 5,
  cruiserShootRange: 25, // meter: cruiser menembak pemain jalan kaki.
  cruiserDamagePerSec: 4,
  roadblockMinStars: 3,
  roadblockAhead: 28, // R5-4: 45 -> 28 m, roadblock terbaca di frame.
  roadblockCount: 2,
  heliMinStars: 4,
  heliHeight: 15, // R5-4: 18 -> 15 m — heli rendah + dekat, jelas di frame.
  heliAhead: 18, // R5-4: 20 -> 18 m di depan pemain.
  // Flanking (R5-4): cruiser yang sudah dekat tidak mengejar dari belakang
  // kamera (tidak terlihat), tapi mengapit dari sisi pemain supaya masuk
  // frame di tepi kiri/kanan — tampilan kejar-kejaran klasik.
  flankRange: 30, // meter: cruiser sedekat ini memakai steering flank.
  flankLateral: 5.2, // meter ke samping dari mobil pemain.
  flankLong: 2.5, // meter di depan posisi pemain (sejajar kap depan).
  copMax: 2, // polisi jalan kaki maksimal.
  copSpeed: 4.2, // m/s lari mengejar.
  bustedCashLoss: 0.1, // 10% uang hilang saat BUSTED / DEAD.
};

// Misi cerita (R5-3): 5 misi berurutan.
export const MISSIONS = {
  courierTime: 75, // detik nyata untuk misi kurir.
  escapeTime: 30, // detik bertahan di wanted >= 2 (misi kejar-kejaran).
  rewards: [0, 150, 200, 250, 300],
  finalBonus: 500, // bonus setelah misi ke-5 selesai.
  targetRadius: 8, // meter: sampai di titik = misi selesai.
  pickupRadius: 7, // meter: penumpang naik ke mobil.
};

// Combat (R5-3): pistol pemain.
export const COMBAT = {
  magSize: 12,
  reloadTime: 1.2, // detik isi ulang otomatis.
  range: 60, // meter jangkauan tembak.
  copHp: 50,
  copDamage: 34, // 2 tembakan melumpuhkan polisi jalan kaki.
  cruiserDamage: 25, // 4 tembakan melumpuhkan cruiser.
};

// Audio lokal (R5-3): semua WebAudio, tanpa file eksternal.
export const AUDIO = {
  master: 0.5,
  engineGain: 0.05,
  sirenGain: 0.035,
};

// Staging pembuka + screenshot (R5-4): frame pertama HARUS beraksi.
export const STAGING = {
  openingWanted: 2, // bintang wanted saat game baru dibuka (fresh).
  autoDriveSpeed: 10, // m/s: mobil jalan sendiri sampai pemain pegang kendali.
  roadblockCones: 4, // cone oranye di garis roadblock.
};

// Save localStorage (R5-3).
export const SAVE = {
  key: "tallow-point-save-v1",
  autoSaveSeconds: 10,
};
