---
name: earthsentence
description: >-
  통통뱀터(구 EarthSentence) 영어 암기 웹앱 개발 시 사용. 통문장 보아뱀 컨셉,
  지문 등록/학습 분리, 태그·정렬·난이도, storybook parchment UI, 게이미피케이션,
  TTS·번역, localStorage. HTML/CSS/JS 변경 시 이 스킬을 읽는다.
---

# 통통뱀터 development skill

## When to use

통통뱀터 / 보아뱀 / 지문 등록 / 학습 / 게이미피케이션 / storybook UI / TTS / 번역 관련 작업.

## Brand

- Name: **통통뱀터**
- Concept: swallow whole sentences; boa grows with study (tier visuals on home)

## File map

| Path | Role |
|------|------|
| `index.html` | 앱 셸 (CSS/JS 로드 + `#app-root`) |
| `screens/*.html` | 화면 파셜 (home, settings, register, register-form, library, roadmap, single, vault, study, result) |
| `js/load-screens.js` | 파셜 fetch → `#app-root` 주입 후 `app.js` 부트 |
| `css/style.css` | Storybook parchment + 반응형 + boa/heatmap |
| `js/domain.js` | 순수 도메인 로직 (`AppDomain`) |
| `js/store-local.js` | localStorage AppDataStore (`createLocalStore`) |
| `js/storage.js` | 데이터 파사드 (`AppStorage`) + 티어 (`AppTiers`) |
| `js/utils.js` | format / escape / normalize (`AppUtils`) |
| `js/parse.js` | 영·한 문장 파싱, 토큰, 힌트 (`AppParse`) |
| `js/translate.js` | MyMemory / Claude / OpenAI / 호환 번역 (`AppTranslate`) |
| `js/tts.js` | Web Speech 합성 (`AppTts`) |
| `js/stt.js` | Web Speech 인식 (`AppStt`) — 한문장 모드 마이크 |
| `js/settings.js` | 환경설정 (`AppSettings`) — 번역 엔진 |
| `js/home.js` | 홈: 레벨/랭킹/최근/코끼리밭/일일 리포트 (`AppHome`) |
| `js/library.js` | 학습용 지문 선택 (`AppLibrary`) |
| `js/register.js` | 등록 목록 + 추가/수정 폼 (`AppRegister`) |
| `js/roadmap.js` | 지문 로드맵 · 파트 경로 (`AppRoadmap`) |
| `js/single.js` | 한문장 채팅 + 문장함 (`AppSingle`) |
| `js/study.js` | 스텝 1·2·3 학습 + 보스전 + 한문장 + 결과 세션 (`AppStudy`) |
| `js/app.js` | state, DOM, showScreen, 이벤트, init |
| `docs/CONTEXT.md` | 제품 요약 |
| `feedback/*.md` | 반복 피드백 |

## Module rules

- 번들러/ESM 없음. `window.App*` IIFE + `index.html` 스크립트 태그 순서 유지.
- 화면 마크업은 `screens/<name>.html`. 로컬 HTTP 서버 필요(`file://`에서는 fetch 불가).
- 화면 모듈은 `ctx = { state, el, showScreen }`를 받아 동작. 전역 state를 소유하지 않음.
- **영속 I/O는 `await AppStorage.*`만** 사용. localStorage/DB를 화면에서 직접 호출하지 않음.
- 순수 계산은 `AppDomain` / sync 헬퍼. store 교체는 `createLocalStore` → 다른 AppDataStore 구현 또는 `window.__APP_STORE__` 주입.
- **새 기능**은 해당 도메인 파일에 추가하거나, 경계가 크면 `js/<feature>.js`를 만들고 script 태그를 추가한다.
- `app.js`에는 오케스트레이션(상태·DOM·이벤트·화면 전환)만 두고 화면 로직을 쌓지 않는다.
- 순수 헬퍼 → `utils` / `parse` / `translate` / `tts` / `domain`. 영속 → store + `AppStorage` 파사드.

## Screen flow

```
home → register (목록) → register-form (추가/수정; 하루 문장 수; 한→영은 한글·영어 동시 편집·재번역)
home → settings (번역 엔진: MyMemory / Claude / OpenAI / 호환)
home → library → roadmap (파트) → study (문장 스텝 1·2·3 → 보스) → roadmap
home → single (채팅 번역) → study (한문장 스텝 1·2·3) → single
home → single → vault (문장함) → study → vault
```

## Checklist

1. 등록/학습 역할 분리
2. descriptive `id`
3. 문장 완료 = 스텝 3만
4. `feedback/` 사례 준수
5. 큰 기능 시 `docs/CONTEXT.md` 갱신
6. 브랜드명 통통뱀터 유지
7. 기능 단위로 JS 파일을 나누고 `app.js`에 화면 로직을 몰아넣지 않음
8. 영속 I/O는 async `AppStorage`만; 새 DB는 AppDataStore 구현으로 추가
9. 학습 위계: 지문 → 로드맵(1) → 파트 → 스텝 1·2·3 (`.cursor/rules/roadmap-hierarchy.mdc`)
10. 파트 = 하루 분량+보스; 진행 중 이탈 시 미저장 경고
11. 한문장 모드: 번역→문장함→스텝 1·2·3; 이탈 시 미저장 경고
12. 번역 기본은 MyMemory; LLM은 환경설정에서 API 키·모델·Base URL 설정 (키는 localStorage)

## Situation-specific feedback

- `register-library-flow.md`
- `claymorphism-ui.md`
- `gamification-scoring.md`
- `korean-input-tts.md`
