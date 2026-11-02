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

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const d = DEFAULT();
    data = parsed ? { ...d, ...parsed, records: { ...d.records, ...(parsed.records || {}) }, settings: { ...d.settings, ...(parsed.settings || {}) } } : d;
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
