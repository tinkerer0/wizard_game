// 적 종류와 보스. 수치는 "전체 웨이브 번호(gw)" 기준 기본값에 곱하는 배율이다.
// 기본값(이전 버전과 같음): 체력 18+6·gw, 속도 55+3·gw, 접촉 피해 8+2·floor(gw/4), 반지름 13.

export const ENEMY_TYPES = {
  // 곧장 다가오는 기본 몬스터
  slime:    { name: "슬라임",   ai: "chase",  hpK: 1.0,  spdK: 1.0,  dmgK: 1.0, r: 13, xp: 5 },
  // 빠르고 약하다, 좌우로 흔들리며 날아온다
  bat:      { name: "박쥐",     ai: "weave",  hpK: 0.55, spdK: 1.45, dmgK: 0.7, r: 10, xp: 4 },
  // 느리고 단단하다, 밀려나지 않는다
  brute:    { name: "중갑병",   ai: "chase",  hpK: 2.7,  spdK: 0.62, dmgK: 1.6, r: 17, xp: 12, heavy: true },
  // 거리를 두고 탄을 쏜다
  caster:   { name: "술사",     ai: "kite",   hpK: 0.8,  spdK: 0.85, dmgK: 0.9, r: 12, xp: 8, keep: 230, shootEvery: 2.6, shotSpeed: 175 },
  // 죽으면 작은 둘로 갈라진다
  splitter: { name: "젤리",     ai: "chase",  hpK: 1.7,  spdK: 0.78, dmgK: 1.0, r: 16, xp: 8, splitInto: "mini" },
  mini:     { name: "꼬마젤리", ai: "chase",  hpK: 0.42, spdK: 1.35, dmgK: 0.6, r: 9,  xp: 2 },
  // 멈췄다가 일직선으로 돌진한다
  charger:  { name: "돌격수",   ai: "charge", hpK: 1.4,  spdK: 0.9,  dmgK: 1.4, r: 14, xp: 9, dashSpeed: 540, dashTime: 0.42, windup: 0.65 },
};

// 정예: 아무 종류나 강화한 개체. 처치하면 회복 하트를 떨어뜨린다.
export const ELITE = { hpK: 4.2, rK: 1.35, dmgK: 1.4, xpK: 6 };

// 보스. hp는 스테이지 끝 무렵 플레이어 화력 기준(봇 시뮬로 맞춤).
export const BOSSES = {
  boneKing: {
    name: "해골왕 그림본", title: "지하묘지의 주인", r: 34, hp: 2400, speed: 62, dmg: 18, xp: 120,
    patterns: ["charge", "summon", "boneRing"],
  },
  frostWitch: {
    name: "서리마녀 일리스", title: "얼어붙은 동굴의 마녀", r: 30, hp: 6200, speed: 70, dmg: 22, xp: 260,
    patterns: ["shardFan", "frostNova", "shardSpiral"],
  },
  voidLord: {
    name: "공허군주 녹스", title: "성소를 삼킨 자", r: 38, hp: 14000, speed: 66, dmg: 28, xp: 0,
    patterns: ["voidOrbs", "blinkWave", "voidSpiral", "summonEyes"],
  },
};
