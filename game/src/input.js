// input.js — keyboard + mouse. Held keys, edge-triggered presses for
// one-shot actions (E steal car, R respawn, F punch, Space shoot, M mission).
// Classic script, namespace TP.
window.TP = window.TP || {};
(function (TP) {
  'use strict';

  var keys = {};
  var pressed = {};   // edge: true only on the frame the key went down
  var mouse = { x: 0, y: 0, down: false, clicked: false };

  function initInput() {
    window.addEventListener('keydown', function (e) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!keys[k]) pressed[k] = true;
      keys[k] = true;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys[k] = false;
    });
    window.addEventListener('blur', function () { keys = {}; });
    var canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.addEventListener('mousedown', function (e) {
        mouse.down = true; mouse.clicked = true;
        mouse.x = e.clientX; mouse.y = e.clientY;
      });
      window.addEventListener('mouseup', function () { mouse.down = false; });
    }
  }

  function isDown(k) { return !!keys[k]; }
  function wasPressed(k) { return !!pressed[k]; }

  function axis() {
    // -1..1 for forward/back (W/S) and steering (A/D).
    var f = 0, s = 0;
    if (isDown('w') || isDown('ArrowUp')) f += 1;
    if (isDown('s') || isDown('ArrowDown')) f -= 1;
    if (isDown('a') || isDown('ArrowLeft')) s -= 1;
    if (isDown('d') || isDown('ArrowRight')) s += 1;
    return { forward: f, steer: s, run: isDown('Shift') };
  }

  function endFrame() {
    pressed = {};
    mouse.clicked = false;
  }

  TP.Input = {
    init: initInput, isDown: isDown, wasPressed: wasPressed,
    axis: axis, endFrame: endFrame, mouse: mouse,
  };
})(window.TP);
