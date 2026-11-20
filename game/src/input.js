// Keyboard and mouse input. The game reads a fresh snapshot every frame; menus
// consume edge-triggered actions through takeActions().

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;

const CONFIRM_KEYS = new Set(['Enter', ' ']);
const PAUSE_KEYS = new Set(['p', 'P', 'Escape']);
const ENTER_KEYS = new Set(['e', 'E']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false };

  window.addEventListener('keydown', (event) => {
    if (CONFIRM_KEYS.has(event.key)) actions |= ACTION_CONFIRM;
    if (PAUSE_KEYS.has(event.key)) actions |= ACTION_PAUSE;
    if (ENTER_KEYS.has(event.key)) actions |= ACTION_ENTER;
    keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  });
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (event) => {
    mouse.down = true;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    if (event.button === 0) actions |= ACTION_CONFIRM;
    event.preventDefault();
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  const held = (...names) => names.some((n) => keys.has(n));

  return {
    mouse,
    takeActions() {
      const out = actions;
      actions = 0;
      return out;
    },
    /** On-foot movement vector, normalised, in world axes. */
    move() {
      let x = 0;
      let y = 0;
      if (held('a', 'ArrowLeft')) x -= 1;
      if (held('d', 'ArrowRight')) x += 1;
      if (held('w', 'ArrowUp')) y -= 1;
      if (held('s', 'ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        const inv = 1 / Math.hypot(x, y);
        x *= inv;
        y *= inv;
      }
      return { x, y };
    },
    /** Driving: throttle -1..1 (W/S or arrows) and steer -1..1 (A/D or arrows). */
    drive() {
      let throttle = 0;
      if (held('w', 'ArrowUp')) throttle += 1;
      if (held('s', 'ArrowDown')) throttle -= 1;
      let steer = 0;
      if (held('a', 'ArrowLeft')) steer -= 1;
      if (held('d', 'ArrowRight')) steer += 1;
      return { throttle, steer };
    },
    shooting() {
      return mouse.down || keys.has(' ');
    },
    sprint() {
      return keys.has('Shift');
    },
  };
}
