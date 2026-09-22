# School_Timer 연결

기존 `storage_resources`의 `/studentLife/failureProfileAssignments/<번호>`를 읽어 동물 프로필을 공유합니다. 기존 프로필·경제·타이머 데이터에는 쓰지 않습니다. 그림은 School_Timer의 공개 정적 에셋을 같은 경로로 복사해 제공합니다.

`schema.sql`은 새 `gugudan_players`, `gugudan_runs`와 전용 RPC만 추가합니다. 개인 기록은 번호별로 공유하고, 명예의 전당은 도전 시간별 개인 최고점 상위 3명만 반환합니다. 동점은 먼저 달성한 기록, 다음으로 번호 순입니다. 중도 종료와 연습 기록은 순위에 포함되지 않습니다. 제출 ID로 중복 저장을 방지하고 SQL 트랜잭션 안에서 채점·누적·최고점 갱신을 처리합니다.

두 테이블은 RLS가 활성화되며 anon/authenticated 직접 접근은 차단합니다. RPC는 SECURITY INVOKER이며 service_role만 호출합니다. Edge Function은 서명한 번호 세션을 검증한 뒤 RPC를 호출합니다. service_role 키는 Supabase 서버 환경에만 있습니다. 번호 선택은 학생 스스로 선택하는 기존 정책이며 실제 신원 인증/PIN은 아닙니다. 클라이언트 이벤트의 정답과 점수는 서버가 다시 계산하지만 반응시간의 부정 조작까지 검증하는 시험용 서비스는 아닙니다.

2026-09-22 School_Timer에 테이블2개·함수4개·Edge API1개 적용 완료. 현재 로컬 앱의 `.env.local`도 실제 API에 연결되어 있습니다.

새 환경의 설정 순서:
1. 기존 School_Timer에는 이미 적용되어 있으므로 `schema.sql`을 중복 실행하지 않음. 별도 신규 DB에만 초기 스키마로 적용.
2. `gugudan-api` Edge Function 배포. 요청별 자체 서명 세션 인증을 사용하므로 `verify_jwt=false`로 배포.
3. `.env.local`에 `VITE_GUGUDAN_API_URL`과 publishable key를 설정. service_role 키를 VITE 변수에 넣지 않음.
4. 다른 기기의 같은 번호와 1/2/3분 최고 기록을 검증.

현재 키 범위는 기존 School_Timer의 단일 1~23번 학급입니다. 다른 학급/학년을 추가하기 전 학급·연도 식별자를 함께 키에 포함해야 합니다.

설계 근거: https://supabase.com/docs/guides/api/securing-your-api 및 https://supabase.com/docs/guides/getting-started/api-keys

클라이언트는 세션 만료401에서 같은 번호로 갱신하고1회 재시도합니다. 완료 기록은 탭 내 대기 큐로 다음 게임 중에도 재전송할 수 있습니다. 저장 실패가 표시된 상태에서 탭을 닫거나 새로고침하면 아직 서버에 도착하지 않은 대기 기록은 복구되지 않습니다.
