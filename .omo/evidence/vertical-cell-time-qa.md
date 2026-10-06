# 빈칸별 풀이 시간 채점 검증

2026-10-03. 요청: 전체 풀이 시간이 아닌 빈칸 하나당 시간을 반영해 소폭 점수 차이 만들기.

## 구현

- `useVerticalGame.ts`: 시작/정답 확인/다음 문제에서 칸 타이머 초기화. 오답/입력/지우기는 초기화하지 않는다. 모션 종료 후 다음 문제의 타이머가 시작한다.
- `vertical.ts`: 확인 이벤트의 ms를 저장하고 문제별 `floor(sum(min(정답 ms,20000))/(5000*칸 수))` 감점. 자동 입력 0은 단계에 없으며 시간도 없다. 기존 문제당 200/오답 30, 0점 하한 유지. 문제별 최대 4, 전체 최대 20점 시간 감점.
- 클라이언트/API: timed 시작 opt-in과 서버 응답 플래그로 채점 합의. 기존 서버 응답은 untimed로 처리한다. 로컬 예비 모드는 timed.
- `supabase/vertical-cell-time.sql`: 검토용 SQL. 기존 기록/이전 시작은 scoring_version 1, 새 timed 시작은 2. 같은 칸 재시도의 비감소 ms와 범위 검증, 서버 재채점, 재제출 idempotency. SECURITY INVOKER/search_path/공개 역할 권한 차단 유지.

## 실행 결과

- `npm run build`: 통과.
- `node --experimental-strip-types --test tests/*.test.mjs`: 27/27 통과.
- Edge 소스 `tsc --noEmit --strict` + `tests/edge-runtime.d.ts`: 통과.
- `git diff --check`: 통과.
- 격리된 로컬 PostgreSQL `99dan_vertical_score_cell_20261003`에 새 SQL 적용 성공. 운영 서버 접근 없음.
- `vertical-cell-time.pg.mjs`: 21가지 시간/난이도/오답 조합 JS/SQL 일치, 평균/상한/레거시/재시도/잘못된 시간/공개 역할 차단 통과.
- `vertical-score.pg.mjs`: 8,100개 수식, 기존 점수/순위/완료/권한/재제출 검증 통과.
- `vertical-recommendation.pg.mjs`: 8,100개 스킬 분류, 최근 3세트 집계/첫 시도/추천/권한 회귀 통과.

## 실제 화면

IAB 임시 탭, 127.0.0.1:5173의 예비 24번으로만 플레이. 학생 서버 기록을 생성하지 않았다.

첫 문제 93×30: 첫 칸 오답 1회 후 정답, 첫 두 칸에서 긴 대기. 각 정답 확인마다 점수 증가, 문제 완료 169점(200−30−1). 이후 빠르게 푼 세 문제는 369→569→769점으로 각각 200점 증가했다. 전체 경과 시간이 다음 칸에 누적되지 않음 확인. 마지막 문제의 올림 칸에서 긴 대기해도 칸별 20초 상한/평균으로 추가 감점 없이 최종 969점.

정답 모션 후 자동 다음 문제와 최종 결과 전환도 확인. 390×844 화면의 scrollWidth=390으로 가로 넘침 없음. 임시 viewport 복구와 테스트 탭 닫기 완료.

- `/private/tmp/99dan-cell-time-result.png`
- `/private/tmp/99dan-cell-time-mobile.png`

## 남은 단계

운영 마이그레이션·gugudan-api 재배포는 사용자 AGENTS.md의 사전 확인 규칙에 따라 승인 대기. 기존 운영 v9는 시간 감점 없이 기존 채점으로 동작한다. Supabase CLI 미설치로 migration timestamp를 임의 생성하지 않고 SQL 초안으로 보관했다. 에디터 LSP는 사용자가 설치를 거절한 상태여서 실행하지 않았으며 TypeScript 컴파일러로 검사했다.
