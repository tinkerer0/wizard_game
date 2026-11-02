// 브라우저 저장소(localStorage)에 기록·영구 성장·설정을 남긴다. 저장이 막힌 환경에서도 게임은 돈다.

const KEY = "wizard_game.save.v1";

const DEFAULT = () => ({
  crystals: 0,
  upgrades: {},                 // id → 단계
  seenJobs: [],                 // 한 번이라도 전직한 직업 id
  records: { bestWave: 0, bestTime: 0, victories: 0, runs: 0, totalKills: 0, fastestVictory: 0, bestEndless: 0 },
  history: [],                  // 최근 판 10개 요약
  settings: { sfx: 0.7, music: 0.5, shake: true, damageNumbers: true },
});

let data = null;

const num = (v, lo, hi, def) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

/** 저장 내용을 기본 형식에 맞춰 정리 (손상·조작된 값은 기본값으로) */
function sanitize(p) {
  const d = DEFAULT();
  if (!isObj(p)) return d;
  d.crystals = Math.floor(num(p.crystals, 0, 1e9, 0));
  if (isObj(p.upgrades)) for (const [k, v] of Object.entries(p.upgrades)) { const lv = Math.floor(num(v, 0, 10, 0)); if (lv > 0) d.upgrades[k] = lv; }
  if (Array.isArray(p.seenJobs)) d.seenJobs = [...new Set(p.seenJobs.filter((x) => typeof x === "string"))];
  if (isObj(p.records)) for (const k of Object.keys(d.records)) d.records[k] = num(p.records[k], 0, 1e9, 0);
  if (Array.isArray(p.history)) d.history = p.history.filter(isObj).slice(0, 10);
  if (isObj(p.settings)) {
    d.settings.sfx = num(p.settings.sfx, 0, 1, d.settings.sfx);
    d.settings.music = num(p.settings.music, 0, 1, d.settings.music);
    if (typeof p.settings.shake === "boolean") d.settings.shake = p.settings.shake;
    if (typeof p.settings.damageNumbers === "boolean") d.settings.damageNumbers = p.settings.damageNumbers;
  }
  return d;
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    data = sanitize(raw ? JSON.parse(raw) : null);
  } catch {
    data = DEFAULT();
  }
  return data;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 저장 불가 환경: 무시 */ }
}

export function getSave() { return data || loadSave(); }

export function resetSave() {
  data = DEFAULT();
  save();
  return data;
}
