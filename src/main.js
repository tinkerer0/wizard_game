// 시작점: 폰트·저장 불러오기 → 화면 준비 → 입력 → 매 프레임(업데이트·그리기).

import { W, H } from "./config.js";
import { G } from "./game/state.js";
import { on, emit, bus } from "./events.js";
import { loadSave, getSave, save } from "./save.js";
import { startRun, updateRun, chooseJob, continueEndless, endRun } from "./game/run.js";
import { botControl, botPickJob, clearBotKeys, runSim, botChoice } from "./game/bot.js";
import { STAGES } from "./data/stages.js";
import { initWorld, renderWorld, updateWorldFx } from "./render/world.js";
import { resetVfx, sys } from "./render/vfx.js";
import { hex, P } from "../vendor/pixelfx/src/core/index.js";
import { blit } from "./render/spritekit.js";
import { drawHud, PAUSE_ITEMS } from "./render/hud.js";
import { loadFonts, hits } from "./render/uikit.js";
import { SCENES, resetCursor } from "./scenes.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let audio = null;

// ---------- 화면 크기: 정수 배율로 최대한 크게 ----------
function fit() {
  const k = Math.min(window.innerWidth / W, (window.innerHeight - 8) / H);
  const scale = k >= 1 ? Math.max(1, Math.floor(k * 2) / 2) : k;
  canvas.style.width = `${Math.floor(W * scale)}px`;
  canvas.style.height = `${Math.floor(H * scale)}px`;
}
window.addEventListener("resize", fit);

// ---------- 동작 모음 (화면에서 부른다) ----------
let prevScene = "title";
G.actions = {
  startRun(opts) { resetVfx(); resetCursor(); startRun(opts || {}); emit("scene", { scene: "play" }); },
  goto(scene) { if (scene === "settings") prevScene = G.scene; G.scene = scene; resetCursor(); emit("scene", { scene }); },
  back() { resetCursor(); if (prevScene === "play" && G.s && G.s.mode === "paused") { G.scene = "play"; } else G.actions.goto("title"); },
  chooseJob(i) { chooseJob(i); },
  continueEndless() { resetCursor(); continueEndless(); emit("scene", { scene: "play" }); },
  pauseSelect(i) {
    const s = G.s;
    if (i === 0) { s.mode = s.prevMode || "playing"; }
    else if (i === 1) { prevScene = "play"; G.scene = "settings"; resetCursor(); }
    else { s.mode = s.prevMode || "playing"; endRun(false); }
    sfx("uiSelect");
  },
  sfx: (n) => sfx(n),
  pause() { if (G.s && (G.s.mode === "playing" || G.s.mode === "intermission")) pause(); },
  blit,
  hex,
  ember(x, y, c) { sys.ps.spawn(P.EMBER, x, y, (Math.random() - 0.5) * 16, -20 - Math.random() * 20, 1.2 + Math.random(), hex(c), 1 + Math.random()); },
  applySettings() { save(); if (audio) audio.setVolumes({ sfx: G.settings.sfx, music: G.settings.music }); },
};
function sfx(n) { if (audio && audio.sfx) audio.sfx(n); }

// ---------- 게임 사건 → 안내 문구 ----------
on("waveStart", (d) => {
  const s = G.s;
  if (d.stageChanged && d.gw > 1) s.fadeIn = 0.7;
  if (d.isBoss) return;
  const st = STAGES[d.stageIndex];
  if (d.stageChanged && !s.endless) s.banner = { text: st.name, sub: `${st.sub} — 웨이브 10개를 버티고 보스를 쓰러뜨려라`, t: 0, max: 2.6, color: "gold" };
  else s.banner = { text: s.endless ? `웨이브 ${d.gw}` : `웨이브 ${d.local}`, sub: s.endless ? "무한 모드" : st.name, t: 0, max: 1.6, small: true };
});
on("bossSpawn", (d) => { G.s.banner = { boss: true, text: d.boss.name, sub: d.boss.title, t: 0, max: 2.6 }; });
on("bossPhase", () => { G.s.banner = { text: "분노!", sub: "보스의 공격이 거세진다", t: 0, max: 1.6, color: "red", small: true }; });
on("runEnd", () => { resetVfx(); resetCursor(); });
on("waveClear", () => { if (!G.s.banner) G.s.banner = { text: "웨이브 클리어", sub: "", t: 0, max: 1.4, small: true, color: "gold" }; });

// ---------- 입력 ----------
const GAME_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"];
window.addEventListener("keydown", (e) => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  if (audio) audio.initAudio();
  if (e.repeat && !GAME_KEYS.includes(e.code)) return;
  G.keys.add(e.code);
  onKey(e.code, e.repeat);
});
window.addEventListener("keyup", (e) => G.keys.delete(e.code));
window.addEventListener("blur", () => { G.keys.clear(); if (G.scene === "play" && G.s && G.s.mode === "playing") pause(); });

function pause() { const s = G.s; s.prevMode = s.mode; s.mode = "paused"; s.pauseCursor = 0; }

function onKey(code, repeat) {
  if (code === "KeyB") { G.bot = !G.bot; if (!G.bot) clearBotKeys(); return; }
  if (G.scene === "play") {
    const s = G.s;
    if (repeat) return;
    if (s.mode === "jobselect") {
      if (code === "ArrowLeft" || code === "KeyA") { s.jobCursor = (s.jobCursor - 1 + s.jobChoices.length) % s.jobChoices.length; sfx("uiMove"); }
      else if (code === "ArrowRight" || code === "KeyD") { s.jobCursor = (s.jobCursor + 1) % s.jobChoices.length; sfx("uiMove"); }
      else if (code === "Enter" || code === "Space") chooseJob(s.jobCursor);
      else if (code.startsWith("Digit")) { const i = Number(code.slice(5)) - 1; if (i >= 0 && i < s.jobChoices.length) chooseJob(i); }
      return;
    }
    if (s.mode === "paused") {
      if (code === "ArrowUp" || code === "KeyW") { s.pauseCursor = (s.pauseCursor + PAUSE_ITEMS.length - 1) % PAUSE_ITEMS.length; sfx("uiMove"); }
      else if (code === "ArrowDown" || code === "KeyS") { s.pauseCursor = (s.pauseCursor + 1) % PAUSE_ITEMS.length; sfx("uiMove"); }
      else if (code === "Enter" || code === "Space") G.actions.pauseSelect(s.pauseCursor);
      else if (code === "Escape" || code === "KeyP") G.actions.pauseSelect(0);
      return;
    }
    if ((code === "Escape" || code === "KeyP") && (s.mode === "playing" || s.mode === "intermission" || s.mode === "stageclear")) { pause(); sfx("uiBack"); }
    return;
  }
  if (repeat && (code === "Enter" || code === "Space" || code === "NumpadEnter" || code === "Escape" || code === "Backspace")) return;
  const sc = SCENES[G.scene];
  if (sc) sc.key(code);
}

// 마우스·터치
function toLogical(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: (clientX - r.left) * (W / r.width), y: (clientY - r.top) * (H / r.height) };
}
function hitAt(x, y) {
  for (let i = hits.list.length - 1; i >= 0; i--) { const h = hits.list[i]; if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h; }
  return null;
}
canvas.addEventListener("mousemove", (e) => { const m = toLogical(e.clientX, e.clientY); const h = hitAt(m.x, m.y); if (h && h.onHover) h.onHover(); canvas.style.cursor = h ? "pointer" : "default"; });
canvas.addEventListener("mousedown", (e) => {
  if (audio) audio.initAudio();
  const m = toLogical(e.clientX, e.clientY); const h = hitAt(m.x, m.y);
  if (h && h.onClick) { h.onClick(); sfx("uiSelect"); }
});
// 터치: 화면 아무 곳이나 누르고 끌면 그 방향으로 이동 (가상 조이스틱)
G.touch = { active: false, ox: 0, oy: 0, dx: 0, dy: 0 };
canvas.addEventListener("touchstart", (e) => {
  if (audio) audio.initAudio();
  const t0 = e.changedTouches[0], m = toLogical(t0.clientX, t0.clientY);
  const h = hitAt(m.x, m.y);
  if (h && h.onClick) { h.onClick(); e.preventDefault(); return; }
  if (G.scene === "play") { G.touch = { active: true, ox: m.x, oy: m.y, dx: 0, dy: 0, id: t0.identifier }; e.preventDefault(); }
}, { passive: false });
canvas.addEventListener("touchmove", (e) => {
  for (const t of e.changedTouches) {
    if (!G.touch.active || t.identifier !== G.touch.id) continue;
    const m = toLogical(t.clientX, t.clientY), dx = m.x - G.touch.ox, dy = m.y - G.touch.oy, L = Math.hypot(dx, dy);
    if (L < 8) { G.touch.dx = 0; G.touch.dy = 0; } else { G.touch.dx = dx / L; G.touch.dy = dy / L; }
  }
  e.preventDefault();
}, { passive: false });
canvas.addEventListener("touchend", (e) => { for (const t of e.changedTouches) if (t.identifier === G.touch.id) G.touch.active = false; });

// ---------- 매 프레임 ----------
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  step(dt);
  draw();
  requestAnimationFrame(frame);
}

function step(dt) {
  G.time += dt;
  if (G.scene === "play") {
    const s = G.s;
    if (G.bot) {
      if (s.mode === "jobselect" && (s.jobSelectT || 0) > 0.6) botPickJob();
      else if (s.mode === "playing" || s.mode === "intermission" || s.mode === "stageclear" || s.mode === "victory") botControl();
    }
    if (s.mode === "jobselect") s.jobSelectT = (s.jobSelectT || 0) + dt;
    updateRun(dt);
    if (s.mode !== "paused" && s.mode !== "jobselect") updateWorldFx(dt);
  } else {
    if (G.scene === "results" && G.s) G.s.resultT = (G.s.resultT || 0) + dt;
    if (G.bot && G.scene === "results") { G.actions.startRun(); }
    if (G.bot && G.scene === "title") { G.actions.startRun(); }
    updateWorldFx(dt);
  }
}

function draw() {
  hits.list.length = 0;
  ctx.imageSmoothingEnabled = false;
  if (G.scene === "play" || (G.scene === "settings" && G.s && G.s.mode === "paused")) {
    renderWorld(ctx);
    drawHud(ctx);
    if (G.scene === "settings") { hits.list.length = 0; SCENES.settings.draw(ctx); }
    return;
  }
  if (G.scene === "results") {
    renderWorld(ctx);
    SCENES.results.draw(ctx);
    return;
  }
  // 메뉴 화면: 지하묘지 바닥 + 횃불 배경
  const saveS = G.s; G.s = null;
  renderWorld(ctx, { stageIndex: 0, menu: G.scene === "title" ? SCENES.title.world : null });
  G.s = saveS;
  SCENES[G.scene].draw(ctx);
}

// ---------- 시작 ----------
async function boot() {
  fit();
  loadSave();
  G.settings = getSave().settings;
  initWorld();
  ctx.fillStyle = "#0b0811"; ctx.fillRect(0, 0, W, H);
  await loadFonts("assets/fonts/");
  try {
    audio = await import("./audio.js");
    audio.setVolumes({ sfx: G.settings.sfx, music: G.settings.music });
  } catch (e) { console.warn("audio unavailable", e); audio = null; }
  const params = new URLSearchParams(location.search);
  if (params.get("previewJob")) G.actions.startRun({ previewJob: params.get("previewJob"), startWave: Number(params.get("wave")) || 1 });
  else if (params.get("wave")) G.actions.startRun({ startWave: Number(params.get("wave")) });
  else emit("scene", { scene: "title" });
  requestAnimationFrame(frame);
}

// 테스트·밸런스용 노출
window.G = G;
window.runSim = runSim;
window.botChoice = botChoice;
window.bus = bus;
window.__step = (dt, n = 1) => { for (let i = 0; i < n; i++) step(dt); draw(); };

boot();
