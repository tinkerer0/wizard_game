// 불마법사 전직 트리 데이터 (1→3→9→27). 원본: 이전 단일 파일 game.html (2026-06-10 밸런스 패스 기준).
// apply(p)는 현재 스탯에 누적된다(2차는 1차 위에, 3차는 2차 위에). 수치를 바꾸면 봇 시뮬로 밸런스를 다시 잴 것.


// ===== 전직 (1차) =====
// 단계별 색: 불 기준 1차 주황 → 2차 좀더 빨강 → 3차 많이 빨강. (이펙트도 단계 올라갈수록 화려/진하게)
export const FIRE_TIER = ["#ff8a2e", "#ff9020", "#f04a16", "#d20f12"]; // 0=기본 1=주황 2=좀더빨강 3=많이빨강(거의순빨강)

// ===== 직업별 이펙트 아이덴티티 =====
// 2차 갈래가 팔레트의 뿌리 — 같은 갈래의 3차는 정체성을 이어받아 더 화려하게 (일부는 전용 오버라이드).
// hi=가장 밝은 코어 / main=주색 / deep=짙은색 / glow=발광·테두리 / spark=타격 불티 / dark=어두운 보조색
export const FX = {
  base:          { hi: "#fff4d0", main: "#ff7b2e", deep: "#ff3a16", glow: "#ff8a3a", spark: "#ffb347", dark: "#3a1014" },
  // 검사 계열
  swordsman:     { hi: "#fff4d0", main: "#ff8a2e", deep: "#ff4a16", glow: "#ff8a3a", spark: "#ffb347", dark: "#3a1014" },
  bladeDancer:   { hi: "#fffbe8", main: "#ffd24a", deep: "#ff9d1f", glow: "#ffd86b", spark: "#ffe9a8", dark: "#4a3208" },  // 금백 섬광 검무
  lavaKnight:    { hi: "#ffd089", main: "#ff5a1f", deep: "#b71c0c", glow: "#ff3a16", spark: "#ff7b2e", dark: "#2b0d12" },  // 용암·흑요석
  burstCharger:  { hi: "#fff1c4", main: "#ff7b2e", deep: "#ff3214", glow: "#ff8a3a", spark: "#ffca62", dark: "#3a1408" },  // 폭발 주황
  // 화포 계열
  cannon:        { hi: "#fff4d0", main: "#ff8a2e", deep: "#ff4a16", glow: "#ff8a3a", spark: "#ffb347", dark: "#3a1014" },
  blastGunner:   { hi: "#fff4d0", main: "#ff7b2e", deep: "#e02810", glow: "#ff6a20", spark: "#ffb347", dark: "#54463e" },  // 굉음 대화구 + 연기
  piercer:       { hi: "#ffffff", main: "#ffe9a8", deep: "#ffb300", glow: "#fff3c8", spark: "#fff7d5", dark: "#5a4a14" },  // 백열 관통
  delayBomber:   { hi: "#ffd089", main: "#ff3a16", deep: "#8f0308", glow: "#ff2410", spark: "#ff6a3a", dark: "#241418" },  // 잿불 폭탄
  // 불씨 계열
  ember:         { hi: "#fff4d0", main: "#ff8a2e", deep: "#ff4a16", glow: "#ff8a3a", spark: "#ffb347", dark: "#3a1014" },
  ringWeaver:    { hi: "#fff8d8", main: "#ffd54a", deep: "#ff9d1f", glow: "#ffd86b", spark: "#ffe9a8", dark: "#4a3208" },  // 태양 금빛 고리
  flameSummoner: { hi: "#eaf9ff", main: "#7cc8ff", deep: "#2e7dff", glow: "#9ad9ff", spark: "#c8ecff", dark: "#0c2440" },  // 푸른 영혼불
  igniter:       { hi: "#ffc9a8", main: "#ff3214", deep: "#a8160e", glow: "#ff5a3a", spark: "#ff8a5a", dark: "#2e1612" },  // 심홍 잿불 화상
};
export function parentIdOf(id) { for (const k of Object.keys(JOBS)) if ((JOBS[k].children || []).includes(id)) return k; return null; }
export function computeFx(id) {
  const j = JOBS[id];
  if (!j) return FX.base;
  const rootId = j.tier === 3 ? parentIdOf(id) : id;
  const base = FX[rootId] || FX.base;
  return j.fx ? Object.assign({}, base, j.fx) : base;
}
// 전직 트리. apply()는 현재 스탯에 누적(2차는 1차 위에 얹힘). 색은 단계가 올라갈수록 빨갛게.
export const JOBS = {
  // ===== 1차 =====
  swordsman: { name: "불꽃검사", tag: "근접", weapon: "slash", tier: 1, color: FIRE_TIER[1], desc: "빠른 화염 베기",
    children: ["bladeDancer", "lavaKnight", "burstCharger"],
    apply(p) { p.weapon = "slash"; p.color = FIRE_TIER[1]; p.accent = "slash"; p.slashStyle = "single"; p.attackRange = 92; p.fireCooldown = 0.64; p.damage += 2; p.speed += 16; } },
  cannon: { name: "화포술사", tag: "원거리", weapon: "cannon", tier: 1, color: FIRE_TIER[1], desc: "강한 폭발 포격",
    children: ["blastGunner", "piercer", "delayBomber"],
    apply(p) { p.weapon = "cannon"; p.color = FIRE_TIER[1]; p.accent = "cannon"; p.attackRange = 340; p.fireCooldown = 0.9; p.damage = Math.round(p.damage * 2.1); p.bulletR = 13; p.bulletSpeed = 320; p.explodeRadius = 72; } },
  ember: { name: "불씨조율사", tag: "오브", weapon: "orbit", tier: 1, color: FIRE_TIER[1], desc: "회전하는 불씨",
    children: ["ringWeaver", "flameSummoner", "igniter"],
    apply(p) { p.weapon = "orbit"; p.color = FIRE_TIER[1]; p.accent = "orbit"; p.orbStyle = "ember"; p.orbitCount = 4; p.orbitRadius = 92; p.orbitSpeed = 4.0; p.fireCooldown = 0.27; p.damage += 3; } },

  // ===== 2차 — 불꽃검사 갈래 =====
  bladeDancer: { name: "화염검무사", tag: "연타", weapon: "slash", tier: 2, color: FIRE_TIER[2], desc: "초고속 연속 베기",
    children: ["crimsonBlade", "flameFlurry", "twinHeatBlades"], apply(p) { p.color = FIRE_TIER[2]; p.slashStyle = "flurry"; p.fireCooldown *= 0.7; p.damage += 2; p.speed += 12; } },
  lavaKnight: { name: "용암중갑검사", tag: "탱커", weapon: "slash", tier: 2, color: FIRE_TIER[2], desc: "주변 용암 + 단단함",
    children: ["magmaGuardian", "obsidianKnight", "eruptionArmor"], apply(p) { p.color = FIRE_TIER[2]; p.slashStyle = "heavy"; p.maxHp += 70; p.hp += 70; p.damage += 7; p.fireCooldown = 0.95; p.attackRange = 62; p.aura = { r: 86, dpsFactor: 0.95 }; } },
  burstCharger: { name: "폭열돌격자", tag: "폭발", weapon: "slash", tier: 2, color: FIRE_TIER[2], desc: "베기마다 폭발",
    children: ["flameBreaker", "volcanoCrusher", "berserkFlameBlade"], apply(p) { p.color = FIRE_TIER[2]; p.slashStyle = "thrust"; p.attackRange = 115; p.speed += 16; p.damage += 2; p.slashExplode = 70; } },

  // ===== 2차 — 화포술사 갈래 =====
  blastGunner: { name: "폭염포격수", tag: "광폭발", weapon: "cannon", tier: 2, color: FIRE_TIER[2], desc: "초대형 폭발",
    children: ["megaBlastGunner", "arcingScorcher", "hellBombardier"], apply(p) { p.color = FIRE_TIER[2]; p.bulletShape = "shell"; p.explodeRadius += 64; p.damage = Math.round(p.damage * 1.45); p.bulletR += 7; p.fireCooldown *= 1.02; } },
  piercer: { name: "관통화포수", tag: "관통", weapon: "cannon", tier: 2, color: FIRE_TIER[2], desc: "직선 관통 저격",
    children: ["piercingSniper", "heatRayCaster", "thermalSniper"], apply(p) { p.color = FIRE_TIER[2]; p.bulletShape = "lance"; p.pierce += 6; p.explodeRadius = 0; p.bulletSpeed += 280; p.fireCooldown *= 0.8; p.bulletR = 9; p.attackRange += 130; } },
  delayBomber: { name: "지연폭파술사", tag: "설치", weapon: "cannon", tier: 2, color: FIRE_TIER[2], desc: "불바닥 설치",
    children: ["timedInferno", "mineAlchemist", "chainDetonator"], apply(p) { p.color = FIRE_TIER[2]; p.bulletShape = "bomb"; p.explodeRadius = 22; p.groundFire = { r: 84, life: 3.4, dpsFactor: 0.7 }; } },

  // ===== 2차 — 불씨조율사 갈래 =====
  ringWeaver: { name: "불씨환술사", tag: "고리", weapon: "orbit", tier: 2, color: FIRE_TIER[2], desc: "거대·고밀도 고리",
    children: ["solarRingWeaver", "meteorRingWeaver", "dualRingWeaver"], apply(p) { p.color = FIRE_TIER[2]; p.orbStyle = "ring"; p.orbitCount += 5; p.orbitRadius += 32; p.orbitSpeed += 1.1; p.damage += 6; p.fireCooldown *= 0.88; } },
  flameSummoner: { name: "불꽃사역자", tag: "소환", weapon: "orbit", tier: 2, color: FIRE_TIER[2], desc: "불씨가 자동 발사",
    children: ["fireSpiritSummoner", "phoenixTamer", "clonePyromancer"], apply(p) { p.color = FIRE_TIER[2]; p.orbStyle = "spirit"; p.orbitCount = 3; p.orbitRadius = 72; p.orbShoot = { interval: 0.38, dmgFactor: 1.25 }; p.damage += 2; } },
  igniter: { name: "점화조율사", tag: "화상", weapon: "orbit", tier: 2, color: FIRE_TIER[2], desc: "접촉 시 화상 지속",
    children: ["greatBurner", "flamePlague", "ashDetonator"], apply(p) { p.color = FIRE_TIER[2]; p.orbStyle = "blaze"; p.orbitCount = 4; p.orbitRadius = 78; p.burnOnHit = { dpsFactor: 1.4, dur: 3 }; p.burnSpread = 78; p.damage += 2; } },

  // ===== 3차 — 화염검무사 갈래 =====
  crimsonBlade: { name: "홍련검무사", tag: "균형연타", weapon: "slash", tier: 3, color: FIRE_TIER[3], desc: "넓고 빠른 홍련 베기",
    fx: { hi: "#ffdde4", main: "#ff2e4e", deep: "#c40f2e", glow: "#ff4060", spark: "#ff8aa0", dark: "#2e0812" },   // 홍련(붉은 연꽃) 진홍
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.slashStyle = "crimsonFlurry"; p.attackRange += 40; p.fireCooldown *= 0.82; p.damage += 5; p.speed += 8; p.crimsonWave = { r: 74, rangeBonus: 54, dmgFactor: 0.65 }; } },
  flameFlurry: { name: "불꽃난무자", tag: "초연타", weapon: "slash", tier: 3, color: FIRE_TIER[3], desc: "가장 빠른 연속 베기",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.slashStyle = "infernoFlurry"; p.fireCooldown *= 0.5; p.damage += 4; p.attackRange += 12; p.speed += 20; } },
  twinHeatBlades: { name: "초열쌍검사", tag: "쌍검", weapon: "slash", tier: 3, color: FIRE_TIER[3], desc: "전후 동시 쌍검 화염참",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.slashStyle = "twinSlash"; p.attackRange += 30; p.fireCooldown *= 0.7; p.damage += 6; } },

  // ===== 3차 — 용암중갑검사 갈래 =====
  magmaGuardian: { name: "용암수호자", tag: "오라탱커", weapon: "slash", tier: 3, color: FIRE_TIER[3], desc: "거대한 용암 오라",
    children: [], apply(p) { const ar = p.aura ? p.aura.r : 86; p.color = FIRE_TIER[3]; p.slashStyle = "magmaShield"; p.maxHp += 120; p.hp += 120; p.damage += 7; p.aura = { r: ar + 55, dpsFactor: 1.4 }; } },
  obsidianKnight: { name: "흑요석기사", tag: "철벽", weapon: "slash", tier: 3, color: FIRE_TIER[3], desc: "느리지만 매우 단단함",
    fx: { hi: "#ffb36b", main: "#c83214", deep: "#6e0e08", glow: "#ff3a16", spark: "#ff6a3a", dark: "#16080c" },   // 흑요석 속 용암빛
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.slashStyle = "obsidian"; p.maxHp += 190; p.hp += 190; p.damage += 16; p.speed -= 35; p.fireCooldown = 1.05; p.aura = { r: 92, dpsFactor: 1.05 }; } },
  eruptionArmor: { name: "분화철갑사", tag: "반격폭발", weapon: "slash", tier: 3, color: FIRE_TIER[3], desc: "묵직한 베기와 분화",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.slashStyle = "eruption"; p.maxHp += 90; p.hp += 90; p.damage += 8; p.slashExplode = Math.max(p.slashExplode, 120); p.aura = { r: 76, dpsFactor: 0.85 }; } },

  // ===== 3차 — 폭열돌격자 갈래 =====
  flameBreaker: { name: "폭염돌파자", tag: "돌파", weapon: "slash", tier: 3, color: FIRE_TIER[3], desc: "긴 돌진형 폭발 베기",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.slashStyle = "flameBreak"; p.attackRange += 55; p.speed += 45; p.damage += 5; p.slashExplode = Math.max(p.slashExplode, 132); p.aura = null; } },
  volcanoCrusher: { name: "화산파쇄자", tag: "대폭발", weapon: "slash", tier: 3, color: FIRE_TIER[3], desc: "느리지만 폭발 반경 큼",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.slashStyle = "volcano"; p.damage += 13; p.fireCooldown *= 1.05; p.attackRange += 24; p.slashExplode = Math.max(p.slashExplode, 188); p.aura = null; } },
  berserkFlameBlade: { name: "폭주검화사", tag: "속공폭발", weapon: "slash", tier: 3, color: FIRE_TIER[3], desc: "빠르게 찌르고 터뜨림",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.slashStyle = "berserk"; p.damage += 6; p.speed += 16; p.fireCooldown *= 0.8; p.slashExplode = Math.max(p.slashExplode, 82); p.aura = null; } },

  // ===== 3차 — 폭염포격수 갈래 =====
  megaBlastGunner: { name: "대폭염포술사", tag: "대포격", weapon: "cannon", tier: 3, color: FIRE_TIER[3], desc: "더 크고 강한 폭발탄",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.bulletShape = "megaShell"; p.explodeRadius += 95; p.bulletR += 12; p.damage = Math.round(p.damage * 1.45); p.fireCooldown *= 1.18; } },
  arcingScorcher: { name: "작열곡사수", tag: "불장판", weapon: "cannon", tier: 3, color: FIRE_TIER[3], desc: "폭발 뒤 넓은 불바닥",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.bulletShape = "scorcher"; p.explodeRadius += 45; p.bulletR += 6; p.damage += 8; p.groundFire = { r: 110, life: 4.0, dpsFactor: 0.9 }; p.fireCooldown *= 1.05; } },
  hellBombardier: { name: "지옥포격관", tag: "한방", weapon: "cannon", tier: 3, color: FIRE_TIER[3], desc: "느린 대신 최강 폭발",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.bulletShape = "hellShell"; p.explodeRadius += 140; p.bulletR += 16; p.damage = Math.round(p.damage * 1.7); p.fireCooldown *= 1.45; } },

  // ===== 3차 — 관통화포수 갈래 =====
  piercingSniper: { name: "관통저격수", tag: "저격", weapon: "cannon", tier: 3, color: FIRE_TIER[3], desc: "긴 사거리 고화력 관통",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.bulletShape = "sniper"; p.pierce += 12; p.bulletSpeed += 360; p.damage += 12; p.attackRange += 260; p.fireCooldown *= 0.85; } },
  heatRayCaster: { name: "열선포술사", tag: "열선", weapon: "cannon", tier: 3, color: FIRE_TIER[3], desc: "빠른 연사 관통 열선",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.bulletShape = "ray"; p.pierce += 18; p.bulletR = 7; p.bulletSpeed += 520; p.damage += 4; p.fireCooldown *= 0.62; } },
  thermalSniper: { name: "열공저격수", tag: "초장거리", weapon: "cannon", tier: 3, color: FIRE_TIER[3], desc: "매우 빠른 단발 관통",
    fx: { hi: "#f2fcff", main: "#bfe9ff", deep: "#4aa8ff", glow: "#dff4ff", spark: "#eaf9ff", dark: "#0c2440" },   // 청백 초고열 (가장 뜨거운 불꽃)
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.bulletShape = "thermal"; p.pierce += 8; p.bulletSpeed += 650; p.damage += 18; p.attackRange += 400; p.fireCooldown *= 1.05; } },

  // ===== 3차 — 지연폭파술사 갈래 =====
  timedInferno: { name: "시한폭염술사", tag: "지속폭염", weapon: "cannon", tier: 3, color: FIRE_TIER[3], desc: "오래 남는 큰 불바닥",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.bulletShape = "infernoBomb"; p.explodeRadius += 44; p.damage += 8; p.groundFire = { r: 122, life: 5.0, dpsFactor: 1.0 }; } },
  mineAlchemist: { name: "지뢰연금술사", tag: "연사지뢰", weapon: "cannon", tier: 3, color: FIRE_TIER[3], desc: "작지만 자주 까는 폭탄",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.bulletShape = "mine"; p.explodeRadius = 30; p.bulletR += 3; p.fireCooldown *= 0.72; p.groundFire = { r: 78, life: 5.8, dpsFactor: 0.95 }; } },
  chainDetonator: { name: "연쇄기폭사", tag: "연쇄폭발", weapon: "cannon", tier: 3, color: FIRE_TIER[3], desc: "폭발과 장판을 함께 강화",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.bulletShape = "chainBomb"; p.explodeRadius += 60; p.damage += 9; p.groundFire = { r: 96, life: 3.0, dpsFactor: 0.9 }; p.pierce += 1; } },

  // ===== 3차 — 불씨환술사 갈래 =====
  solarRingWeaver: { name: "태양환술사", tag: "태양고리", weapon: "orbit", tier: 3, color: FIRE_TIER[3], desc: "넓은 태양 불고리",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.orbStyle = "solar"; p.orbitCount += 8; p.orbitRadius += 58; p.orbitSpeed += 0.6; p.damage += 12; } },
  meteorRingWeaver: { name: "유성환술사", tag: "유성", weapon: "orbit", tier: 3, color: FIRE_TIER[3], desc: "고리가 유성탄을 발사",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.orbStyle = "meteorRing"; p.orbitCount += 4; p.orbitRadius += 28; p.damage += 8; p.orbShoot = { interval: 0.32, dmgFactor: 1.45, shape: "meteor", r: 10 }; } },
  dualRingWeaver: { name: "쌍환조율사", tag: "고밀도", weapon: "orbit", tier: 3, color: FIRE_TIER[3], desc: "많고 빠른 불씨 고리",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.orbStyle = "dualRing"; p.orbitCount += 10; p.orbitRadius += 75; p.orbitSpeed += 1.1; p.damage += 5; } },

  // ===== 3차 — 불꽃사역자 갈래 =====
  fireSpiritSummoner: { name: "화령소환사", tag: "정령연사", weapon: "orbit", tier: 3, color: FIRE_TIER[3], desc: "정령탄을 빠르게 발사",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.orbStyle = "fireSpirit"; p.orbitCount = 5; p.orbitRadius = 92; p.damage += 6; p.orbShoot = { interval: 0.28, dmgFactor: 1.35, shape: "spiritBolt", r: 7 }; } },
  phoenixTamer: { name: "불새사역자", tag: "강탄", weapon: "orbit", tier: 3, color: FIRE_TIER[3], desc: "느리지만 강한 불새탄",
    fx: { hi: "#fff3c8", main: "#ffc23a", deep: "#ff7b1f", glow: "#ffd86b", spark: "#ffe9a8", dark: "#4a3208" },   // 황금 불새
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.orbStyle = "phoenix"; p.orbitCount = 3; p.orbitRadius = 115; p.damage += 13; p.orbShoot = { interval: 0.46, dmgFactor: 2.5, shape: "phoenixBolt", r: 12 }; } },
  clonePyromancer: { name: "분신화술사", tag: "다중정령", weapon: "orbit", tier: 3, color: FIRE_TIER[3], desc: "여러 정령이 끊임없이 사격",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.orbStyle = "clone"; p.orbitCount = 6; p.orbitRadius = 82; p.speed += 10; p.damage += 4; p.orbShoot = { interval: 0.36, dmgFactor: 1.15, shape: "cloneBolt", r: 6 }; } },

  // ===== 3차 — 점화조율사 갈래 =====
  greatBurner: { name: "대연소술사", tag: "강화화상", weapon: "orbit", tier: 3, color: FIRE_TIER[3], desc: "화상 피해가 크게 증가",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.orbStyle = "greatBurn"; p.orbitCount += 2; p.orbitRadius += 18; p.damage += 5; p.burnOnHit = { dpsFactor: 2.2, dur: 4.5 }; p.burnSpread += 40; } },
  flamePlague: { name: "화염역병사", tag: "전염", weapon: "orbit", tier: 3, color: FIRE_TIER[3], desc: "불이 매우 넓게 번짐",
    fx: { hi: "#f4ffd0", main: "#b8e02a", deep: "#5f9c0a", glow: "#cdf04a", spark: "#dcff7a", dark: "#1c2a08" },   // 역병 독불(녹황)
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.orbStyle = "plague"; p.orbitCount += 1; p.orbitRadius += 26; p.damage += 4; p.burnOnHit = { dpsFactor: 1.7, dur: 5.0 }; p.burnSpread = 150; } },
  ashDetonator: { name: "재폭발술사", tag: "화상폭발", weapon: "orbit", tier: 3, color: FIRE_TIER[3], desc: "불씨 접촉과 화상을 모두 강화",
    children: [], apply(p) { p.color = FIRE_TIER[3]; p.orbStyle = "ash"; p.orbitCount += 3; p.orbitRadius += 12; p.orbitSpeed += 0.9; p.damage += 7; p.burnOnHit = { dpsFactor: 1.7, dur: 3.5 }; p.burnSpread += 62; } },
};
export const TIER1_CHOICES = ["swordsman", "cannon", "ember"];

/** 루트(1차)부터 id까지의 전직 경로 */
export function getJobPath(id) {
  if (!JOBS[id]) return [];
  const parent = parentIdOf(id);
  return parent ? getJobPath(parent).concat(id) : [id];
}

/** 직업이 속한 1차 갈래 id (swordsman | cannon | ember) */
export function branchOf(id) {
  const path = getJobPath(id);
  return path[0] || null;
}

/** 이펙트 팔레트(FX)를 pixelfx용 어두운→밝은 색 단계로 */
export function fxRamp(fx) {
  return [fx.dark, fx.deep, fx.main, fx.glow, fx.spark, fx.hi, "#ffffff"];
}

export const ALL_JOB_IDS = Object.keys(JOBS);
