// 이펙트: 게임 사건(emit)을 받아 픽셀 이펙트를 띄운다.
// - 자주 나오는 것(베기·폭발·불티·처치 파편)은 pixelfx 도구(Particles·Lights·Painter)로 직접 그린 가벼운 이펙트
// - 드문 장면(레벨업·전직·보스·상자·서리 폭발·횃불)은 pixelfx 라이브러리 이펙트를 그대로 쓴다
// 모든 좌표는 픽셀(월드/2). 동시에 띄우는 라이브러리 이펙트 수는 종류별로 제한한다(성능).

import {
  createFx, Particles, Lights, P, PF, hex, mix, scale, sparkle, TAU, clamp,
} from "../../vendor/pixelfx/src/core/index.js";
import * as fxLevelUp from "../../vendor/pixelfx/src/fx/ui/level-up.js";
import * as fxFireRing from "../../vendor/pixelfx/src/fx/fire/fire-ring.js";
import * as fxChestOpen from "../../vendor/pixelfx/src/fx/pickups/chest-open.js";
import * as fxFrostNova from "../../vendor/pixelfx/src/fx/ice/frost-nova.js";
import * as fxPoof from "../../vendor/pixelfx/src/fx/spawn/poof.js";
import * as fxHitSpark from "../../vendor/pixelfx/src/fx/impacts/hit-spark.js";
import * as fxSmallExplosion from "../../vendor/pixelfx/src/fx/explosions/small-explosion.js";
import * as fxSummonRise from "../../vendor/pixelfx/src/fx/spawn/summon-rise.js";
import * as fxShatter from "../../vendor/pixelfx/src/fx/spawn/shatter-death.js";
import * as fxSoulRise from "../../vendor/pixelfx/src/fx/spawn/soul-rise.js";
import * as fxSpawnPortal from "../../vendor/pixelfx/src/fx/spawn/spawn-portal.js";
import { on } from "../events.js";
import { PX } from "../config.js";
import { G } from "../game/state.js";
import { fxRamp } from "../data/jobs.js";
import { ringHalfWidth } from "../game/combat.js";

const WHITE = hex("#ffffff");
const px = (v) => v / PX;
const H = (c) => (typeof c === "number" ? c : hex(c));
const R = () => Math.random();
const rr = (a, b) => a + Math.random() * (b - a);

// ---------- 공용 시스템 ----------
export const sys = {
  ps: new Particles({ seed: 7, sparks: ["#fff3a6", "#ffc23d", "#ff7b2e", "#c42a12"] }),   // 불티·불꽃·연기
  lights: new Lights(),
  live: [],          // 직접 그리는 이펙트 { update(dt), draw(p, layer), done() }
  lib: [],           // pixelfx 라이브러리 이펙트 { fx, layer, kind }
  debris: [],        // 처치 파편 픽셀
  numbers: [],       // 피해 숫자
  arcs: [],          // 화상 전염 번개
  time: 0,
};

const LIB_CAP = { poof: 6, hitSpark: 8, shatter: 3, soul: 3, explosion: 4, portal: 3 };
function addLib(kind, mod, opts, layer = "top", cut = null) {
  const n = sys.lib.reduce((a, l) => a + (l.kind === kind ? 1 : 0), 0);
  if (LIB_CAP[kind] && n >= LIB_CAP[kind]) return null;
  for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k];   // 빈 옵션이 기본값을 지우지 않게
  const inst = { fx: createFx(mod, opts), layer, kind, cut, t: 0 };
  sys.lib.push(inst);
  return inst;
}

export function resetVfx() {
  sys.ps.list.length = 0;
  sys.lights.list.length = 0;
  sys.live.length = 0;
  sys.lib.length = 0;
  sys.debris.length = 0;
  sys.numbers.length = 0;
  sys.arcs.length = 0;
}

export function updateVfx(dt) {
  sys.time += dt;
  // 파티클은 120Hz로 쪼개서 (프레임률과 무관한 움직임)
  const n = Math.max(1, Math.ceil(dt * 120 - 1e-9));
  for (let i = 0; i < n; i++) sys.ps.update(dt / n);
  if (sys.ps.list.length > 900) sys.ps.list.splice(0, sys.ps.list.length - 900);
  sys.lights.update(dt);
  for (const e of sys.live) e.update(dt);
  sys.live = sys.live.filter((e) => !e.done());
  for (const l of sys.lib) {
    l.t += dt;
    l.fx.update(dt);
    if (l.cut != null && l.t >= l.cut) l.fx.stop();
  }
  sys.lib = sys.lib.filter((l) => !l.fx.done());
  for (const d of sys.debris) {
    d.x += d.vx * dt; d.y += d.vy * dt;
    d.vx *= Math.pow(0.04, dt); d.vy = d.vy * Math.pow(0.04, dt) + 140 * dt;
    d.life -= dt;
  }
  sys.debris = sys.debris.filter((d) => d.life > 0);
  if (sys.debris.length > 1400) sys.debris.splice(0, sys.debris.length - 1400);
  for (const nm of sys.numbers) { nm.t += dt; nm.y -= (18 - nm.t * 20) * dt; }
  sys.numbers = sys.numbers.filter((nm) => nm.t < 0.8);
  for (const a of sys.arcs) a.life -= dt;
  sys.arcs = sys.arcs.filter((a) => a.life > 0);
}

/** layer: "ground"(스프라이트 아래) | "top"(위) */
export function drawVfx(p, layer) {
  p.place(0, 0);
  p.fade = 1; p.lightK = 1;
  for (const e of sys.live) if ((e.layer || "top") === layer) { p.place(0, 0); p.fade = 1; e.draw(p); }
  if (layer === "ground") {
    p.place(0, 0); p.fade = 1;
    sys.ps.draw(p, "back");
  } else {
    p.place(0, 0); p.fade = 1;
    sys.ps.draw(p, "front");
    sys.lights.draw(p);
    drawDebris(p);
    drawArcs(p);
  }
  for (const l of sys.lib) {
    if (l.layer !== layer) continue;
    l.fx.draw(p.frame, layer === "ground" ? null : null);
  }
  p.place(0, 0); p.fade = 1; p.lightK = 1;
}

export function drawNumbers(p) {
  if (!G.settings || G.settings.damageNumbers === false) return;
  p.place(0, 0); p.fade = 1;
  for (const nm of sys.numbers) {
    const a = nm.t < 0.55 ? 1 : 1 - (nm.t - 0.55) / 0.25;
    p.text(nm.text, nm.x, nm.y, nm.color, { font: "mini", align: "center", outline: hex("#170f1c"), a, scale: nm.big ? 2 : 1 });
  }
}

function drawDebris(p) {
  for (const d of sys.debris) {
    const a = d.life < 0.25 ? d.life / 0.25 : 1;
    p.dot(d.x, d.y, d.c, a);
  }
}

function drawArcs(p) {
  for (const a of sys.arcs) {
    const k = a.life / a.max;
    const pts = [];
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const j = i === 0 || i === n ? 0 : (Math.sin(a.seed + i * 3.1 + sys.time * 40) * 3);
      const nx = -(a.y2 - a.y1), ny = a.x2 - a.x1, L = Math.hypot(nx, ny) || 1;
      pts.push([a.x1 + (a.x2 - a.x1) * u + nx / L * j, a.y1 + (a.y2 - a.y1) * u + ny / L * j]);
    }
    p.polyline(pts, k > 0.5 ? a.hi : a.main, Math.min(1, k * 2));
    p.glowLine(a.x1, a.y1, a.x2, a.y2, 4, a.main, 0.35 * k);
  }
}

// ---------- 직접 그리는 이펙트 ----------

/** 화염 베기: 부채꼴(피해 범위) + 바깥 초승달 + 불티 */
function slashFx(d) {
  const fx = d.fx, ramp = fxRamp(fx).map(hex);
  const cx = px(d.x), cy = px(d.y), Rr = px(d.range);
  const style = d.style || "single";
  const thrust = ["thrust", "flameBreak", "berserk", "volcano"].includes(style);
  const heavy = ["heavy", "magmaShield", "obsidian", "eruption"].includes(style);
  const flurry = ["flurry", "infernoFlurry"].includes(style);
  const crimson = style === "crimsonFlurry";
  const life = crimson ? 0.36 : heavy ? 0.32 : thrust ? 0.24 : flurry ? 0.18 : 0.22;
  const dir = (slashFx.flip = !slashFx.flip) ? 1 : -1;
  const thick = heavy ? 0.42 : crimson ? 0.36 : flurry ? 0.2 : 0.28;
  const angles = d.twin ? [d.ang, d.ang + Math.PI] : [d.ang];
  let t = 0;
  // 불티
  for (const a0 of angles) {
    const nSp = heavy ? 10 : thrust ? 8 : 6 + d.tier * 2;
    for (let i = 0; i < nSp; i++) {
      const a = a0 + rr(-d.half, d.half) * (thrust ? 0.6 : 1);
      const r = Rr * rr(0.7, 1.0), sp = rr(60, 150);
      sys.ps.spawn(P.MOTE, cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a) * sp, Math.sin(a) * sp, rr(0.15, 0.35), i % 2 ? fx.spark : fx.hi, rr(0.7, 1.2));
    }
    if (heavy) for (let i = 0; i < 5; i++) {
      const a = a0 + rr(-d.half, d.half), r = Rr * rr(0.5, 0.95);
      sys.ps.spawn(P.FIRE, cx + Math.cos(a) * r, cy + Math.sin(a) * r, rr(-10, 10), rr(-20, -5), rr(0.3, 0.6), 0, rr(1.5, 2.6), 0, PF.SMOKES);
    }
    if (crimson) for (let i = 0; i < 8; i++) {
      const a = a0 + rr(-d.half, d.half), r = Rr * rr(0.4, 1.05);
      sys.ps.spawn(P.FLAKE, cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a) * 30, Math.sin(a) * 30, rr(0.5, 0.9), i % 2 ? fx.main : fx.hi, 1.6);
    }
  }
  sys.lights.add(cx + Math.cos(d.ang) * Rr * 0.6, cy + Math.sin(d.ang) * Rr * 0.6, Rr * 1.1, fx.glow, heavy ? 0.6 : 0.4, life * 1.4);
  return {
    layer: "top",
    update(dt) { t += dt; },
    done() { return t >= life; },
    draw(p) {
      const u = t / life;
      const sweep = Math.min(1, u / (thrust ? 0.25 : 0.4));
      const fade = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45;
      for (const a0 of angles) {
        if (thrust) {
          // 찌르기: 좁고 긴 화염창
          const len = Rr * (0.4 + 0.6 * sweep);
          const w = Math.max(2, Rr * Math.tan(d.half) * 0.55);
          const ca = Math.cos(a0), sa = Math.sin(a0), nx = -sa, ny = ca;
          for (let s = 0; s <= len; s += 0.7) {
            const v = s / Rr, ww = w * (1 - v * 0.75) * (0.6 + 0.4 * fade);
            for (let o = -ww; o <= ww; o += 0.7) {
              const e = Math.abs(o) / (ww || 1);
              const c = e > 0.75 ? ramp[2] : e > 0.4 ? ramp[3] : v > 0.8 ? WHITE : ramp[5];
              p.dot(cx + ca * s + nx * o, cy + sa * s + ny * o, c, fade * (e > 0.75 ? 0.8 : 1));
            }
          }
          p.glowLine(cx, cy, cx + ca * len, cy + sa * len, w + 4, H(fx.glow), 0.4 * fade);
          continue;
        }
        // 픽셀마다 극좌표로 판정해 빈틈 없는 초승달 + 부채꼴 빛(피해 범위)
        const span = d.half * 2, aStart = a0 - d.half * dir;
        const passes = flurry ? 3 : 1;
        const glowC = H(fx.glow);
        const wedgeK = u < 0.6 ? 0.14 * (1 - u / 0.6) : 0;
        p.shade(cx - Rr - 1, cy - Rr - 1, cx + Rr + 1, cy + Rr + 1, (x, y, out) => {
          const dx = x - cx, dy = y - cy, dd = Math.hypot(dx, dy);
          if (dd > Rr + 0.5 || dd < 3) return;
          let v = (Math.atan2(dy, dx) - aStart) * dir;
          v = ((v % TAU) + TAU) % TAU;
          if (v > span) return;
          const vu = v / span;                                  // 0 = 휘두르기 시작, 1 = 끝
          let col = 0, k = 0;
          for (let q = 0; q < passes; q++) {
            const sw = clamp((u - q * 0.18) / 0.4, 0, 1);
            if (sw <= 0 || vu > sw) continue;
            const rad = Rr * (1 - q * 0.12);
            const head = 1 - (sw - vu);
            const th = rad * thick * Math.max(0.15, Math.pow(head, 1.5)) * (0.5 + 0.5 * fade);
            if (dd <= rad && dd >= rad - th) {
              const e = (rad - dd) / (th || 1);
              col = e < 0.18 ? (head > 0.85 ? WHITE : ramp[5]) : e < 0.45 ? ramp[4] : e < 0.75 ? ramp[3] : ramp[2];
              out.a = fade * (e > 0.8 ? 0.7 : 1);
              k = 0.22 * fade * head;
              break;
            }
          }
          if (!col && wedgeK > 0 && vu <= sweep) { out.l = glowC; out.k = wedgeK * (dd / Rr); return; }
          if (col) { out.l = glowC; out.k = k; return col; }
        });
      }
    },
  };
}

/** 폭발: 섬광 → 화염구 → 충격파 고리(피해 반경) + 불꽃·연기·불티 */
function burstFx(d) {
  const fx = d.fx, ramp = fxRamp(fx).map(hex);
  const cx = px(d.x), cy = px(d.y), Rr = px(d.r);
  const style = d.style;
  const mini = style === "mini";
  const tier = d.tier || 1;
  const life = mini ? 0.32 : 0.5;
  const dir = d.ang;   // 있으면 앞쪽으로 쏠린 폭발
  const nFire = Math.min(26, Math.round((mini ? 4 : 7) + Rr * 0.18 + tier * 2));
  for (let i = 0; i < nFire; i++) {
    const a = dir != null ? dir + rr(-0.9, 0.9) : rr(0, TAU);
    const r = Rr * Math.sqrt(R()) * 0.75, sp = rr(10, 40) + Rr * 0.6;
    sys.ps.spawn(P.FIRE, cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4, Math.cos(a) * sp, Math.sin(a) * sp - 10, rr(0.35, 0.7), 0, rr(2, 3.6) + Rr * 0.03, 0, R() < 0.5 ? PF.SMOKES | (Rr > 40 ? PF.BIG : 0) : 0);
  }
  const nSp = Math.min(30, Math.round((mini ? 6 : 10) + tier * 3 + Rr * 0.1));
  for (let i = 0; i < nSp; i++) {
    const a = dir != null ? dir + rr(-1.1, 1.1) : rr(0, TAU), sp = rr(80, 180) + Rr * 1.2;
    sys.ps.spawn(P.MOTE, cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, rr(0.2, 0.45), i % 3 ? fx.spark : fx.hi, rr(0.8, 1.3));
  }
  if (style === "smoke" || Rr > 50) for (let i = 0; i < 6; i++) {
    const a = rr(0, TAU), r = Rr * rr(0.3, 0.85);
    sys.ps.spawn(P.SMOKE, cx + Math.cos(a) * r, cy + Math.sin(a) * r, Math.cos(a) * 14, -10, rr(0.7, 1.2), 0, Math.min(9, Rr * 0.07 + 3), rr(0, 0.15));
  }
  sys.lights.add(cx, cy, Rr * 2.2 + 10, fx.glow, style === "flash" ? 1.0 : 0.75, life * 1.5);
  let t = 0;
  return {
    layer: "top",
    update(dt) { t += dt; },
    done() { return t >= life; },
    draw(p) {
      const u = t / life;
      // 섬광
      if (u < 0.12) {
        p.circle(cx, cy, Rr * (0.3 + u * 2.5), style === "flash" ? WHITE : ramp[5]);
        if (style === "flash") p.glow(cx, cy, Rr * 1.6, WHITE, 0.9 * (1 - u / 0.12));
      }
      // 화염구 (안쪽 밝게, 가장자리로 갈수록 짙게)
      const bloom = Rr * (0.35 + 0.65 * Math.min(1, u / 0.35));
      const ka = u < 0.3 ? 0.9 : Math.max(0, 0.9 - (u - 0.3) * 1.8);
      if (ka > 0) {
        p.disc(cx, cy, bloom, (dd) => (dd < 0.35 ? ramp[5] : dd < 0.65 ? ramp[4] : dd < 0.85 ? ramp[3] : ramp[2]), ka * 0.85);
      }
      // 충격파 고리 = 피해 반경
      const ring = Rr * (0.6 + 0.4 * Math.min(1, u / 0.3));
      const rk = u < 0.3 ? 1 : Math.max(0, 1 - (u - 0.3) / 0.7);
      if (rk > 0) {
        p.ring(cx, cy, ring, u < 0.4 ? 2 : 1, u < 0.2 ? ramp[6] : ramp[4], rk);
        p.glowRing(cx, cy, ring, 5, H(fx.glow), 0.35 * rk);
      }
    },
  };
}

/** 소환·등장 연기 (적이 나타날 때) */
function spawnPuff(x, y, skin, elite) {
  const c = skin === 1 ? "#9adcff" : skin === 2 ? "#b070e0" : "#8a7a90";
  for (let i = 0; i < (elite ? 10 : 4); i++) {
    const a = rr(0, TAU);
    sys.ps.spawn(P.DUST, x + Math.cos(a) * 3, y + Math.sin(a) * 2 + 2, Math.cos(a) * 18, Math.sin(a) * 8 - 4, rr(0.3, 0.6), c, rr(2, 3.4));
  }
  if (elite) sys.lights.add(x, y, 26, "#ff3a5a", 0.6, 0.6);
}

/** 처치 파편: 적 그림의 픽셀이 사방으로 흩어진다 */
export function addDebris(spr, x0, y0, color, k = 0.5) {
  const { w, h, px: P2 } = spr;
  for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) {
    const c = P2[j * w + i];
    if (!c || R() > k) continue;
    const dx = i - w / 2, dy = j - h / 2, L = Math.hypot(dx, dy) || 1;
    const sp = rr(30, 110);
    sys.debris.push({ x: x0 + i, y: y0 + j, vx: dx / L * sp + rr(-15, 15), vy: dy / L * sp - rr(20, 60), c: R() < 0.25 ? H(color) : c, life: rr(0.35, 0.7) });
  }
}

// ---------- 사건 구독 ----------

let lastHitSpark = 0, lastPoof = 0;

export function installVfx(getSprite) {
  on("slash", (d) => sys.live.push(slashFx(d)));
  on("burst", (d) => sys.live.push(burstFx({ ...d, style: null })));
  on("explode", (d) => sys.live.push(burstFx(d)));
  on("shoot", (d) => {
    const fx = d.fx;
    if (d.kind === "cannon") {
      const x = px(d.x), y = px(d.y);
      for (let i = 0; i < 6; i++) {
        const a = d.ang + rr(-0.5, 0.5), sp = rr(60, 150);
        sys.ps.spawn(P.MOTE, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rr(0.1, 0.22), i % 2 ? fx.hi : fx.spark, 1);
      }
      sys.ps.spawn(P.SMOKE, x, y, Math.cos(d.ang) * 20, -6, 0.6, H(fx.dark), 3);
      sys.lights.add(x, y, 22, fx.glow, 0.7, 0.14);
    } else if (d.kind === "fireball") {
      sys.lights.add(px(d.x), px(d.y), 14, fx.glow, 0.4, 0.12);
    }
  });
  on("hit", (d) => {
    if (d.dot) return;
    const x = px(d.x), y = px(d.y);
    const fx = d.fx || { spark: "#ffb347", hi: "#fff4d0", main: "#ff7b2e", deep: "#ff3a16", glow: "#ff8a3a", dark: "#3a1014" };
    if (!d.quiet) for (let i = 0; i < (d.heavy ? 6 : 3); i++) {
      const a = (d.ang != null ? d.ang : rr(0, TAU)) + rr(-1, 1), sp = rr(50, 130);
      sys.ps.spawn(P.MOTE, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rr(0.1, 0.25), i % 2 ? fx.spark : fx.hi, 0.8);
    }
    if ((d.heavy || d.e.boss) && sys.time - lastHitSpark > 0.06) {
      lastHitSpark = sys.time;
      addLib("hitSpark", fxHitSpark, { x, y: y + 4, angle: d.ang || 0, palette: fxRamp(fx), seed: (R() * 1000) | 0 });
    }
    if (G.settings && G.settings.damageNumbers !== false && sys.numbers.length < 40) {
      const big = d.amount >= 60;
      sys.numbers.push({ x: x + rr(-3, 3), y: y - (d.e.r / PX) - 4, t: 0, text: String(Math.round(d.amount)), color: hex(big ? "#ffd23c" : "#ffffff"), big: false });
    }
  });
  on("kill", (d) => {
    const e = d.e, x = px(e.x), y = px(e.y);
    const spr = getSprite(e);
    if (spr) addDebris(spr, x - spr.w / 2, y - spr.h / 2, d.fx ? d.fx.main : "#ff7b2e", e.elite ? 0.8 : 0.45);
    // 작은 연기 + 불티 (적 크기에 맞춘 가벼운 처치 연출)
    const dust = e.skin === 1 ? "#9ab8e0" : e.skin === 2 ? "#6a4a90" : "#8a7e86";
    const n = e.elite ? 8 : 3;
    for (let i = 0; i < n; i++) { const a = rr(0, TAU), sp = rr(10, 30); sys.ps.spawn(P.DUST, x + Math.cos(a) * 2, y + Math.sin(a) * 2, Math.cos(a) * sp, Math.sin(a) * sp * 0.6 - 6, rr(0.3, 0.55), dust, rr(1.6, 2.8)); }
    if (!d.quiet) for (let i = 0; i < 4; i++) { const a = rr(0, TAU), sp = rr(40, 100); sys.ps.spawn(P.MOTE, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rr(0.15, 0.3), d.fx ? d.fx.spark : "#ffb347", 0.8); }
    if (e.elite && sys.time - lastPoof > 0.05) { lastPoof = sys.time; addLib("poof", fxPoof, { x, y: y + 8, seed: (R() * 999) | 0 }, "top"); }
    sys.lights.add(x, y, 16, d.fx ? d.fx.glow : "#ff8a3a", 0.5, 0.25);
  });
  on("ignite", (d) => {
    const fx = d.fx;
    sys.arcs.push({ x1: px(d.x1), y1: px(d.y1), x2: px(d.x2), y2: px(d.y2), life: 0.22, max: 0.22, hi: H(fx.hi), main: H(fx.main), seed: R() * 10 });
    for (let i = 0; i < 4; i++) sys.ps.spawn(P.FIRE, px(d.x2) + rr(-3, 3), px(d.y2) + rr(-3, 3), rr(-8, 8), rr(-25, -10), rr(0.25, 0.45), 0, rr(1.4, 2.2));
  });
  on("enemySpawn", (d) => spawnPuff(px(d.x), px(d.y), d.skin, d.elite));
  on("playerHurt", (d) => {
    const x = px(d.x), y = px(d.y);
    for (let i = 0; i < 8; i++) { const a = rr(0, TAU), sp = rr(40, 110); sys.ps.spawn(P.MOTE, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rr(0.15, 0.3), "#ff4a5a", 1); }
    sys.lights.add(x, y, 30, "#ff2030", 0.6, 0.25);
  });
  on("levelUp", (d) => {
    addLib("levelUp", fxLevelUp, { x: px(d.x), y: px(d.y) + 8, text: "LEVEL UP", seed: d.level }, "top", 1.6);
  });
  on("jobSelected", (d) => {
    addLib("jobRing", fxFireRing, { x: px(d.x), y: px(d.y) + 8, palette: fxRamp(d.fx), seed: 5 }, "ground", 2.2);
    for (let i = 0; i < 30; i++) { const a = rr(0, TAU), sp = rr(40, 140); sys.ps.spawn(P.MOTE, px(d.x), px(d.y), Math.cos(a) * sp, Math.sin(a) * sp, rr(0.3, 0.7), i % 2 ? d.fx.hi : d.fx.spark, 1.2); }
    sys.lights.add(px(d.x), px(d.y), 90, d.fx.glow, 1.0, 1.0);
  });
  on("chestOpen", (d) => {
    addLib("chest", fxChestOpen, { x: px(d.x), y: px(d.y) + 6, seed: 3 }, "top", 2.6);
    sys.lights.add(px(d.x), px(d.y), 80, "#ffd23c", 0.9, 1.2);
  });
  on("nova", (d) => {
    addLib("nova", fxFrostNova, { x: px(d.x), y: px(d.y) + 10, reach: px(d.r) * 1.1, seed: (R() * 99) | 0 }, "top", 1.4);
    sys.lights.add(px(d.x), px(d.y), px(d.r) * 2, "#9bdcff", 0.8, 0.6);
  });
  on("bossSpawn", (d) => {
    const b = d.boss;
    addLib("summon", fxSummonRise, { x: px(b.x), y: px(b.y) + 20, seed: 4, palette: b.id === "frostWitch" ? ["#0c1430", "#1f4f94", "#58b4ec", "#9bdcff", "#d8f4ff"] : b.id === "voidLord" ? ["#0f0a18", "#2c1a4a", "#5e3290", "#a970e0", "#ff86e6"] : undefined }, "ground", 2.4);
  });
  on("bossSummon", (d) => {
    const b = d.boss;
    addLib("portal", fxSpawnPortal, { x: px(b.x), y: px(b.y) + 18, seed: 6, palette: b.id === "voidLord" ? ["#0f0a18", "#2c1a4a", "#5e3290", "#a970e0", "#ff86e6", "#ffd2f6"] : undefined }, "ground", 1.2);
  });
  on("bossSlam", (d) => {
    const x = px(d.x), y = px(d.y);
    for (let i = 0; i < 14; i++) { const a = rr(0, TAU), sp = rr(40, 120); sys.ps.spawn(P.DUST, x, y + 6, Math.cos(a) * sp, Math.sin(a) * sp * 0.5, rr(0.4, 0.8), "#8a7a90", rr(2.5, 4)); }
    G.s && (G.s.shake = { t: 0.3, dur: 0.3, amp: 6 });
  });
  on("bossBlink", (d) => {
    const x = px(d.x), y = px(d.y);
    for (let i = 0; i < 16; i++) { const a = rr(0, TAU), sp = rr(20, 80); sys.ps.spawn(P.MOTE, x, y, Math.cos(a) * sp, Math.sin(a) * sp, rr(0.3, 0.6), "#ff86e6", 1); }
  });
  on("bossDeath", (d) => {
    const x = px(d.x), y = px(d.y);
    for (let i = 0; i < 3; i++) addLib("explosion", fxSmallExplosion, { x: x + rr(-14, 14), y: y + rr(-6, 14), seed: i * 17 + 3, size: 1 }, "top", 1.6);
    const spr = getSprite(d.boss);
    if (spr) addDebris(spr, x - spr.w / 2, y - spr.h / 2, "#ffffff", 0.9);
    sys.lights.add(x, y, 140, "#ffffff", 1.2, 1.2);
    G.s && (G.s.shake = { t: 0.8, dur: 0.8, amp: 9 });
  });
  on("heal", (d) => {
    for (let i = 0; i < 12; i++) sys.ps.spawn(P.STAR, px(d.x) + rr(-8, 8), px(d.y) + rr(-10, 6), 0, rr(-30, -12), rr(0.5, 0.9), "#7ee88a", rr(0.8, 1.8));
  });
  on("gem", (d) => {
    sys.lights.add(px(d.x), px(d.y), 10, d.big ? "#ffd23c" : "#4ce8d8", 0.4, 0.15);
  });
  on("enemyDash", (d) => {
    for (let i = 0; i < 6; i++) sys.ps.spawn(P.DUST, px(d.x), px(d.y) + 5, -Math.cos(d.ang) * rr(20, 50), -Math.sin(d.ang) * rr(10, 30), rr(0.3, 0.5), "#7a6a70", 2.5);
  });
}

export { scale, mix, sparkle, ringHalfWidth };
