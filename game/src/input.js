// Keyboard + mouse input. Keys are polled every frame; one-shot actions (E, M, R,
// Tab, Space, Escape, digits) are queued and consumed once by the game loop.

export const ACTION_ENTER = 1; // E — enter / exit / steal a car
export const ACTION_MISSION = 2; // M — start the next mission
export const ACTION_RESPAWN = 4; // R — respawn after BUSTED / WASTED
export const ACTION_MAP = 8; // Tab — city map screen
export const ACTION_PAUSE = 16; // Escape / P — pause
export const ACTION_CONFIRM = 32; // Enter / Space — confirm on menus
export const ACTION_PUNCH = 64; // F — punch
export const ACTION_SHOOT = 128; // mouse click — shoot
export const ACTION_HORN = 256; // H — horn

const KEY_ACTIONS = {
  KeyE: ACTION_ENTER,
  KeyM: ACTION_MISSION,
  KeyR: ACTION_RESPAWN,
  Tab: ACTION_MAP,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyF: ACTION_PUNCH,
  KeyH: ACTION_HORN,
};

export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;
  let shootQueued = false;
  let mouseDown = false;

  function onKeyDown(event) {
    if (event.code === 'Tab') event.preventDefault();
    if (event.code === 'Space') event.preventDefault();
    if (!event.repeat && KEY_ACTIONS[event.code]) queued |= KEY_ACTIONS[event.code];
    keys.add(event.code);
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseDown(event) {
    if (event.button === 0) {
      mouseDown = true;
      shootQueued = true;
    }
  }
  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
  }
  function onBlur() {
    keys.clear();
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    /** Held movement keys as -1/0/1 forward and left/right. */
    drive() {
      const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
        - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
        - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
      return { fwd, steer };
    },
    walk() {
      return this.drive();
    },
    get shift() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    get mouseDown() {
      return mouseDown;
    },
    /** Consume and return the queued one-shot actions. */
    takeActions() {
      const out = queued | (shootQueued ? ACTION_SHOOT : 0);
      queued = 0;
      shootQueued = false;
      return out;
    },
    /** Test helpers: inject keys/actions without a real keyboard. */
    inject(action) {
      queued |= action;
    },
    press(code) {
      keys.add(code);
    },
    release(code) {
      keys.delete(code);
    },
  };
}
