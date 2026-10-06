# 두 자리수 곱셈 통합 점수·난이도 표시 제거

2026-10-02. 이전 vertical-scores-qa.md의 난이도별 순위를 이 변경으로 대체한다. 완료 점수는 모든 세트에 동일한 max(0,1000 − 오답 × 30)을 적용한다. 명예의 전당은 세트를 합친 학생별 최근 7일 최고 완료 점수 상위 5명이다. 한 학생이 여러 세트를 풀어도 최고 기록 한 개만 표시한다.

학생 HallScreen의 난이도 상태·탭·접근성 그룹과 App의 initialDifficulty 전달을 제거했다. 학생 시작·풀이·결과 화면에는 난이도 이름이 없다. 교사 화면의 난이도 설정과 시작 시 세트 고정은 유지한다. 클라이언트와 Edge의 verticalLeaders에는 난이도를 전달하지 않고, SQL gugudan_vertical_leaders()도 난이도 인자·필터를 제거했다. 아직 운영에 적용하지 않은 점수 마이그레이션을 수정했다.

## 검증

- node --test tests/vertical.test.mjs tests/vertical-api.test.mjs tests/teacher-activity.test.mjs: 16/16 통과.
- npm run build, git diff --check: 통과.
- 실제 PostgreSQL 17.11 격리 DB 99dan_vertical_score_20261002_unified에 변경 SQL을 적용하고 tests/vertical-score.pg.mjs 통과. 8,100개 곱셈 일치, 채점·오답·0점 하한·재시도·설정 고정·권한 차단 유지.
- 쉬움 1000점, 보통 940점, 어려움 0점이 같은 순위에 표시됨. 동일 학생의 어려움 970점은 쉬움 1000점을 대체하지 않으며 두 번 표시되지 않음. 쉬움 기록이 7일 만료되면 같은 학생의 어려움 970점이 표시됨. 상위 5명 제한 검증.
- Edge 테스트: verticalLeaders는 서명 세션이 필요하고 난이도 없이 빈 RPC 인자로 조회. 이전 클라이언트가 difficulty를 보내도 필터로 사용하지 않음.
- native IAB에서 실제 앱과 실제 Edge handler 및 격리 DB 연결. 가상 7개 점수/6명/세 가지 세트를 합쳐 1~5번 순위 1000,970,910,880,850점 확인. 학생 1의 쉬움 940점/어려움 1000점은 1000점 한 행으로 표시.
- 1280×720 및 320×568 캡처 확인. 모바일 가로폭/scrollWidth 모두 320, 난이도 탭 0개, 순위 5명. 구구단 1·2·3분 탭 유지.
- 첫 검증 origin에는 이전 가상 완료 기록이 남아 현재 새 테스트 DB의 run ID와 맞지 않아 정상적으로 저장 재시도 화면이 나타났다. 기존 저장 기록을 지우지 않고 localhost:5174 새 origin에서 학생 시작·풀이 화면을 검증했다. 난이도 이름 없음. 가짜 교사 번호로 로그인해 교사 화면의 쉬움·보통·어려움 옵션 유지 확인.
- 실제 학생 정보·운영 PIN 사용 없음. 추가 의존성·커밋·푸시 없음.

화면 증거: /private/tmp/99dan-unified-evidence/hall-1280.png, hall-320.png.

## 운영 상태

교사 설정은 이전에 승인받아 배포한 version 8 유지. 점수 테이블·완료 저장·통합 순위 API는 로컬 구현과 격리 검증까지 완료했고 운영 마이그레이션/배포는 여전히 승인 대기. 운영 데이터는 변경하지 않았다. 참고한 RPC/권한 공식 문서: https://supabase.com/docs/guides/database/functions.
