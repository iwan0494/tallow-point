// Story missions: five named jobs in order, each with three stages, an
// objective, a timer and a payout. The mission marker is a world position the
// player must reach; finishing a stage advances the marker, finishing the
// mission pays out, adds respect and unlocks the next one.

import { MISSIONS } from './config.js';

const MARKERS = [
  // One marker per mission stage: [x, z] waypoints on roads in the mission's
  // home district (Sunmere west, Crater/Neon north, Vesper south-east).
  [[-156, 60], [-104, 120], [-156, 140]], // COURIER RUN — Sunmere beach road
  [[52, -104], [104, -52], [0, -104]], // HOT PURSUIT — Crater Row
  [[104, -104], [156, -52], [104, -156]], // BOOST THE COMET — Neon Mile
  [[104, 104], [156, 52], [104, 156]], // NIGHT SHIFT — Vesper Docks
  [[52, -104], [0, -156], [52, -156]], // KINGPIN — Neon Mile
];

export function createMissions() {
  let current = 0; // index into MISSIONS
  let stage = 0; // 0..2
  let active = false;
  let timer = 0;
  let done = 0; // missions completed
  let completedMask = 0;

  function mission() {
    return MISSIONS[current];
  }
  function marker() {
    return MARKERS[current][stage];
  }
  function start() {
    if (active || current >= MISSIONS.length) return null;
    active = true;
    stage = 0;
    timer = mission().time;
    return mission();
  }
  function update(dt, player) {
    if (!active) return { event: 'idle' };
    timer -= dt;
    if (timer <= 0) {
      active = false;
      return { event: 'failed', mission: mission() };
    }
    const [mx, mz] = marker();
    const d = Math.hypot(player.x - mx, player.z - mz);
    if (d < 7) {
      if (stage < 2) {
        stage += 1;
        timer = Math.max(timer, 45);
        return { event: 'stage', mission: mission(), stage };
      }
      // Mission complete.
      const finished = mission();
      completedMask |= 1 << current;
      done += 1;
      current = Math.min(current + 1, MISSIONS.length - 1);
      if (done >= MISSIONS.length) current = MISSIONS.length - 1;
      active = false;
      stage = 0;
      return { event: 'complete', mission: finished };
    }
    return { event: 'active', dist: Math.round(d) };
  }
  function skipTo(n, stageN, timerSecs) {
    current = Math.max(0, Math.min(MISSIONS.length - 1, n));
    stage = stageN || 0;
    active = true;
    timer = timerSecs || mission().time - 21; // staged shots show a live countdown
  }
  return {
    start, update, skipTo,
    get active() {
      return active;
    },
    get current() {
      return current;
    },
    get stage() {
      return stage;
    },
    get timer() {
      return timer;
    },
    get done() {
      return done;
    },
    get completedMask() {
      return completedMask;
    },
    mission, marker,
    /** Marker for the HUD minimap and the 3D beacon. */
    get markerPos() {
      const [x, z] = marker();
      return { x, z };
    },
  };
}
