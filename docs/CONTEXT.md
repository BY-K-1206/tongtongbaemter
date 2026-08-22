# 통통뱀터 — Project context

브라우저 전용(HTML/CSS/JS) 영어 통문장 암기 앱. **통문장을 삼키는 보아뱀** 컨셉. Storybook(양피지·라벤더·세이지) UI. 데이터는 `AppStorage` 파사드 경유(기본 구현: localStorage).

로컬에서 열 때는 HTTP 서버가 필요합니다 (`npx serve .` 또는 `python3 -m http.server`). `index.html`은 셸이고, 화면 마크업은 `screens/*.html`을 `js/load-screens.js`가 주입합니다.

## Brand

- 서비스명: **통통뱀터**
- 컨셉: 긴 문장을 통째로 삼키고, 학습할수록 보아뱀이 성장 (티어 1 응애 보아 → 티어 6 전설의 보아뱀)

## Screens

마크업: `screens/<id>.html` (셸 `index.html`의 `#app-root`에 주입).

| ID | Purpose |
|----|---------|
| `screen-home` | 레벨/보아 성장, CTA, 명예의 전당, 최근 활동, 코끼리밭(최근 3개월+월 라벨), 오늘의 리포트 |
| `screen-settings` | 환경설정 (번역 엔진 토글: MyMemory / Claude / OpenAI / Gemini / OpenAI 호환) |
| `screen-register` | 지문 목록 관리 (검색/정렬/추가/수정/삭제) |
| `screen-register-form` | 지문 추가·수정 (태그, 난이도, 한→영 시 영어 편집·재번역) |
| `screen-library` | 학습할 지문 선택 (검색/정렬/시작만) |
| `screen-roadmap` | 지문당 1개 로드맵 (파트 = 하루 분량 + 보스전) |
| `screen-single` | 한문장 채팅 (번역 → 외우기) |
| `screen-vault` | 문장함 (EN/KO 확인 · 재학습) |
| `screen-study` | 파트/한문장 스텝 1·2·3 암기 / 보스(블라인드) + TTS + 실시간 점수 |
| `screen-admin` | 관리자 (사용자 역할, 보아뱀 상태·이미지) |
| `screen-result` | 세션 결과, 순위, 재도전 |

## Data layer

UI는 `window.AppStorage`만 호출한다. 영속 I/O는 전부 `Promise`를 반환한다.

| File | Role |
|------|------|
| `js/domain.js` (`AppDomain`) | 순수 로직: dateKey, difficulty, normalize, filterSort, streak, attempt ranking |
| `js/store-local.js` (`createLocalStore`) | AppDataStore localStorage 어댑터 |
| `js/storage.js` (`AppStorage`, `AppTiers`) | 파사드 — store에 위임 + 도메인 집계 헬퍼 |

**AppDataStore 계약** (구현체가 만족해야 할 async 메서드):

- Documents: `listDocuments`, `getDocument`, `saveDocument`, `updateDocument`, `deleteDocument`
- Attempts: `listAttempts`, `saveAttempt`
- Activity: `getDailyActivity`, `recordActivity`, `getTodayDurationMs`, `recordWordMistake`, `getTodayWordMistakes`, `recordRetry` / `getTodayRetryCount` (every wrong → daily report 시도), `recordMemorizedRetries` / `getTodayMemorizedRetryCount` (sum on fully memorized sentences → home banner), `getTodaySentenceCount`
- Roadmap: `getRoadmapProgress`, `completeRoadmapMark`
- Vault: `listVaultSentences`, `getVaultSentence`, `saveVaultSentence`, `updateVaultSentence`, `deleteVaultSentence`
- Settings: `getTranslateSettings`, `saveTranslateSettings`
- Boa: `getBoaStates`, `saveBoaStates`

**로드맵 용어** (항상 `.cursor/rules/roadmap-hierarchy.mdc` 준수)

```
지문 → 로드맵(1) → 파트(일일 문장 수) → 스텝 1·2·3
```

- **지문** = 등록된 본문 1개
- **로드맵** = 그 지문의 학습 경로 전체 (지문당 1개)
- **파트** = 하루 분량 (`sentencesPerDay`개 문장 + 그날 보스전). 듀오링고 동그라미 1개. (코드/저장소에는 `mark*` 키 유지)
- **스텝** = 파트 안 문장별 학습 단위
  1. 보고 따라쓰기
  2. 첫 글자만 보고 쓰기
  3. 아무것도 안 보고 쓰기
- 통과한 파트만 저장. 진행 중 이탈 시 경고 후 미저장.

**한문장 모드**

- 채팅으로 한 문장 입력 → 한↔영 자동 번역 → 문장함 `pending` 저장.
- 음성 입력(STT): Web Speech Recognition. 한/영 토글, 입력창에만 반영(자동 전송 없음). Chrome/Edge 권장, Firefox 미지원.
- 「지금 외우기」→ `studyMode: 'single'` (1·2·3만, 보스 없음) → 완료 시 `memorized` + 「학습 완료!」배지.
- 문장함에서 EN/KO 확인·다시 외우기 가능.

**백엔드:** 게스트는 localStorage. 로그인하면 프로젝트 `tongtongbaemter`(서울)에 저장.

1. 프로젝트 URL/anon key는 `js/supabase-config.js`에 이미 들어 있음  
2. 캠프면 Authentication → Providers → Email → **Confirm email 끄기**  
3. 첫 가입 계정이 admin

구현: `js/store-supabase.js`, `js/auth-supabase.js`, `js/supabase-boot.js`가 설정이 있을 때 `__APP_STORE__` / `__APP_AUTH__`를 주입한다.

기존 localStorage 키(`earthsentence_*_v1`)는 LocalStore가 그대로 사용한다.

## JS modules

번들러 없음. `window.App*` IIFE + script 태그 순서.

| File | Namespace | Role |
|------|-----------|------|
| `js/domain.js` | `AppDomain` | 순수 도메인 로직 |
| `js/store-local.js` | `createLocalStore` | localStorage AppDataStore |
| `js/store-supabase.js` | `createSupabaseStore` | Supabase AppDataStore (로그인 시) |
| `js/auth-supabase.js` | `createSupabaseAuth` | Supabase Auth |
| `js/storage.js` | `AppStorage`, `AppTiers` | 데이터 파사드 + 티어/점수 |
| `js/utils.js` | `AppUtils` | format / escape / normalize |
| `js/parse.js` | `AppParse` | 영·한 파싱, 토큰, 힌트 |
| `js/translate.js` | `AppTranslate` | 번역 (MyMemory / OpenAI / Claude / Gemini / OpenAI 호환) |
| `js/settings.js` | `AppSettings` | 환경설정 (번역 엔진) |
| `js/tts.js` | `AppTts` | Web Speech 합성 |
| `js/stt.js` | `AppStt` | Web Speech 인식 |
| `js/admin.js` | `AppAdmin` | 관리자: 사용자 역할, 보아뱀 상태 |
| `js/library.js` | `AppLibrary` | 학습 지문 선택 |
| `js/register.js` | `AppRegister` | 등록 목록·폼 |
| `js/roadmap.js` | `AppRoadmap` | 지문 로드맵 (파트 경로) |
| `js/single.js` | `AppSingle` | 한문장 채팅·문장함 |
| `js/study.js` | `AppStudy` | 학습·보스·한문장·결과 세션 |
| `js/load-screens.js` | `AppLoadScreens` | `screens/*.html` 로드 후 `app.js` 부트 |
| `js/app.js` | (IIFE) | state, DOM, 이벤트, init |

화면 모듈은 `ctx = { state, el, showScreen }`를 받는다. 영속 I/O는 `await AppStorage.*`만. `app.js`에는 오케스트레이션만.

## Key formulas

- **Score** = `round(accuracy * 6 + min(wpm,150)*(400/150))` → 0–1000  
- **Difficulty** = `wordCount*0.5 + avgWordLen*12 + sentenceCount*3` → level 1/2/3 at 45 / 90  
- **Tiers** by WPM: 보아 성장 라벨 (`AppTiers`, 관리자에서 이름·기준·이미지 수정)

## Document fields (storage)

`id, title, rawText, lang, rate, createdAt, sentenceCount, sourceLang, cachedSentences, tags[], difficultyStars (1–5), difficultyScore, difficultyLevel, sentencesPerDay, updatedAt?`

- `sourceLang === 'ko'`: `rawText` = 한글, `cachedSentences` = 학습용 영어. 수정 시 영어 박스·「다시 번역」지원.
- `sentencesPerDay`: 하루(파트)당 문장 수. 기본 3.

## Study steps (per sentence)

1. **스텝 1** 보고 따라쓰기 — Full English + Korean translation, word boxes  
2. **스텝 2** 첫 글자만 보고 쓰기 — First-letter blanks, retry on miss (3s reveal)  
3. **스텝 3** 아무것도 안 보고 쓰기 — Blind recall, no translation → sentence complete  

파트 학습: 그날 문장들을 위 스텝 1→2→3으로 순서대로 → **보스전**(같은 문장들을 스텝 3만) 통과 시 파트 완료.

한문장 모드: 문장함 항목 1개를 위 스텝 1·2·3만 진행(보스 없음) → 채팅/문장함 복귀.

## Vault sentence fields

`id, enText, koText, sourceLang ('en'|'ko'), status ('pending'|'memorized'), createdAt, memorizedAt?, updatedAt?`

## Feature checklist

- [x] 지문 파싱 + Web Speech TTS  
- [x] 한/영 등록, 파일 업로드, 한→영 수정 시 영어 편집/재번역  
- [x] 등록/학습 화면 분리, 폼은 추가하기 전용  
- [x] 태그 + 검색 + 등록일/난이도 정렬  
- [x] 게이미피케이션: 보아 성장, 점수, 잔디(3개월), 랭킹, 일일 리포트  
- [x] 자동 재생 토글, Listen & Type  
- [x] JS 기능 단위 모듈 분리 (`App*` + `app.js` 오케스트레이션)  
- [x] 데이터 저장소 인터페이스 (`AppDomain` + AppDataStore + `AppStorage` 파사드)  
- [x] 일일 로드맵 파트 + 보스전 + 이탈 경고  
- [x] 한문장 모드 채팅 + 문장함 + 스텝 1·2·3 재학습  
- [x] 한문장 모드 Web Speech STT (한/영 토글, 입력창만)
- [x] 번역 엔진 선택 (MyMemory 기본 + Claude/OpenAI/Gemini/OpenAI 호환, 제공자별 키·모델 토글)

## Constraints

- No server / no cross-device sync (기본 LocalStore; 원격 DB는 AppDataStore로 교체 가능)  
- Translation: default MyMemory; optional LLM APIs via settings (API key in localStorage). OpenAI often needs CORS proxy/compatible base URL; Claude supports browser direct access.  
- Plan markdown under user `.cursor/plans` must not be edited by the agent unless asked  

## Agent harness

- Always: `.cursor/rules/earthsentence.mdc`  
- On feature work: `.cursor/skills/earthsentence/SKILL.md` + `feedback/*`  
