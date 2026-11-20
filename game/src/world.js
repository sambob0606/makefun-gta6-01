// Vireo City — the world: a grid city, cars, traffic, pedestrians, police,
// wanted level, combat and the five story missions. Everything here is original.

import {
  BEACH_Y, CAR, PED, PLAYER, ROADS_H, ROADS_V, ROAD_W, STEP, TRAFFIC_COUNT,
  WALK_W, WANTED, WATER_Y, WORLD,
} from './config.js';
import { createRandom } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_WASTED = 1;
export const EVENT_BUSTED = 2;
export const EVENT_MISSION = 4;
export const EVENT_PICKUP = 8;
export const EVENT_CRIME = 16;
export const EVENT_SHOT = 32;
export const EVENT_STORY = 64;

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angleDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
};

const CAR_COLORS = ['#c94f43', '#4a7fb5', '#d9a441', '#7d9b76', '#8a6fb0', '#c9c9c9', '#3a3f4a', '#e07b39'];
const PED_COLORS = ['#d97b6c', '#6c8fd9', '#d9c06c', '#7fb069', '#b06ca8', '#e8e0d0', '#5a6b7d', '#c98a4b'];
const BUILDING_COLORS = ['#c96f4a', '#d9a05b', '#8fa8b8', '#b8b0a0', '#a97b8f', '#7d9b76', '#c2b280', '#9a8fc0'];
const ROOF_COLORS = ['#8a4a34', '#a87c42', '#5f7d8c', '#8a8074', '#7d5568', '#5d7355', '#96865a', '#6f6390'];

export const MISSIONS = [
  {
    id: 'pickup', title: 'M1 · The Pickup', pay: 300,
    brief: 'Voss needs a package moved. Get to the harbour drop, grab it, bring it back to the garage.',
    stages: [
      { kind: 'goto', text: 'Drive to the harbour drop', x: 3350, y: 2250, r: 80 },
      { kind: 'collect', text: 'Pick up the package', x: 3350, y: 2250, r: 70 },
      { kind: 'goto', text: 'Bring it back to Voss Garage', x: 800, y: 2050, r: 80 },
    ],
  },
  {
    id: 'hotwheels', title: 'M2 · Hot Wheels', pay: 450,
    brief: 'A client wants a Vanta GT. It is parked uptown — take it, quietly, and bring it to the chop shop.',
    stages: [
      { kind: 'steal', text: 'Steal the marked Vanta GT', x: 1800, y: 850, r: 90 },
      { kind: 'deliver', text: 'Deliver the Vanta to the chop shop', x: 2800, y: 2050, r: 80 },
    ],
  },
  {
    id: 'getaway', title: 'M3 · The Getaway', pay: 600,
    brief: 'The job went loud. Survive the chase, then get to the hideout.',
    stages: [
      { kind: 'survive', text: 'Survive the chase — keep moving', seconds: 45, wanted: 3 },
      { kind: 'goto', text: 'Reach the hideout', x: 300, y: 2050, r: 80 },
    ],
  },
  {
    id: 'justice', title: 'M4 · Street Justice', pay: 750,
    brief: 'The Kingsmen jumped one of ours at Civic Plaza. Go settle it — then get clear.',
    stages: [
      { kind: 'eliminate', text: 'Deal with the Kingsmen at the plaza', x: 1550, y: 1250, r: 130, count: 3 },
      { kind: 'goto', text: 'Get back to Voss Garage', x: 800, y: 2050, r: 80 },
    ],
  },
  {
    id: 'bigscore', title: 'M5 · The Big Score', pay: 1500,
    brief: 'First Meridian Bank. In, out, gone — the docks are waiting.',
    stages: [
      { kind: 'goto', text: 'Get to First Meridian Bank', x: 1800, y: 850, r: 80 },
      { kind: 'collect', text: 'Grab the cash', x: 1800, y: 850, r: 70 },
      { kind: 'escape', text: 'Escape to the docks — 4 stars on you', x: 2800, y: 2300, r: 90, wanted: 4 },
    ],
  },
];

/** The closest point of a rect to (x, y) pushes a circle out; returns the corrected centre. */
function resolveCircleRect(x, y, radius, rect) {
  const cx = clamp(x, rect.x, rect.x + rect.w);
  const cy = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - cx;
  const dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return null;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    return { x: cx + (dx / d) * radius, y: cy + (dy / d) * radius, hit: true };
  }
  // Centre inside the rect: push out along the smallest penetration.
  const left = x - rect.x;
  const right = rect.x + rect.w - x;
  const top = y - rect.y;
  const bottom = rect.y + rect.h - y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: rect.x - radius, y, hit: true };
  if (m === right) return { x: rect.x + rect.w + radius, y, hit: true };
  if (m === top) return { x, y: rect.y - radius, hit: true };
  return { x, y: rect.y + rect.h + radius, hit: true };
}

/** Does the segment (x1,y1)-(x2,y2) cross any building? Sampled, for line of sight. */
function losBlocked(buildings, x1, y1, x2, y2) {
  const steps = Math.ceil(dist(x1, y1, x2, y2) / 24);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    for (let b = 0; b < buildings.length; b++) {
      const r = buildings[b];
      if (x > r.x - 2 && x < r.x + r.w + 2 && y > r.y - 2 && y < r.y + r.h + 2) return true;
    }
  }
  return false;
}

function buildCity(rng) {
  const buildings = [];
  const parks = [];
  const trees = [];
  const landmarks = {
    garage: { x: 800, y: 2050 },
    bank: { x: 1800, y: 850 },
    docks: { x: 2800, y: 2300 },
    plaza: { x: 1550, y: 1250 },
    chop: { x: 2800, y: 2050 },
    hideout: { x: 300, y: 2050 },
    harbour: { x: 3350, y: 2250 },
  };
  const parkBlocks = [
    { v: 4, h: 0 }, // north-east park (2300-2800, 250-650)
    { v: 0, h: 2 }, // west park (300-800, 1050-1450)
  ];
  const isPark = (vi, hi) => parkBlocks.some((p) => p.v === vi && p.h === hi);
  const inset = ROAD_W / 2 + WALK_W + 8;
  let plaza = null;

  for (let vi = 0; vi < ROADS_V.length - 1; vi++) {
    for (let hi = 0; hi < ROADS_H.length - 1; hi++) {
      const x0 = ROADS_V[vi] + inset;
      const x1 = ROADS_V[vi + 1] - inset;
      const y0 = ROADS_H[hi] + inset;
      const y1 = ROADS_H[hi + 1] - inset;
      if (vi === 2 && hi === 2) {
        // Civic Plaza: open paved square, no buildings, so missions can stage here.
        plaza = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        for (let t = 0; t < 8; t++) {
          trees.push({ x: rng.range(x0 + 24, x1 - 24), y: rng.range(y0 + 24, y1 - 24), r: rng.range(9, 14) });
        }
        continue;
      }
      if (isPark(vi, hi)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = Math.floor(((x1 - x0) * (y1 - y0)) / 9000);
        for (let t = 0; t < n; t++) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 16) });
        }
        continue;
      }
      // One or two buildings per block, placed on a rough grid.
      const cols = x1 - x0 > 320 ? 2 : 1;
      const rows = y1 - y0 > 280 ? 2 : 1;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng.chance(0.14)) continue; // empty lot
          const cw = (x1 - x0) / cols;
          const ch = (y1 - y0) / rows;
          const w = rng.range(cw * 0.55, cw * 0.85);
          const h = rng.range(ch * 0.5, ch * 0.8);
          const x = x0 + c * cw + (cw - w) / 2 + rng.range(-8, 8);
          const y = y0 + r * ch + (ch - h) / 2 + rng.range(-8, 8);
          const ci = rng.int(0, BUILDING_COLORS.length - 1);
          buildings.push({
            x, y, w, h,
            color: BUILDING_COLORS[ci],
            roof: ROOF_COLORS[ci],
            shade: rng.int(5, 14),
            lit: rng.next(),
          });
        }
      }
    }
  }
  return { buildings, parks, trees, landmarks, plaza };
}

export function createWorld(rng) {
  const city = buildCity(rng);
  const state = {
    time: 0,
    seed: 0,
    city,
    player: null,
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    pickups: [],
    particles: [],
    tracers: [],
    missionIndex: 0,
    stageIndex: 0,
    stageTimer: 0,
    stageStarted: false,
    marker: null,
    missionText: '',
    storyComplete: false,
    message: '',
    messageT: 0,
    damageFlash: 0,
    stats: { missionsDone: 0, carsStolen: 0, pedsHit: 0, shotsFired: 0, earned: 0 },
  };

  function solidAt(x, y, radius) {
    // World bounds and the water band are solid.
    if (x < radius || x > WORLD.width - radius || y < radius || y > WORLD.height - radius) {
      return { x: clamp(x, radius, WORLD.width - radius), y: clamp(y, radius, WORLD.height - radius), hit: true };
    }
    if (y + radius > WATER_Y) return { x, y: WATER_Y - radius, hit: true };
    for (let i = 0; i < city.buildings.length; i++) {
      const fixed = resolveCircleRect(x, y, radius, city.buildings[i]);
      if (fixed) return fixed;
    }
    return null;
  }

  function addParticle(x, y, vx, vy, life, color, size, kind) {
    if (state.particles.length > 220) state.particles.shift();
    state.particles.push({ x, y, vx, vy, life, maxLife: life, color, size, kind: kind || 'dot' });
  }

  function burst(x, y, n, color, speed, life, size) {
    for (let i = 0; i < n; i++) {
      const a = rng.next() * TAU;
      const s = rng.range(speed * 0.3, speed);
      addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, rng.range(life * 0.5, life), color, rng.range(size * 0.6, size * 1.4));
    }
  }

  function say(text, seconds) {
    state.message = text;
    state.messageT = seconds || 3.5;
  }

  function addWanted(n) {
    const p = state.player;
    if (!p) return;
    p.wanted = Math.min(WANTED.max, p.wanted + n);
    p.lastCrime = state.time;
    p.decayTimer = 0;
  }

  function randomRoadPoint(minPlayerDist) {
    for (let tries = 0; tries < 20; tries++) {
      const vertical = rng.chance(0.5);
      const line = rng.pick(vertical ? ROADS_V : ROADS_H);
      const along = rng.range(150, (vertical ? WORLD.height : WORLD.width) - 150);
      const x = vertical ? line : along;
      const y = vertical ? along : line;
      if (!state.player || dist(x, y, state.player.x, state.player.y) > minPlayerDist) return { x, y, vertical, line, along };
    }
    return { x: 1800, y: 250, vertical: true, line: 1800, along: 250 };
  }

  function spawnTrafficCar(far) {
    const pt = randomRoadPoint(far ? 700 : 250);
    const dir = rng.chance(0.5) ? 1 : -1;
    const car = {
      kind: 'traffic', axis: pt.vertical ? 'v' : 'h', line: pt.line, dir,
      pos: pt.along, speed: rng.range(120, CAR.trafficSpeed),
      targetSpeed: CAR.trafficSpeed, color: rng.pick(CAR_COLORS),
      x: pt.x, y: pt.y, angle: pt.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      hp: CAR.maxHp, lastTurnAt: -9999, honk: 0,
    };
    state.cars.push(car);
    return car;
  }

  function spawnParkedCar(x, y, angle, color, kind) {
    const car = {
      kind: kind || 'parked', axis: 'v', line: x, dir: 1, pos: y,
      speed: 0, targetSpeed: 0, color: color || rng.pick(CAR_COLORS),
      x, y, angle, hp: CAR.maxHp, lastTurnAt: -9999, honk: 0,
    };
    state.cars.push(car);
    return car;
  }

  function spawnPed() {
    const vertical = rng.chance(0.5);
    const line = rng.pick(vertical ? ROADS_V : ROADS_H);
    const side = rng.chance(0.5) ? 1 : -1;
    const off = ROAD_W / 2 + WALK_W / 2;
    const along = rng.range(120, (vertical ? WORLD.height : WORLD.width) - 120);
    const ped = {
      axis: vertical ? 'v' : 'h', line, side, off, pos: along,
      dir: rng.chance(0.5) ? 1 : -1, speed: rng.range(40, PED.walkSpeed),
      x: vertical ? line + side * off : along,
      y: vertical ? along : line + side * off,
      color: rng.pick(PED_COLORS), state: 'walk', timer: 0,
      fleeX: 0, fleeY: 0, down: 0,
    };
    state.peds.push(ped);
    return ped;
  }

  function spawnPickup(kind) {
    const pt = randomRoadPoint(200);
    const kinds = { cash: { amount: rng.int(40, 140) }, health: { amount: 30 }, ammo: { amount: 18 } };
    state.pickups.push({ kind, x: pt.x + rng.range(-40, 40), y: pt.y + rng.range(-40, 40), amount: kinds[kind].amount, bob: rng.next() * TAU });
    return state.pickups[state.pickups.length - 1];
  }

  function spawnCop() {
    const pt = randomRoadPoint(750);
    const angle = Math.atan2(state.player.y - pt.y, state.player.x - pt.x);
    const cop = {
      kind: 'police', axis: 'v', line: pt.x, dir: 1, pos: pt.y,
      speed: 0, targetSpeed: CAR.policeSpeed, color: '#e8e8e8',
      x: pt.x, y: pt.y, angle, hp: CAR.maxHp, lastTurnAt: -9999,
      bust: 0, ramCd: 0,
    };
    state.cops.push(cop);
    return cop;
  }

  function spawnRival(x, y) {
    const rival = { x: x + rng.range(-40, 40), y: y + rng.range(-40, 40), hp: 100, shootCd: rng.range(0.5, 1.2), angle: 0, dead: false, mission: true };
    state.enemies.push(rival);
    return rival;
  }

  function currentMission() {
    return state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
  }

  function currentStage() {
    const m = currentMission();
    return m ? m.stages[state.stageIndex] : null;
  }

  function startStage() {
    const stage = currentStage();
    state.stageStarted = true;
    state.stageTimer = stage && stage.seconds ? stage.seconds : 0;
    if (!stage) {
      state.marker = null;
      state.missionText = '';
      return;
    }
    state.missionText = stage.text;
    if (stage.kind === 'steal') {
      const car = spawnParkedCar(stage.x, stage.y, Math.PI / 2, '#e8c33c', 'target');
      car.target = true;
      state.marker = { x: stage.x, y: stage.y };
    } else if (stage.kind === 'eliminate') {
      state.rivalsLeft = stage.count;
      for (let i = 0; i < stage.count; i++) spawnRival(stage.x, stage.y);
      state.marker = { x: stage.x, y: stage.y };
    } else if (stage.kind === 'survive' || stage.kind === 'escape') {
      addWanted(stage.wanted || 3);
      state.marker = stage.kind === 'escape' ? { x: stage.x, y: stage.y } : null;
      if (stage.kind === 'survive') say('Lose them — stay out of sight, keep moving!', 4);
    } else {
      state.marker = { x: stage.x, y: stage.y };
    }
  }

  function advanceStage() {
    const mission = currentMission();
    if (!mission) return;
    state.stageIndex += 1;
    state.stageStarted = false;
    if (state.stageIndex >= mission.stages.length) {
      state.player.money += mission.pay;
      state.stats.earned += mission.pay;
      state.stats.missionsDone += 1;
      say(`Mission complete: ${mission.title}  +$${mission.pay}`, 4);
      state.missionIndex += 1;
      state.stageIndex = 0;
      if (state.missionIndex >= MISSIONS.length) {
        state.storyComplete = true;
        state.missionText = '';
        state.marker = null;
        say('Story complete — Vireo City is yours. Free roam.', 6);
        state.events = (state.events || 0) | EVENT_STORY;
      }
      state.events = (state.events || 0) | EVENT_MISSION;
      startStage();
    } else {
      startStage();
    }
  }

  function updateMission(dt) {
    const mission = currentMission();
    if (!mission) return;
    if (!state.stageStarted) startStage();
    const stage = currentStage();
    if (!stage) return;
    const p = state.player;
    if (stage.kind === 'goto' || stage.kind === 'collect') {
      if (dist(p.x, p.y, stage.x, stage.y) < stage.r) {
        if (stage.kind === 'collect' && mission.id === 'bigscore') {
          addWanted(4);
          say('Alarms! Four stars — run for the docks!', 4);
        }
        advanceStage();
      }
    } else if (stage.kind === 'steal') {
      if (p.car && p.car.target) advanceStage();
    } else if (stage.kind === 'deliver') {
      if (p.car && p.car.target && dist(p.x, p.y, stage.x, stage.y) < stage.r) {
        // Chop shop takes the car; the player steps out.
        const car = p.car;
        state.cars.splice(state.cars.indexOf(car), 1);
        p.car = null;
        p.onFoot = true;
        p.x = car.x + 40;
        p.y = car.y;
        advanceStage();
      }
    } else if (stage.kind === 'survive') {
      state.stageTimer -= dt;
      state.missionText = `Survive the chase — ${Math.max(0, Math.ceil(state.stageTimer))}s`;
      if (state.stageTimer <= 0) advanceStage();
    } else if (stage.kind === 'eliminate') {
      const alive = state.enemies.filter((e) => e.mission && !e.dead).length;
      state.missionText = `${stage.text} — ${alive} left`;
      if (alive === 0) advanceStage();
    } else if (stage.kind === 'escape') {
      if (dist(p.x, p.y, stage.x, stage.y) < stage.r) {
        p.wanted = 0;
        p.lastCrime = 0;
        say('Clean getaway.', 3);
        advanceStage();
      }
    }
  }

  function enterCar(car) {
    const p = state.player;
    if (car.kind === 'traffic') {
      // The driver bails and runs; stealing a manned car is a crime.
      const driver = spawnPed();
      driver.x = car.x + 30;
      driver.y = car.y;
      driver.state = 'flee';
      driver.fleeX = car.x + 300;
      driver.fleeY = car.y;
      driver.timer = 3;
      addWanted(WANTED.stealCar);
      state.stats.carsStolen += 1;
      say('Car stolen — the driver ran for it!', 2.5);
    } else if (car.kind === 'target') {
      state.stats.carsStolen += 1;
      say('That is the Vanta. Get it to the chop shop.', 3);
    } else if (car.kind === 'police') {
      addWanted(2);
      say('You stole a cop car?!', 2.5);
    }
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    car.kind = 'player';
    car.speed = 0;
  }

  function exitCar() {
    const p = state.player;
    if (!p.car || Math.abs(p.car.speed) > 60) return;
    const car = p.car;
    car.kind = 'parked';
    car.speed = 0;
    p.car = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    const fixed = solidAt(p.x, p.y, PLAYER.radius);
    if (fixed) {
      p.x = fixed.x;
      p.y = fixed.y;
    }
  }

  function fireGun(aimX, aimY) {
    const p = state.player;
    if (p.fireCd > 0) return;
    p.fireCd = PLAYER.fireCooldown;
    state.stats.shotsFired += 1;
    state.events = (state.events || 0) | EVENT_SHOT;
    const ax = p.x + Math.cos(p.angle) * 20;
    const ay = p.y + Math.sin(p.angle) * 20;
    let tx = ax + Math.cos(p.angle) * PLAYER.gunRange;
    let ty = ay + Math.sin(p.angle) * PLAYER.gunRange;
    if (aimX !== null && aimY !== null) {
      const a = Math.atan2(aimY - p.y, aimX - p.x);
      p.angle = a;
      tx = p.x + Math.cos(a) * PLAYER.gunRange;
      ty = p.y + Math.sin(a) * PLAYER.gunRange;
    }
    // Nearest enemy the ray passes close to, with a clear line of sight.
    let best = null;
    let bestD = Infinity;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const ex = e.x - ax;
      const ey = e.y - ay;
      const along = ex * Math.cos(p.angle) + ey * Math.sin(p.angle);
      if (along < 0 || along > PLAYER.gunRange) continue;
      const perp = Math.abs(-ex * Math.sin(p.angle) + ey * Math.cos(p.angle));
      if (perp < 16 && along < bestD && !losBlocked(city.buildings, ax, ay, e.x, e.y)) {
        best = e;
        bestD = along;
      }
    }
    if (best) {
      tx = best.x;
      ty = best.y;
      best.hp -= PLAYER.gunDamage;
      burst(best.x, best.y, 8, '#a33327', 160, 0.5, 4);
      if (best.hp <= 0) {
        best.dead = true;
        state.pickups.push({ kind: 'cash', x: best.x, y: best.y, amount: 120, bob: 0 });
        burst(best.x, best.y, 16, '#a33327', 220, 0.8, 5);
      }
    }
    p.ammo -= 1;
    state.tracers.push({ x1: ax, y1: ay, x2: tx, y2: ty, life: 0.09, maxLife: 0.09 });
    addParticle(ax + Math.cos(p.angle) * 14, ay + Math.sin(p.angle) * 14, 0, 0, 0.06, '#ffd98a', 7, 'flash');
    // Firing keeps the heat on: the quiet-decay clock restarts.
    p.lastCrime = state.time;
    if (p.crimeCd <= 0) {
      addWanted(WANTED.shoot);
      p.crimeCd = 4;
    }
  }

  function punch() {
    const p = state.player;
    if (p.fireCd > 0) return;
    p.fireCd = 0.4;
    for (const e of state.enemies) {
      if (e.dead) continue;
      if (dist(p.x, p.y, e.x, e.y) < PLAYER.punchRange) {
        e.hp -= PLAYER.punchDamage;
        burst(e.x, e.y, 6, '#e8e0d0', 140, 0.4, 4);
        if (e.hp <= 0) {
          e.dead = true;
          state.pickups.push({ kind: 'cash', x: e.x, y: e.y, amount: 120, bob: 0 });
        }
        break;
      }
    }
  }

  function updatePlayer(dt, input) {
    const p = state.player;
    p.fireCd = Math.max(0, (p.fireCd || 0) - dt);
    p.crimeCd = Math.max(0, (p.crimeCd || 0) - dt);
    p.hurtCd = Math.max(0, (p.hurtCd || 0) - dt);
    if (p.onFoot) {
      const sp = PLAYER.walkSpeed * (input.sprint ? 1.3 : 1);
      let nx = p.x + input.move.x * sp * dt;
      let ny = p.y + input.move.y * sp * dt;
      const fixed = solidAt(nx, ny, PLAYER.radius);
      if (fixed) {
        nx = fixed.x;
        ny = fixed.y;
      } else {
        // Try sliding along one axis when the diagonal is blocked.
        const fx = solidAt(nx, p.y, PLAYER.radius);
        const fy = solidAt(p.x, ny, PLAYER.radius);
        if (fx && !fy) {
          nx = p.x;
        } else if (fy && !fx) {
          ny = p.y;
        } else if (fx && fy) {
          nx = p.x;
          ny = p.y;
        }
      }
      p.x = nx;
      p.y = ny;
      if (input.move.x !== 0 || input.move.y !== 0) p.angle = Math.atan2(input.move.y, input.move.x);
      if (input.enter) {
        let best = null;
        let bestD = 64;
        for (const car of [...state.cars, ...state.cops]) {
          if (car.kind === 'player') continue;
          const d = dist(p.x, p.y, car.x, car.y);
          if (d < bestD) {
            best = car;
            bestD = d;
          }
        }
        if (best) enterCar(best);
      }
      if (input.shoot) {
        if (p.ammo > 0) fireGun(input.aim ? input.aim.x : null, input.aim ? input.aim.y : null);
        else punch();
      }
    } else if (p.car) {
      const car = p.car;
      const prevSpeed = car.speed;
      if (input.throttle > 0) car.speed += CAR.accel * dt;
      else if (input.throttle < 0) {
        if (car.speed > 20) car.speed -= CAR.brake * dt;
        else car.speed -= CAR.accel * 0.7 * dt;
      } else {
        car.speed -= car.speed * 0.9 * dt;
      }
      car.speed = clamp(car.speed, -CAR.reverseMax, CAR.maxSpeed);
      const steerAuthority = clamp(Math.abs(car.speed) / 220, 0, 1);
      car.angle += input.steer * CAR.steerRate * steerAuthority * dt * (car.speed >= 0 ? 1 : -1);
      let nx = car.x + Math.cos(car.angle) * car.speed * dt;
      let ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const fixed = solidAt(nx, ny, CAR.radius);
      if (fixed) {
        nx = fixed.x;
        ny = fixed.y;
        if (Math.abs(car.speed) > 300) {
          car.hp -= (Math.abs(car.speed) - 300) / 22;
          burst(car.x, car.y, 8, '#e8dd9a', 180, 0.5, 4);
        }
        car.speed *= 0.4;
      }
      car.x = nx;
      car.y = ny;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = car.speed;
      if (Math.abs(car.speed) > 470 && rng.chance(0.12)) {
        addParticle(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 0, 0, 0.35, 'rgba(200,200,200,0.5)', 6, 'smoke');
      }
      if (input.enter) exitCar();
      // Run over pedestrians.
      for (const ped of state.peds) {
        if (ped.state === 'down') continue;
        if (Math.abs(car.speed) > 90 && dist(car.x, car.y, ped.x, ped.y) < 30) {
          ped.state = 'down';
          ped.down = 18;
          car.speed *= 0.85;
          burst(ped.x, ped.y, 10, '#a33327', 160, 0.6, 4);
          state.stats.pedsHit += 1;
          if (p.crimeCd <= 0) {
            addWanted(WANTED.hitPed);
            p.crimeCd = 2.5;
            say('You hit a pedestrian!', 2.5);
          }
        }
      }
      if (car.hp <= 0) {
        burst(car.x, car.y, 24, '#3a3f4a', 260, 1, 7);
        state.cars.splice(state.cars.indexOf(car), 1);
        p.car = null;
        p.onFoot = true;
        p.x = car.x + 40;
        p.y = car.y;
        say('Your car is wrecked!', 3);
      }
      void prevSpeed;
    }
    // Slow health regen while calm.
    if (p.wanted === 0 && p.health < PLAYER.maxHealth && state.time - p.lastHurt > 8) {
      p.health = Math.min(PLAYER.maxHealth, p.health + 4 * dt);
    }
  }

  function carAheadOnRoad(car, all) {
    for (const other of all) {
      if (other === car || other.speed === 0) continue;
      if (other.axis !== car.axis || other.line !== car.line || other.dir !== car.dir) continue;
      const gap = (other.pos - car.pos) * car.dir;
      if (gap > 0 && gap < 85) return other;
    }
    return null;
  }

  function updateTraffic(dt) {
    const all = [...state.cars];
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      const ahead = carAheadOnRoad(car, all);
      let target = CAR.trafficSpeed;
      if (ahead) target = Math.min(target, Math.max(0, ahead.speed * 0.85));
      // Brake for the player's car ahead.
      const pc = state.player.car;
      if (pc && Math.abs(pc.x - car.x) < 90 && Math.abs(pc.y - car.y) < 90) {
        const along = car.axis === 'v' ? (pc.y - car.y) * car.dir : (pc.x - car.x) * car.dir;
        const lat = car.axis === 'v' ? Math.abs(pc.x - car.x) : Math.abs(pc.y - car.y);
        if (along > 0 && along < 95 && lat < 40) target = 0;
      }
      car.speed += clamp(target - car.speed, -420 * dt, 260 * dt);
      // Intersection: maybe turn.
      const crosses = car.axis === 'v' ? ROADS_H : ROADS_V;
      let nextCross = null;
      for (const c of crosses) {
        if ((c - car.pos) * car.dir > 20) {
          nextCross = c;
          break;
        }
      }
      if (nextCross !== null && Math.abs(car.pos - nextCross) < 26 && car.lastTurnAt !== nextCross) {
        car.lastTurnAt = nextCross;
        if (rng.chance(0.32)) {
          const newDir = rng.chance(0.5) ? 1 : -1;
          const oldLine = car.line;
          car.axis = car.axis === 'v' ? 'h' : 'v';
          car.line = nextCross;
          car.dir = newDir;
          car.pos = oldLine;
        }
      }
      car.pos += car.dir * car.speed * dt;
      if (car.pos < 60 || car.pos > (car.axis === 'v' ? WORLD.height : WORLD.width) - 60) {
        // Reached the edge: respawn elsewhere, away from the player.
        const pt = randomRoadPoint(700);
        car.axis = pt.vertical ? 'v' : 'h';
        car.line = pt.line;
        car.pos = pt.along;
        car.dir = rng.chance(0.5) ? 1 : -1;
        car.speed = rng.range(120, CAR.trafficSpeed);
      }
      if (car.axis === 'v') {
        car.x = car.line + (car.dir > 0 ? -26 : 26);
        car.y = car.pos;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.x = car.pos;
        car.y = car.line + (car.dir > 0 ? 26 : -26);
        car.angle = car.dir > 0 ? 0 : Math.PI;
      }
    }
    // Player car shoves traffic cars aside.
    const pc = state.player.car;
    if (pc) {
      for (const car of state.cars) {
        if (car.kind !== 'traffic') continue;
        const d = dist(pc.x, pc.y, car.x, car.y);
        if (d < 40 && d > 0.01) {
          const push = (40 - d) * 0.5;
          const nx = (car.x - pc.x) / d;
          const ny = (car.y - pc.y) / d;
          car.x += nx * push;
          car.y += ny * push;
          if (Math.abs(pc.speed) > 220) {
            car.speed *= 0.6;
            pc.hp -= 2;
            burst(car.x, car.y, 5, '#e8dd9a', 140, 0.4, 3);
          }
        }
      }
    }
  }

  function updatePeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.state === 'down') {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.state = 'flee';
          ped.timer = 3;
          ped.fleeX = ped.x + (ped.x > p.x ? 400 : -400);
          ped.fleeY = ped.y;
        }
        continue;
      }
      // Danger: gunfire, a fast car nearby, or a police chase close by.
      let danger = null;
      if (state.time - (state.lastShotAt || -99) < 0.6 && dist(ped.x, ped.y, p.x, p.y) < 320) danger = { x: p.x, y: p.y };
      const pc = p.car;
      if (pc && Math.abs(pc.speed) > 150 && dist(ped.x, ped.y, pc.x, pc.y) < 90) danger = { x: pc.x, y: pc.y };
      if (danger && ped.state !== 'flee') {
        ped.state = 'flee';
        ped.timer = 2;
        const a = Math.atan2(ped.y - danger.y, ped.x - danger.x);
        ped.fleeX = ped.x + Math.cos(a) * 400;
        ped.fleeY = ped.y + Math.sin(a) * 400;
      }
      if (ped.state === 'flee') {
        ped.timer -= dt;
        const a = Math.atan2(ped.fleeY - ped.y, ped.fleeX - ped.x);
        const sp = PED.runSpeed;
        ped.x += Math.cos(a) * sp * dt;
        ped.y += Math.sin(a) * sp * dt;
        const fixed = solidAt(ped.x, ped.y, PED.radius);
        if (fixed) {
          ped.x = fixed.x;
          ped.y = fixed.y;
        }
        if (ped.timer <= 0) {
          ped.state = 'walk';
          // Re-anchor onto the nearest sidewalk.
          const vertical = Math.abs(ped.x - p.x) > 0;
          void vertical;
        }
        continue;
      }
      // Walk along the sidewalk; maybe turn at an intersection.
      const crosses = ped.axis === 'v' ? ROADS_H : ROADS_V;
      let nextCross = null;
      for (const c of crosses) {
        if ((c - ped.pos) * ped.dir > 10) {
          nextCross = c;
          break;
        }
      }
      if (nextCross !== null && Math.abs(ped.pos - nextCross) < 14 && rng.chance(0.25)) {
        const oldLine = ped.line;
        ped.axis = ped.axis === 'v' ? 'h' : 'v';
        ped.line = nextCross;
        ped.side = rng.chance(0.5) ? 1 : -1;
        ped.dir = rng.chance(0.5) ? 1 : -1;
        ped.pos = oldLine;
      }
      ped.pos += ped.dir * ped.speed * dt;
      if (ped.pos < 80 || ped.pos > (ped.axis === 'v' ? WORLD.height : WORLD.width) - 80) {
        ped.dir *= -1;
        ped.pos = clamp(ped.pos, 80, (ped.axis === 'v' ? WORLD.height : WORLD.width) - 80);
      }
      if (ped.axis === 'v') {
        ped.x = ped.line + ped.side * ped.off;
        ped.y = ped.pos;
      } else {
        ped.x = ped.pos;
        ped.y = ped.line + ped.side * ped.off;
      }
    }
  }

  function updateCops(dt) {
    const p = state.player;
    const wanted = p.wanted;
    const desired = wanted > 0 ? Math.min(1 + wanted, 5) : 0;
    while (state.cops.length < desired) spawnCop();
    if (wanted === 0) {
      // Heat gone: the chase peels off.
      for (const cop of state.cops) {
        cop.speed = Math.max(0, cop.speed - 300 * dt);
      }
      state.cops = state.cops.filter((c) => dist(c.x, c.y, p.x, p.y) < 1600);
    }
    for (const cop of state.cops) {
      cop.ramCd = Math.max(0, cop.ramCd - dt);
      const targetAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
      const diff = angleDiff(targetAngle, cop.angle);
      cop.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      cop.speed += (CAR.policeSpeed - cop.speed) * Math.min(1, 0.9 * dt);
      if (Math.abs(diff) > 1.2) cop.speed = Math.min(cop.speed, 260);
      let nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
      let ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
      const fixed = solidAt(nx, ny, CAR.radius);
      if (fixed) {
        nx = fixed.x;
        ny = fixed.y;
        cop.speed *= 0.5;
        cop.angle += 0.6 * dt * (rng.chance(0.5) ? 1 : -1);
      }
      cop.x = nx;
      cop.y = ny;
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (d > 1700) {
        // Too far behind: respawn closer to the chase.
        const pt = randomRoadPoint(700);
        cop.x = pt.x;
        cop.y = pt.y;
        cop.angle = Math.atan2(p.y - pt.y, p.x - pt.x);
        cop.speed = 300;
      }
      if (p.onFoot) {
        if (d < WANTED.bustDistance) {
          cop.bust += dt;
          if (cop.bust > WANTED.bustSeconds) {
            state.events = (state.events || 0) | EVENT_BUSTED;
            return;
          }
        } else {
          cop.bust = Math.max(0, cop.bust - dt);
        }
      } else if (p.car && d < 46 && cop.ramCd <= 0) {
        cop.ramCd = 0.6;
        p.car.hp -= 9;
        p.car.speed *= 0.82;
        burst(p.x, p.y, 8, '#e8dd9a', 200, 0.5, 4);
        say('Police are ramming you!', 2);
      }
    }
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      e.shootCd -= dt;
      if (d < 560 && d > 230) {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        e.angle = a;
        e.x += Math.cos(a) * 95 * dt;
        e.y += Math.sin(a) * 95 * dt;
        const fixed = solidAt(e.x, e.y, 12);
        if (fixed) {
          e.x = fixed.x;
          e.y = fixed.y;
        }
      } else if (d <= 230) {
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      }
      if (e.shootCd <= 0 && d < 430 && !losBlocked(city.buildings, e.x, e.y, p.x, p.y)) {
        e.shootCd = rng.range(0.9, 1.5);
        const hit = rng.chance(0.32);
        const tx = hit ? p.x : p.x + rng.range(-70, 70);
        const ty = hit ? p.y : p.y + rng.range(-70, 70);
        state.tracers.push({ x1: e.x, y1: e.y, x2: tx, y2: ty, life: 0.09, maxLife: 0.09 });
        if (hit && p.hurtCd <= 0) {
          p.health -= 9;
          p.lastHurt = state.time;
          p.hurtCd = 0.35;
          state.damageFlash = 0.5;
          burst(p.x, p.y, 6, '#a33327', 140, 0.4, 4);
          if (p.health <= 0) {
            p.health = 0;
            state.events = (state.events || 0) | EVENT_WASTED;
            return;
          }
        }
      }
    }
    state.enemies = state.enemies.filter((e) => !e.dead || state.time - (e.deadAt || 0) < 30);
    for (const e of state.enemies) if (e.dead && !e.deadAt) e.deadAt = state.time;
  }

  function updatePickups(dt) {
    const p = state.player;
    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const pk = state.pickups[i];
      pk.bob += dt * 3;
      if (dist(p.x, p.y, pk.x, pk.y) < 34) {
        if (pk.kind === 'cash') {
          p.money += pk.amount;
          state.stats.earned += pk.amount;
          say(`+$${pk.amount}`, 1.5);
        } else if (pk.kind === 'health') {
          p.health = Math.min(PLAYER.maxHealth, p.health + pk.amount);
          say(`Health +${pk.amount}`, 1.5);
        } else if (pk.kind === 'ammo') {
          p.ammo = Math.min(PLAYER.maxAmmo, p.ammo + pk.amount);
          say(`Ammo +${pk.amount}`, 1.5);
        }
        state.pickups.splice(i, 1);
        state.events = (state.events || 0) | EVENT_PICKUP;
      }
    }
    // Keep the city stocked.
    const want = { cash: 10, health: 5, ammo: 5 };
    for (const kind of Object.keys(want)) {
      const have = state.pickups.filter((pk) => pk.kind === kind).length;
      if (have < want[kind] && rng.chance(0.02)) spawnPickup(kind);
    }
  }

  function updateWanted(dt) {
    const p = state.player;
    if (p.wanted === 0) return;
    const nearCop = state.cops.some((c) => dist(c.x, c.y, p.x, p.y) < 700);
    if (state.time - p.lastCrime > WANTED.decayQuietSeconds && !nearCop) {
      p.decayTimer += dt;
      if (p.decayTimer >= WANTED.decayStepSeconds) {
        p.decayTimer = 0;
        p.wanted -= 1;
        if (p.wanted === 0) say('You lost them. Heat is off.', 3);
      }
    } else {
      p.decayTimer = 0;
    }
  }

  function reset(seed) {
    state.seed = seed;
    state.time = 0;
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.enemies = [];
    state.pickups = [];
    state.particles = [];
    state.tracers = [];
    state.missionIndex = 0;
    state.stageIndex = 0;
    state.stageTimer = 0;
    state.stageStarted = false;
    state.marker = null;
    state.missionText = '';
    state.storyComplete = false;
    state.message = '';
    state.messageT = 0;
    state.damageFlash = 0;
    state.lastShotAt = -99;
    state.events = 0;
    state.stats = { missionsDone: 0, carsStolen: 0, pedsHit: 0, shotsFired: 0, earned: 0 };
    state.player = {
      x: 826, y: 2050, angle: -Math.PI / 2, health: PLAYER.maxHealth,
      money: 0, ammo: PLAYER.startAmmo, wanted: 0, heat: 0,
      onFoot: true, car: null, speed: 0, fireCd: 0, crimeCd: 0,
      hurtCd: 0, lastCrime: -99, lastHurt: -99, decayTimer: 0,
    };
    for (let i = 0; i < TRAFFIC_COUNT; i++) spawnTrafficCar(false);
    // Parked cars along the curbs.
    spawnParkedCar(326, 420, Math.PI / 2, '#c94f43');
    spawnParkedCar(826, 900, -Math.PI / 2, '#4a7fb5');
    spawnParkedCar(1326, 1600, Math.PI / 2, '#7d9b76');
    spawnParkedCar(1826, 300, Math.PI / 2, '#d9a441');
    spawnParkedCar(2326, 1200, -Math.PI / 2, '#8a6fb0');
    spawnParkedCar(2826, 2000, Math.PI / 2, '#c9c9c9');
    spawnParkedCar(1076, 650, 0, '#e07b39');
    spawnParkedCar(2276, 1450, Math.PI, '#3a3f4a');
    for (let i = 0; i < PED.count; i++) spawnPed();
    for (let i = 0; i < 10; i++) spawnPickup('cash');
    for (let i = 0; i < 5; i++) spawnPickup('health');
    for (let i = 0; i < 5; i++) spawnPickup('ammo');
    startStage();
  }

  function step(dt, input, attract) {
    state.events = 0;
    state.time += dt;
    state.messageT = Math.max(0, state.messageT - dt);
    state.damageFlash = Math.max(0, state.damageFlash - dt);
    if (state.lastShotAt !== undefined && input.shoot && state.player.onFoot) state.lastShotAt = state.time;
    if (attract) {
      updateTraffic(dt);
      updatePeds(dt);
      for (const t of state.tracers) t.life -= dt;
      state.tracers = state.tracers.filter((t) => t.life > 0);
      for (const pt of state.particles) {
        pt.life -= dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
      }
      state.particles = state.particles.filter((pt) => pt.life > 0);
      return EVENT_NONE;
    }
    updateMission(dt);
    updatePlayer(dt, input);
    if (state.events & (EVENT_WASTED | EVENT_BUSTED)) return state.events;
    updateTraffic(dt);
    updatePeds(dt);
    updateCops(dt);
    if (state.events & (EVENT_WASTED | EVENT_BUSTED)) return state.events;
    updateEnemies(dt);
    if (state.events & EVENT_WASTED) return state.events;
    updatePickups(dt);
    updateWanted(dt);
    for (const t of state.tracers) t.life -= dt;
    state.tracers = state.tracers.filter((t) => t.life > 0);
    for (const pt of state.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - 2 * dt;
      pt.vy *= 1 - 2 * dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
    return state.events;
  }

  reset(1);

  return {
    state,
    city,
    reset,
    step,
    say,
    addWanted,
    spawnCop,
    spawnRival,
    spawnParkedCar,
    currentMission,
    currentStage,
    placePlayerInCar(x, y, angle, color) {
      const car = spawnParkedCar(x, y, angle, color || '#e8b13c', 'player');
      const p = state.player;
      p.car = car;
      p.onFoot = false;
      p.x = x;
      p.y = y;
      p.angle = angle;
      return car;
    },
  };
}
