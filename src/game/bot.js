// 자동 플레이 봇 (테스트·밸런스용). 이동만 담당하고 공격은 자동 조준이 한다.
// window.runSim(opts)으로 화면 없이 한 판을 끝까지 돌려 결과를 받을 수 있다.

import { W, H, MIN, MAXX, MAXY } from "../config.js";
import { dist } from "../util.js";
import { bus } from "../events.js";
import { G } from "./state.js";
import { startRun, updateRun, chooseJob } from "./run.js";

const BOT_MOVE = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"];
const mom = { x: 0, y: 0 };
export const botChoice = { j1: 0, j2: 0, j3: 0 };

export function clearBotKeys() { for (const k of BOT_MOVE) G.keys.delete(k); }

export function botPickJob() {
  const t = G.s.player.tier;
  chooseJob(t === 0 ? botChoice.j1 : t === 1 ? botChoice.j2 : botChoice.j3);
}

export function botControl() {
  const s = G.s, p = s.player, enemies = s.enemies.filter((e) => !e.dead && !e.hidden), gems = s.gems;
  clearBotKeys();
  const chest = s.pickups.find((k) => k.kind === "chest");
  const heart = s.pickups.find((k) => k.kind === "heart");
  if (enemies.length === 0 && gems.length === 0 && !chest && s.ebullets.length === 0) { mom.x = 0; mom.y = 0; return; }
  const emergency = p.hp / p.maxHp <= 0.4;
  const melee = p.weapon === "slash" || p.weapon === "orbit";
  const engage = p.weapon === "orbit" ? (p.orbitRadius || 90) : p.weapon === "slash" ? 70 : p.weapon === "cannon" ? 165 : 150;

  let ex = 0, ey = 0, nearD = Infinity, nearest = null;
  for (const e of enemies) {
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d < nearD) { nearD = d; nearest = e; }
    const eng = e.boss ? engage + e.r + 40 : engage;
    if (d < eng) { const sc = Math.pow((eng - d) / eng, 1.2) * (emergency ? 2.6 : 1) * (e.boss ? 1.8 : 1); ex += dx / d * sc; ey += dy / d * sc; }
    if (e.state === "windup" || (e.boss && e.tele)) { const sc = 1.2; ex += dx / d * sc * (d < 300 ? 1 : 0); ey += dy / d * sc * (d < 300 ? 1 : 0); }
  }
  // 적 탄 피하기
  for (const b of s.ebullets) {
    const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy) || 1;
    if (d > 110) continue;
    const toward = (b.vx * dx + b.vy * dy) > 0;
    if (!toward) continue;
    const sp = Math.hypot(b.vx, b.vy) || 1;
    // 탄 진행 방향의 옆으로 비킨다
    const px = -b.vy / sp, py = b.vx / sp, side = (px * dx + py * dy) >= 0 ? 1 : -1;
    const k = Math.pow((110 - d) / 110, 1.3) * 2.2;
    ex += px * side * k; ey += py * side * k;
  }
  // 서리 폭발 예고 원 밖으로
  for (const tg of s.telegraphs) {
    const dx = p.x - tg.x, dy = p.y - tg.y, d = Math.hypot(dx, dy) || 1;
    if (d < tg.r + 30) { const k = 3; ex += dx / d * k; ey += dy / d * k; }
  }
  let wx = 0, wy = 0; const wR = 95;
  if (p.x < MIN + wR) wx += (MIN + wR - p.x) / wR;
  if (p.x > MAXX - wR) wx -= (p.x - (MAXX - wR)) / wR;
  if (p.y < MIN + wR) wy += (MIN + wR - p.y) / wR;
  if (p.y > MAXY - wR) wy -= (p.y - (MAXY - wR)) / wR;

  let safe;
  if (enemies.length === 0) safe = true;
  else if (melee) safe = false;
  else safe = !emergency && Math.hypot(ex, ey) < 0.25 && nearD > 150;

  let fx, fy;
  const goTo = (tx, ty) => { const dx = tx - p.x, dy = ty - p.y, m = Math.hypot(dx, dy) || 1; return [dx / m + wx + ex * 0.6, dy / m + wy + ey * 0.6]; };
  if (chest && enemies.length === 0) [fx, fy] = goTo(chest.x, chest.y);
  else if (heart && (emergency || safe) && dist(heart.x, heart.y, p.x, p.y) < 300) [fx, fy] = goTo(heart.x, heart.y);
  else if (safe && gems.length) {
    let g = null, gd = Infinity;
    for (const z of gems) { const d = dist(z.x, z.y, p.x, p.y); if (d < gd) { gd = d; g = z; } }
    [fx, fy] = goTo(g.x, g.y);
  } else if (melee && !emergency && nearest && nearD > engage + (nearest.boss ? nearest.r : 0)) {
    [fx, fy] = goTo(nearest.x, nearest.y);
  } else { fx = ex + wx; fy = ey + wy; }

  const mag = Math.hypot(fx, fy);
  if (mag < 0.15) {
    if (mom.x || mom.y) { fx = mom.x; fy = mom.y; }
    else { fx = W / 2 - p.x; fy = H / 2 - p.y; const m = Math.hypot(fx, fy) || 1; fx /= m; fy /= m; }
  } else { mom.x = fx / mag; mom.y = fy / mag; }
  const dz = 0.12;
  if (fx > dz) G.keys.add("ArrowRight"); else if (fx < -dz) G.keys.add("ArrowLeft");
  if (fy > dz) G.keys.add("ArrowDown"); else if (fy < -dz) G.keys.add("ArrowUp");
}

/** 화면 없이 한 판 돌리기. opts: { j1, j2, j3, maxWave, maxSteps, startWave } */
export function runSim(opts = {}) {
  const prevMuted = bus.muted, prevScene = G.scene, prevS = G.s, prevBot = G.bot;
  bus.muted = true;
  G.sim = true;
  botChoice.j1 = opts.j1 || 0; botChoice.j2 = opts.j2 || 0; botChoice.j3 = opts.j3 || 0;
  startRun({ startWave: opts.startWave || 1, upgrades: opts.upgrades || {} });
  G.bot = true;
  const dt = 1 / 60, maxSteps = opts.maxSteps || 60 * 60 * 40, maxWave = opts.maxWave || 30;
  let steps = 0;
  const log = [];
  let lastGw = 0;
  while (steps < maxSteps && G.scene === "play" && G.s.gw <= maxWave) {
    const s = G.s;
    if (s.mode === "jobselect") { botPickJob(); continue; }
    botControl();
    updateRun(dt);
    if (s.gw !== lastGw) { log.push({ gw: s.gw, lvl: s.player.level, hp: Math.round(s.player.hp), t: Math.round(s.time) }); lastGw = s.gw; }
    steps++;
  }
  const s = G.s;
  const out = { gw: s.gw, victory: s.victory, dead: s.mode === "dead" || s.ended === "defeat", job: s.player.job, level: s.player.level, kills: s.kills, time: Math.round(s.time), bossKills: s.bossKills, log };
  clearBotKeys();
  G.sim = false;
  bus.muted = prevMuted; G.scene = prevScene; G.s = prevS; G.bot = prevBot;
  return out;
}
