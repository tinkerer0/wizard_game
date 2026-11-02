// 전투 화면 위 정보: 체력·경험치·스테이지 진행·보스 체력·안내 문구, 그리고 전직 선택·일시정지 창.

import { G } from "../game/state.js";
import { JOBS, FIRE_TIER, branchOf, computeFx } from "../data/jobs.js";
import { STAGES, waveInfo } from "../data/stages.js";
import { fmtTime } from "../util.js";
import { wizardSprites } from "./sprites.js";
import { FONT, COL, text, measure, panel, bar, dim, flameCursor, drawSprite, hitArea } from "./uikit.js";

const TIER_LABEL = ["", "1차 전직", "2차 전직", "3차 전직"];

export function drawHud(ctx) {
  const s = G.s, p = s.player, t = G.time;
  // 플레이어나 적이 HUD 뒤에 있으면 그 칸을 흐리게
  const under = (x0, x1, y1) => {
    if (p.y < y1 + 24 && p.x > x0 - 24 && p.x < x1 + 24) return true;
    for (const e of s.enemies) if (e.boss && e.y < y1 + 30 && e.x > x0 - 30 && e.x < x1 + 30) return true;
    return false;
  };
  const fade = (on) => { ctx.globalAlpha = on ? 0.32 : 1; };
  // ---- 왼쪽 위: 레벨·체력·경험치 ----
  fade(under(12, 324, 86));
  panel(ctx, 12, 10, 312, 76, { alpha: 0.92 });
  // 레벨 배지
  ctx.fillStyle = COL.ink; ctx.fillRect(22, 20, 52, 56);
  ctx.fillStyle = "#3a2a18"; ctx.fillRect(24, 22, 48, 52);
  ctx.fillStyle = COL.goldDeep; ctx.fillRect(26, 24, 44, 48);
  ctx.fillStyle = "#2a1c10"; ctx.fillRect(28, 26, 40, 44);
  text(ctx, "Lv", 48, 28, { font: FONT.xs, color: COL.gold, align: "center" });
  text(ctx, String(p.level), 48, 42, { font: FONT.h, color: "#fff2c8", align: "center" });
  const hpK = p.hp / p.maxHp;
  s._ghostHp = s._ghostHp == null ? hpK : s._ghostHp + (hpK - s._ghostHp) * Math.min(1, 0.04 + (s._ghostHp > hpK ? 0.02 : 1));
  bar(ctx, 84, 22, 228, 22, hpK, hpK < 0.3 && Math.sin(t * 10) > 0 ? "#ff2a3a" : "#d8283a", "#ff7a7a", { ghost: s._ghostHp });
  text(ctx, `${Math.ceil(p.hp)} / ${p.maxHp}`, 198, 25, { font: FONT.xs, align: "center" });
  bar(ctx, 84, 48, 228, 12, p.xp / p.xpToNext, "#1a9ab8", "#7ef0ff");
  const job = p.job ? JOBS[p.job] : null;
  text(ctx, job ? `${job.name}` : "견습 마법사", 84, 64, { font: FONT.xs, color: job ? COL.gold : COL.muted });
  if (job) text(ctx, TIER_LABEL[job.tier], 312, 64, { font: FONT.xs, color: COL.faint, align: "right" });

  // ---- 가운데 위: 스테이지·웨이브 진행 ----
  const info = waveInfo(s.gw);
  const st = STAGES[info.stageIndex];
  const label = s.endless ? `무한 모드 · 웨이브 ${s.gw}` : `${st.sub} · ${st.name}`;
  const lw = Math.max(260, measure(ctx, label, FONT.s) + 40);
  fade(under(480 - lw / 2, 480 + lw / 2, 70));
  panel(ctx, 480 - lw / 2, 10, lw, 60, { alpha: 0.92 });
  text(ctx, label, 480, 18, { font: FONT.s, align: "center", color: COL.text });
  // 웨이브 칸 10개 (마지막은 보스)
  const pipW = 18, gap = 4, total = 10 * pipW + 9 * gap, x0 = 480 - total / 2;
  for (let i = 1; i <= 10; i++) {
    const x = x0 + (i - 1) * (pipW + gap), y = 44;
    const done = i < info.local || (i === info.local && (s.mode === "intermission" || s.mode === "stageclear"));
    const cur = i === info.local && !done;
    ctx.fillStyle = COL.ink; ctx.fillRect(x, y, pipW, 14);
    if (i === 10) {
      ctx.fillStyle = done ? COL.gold : cur ? (Math.sin(t * 8) > 0 ? "#ff3a3a" : "#8a1a24") : "#4a1a24";
      ctx.fillRect(x + 2, y + 2, pipW - 4, 10);
      ctx.fillStyle = COL.ink; ctx.fillRect(x + 6, y + 4, 2, 2); ctx.fillRect(x + 10, y + 4, 2, 2); ctx.fillRect(x + 6, y + 8, 6, 2);
    } else {
      ctx.fillStyle = done ? COL.fire : cur ? (Math.sin(t * 8) > 0 ? "#ffcf5a" : "#a8742a") : "#3a2f48";
      ctx.fillRect(x + 2, y + 2, pipW - 4, 10);
    }
  }

  // ---- 오른쪽 위: 처치·시간 ----
  fade(under(752, 948, 70));
  panel(ctx, 948 - 196, 10, 196, 60, { alpha: 0.92 });
  text(ctx, "처치", 948 - 180, 18, { font: FONT.xs, color: COL.muted });
  text(ctx, String(s.kills), 948 - 180, 36, { font: FONT.h });
  text(ctx, "시간", 948 - 20, 18, { font: FONT.xs, color: COL.muted, align: "right" });
  text(ctx, fmtTime(s.time), 948 - 20, 36, { font: FONT.h, align: "right" });

  ctx.globalAlpha = 1;
  // ---- 보스 체력 ----
  const boss = s.boss;
  if (boss && !boss.dead) {
    const bw = 520, bx = 480 - bw / 2, by = 548;
    panel(ctx, bx - 12, by - 34, bw + 24, 72, { alpha: 0.94, glow: boss.phase === 2 ? "#ff3a5a" : null });
    text(ctx, boss.name, bx, by - 26, { font: FONT.h, color: "#ffd0d0" });
    text(ctx, boss.title, bx + bw, by - 22, { font: FONT.xs, color: COL.muted, align: "right" });
    bar(ctx, bx, by + 2, bw, 22, boss.hp / boss.maxHp, boss.phase === 2 ? "#c8102e" : "#a8142a", "#ff6a6a", { ticks: [0.5] });
  }

  // ---- 레벨업 알림 ----
  if (s.levelToast > 0 && s.mode !== "jobselect") {
    const a = Math.min(1, s.levelToast / 0.3);
    text(ctx, `LEVEL UP · Lv ${p.level}`, 480, 84, { font: FONT.h, color: COL.cyan, align: "center", alpha: a });
    text(ctx, "체력 +8   공격력 +2", 480, 112, { font: FONT.xs, color: COL.muted, align: "center", alpha: a });
  }

  // ---- 큰 안내 문구 ----
  drawBanner(ctx, s);

  if (G.bot) {
    panel(ctx, 480 - 70, 552 - (boss ? 90 : 0), 140, 32, { fill: "#163a22", line: "#2a7a44", alpha: 0.9 });
    text(ctx, "자동 플레이", 480, 559 - (boss ? 90 : 0), { font: FONT.xs, align: "center", color: COL.green });
  }
  if (s.mode === "jobselect") drawJobSelect(ctx, s);
  if (s.mode === "paused") drawPause(ctx, s);
}

function drawBanner(ctx, s) {
  const b = s.banner;
  if (!b) return;
  const u = b.t / b.max;
  const a = u < 0.12 ? u / 0.12 : u > 0.8 ? (1 - u) / 0.2 : 1;
  const color = b.color === "gold" ? COL.gold : b.color === "red" ? "#ff5a6a" : COL.text;
  if (b.boss) {
    // 보스 등장: 위아래 검은 띠
    const h = Math.round(60 * Math.min(1, a * 1.5) / 2) * 2;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 960, h); ctx.fillRect(0, 600 - h, 960, h);
    text(ctx, "BOSS", 480, 210, { font: FONT.h, color: "#ff4a5a", align: "center", alpha: a });
    text(ctx, b.text, 480, 244, { font: FONT.title, color: "#fff0f0", align: "center", alpha: a, outline: "#2a0610" });
    text(ctx, b.sub, 480, 306, { font: FONT.m, color: COL.muted, align: "center", alpha: a });
    return;
  }
  const slide = (1 - Math.min(1, u / 0.12)) * 30;
  text(ctx, b.text, 480 - slide, 236, { font: b.small ? FONT.big : FONT.title, color, align: "center", alpha: a, outline: "#140a0a" });
  if (b.sub) text(ctx, b.sub, 480 + slide, b.small ? 284 : 300, { font: FONT.m, color: COL.muted, align: "center", alpha: a });
}

// ---------- 전직 선택 ----------

export function jobLook(id) {
  const j = JOBS[id];
  return { color: j.color, tier: j.tier, branch: branchOf(id), fx: computeFx(id) };
}

function drawJobSelect(ctx, s) {
  const t = G.time;
  const appear = Math.min(1, (s.jobSelectT || 0) / 0.25);
  dim(ctx, 0.72 * appear);
  const tier = s.player.tier + 1;
  text(ctx, `${TIER_LABEL[tier]}`, 480, 64, { font: FONT.big, color: COL.gold, align: "center", alpha: appear, outline: "#2a1606" });
  text(ctx, "새로운 힘을 골라라 — 공격 방식이 바뀐다", 480, 112, { font: FONT.s, color: COL.muted, align: "center", alpha: appear });
  const n = s.jobChoices.length, cw = 264, ch = 330, gap = 24;
  const x0 = 480 - (n * cw + (n - 1) * gap) / 2, y0 = 150;
  s.jobChoices.forEach((id, i) => {
    const j = JOBS[id], sel = i === s.jobCursor;
    const x = x0 + i * (cw + gap), y = y0 + (sel ? -8 : 0) + (1 - appear) * 40;
    const fx = computeFx(id);
    panel(ctx, x, y, cw, ch, { fill: sel ? "#251a30" : COL.panel, line: sel ? fx.main : COL.line, glow: sel ? fx.glow : null });
    // 마법사 미리보기
    const spr = wizardSprites(jobLook(id)).idle[Math.floor(t * 1.6) % 2];
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x + cw / 2 - 40, y + 126, 80, 8);
    const g = ctx.createRadialGradient(x + cw / 2, y + 90, 4, x + cw / 2, y + 90, 70);
    g.addColorStop(0, hexA(fx.glow, sel ? 0.35 : 0.18)); g.addColorStop(1, hexA(fx.glow, 0));
    ctx.fillStyle = g; ctx.fillRect(x + 20, y + 20, cw - 40, 130);
    drawSprite(ctx, spr, x + cw / 2 - spr.w * 2.5, y + 22, 5);
    text(ctx, j.name, x + cw / 2, y + 154, { font: FONT.h, align: "center", color: sel ? "#fff2d8" : COL.text });
    // 태그
    const tw = measure(ctx, j.tag, FONT.xs) + 20;
    ctx.fillStyle = fx.deep; ctx.fillRect(Math.round((x + cw / 2 - tw / 2) / 2) * 2, y + 188, Math.round(tw / 2) * 2, 24);
    text(ctx, j.tag, x + cw / 2, y + 192, { font: FONT.xs, align: "center", color: "#fff", shadow: false });
    text(ctx, j.desc, x + cw / 2, y + 226, { font: FONT.s, align: "center", color: COL.text });
    // 다음 갈래 미리보기
    if (j.children && j.children.length) {
      text(ctx, "다음 전직", x + cw / 2, y + 254, { font: FONT.xs, align: "center", color: COL.faint });
      j.children.forEach((c, k) => text(ctx, JOBS[c].name, x + cw / 2, y + 272 + k * 18, { font: FONT.xs, align: "center", color: COL.muted }));
    }
    text(ctx, String(i + 1), x + 18, y + 14, { font: FONT.h, color: sel ? COL.gold : COL.faint });
    hitArea(x, y, cw, ch, () => G.actions.chooseJob(i), () => { s.jobCursor = i; });
  });
  text(ctx, "←→ 고르기 · Enter 결정 · 숫자 1/2/3 · 클릭", 480, 510, { font: FONT.s, color: COL.faint, align: "center", alpha: appear });
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------- 일시정지 ----------

export const PAUSE_ITEMS = ["계속하기", "설정", "포기하고 나가기"];

function drawPause(ctx, s) {
  dim(ctx, 0.65);
  panel(ctx, 330, 170, 300, 260, { glow: "#5a4a6e" });
  text(ctx, "일시정지", 480, 194, { font: FONT.big, color: COL.gold, align: "center" });
  PAUSE_ITEMS.forEach((label, i) => {
    const y = 262 + i * 52, sel = i === s.pauseCursor;
    if (sel) { ctx.fillStyle = "#2a1f36"; ctx.fillRect(350, y - 8, 260, 40); flameCursor(ctx, 366, y, G.time); }
    text(ctx, label, 480, y, { font: FONT.m, color: sel ? "#fff2d8" : COL.muted, align: "center" });
    hitArea(350, y - 8, 260, 40, () => G.actions.pauseSelect(i), () => { s.pauseCursor = i; });
  });
}
