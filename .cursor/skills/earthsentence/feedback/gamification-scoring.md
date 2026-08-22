# Feedback: 점수 / 티어 / 카운트

- 점수: `round(accuracy * 6 + min(wpm, 150) * (400/150))`, 0–1000.
- 티어 라벨: 보아 성장 (응애 보아 … 전설의 보아뱀). 홈 `MY BOA` 비주얼이 티어에 따라 커짐.
- `sessionStats` = step별 평균용. **완료 문장 수**는 `sessionSentencesCompleted` (Step 3만).
- 잔디밭: 최근 3개월 + 월 라벨. 리포트 문장 수도 Step 3 기준.
- 결과 화면: 지문별 속도 순위 + 점수.
- 홈 명예의 전당: 점수 순 top attempts.
