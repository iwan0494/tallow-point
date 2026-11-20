// config.js — Tallow Point: world constants, districts, missions, palette.
// Classic script, namespace TP. Every other module reads TP.Config.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  var DISTRICTS = [
    { name: 'Kessel Wharf',    color: 0x8a7a5a, accent: 0x6b5b3e, kind: 'warehouse' },
    { name: 'Northline',       color: 0x9aa3ad, accent: 0x5a6b7d, kind: 'tower' },
    { name: 'Moraine Heights', color: 0xb08d6a, accent: 0x7d5f43, kind: 'apartment' },
    { name: 'Crater Row',      color: 0xc9a06a, accent: 0x8a6a3e, kind: 'shop' },
    { name: 'Sunmere',         color: 0xd8b48a, accent: 0x9a7a52, kind: 'house' },
  ];

  var MISSIONS = [
    { id: 1, name: 'Courier Run',      pay: 500,  time: 90,  text: 'Deliver the package to Sunmere before the timer runs out.' },
    { id: 2, name: 'Hot Pursuit',      pay: 900,  time: 120, text: 'Lose a 3-star wanted level. Stay out of sight.' },
    { id: 3, name: 'Boost the Comet',  pay: 1200, time: 150, text: 'Steal the gold Comet parked in Northline and bring it home.' },
    { id: 4, name: 'Night Shift',      pay: 1500, time: 180, text: 'Drive the taxi fares across town. Three stops.' },
    { id: 5, name: 'Kingpin',          pay: 1900, time: 240, text: 'Take the package to Kessel Wharf. The whole city is watching.' },
  ];

  TP.Config = {
    grid: 7,                 // 7x7 blocks
    block: 44,               // metres per block
    road: 10,                // road width
    districts: DISTRICTS,
    missions: MISSIONS,
    startCash: 0,
    startHour: 17.7,         // golden hour, late afternoon
    sunPos: { x: 110, y: 50, z: 30 },
    sunColor: 0xffb066,
    sunIntensity: 2.6,
    hemiSky: 0xffd9a0,
    hemiGround: 0x3a2a22,
    hemiIntensity: 1.2,
    exposure: 1.25,
    fogColor: 0x2a1a33,
    skyTop: 0x7a3a6e,         // magenta dusk
    skyBottom: 0xff8c42,     // orange horizon
    playerSpeed: 6.5,
    playerRun: 10,
    carTopSpeed: 42,         // coupe m/s (~151 km/h)
    stealRadius: 6.0,
    wantedDecay: 0.02,
  };
})(window.TP);
