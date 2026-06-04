# wizard_game

마법사 키우기 — 단일 화면 아레나에서 싸우는 마법사 게임. 현재 **Phase 0**(MVP) 단계.
순수 HTML5 Canvas + JavaScript, **단일 파일(`game.html`)** 로 동작 (빌드 불필요).

## 실행

`game.html` 을 브라우저로 직접 열거나:

```powershell
python -m http.server 8000
# → http://localhost:8000/game.html
```

## 구성

- `game.html` — 게임 본체 (캔버스 + 로직, 단일 파일)
- `fire_mage_tree.html` / `water_mage_tree.html` / `wind_mage_tree.html` — 속성별 전직·스킬 트리 시각화
- `fire_mage_concepts.txt` / `water_mage_concepts.txt` / `wind_mage_concepts.txt` — 속성별 설계·컨셉 노트

## 설계 메모

- 3속성(불·물·바람) 마법사, 전직 트리 기반 성장.
- 단계적 MVP: **Phase 0**(기본 전투) → Phase 1 → 확장.
- 조작·전직 등 세부는 게임 화면 안내 및 컨셉 노트 참고.
