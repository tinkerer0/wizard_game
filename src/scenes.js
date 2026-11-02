// 메뉴 화면들: 타이틀 · 영구 성장 · 도감·기록 · 설정 · 결과. 각 화면은 draw(ctx)와 key(code)를 가진다.

import { G } from "./game/state.js";
import { JOBS, TIER1_CHOICES, FIRE_TIER, computeFx } from "./data/jobs.js";
import { STAGES } from "./data/stages.js";
import { UPGRADES } from "./data/upgrades.js";
import { getSave, save, resetSave } from "./save.js";
import { fmtTime } from "./util.js";
import { VERSION } from "./config.js";
import { wizardSprites } from "./render/sprites.js";
import { jobLook } from "./render/hud.js";
import { FONT, COL, text, measure, panel, bar, dim, flameCursor, drawSprite, hitArea } from "./render/uikit.js";

const ui = { cursor: 0, confirmReset: 0 };
export function resetCursor() { ui.cursor = 0; ui.confirmReset = 0; }

function menuList(ctx, items, x, y, w, opts = {}) {
  const step = opts.step || 50;
  clampCursor(items.length);
  items.forEach((it, i) => {
    const yy = y + i * step, sel = i === ui.cursor;
    if (sel) { ctx.fillStyle = "rgba(42,31,54,0.9)"; ctx.fillRect(x - w / 2, yy - 8, w, 40); flameCursor(ctx, x - w / 2 + 16, yy, G.time); }
    text(ctx, it.label, x, yy, { font: FONT.m, color: it.disabled ? COL.faint : sel ? "#fff2d8" : COL.muted, align: "center" });
    if (it.right) text(ctx, it.right, x + w / 2 - 16, yy + 2, { font: FONT.s, color: sel ? COL.gold : COL.faint, align: "right" });
    hitArea(x - w / 2, yy - 8, w, 40, () => { ui.cursor = i; it.go && it.go(); }, () => { ui.cursor = i; });
  });
}

function clampCursor(n) { if (ui.cursor >= n || ui.cursor < 0) ui.cursor = 0; }

function moveCursor(code, n) {
  clampCursor(n);
  if (code === "ArrowUp" || code === "KeyW") { ui.cursor = (ui.cursor - 1 + n) % n; G.actions.sfx("uiMove"); return true; }
  if (code === "ArrowDown" || code === "KeyS") { ui.cursor = (ui.cursor + 1) % n; G.actions.sfx("uiMove"); return true; }
  return false;
}
const isOk = (c) => c === "Enter" || c === "Space" || c === "NumpadEnter";
const isBack = (c) => c === "Escape" || c === "Backspace";

// ---------- 타이틀 ----------

function titleItems() {
  return [
    { label: "시작하기", go: () => G.actions.startRun() },
    { label: "영구 성장", go: () => G.actions.goto("upgrades") },
    { label: "도감 · 기록", go: () => G.actions.goto("codex") },
    { label: "설정", go: () => G.actions.goto("settings") },
  ];
}

const TITLE_LOOKS = ["crimsonBlade", "hellBombardier", "phoenixTamer"];

export const title = {
  /** 픽셀 화면(480×300) 위: 마법사 자리의 불빛과 떠오르는 불티 */
  world(p, f) {
    const id = TITLE_LOOKS[Math.floor(G.time / 3.2) % TITLE_LOOKS.length];
    const fx = computeFx(id);
    p.glow(240, 150, 90, G.actions.hex(fx.glow), 0.4);
    p.glow(240, 166, 30, G.actions.hex(fx.hi), 0.25);
    if (Math.random() < 0.5) G.actions.ember(240 + (Math.random() - 0.5) * 70, 170, fx.spark);
  },
  draw(ctx) {
    dim(ctx, 0.2);
    const t = G.time;
    const bob = Math.round(Math.sin(t * 1.4) * 2) * 2;
    text(ctx, "마법사 키우기", 480, 44 + bob, { font: "72px Galmuri11Bold", color: "#ffcf5a", align: "center", outline: "#3a1206" });
    text(ctx, "세 개의 던전 · 서른 번의 웨이브 · 서른아홉 갈래의 전직", 480, 134, { font: FONT.s, color: COL.muted, align: "center" });
    // 가운데 마법사 (3차 전직 모습이 번갈아)
    const id = TITLE_LOOKS[Math.floor(t / 3.2) % TITLE_LOOKS.length];
    const spr = wizardSprites(jobLook(id)).idle[Math.floor(t * 1.6) % 2];
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(440, 340, 80, 8);
    drawSprite(ctx, spr, 480 - spr.w * 2.5, 344 - spr.h * 5, 5);
    text(ctx, JOBS[id].name, 480, 352, { font: FONT.xs, color: COL.faint, align: "center" });
    const items = titleItems();
    panel(ctx, 330, 386, 300, items.length * 44 + 20, { alpha: 0.92 });
    menuList(ctx, items, 480, 402, 280, { step: 44 });
    const r = getSave().records;
    const rec = r.runs ? `최고 웨이브 ${r.bestWave} · 클리어 ${r.victories}회 · 불씨 결정 ${getSave().crystals}` : "방향키·WASD 이동 · 공격은 자동";
    text(ctx, rec, 24, 568, { font: FONT.xs, color: COL.faint });
    text(ctx, `v${VERSION}`, 936, 568, { font: FONT.xs, color: COL.faint, align: "right" });
  },
  key(code) {
    const items = titleItems();
    if (moveCursor(code, items.length)) return;
    if (isOk(code)) { G.actions.sfx("uiSelect"); items[ui.cursor].go(); }
  },
};

// ---------- 영구 성장 ----------

export const upgrades = {
  draw(ctx) {
    dim(ctx, 0.6);
    const sv = getSave();
    text(ctx, "영구 성장", 480, 40, { font: FONT.big, color: COL.gold, align: "center", outline: "#2a1606" });
    text(ctx, "판이 끝날 때 받은 불씨 결정으로 기본 능력을 올린다", 480, 88, { font: FONT.s, color: COL.muted, align: "center" });
    panel(ctx, 700, 30, 230, 52);
    text(ctx, `불씨 결정 ${sv.crystals}`, 916, 44, { font: FONT.m, color: COL.gold, align: "right" });
    ctx.fillStyle = "#ff8a2e"; ctx.fillRect(716, 48, 12, 12); ctx.fillStyle = "#ffe27a"; ctx.fillRect(718, 50, 6, 6);
    panel(ctx, 140, 124, 680, 380);
    UPGRADES.forEach((u, i) => {
      const y = 146 + i * 66, sel = i === ui.cursor;
      const lv = sv.upgrades[u.id] || 0, max = lv >= u.max, cost = max ? 0 : u.cost[lv];
      if (sel) { ctx.fillStyle = "#251a30"; ctx.fillRect(152, y - 6, 656, 60); flameCursor(ctx, 164, y + 14, G.time); }
      text(ctx, u.name, 190, y, { font: FONT.h, color: sel ? "#fff2d8" : COL.text });
      text(ctx, u.desc, 190, y + 30, { font: FONT.xs, color: COL.muted });
      for (let k = 0; k < u.max; k++) {
        ctx.fillStyle = COL.ink; ctx.fillRect(470 + k * 30, y + 8, 24, 24);
        ctx.fillStyle = k < lv ? COL.fire : "#2a2032"; ctx.fillRect(472 + k * 30, y + 10, 20, 20);
        if (k < lv) { ctx.fillStyle = "#ffcf5a"; ctx.fillRect(474 + k * 30, y + 12, 16, 6); }
      }
      text(ctx, max ? "최대" : `${cost} 결정`, 790, y + 10, { font: FONT.m, color: max ? COL.green : sv.crystals >= cost ? COL.gold : COL.red, align: "right" });
      hitArea(152, y - 6, 656, 60, () => { ui.cursor = i; buy(i); }, () => { ui.cursor = i; });
    });
    menuBack(ctx, 540);
  },
  key(code) {
    if (moveCursor(code, UPGRADES.length)) return;
    if (isOk(code)) buy(ui.cursor);
    if (isBack(code)) G.actions.goto("title");
  },
};

function buy(i) {
  const sv = getSave(), u = UPGRADES[i];
  const lv = sv.upgrades[u.id] || 0;
  if (lv >= u.max) { G.actions.sfx("error"); return; }
  const cost = u.cost[lv];
  if (sv.crystals < cost) { G.actions.sfx("error"); return; }
  sv.crystals -= cost;
  sv.upgrades[u.id] = lv + 1;
  save();
  G.actions.sfx("buy");
}

function menuBack(ctx, y) {
  text(ctx, "Esc · 돌아가기", 480, y, { font: FONT.s, color: COL.faint, align: "center" });
  hitArea(380, y - 8, 200, 40, () => G.actions.goto("title"));
}

// ---------- 도감 · 기록 ----------

export const codex = {
  draw(ctx) {
    dim(ctx, 0.7);
    const sv = getSave(), r = sv.records, seen = new Set(sv.seenJobs);
    text(ctx, "도감 · 기록", 480, 24, { font: FONT.big, color: COL.gold, align: "center", outline: "#2a1606" });
    // 기록
    panel(ctx, 24, 80, 250, 440);
    text(ctx, "기록", 44, 96, { font: FONT.h, color: COL.text });
    const rows = [
      ["플레이", `${r.runs}판`], ["클리어", `${r.victories}회`], ["최고 웨이브", `${r.bestWave}`],
      ["최장 생존", fmtTime(r.bestTime)], ["최단 클리어", r.fastestVictory ? fmtTime(r.fastestVictory) : "-"],
      ["무한 최고", r.bestEndless ? `웨이브 ${r.bestEndless}` : "-"], ["누적 처치", `${r.totalKills}`],
    ];
    rows.forEach(([k, v], i) => {
      text(ctx, k, 44, 136 + i * 34, { font: FONT.s, color: COL.muted });
      text(ctx, v, 256, 136 + i * 34, { font: FONT.s, color: COL.text, align: "right" });
    });
    text(ctx, "최근 판", 44, 390, { font: FONT.s, color: COL.text });
    sv.history.slice(0, 4).forEach((h, i) => {
      const j = h.job ? JOBS[h.job] : null;
      text(ctx, `${h.victory ? "★" : "·"} W${h.gw} ${j ? j.name : "견습"}`, 44, 418 + i * 24, { font: FONT.xs, color: h.victory ? COL.gold : COL.muted });
    });
    // 전직 도감
    panel(ctx, 290, 80, 646, 440);
    text(ctx, `전직 도감  ${sv.seenJobs.length} / ${Object.keys(JOBS).length}`, 310, 96, { font: FONT.h, color: COL.text });
    TIER1_CHOICES.forEach((id1, c) => {
      const x = 306 + c * 210, j1 = JOBS[id1];
      drawJobName(ctx, id1, x, 136, seen, FONT.m);
      j1.children.forEach((id2, k) => {
        const y = 176 + k * 112;
        drawJobName(ctx, id2, x + 8, y, seen, FONT.s);
        JOBS[id2].children.forEach((id3, m) => drawJobName(ctx, id3, x + 20, y + 28 + m * 24, seen, FONT.xs));
      });
    });
    menuBack(ctx, 540);
  },
  key(code) { if (isBack(code) || isOk(code)) G.actions.goto("title"); },
};

function drawJobName(ctx, id, x, y, seen, font) {
  const j = JOBS[id], ok = seen.has(id);
  const fx = computeFx(id);
  ctx.fillStyle = ok ? fx.main : "#3a2f48";
  ctx.fillRect(Math.round(x / 2) * 2, Math.round((y + 6) / 2) * 2, 8, 8);
  text(ctx, ok ? j.name : "???", x + 14, y, { font, color: ok ? COL.text : COL.faint });
}

// ---------- 설정 ----------

function settingItems() {
  const st = G.settings;
  const vol = (v) => "■".repeat(Math.round(v * 5)) + "□".repeat(5 - Math.round(v * 5));
  return [
    { label: "효과음", right: vol(st.sfx), adj: (d) => { st.sfx = Math.max(0, Math.min(1, Math.round((st.sfx + d * 0.2) * 5) / 5)); } },
    { label: "음악", right: vol(st.music), adj: (d) => { st.music = Math.max(0, Math.min(1, Math.round((st.music + d * 0.2) * 5) / 5)); } },
    { label: "화면 흔들림", right: st.shake ? "켜짐" : "꺼짐", adj: () => { st.shake = !st.shake; } },
    { label: "피해 숫자", right: st.damageNumbers ? "켜짐" : "꺼짐", adj: () => { st.damageNumbers = !st.damageNumbers; } },
    { label: ui.confirmReset ? "정말 지울까? 한 번 더" : "기록 초기화", right: "", go: () => { if (ui.confirmReset) { resetSave(); G.settings = getSave().settings; ui.confirmReset = 0; G.actions.applySettings(); } else ui.confirmReset = 1; } },
    { label: "돌아가기", go: () => G.actions.back() },
  ];
}

export const settings = {
  draw(ctx) {
    dim(ctx, 0.7);
    text(ctx, "설정", 480, 60, { font: FONT.big, color: COL.gold, align: "center", outline: "#2a1606" });
    panel(ctx, 250, 130, 460, 360);
    const items = settingItems();
    items.forEach((it) => { const go = it.go; it.go = go || (() => { it.adj(1); G.actions.applySettings(); }); });
    menuList(ctx, items, 480, 156, 420, { step: 54 });
    text(ctx, "←→ 바꾸기 · Esc 돌아가기", 480, 520, { font: FONT.s, color: COL.faint, align: "center" });
  },
  key(code) {
    const items = settingItems();
    if (moveCursor(code, items.length)) return;
    const it = items[ui.cursor];
    if ((code === "ArrowLeft" || code === "KeyA") && it.adj) { it.adj(-1); G.actions.applySettings(); G.actions.sfx("uiMove"); }
    if ((code === "ArrowRight" || code === "KeyD") && it.adj) { it.adj(1); G.actions.applySettings(); G.actions.sfx("uiMove"); }
    if (isOk(code)) { if (it.go) it.go(); else if (it.adj) { it.adj(1); G.actions.applySettings(); } G.actions.sfx("uiSelect"); }
    if (isBack(code)) G.actions.back();
  },
};

// ---------- 결과 ----------

function resultItems() {
  const s = G.s;
  const items = [{ label: "다시 하기", go: () => G.actions.startRun() }];
  if (s.ended === "victory" && !s.endless) items.push({ label: "무한 모드로 계속", go: () => G.actions.continueEndless() });
  items.push({ label: "타이틀로", go: () => G.actions.goto("title") });
  return items;
}

export const results = {
  draw(ctx) {
    const s = G.s, sv = getSave();
    const win = s.ended === "victory";
    dim(ctx, 0.72);
    const t = G.time;
    text(ctx, win ? "클리어!" : "쓰러졌다…", 480, 40, { font: "64px Galmuri11Bold", color: win ? COL.gold : "#ff6a7a", align: "center", outline: win ? "#3a2006" : "#2a0610" });
    const st = STAGES[s.stageIndex];
    text(ctx, s.endless ? `무한 모드 웨이브 ${s.gw}까지` : `${st.sub} ${st.name} · 웨이브 ${((s.gw - 1) % 10) + 1}/10`, 480, 120, { font: FONT.m, color: COL.muted, align: "center" });
    panel(ctx, 160, 164, 640, 250);
    const cells = [["생존 시간", fmtTime(s.time)], ["처치", String(s.kills)], ["레벨", String(s.player.level)], ["보스 처치", String(s.bossKills)]];
    cells.forEach(([k, v], i) => {
      const x = 220 + i * 150;
      text(ctx, k, x, 184, { font: FONT.xs, color: COL.muted, align: "center" });
      text(ctx, v, x, 206, { font: FONT.big, color: COL.text, align: "center" });
    });
    // 전직 경로
    text(ctx, "전직 경로", 184, 262, { font: FONT.xs, color: COL.muted });
    let x = 184;
    const path = s.jobPath.length ? s.jobPath : [null];
    path.forEach((id, i) => {
      const name = id ? JOBS[id].name : "견습 마법사";
      const w = measure(ctx, name, FONT.s) + 24;
      const fx = id ? computeFx(id) : { deep: "#3a2f48" };
      ctx.fillStyle = fx.deep; ctx.fillRect(Math.round(x / 2) * 2, 286, Math.round(w / 2) * 2, 32);
      text(ctx, name, x + 12, 292, { font: FONT.s, color: "#fff", shadow: false });
      x += w + 8;
      if (i < path.length - 1) { text(ctx, "›", x - 2, 290, { font: FONT.m, color: COL.faint }); x += 16; }
    });
    // 보상
    const shown = Math.min(s.reward, Math.floor((s.resultT || 0) * Math.max(40, s.reward * 1.2)));
    text(ctx, `불씨 결정 +${shown}`, 184, 342, { font: FONT.h, color: COL.gold });
    text(ctx, `보유 ${sv.crystals}`, 776, 346, { font: FONT.s, color: COL.muted, align: "right" });
    if (s.newRecord) text(ctx, "신기록!", 776, 186 - 40, { font: FONT.h, color: Math.sin(t * 8) > 0 ? COL.gold : "#fff2d8", align: "right" });
    panel(ctx, 330, 432, 300, resultItems().length * 46 + 20, { alpha: 0.95 });
    menuList(ctx, resultItems(), 480, 448, 280, { step: 46 });
  },
  key(code) {
    const items = resultItems();
    if (moveCursor(code, items.length)) return;
    if (isOk(code)) { G.actions.sfx("uiSelect"); items[ui.cursor].go(); }
  },
};

export const SCENES = { title, upgrades, codex, settings, results };
export { ui };
