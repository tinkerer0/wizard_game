// 적: 생성·움직임(종류별 AI)·적 탄·피해 처리·처치 보상, 그리고 보스 3종의 공격 패턴.

import { W, H, MIN, MAXX, MAXY } from "../config.js";
import { clamp, dist, rand, pick } from "../util.js";
import { ENEMY_TYPES, ELITE, BOSSES } from "../data/enemies.js";
import { emit } from "../events.js";
import { G } from "./state.js";

const TAU = Math.PI * 2;

// ---------- 생성 ----------

function edgePoint() {
  const p = G.s.player;
  let x, y, tries = 0;
  do {
    const edge = Math.floor(Math.random() * 4);
    if (edge === 0) { x = rand(MIN + 10, MAXX - 10); y = MIN + 10; }
    else if (edge === 1) { x = rand(MIN + 10, MAXX - 10); y = MAXY - 10; }
    else if (edge === 2) { x = MIN + 10; y = rand(MIN + 10, MAXY - 10); }
    else { x = MAXX - 10; y = rand(MIN + 10, MAXY - 10); }
    tries++;
  } while (dist(x, y, p.x, p.y) < 180 && tries < 14);
  return { x, y };
}

export function spawnEnemy(type, opts = {}) {
  const s = G.s, gw = Math.max(1, s.gw);
  const T = ENEMY_TYPES[type];
  const pos = opts.x != null ? { x: opts.x, y: opts.y } : edgePoint();
  const elite = !!opts.elite;
  const hp = (18 + gw * 6) * T.hpK * (elite ? ELITE.hpK : 1) * (s.endless ? 1 + (gw - 30) * 0.06 : 1);
  const e = {
    type, ai: T.ai, elite, skin: s.stageIndex,
    x: pos.x, y: pos.y, r: T.r * (elite ? ELITE.rK : 1),
    hp, maxHp: hp,
    speed: (55 + gw * 3) * T.spdK * (elite ? 0.9 : 1),
    dmg: (8 + Math.floor(gw / 4) * 2) * T.dmgK * (elite ? ELITE.dmgK : 1),
    xp: T.xp * (elite ? ELITE.xpK : 1),
    heavy: !!T.heavy || elite,
    hitFlash: 0, t: rand(0, 10), phase: rand(0, TAU),
    state: "move", timer: rand(0.8, T.shootEvery || 1.5), dashAng: 0,
    spawnT: 0.35,            // 나타나는 중 (피해 없음)
    vx: 0, vy: 0,
  };
  if (opts.vx != null) { e.vx = opts.vx; e.vy = opts.vy; }
  s.enemies.push(e);
  emit("enemySpawn", { x: e.x, y: e.y, type, elite, skin: e.skin });
  return e;
}

export function spawnBoss(id) {
  const s = G.s, B = BOSSES[id];
  const hpScale = s.endless ? 1 + (s.gw - 30) * 0.08 : 1;
  const e = {
    boss: true, id, type: "boss", name: B.name, title: B.title,
    x: W / 2, y: MIN + 70, r: B.r,
    hp: B.hp * hpScale, maxHp: B.hp * hpScale,
    speed: B.speed, dmg: B.dmg, xp: B.xp, heavy: true,
    hitFlash: 0, t: 0, phase: 1,
    state: "intro", timer: 1.8, pattern: null, step: 0, sub: 0, dashAng: 0,
    patterns: B.patterns.slice(), pIdx: 0, spawnT: 0, alpha: 1,
  };
  s.enemies.push(e);
  s.boss = e;
  emit("bossSpawn", { boss: e });
  return e;
}

// ---------- 피해 ----------

/** 적에게 피해. opts: { flash, fx, kind, dot, quiet, noFlash, heavy, ang } */
export function hurt(e, amount, opts = {}) {
  if (e.dead || e.hidden) return;
  if (e.boss && (e.state === "intro" || e.invuln > 0)) return;
  if (e.spawnT > 0.2) return;
  e.hp -= amount;
  if (!opts.noFlash && !(e.boss && opts.dot)) e.hitFlash = Math.max(e.hitFlash, e.boss ? 0.06 : (opts.flash || 0.08));
  if (!opts.dot || Math.random() < 0.05) emit("hit", { x: e.x, y: e.y, e, amount, fx: opts.fx, kind: opts.kind, heavy: opts.heavy, dot: opts.dot, quiet: opts.quiet, ang: opts.ang });
  if (e.hp <= 0) killEnemy(e);
}

export function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  const s = G.s;
  if (e.boss) { onBossDeath(e); return; }
  s.kills++;
  emit("kill", { x: e.x, y: e.y, e, fx: s.player.fx });
  s.gems.push({ x: e.x, y: e.y, value: e.xp, t: 0, big: e.xp >= 10 });
  if (e.elite || Math.random() < 0.008) s.pickups.push({ kind: "heart", x: e.x + rand(-6, 6), y: e.y + rand(-6, 6), t: 0 });
  const T = ENEMY_TYPES[e.type];
  if (T && T.splitInto) {
    for (let i = 0; i < 2; i++) {
      const a = rand(0, TAU);
      const m = spawnEnemy(T.splitInto, { x: e.x + Math.cos(a) * 10, y: e.y + Math.sin(a) * 10, elite: false });
      m.spawnT = 0; m.vx = Math.cos(a) * 160; m.vy = Math.sin(a) * 160;
    }
  }
}

function onBossDeath(e) {
  const s = G.s;
  s.bossKills++;
  s.kills++;
  emit("bossDeath", { x: e.x, y: e.y, boss: e });
  // 남은 졸개·탄은 함께 사라진다
  for (const m of s.enemies) if (!m.dead && m !== e) { m.dead = true; emit("kill", { x: m.x, y: m.y, e: m, fx: s.player.fx, quiet: true }); }
  s.ebullets = [];
  s.telegraphs = [];
  s.gems.push({ x: e.x, y: e.y, value: e.xp, t: 0, big: true });
  s.pickups.push({ kind: "chest", x: clamp(e.x, MIN + 40, MAXX - 40), y: clamp(e.y, MIN + 40, MAXY - 40), t: 0 });
  s.boss = null;
}

/** 플레이어 피해 */
export function hurtPlayer(dmg, x, y) {
  const s = G.s, p = s.player;
  if (p.invuln > 0 || s.mode !== "playing") return;
  p.hp -= dmg;
  p.invuln = 0.7;
  emit("playerHurt", { x: p.x, y: p.y, dmg, fromX: x, fromY: y });
  if (p.hp <= 0) { p.hp = 0; emit("playerDeath", { x: p.x, y: p.y }); s.mode = "dead"; s.deadTimer = 1.6; }
}

// ---------- 움직임 ----------

export function updateEnemies(dt) {
  const s = G.s, p = s.player;
  for (const e of s.enemies) {
    if (e.dead) continue;
    e.t += dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }
    if (e.boss) { updateBoss(e, dt); }
    else updateMinion(e, dt);
    // 밀려난 속도(분열 등)
    if (e.vx || e.vy) {
      e.x += e.vx * dt; e.y += e.vy * dt;
      e.vx *= Math.pow(0.02, dt); e.vy *= Math.pow(0.02, dt);
      if (Math.abs(e.vx) < 2 && Math.abs(e.vy) < 2) e.vx = e.vy = 0;
    }
    e.x = clamp(e.x, MIN + e.r * 0.5, MAXX - e.r * 0.5);
    e.y = clamp(e.y, MIN + e.r * 0.5, MAXY - e.r * 0.5);
    // 접촉 피해
    if (!e.hidden && dist(e.x, e.y, p.x, p.y) < e.r + p.r) hurtPlayer(e.dmg, e.x, e.y);
  }
  separate();
  updateEnemyBullets(dt);
  updateTelegraphs(dt);
  s.enemies = s.enemies.filter((e) => !e.dead);
}

function separate() {
  const list = G.s.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead || a.boss || a.hidden) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead || b.hidden) continue;
      const dx = b.x - a.x, dy = b.y - a.y, min = (a.r + b.r) * 0.8;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2), push = (min - d) * 0.5, ux = dx / d, uy = dy / d;
      if (b.boss) { a.x -= ux * push * 2; a.y -= uy * push * 2; continue; }
      const wa = a.heavy ? 0.3 : 1, wb = b.heavy ? 0.3 : 1, sum = wa + wb;
      a.x -= ux * push * (wa / sum) * 2; a.y -= uy * push * (wa / sum) * 2;
      b.x += ux * push * (wb / sum) * 2; b.y += uy * push * (wb / sum) * 2;
    }
  }
}

function moveToward(e, tx, ty, speed, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  e.x += (dx / d) * speed * dt; e.y += (dy / d) * speed * dt;
  if (Math.abs(dx) > 2) e.face = dx > 0 ? 1 : -1;
}

function updateMinion(e, dt) {
  const s = G.s, p = s.player, T = ENEMY_TYPES[e.type];
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
  if (e.ai === "chase") {
    moveToward(e, p.x, p.y, e.speed, dt);
  } else if (e.ai === "weave") {
    const a = Math.atan2(dy, dx) + Math.sin(e.t * 4 + e.phase) * 0.85;
    e.x += Math.cos(a) * e.speed * dt; e.y += Math.sin(a) * e.speed * dt;
    e.face = dx > 0 ? 1 : -1;
  } else if (e.ai === "kite") {
    const keep = T.keep;
    if (d > keep + 30) moveToward(e, p.x, p.y, e.speed, dt);
    else if (d < keep - 40) moveToward(e, e.x - dx, e.y - dy, e.speed * 0.9, dt);
    else { const a = Math.atan2(dy, dx) + Math.PI / 2; e.x += Math.cos(a) * e.speed * 0.4 * dt * Math.sign(Math.sin(e.phase)); e.y += Math.sin(a) * e.speed * 0.4 * dt * Math.sign(Math.sin(e.phase)); }
    e.face = dx > 0 ? 1 : -1;
    e.timer -= dt;
    if (e.state === "move" && e.timer <= 0.5 && d < keep + 160) { e.state = "aim"; }
    if (e.state === "aim" && e.timer <= 0) {
      const a = Math.atan2(dy, dx);
      shoot(e.x, e.y, a, T.shotSpeed, e.dmg, e.skin === 2 ? "void" : "shard", 7);
      e.state = "move"; e.timer = T.shootEvery * rand(0.85, 1.15);
    }
  } else if (e.ai === "charge") {
    if (e.state === "move") {
      moveToward(e, p.x, p.y, e.speed, dt);
      e.timer -= dt;
      if (d < 270 && e.timer <= 0) { e.state = "windup"; e.timer = T.windup; e.dashAng = Math.atan2(dy, dx); }
    } else if (e.state === "windup") {
      e.timer -= dt;
      if (e.timer <= 0) { e.state = "dash"; e.timer = T.dashTime; emit("enemyDash", { x: e.x, y: e.y, ang: e.dashAng }); }
    } else if (e.state === "dash") {
      e.x += Math.cos(e.dashAng) * T.dashSpeed * dt; e.y += Math.sin(e.dashAng) * T.dashSpeed * dt;
      e.timer -= dt;
      if (e.timer <= 0) { e.state = "recover"; e.timer = 0.55; }
    } else {
      e.timer -= dt;
      if (e.timer <= 0) { e.state = "move"; e.timer = rand(1.4, 2.4); }
    }
  }
}

// ---------- 적 탄 ----------

export function shoot(x, y, ang, speed, dmg, kind, r = 7, extra = {}) {
  G.s.ebullets.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r, dmg, kind, life: extra.life || 5, t: 0, ...extra });
  emit("enemyShoot", { x, y, ang, kind });
}

function updateEnemyBullets(dt) {
  const s = G.s, p = s.player;
  for (const b of s.ebullets) {
    b.t += dt; b.life -= dt;
    if (b.homing) {
      const want = Math.atan2(p.y - b.y, p.x - b.x), cur = Math.atan2(b.vy, b.vx), sp = Math.hypot(b.vx, b.vy);
      let da = want - cur; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      const na = cur + clamp(da, -b.homing * dt, b.homing * dt);
      b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
    }
    if (b.accel) { b.vx *= 1 + b.accel * dt; b.vy *= 1 + b.accel * dt; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < MIN - 20 || b.x > MAXX + 20 || b.y < MIN - 20 || b.y > MAXY + 20) b.life = 0;
    if (b.life > 0 && dist(b.x, b.y, p.x, p.y) < b.r + p.r * 0.75) { hurtPlayer(b.dmg, b.x, b.y); b.life = 0; emit("ebulletHit", { x: b.x, y: b.y, kind: b.kind }); }
  }
  s.ebullets = s.ebullets.filter((b) => b.life > 0);
}

// ---------- 예고 표시 (서리 폭발 등 지연 공격) ----------

function updateTelegraphs(dt) {
  const s = G.s, p = s.player;
  for (const tg of s.telegraphs) {
    tg.t += dt;
    if (tg.t >= tg.max && !tg.done) {
      tg.done = true;
      if (tg.kind === "nova") {
        emit("nova", { x: tg.x, y: tg.y, r: tg.r });
        if (dist(tg.x, tg.y, p.x, p.y) < tg.r + p.r * 0.5) hurtPlayer(tg.dmg, tg.x, tg.y);
        // 서리 파편이 사방으로
        for (let i = 0; i < 8; i++) shoot(tg.x, tg.y, (i / 8) * TAU + tg.t, 150, tg.dmg * 0.5, "shard", 6, { life: 2.2 });
      }
    }
  }
  s.telegraphs = s.telegraphs.filter((tg) => !tg.done && !tg.cancel);
}

// ---------- 보스 ----------

function nextPattern(e) {
  const list = e.patterns;
  e.pIdx = (e.pIdx + 1) % list.length;
  if (Math.random() < 0.35) e.pIdx = Math.floor(Math.random() * list.length);
  return list[e.pIdx];
}

function updateBoss(e, dt) {
  const s = G.s, p = s.player;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1, aim = Math.atan2(dy, dx);
  if (Math.abs(dx) > 4) e.face = dx > 0 ? 1 : -1;
  const fast = e.phase === 2 ? 0.75 : 1;
  if (e.invuln > 0) e.invuln -= dt;
  // 2단계: 체력 절반
  if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
    e.phase = 2; e.invuln = 1.0;
    emit("bossPhase", { boss: e });
    if (e.id === "voidLord") { e.state = "pattern"; e.pattern = "summonEyes"; e.timer = 0.8; e.step = 0; }
  }
  e.timer -= dt;
  if (e.state === "intro") {
    e.y = Math.min(MIN + 110, e.y + 30 * dt);
    if (e.timer <= 0) { e.state = "move"; e.timer = 1.6; }
    return;
  }
  if (e.state === "move") {
    if (e.id === "frostWitch") {
      // 거리 유지하며 옆으로 흐른다
      const keep = 250;
      const ang = aim + Math.PI / 2 * Math.sign(Math.sin(e.t * 0.7));
      if (d < keep - 30) moveToward(e, e.x - dx, e.y - dy, e.speed, dt);
      else if (d > keep + 60) moveToward(e, p.x, p.y, e.speed, dt);
      else { e.x += Math.cos(ang) * e.speed * 0.7 * dt; e.y += Math.sin(ang) * e.speed * 0.7 * dt; }
    } else moveToward(e, p.x, p.y, e.speed * (e.phase === 2 ? 1.25 : 1), dt);
    if (e.timer <= 0) { e.state = "pattern"; e.pattern = nextPattern(e); e.step = 0; e.sub = 0; e.timer = 0.6; e.patternStart = true; emit("bossCast", { boss: e, pattern: e.pattern }); }
    return;
  }
  // 패턴 진행
  const endPattern = (rest = 1.8) => { e.state = "move"; e.timer = rest * fast + rand(0, 0.6); e.pattern = null; };
  switch (e.pattern) {
    // ----- 해골왕 -----
    case "charge": {
      const reps = e.phase === 2 ? 4 : 3;
      if (e.sub === 0) {               // 조준(예고선)
        if (e.step === 0 && e.timer > 0.55) { e.dashAng = aim; }
        e.dashAng = e.timer > 0.25 ? aim : e.dashAng;
        e.tele = { kind: "line", ang: e.dashAng, len: 420 };
        if (e.timer <= 0) { e.sub = 1; e.timer = 0.55; e.tele = null; emit("bossDash", { boss: e, ang: e.dashAng }); }
      } else {
        e.x += Math.cos(e.dashAng) * 640 * dt; e.y += Math.sin(e.dashAng) * 640 * dt;
        if (e.timer <= 0 || e.x <= MIN + e.r || e.x >= MAXX - e.r || e.y <= MIN + e.r || e.y >= MAXY - e.r) {
          if (e.x <= MIN + e.r || e.x >= MAXX - e.r || e.y <= MIN + e.r || e.y >= MAXY - e.r) emit("bossSlam", { x: e.x, y: e.y });
          e.step++; e.sub = 0; e.timer = 0.75 * fast;
          if (e.step >= reps) endPattern(2.0);
        }
      }
      break;
    }
    case "summon": {
      if (e.timer <= 0) {
        const n = e.phase === 2 ? 6 : 4;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU, rr = 90;
          const m = spawnEnemy(i % 2 ? "brute" : "slime", { x: clamp(e.x + Math.cos(a) * rr, MIN + 20, MAXX - 20), y: clamp(e.y + Math.sin(a) * rr, MIN + 20, MAXY - 20) });
          m.spawnT = 0.6;
        }
        emit("bossSummon", { boss: e });
        endPattern(2.2);
      }
      break;
    }
    case "boneRing": {
      if (e.timer <= 0) {
        const n = 14, off = e.step * (Math.PI / n);
        for (let i = 0; i < n; i++) shoot(e.x, e.y, (i / n) * TAU + off, 170, e.dmg * 0.7, "bone", 7);
        e.step++; e.timer = 0.5;
        if (e.step >= (e.phase === 2 ? 3 : 2)) endPattern(1.8);
      }
      break;
    }
    // ----- 서리마녀 -----
    case "shardFan": {
      if (e.timer <= 0) {
        const n = e.phase === 2 ? 7 : 5;
        for (let i = 0; i < n; i++) shoot(e.x, e.y, aim + (i - (n - 1) / 2) * 0.16, 230, e.dmg * 0.6, "shard", 6);
        e.step++; e.timer = 0.42;
        if (e.step >= 3) endPattern(1.6);
      }
      break;
    }
    case "frostNova": {
      if (e.timer <= 0) {
        const r = e.phase === 2 ? 125 : 105;
        s.telegraphs.push({ kind: "nova", x: clamp(p.x + rand(-20, 20), MIN + 30, MAXX - 30), y: clamp(p.y + rand(-20, 20), MIN + 30, MAXY - 30), r, t: 0, max: 1.15, dmg: e.dmg * 1.1 });
        e.step++; e.timer = 0.75;
        if (e.step >= (e.phase === 2 ? 4 : 3)) endPattern(2.2);
      }
      break;
    }
    case "shardSpiral": {
      if (e.step === 0) { e.step = 1; e.timer = 2.6; e.spinT = 0; e.spinBase = rand(0, TAU); }
      e.spinT = (e.spinT || 0) + dt;
      e.sub += dt;
      const every = e.phase === 2 ? 0.075 : 0.1;
      while (e.sub >= every) {
        e.sub -= every;
        const arms = e.phase === 2 ? 3 : 2;
        for (let k = 0; k < arms; k++) shoot(e.x, e.y, e.spinBase + e.spinT * 2.4 + (k / arms) * TAU, 165, e.dmg * 0.5, "shard", 6, { life: 3.5 });
      }
      if (e.timer <= 0) endPattern(2.0);
      break;
    }
    // ----- 공허군주 -----
    case "voidOrbs": {
      if (e.timer <= 0) {
        const n = e.phase === 2 ? 6 : 4;
        for (let i = 0; i < n; i++) shoot(e.x, e.y, aim + (i / n) * TAU, 120, e.dmg * 0.8, "orb", 10, { homing: 1.6, life: 5.5 });
        endPattern(2.2);
      }
      break;
    }
    case "blinkWave": {
      if (e.sub === 0) {               // 사라짐
        e.alpha = clamp(e.timer / 0.6, 0, 1);
        if (e.timer <= 0) {
          e.hidden = true;
          const a = rand(0, TAU), rr = 170;
          e.x = clamp(p.x + Math.cos(a) * rr, MIN + e.r, MAXX - e.r);
          e.y = clamp(p.y + Math.sin(a) * rr, MIN + e.r, MAXY - e.r);
          e.sub = 1; e.timer = 0.5;
          emit("bossBlink", { x: e.x, y: e.y });
        }
      } else if (e.sub === 1) {       // 나타날 자리 예고
        e.tele = { kind: "ring", r: 60 };
        if (e.timer <= 0) {
          e.hidden = false; e.alpha = 1; e.tele = null; e.sub = 2;
          const n = e.phase === 2 ? 24 : 18;
          for (let i = 0; i < n; i++) shoot(e.x, e.y, (i / n) * TAU, 200, e.dmg * 0.6, "void", 7);
          emit("bossSlam", { x: e.x, y: e.y });
          e.timer = 0.4;
        }
      } else if (e.timer <= 0) endPattern(1.6);
      break;
    }
    case "voidSpiral": {
      if (e.step === 0) { e.step = 1; e.timer = 3.0; e.spinT = 0; e.spinBase = rand(0, TAU); }
      e.spinT += dt;
      e.sub += dt;
      const every = e.phase === 2 ? 0.11 : 0.14;
      while (e.sub >= every) {
        e.sub -= every;
        for (let k = 0; k < 4; k++) shoot(e.x, e.y, e.spinBase - e.spinT * 1.7 + (k / 4) * TAU, 150, e.dmg * 0.5, "void", 7, { life: 4 });
      }
      if (e.timer <= 0) endPattern(2.0);
      break;
    }
    case "summonEyes": {
      if (e.timer <= 0) {
        const n = e.phase === 2 ? 4 : 3;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + rand(0, 1);
          const m = spawnEnemy("caster", { x: clamp(e.x + Math.cos(a) * 120, MIN + 20, MAXX - 20), y: clamp(e.y + Math.sin(a) * 120, MIN + 20, MAXY - 20) });
          m.spawnT = 0.6;
        }
        emit("bossSummon", { boss: e });
        endPattern(2.0);
      }
      break;
    }
    default: endPattern(1.5);
  }
}

export { pick };
