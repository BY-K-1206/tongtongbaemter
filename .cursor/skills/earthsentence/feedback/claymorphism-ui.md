# Feedback: Storybook UI / 홈 비주얼

- 톤: 따뜻한 양피지, 더스티 라벤더·세이지·페일 옐로. 얇은 잉크 아웃라인 + 옅은 단일 drop shadow (클레이 dual-shadow / 풀 필 남발 금지).
- 타이포: 헤드 `Gaegu`(+ Caveat), 본문 `Noto Sans KR`, eyebrow는 넓은 letter-spacing 산세리프.
- 히어로: 브랜드 + 한 헤드라인 + 짧은 문장 + CTA + 지배적 비주얼. 통계/일정/프로모 오버레이 금지. 진한 풀블리드 그라데이션 히어로 지양 → 양피지 면 + 은은한 라벤더/별 점.
- 카드는 상호작용 컨테이너일 때만. 히어로에 카드 남발 금지.
- 색: purple-on-white 기본 AI 룩, cream+#terracotta 과다, glow/다층 shadow 회피. 변수명은 `--clay-*` 유지하되 값은 스토리북.
- 저작권: 어린 왕자 표지/캐릭터 원본을 로고·히어로에 넣지 않음 (톤만).
- 반응형: phone / tablet / PC. `[hidden]` + `.btn` 충돌 시 `.btn[hidden] { display: none; }`.
- 의미 있는 요소에 `id` — 디자인 미세 조정을 위해.
