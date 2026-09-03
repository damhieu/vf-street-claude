// Bàn phím: nhận cả e.code lẫn e.key (sự kiện tổng hợp từ tool có thể chỉ có key).
import { CFG } from './config.js';
import { clamp } from './util.js';

const HOLD = {
  throttle: ['ArrowUp', 'KeyW', 'w', 'W'],
  brake: ['ArrowDown', 'KeyS', 's', 'S'],
  left: ['ArrowLeft', 'KeyA', 'a', 'A'],
  right: ['ArrowRight', 'KeyD', 'd', 'D'],
};
const PRESS = {
  up: ['ArrowUp', 'KeyW', 'w', 'W'],
  down: ['ArrowDown', 'KeyS', 's', 'S'],
  left: ['ArrowLeft', 'KeyA', 'a', 'A'],
  right: ['ArrowRight', 'KeyD', 'd', 'D'],
  confirm: ['Enter', 'NumpadEnter', 'Space', ' '],
  back: ['Escape', 'Backspace'],
  mute: ['KeyM', 'm', 'M'],
};

function actionsFor(table, e) {
  const out = [];
  for (const [action, keys] of Object.entries(table)) if (keys.includes(e.code) || keys.includes(e.key)) out.push(action);
  return out;
}

export function createInput(target = window) {
  const held = new Set();
  let steer = 0;
  let onPress = null;
  let virtual = null; // { steer, throttle, brake } do debug đặt
  const touch = { left: false, right: false, throttle: false, brake: false };

  const keydown = e => {
    const hold = actionsFor(HOLD, e);
    hold.forEach(a => held.add(a));
    const press = actionsFor(PRESS, e);
    if (hold.length || press.length) e.preventDefault?.();
    if (!e.repeat && press.length && onPress) press.forEach(a => onPress(a, e));
  };
  const keyup = e => actionsFor(HOLD, e).forEach(a => held.delete(a));
  const blur = () => held.clear();
  target.addEventListener('keydown', keydown);
  target.addEventListener('keyup', keyup);
  target.addEventListener('blur', blur);

  return {
    /** Gọi mỗi bước mô phỏng; trả về {steer, throttle, brake} đã làm mượt. */
    step(dt) {
      if (virtual) return virtual;
      const target = (held.has('right') || touch.right ? 1 : 0) - (held.has('left') || touch.left ? 1 : 0);
      if (target !== 0) {
        const rate = dt / CFG.INPUT.STEER_UP;
        steer = Math.sign(steer) === Math.sign(target) || steer === 0 ? clamp(steer + target * rate, -1, 1) : clamp(steer + target * dt / CFG.INPUT.STEER_DOWN * 2, -1, 1);
      } else if (steer !== 0) {
        const rate = dt / CFG.INPUT.STEER_DOWN;
        steer = Math.abs(steer) <= rate ? 0 : steer - Math.sign(steer) * rate;
      }
      return { steer, throttle: held.has('throttle') || touch.throttle ? 1 : 0, brake: held.has('brake') || touch.brake ? 1 : 0 };
    },
    isHeld: a => held.has(a) || !!touch[a],
    setTouch(partial) { Object.assign(touch, partial); },
    setOnPress(fn) { onPress = fn; },
    setVirtual(v) { virtual = v; },
    reset() { held.clear(); steer = 0; },
    dispose() {
      target.removeEventListener('keydown', keydown);
      target.removeEventListener('keyup', keyup);
      target.removeEventListener('blur', blur);
    },
  };
}
