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

기존 DB에는 `migrations/20260927000000_question_types_teacher.sql`을 검토한 뒤 적용하고, 새 DB에는 최신 `schema.sql`을 한 번 적용합니다. 그 다음 `gugudan-api` Edge Function을 새 코드로 배포하고 서버 비밀값 `GUGUDAN_TEACHER_CODE`를 교사 번호로 설정해야 합니다. 이 값은 `VITE_` 변수나 Git 파일에 넣지 않습니다. 교사 API는 30분 유효한 서명 토큰을 사용하고, 학생별 기록 조회와 초기화만 허용합니다. 초기화는 해당 학생의 게임 세션·문제 기록·최고 점수를 지우며 School_Timer 프로필은 건드리지 않습니다. 최근 세션 목록은 기존 정책대로 최대 20회만 보관합니다.

기존 점수 규칙에서 시간 감점 방식으로 바꾸는 마이그레이션은 `migrations/20260927154259_accuracy_scoring_time_decay.sql`과 `migrations/20260927154438_accuracy_scoring_time_decay_v2.sql`입니다. 현재 정답 점수는 200점에서 시작해 100ms마다 1점씩 줄고 최소 100점입니다. 두 번째 연속 정답부터 10점씩 더해져 최대 50점이며, 오답은 최대 30점 감점이고 점수는 0점 아래로 내려가지 않습니다. 서버 점수 규칙은 `migrations/20260927160644_nonnegative_scoring_penalty_30.sql`에서 함께 갱신합니다. 기존 세션과 점수 데이터는 보존되고, 최고 점수 화면과 명예의 전당은 현재 규칙 버전의 기록만 표시합니다.

설계 근거: https://supabase.com/docs/guides/api/securing-your-api 및 https://supabase.com/docs/guides/getting-started/api-keys

클라이언트는 세션 만료401에서 같은 번호로 갱신하고1회 재시도합니다. 완료 기록은 탭 내 대기 큐로 다음 게임 중에도 재전송할 수 있습니다. 저장 실패가 표시된 상태에서 탭을 닫거나 새로고침하면 아직 서버에 도착하지 않은 대기 기록은 복구되지 않습니다.
