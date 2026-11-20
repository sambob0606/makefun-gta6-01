// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// four screens: title, play, paused and game over. Progress saves to
// localStorage when a mission ends, and the title screen offers Continue.
//
// ?seed=N fixes the city. ?shot=start|drive|wanted|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, SAVE_KEY, STEP, VIEW, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION, EVENT_SHOT, EVENT_STORY, EVENT_WASTED, EVENT_PICKUP } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** The no-input snapshot the title screen's attract mode steps with. */
const IDLE_INPUT = { move: { x: 0, y: 0 }, throttle: 0, steer: 0, enter: false, shoot: false, aim: null, sprint: false };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best haul then lasts this visit only.
  }
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save || typeof save.money !== 'number' || typeof save.missionIndex !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave() {
  const p = world.state.player;
  try {
    window.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        money: p.money,
        missionIndex: world.state.missionIndex,
        x: p.x,
        y: p.y,
        health: p.health,
        ammo: p.ammo,
      }),
    );
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

function applySave(save) {
  world.reset(seed);
  const p = world.state.player;
  p.money = save.money;
  p.health = save.health;
  p.ammo = save.ammo;
  p.x = save.x;
  p.y = save.y;
  world.state.missionIndex = Math.min(save.missionIndex, 4);
  world.state.stageIndex = 0;
  world.state.stageStarted = false;
  world.state.marker = null;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let hasSave = readSave() !== null;
  let accumulator = 0;
  let last = performance.now();
  let newGameKey = false;

  window.addEventListener('keydown', (event) => {
    if (event.key === 'n' || event.key === 'N') newGameKey = true;
    audio.ensure();
  });
  canvas.addEventListener('mousedown', () => audio.ensure());

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fromSave) {
    if (fromSave) {
      const save = readSave();
      if (save) applySave(save);
      else world.reset(seed);
    } else {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // Storage can be off.
      }
      world.reset(seed);
    }
    hasSave = readSave() !== null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    const mission = world.currentMission();
    announce(`Playing. ${mission ? mission.title : 'Free roam'}.`);
  }

  function endGame(kind) {
    screen = SCREEN_OVER;
    const p = world.state.player;
    if (p.money > best) {
      best = p.money;
      saveBest(best);
    }
    announce(kind === 'wasted' ? `Wasted. $${p.money} kept.` : `Busted. $${p.money} kept.`);
  }

  function handleEvents(events) {
    if (events & EVENT_WASTED) endGame('wasted');
    else if (events & EVENT_BUSTED) endGame('busted');
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_MISSION) {
      audio.mission();
      writeSave();
      hasSave = true;
    }
    if (events & EVENT_STORY) {
      audio.mission();
      writeSave();
      hasSave = true;
    }
    const p = world.state.player;
    if (p.money > best) {
      best = p.money;
      saveBest(best);
    }
  }

  function readWorldInput(actions) {
    const p = world.state.player;
    const camX = clamp(p.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    const camY = clamp(p.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    const move = input.move();
    const drive = input.drive();
    return {
      move,
      throttle: drive.throttle,
      steer: drive.steer,
      enter: Boolean(actions & ACTION_ENTER),
      shoot: input.shooting(),
      aim: { x: input.mouse.x + camX, y: input.mouse.y + camY },
      sprint: input.sprint(),
    };
  }

  function step(actions) {
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, readWorldInput(actions), false);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    const wasNewGame = newGameKey;
    newGameKey = false;
    if (actions & ACTION_CONFIRM || wasNewGame) {
      audio.ensure();
      if (screen === SCREEN_TITLE) startGame(!wasNewGame && hasSave);
      else if (screen === SCREEN_OVER) startGame(hasSave);
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        accumulator = 0;
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        writeSave();
        hasSave = true;
        announce('Paused. Progress saved.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        accumulator = 0;
        announce('Playing.');
      }
    }
    accumulator += dt;
    let guard = 0;
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP && guard < 8) {
        world.step(STEP, IDLE_INPUT, true);
        accumulator -= STEP;
        guard += 1;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY && guard < 8) {
        step(actions);
        accumulator -= STEP;
        guard += 1;
      }
    } else {
      accumulator = 0;
    }
    if (guard >= 8) accumulator = 0;
    const p = world.state.player;
    audio.update(STEP, !p.onFoot, p.car ? p.car.speed : 0, p.wanted);
    renderer.draw(world.state, screen, best, hasSave);
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      writeSave();
      hasSave = true;
      announce('Paused. Progress saved.');
    }
  });

  announce('Vireo City. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
