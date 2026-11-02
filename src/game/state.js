// 게임 전체 상태. G.s = 지금 판(런)의 상태, G.scene = 지금 화면.

import { W, H } from "../config.js";
import { FX } from "../data/jobs.js";

export const G = {
  scene: "title",          // title | play | results | upgrades | codex | settings
  s: null,                 // 판 상태 (play·results 화면에서 사용)
  keys: new Set(),
  bot: false,              // 자동 플레이(테스트용, B 키)
  time: 0,                 // 화면 시계 (메뉴 연출용)
};

export function makePlayer() {
  return {
    x: W / 2, y: H / 2, r: 14,
    maxHp: 100, hp: 100,
    speed: 200,
    level: 1, xp: 0, xpToNext: 6,
    damage: 12,
    damageMul: 1,             // 영구 성장 '화력'
    xpMul: 1,                 // 영구 성장 '지혜'
    fireCooldown: 0.55,
    bulletSpeed: 460,
    bulletR: 7,
    attackRange: 210,
    pierce: 0,
    projectiles: 1,
    pickupRadius: 70,
    invuln: 0,
    color: "#ff7b2e",
    fx: FX.base,
    facing: 1,                // 1=오른쪽, -1=왼쪽 (그림용)
    moving: false,
    castT: 0,                 // 공격 직후 자세 유지 시간 (그림용)
    weapon: "fireball",
    job: null, tier: 0, accent: null,
    explodeRadius: 0,
    bulletShape: null,
    orbitAngle: 0, orbitCount: 0, orbitRadius: 0, orbitSpeed: 0, orbStyle: null,
    slashStyle: null,
    aura: null,
    slashExplode: 0,
    groundFire: null,
    orbShoot: null, orbShootTimer: 0,
    burnOnHit: null,
    burnSpread: 0,
    crimsonWave: null,
  };
}

export function makeRunState() {
  return {
    mode: "playing",         // playing | intermission | jobselect | paused | stageclear | dead | victory
    time: 0,                 // 실제 전투 시간(초)
    gw: 0,                   // 전체 웨이브 번호
    stageIndex: 0,
    kills: 0,
    bossKills: 0,
    endless: false,
    victory: false,
    player: makePlayer(),
    enemies: [],
    bullets: [],             // 플레이어 탄
    ebullets: [],            // 적 탄
    gems: [],
    pickups: [],             // 하트·상자
    hazards: [],
    afterimages: [],
    orbits: [],
    telegraphs: [],          // 보스 공격 예고 표시 { kind, x, y, r, t, max, ... }
    aim: { x: 1, y: 0 },
    fireTimer: 0,
    spawnQueue: 0,
    spawnTimer: 0,
    intermissionTimer: 0,
    stageClearTimer: 0,
    boss: null,
    jobChoices: [],
    jobCursor: 0,
    jobPath: [],
    shake: { t: 0, dur: 1, amp: 0 },
    banner: null,            // 화면 가운데 큰 글씨 { text, sub, t, max, color }
    levelToast: 0,
    pauseCursor: 0,
    resultCursor: 0,
    reward: 0,
    newRecord: false,
  };
}
