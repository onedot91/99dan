# School_Timer 연결

기존 `storage_resources`의 `/studentLife/failureProfileAssignments/<번호>`를 읽어 동물 프로필을 공유합니다. 기존 프로필·경제·타이머 데이터에는 쓰지 않습니다. 그림은 School_Timer의 공개 정적 에셋을 같은 경로로 복사해 제공합니다.

`schema.sql`은 새 `gugudan_players`, `gugudan_runs`, `gugudan_weekly_leaders`와 전용 RPC만 추가합니다. 개인 기록은 번호별로 공유하고 계속 보관합니다. 명예의 전당은 도전 시간별 최근 7일 내 기록 중 상위 5명을 반환합니다. 동점은 먼저 달성한 기록, 다음으로 번호 순입니다. 중도 종료한 도전도 개인 최고 기록과 순위에 포함되며 연습 기록은 순위에 포함되지 않습니다. 제출 ID로 중복 저장을 방지하고 SQL 트랜잭션 안에서 채점·누적·최고점 갱신을 처리합니다.

기존 데이터베이스의 명예의 전당 인원수는 `migrations/20260927155153_leaderboard_top_five.sql`로 상위 5명까지 확장합니다.

명예의 전당 기록은 달성 시각부터 7일 동안만 순위에 포함합니다. 기존 DB에는 `migrations/20260927155901_weekly_hall_records.sql`을 적용합니다. 최근 7일 안에 달성한 개인 최고점은 주간 순위로 옮기며, 개인 최고 기록 자체는 유지합니다.

구구단 기록 테이블은 RLS가 활성화되며 anon/authenticated 직접 접근은 차단합니다. RPC는 SECURITY INVOKER이며 service_role만 호출합니다. Edge Function은 서명한 번호 세션을 검증한 뒤 RPC를 호출합니다. service_role 키는 Supabase 서버 환경에만 있습니다. 번호 선택은 학생 스스로 선택하는 기존 정책이며 실제 신원 인증/PIN은 아닙니다. 클라이언트 이벤트의 정답과 점수는 서버가 다시 계산하지만 반응시간의 부정 조작까지 검증하는 시험용 서비스는 아닙니다.

2026-09-22 School_Timer에 테이블2개·함수4개·Edge API1개 적용 완료. 현재 로컬 앱의 `.env.local`도 실제 API에 연결되어 있습니다.

새 환경의 설정 순서:
1. 기존 School_Timer에는 이미 적용되어 있으므로 `schema.sql`을 중복 실행하지 않음. 별도 신규 DB에만 초기 스키마로 적용.
2. `gugudan-api` Edge Function 배포. 요청별 자체 서명 세션 인증을 사용하므로 `verify_jwt=false`로 배포.
3. `.env.local`에 `VITE_GUGUDAN_API_URL`과 publishable key를 설정. service_role 키를 VITE 변수에 넣지 않음.
4. 다른 기기의 같은 번호와 1/2/3분 최고 기록을 검증.

현재 키 범위는 기존 School_Timer의 단일 1~23번 학급입니다. 다른 학급/학년을 추가하기 전 학급·연도 식별자를 함께 키에 포함해야 합니다.

기존 DB에는 `migrations/20260927000000_question_types_teacher.sql`을 검토한 뒤 적용하고, 새 DB에는 최신 `schema.sql`을 한 번 적용합니다. 그 다음 `gugudan-api` Edge Function을 새 코드로 배포하고 서버 비밀값 `GUGUDAN_TEACHER_CODE`를 교사 번호로 설정해야 합니다. 이 값은 `VITE_` 변수나 Git 파일에 넣지 않습니다. 교사 API는 30분 유효한 서명 토큰을 사용하고, 학생별 기록 조회와 초기화만 허용합니다. 개별 초기화는 해당 학생의 게임 기록과 순위를 지우며, 전체 초기화는 1~23번의 게임 기록·도전·최고 점수·명예의 전당 기록을 한 번에 지웁니다. School_Timer 프로필은 건드리지 않습니다. 전체 초기화는 앱에서 확인 문구를 입력해야 실행됩니다. 최근 세션 목록은 기존 정책대로 최대 20회만 보관합니다.

기존 DB에 전체 초기화 기능을 추가하려면 `migrations/20260927173954_teacher_reset_all.sql`과 `migrations/20260927174840_teacher_reset_all_scope.sql`을 적용한 뒤 `gugudan-api` Edge Function을 재배포합니다.

기존 점수 규칙에서 시간 감점 방식으로 바꾸는 마이그레이션은 `migrations/20260927154259_accuracy_scoring_time_decay.sql`과 `migrations/20260927154438_accuracy_scoring_time_decay_v2.sql`입니다. 현재 정답 점수는 200점에서 시작해 100ms마다 1점씩 줄고 최소 100점입니다. 두 번째 연속 정답부터 10점씩 더해져 최대 50점이며, 오답은 최대 30점 감점이고 점수는 0점 아래로 내려가지 않습니다. 서버 점수 규칙은 `migrations/20260927160644_nonnegative_scoring_penalty_30.sql`에서 함께 갱신합니다. 기존 세션과 점수 데이터는 보존되고, 최고 점수 화면과 명예의 전당은 현재 규칙 버전의 기록만 표시합니다.

설계 근거: https://supabase.com/docs/guides/api/securing-your-api 및 https://supabase.com/docs/guides/getting-started/api-keys

클라이언트는 세션 만료401에서 같은 번호로 갱신하고1회 재시도합니다. 완료 기록은 탭 내 대기 큐로 다음 게임 중에도 재전송할 수 있습니다. 저장 실패가 표시된 상태에서 탭을 닫거나 새로고침하면 아직 서버에 도착하지 않은 대기 기록은 복구되지 않습니다.

## 펫 나무 (2026-09-28, 미적용)

`migrations/20260928000000_friends.sql`은 `gugudan_players`에 `friends`(jsonb 배열)와 `partner` 열을 추가합니다. 프로필·교사 조회에 펫 정보를 포함하고, 저장 RPC `gugudan_save_friends`를 추가합니다. 서버는 저장할 때 형식, 중복, 진화 순서(부모 보유), 개수를 확인합니다. 개수는 레벨을 넘을 수 없습니다(`migrations/20260929000000_slower_levels.sql`에서 15개마다 한 레벨이던 속도를 초반 10·20·30·40개, 이후 50개마다로 변경. 이미 가진 펫은 유지되며, 새 펫은 새 한도 안에서만 받을 수 있습니다). 교사 초기화(개별·전체)는 펫도 함께 지웁니다. `migrations/20261006000000_mythic_friends.sql`은 5단계 신화 펫(`family.element.form.aura.myth`, 점 4개)을 받도록 id 형식만 넓힙니다. 기존 1~4단계 펫과 레벨 계산은 그대로입니다. 이 마이그레이션과 함께 `gugudan-api` Edge Function(같은 id 형식 검사)도 다시 배포해야 5단계 펫이 저장됩니다.

적용 순서: 마이그레이션 적용 → `gugudan-api` Edge Function 재배포(`capabilities`에 `friends:true`, `saveFriends` 액션). 적용 전에는 앱이 펫을 브라우저 localStorage(`gugudan-rush.friends.<번호>`)에만 저장합니다. 적용 뒤 서버에 펫이 없으면, 레벨 한도 안에 있는 브라우저 기록을 한 번 서버로 올립니다.

## 칸별 1초 구간과 오답 −10 (2026-10-05, 운영 반영 완료)

`vertical-cell-scoring.sql`을 사용자 승인 후 migration `20261005070249_gugudan_vertical_cell_scoring`와 `gugudan-api` version 16 ACTIVE로 운영 반영했다. 새 `cellScoring:true` 도전은 각 칸의 시간 구간에 직접 점수를 부여하고 오답당 −10점을 적용한다. 2초까지 기본 배점 100%, 이후 1초마다 5%포인트 감소, 20초 이상은 10%이며 각 칸에서 정수로 계산한다. 문제당 만점 200점, 난이도 통합, 5/10문제 구분을 유지한다. 기존 세션·점수·구구단 오답 규칙은 보존한다. 운영 480개 채점 검증과 HTTP 23개, 기존 기록·설정 전체 해시 보존을 확인했다. 상세: `.omo/evidence/vertical-cell-scoring-qa.md`, `.omo/evidence/vertical-cell-scoring-deployment-qa.md`. 프론트엔드 정식 호스팅 배포는 별도다.

## 칸별 시간 비중 확대 (2026-10-05, 운영 반영 완료)

`vertical-tight-time.sql`을 사용자 승인 후 migration `20261005062629_gugudan_vertical_tight_time`와 `gugudan-api` version 15 ACTIVE로 운영 반영했다. 새 `tightTime:true` 시작에만 칸별 2초 유예·20초 상한·문제당 최대 60점 시간 감점을 적용한다. 기본 200점과 오답 −30점은 유지한다. 각 칸의 `min(max(ms−2000,0),18000)`을 합산해 `floor(합계×60/(18000×입력 칸 수))`를 감점한다. 기존 시간 규칙과 저장 점수는 보존하며 새 순위는 같은 기준의 기록끼리 비교한다. 운영 360개 채점 사례와 18개 HTTP 검증, 기존 기록·설정 전체 해시 보존을 확인했다. 이전 앱 요청은 기존 기준으로 계산한다. 프론트엔드 정식 호스팅 배포는 별도다. 상세: `.omo/evidence/vertical-tight-time-qa.md`, `.omo/evidence/vertical-tight-time-deployment-qa.md`.

## 학생별 두 자리수 곱셈 세트
일의 자리가 0인 곱하는 수의 한 줄 답안은 `vertical-direct-zero.sql` 구현 원본을 사용자 승인 후 migration `20261003043756_gugudan_vertical_direct_zero`와 `gugudan-api` version 13 ACTIVE로 운영 반영했다. 적용된 운영 DB에 원본을 다시 실행하지 않는다. 새 `gugudan_vertical_begin_direct_zero`가 `directZero:true` 문항을 저장하고, 채점 칸 매핑은 해당 문항에만 자리 맞춤 0과 십의 자리 곱셈을 사용한다. 기존 기록·테이블 데이터를 변경하거나 재계산하지 않는다. Edge API의 새 `directZero:true` 요청은 `puzzleOperands/puzzles/manualZero:true`를 요구한다. 기존 API 응답과 기존 문항의 입력 순서를 보존한다. 운영 810개 숫자/올림·6개 구성 채점·16개 HTTP 검증, 기존 기록·설정 개수와 해시 보존 확인. 상세: `.omo/evidence/vertical-direct-zero-qa.md`, `.omo/evidence/vertical-direct-zero-deployment-qa.md`. 프론트엔드 정식 배포는 미실시다.


`migrations/20261002045629_vertical_assignments.sql`은 전용 설정 테이블과 조회·저장 RPC 3개를 추가합니다. 미설정 학생은 下(1), 中은 2, 上은 3입니다. 교사 화면에서 학생을 고르고 난이도를 바꾸면 자동 저장합니다. 실제 문항은 연습 시작마다 무작위로 생성됩니다. 기존 기록 초기화는 설정을 지우지 않습니다.

적용 순서: 설정 마이그레이션 → `gugudan-api` 재배포. 신규 DB도 초기 스키마 이후 이 마이그레이션을 적용해야 합니다. 기존 교사 서명 세션으로 `teacherSetVertical`을 인증하며, 학생의 `verticalAssignment` 조회는 요청에 넣은 번호 대신 검증된 세션 번호를 사용합니다. RLS와 권한으로 anon/authenticated의 테이블·RPC 직접 접근을 차단합니다. 기존 `verify_jwt=false`와 서버 내부 세션 검증을 유지합니다. 운영 마이그레이션·재배포는 사용자 승인 후 진행합니다.

검증: `node --test tests/vertical.test.mjs tests/vertical-api.test.mjs`, `npm run build`. SQL은 격리된 PostgreSQL에서 마이그레이션 적용 후 `psql -v ON_ERROR_STOP=1 -f supabase/tests/vertical_assignments.sql`로 검사합니다. 테스트는 트랜잭션을 롤백하며 운영 데이터에 적용하지 않습니다.

권한 설계 참고: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database Functions](https://supabase.com/docs/guides/database/functions).

2026-10-02 사용자 승인 후 설정 마이그레이션을 운영에 적용하고 `gugudan-api` version 8을 배포했다. 기본 쉬움·23명 조회·RLS·클라이언트 직접 접근 차단을 실제 서버에서 확인했다. RLS 정책 없음(INFO)은 서비스 전용 테이블의 의도된 설정이며 공개 역할에는 테이블/RPC 권한이 없다.

## 두 자리수 곱셈 점수와 순위 (운영 반영 대기)

`migrations/20261002052116_vertical_scores.sql`은 별도 `gugudan_vertical_runs`와 시작·칸 검증·완료 채점·순위 RPC를 추가한다. 구구단 도전 데이터는 변경하지 않는다. 완료 점수는 `max(0,1000 − 오답 입력 수 × 30)`, 시간 제한/속도/콤보 보너스 없음이다. 서버가 시작마다 올림 비중에 맞는 중복 없는 5문제를 무작위로 생성해 ID별로 저장하고 시작 응답의 questions로 전달한다. 같은 ID 재시도는 저장된 문항을 반환한다. 저장된 문항의 모든 칸을 오른쪽부터 순서대로 검증하며 중간 종료·잘못된 순서·다른 학생의 ID를 거부한다. 완료된 기록에서 모든 난이도를 합쳐 학생별 최근 7일 최고 점수 상위 5명을 조회한다. 순위 RPC는 난이도 인자를 받지 않으며 학생 화면에는 난이도 표시를 노출하지 않는다. 같은 점수는 먼저 달성한 순서, 이후 학생 번호 순이다. 원래 교사 초기화 RPC에 곱셈 기록 삭제를 포함하며 설정은 유지한다.

적용 순서: 설정 마이그레이션 → 점수 마이그레이션 → `gugudan-api` 재배포. 새 액션 `verticalBegin`, `verticalFinish`, `verticalLeaders`는 학생 서명 세션의 번호만 사용한다. 2026-10-02 사용자 승인 후 점수·추천 마이그레이션을 운영에 적용했다. 브라우저 version 1·2 진행은 이어 풀되 점수 기록에 소급 반영하지 않는다.

교사 난이도 추천은 점수 마이그레이션에 포함된 `skill_stats`와 `gugudan_teacher_vertical_metrics()`를 사용한다. 검증된 완료 입력에서 칸별 첫 시도만 집계하며, 곱셈 올림 기록·반영과 덧셈 올림 발생·반영을 따로 계산한다. 원본 입력 이력은 저장하지 않고 집계값만 보관한다. 통계가 있는 최근 완료 3세트(15문제)를 조회하고, 각 올림 유형의 입력 칸이 5개 미만이면 추천하지 않는다. 중도 진행·통계 없는 이전 기록은 제외한다.

초기 추천 기준: 전체 첫 시도 80% 미만 또는 어느 올림 유형이든 60% 미만이면 下, 전체 90% 이상과 두 올림 유형 각각 85% 이상이면 上, 그 사이면 中이다. 시간과 명예의 전당 점수는 추천에 쓰지 않는다. 교사에게는 추천 배지 하나만 표시하고 눌렀을 때 짧은 이유를 제공한다. 배지가 난이도를 변경하지 않으며 교사의 선택은 기존 자동 저장 경로를 사용한다. 학생 화면에 추천·통계를 노출하지 않는다. 기준은 교육적 진단을 확정하는 기준이 아니라 조정 가능한 앱 초기 규칙이다.

교사 API에서 통계가 없으면 추천 배지를 숨긴다. API가 통계 RPC 미설치 응답(PGRST202)을 받는 경우에도 기록 화면은 계속 사용할 수 있다. 다른 서버 오류는 실패로 표시한다.

2026-10-02 승인 후 운영 migration `20261002122652_gugudan_vertical_scores_recommendations` 적용 및 `gugudan-api` version 9 ACTIVE 배포 완료. 기존 custom auth/verify_jwt=false 유지. 배포 소스 일치와 설정 조회·통합 순위 조회 성공, 학생 토큰의 교사 조회 거부(401), 인증 없는 순위 조회 거부(401), 잘못된 시작 ID 거부(400)를 확인했다. 적용 전후 기존 플레이어 23명·구구단 도전 665개·순위 기록 65개의 수와 학습 기록/난이도 설정 해시가 같았다. 신규 테이블의 RLS와 공개 역할의 직접 접근 차단 및 service_role 통계 RPC 권한을 확인했다. 운영에서 가상 풀이 기록을 생성하거나 실제 교사 번호를 사용하지 않았다. 새 풀이 기록이 충분히 쌓이면 추천이 표시된다.

로컬 통합 검증: 테스트 DB에 `storage_resources` 빈 fixture, `schema.sql`, friends 마이그레이션, 설정·점수 마이그레이션을 적용한다. 격리된 일반 PostgreSQL은 Supabase 기본 service_role DELETE 권한이 없으므로 fixture에서 `grant delete on public.gugudan_runs to service_role;`도 적용한다. `PGHOST=127.0.0.1 PGPORT=55432 PGDATABASE=99dan_vertical_score_20261002 PSQL=/opt/homebrew/bin/psql node tests/vertical-score.pg.mjs`. 8,100개 곱셈 칸 순서 대조, 세트 일치, 실제 점수·완료 검증·재시도·주간 만료·교사 초기화·역할 차단을 검사한다. 데이터 변경 검증은 롤백한다.

## 빈칸별 풀이 시간

`vertical-cell-time.sql`은 구현 원본 SQL이다. 2026-10-03 사용자 승인 후 칸별 시간·5/10문제·0 직접 입력을 묶어 운영 migration `20261003024558_gugudan_vertical_cell_time_counts_manual_zero`와 `gugudan-api` version 10 ACTIVE로 반영했다. 운영 이력에서 확인한 실제 버전의 migration 파일을 저장했다. 아래 원본 SQL을 적용된 DB에 다시 실행하지 않는다.

클라이언트는 현재 입력 칸이 열린 시점부터 정답 확인까지 `performance.now()`로 잰 정수 밀리초 `ms`를 이벤트에 보낸다. 오답에서 타이머를 초기화하지 않으며 그 칸의 마지막 정답 이벤트에 재시도 시간을 포함한다. 칸을 완료할 때와 다음 문제가 실제로 열릴 때 초기화하므로 800ms 전환 모션은 제외한다. 새 연습에서는 십의 자리 부분곱의 일의 자리 0도 직접 입력하며 시간·채점 이벤트를 포함한다. 이전 기록의 자동 0은 입력 이벤트가 없다.

문제별 시간 감점은 `floor(sum(min(정답 칸 ms,20000)) / (5000 × 입력 칸 수))`이며 최대 4점이다. 전체 완료 점수는 `max(0,1000 − 오답 수 × 30 − 문제별 시간 감점 합계)`이다. 올림 칸 수로 평균을 계산하므로 난이도별 최대 감점은 같고, 정답을 모두 맞힌 기록은 최소 980점이다. 전체 풀이 시간이나 전환·결과 대기 시간은 점수에 쓰지 않는다.

새 시작은 `timeScoring:true`와 `manualZero:true`를 요청하여 `gugudan_vertical_begin_manual`을 사용한다. 서버가 저장한 `scoring_version=2` 기록만 시간 채점한다. 이전 앱의 시작과 기존 기록은 기본값 1로 유지한다. 응답에 시간·수동 0 플래그가 없는 이전 API는 이전 채점을 사용한다. 기존 완료 점수는 재계산하지 않는다. 시간 이벤트는 정수·범위·같은 칸 재시도 시 비감소를 서버에서도 검증하고 점수를 재계산한다. 반응시간 조작을 방지하는 시험용 인증은 제공하지 않는다.

로컬 검증: 위 fixture DB에 `vertical-cell-time.sql` 적용 후 `PGHOST=127.0.0.1 PGPORT=55432 PGDATABASE=99dan_vertical_score_cell_20261003 PSQL=/opt/homebrew/bin/psql node --experimental-strip-types tests/vertical-cell-time.pg.mjs`. 새 시간 채점 21가지와 기존 `vertical-score.pg.mjs`, `vertical-recommendation.pg.mjs`가 통과했다. 이후 수동 0까지 적용한 새 빈 DB에서도 회귀 검증이 통과했다.

## 완성 식 빈칸 문항
`vertical-variety.sql`은 구현 원본이며 2026-10-03 사용자 승인 후 migration `20261003034931_gugudan_vertical_variety`와 `gugudan-api` version 12 ACTIVE로 운영 반영했다. 적용된 운영 DB에 원본 SQL을 다시 실행하지 않는다. `gugudan_vertical_questions_variety`는 모든 세트에서 0으로 끝나는 곱하는 수를 최대 한 문항으로 제한하고, 약 25% 확률로만 포함하며, 기존 올림 비중을 유지해 순서를 무작위로 섞는다. 中·上의 빈칸에는 위의 수와 곱하는 수의 숫자를 찾는 유형을 추가하되, 알려진 부분곱 한 줄로 답이 유일해지도록 구성한다. `puzzleOperands:true`를 `puzzles:true/manualZero:true`와 함께 요청할 때만 새 `gugudan_vertical_begin_variety`를 사용한다. 이전 version 11 응답과 기존 기록의 호환성을 유지한다. 기존 문항·완료 기록·채점값은 그대로 검증한다. 운영 채점·인증과 기존 기록·설정의 개수 및 해시 보존을 확인했다. 상세 검증은 `.omo/evidence/vertical-variety-qa.md`와 `.omo/evidence/vertical-variety-deployment-qa.md`.

`vertical-puzzles.sql`은 구현 원본 SQL이다. 2026-10-03 사용자 승인 후 운영 migration `20261003032217_gugudan_vertical_puzzles`를 적용하고 `gugudan-api` version 11 ACTIVE로 재배포했다. 실제 운영 이력 버전으로 migration 파일을 저장했다. 테이블과 기존 기록은 변경하지 않고 문항 생성·시작·완료 검증·통계 함수를 추가하거나 교체했다. 신규 DB는 통합 migration `20261003024558_gugudan_vertical_cell_time_counts_manual_zero` 이후 이 migration을 적용한다. 적용된 운영 DB에 원본 SQL을 다시 실행하지 않는다.

`verticalBegin`의 `puzzles:true`는 `manualZero:true`를 요구하고, 새 `gugudan_vertical_begin_puzzles`를 호출한다. 교사 설정 中의 10문제는 3문항 × 부분곱 두 칸, 上은 5문항 × 부분곱 두 칸과 답 한 칸을 비운다. 문항·빈칸은 무작위로 정해 서버의 `questions`에 저장하며 ID 재시도 시 그대로 반환한다. 下·5문제는 순서 입력 문항을 유지한다. 새 플래그를 보내지 않는 이전 앱은 기존 출제 RPC를 사용하고, 새 플래그를 지원하지 않는 API의 응답은 클라이언트가 기존 문항으로 처리한다.

빈칸 문항에서는 같은 문제의 미완성 칸만 순서와 무관하게 채점하고, 이미 맞힌 칸의 재제출·다른 문항으로 건너뛰기·불완전 제출을 거부한다. 시간은 칸마다 비감소를 검사하고 실제 입력 칸만 평균에 포함한다. 기존 문제당 200점·오답 −30점·시간 감점 최대 4점과 5/10문제 별도 순위를 유지한다. 이전 순서 입력 기록은 종전 방식으로 검증한다. 새 함수는 `SECURITY INVOKER`, 빈 `search_path`, service_role 전용 권한을 사용한다.

검증: `npm run build`, `node --experimental-strip-types --test tests/*.test.mjs` (43개), Edge strict TypeScript 검사. 격리된 fixture DB에 SQL 적용 후 `PGHOST=127.0.0.1 PGPORT=55432 PGDATABASE=99dan_vertical_score_puzzles_20261003 PSQL=/opt/homebrew/bin/psql node --experimental-strip-types tests/vertical-puzzles.pg.mjs`로 8,100개 계산의 ID 순서, 16,200개 빈칸 구성의 숫자 일치, 36개 기존/수동 0/빈칸 × 문제 수/난이도/시간 조합과 서버 검증을 확인했다. 실제 브라우저에서 中·上 10문제 완주, 역순 입력, 오답, 자동 전환, 칸별 시간 누적, 320px 레이아웃을 확인했다. 상세 기록은 `.omo/evidence/vertical-puzzles-qa.md`에 있다.

운영 검증: 배포 소스와 로컬 일치, 기존 custom signed auth와 `verify_jwt=false` 유지. `supabase/tests/vertical-puzzles-deployment.sql`로 service_role의 5/10문제 × 下/中/上 6개 구성, 빈칸 역순 입력, 오답·시간 점수, 불완전 제출 거부, 시작·완료 재시도, 통계를 검사 후 롤백했다. API 인증·조회·입력 검증 11개 검사 통과. 적용 전후 플레이어 23명·구구단 풀이 667개·주간 기록 65개·설정 1개·두 자리 수 풀이 10개의 개수와 전체 필드 해시가 일치했다. 새 함수 6개의 공개 역할 실행 차단과 service_role 실행 권한, SECURITY INVOKER·빈 search_path를 확인했다. Advisor의 구구단 RLS no policy INFO는 서비스 역할 전용 설계이며 공개 테이블 접근은 차단돼 있다. [공식 RLS 진단 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). 배포 상세 기록은 `.omo/evidence/vertical-puzzles-deployment-qa.md`에 있다.

## 5·10문제와 별도 순위

`vertical-question-count.sql`은 구현 원본 SQL이다. `vertical-cell-time.sql` 다음에 적용하며, 현재는 위 통합 migration으로 운영 반영되었다.

10문제의 올림 없음/곱셈 올림만/덧셈 올림 포함 비중은 下 4/4/2, 中 2/4/4, 上 0/2/8이다. 서버가 무작위 중복 없는 문항을 생성한다. 새 `gugudan_vertical_begin_count`는 학생 서명 번호·교사 설정·5/10문제 수를 검증하고 같은 ID에서 문제 수를 바꾸는 재시도를 거부한다. 기존 5문제 시작 RPC는 유지한다.

서버 완료 검증은 저장된 문항 길이를 사용한다. 10문제를 다 풀기 전에 제출하거나 다른 학생의 ID, 문항·칸 순서, 시간 형식·범위가 잘못되면 거부한다. 문제당 200점·오답 −30점·칸별 시간 감점을 유지해 최대 점수는 5문제 1,000점·10문제 2,000점이다. score CHECK의 상한을 2,000으로 변경하며 기존 완료 점수는 재계산하지 않는다.

`gugudan_vertical_leaders_count`는 5/10문제별로 모든 난이도의 최근 7일 학생별 최고 점수 상위 5명을 반환한다. 기존 `gugudan_vertical_leaders()`는 5문제만 반환한다. Edge 요청의 count는 5/10만 허용하며 생략하면 5다. 새로운 시작·순위 함수의 anon/authenticated 직접 접근을 차단하고 service_role만 허용한다. SECURITY INVOKER와 빈 search_path를 유지한다. 권한 검토 근거: [Supabase Database Functions](https://supabase.com/docs/guides/database/functions).

로컬 검증: `PGHOST=127.0.0.1 PGPORT=55432 PGDATABASE=99dan_vertical_score_count_20261003 PSQL=/opt/homebrew/bin/psql node --experimental-strip-types tests/vertical-count.pg.mjs`. 18개 세트의 난이도 비중·중복·채점 일치·완료 검증·재시도·별도 순위·공개 역할 차단이 통과했다. 과거 가상 순위가 섞인 복제 DB에서 기존 순위 회귀 검사가 실패했으므로 자료를 삭제하지 않고 새 빈 DB에 fixture와 전체 스키마를 설치해 다시 실행했고 기존 5문제·8,100개 계산·교사 추천·시간 채점 검증도 통과했다.

## 교사 종류별 기록 초기화

학생 상세의 `기록 초기화 → 종류 선택`에서 구구단 1·2·3분, 두 자리 수 5·10문제를 여러 개 선택한다. 선택한 종류의 완료 도전·최고점·순위를 삭제하고 다른 종류·학생·누적 정오답·레벨·펫·난이도 설정·진행 중 도전은 유지한다. 두 자리 수의 삭제된 완료 도전은 교사 추천 통계에서도 제외된다. 기존 개인/전체 초기화는 별도로 유지한다.

2026-10-05 승인 후 `teacher-reset-scopes.sql`을 migration `20261005052414_gugudan_teacher_reset_scopes`로 먼저 적용하고 `gugudan-api` version 14를 배포했다. 새 `teacherResetScoped`는 서명된 교사 인증과 학생 번호·종류 목록을 검증하며 service_role 전용 `gugudan_teacher_reset_scoped(integer,jsonb)`를 호출한다. 새 API의 `canResetScopes:true`가 없으면 클라이언트가 종류 선택을 비활성화한다. 이전 전체 초기화 API로 대체하지 않는다. 주간 순위 트리거는 이미 있던 세션 ID의 재등록을 막아 기록 삭제가 남은 순위의 날짜를 갱신하지 않는다.

로컬 검증: `PGHOST=127.0.0.1 PGPORT=55432 PGDATABASE=99dan_teacher_reset_scopes_20261005 PSQL=/opt/homebrew/bin/psql node tests/teacher-reset.pg.mjs`. 31가지 선택 조합, 재시도, 보존 범위, 잘못된 입력, 순위 트리거, 권한을 확인하고 시험 변경을 롤백했다. 56개 테스트·빌드·API/QA TypeScript 검사와 실제 브라우저의 모바일 선택/실패/재시도/이전 서버 동작을 검증했다. 상세: `.omo/evidence/teacher-reset-scopes-qa.md`.

운영 검증: 다섯 단일 종류와 동시 초기화·재시도·전체 테이블 보존 비교를 트랜잭션에서 실행 후 롤백했다. 인증/순위 조회 HTTP 22개 검사 통과. 배포와 검사 전후 기존 행 개수 및 전체 필드 해시가 일치했다. 프론트엔드 정식 배포와 Git commit/push는 수행하지 않았다. 상세: `.omo/evidence/teacher-reset-scopes-deployment-qa.md`.

## 십의 자리 부분곱의 0 직접 입력

`vertical-manual-zero.sql`을 시간·문제 수 SQL 다음에 적용한다. 새 연습은 십의 자리 부분곱의 일의 자리 0을 먼저 직접 입력한다. 정답 확인 전에는 다음 칸으로 진행할 수 없으며 점수·시간·정답 모션과 오답 −30점은 다른 입력 칸과 같다. 입력한 0은 일반 숫자 색상이며 덧셈에서 사용하는 칸일 때 파랑으로 표시한다.

서버가 저장한 `manual_zero=true`와 시작 응답의 `manualZero:true`로 입력 순서를 맞춘다. 기존 기록은 false로 유지하여 채점 순서·완료 점수를 보존한다. 0을 건너뛴 제출, 이전 방식의 ID를 수동 0 방식으로 재사용하는 요청은 거부한다. 첫 시도 통계도 새 입력 순서로 계산한다.

로컬 검증: `PGHOST=127.0.0.1 PGPORT=55432 PGDATABASE=99dan_vertical_score_zero_20261003 PSQL=/opt/homebrew/bin/psql node --experimental-strip-types tests/vertical-zero.pg.mjs`. 8,100개 숫자·통계 분류 순서, 기존/수동 0 × 5/10문제 × 난이도 × 시간 여부의 24개 세트, 건너뛰기·오답·재시도·통계·직접 접근 차단을 검증했다. 프론트엔드 빌드와 38개 테스트, Edge strict TypeScript 검사도 통과했다.

운영 검증: 배포 소스가 로컬과 같고 version 10 ACTIVE, 기존 custom auth/verify_jwt=false가 유지됨을 확인했다. 5/10문제 순위 요청은 200, 인증 없는 요청과 학생의 교사 조회는 401, 잘못된 ID·문제 수·플래그·시간 요청은 400이다. 5/10문제 시작·전체 제출·재시도 RPC는 운영 트랜잭션에서 검사 후 롤백했다. 적용 전후 플레이어 23명·구구단 풀이 667개·주간 기록 65개·설정 1개·두 자리 수 풀이 10개의 개수와 기존 필드 해시가 같다. 기존 두 자리 수 기록은 모두 scoring_version=1/manual_zero=false다. 공개 역할의 새 RPC 접근을 차단했고 service_role만 허용했다. 보안 advisor의 RLS 정책 없음 INFO는 service_role 전용 접근 설계와 관련되며 구구단 공개 역할 테이블 접근 차단을 유지했다. 관련 근거: [RLS Enabled No Policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
