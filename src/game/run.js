// 한 판의 흐름: 시작 → 웨이브 → 보스 → 스테이지 클리어 → … → 클리어/사망 → 결과·보상.
// 레벨업·전직, 경험치 구슬·하트·상자 줍기도 여기서 처리한다.

import { MIN, MAXX, MAXY, STAGE_COUNT } from "../config.js";
import { clamp, dist, weighted, pick } from "../util.js";
import { JOBS, TIER1_CHOICES, computeFx, getJobPath } from "../data/jobs.js";
import { STAGES, waveInfo, waveCount } from "../data/stages.js";
import { UPGRADES, crystalsFor } from "../data/upgrades.js";
import { emit } from "../events.js";
import { getSave, save } from "../save.js";
import { G, makeRunState } from "./state.js";
import { doAttack, updateBullets, applyDots } from "./combat.js";
import { spawnEnemy, spawnBoss, updateEnemies } from "./enemies.js";

// ---------- 시작 ----------

export function startRun(opts = {}) {
  G.s = makeRunState();
  const s = G.s, p = s.player;
  const ups = opts.upgrades || (G.sim ? {} : getSave().upgrades);
  for (const u of UPGRADES) {
    const lv = Math.min(u.max, ups[u.id] || 0);
    if (lv > 0) u.apply(p, lv);
  }
  s.startWave = opts.startWave || 1;
  s.firstRun = !G.sim && getSave().records.runs === 0;
  const preview = opts.previewJob;
  if (preview && JOBS[preview]) {
    // 테스트용: 레벨링 없이 그 직업으로 시작
    p.level = 16; p.xpToNext = 999;
    for (const id of getJobPath(preview)) applyJob(id);
  }
  G.scene = "play";
  emit("runStart", {});
  startWave(s.startWave);
}

export function applyJob(id) {
  const s = G.s, p = s.player, j = JOBS[id];
  if (!j) return;
  j.apply(p);
  p.job = id; p.tier = j.tier; p.fx = computeFx(id);
  s.jobPath.push(id);
  if (G.sim) return;
  const sv = getSave();
  if (!sv.seenJobs.includes(id)) { sv.seenJobs.push(id); save(); }
}

// ---------- 웨이브 ----------

export function startWave(gw) {
  const s = G.s;
  const prevStage = s.stageIndex;
  s.gw = gw;
  const info = waveInfo(gw);
  s.stageIndex = info.stageIndex;
  s.endless = info.endless;
  s.mode = "playing";
  s.spawnTimer = 0.4;
  s.vacuum = false;
  if (info.isBoss) {
    s.spawnQueue = 0;
    s.eliteQueue = 0;
    const id = info.endless ? pick(STAGES).boss : STAGES[info.stageIndex].boss;
    // 보스 전 정비: 체력 30% 회복
    const p = s.player, heal = Math.round(p.maxHp * 0.3);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    emit("heal", { x: p.x, y: p.y, amount: heal });
    spawnBoss(id);
  } else {
    s.spawnQueue = waveCount(gw);
    const st = STAGES[info.stageIndex];
    s.eliteQueue = info.endless ? 2 + Math.floor((gw - 30) / 10) : (st.eliteWaves.includes(info.local) ? (info.stageIndex === 2 ? 2 : 1) : 0);
    s.eliteAt = Math.floor(s.spawnQueue * 0.5);
  }
  emit("waveStart", { gw, stageIndex: s.stageIndex, local: info.local, isBoss: info.isBoss, stageChanged: prevStage !== s.stageIndex || gw === s.startWave });
}

function spawnTick(dt) {
  const s = G.s;
  if (s.spawnQueue <= 0) return;
  s.spawnTimer -= dt;
  if (s.spawnTimer > 0) return;
  const info = waveInfo(s.gw);
  const st = STAGES[info.stageIndex];
  const lw = info.endless ? 9 : info.local;
  const t = weighted(st.mix(lw).filter((m) => m.w > 0)).type;
  const elite = s.eliteQueue > 0 && s.spawnQueue <= s.eliteAt + s.eliteQueue;
  if (elite) s.eliteQueue--;
  spawnEnemy(t, { elite });
  s.spawnQueue--;
  // 무리 지어 나오도록 간격을 조금씩 흔든다
  s.spawnTimer = Math.random() < 0.25 ? 0.08 : (s.gw < 6 ? 0.42 : 0.3);
}

// ---------- 성장 ----------

export function gainXp(v) {
  const s = G.s, p = s.player;
  p.xp += v * p.xpMul;
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level++;
    p.xpToNext = Math.round(6 + p.level * 4 + Math.pow(p.level, 1.8) * 1.2);
    p.maxHp += 8; p.hp += 8; p.damage += 2;      // 전직 외 레벨업 = 고정 스탯 자동 상승
    s.levelToast = 1.4;
    emit("levelUp", { level: p.level, x: p.x, y: p.y });
    if ((p.level >= 4 && p.tier === 0) || (p.level >= 10 && p.tier === 1) || (p.level >= 16 && p.tier === 2)) openJobSelect();
  }
}

export function openJobSelect() {
  const s = G.s, p = s.player;
  if (s.mode === "dead" || s.mode === "jobselect") return;     // 죽은 뒤엔 열지 않고, 이미 열려 있으면 그대로
  s.jobChoices = (p.tier === 0) ? TIER1_CHOICES.slice() : ((JOBS[p.job] && JOBS[p.job].children) || []).slice();
  if (s.jobChoices.length) { s.resumeMode = s.mode; s.mode = "jobselect"; s.jobCursor = 0; s.jobSelectT = 0; emit("jobSelectOpen", {}); }
}

/** 상태 바꾸기: 전직 창이 열려 있으면 닫힌 뒤 돌아갈 상태로 미뤄 둔다 */
function setMode(m) {
  const s = G.s;
  if (s.mode === "jobselect") s.resumeMode = m;
  else s.mode = m;
}

export function chooseJob(idx) {
  const s = G.s;
  if (s.mode !== "jobselect" || !s.jobChoices.length) return;
  const id = s.jobChoices[clamp(idx, 0, s.jobChoices.length - 1)];
  applyJob(id);
  s.jobChoices = [];
  s.mode = s.resumeMode && s.resumeMode !== "jobselect" ? s.resumeMode : "playing";
  s.resumeMode = null;
  emit("jobSelected", { id, x: s.player.x, y: s.player.y, fx: s.player.fx, tier: s.player.tier });
}

// ---------- 매 프레임 ----------

export function updateRun(dt) {
  const s = G.s, p = s.player;
  if (s.banner) { s.banner.t += dt; if (s.banner.t >= s.banner.max) s.banner = null; }
  if (s.levelToast > 0) s.levelToast -= dt;
  if (s.shake.t > 0) s.shake.t -= dt;
  if (s.mode === "jobselect" || s.mode === "paused") return;

  if (s.mode === "dead") {
    s.deadTimer -= dt;
    if (s.deadTimer <= 0) endRun(false);
    return;
  }
  if (s.mode === "victory") {
    s.victoryTimer -= dt;
    movePlayer(dt);
    if (s.victoryTimer <= 0) endRun(true);
    return;
  }

  if (s.mode === "playing") s.time += dt;
  movePlayer(dt);
  if (s.mode === "playing") {
    doAttack(dt);
    spawnTick(dt);
  }
  updateBullets(dt);
  updateEnemies(dt);
  if (s.mode === "dead") return;          // 이번 프레임에 쓰러졌으면 줍기·레벨업을 하지 않는다
  applyDots(dt);
  updatePickups(dt);
  if (p.castT > 0) p.castT -= dt;

  // 웨이브 끝?
  if (s.mode === "playing" && !s.boss && s.spawnQueue === 0 && s.enemies.length === 0 && !s.pickups.some((k) => k.kind === "chest")) {
    if (!waveInfo(s.gw).isBoss) {
      s.mode = "intermission";
      s.intermissionTimer = 2.2;
      s.vacuum = true;
      emit("waveClear", { gw: s.gw });
    }
  }
  if (s.mode === "intermission") {
    s.intermissionTimer -= dt;
    if (s.intermissionTimer <= 0) startWave(s.gw + 1);
  }
  if (s.mode === "stageclear") {
    s.stageClearTimer -= dt;
    if (s.stageClearTimer <= 0) startWave(s.gw + 1);
  }
}

function movePlayer(dt) {
  const s = G.s, p = s.player, k = G.keys;
  let mx = 0, my = 0;
  if (k.has("ArrowLeft") || k.has("KeyA")) mx -= 1;
  if (k.has("ArrowRight") || k.has("KeyD")) mx += 1;
  if (k.has("ArrowUp") || k.has("KeyW")) my -= 1;
  if (k.has("ArrowDown") || k.has("KeyS")) my += 1;
  if (G.touch && G.touch.active) { mx = G.touch.dx; my = G.touch.dy; }
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const m = Math.hypot(mx, my);
    p.x += (mx / m) * p.speed * dt;
    p.y += (my / m) * p.speed * dt;
    if (Math.abs(mx) > 0.2 && p.castT <= 0) p.facing = mx > 0 ? 1 : -1;
  }
  p.x = clamp(p.x, MIN + p.r, MAXX - p.r);
  p.y = clamp(p.y, MIN + p.r, MAXY - p.r);
  if (p.invuln > 0) p.invuln -= dt;
}

function updatePickups(dt) {
  const s = G.s, p = s.player;
  for (const g of s.gems) {
    g.t += dt;
    const d = dist(g.x, g.y, p.x, p.y);
    if (d < p.pickupRadius || s.vacuum || s.mode === "stageclear") {
      const dx = p.x - g.x, dy = p.y - g.y, m = Math.hypot(dx, dy) || 1;
      const sp = s.vacuum || s.mode === "stageclear" ? 520 : 320;
      g.x += (dx / m) * sp * dt; g.y += (dy / m) * sp * dt;
    }
    if (d < p.r + 6) { g.dead = true; gainXp(g.value); emit("gem", { x: g.x, y: g.y, big: g.big }); }
  }
  s.gems = s.gems.filter((g) => !g.dead);
  for (const k of s.pickups) {
    k.t += dt;
    const d = dist(k.x, k.y, p.x, p.y);
    if (k.kind === "heart") {
      if (d < p.r + 12) { k.dead = true; const heal = Math.round(p.maxHp * 0.25); p.hp = Math.min(p.maxHp, p.hp + heal); emit("heal", { x: p.x, y: p.y, amount: heal }); }
      if (k.t > 14) k.dead = true;
    } else if (k.kind === "chest") {
      // 보스 상자: 닿거나 4초 지나면 열린다
      if (d < p.r + 20 || k.t > 4.5) { k.dead = true; openChest(k); }
    }
  }
  s.pickups = s.pickups.filter((k) => !k.dead);
}

function openChest(k) {
  const s = G.s, p = s.player;
  const heal = Math.round(p.maxHp * 0.35);
  p.hp = Math.min(p.maxHp, p.hp + heal);
  emit("chestOpen", { x: k.x, y: k.y, heal });
  const finalStage = !s.endless && s.stageIndex === STAGE_COUNT - 1;
  if (finalStage) {
    setMode("victory");
    s.victory = true;
    s.victoryTimer = 3.2;
    s.banner = { text: "클리어!", sub: "공허군주를 쓰러뜨렸다", t: 0, max: 3.2, color: "gold" };
    emit("victory", {});
  } else {
    setMode("stageclear");
    s.stageClearTimer = 3.4;
    s.banner = { text: "스테이지 클리어", sub: s.endless ? `무한 모드 웨이브 ${s.gw}` : `다음: ${STAGES[s.stageIndex + 1].name}`, t: 0, max: 3.2, color: "gold" };
    emit("stageClear", { stageIndex: s.stageIndex });
  }
}

// ---------- 끝 ----------

export function endRun(victory) {
  const s = G.s;
  if (G.sim) { s.ended = victory ? "victory" : "defeat"; G.scene = "results"; return; }
  const sv = getSave(), r = sv.records;
  const total = crystalsFor({ kills: s.kills, gw: s.gw, bossKills: s.bossKills, victory: s.victory });
  const gain = Math.max(0, total - (s.rewardGranted || 0));
  s.reward = gain;
  s.rewardGranted = (s.rewardGranted || 0) + gain;
  sv.crystals += gain;
  s.newRecord = false;
  if (!s.recorded) {
    r.runs++;
    s.recorded = true;
  }
  r.totalKills += s.kills - (s.killsRecorded || 0);
  s.killsRecorded = s.kills;
  if (s.gw > r.bestWave) { r.bestWave = s.gw; s.newRecord = true; }
  if (s.time > r.bestTime) r.bestTime = s.time;
  if (victory && !s.victoryRecorded) {
    s.victoryRecorded = true;
    r.victories++;
    if (!r.fastestVictory || s.time < r.fastestVictory) { r.fastestVictory = s.time; s.newRecord = true; }
  }
  if (s.endless && s.gw > (r.bestEndless || 0)) r.bestEndless = s.gw;
  const entry = { date: Date.now(), gw: s.gw, time: Math.round(s.time), kills: s.kills, level: s.player.level, job: s.player.job, victory: s.victory, endless: s.endless };
  if (s.historyPushed) sv.history[0] = entry;       // 클리어 뒤 무한 모드로 이어 간 판은 한 줄로
  else { sv.history.unshift(entry); s.historyPushed = true; }
  sv.history = sv.history.slice(0, 10);
  save();
  s.ended = victory ? "victory" : "defeat";
  s.resultCursor = 0;
  G.scene = "results";
  emit("runEnd", { victory });
}

/** 클리어 후 같은 판을 무한 모드로 계속 */
export function continueEndless() {
  const s = G.s;
  s.endless = true;
  s.ended = null;
  G.scene = "play";
  s.player.hp = s.player.maxHp;
  startWave(s.gw + 1);
}
