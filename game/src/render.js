// Vireo City — the renderer: a top-down sun-soaked city, the cars and people in
// it, and the HUD (health, money, wanted stars, minimap, objective) plus the
// title, pause and game-over screens. All drawing is procedural canvas.

import { BEACH_Y, CAR, PALETTE, ROADS_H, ROADS_V, ROAD_W, VIEW, WALK_W, WATER_Y, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawCity(state, camX, camY) {
    const { city } = state;
    const x0 = camX - 40;
    const y0 = camY - 40;
    const x1 = camX + VIEW.width + 40;
    const y1 = camY + VIEW.height + 40;

    // Ground.
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

    // Parks.
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Civic Plaza paving.
    if (city.plaza) {
      ctx.fillStyle = '#cbb98d';
      ctx.fillRect(city.plaza.x, city.plaza.y, city.plaza.w, city.plaza.h);
      ctx.strokeStyle = 'rgba(90, 70, 40, 0.5)';
      ctx.lineWidth = 3;
      ctx.strokeRect(city.plaza.x + 8, city.plaza.y + 8, city.plaza.w - 16, city.plaza.h - 16);
      const cx = city.plaza.x + city.plaza.w / 2;
      const cy = city.plaza.y + city.plaza.h / 2;
      ctx.fillStyle = '#7fa8c9';
      ctx.beginPath();
      ctx.arc(cx, cy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dfe9f2';
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sidewalks: a pale band each side of every road.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const x of ROADS_V) ctx.fillRect(x - ROAD_W / 2 - WALK_W, Math.max(y0, 0), ROAD_W + WALK_W * 2, Math.min(y1, WORLD.height) - Math.max(y0, 0));
    for (const y of ROADS_H) ctx.fillRect(Math.max(x0, 0), y - ROAD_W / 2 - WALK_W, Math.min(x1, WORLD.width) - Math.max(x0, 0), ROAD_W + WALK_W * 2);

    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const x of ROADS_V) ctx.fillRect(x - ROAD_W / 2, Math.max(y0, 0), ROAD_W, Math.min(y1, WORLD.height) - Math.max(y0, 0));
    for (const y of ROADS_H) ctx.fillRect(Math.max(x0, 0), y - ROAD_W / 2, Math.min(x1, WORLD.width) - Math.max(x0, 0), ROAD_W);

    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    ctx.strokeStyle = PALETTE.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    ctx.beginPath();
    for (const x of ROADS_V) {
      ctx.moveTo(x, Math.max(y0, 0));
      ctx.lineTo(x, Math.min(y1, WORLD.height));
    }
    for (const y of ROADS_H) {
      ctx.moveTo(Math.max(x0, 0), y);
      ctx.lineTo(Math.min(x1, WORLD.width), y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Beach and water along the south edge.
    ctx.fillStyle = PALETTE.beach;
    ctx.fillRect(Math.max(x0, 0), BEACH_Y, Math.min(x1, WORLD.width) - Math.max(x0, 0), WATER_Y - BEACH_Y);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(Math.max(x0, 0), WATER_Y, Math.min(x1, WORLD.width) - Math.max(x0, 0), Math.min(y1, WORLD.height) - WATER_Y);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let wx = Math.floor(x0 / 180) * 180; wx < x1; wx += 180) {
      ctx.fillRect(wx, WATER_Y + 46 + ((wx / 180) % 3) * 30, 90, 5);
    }

    // Trees.
    for (const t of city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.arc(t.x + 4, t.y + 5, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4e7d3a';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6da34e';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Buildings: drop shadow, roof, windows.
    for (const b of city.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + b.shade, b.y + b.shade, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      // Window grid.
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 30));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const wx = b.x + 12 + c * ((b.w - 24) / cols);
          const wy = b.y + 11 + r * ((b.h - 22) / rows);
          const lit = ((c * 7 + r * 13 + Math.floor(b.lit * 97)) % 5) === 0;
          ctx.fillStyle = lit ? PALETTE.windowLit : PALETTE.windowDark;
          ctx.fillRect(wx, wy, 13, 10);
        }
      }
    }
  }

  function drawCar(car, isPlayer, time) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width, 8);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#14181d';
    ctx.fillRect(-17, -CAR.width / 2 - 3, 12, 6);
    ctx.fillRect(6, -CAR.width / 2 - 3, 12, 6);
    ctx.fillRect(-17, CAR.width / 2 - 3, 12, 6);
    ctx.fillRect(6, CAR.width / 2 - 3, 12, 6);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    ctx.fill();
    if (car.kind === 'police') {
      ctx.fillStyle = '#1c2733';
      roundRect(ctx, -6, -CAR.width / 2, 12, CAR.width, 4);
      ctx.fill();
      // Flashing light bar.
      const phase = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = phase ? '#ff3b30' : '#2f7bff';
      ctx.fillRect(-4, -CAR.width / 2 - 1, 8, 7);
      ctx.fillStyle = phase ? '#2f7bff' : '#ff3b30';
      ctx.fillRect(-4, CAR.width / 2 - 6, 8, 7);
    } else {
      // Windshield and rear window.
      ctx.fillStyle = 'rgba(30, 45, 60, 0.85)';
      roundRect(ctx, 4, -CAR.width / 2 + 4, 12, CAR.width - 8, 4);
      ctx.fill();
      roundRect(ctx, -18, -CAR.width / 2 + 4, 8, CAR.width - 8, 4);
      ctx.fill();
    }
    if (car.target) {
      // The marked car glows gold.
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 3;
      roundRect(ctx, -CAR.length / 2 - 4, -CAR.width / 2 - 4, CAR.length + 8, CAR.width + 8, 10);
      ctx.stroke();
    }
    if (isPlayer) {
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 2;
      roundRect(ctx, -CAR.length / 2 - 2, -CAR.width / 2 - 2, CAR.length + 4, CAR.width + 4, 9);
      ctx.stroke();
    }
    // Headlights.
    ctx.fillStyle = 'rgba(255, 244, 190, 0.9)';
    ctx.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 3, 3, 5);
    ctx.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 8, 3, 5);
    ctx.restore();
  }

  function drawPed(ped) {
    if (ped.state === 'down') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 13, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.arc(ped.x + 2, ped.y + 3, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c39a';
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(p, time) {
    if (!p.onFoot) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(p.x + 2, p.y + 3, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.playerDark;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.stroke();
    // Facing tick and gun.
    ctx.strokeStyle = '#2c2417';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
    ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
    ctx.stroke();
    // Subtle pulse so the player is findable at a glance.
    const pulse = 1 + 0.08 * Math.sin(time * 4);
    ctx.strokeStyle = 'rgba(255, 243, 196, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawMinimap(state) {
    const mw = 230;
    const mh = 168;
    const mx = VIEW.width - mw - 16;
    const my = VIEW.height - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 12, 18, 0.78)';
    roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 239, 226, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#8a744e';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2e6f8e';
    ctx.fillRect(mx, my + WATER_Y * sy, mw, mh - WATER_Y * sy);
    ctx.fillStyle = '#3b4048';
    for (const x of ROADS_V) ctx.fillRect(mx + x * sx - 2, my, 4, mh);
    for (const y of ROADS_H) ctx.fillRect(mx, my + y * sy - 2, mw, 4);
    if (state.marker) {
      const pulse = 3 + 2 * Math.sin(state.time * 5);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(mx + state.marker.x * sx, my + state.marker.y * sy, pulse + 2, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      ctx.fillStyle = car.kind === 'player' ? '#ffffff' : 'rgba(232, 232, 232, 0.85)';
      ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
    }
    for (const cop of state.cops) {
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of state.enemies) {
      if (e.dead) continue;
      ctx.fillStyle = '#ff7b54';
      ctx.fillRect(mx + e.x * sx - 2, my + e.y * sy - 2, 4, 4);
    }
    const p = state.player;
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North label.
    ctx.fillStyle = '#f4efe2';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', mx + 4, my + 12);
    ctx.restore();
  }

  function drawHud(state, best) {
    const p = state.player;
    ctx.save();
    // Top-left panel: health, money, ammo.
    ctx.fillStyle = PALETTE.hud;
    roundRect(ctx, 14, 12, 268, 84, 10);
    ctx.fill();
    ctx.fillStyle = '#f4efe2';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${p.money.toLocaleString('en-US')}`, 28, 38);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#b9b2a0';
    ctx.fillText(`Ammo ${p.ammo}`, 150, 38);
    ctx.fillText(p.onFoot ? 'ON FOOT' : `DRIVING  ${Math.abs(Math.round((p.car ? p.car.speed : 0) * 0.18))} mph`, 28, 60);
    // Health bar.
    ctx.fillStyle = '#3a2020';
    roundRect(ctx, 28, 68, 200, 12, 6);
    ctx.fill();
    ctx.fillStyle = p.health > 40 ? '#69c24a' : '#e5534b';
    const hw = 200 * clamp(p.health / 100, 0, 1);
    if (hw > 0) {
      roundRect(ctx, 28, 68, hw, 12, 6);
      ctx.fill();
    }
    ctx.fillStyle = '#f4efe2';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('HP', 232, 79);

    // Wanted stars, top-right.
    ctx.fillStyle = PALETTE.hud;
    roundRect(ctx, VIEW.width - 218, 12, 204, 46, 10);
    ctx.fill();
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#b9b2a0';
    ctx.fillText('WANTED', VIEW.width - 204, 30);
    for (let i = 0; i < 5; i++) {
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillStyle = i < p.wanted ? PALETTE.star : 'rgba(244, 239, 226, 0.25)';
      ctx.fillText('★', VIEW.width - 148 + i * 26, 44);
    }

    // Objective, top centre.
    if (state.missionText) {
      ctx.font = 'bold 15px system-ui, sans-serif';
      const w = ctx.measureText(state.missionText).width + 36;
      ctx.fillStyle = PALETTE.hud;
      roundRect(ctx, (VIEW.width - w) / 2, 12, w, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.textAlign = 'center';
      ctx.fillText(state.missionText, VIEW.width / 2, 35);
    }

    // Mission title line under the objective.
    const mission = state.missionIndex < 5 ? `M${state.missionIndex + 1} of 5` : 'Free roam';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(244, 239, 226, 0.75)';
    ctx.textAlign = 'center';
    ctx.fillText(state.storyComplete ? 'Story complete — free roam' : mission, VIEW.width / 2, 62);

    // Toast message.
    if (state.messageT > 0 && state.message) {
      ctx.globalAlpha = clamp(state.messageT, 0, 1);
      ctx.font = 'bold 16px system-ui, sans-serif';
      const w = ctx.measureText(state.message).width + 32;
      ctx.fillStyle = 'rgba(12, 14, 20, 0.85)';
      roundRect(ctx, (VIEW.width - w) / 2, 84, w, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#f4efe2';
      ctx.textAlign = 'center';
      ctx.fillText(state.message, VIEW.width / 2, 107);
      ctx.globalAlpha = 1;
    }

    // Controls hint, bottom-left.
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(244, 239, 226, 0.8)';
    ctx.textAlign = 'left';
    ctx.fillText('WASD move / drive · E enter car · Mouse aim · Click / Space shoot · P pause', 16, VIEW.height - 16);

    // Best money, bottom centre-left above the hint.
    if (best > 0) {
      ctx.fillStyle = 'rgba(244, 239, 226, 0.6)';
      ctx.fillText(`Best haul $${best.toLocaleString('en-US')}`, 16, VIEW.height - 36);
    }

    // Damage vignette.
    if (state.damageFlash > 0 || p.health < 30) {
      const a = Math.max(state.damageFlash * 0.55, p.health < 30 ? 0.18 : 0);
      const grad = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.75);
      grad.addColorStop(0, 'rgba(180, 30, 20, 0)');
      grad.addColorStop(1, `rgba(180, 30, 20, ${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    drawMinimap(state);
    ctx.restore();
  }

  function drawWorld(state) {
    const p = state.player;
    const camX = clamp(p.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    const camY = clamp(p.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    ctx.save();
    ctx.translate(-camX, -camY);
    drawCity(state, camX, camY);
    // Mission marker: pulsing ring and beacon.
    if (state.marker) {
      const pulse = 26 + 8 * Math.sin(state.time * 4);
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(state.marker.x, state.marker.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 210, 62, 0.16)';
      ctx.beginPath();
      ctx.arc(state.marker.x, state.marker.y, pulse + 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.moveTo(state.marker.x, state.marker.y - 34);
      ctx.lineTo(state.marker.x + 10, state.marker.y - 16);
      ctx.lineTo(state.marker.x - 10, state.marker.y - 16);
      ctx.closePath();
      ctx.fill();
    }
    // Pickups.
    for (const pk of state.pickups) {
      const bob = Math.sin(pk.bob) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#2f9e4f';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8f5e9';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', 0, 5);
      } else if (pk.kind === 'health') {
        ctx.fillStyle = '#e8e8e8';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d43a2f';
        ctx.fillRect(-8, -3, 16, 6);
        ctx.fillRect(-3, -8, 6, 16);
      } else {
        ctx.fillStyle = '#d9a441';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a2f10';
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AMMO', 0, 4);
      }
      ctx.restore();
    }
    // Enemies (Kingsmen).
    for (const e of state.enemies) {
      if (e.dead) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(e.x + 2, e.y + 3, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a2e2e';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#e8c39a';
      ctx.beginPath();
      ctx.arc(e.x, e.y, 5, 0, Math.PI * 2);
      ctx.fill();
      // Health pip.
      ctx.fillStyle = '#3a2020';
      ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(e.x - 14, e.y - 22, 28 * clamp(e.hp / 100, 0, 1), 4);
    }
    for (const ped of state.peds) drawPed(ped);
    for (const car of state.cars) drawCar(car, car === state.player.car, state.time);
    for (const cop of state.cops) drawCar(cop, false, state.time);
    drawPlayer(state.player, state.time);
    // Tracers.
    for (const t of state.tracers) {
      ctx.strokeStyle = `rgba(255, 220, 120, ${t.life / t.maxLife})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      const a = clamp(pt.life / pt.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      if (pt.kind === 'smoke') {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (1.6 - a * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (pt.kind === 'flash') {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    return { camX, camY };
  }

  function drawOffscreenArrow(state, cam) {
    if (!state.marker) return;
    const p = state.player;
    const sx = state.marker.x - cam.camX;
    const sy = state.marker.y - cam.camY;
    if (sx > 40 && sx < VIEW.width - 40 && sy > 40 && sy < VIEW.height - 40) return;
    const cx = clamp(sx, 50, VIEW.width - 50);
    const cy = clamp(sy, 90, VIEW.height - 90);
    const a = Math.atan2(sy - (VIEW.height / 2), sx - (VIEW.width / 2));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawTitle(state, best, hasSave) {
    // Slow pan over the city behind the title.
    const t = state.time;
    const panX = 1200 + Math.sin(t * 0.05) * 500;
    const panY = 900 + Math.cos(t * 0.04) * 300;
    const saved = state.player;
    state.player = { x: panX, y: panY, angle: 0, health: 100, money: 0, ammo: 0, wanted: 0, onFoot: true, car: null };
    const cam = drawWorld(state);
    state.player = saved;
    void cam;
    ctx.fillStyle = 'rgba(10, 12, 18, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 92px system-ui, sans-serif';
    ctx.fillText('VIREO CITY', VIEW.width / 2, 240);
    ctx.fillStyle = '#f4efe2';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('An open-world crime story', VIEW.width / 2, 288);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#d8d2c2';
    ctx.fillText('Cass Rook came back to Vireo City for one last job. The city had other plans.', VIEW.width / 2, 330);
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    const lines = hasSave
      ? ['ENTER — Continue your story', 'N — New game', '', 'WASD move / drive · E enter a car · Mouse aim · Click / Space shoot · P pause']
      : ['ENTER — Start', '', 'WASD move / drive · E enter a car · Mouse aim · Click / Space shoot · P pause'];
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 420 + i * 34));
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = '#b9b2a0';
    ctx.fillText('Five missions · Steal cars · Lose the cops · Original city, story and art', VIEW.width / 2, 560);
    if (best > 0) ctx.fillText(`Best haul so far: $${best.toLocaleString('en-US')}`, VIEW.width / 2, 590);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10, 12, 18, 0.6)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f4efe2';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('PAUSED', VIEW.width / 2, 300);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('P — resume · Your progress saves when a mission ends', VIEW.width / 2, 350);
  }

  function drawOver(state, kind) {
    const p = state.player;
    ctx.fillStyle = 'rgba(10, 12, 18, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = kind === 'wasted' ? '#e5534b' : '#4a7fb5';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText(kind === 'wasted' ? 'WASTED' : 'BUSTED', VIEW.width / 2, 300);
    ctx.fillStyle = '#f4efe2';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(
      kind === 'wasted' ? 'Vireo City got the better of Cass Rook.' : 'The Vireo City police took Cass Rook in.',
      VIEW.width / 2,
      350,
    );
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#d8d2c2';
    ctx.fillText(`Money kept: $${p.money.toLocaleString('en-US')} · Missions done: ${state.stats.missionsDone} of 5`, VIEW.width / 2, 390);
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ENTER — Try again from your last save', VIEW.width / 2, 450);
  }

  function draw(state, screen, best, hasSave) {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best, hasSave);
      return;
    }
    const cam = drawWorld(state);
    if (screen === SCREEN_PLAY) {
      drawOffscreenArrow(state, cam);
      drawHud(state, best);
    } else if (screen === SCREEN_PAUSED) {
      drawHud(state, best);
      drawPaused();
    } else if (screen === SCREEN_OVER) {
      drawHud(state, best);
      drawOver(state, state.player.health <= 0 ? 'wasted' : 'busted');
    }
  }

  return { draw };
}
