// Screenshot scenes behind ?shot=start|drive|wanted|mission. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what a short game really looks like and the
// same seed always gives the same frame.

import { STEP } from './config.js';
import { EVENT_WASTED, EVENT_BUSTED } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const angleDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
};

/** Steer a car toward a waypoint: ease off the throttle while turning, so the
 *  car makes the corner instead of grinding along the buildings. */
function driveToward(world, targetX, targetY) {
  const p = world.state.player;
  const car = p.car;
  if (!car) return { move: { x: 0, y: 0 }, throttle: 0, steer: 0, enter: false, shoot: false, aim: null, sprint: false };
  const want = Math.atan2(targetY - car.y, targetX - car.x);
  const err = angleDiff(want, car.angle);
  const d = Math.hypot(targetX - car.x, targetY - car.y);
  let throttle = 1;
  if (Math.abs(err) > 0.6) throttle = 0.35;
  if (d < 170 && Math.abs(err) > 0.5) throttle = 0.2;
  return {
    move: { x: 0, y: 0 },
    throttle,
    steer: clamp(err * 2.2, -1, 1),
    enter: false, shoot: false, aim: null, sprint: false,
  };
}

/** A loop of intersections to drive around the city: down one avenue, across a
 *  street, back up another avenue. Corners are wide roads, never the beach. */
const LOOP = [
  { x: 800, y: 2250 },
  { x: 2800, y: 2250 },
  { x: 2800, y: 250 },
  { x: 800, y: 250 },
];

const IDLE = { move: { x: 0, y: 0 }, throttle: 0, steer: 0, enter: false, shoot: false, aim: null, sprint: false };

export function stageShot(name, world) {
  const state = world.state;
  if (name === 'start') {
    // Attract mode: traffic and pedestrians move behind the title.
    for (let i = 0; i < 6 / STEP; i++) world.step(STEP, IDLE, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'drive') {
    world.placePlayerInCar(826, 650, Math.PI / 2, '#e8b13c');
    const route = LOOP;
    let ri = 0;
    for (let i = 0; i < 20 / STEP; i++) {
      const p = state.player;
      if (!p.car) break;
      const target = route[ri % route.length];
      if (Math.hypot(target.x - p.x, target.y - p.y) < 150) ri += 1;
      const events = world.step(STEP, driveToward(world, target.x, target.y), false);
      if (events & (EVENT_WASTED | EVENT_BUSTED)) break;
    }
    // The drive may have clipped a pedestrian on the way; the cover drive is a
    // clean cruise, so the heat and the chase are cleared for the frame.
    state.player.wanted = 0;
    state.player.lastCrime = 0;
    state.cops = [];
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'wanted') {
    world.placePlayerInCar(1326, 1050, Math.PI / 2, '#e8b13c');
    world.addWanted(3);
    for (let i = 0; i < 3; i++) world.spawnCop();
    // South down avenue 1300, then join the same loop.
    const route = [{ x: 1300, y: 2250 }, ...LOOP.slice(1), LOOP[0]];
    let ri = 0;
    for (let i = 0; i < 12 / STEP; i++) {
      const p = state.player;
      if (!p.car) break;
      const target = route[ri % route.length];
      if (Math.hypot(target.x - p.x, target.y - p.y) < 150) ri += 1;
      const events = world.step(STEP, driveToward(world, target.x, target.y), false);
      if (events & (EVENT_WASTED | EVENT_BUSTED)) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // mission: on-foot standoff with the Kingsmen at Civic Plaza. Staged short,
  // so the rivals are still standing — and shooting back — in the frame.
  world.reset(7);
  state.player.x = 1550;
  state.player.y = 1400;
  state.player.angle = -Math.PI / 2;
  state.player.ammo = 60;
  world.spawnRival(1450, 1150);
  world.spawnRival(1650, 1150);
  world.spawnRival(1550, 1330);
  state.marker = { x: 1550, y: 1250 };
  state.missionText = 'Deal with the Kingsmen at the plaza — 3 left';
  for (let i = 0; i < 1.2 / STEP; i++) {
    const p = state.player;
    const foe = state.enemies.find((e) => !e.dead);
    const aim = foe ? { x: foe.x, y: foe.y } : null;
    const events = world.step(STEP, { move: { x: 0, y: 0 }, throttle: 0, steer: 0, enter: false, shoot: true, aim, sprint: false }, false);
    if (events & (EVENT_WASTED | EVENT_BUSTED)) break;
  }
  // Let the damage flash fade, then fire one last aimed shot so the frame
  // keeps a fresh tracer — and clear the cops, who only crowd the edge.
  for (let i = 0; i < 0.35 / STEP; i++) world.step(STEP, IDLE, false);
  const foe = state.enemies.find((e) => !e.dead);
  if (foe) {
    world.step(STEP, { move: { x: 0, y: 0 }, throttle: 0, steer: 0, enter: false, shoot: true, aim: { x: foe.x, y: foe.y }, sprint: false }, false);
  }
  state.cops = [];
  return { screen: SCREEN_PLAY, best: 0 };
}
