// 전투 화면 그리기: 바닥 → 바닥 이펙트 → 그림자·아이템 → 캐릭터(아래쪽이 앞) → 탄 → 위 이펙트 → 빛.
// 한 장의 pixelfx 프레임(색+빛 버퍼)에 모두 그린 뒤 합성해서 480×300 캔버스에 올린다.

import { createFrame, clearFrame, painterFor, composite, createFx, hex, mix, scale, TAU, clamp } from "../../vendor/pixelfx/src/core/index.js";
import * as fxTorch from "../../vendor/pixelfx/src/fx/fire/torch.js";
import { LW, LH, PX } from "../config.js";
import { G } from "../game/state.js";
import { branchOf, fxRamp, FIRE_TIER } from "../data/jobs.js";
import { ringHalfWidth, orbHitRadius } from "../game/combat.js";
import { floorFor, torchSpots } from "./tiles.js";
import { wizardSprites, enemySprites, bossSprites, ITEMS } from "./sprites.js";
import { blit, shadow, silhouette } from "./spritekit.js";
import { sys, updateVfx, drawVfx, drawNumbers, installVfx } from "./vfx.js";

const px = (v) => v / PX;
const H = (c) => (typeof c === "number" ? c : hex(c));
const WHITE = hex("#ffffff");
const INK = hex("#170f1c");

export const screen = {
  frame: createFrame(LW, LH),
  lo: null, loCtx: null, img: null,
};

const torches = { stage: -1, list: [] };
let wizCache = { key: "", spr: null };

export function initWorld() {
  const lo = document.createElement("canvas");
  lo.width = LW; lo.height = LH;
  screen.lo = lo;
  screen.loCtx = lo.getContext("2d");
  screen.img = screen.loCtx.createImageData(LW, LH);
  installVfx(spriteOf);
}

const TORCH_PAL = [
  undefined,
  ["#0c1430", "#162c5c", "#1f4f94", "#2f7fcc", "#58b4ec", "#9bdcff", "#d8f4ff", "#ffffff"],
  ["#0f0a18", "#2c1a4a", "#5e3290", "#9a48ec", "#c684ff", "#ff86e6", "#ffd2f6", "#ffffff"],
];

function ensureTorches(stageIndex) {
  if (torches.stage === stageIndex) return;
  torches.stage = stageIndex;
  torches.list = torchSpots().map((s, i) => {
    const o = { x: s.x, y: s.y + 10, seed: 3 + i };
    if (TORCH_PAL[stageIndex]) o.palette = TORCH_PAL[stageIndex];
    return { ...s, fx: createFx(fxTorch, o) };
  });
}

export function playerLook(p) {
  return { color: p.color, tier: p.tier, branch: p.job ? branchOf(p.job) : null, fx: p.fx };
}

function wizard(p) {
  const look = playerLook(p);
  const key = `${look.color}|${look.tier}|${look.branch}|${look.fx.main}|${look.fx.hi}`;
  if (wizCache.key !== key) wizCache = { key, spr: wizardSprites(look) };
  return wizCache.spr;
}

/** 적 객체 → 지금 그림 (처치 파편에도 씀) */
export function spriteOf(e) {
  if (e.boss) { const f = bossSprites(e.id); return f[Math.floor(e.t * 2) % f.length]; }
  const frames = enemySprites(e.type, e.skin);
  const rate = e.type === "bat" ? 8 : e.state === "dash" ? 12 : 3;
  return frames[Math.floor((e.t + e.phase) * rate) % frames.length];
}

// ---------- 매 프레임 ----------

export function updateWorldFx(dt) {
  updateVfx(dt);
  for (const t of torches.list) t.fx.update(dt);
}

export function renderWorld(ctx, opts = {}) {
  const s = G.s;
  const f = screen.frame;
  clearFrame(f);
  const stageIndex = s ? s.stageIndex : (opts.stageIndex || 0);
  const floor = floorFor(stageIndex);
  f.bg = floor;
  ensureTorches(stageIndex);
  const p = painterFor(f);
  // 방 전체에 은은한 빛 (완전히 깜깜하지 않게)
  p.place(0, 0);

  // 횃불
  for (const t of torches.list) { t.fx.draw(f, null); }
  p.reset();
  for (const t of torches.list) p.glow(t.x, t.y + 14, 70, stageIndex === 1 ? H("#58b4ec") : stageIndex === 2 ? H("#9a48ec") : H("#ff8a2a"), 0.22);

  if (s) {
    drawGround(p, s);
    p.reset();
    drawVfx(p, "ground");
    p.reset();
    drawPickups(p, s);
    drawActors(p, s);
    p.reset();
    drawBullets(p, s);
    drawEnemyBullets(p, s);
    drawTelegraphs(p, s);
    p.reset();
    drawVfx(p, "top");
    p.reset();
    drawNumbers(p);
  } else if (opts.menu) {
    opts.menu(p, f);
  }
  composite(f, screen.img.data, floor, 1);
  screen.loCtx.putImageData(screen.img, 0, 0);
  // 화면 흔들림
  let sx = 0, sy = 0;
  if (s && s.shake.t > 0 && (!G.settings || G.settings.shake !== false)) {
    const k = s.shake.t / s.shake.dur;
    sx = Math.round((Math.random() * 2 - 1) * s.shake.amp * k);
    sy = Math.round((Math.random() * 2 - 1) * s.shake.amp * k);
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(screen.lo, sx, sy, LW * PX, LH * PX);
}

// ---------- 바닥: 오라·불바닥·잔상 ----------

function drawGround(p, s) {
  const pl = s.player, t = s.time;
  // 플레이어 발밑 빛
  p.glow(px(pl.x), px(pl.y), 54, H(pl.fx.glow), 0.32);
  // 용암 오라
  if (pl.aura) {
    const cx = px(pl.x), cy = px(pl.y), r = px(pl.aura.r);
    const ramp = fxRamp(pl.fx).map(hex);
    const dark = pl.slashStyle === "obsidian";
    p.disc(cx, cy, r, (d, a) => {
      const n = Math.sin(a * 5 + t * 2.2 + d * 7) * 0.5 + Math.sin(a * 11 - t * 3.1) * 0.25;
      return d > 0.86 ? ramp[dark ? 2 : 3] : n > 0.3 ? ramp[dark ? 1 : 2] : ramp[dark ? 0 : 1];
    }, pl.slashStyle === "eruption" ? 0.42 + Math.sin(t * 6) * 0.08 : 0.34);
    p.ring(cx, cy, r, 1, ramp[4], 0.9);
    p.glowRing(cx, cy, r, 6, H(pl.fx.glow), 0.32);
    // 가장자리 불꽃
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + t * 0.6;
      const fl = Math.sin(t * 9 + i * 2.3) * 0.5 + 0.5;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      for (let k = 0; k < 2 + fl * 3; k++) p.dot(x, y - k, k > 2 ? ramp[5] : ramp[4], 1 - k * 0.15);
    }
  }
  // 불바닥
  for (const h of s.hazards) {
    const cx = px(h.x), cy = px(h.y), r = px(h.r);
    const k = Math.min(1, h.life / 0.5, (h.max - h.life) / 0.15 + 0.2);
    const ramp = fxRamp(h.fx).map(hex);
    p.disc(cx, cy, r, (d) => (d > 0.85 ? ramp[2] : ramp[0]), 0.45 * k);
    p.ring(cx, cy, r, 1, ramp[3], 0.6 * k);
    p.glow(cx, cy, r * 1.2, H(h.fx.glow), 0.28 * k);
    // 바닥에서 솟는 불꽃
    const rate = Math.min(6, r * r * 0.0018 + 1);
    if (Math.random() < rate * 0.16) {
      const a = Math.random() * TAU, rr = r * Math.sqrt(Math.random()) * 0.9;
      sys.ps.spawn(9 /* FIRE */, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0, -12, 0.35 + Math.random() * 0.3, 0, 1.6 + Math.random() * 1.4, 0, Math.random() < 0.3 ? 1 : 0);
    }
  }
  // 홍련 잔상
  for (const ai of s.afterimages) {
    const k = ai.life / ai.max, cx = px(ai.x), cy = px(ai.y), R = px(ai.range);
    const ramp = fxRamp(ai.fx).map(hex), glowC = H(ai.fx.glow);
    const steps = Math.ceil(ai.half * 2 * R * 0.7);
    for (let i = 0; i <= steps; i++) {
      const a = ai.ang - ai.half + (ai.half * 2) * (i / steps), ca = Math.cos(a), sa = Math.sin(a);
      for (let r = R * 0.5; r <= R; r += 1) p.light(cx + ca * r, cy + sa * r, glowC, 0.22 * k * (r / R));
      // 가장자리 불꽃 혀
      if (i % 2 === 0) {
        const fl = Math.sin(s.time * 18 + i * 1.3) * 0.5 + 0.5;
        for (let q = 0; q < 1 + fl * 3 * k; q++) p.dot(cx + ca * (R - q), cy + sa * (R - q), q > 1 ? ramp[3] : ramp[5], k);
      }
    }
  }
}

// ---------- 아이템 ----------

function drawPickups(p, s) {
  const f = p.frame;
  for (const g of s.gems) {
    const spr = g.big ? ITEMS.gemBig() : ITEMS.gem();
    const x = px(g.x) - spr.w / 2, y = px(g.y) - spr.h / 2 + Math.sin(g.t * 5 + g.x) * 1;
    shadow(f, px(g.x), px(g.y) + spr.h / 2, 2, 1, 0.4);
    blit(f, spr, x, y);
    p.glow(px(g.x), px(g.y), 6, g.big ? H("#ffd23c") : H("#4ce8d8"), 0.25);
    if (Math.sin(g.t * 3 + g.x * 0.1) > 0.97) p.light(px(g.x), y + 1, WHITE, 0.8);
  }
  for (const k of s.pickups) {
    if (k.kind === "heart") {
      const spr = ITEMS.heart(), pulse = 1 + Math.sin(k.t * 6) * 0.5;
      const blink = k.t > 11 && Math.sin(k.t * 20) > 0;
      if (blink) continue;
      shadow(f, px(k.x), px(k.y) + 4, 3, 1, 0.4);
      blit(f, spr, px(k.x) - spr.w / 2, px(k.y) - spr.h / 2 - pulse);
      p.glow(px(k.x), px(k.y), 10, H("#ff4a5a"), 0.3);
    } else if (k.kind === "chest") {
      const spr = ITEMS.chest(), drop = Math.max(0, 1 - k.t * 3) * 30;
      shadow(f, px(k.x), px(k.y) + 6, 8, 2, 0.5);
      blit(f, spr, px(k.x) - spr.w / 2, px(k.y) - spr.h / 2 - drop);
      p.glow(px(k.x), px(k.y), 30, H("#ffd23c"), 0.4 + Math.sin(k.t * 5) * 0.1);
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.3, L = 16 + Math.sin(k.t * 4 + i) * 4;
        p.glowLine(px(k.x), px(k.y) - 4, px(k.x) + Math.cos(a) * L, px(k.y) - 4 + Math.sin(a) * L, 2, H("#ffe066"), 0.15);
      }
    }
  }
}

// ---------- 캐릭터 ----------

function drawActors(p, s) {
  const f = p.frame;
  const list = [];
  for (const e of s.enemies) if (!e.dead) list.push(e);
  list.push(s.player);
  list.sort((a, b) => a.y - b.y);
  for (const a of list) {
    if (a === s.player) drawPlayer(p, s);
    else drawEnemy(p, s, a);
  }
  // 불씨 궤도는 캐릭터 위에
  drawOrbits(p, s);
}

function drawPlayer(p, s) {
  const pl = s.player, f = p.frame;
  if (s.mode === "dead" && s.deadTimer < 1.2) return;
  const spr = wizard(pl);
  const t = s.time;
  const frame = pl.moving ? spr.walk[Math.floor(t * 8) % 4] : spr.idle[Math.floor(t * 1.6) % 2];
  const cx = px(pl.x), cy = px(pl.y);
  const x = Math.round(cx - frame.w / 2), y = Math.round(cy - frame.h + 7);
  shadow(f, cx, cy + 7, 6, 2, 0.45);
  const blink = pl.invuln > 0 && Math.floor(pl.invuln * 20) % 2 === 0;
  const flip = pl.facing < 0;
  if (blink) blit(f, frame, x, y, { flip, tint: hex("#ffe0e0") });
  else blit(f, frame, x, y, { flip });
  // 지팡이 보석 빛 (공격 직후 더 밝게)
  const gx = flip ? x + frame.w - 1 - 13 : x + 13, gy = y + 12;
  const cast = pl.castT > 0 ? pl.castT / 0.18 : 0;
  p.glow(gx + 0.5, gy + 0.5, 6 + cast * 6, H(pl.fx.glow), 0.45 + cast * 0.5);
  // 3차: 모자 끝 불꽃
  if (pl.tier >= 3 && Math.random() < 0.35) {
    const hx = flip ? x + frame.w - 7 : x + 6;
    sys.ps.spawn(9, hx + Math.random() * 2, y + 1, (Math.random() - 0.5) * 6, -14, 0.3, 0, 1.2);
  }
}

function drawEnemy(p, s, e) {
  const f = p.frame;
  const spr = spriteOf(e);
  const cx = px(e.x), cy = px(e.y);
  const flip = (e.face || 1) < 0;
  let x = Math.round(cx - spr.w / 2), y = Math.round(cy - spr.h / 2);
  if (e.boss) y = Math.round(cy - spr.h + e.r / PX + 2);
  // 돌격 준비 떨림
  if (e.state === "windup") x += Math.round(Math.sin(e.t * 60));
  if (e.hidden) return;
  const spawning = e.spawnT > 0;
  shadow(f, cx, cy + (e.boss ? e.r / PX : spr.h / 2) - 1, Math.max(4, spr.w * 0.36), Math.max(1.5, spr.w * 0.1), 0.45);
  const a = spawning ? clamp(1 - e.spawnT / 0.35, 0.1, 1) : (e.alpha != null ? e.alpha : 1);
  // 보스: 어두운 바닥에서도 보이게 은은한 테두리
  if (e.boss) {
    const rim = hex(e.id === "frostWitch" ? "#4a8ad8" : e.id === "voidLord" ? "#7a3ab0" : "#8a5a2a");
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) blit(f, spr, x + dx, y + dy, { flip, tint: rim, a });
  }
  // 정예: 붉은 테두리
  if (e.elite) {
    const c = hex(Math.sin(e.t * 8) > 0 ? "#ff3a5a" : "#ffb04a");
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) blit(f, spr, x + dx, y + dy, { flip, tint: c, a });
    p.glow(cx, cy, spr.w, hex("#ff3a5a"), 0.25);
  }
  if (e.hitFlash > 0 && !e.boss) blit(f, spr, x, y, { flip, tint: WHITE, a });
  else blit(f, spr, x, y, { flip, a });
  if (e.boss && e.hitFlash > 0) p.glow(cx, y + spr.h * 0.45, spr.w * 0.6, WHITE, 0.35);
  // 눈 빛 (어둠 속에서 보이게)
  if (e.type === "bat" || e.type === "brute" || e.boss) p.glow(cx, y + (e.boss ? 12 : 5), e.boss ? 14 : 5, e.skin === 1 ? hex("#5ad8ff") : e.skin === 2 ? hex("#ff5ad8") : hex("#ff4a2a"), 0.35);
  if (e.type === "caster") p.glow(cx, cy, 10, e.skin === 2 ? hex("#ff3ad0") : hex("#58b4ec"), e.state === "aim" ? 0.8 : 0.35);
  // 화상
  if (e.burnTime > 0) {
    const fx = e.burnFx || s.player.fx;
    const fl = Math.floor(e.t * 12) % 3;
    const hx = cx, hy = y - 2;
    p.px(hx, hy - fl, H(fx.hi)); p.px(hx, hy + 1, H(fx.main)); p.px(hx - 1, hy + 1, H(fx.deep)); p.px(hx + 1, hy + 1 - (fl % 2), H(fx.main));
    p.glow(hx, hy, 6, H(fx.glow), 0.35);
    if (Math.random() < 0.08) sys.ps.spawn(9, cx + (Math.random() - 0.5) * spr.w * 0.6, cy, 0, -10, 0.3, 0, 1.3);
  }
  // 돌격 예고선
  if (e.state === "windup") {
    const L = 140, ca = Math.cos(e.dashAng), sa = Math.sin(e.dashAng);
    for (let d = 6; d < L; d += 3) p.dot(cx + ca * d, cy + sa * d, hex("#ff3a3a"), 0.5 * (1 - d / L) * (0.6 + 0.4 * Math.sin(e.t * 30)));
  }
  // 보스 예고
  if (e.boss && e.tele) {
    if (e.tele.kind === "line") {
      const ca = Math.cos(e.tele.ang), sa = Math.sin(e.tele.ang), L = px(e.tele.len);
      for (let d = 10; d < L; d += 2) p.dot(cx + ca * d, cy + sa * d, hex("#ff2a2a"), 0.55 * (1 - d / L) * (0.7 + 0.3 * Math.sin(e.t * 25)));
      p.glowLine(cx, cy, cx + ca * L * 0.5, cy + sa * L * 0.5, 6, hex("#ff2a2a"), 0.2);
    }
  }
}

function drawOrbits(p, s) {
  const pl = s.player;
  if (pl.weapon !== "orbit") return;
  const fx = pl.fx, ramp = fxRamp(fx).map(hex), t = s.time;
  const cx = px(pl.x), cy = px(pl.y);
  const style = pl.orbStyle;
  if (["ring", "solar", "meteorRing", "dualRing"].includes(style)) {
    const hw = px(ringHalfWidth(style));
    const rings = style === "dualRing" ? [px(pl.orbitRadius), px(pl.orbitRadius * 0.68)] : [px(pl.orbitRadius)];
    for (const R0 of rings) {
      // 띠 = 피해 범위: 빛으로 채우고, 가운데 선과 일렁이는 불꽃 점만 색으로
      const glowC = H(fx.glow);
      const nA = Math.ceil(R0 * TAU * 0.9);
      for (let i = 0; i < nA; i++) {
        const a = (i / nA) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        const flick = Math.sin(a * 9 - t * 7) * 0.5 + 0.5;
        for (let o = -hw; o <= hw; o += 1) {
          const e = Math.abs(o) / hw;
          p.light(cx + ca * (R0 + o), cy + sa * (R0 + o), glowC, (1 - e) * (0.18 + flick * 0.12));
        }
        p.dot(cx + ca * R0, cy + sa * R0, flick > 0.6 ? ramp[5] : ramp[4], 0.9);
        if ((i + Math.floor(t * 20)) % 5 === 0) p.dot(cx + ca * (R0 + (flick - 0.5) * hw * 1.2), cy + sa * (R0 + (flick - 0.5) * hw * 1.2), ramp[3], 0.8);
        p.dot(cx + ca * (R0 - hw), cy + sa * (R0 - hw), ramp[2], 0.35);
        p.dot(cx + ca * (R0 + hw), cy + sa * (R0 + hw), ramp[2], 0.35);
      }
      // 바깥으로 솟는 불꽃
      const n = Math.round(R0 * 0.5);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + t * 0.8;
        const fl = Math.sin(t * 11 + i * 1.7) * 0.5 + 0.5;
        const x = cx + Math.cos(a) * (R0 + hw), y = cy + Math.sin(a) * (R0 + hw);
        for (let k = 0; k < 1 + fl * 3; k++) p.dot(x, y - k, k >= 2 ? ramp[6] : ramp[5], 1 - k * 0.2);
      }
    }
  }
  // 불씨/정령 하나하나
  const hitR = px(orbHitRadius(style));
  s.orbits.forEach((o, i) => {
    const x = px(o.x), y = px(o.y);
    const fl = Math.sin(t * 14 + i * 2) * 0.5 + 0.5;
    if (style === "spirit" || style === "fireSpirit" || style === "clone") {
      // 정령: 꼬리 달린 불꽃 덩어리
      const tailA = o.a + Math.PI / 2 + Math.PI;
      for (let k = 6; k > 0; k--) p.circle(x + Math.cos(tailA) * k * 1.3, y + Math.sin(tailA) * k * 1.3, (6 - k) * 0.4 + 0.6, k > 3 ? ramp[2] : ramp[3]);
      p.circle(x, y, hitR * 0.7, ramp[3]); p.circle(x - 0.5, y - 0.5, hitR * 0.45, ramp[5]);
      p.px(x - 1, y - 1, INK); p.px(x + 1, y - 1, INK);
      if (style === "clone") p.ring(x, y, hitR + 1 + fl * 2, 1, ramp[4], 0.5);
      p.glow(x, y, hitR * 2.5, H(fx.glow), 0.4);
    } else if (style === "phoenix") {
      const wing = Math.sin(t * 14 + i) * 2;
      p.tri(x, y, x - 6, y - 3 - wing, x - 3, y + 1, ramp[4]);
      p.tri(x, y, x + 6, y - 3 - wing, x + 3, y + 1, ramp[4]);
      p.circle(x, y, 2.2, ramp[5]); p.px(x, y - 3, ramp[6]);
      p.glow(x, y, 14, H(fx.glow), 0.5);
    } else if (["ring", "solar", "meteorRing", "dualRing"].includes(style)) {
      p.circle(x, y, 2 + fl, ramp[6]);
      p.glow(x, y, 8, H(fx.glow), 0.4);
    } else {
      // 불씨 (ember / blaze / greatBurn / plague / ash)
      const r = hitR * (style === "ember" ? 0.75 : 0.85);
      p.circle(x, y + 0.5, r, ramp[2]);
      p.circle(x - 0.3, y - 0.3, r * 0.75, ramp[3]);
      p.circle(x - 0.5, y - r * 0.3, r * 0.45, ramp[5]);
      for (let k = 0; k < 2 + fl * 2; k++) p.dot(x + Math.sin(t * 9 + i) * 0.8, y - r - k, k > 1 ? ramp[6] : ramp[4], 1 - k * 0.2);
      p.glow(x, y, r * 3, H(fx.glow), 0.45);
      if (Math.random() < 0.12) sys.ps.spawn(7 /* EMBER */, x, y, (Math.random() - 0.5) * 20, -10, 0.5, H(fx.spark), 1);
    }
  });
}

// ---------- 탄 ----------

function drawBullets(p, s) {
  for (const b of s.bullets) {
    const fx = b.fx, ramp = fxRamp(fx).map(hex);
    const x = px(b.x), y = px(b.y), r = Math.max(1.5, px(b.r));
    const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
    const shape = b.shape;
    if (shape === "lance" || shape === "sniper" || shape === "thermal" || shape === "ray") {
      const L = shape === "thermal" ? 18 : shape === "ray" ? 22 : shape === "sniper" ? 12 : 10;
      const w = shape === "thermal" ? 0.6 : shape === "ray" ? 1 : shape === "sniper" ? 2 : 1.5;
      p.beam(x - ux * L, y - uy * L, x, y, w + 1.5, ramp[3]);
      p.beam(x - ux * L * 0.7, y - uy * L * 0.7, x, y, w, ramp[5]);
      p.circle(x, y, w + 0.5, WHITE);
      p.glowLine(x - ux * L, y - uy * L, x, y, 6, H(fx.glow), 0.45);
      continue;
    }
    if (shape === "bomb" || shape === "infernoBomb" || shape === "mine" || shape === "chainBomb") {
      const pulse = shape === "infernoBomb" ? 1 + Math.sin(s.time * 14) * 0.6 : 0;
      p.circle(x, y, r + pulse, hex("#2a1418"));
      p.circle(x - 0.5, y - 0.5, (r + pulse) * 0.55, ramp[2]);
      if (shape !== "mine" || Math.sin(s.time * 20) > 0) p.circle(x, y, 1.2, ramp[5]);
      p.px(x + r * 0.7, y - r - 1, ramp[6]); p.px(x + r * 0.7 + 1, y - r - 2, ramp[4]);
      if (shape === "chainBomb") for (let k = 0; k < 3; k++) { const a = s.time * 8 + k * TAU / 3; p.px(x + Math.cos(a) * (r + 3), y + Math.sin(a) * (r + 3), ramp[5]); }
      p.glow(x, y, r * 2.5, H(fx.glow), 0.4);
      continue;
    }
    if (shape === "spiritBolt" || shape === "cloneBolt" || shape === "phoenixBolt" || shape === "meteor") {
      const L = shape === "phoenixBolt" ? 10 : 7;
      for (let k = L; k > 0; k--) p.dot(x - ux * k, y - uy * k, k > L * 0.5 ? ramp[2] : ramp[4], 1 - k / (L + 2));
      if (shape === "phoenixBolt") {
        const nx = -uy, ny = ux, wing = Math.sin(s.time * 20) * 2;
        p.tri(x, y, x - ux * 4 + nx * (5 + wing), y - uy * 4 + ny * (5 + wing), x - ux * 2, y - uy * 2, ramp[4]);
        p.tri(x, y, x - ux * 4 - nx * (5 + wing), y - uy * 4 - ny * (5 + wing), x - ux * 2, y - uy * 2, ramp[4]);
      }
      if (shape === "meteor") p.circle(x, y, r, hex("#4a3028"));
      p.circle(x, y, r * 0.7, ramp[5]);
      p.glow(x, y, r * 3, H(fx.glow), 0.45);
      continue;
    }
    // 화염구 (기본·포격)
    const big = !!b.big;
    const L = big ? Math.min(14, r * 2.4) : 7;
    for (let k = L; k > 0; k -= 0.8) {
      const u = k / L;
      p.circle(x - ux * k, y - uy * k + Math.sin(k + s.time * 30) * 0.4, r * (1 - u * 0.75), u > 0.6 ? ramp[2] : ramp[3], 1 - u * 0.6);
    }
    if (shape === "hellShell") {
      p.circle(x, y, r + 1.5, ramp[3]);
      p.circle(x, y, r * 0.8, hex("#1a0608"));
      p.ring(x, y, r + 1.5, 1, ramp[5], 0.8);
    } else {
      p.circle(x, y, r, ramp[3]);
      p.circle(x - r * 0.15, y - r * 0.15, r * 0.7, ramp[4]);
      p.circle(x - r * 0.25, y - r * 0.25, r * 0.38, ramp[6]);
    }
    p.glow(x, y, r * 3 + 3, H(fx.glow), big ? 0.55 : 0.4);
    if (big && Math.random() < 0.4) sys.ps.spawn(9, x - ux * r, y - uy * r, -ux * 10, -uy * 10 - 8, 0.3, 0, r * 0.4 + 0.8);
  }
}

const EB = {
  shard: { c1: "#9bdcff", c2: "#ffffff", glow: "#58b4ec" },
  bone: { c1: "#e4dcc8", c2: "#ffffff", glow: "#b8ad96" },
  orb: { c1: "#5e3290", c2: "#ff86e6", glow: "#ff3ad0" },
  void: { c1: "#9a48ec", c2: "#ffd2f6", glow: "#c684ff" },
};

function drawEnemyBullets(p, s) {
  for (const b of s.ebullets) {
    const x = px(b.x), y = px(b.y), r = px(b.r);
    const sp = Math.hypot(b.vx, b.vy) || 1, ux = b.vx / sp, uy = b.vy / sp;
    const C = EB[b.kind] || EB.shard;
    if (b.kind === "shard") {
      p.beam(x - ux * 5, y - uy * 5, x, y, 2, hex(C.c1));
      p.line(x - ux * 4, y - uy * 4, x, y, hex(C.c2));
    } else if (b.kind === "bone") {
      const a = b.t * 14, ca = Math.cos(a) * 3, sa = Math.sin(a) * 3;
      p.line(x - ca, y - sa, x + ca, y + sa, hex(C.c1));
      p.px(x - ca, y - sa, hex(C.c2)); p.px(x + ca, y + sa, hex(C.c2));
    } else if (b.kind === "orb") {
      p.circle(x, y, r + 1, hex("#120818"));
      p.ring(x, y, r + 1, 1, hex(C.c2), 0.9);
      p.circle(x, y, r * 0.4, hex(C.c2));
    } else {
      p.circle(x, y, r, hex(C.c1));
      p.circle(x, y, r * 0.5, hex(C.c2));
    }
    p.glow(x, y, r * 3 + 3, hex(C.glow), 0.55);
  }
}

function drawTelegraphs(p, s) {
  for (const tg of s.telegraphs) {
    if (tg.kind !== "nova") continue;
    const x = px(tg.x), y = px(tg.y), r = px(tg.r), u = tg.t / tg.max;
    p.disc(x, y, r, hex("#2f7fcc"), 0.12 + u * 0.22);
    p.ring(x, y, r, 1, hex("#d8f4ff"), 0.6 + 0.4 * Math.sin(tg.t * 20));
    p.ring(x, y, r * u, 1, hex("#9bdcff"), 0.8);
    p.glowRing(x, y, r, 4, hex("#58b4ec"), 0.3);
  }
}
