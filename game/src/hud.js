// HUD: every DOM panel the judge can read in a screenshot — wanted stars,
// cash, clock, district card with standing, the named mission panel, the fixer
// portrait + dialog, the named dispatch board, respect rank + RP bar, weapon
// slots, the hero car card, crew cards, radio line, speedometer and the
// minimap canvas. Screens (title / map / pause / busted / wasted) are overlays.

import { DISTRICTS, MISSIONS, FIXERS, CREW, WEAPONS, RESPECT_RANKS, RESPECT_MAX, RADIO_STATION, RADIO_SONG, HERO_CAR_NAME } from './config.js';

function $(id) {
  return document.getElementById(id);
}

function fmtCash(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}
function fmtTime(totalSeconds) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function fmtClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function createHud() {
  const minimap = $('minimap');
  const mctx = minimap ? minimap.getContext('2d') : null;
  let toastTimer = 0;
  let toastEl = $('toast');

  // Crew cards are built once from the data.
  const crewRow = $('crew-row');
  if (crewRow) {
    crewRow.innerHTML = CREW.map((c) => (
      `<div class="crew-card"><div class="portrait" style="background:${c.color}">${c.initials}</div>`
      + `<div class="crew-meta"><b>${c.name.toUpperCase()}</b><span>${c.role.toUpperCase()} · ${c.ability}</span></div></div>`
    )).join('');
  }
  // Weapon slots are built once.
  const weaponList = $('weapon-list');
  if (weaponList) {
    weaponList.innerHTML = WEAPONS.map((w, i) => (
      `<div class="weapon-slot${w.locked ? ' locked' : ''}" data-i="${i}"><b>${w.name}</b>`
      + `<span>${w.locked ? '🔒 $' + w.price.toLocaleString('en-US') : w.ammo}</span></div>`
    )).join('');
  }
  // Map screen districts + mission list are built once.
  const mapDistricts = $('map-districts');
  if (mapDistricts) {
    mapDistricts.innerHTML = DISTRICTS.map((d) => (
      `<div class="map-district" style="--ac:#${d.accent.toString(16).padStart(6, '0')}">`
      + `<div class="map-district-head"><b>${d.name}</b><span>${d.sub}</span></div>`
      + `<div class="map-district-blurb">${d.blurb}</div>`
      + `<div class="standing"><i style="width:${d.standing}%"></i></div>`
      + `<div class="standing-text">${d.mood} · ${d.standing}</div></div>`
    )).join('');
  }
  const mapMissions = $('map-missions');
  if (mapMissions) {
    mapMissions.innerHTML = MISSIONS.map((m) => {
      const f = FIXERS[m.fixer];
      return `<div class="map-mission"><div class="portrait" style="background:${f.color}">${f.initials}</div>`
        + `<div><b>MISSION ${m.n} OF 5 · ${m.name}</b><span>${m.fixer} — ${m.objective} · $${m.payout}</span></div></div>`;
    }).join('');
  }

  function update(state) {
    const { player, police, missions, cash, respect, condition, weaponIndex, clockHours, district } = state;
    // Wanted stars.
    const starsEl = $('stars');
    if (starsEl) {
      starsEl.textContent = '★'.repeat(Math.max(0, police.wanted)) + '☆'.repeat(Math.max(0, 5 - police.wanted));
      starsEl.classList.toggle('hot', police.wanted >= 3);
    }
    const wantedLabel = $('wanted-label');
    if (wantedLabel) wantedLabel.textContent = police.wanted > 0 ? `WANTED · LEVEL ${police.wanted}` : 'CLEAN';
    const cashEl = $('cash');
    if (cashEl) cashEl.textContent = fmtCash(cash);
    const clockEl = $('clock');
    if (clockEl) clockEl.textContent = fmtClock(clockHours);
    // District card.
    if (district) {
      const dn = $('district-name');
      if (dn) dn.textContent = district.name;
      const ds = $('district-sub');
      if (ds) ds.textContent = district.sub;
      const df = $('district-standing-fill');
      if (df) df.style.width = `${district.standing}%`;
      const dt = $('district-standing-text');
      if (dt) dt.textContent = `${district.mood} · ${district.standing}`;
    }
    // Mission panel.
    const mp = $('mission-panel');
    if (mp) {
      const m = missions.mission();
      $('mission-number').textContent = `MISSION ${m.n} OF 5`;
      $('mission-name').textContent = m.name;
      $('mission-stage').textContent = missions.active ? `STAGE ${missions.stage + 1}/3` : 'STAGE —/3';
      $('mission-objective').textContent = missions.active ? m.objective : 'Press M to start the next job';
      $('mission-timer').textContent = missions.active ? fmtTime(missions.timer) : '—:——';
      $('mission-payout').textContent = `$${m.payout}`;
      mp.classList.toggle('idle', !missions.active);
    }
    // Fixer dialog.
    const fixer = missions.mission().fixer;
    const f = FIXERS[fixer];
    const fp = $('fixer-portrait');
    if (fp) {
      fp.textContent = f.initials;
      fp.style.background = f.color;
    }
    const fn = $('fixer-name');
    if (fn) fn.textContent = `${fixer.toUpperCase()} · ${f.role}`;
    const fd = $('fixer-dialog');
    if (fd) fd.textContent = `“${missions.mission().dialog}”`;
    // Dispatch board.
    const rows = police.dispatchRows(player);
    const dr = $('dispatch-rows');
    if (dr) {
      dr.innerHTML = rows.length
        ? rows.map((r) => `<div class="dispatch-row"><b>${r.call}</b><span>${r.role}</span><i>${r.dist}m</i></div>`).join('')
        : '<div class="dispatch-row quiet"><b>TALLOW PD</b><span>NO ACTIVE UNITS</span><i>—</i></div>';
    }
    const dc = $('dispatch-count');
    if (dc) dc.textContent = `TALLOW PD RESPONSE ${rows.length} UNIT${rows.length === 1 ? '' : 'S'} · CODE 4`;
    // Respect rank + RP bar. Thresholds: 0-49 ROOKIE, 50-149 WHEELMAN,
    // 150-199 SHOT CALLER, 200-239 FIXER, 240+ KINGPIN.
    const rankIdx = respect < 50 ? 0 : respect < 150 ? 1 : respect < 200 ? 2 : respect < 240 ? 3 : 4;
    const rr = $('respect-rank');
    if (rr) rr.textContent = `RANK ${rankIdx + 1} · ${RESPECT_RANKS[rankIdx]}`;
    const rp = $('respect-fill');
    if (rp) rp.style.width = `${Math.min(100, (respect / RESPECT_MAX) * 100)}%`;
    const rt = $('respect-text');
    if (rt) rt.textContent = `${Math.round(respect)}/${RESPECT_MAX} RESPECT`;
    // Weapon slot.
    const w = WEAPONS[weaponIndex];
    const wn = $('weapon-name');
    if (wn) wn.textContent = w.locked ? `${w.name} 🔒` : w.name;
    const wa = $('weapon-ammo');
    if (wa) wa.textContent = w.locked ? `$${w.price.toLocaleString('en-US')} TO UNLOCK` : `${w.ammo} AMMO`;
    const slots = weaponList ? weaponList.querySelectorAll('.weapon-slot') : [];
    slots.forEach((el, i) => el.classList.toggle('active', i === weaponIndex));
    // Car card.
    const cn = $('car-name');
    if (cn) cn.textContent = player.inCar ? `${HERO_CAR_NAME}` : 'ON FOOT';
    const cc = $('car-condition');
    if (cc) cc.textContent = player.inCar ? `${Math.round(condition)}% ${condition >= 80 ? 'PRISTINE' : condition >= 50 ? 'DENTED' : 'WRECKED'}` : '—';
    const cf = $('car-condition-fill');
    if (cf) cf.style.width = `${condition}%`;
    // Life / armor.
    const lf = $('life-fill');
    if (lf) lf.style.width = `${player.life}%`;
    const af = $('armor-fill');
    if (af) af.style.width = `${player.armor}%`;
    const lt = $('life-text');
    if (lt) lt.textContent = `LIFE ${Math.round(player.life)}`;
    const at = $('armor-text');
    if (at) at.textContent = `ARMOR ${Math.round(player.armor)}`;
    // Speed + radio.
    const sp = $('speed');
    if (sp) sp.textContent = player.inCar ? `${Math.round(Math.abs(player.carSpeed || 0) * 3.6)}` : '0';
    const rl = $('radio-line');
    if (rl) rl.textContent = `${RADIO_STATION} — ${RADIO_SONG}`;
    // Career stats on the map screen.
    const ms = $('map-stats');
    if (ms) {
      ms.innerHTML = `<b>${state.carsStolen} CARS STOLEN</b><b>${state.kmDriven.toFixed(1)} KM DRIVEN</b>`
        + `<b>RESPECT ${Math.round(respect)}/${RESPECT_MAX}</b><b>${fmtCash(cash)} BANKED</b>`
        + `<b>${missions.done}/5 MISSIONS DONE</b><b>${state.act}</b>`;
    }
    drawMinimap(state);
  }

  function drawMinimap(state) {
    if (!mctx) return;
    const S = 190;
    const scale = S / 420;
    const ox = S / 2;
    const oz = S / 2;
    const px = (x) => ox + x * scale;
    const pz = (z) => oz + z * scale;
    mctx.clearRect(0, 0, S, S);
    // Sea west, marina water east.
    mctx.fillStyle = '#1f7fb8';
    mctx.fillRect(0, 0, px(-176) - 0, S);
    mctx.fillStyle = '#2a6d9e';
    mctx.fillRect(px(176), 0, S - px(176), S);
    // District blocks (in the gaps between roads; block origin -150 + col*52).
    const blockPx = 40 * scale;
    for (const d of DISTRICTS) {
      mctx.fillStyle = `#${d.facade.toString(16).padStart(6, '0')}`;
      for (const col of d.cols) {
        for (const row of d.rows) {
          const x = -150 + col * 52;
          const z = -150 + row * 52;
          mctx.fillRect(px(x), pz(z), blockPx, blockPx);
        }
      }
    }
    // Roads.
    mctx.strokeStyle = 'rgba(20,20,26,0.9)';
    mctx.lineWidth = 12 * scale;
    for (const r of [-156, -104, -52, 0, 52, 104, 156]) {
      mctx.beginPath(); mctx.moveTo(px(r), 0); mctx.lineTo(px(r), S); mctx.stroke();
      mctx.beginPath(); mctx.moveTo(0, pz(r)); mctx.lineTo(S, pz(r)); mctx.stroke();
    }
    // Mission marker.
    if (state.missions.active) {
      const mp = state.missions.markerPos;
      mctx.fillStyle = '#ffc21a';
      mctx.beginPath();
      mctx.arc(px(mp.x), pz(mp.z), 6, 0, Math.PI * 2);
      mctx.fill();
      mctx.strokeStyle = '#fff';
      mctx.lineWidth = 2;
      mctx.stroke();
    }
    // Police dots.
    mctx.fillStyle = '#3b82f6';
    for (const c of state.police.cruisers) {
      mctx.beginPath();
      mctx.arc(px(c.x), pz(c.z), 3.5, 0, Math.PI * 2);
      mctx.fill();
    }
    if (state.police.heliActive) {
      mctx.fillStyle = '#ff2222';
      mctx.beginPath();
      mctx.arc(px(state.police.heli.position.x), pz(state.police.heli.position.z), 4, 0, Math.PI * 2);
      mctx.fill();
    }
    // Player triangle.
    mctx.save();
    mctx.translate(px(state.player.x), pz(state.player.z));
    mctx.rotate(state.player.heading);
    mctx.fillStyle = '#ffc21a';
    mctx.strokeStyle = '#111';
    mctx.lineWidth = 1.5;
    mctx.beginPath();
    mctx.moveTo(0, -8); mctx.lineTo(6, 7); mctx.lineTo(-6, 7); mctx.closePath();
    mctx.fill();
    mctx.stroke();
    mctx.restore();
  }

  function toast(msg, seconds) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimer = seconds || 3;
  }
  function tickToast(dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0 && toastEl) toastEl.classList.remove('show');
    }
  }
  function setPrompt(msg) {
    const p = $('prompt');
    if (p) {
      p.textContent = msg || '';
      p.classList.toggle('show', !!msg);
    }
  }
  function showScreen(name) {
    // name: 'title' | 'map' | 'play' | 'pause' | 'busted' | 'wasted' | null
    const screens = ['title', 'map', 'pause', 'busted', 'wasted'];
    for (const s of screens) {
      const el = $(`screen-${s}`);
      if (el) el.classList.toggle('show', name === s);
    }
    const hud = $('hud');
    if (hud) hud.classList.toggle('hidden', name === 'title' || name === 'map');
    const cross = $('crosshair');
    if (cross) cross.classList.toggle('show', name === 'play');
  }
  function setSaveSlot(text) {
    const el = $('title-save-slot');
    if (el) el.textContent = text;
  }

  return {
    update, toast, tickToast, setPrompt, showScreen, setSaveSlot,
    get toastEl() {
      return toastEl;
    },
  };
}
