// 플레이어 공격: 자동 조준 + 무기별 분기(베기·포격·불씨 궤도·기본 화염탄), 지속 피해(오라·불바닥·화상·잔상).
// 수치와 판정은 이전 버전(game.html, 2026-06-10 밸런스)과 같다. 그림은 emit()으로 알리기만 한다.

import { MIN, MAXX, MAXY } from "../config.js";
import { dist, rand, angleDiff } from "../util.js";
import { FX } from "../data/jobs.js";
import { emit } from "../events.js";
import { G } from "./state.js";
import { hurt } from "./enemies.js";

export const dmgOf = (p) => p.damage * p.damageMul;

export function addShake(amp, dur) {
  const s = G.s;
  if (s.shake.t <= 0 || amp >= s.shake.amp) s.shake = { t: dur, dur, amp };
}

function nearestEnemy(x, y) {
  let best = null, bd = Infinity;
  for (const e of G.s.enemies) {
    if (e.dead || e.hidden) continue;
    const d = dist(e.x, e.y, x, y);
    if (d < bd) { bd = d; best = e; }
  }
  return [best, bd];
}

export function doAttack(dt) {
  const s = G.s, p = s.player;
  if (p.weapon === "orbit") { updateOrbit(dt); return; }
  const [nearest, nd] = nearestEnemy(p.x, p.y);
  s.fireTimer -= dt;
  if (!nearest || nd > p.attackRange + (nearest.boss ? nearest.r * 0.6 : 0)) { if (s.fireTimer < 0) s.fireTimer = 0; return; }
  const a = Math.atan2(nearest.y - p.y, nearest.x - p.x);
  s.aim.x = Math.cos(a); s.aim.y = Math.sin(a);
  if (s.fireTimer > 0) return;
  s.fireTimer = p.fireCooldown;
  p.castT = 0.18;
  if (Math.abs(s.aim.x) > 0.2) p.facing = s.aim.x > 0 ? 1 : -1;
  if (p.weapon === "slash") doSlash(a, nearest);
  else if (p.weapon === "cannon") fireCannon(a);
  else fire();
}

// 기본(전직 전) 화염탄
function fire() {
  const s = G.s, p = s.player;
  const baseAng = Math.atan2(s.aim.y, s.aim.x);
  const n = p.projectiles, spread = 0.18;
  for (let i = 0; i < n; i++) {
    const a = baseAng + (i - (n - 1) / 2) * spread;
    s.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * p.bulletSpeed, vy: Math.sin(a) * p.bulletSpeed, r: p.bulletR, dmg: dmgOf(p), pierce: p.pierce, life: 1.6, fx: p.fx, hitSet: null });
  }
  emit("shoot", { x: p.x, y: p.y, ang: baseAng, kind: "fireball", fx: p.fx });
}

// 근접 화염 베기 (전방 부채꼴 즉발 피해)
function doSlash(ang, target) {
  const s = G.s, p = s.player;
  const st = p.slashStyle;
  const heavy = st === "heavy";
  const twin = st === "twinSlash";
  const crims = st === "crimsonFlurry";
  const half = crims ? Math.PI * 0.52 : (heavy ? Math.PI * 0.3 : (st === "thrust" ? Math.PI * 0.22 : (twin ? Math.PI * 0.46 : Math.PI * 0.42)));
  const dmg = dmgOf(p);
  emit("slash", { x: p.x, y: p.y, ang, range: p.attackRange, half, style: st || "single", fx: p.fx, tier: p.tier, twin });
  for (const e of s.enemies) {
    if (e.dead || e.hidden) continue;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (d > p.attackRange + e.r) continue;
    const da = angleDiff(Math.atan2(dy, dx), ang);
    const hit = twin ? (da <= half || (Math.PI - da) <= half) : (da <= half);
    if (hit) {
      if (heavy && !e.heavy && !e.boss) { const k = 52; e.x += (dx / d) * k; e.y += (dy / d) * k; }
      hurt(e, dmg, { flash: heavy ? 0.18 : 0.1, fx: p.fx, kind: "slash", heavy });
    }
  }
  // 홍련검무사: 베기 자리에 화염 잔상 (지속 피해)
  if (p.crimsonWave) {
    const w = p.crimsonWave;
    s.afterimages.push({ x: p.x, y: p.y, ang, range: p.attackRange + w.rangeBonus * 0.5, half: Math.PI * 0.5, life: 0.6, max: 0.6, dps: dmg * 1.15, fx: p.fx });
  }
  // 폭열돌격자 계열: 맞은 적 뒤쪽에서 폭발
  if (p.slashExplode) {
    let ex, ey;
    if (target) {
      ex = target.x + Math.cos(ang) * (target.r + p.slashExplode * 0.55);
      ey = target.y + Math.sin(ang) * (target.r + p.slashExplode * 0.55);
    } else {
      ex = p.x + Math.cos(ang) * p.attackRange; ey = p.y + Math.sin(ang) * p.attackRange;
    }
    for (const e of s.enemies) {
      if (!e.dead && !e.hidden && dist(ex, ey, e.x, e.y) <= p.slashExplode + e.r) hurt(e, dmg * 1.0, { flash: 0.12, fx: p.fx, kind: "burst", quiet: true });
    }
    emit("burst", { x: ex, y: ey, ang, r: p.slashExplode, fx: p.fx, tier: p.tier });
    addShake(Math.min(5, p.slashExplode * 0.035), 0.16);
  }
}

export function explodeStyleOf(shape) {
  if (shape === "hellShell") return "flash";
  if (shape === "shell" || shape === "megaShell" || shape === "scorcher") return "smoke";
  if (shape === "mine") return "mini";
  return null;
}

function fireCannon(ang) {
  const s = G.s, p = s.player;
  s.bullets.push({
    x: p.x, y: p.y, vx: Math.cos(ang) * p.bulletSpeed, vy: Math.sin(ang) * p.bulletSpeed,
    r: p.bulletR, dmg: dmgOf(p), pierce: p.pierce, life: 2.2, explode: p.explodeRadius, big: true, ground: p.groundFire, shape: p.bulletShape,
    fx: p.fx, exStyle: explodeStyleOf(p.bulletShape), hitSet: null,
  });
  emit("shoot", { x: p.x + Math.cos(ang) * (p.r + 10), y: p.y + Math.sin(ang) * (p.r + 10), ang, kind: "cannon", fx: p.fx, size: p.bulletR, shape: p.bulletShape });
}

// 불씨 궤도: 주변을 도는 불씨의 접촉 피해(연속)
function updateOrbit(dt) {
  const s = G.s, p = s.player;
  p.orbitAngle += dt * p.orbitSpeed;
  const n = p.orbitCount, R = p.orbitRadius, dps = dmgOf(p) / p.fireCooldown;
  s.orbits = [];
  for (let i = 0; i < n; i++) {
    const a = p.orbitAngle + i * (Math.PI * 2 / n);
    s.orbits.push({ x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R, a });
  }
  const touch = (e, mult) => {
    if (p.burnOnHit) { e.burnDps = dmgOf(p) * p.burnOnHit.dpsFactor; e.burnTime = p.burnOnHit.dur; e.burnFx = p.fx; }
    hurt(e, dps * dt * mult, { flash: 0.08, fx: p.fx, kind: "orbit", dot: true });
  };
  if (["ring", "solar", "meteorRing", "dualRing"].includes(p.orbStyle)) {
    // 불 고리: 보이는 띠 전체가 피해 범위 (그림 쪽 ringHalfWidth와 반드시 같게)
    const hw = ringHalfWidth(p.orbStyle);
    for (const e of s.enemies) {
      if (e.dead || e.hidden) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (Math.abs(d - R) <= hw + e.r) touch(e, 0.85);
      else if (p.orbStyle === "dualRing" && Math.abs(d - R * 0.68) <= hw + e.r) touch(e, 0.85);
    }
  } else {
    const hitR = orbHitRadius(p.orbStyle);
    const cmult = p.burnOnHit ? 0.4 : 1;
    for (const o of s.orbits) for (const e of s.enemies) {
      if (e.dead || e.hidden) continue;
      if (dist(o.x, o.y, e.x, e.y) < hitR + e.r) touch(e, cmult);
    }
  }
  // 불꽃사역자 계열: 불씨가 가장 가까운 적에게 자동 발사
  if (p.orbShoot) {
    p.orbShootTimer -= dt;
    if (p.orbShootTimer <= 0 && s.enemies.length) {
      p.orbShootTimer = p.orbShoot.interval;
      const [tg] = nearestEnemy(p.x, p.y);
      if (tg) {
        const o = s.orbits[(Math.floor(s.time * 7)) % Math.max(1, s.orbits.length)] || { x: p.x, y: p.y };
        const a = Math.atan2(tg.y - o.y, tg.x - o.x);
        const os = p.orbShoot, spd = os.speed || 440;
        s.bullets.push({ x: o.x, y: o.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: os.r || 6, dmg: dmgOf(p) * os.dmgFactor, pierce: 0, life: os.life || 1.4, shape: os.shape || "spiritBolt", fx: p.fx, hitSet: null });
        emit("shoot", { x: o.x, y: o.y, ang: a, kind: "orb", fx: p.fx, quiet: true });
      }
    }
  }
}

export function ringHalfWidth(style) { return style === "solar" ? 30 : (style === "dualRing" ? 13 : 16); }
export function orbHitRadius(style) { return style === "blaze" ? 18 : (style === "ember" ? 14 : 16); }

/** 플레이어 탄 이동·충돌 */
export function updateBullets(dt) {
  const s = G.s;
  for (const b of s.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    if (b.x < MIN || b.x > MAXX || b.y < MIN || b.y > MAXY) {
      if (b.explode) detonate(b);
      b.life = 0;
    }
    if (b.life <= 0) continue;
    for (const e of s.enemies) {
      if (e.dead || e.hidden) continue;
      if (b.hitSet && b.hitSet.has(e)) continue;
      if (dist(b.x, b.y, e.x, e.y) < b.r + e.r) {
        if (b.explode) { detonate(b); b.life = 0; }
        else {
          hurt(e, b.dmg, { flash: 0.1, fx: b.fx, kind: "bullet", ang: Math.atan2(b.vy, b.vx) });
          if (b.pierce > 0) { b.pierce--; (b.hitSet || (b.hitSet = new Set())).add(e); }
          else b.life = 0;
        }
        if (b.life <= 0) break;
      }
    }
  }
  s.bullets = s.bullets.filter((b) => b.life > 0);
}

function detonate(b) {
  const s = G.s;
  for (const e of s.enemies) {
    if (e.dead || e.hidden) continue;
    if (dist(b.x, b.y, e.x, e.y) <= b.explode) hurt(e, b.dmg, { flash: 0.1, fx: b.fx, kind: "explode", quiet: true });
  }
  emit("explode", { x: b.x, y: b.y, r: b.explode, fx: b.fx, style: b.exStyle, tier: s.player.tier, shape: b.shape });
  addShake(Math.min(b.exStyle === "flash" ? 9 : 6, b.explode * 0.045), b.exStyle === "flash" ? 0.3 : 0.2);
  if (b.ground) spawnHazard(b.x, b.y, b.ground, b.fx);
}

function spawnHazard(x, y, gf, fx) {
  const s = G.s;
  s.hazards.push({ x, y, r: gf.r, life: gf.life, max: gf.life, dps: dmgOf(s.player) * gf.dpsFactor, fx: fx || s.player.fx || FX.base, id: Math.random() });
}

/** 지속 피해: 용암 오라 / 불바닥 / 화상(+전염) / 홍련 잔상 */
export function applyDots(dt) {
  const s = G.s, p = s.player;
  if (p.aura) {
    const dps = dmgOf(p) * p.aura.dpsFactor;
    for (const e of s.enemies) {
      if (e.dead || e.hidden) continue;
      if (dist(p.x, p.y, e.x, e.y) <= p.aura.r + e.r) hurt(e, dps * dt, { flash: 0.06, dot: true, fx: p.fx });
    }
  }
  for (const h of s.hazards) {
    h.life -= dt;
    for (const e of s.enemies) {
      if (e.dead || e.hidden) continue;
      if (dist(h.x, h.y, e.x, e.y) <= h.r + e.r) hurt(e, h.dps * dt, { flash: 0.06, dot: true, fx: h.fx });
    }
  }
  s.hazards = s.hazards.filter((h) => h.life > 0);
  for (const e of s.enemies) {
    if (e.dead || !e.burnTime || e.burnTime <= 0) continue;
    e.burnTime -= dt;
    // 화상 전염 (점화조율사 계열)
    if (p.burnSpread && Math.random() < dt * 2.5) {
      for (const e2 of s.enemies) {
        if (e2 === e || e2.dead || e2.hidden || e2.burnTime > 0) continue;
        if (dist(e.x, e.y, e2.x, e2.y) < p.burnSpread) {
          e2.burnDps = e.burnDps; e2.burnTime = (p.burnOnHit && p.burnOnHit.dur) || 2; e2.burnFx = e.burnFx || p.fx;
          emit("ignite", { x1: e.x, y1: e.y, x2: e2.x, y2: e2.y, fx: e2.burnFx });
          break;
        }
      }
    }
    hurt(e, e.burnDps * dt, { dot: true, fx: e.burnFx, noFlash: true });
  }
  for (const ai of s.afterimages) {
    ai.life -= dt;
    for (const e of s.enemies) {
      if (e.dead || e.hidden) continue;
      const dx = e.x - ai.x, dy = e.y - ai.y, d = Math.hypot(dx, dy) || 1;
      if (d > ai.range + e.r) continue;
      if (angleDiff(Math.atan2(dy, dx), ai.ang) <= ai.half) hurt(e, ai.dps * dt, { flash: 0.07, dot: true, fx: ai.fx });
    }
  }
  s.afterimages = s.afterimages.filter((ai) => ai.life > 0);
}

export { rand };
