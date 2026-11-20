// Vireo City — every tuning number, layout constant and colour in one place.
// The playfield is a fixed 1280x720 logical view; the world is 3600x2600 and the
// camera follows the player, so no rule below depends on the window size.

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3600, height: 2600 };
/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** North-south avenues (x centres) and east-west streets (y centres). */
export const ROADS_V = [300, 800, 1300, 1800, 2300, 2800, 3300];
export const ROADS_H = [250, 650, 1050, 1450, 1850, 2250];
export const ROAD_W = 100;
/** Sidewalk strip each side of a road. */
export const WALK_W = 26;
/** South edge: beach then open water. */
export const BEACH_Y = 2340;
export const WATER_Y = 2420;

export const PLAYER = {
  walkSpeed: 215,
  radius: 14,
  maxHealth: 100,
  startAmmo: 24,
  maxAmmo: 120,
  fireCooldown: 0.22,
  punchRange: 46,
  punchDamage: 22,
  gunDamage: 34,
  gunRange: 460,
};

export const CAR = {
  accel: 460,
  brake: 760,
  reverseMax: 230,
  maxSpeed: 560,
  trafficSpeed: 185,
  policeSpeed: 620,
  steerRate: 2.7,
  radius: 19,
  length: 48,
  width: 24,
  maxHp: 100,
};

export const PED = { walkSpeed: 55, runSpeed: 150, radius: 11, count: 26 };
export const TRAFFIC_COUNT = 16;
export const PICKUP_RESPAWN = 25;

export const WANTED = {
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  killCop: 2,
  max: 5,
  decayQuietSeconds: 12,
  decayStepSeconds: 5,
  bustDistance: 115,
  bustSeconds: 2.5,
};

/** Where the save and the best-money record live (this browser only). */
export const SAVE_KEY = 'vireo-city.save.v1';
export const BEST_KEY = 'vireo-city.best';

export const PALETTE = {
  ground: '#b39a68',
  grass: '#7fae5a',
  park: '#6da34e',
  sidewalk: '#c9b489',
  road: '#3b4048',
  roadEdge: '#2c3038',
  lane: '#e8dd9a',
  beach: '#e3cf9e',
  water: '#2e6f8e',
  waterDeep: '#25607e',
  building: ['#c96f4a', '#d9a05b', '#8fa8b8', '#b8b0a0', '#a97b8f', '#7d9b76', '#c2b280', '#9a8fc0'],
  roof: ['#8a4a34', '#a87c42', '#5f7d8c', '#8a8074', '#7d5568', '#5d7355', '#96865a', '#6f6390'],
  windowLit: '#ffd98a',
  windowDark: '#3a4a5a',
  player: '#e8b13c',
  playerDark: '#8a6414',
  cop: '#e8e8e8',
  copDark: '#1c2733',
  blood: '#a33327',
  text: '#f4efe2',
  muted: '#b9b2a0',
  hud: 'rgba(12, 14, 20, 0.72)',
  star: '#ffd23e',
  marker: '#ffd23e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
