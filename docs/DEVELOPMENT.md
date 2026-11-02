# 개발 메모

## 실행

ES 모듈을 쓰므로 파일을 직접 열지 말고 로컬 서버로 띄웁니다.

```sh
python3 -m http.server 8765   # http://localhost:8765/
```

주소 뒤에 붙이는 테스트용 옵션:
- `?wave=20` — 20웨이브부터 시작
- `?previewJob=crimsonBlade&wave=30` — 그 직업(레벨 16)으로 바로 시작

게임 중 B는 자동 플레이(테스트용)입니다.

## 구조

```
index.html            캔버스 하나 + src/main.js
src/main.js           시작·입력·화면 전환·매 프레임
src/config.js         월드 960×600, 픽셀 화면 480×300(2배 확대)
src/game/             로직 (DOM 없음, node에서 import 가능)
  run.js              판 흐름: 웨이브·보스·상자·스테이지 클리어·결과·보상
  combat.js           플레이어 공격(베기·포격·불씨 궤도)·지속 피해
  enemies.js          적 6종 AI·적 탄·보스 패턴
  bot.js              자동 플레이 봇 + runSim(화면 없는 시뮬레이션)
  state.js            상태
src/data/             전직 39종·적·보스·스테이지·영구 성장 수치
src/render/           픽셀 렌더러
  world.js            바닥→바닥 이펙트→캐릭터→탄→위 이펙트, pixelfx 프레임(색+빛) 합성
  vfx.js              게임 사건 → 이펙트 (pixelfx 도구로 그린 베기·폭발, 드문 장면은 pixelfx 이펙트 그대로)
  sprites.js tiles.js 스프라이트(문자열·도형) · 스테이지 바닥
  hud.js uikit.js     HUD·전직 선택·일시정지 / UI 그리기 도구
src/scenes.js         타이틀·영구 성장·도감·설정·결과
src/audio.js          WebAudio 합성 효과음·음악 (파일 없음)
src/save.js           localStorage 저장
vendor/pixelfx/       pixelfx (MIT, 커밋은 VERSION 파일)
assets/fonts/         Galmuri 픽셀 폰트 (OFL)
```

사건 흐름: 로직은 `emit(사건)`만 하고, 그림(`render/vfx.js`)과 소리(`audio.js`)가 구독합니다. 시뮬레이션 중에는 꺼집니다.

## 밸런스 확인

```sh
node -e "import('./src/game/bot.js').then(m => console.log(m.runSim({ j1: 0, j2: 1, j3: 2 })))"
```

`j1`·`j2`·`j3`는 1·2·3차에 고를 갈래 번호(0~2)입니다. 2026-11-02 기준 봇 36판(영구 성장 없음): 평균 도달 웨이브 약 23, 클리어 6판. 수치를 바꾸면 다시 잽니다.

## 설계 메모

- 전직 컨셉·트리: `fire_mage_concepts.txt`, `fire_mage_tree.html` (물·바람 마법사 문서는 이후 캐릭터용)
- 재디자인 전 단일 파일 버전: `legacy/game.html` (참고용, 더 이상 고치지 않음)
- 이펙트 = 피해 범위: 베기 부채꼴, 폭발 고리, 불고리 띠, 오라 원은 실제 판정 크기와 같게 그립니다.
- 전직 단계가 오를수록 로브가 주황→빨강, 2차 망토, 3차 금장식·모자 불꽃. 이펙트 색은 2차 갈래 팔레트를 따릅니다.
