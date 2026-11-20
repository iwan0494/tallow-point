// hud.js — the whole HUD: wanted stars, cash, clock, district, LIFE/ARMOR
// bars, objective panel, police-unit list, speedometer, prompts, toasts and
// the minimap. Big and readable at 1024x576. Classic script, TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  function createHud() {
    var root = document.getElementById('hud');
    if (!root) return null;

    function el(tag, cls, parent) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      (parent || root).appendChild(e);
      return e;
    }

    var stars = el('div', 'hud-stars');
    var cash = el('div', 'hud-cash');
    var clockEl = el('div', 'hud-clock');
    var districtEl = el('div', 'hud-district');
    var bars = el('div', 'hud-bars');
    var lifeFill = el('div', 'hud-life-fill', bars);
    var armorFill = el('div', 'hud-armor-fill', bars);
    var lifeLabel = el('div', 'hud-life-label', bars);
    var objective = el('div', 'hud-objective');
    var objTitle = el('div', 'hud-obj-title', objective);
    var objText = el('div', 'hud-obj-text', objective);
    var objTimer = el('div', 'hud-obj-timer', objective);
    var policeList = el('div', 'hud-police');
    var speedo = el('div', 'hud-speedo');
    var prompt = el('div', 'hud-prompt');
    var toast = el('div', 'hud-toast');
    var banner = el('div', 'hud-banner');

    // Minimap: a 2D canvas, north-up, player triangle + cops + objective.
    var mapWrap = el('div', 'hud-map-wrap');
    var map = document.createElement('canvas');
    map.width = 180; map.height = 180;
    map.className = 'hud-map';
    mapWrap.appendChild(map);
    var mctx = map.getContext('2d');

    var toastTimer = null;

    function showToast(text, ms) {
      toast.textContent = text;
      toast.style.opacity = '1';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { toast.style.opacity = '0'; }, ms || 2600);
    }

    function showBanner(text, ms) {
      banner.textContent = text;
      banner.style.opacity = '1';
      setTimeout(function () { banner.style.opacity = '0'; }, ms || 2200);
    }

    function drawMinimap(state) {
      var g = mctx;
      var S = 180;
      var half = state.half;
      g.clearRect(0, 0, S, S);
      g.fillStyle = 'rgba(12,14,20,0.78)';
      g.fillRect(0, 0, S, S);
      function toMap(x, z) {
        return [S / 2 + (x / half) * (S / 2 - 6), S / 2 + (z / half) * (S / 2 - 6)];
      }
      // Roads.
      g.strokeStyle = 'rgba(200,200,210,0.35)';
      g.lineWidth = 1;
      state.roads.forEach(function (r) {
        var a = toMap(r[0], r[1]), b = toMap(r[2], r[3]);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      });
      // Objective marker (gold diamond).
      if (state.objective) {
        var o = toMap(state.objective.x, state.objective.z);
        g.fillStyle = '#ffd24a';
        g.beginPath();
        g.moveTo(o[0], o[1] - 6); g.lineTo(o[0] + 6, o[1]);
        g.lineTo(o[0], o[1] + 6); g.lineTo(o[0] - 6, o[1]);
        g.closePath(); g.fill();
      }
      // Police dots (red).
      g.fillStyle = '#ff4040';
      state.cops.forEach(function (c) {
        var p = toMap(c.x, c.z);
        g.beginPath(); g.arc(p[0], p[1], 3, 0, Math.PI * 2); g.fill();
      });
      // Player triangle: ONE rotation only (an earlier build rotated twice
      // and the triangle spun the wrong way).
      var pp = toMap(state.player.x, state.player.z);
      g.save();
      g.translate(pp[0], pp[1]);
      g.rotate(Math.PI - state.playerHeading);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6);
      g.closePath(); g.fill();
      g.restore();
      // North tick.
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.font = 'bold 10px sans-serif';
      g.fillText('N', S / 2 - 3, 12);
    }

    function update(s) {
      // Wanted stars, big and yellow.
      var st = '';
      for (var i = 0; i < 5; i++) st += i < s.wanted ? '★' : '☆';
      stars.textContent = st;
      stars.style.color = s.wanted >= 3 ? '#ff5040' : '#ffd24a';
      stars.style.display = s.wanted > 0 ? 'block' : 'none';

      cash.textContent = '$' + s.cash.toLocaleString('en-US');
      var hh = Math.floor(s.hour), mm = Math.floor((s.hour - hh) * 60);
      clockEl.textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
      districtEl.textContent = s.district;

      lifeFill.style.width = s.health + '%';
      armorFill.style.width = s.armor + '%';
      lifeLabel.textContent = 'LIFE ' + Math.round(s.health) + (s.armor > 0 ? '  ·  ARMOR ' + Math.round(s.armor) : '');

      if (s.mission) {
        objective.style.display = 'block';
        objTitle.textContent = s.mission.def.name + '  —  $' + s.mission.def.pay;
        objText.textContent = s.mission.target.label;
        objTimer.textContent = Math.max(0, Math.ceil(s.mission.timeLeft)) + 's';
      } else {
        objective.style.display = 'none';
      }

      if (s.wanted > 0) {
        policeList.style.display = 'block';
        policeList.innerHTML = '<b>WANTED</b> · POLICE UNITS: ' + s.cops.length +
          (s.heli ? '<br>HELICOPTER AIRBORNE' : '');
      } else {
        policeList.style.display = 'none';
      }

      speedo.textContent = s.driving ? Math.round(s.speedKmh) + ' km/h' : '';
      speedo.style.display = s.driving ? 'block' : 'none';

      prompt.textContent = s.prompt || '';
      prompt.style.display = s.prompt ? 'block' : 'none';

      drawMinimap(s.map);
    }

    return { update: update, showToast: showToast, showBanner: showBanner };
  }

  TP.Hud = { create: createHud };
})(window.TP);
