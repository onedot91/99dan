# 교사 난이도 추천 검증

- 2026-10-02. 최근 완료 3세트의 첫 입력 정답률·곱셈 올림·덧셈 올림 기준으로 下/中/上 추천. 각 올림 유형 5칸 이상 필요. 표본 부족이면 배지 숨김.
- 교사 화면 기본 정보는 추천 배지 하나만 추가. 버튼/Enter로 짧은 근거 펼침, 다시 누르면 접힘. 학생 전환 시 근거 접힘. 추천 때문에 현재 설정이 변경되지 않음.
- 첫 시도가 틀린 한 칸을 3회 재시도해도 첫 시도 실패 1개로 집계. 서버가 검증한 완료 입력으로만 통계 생성. 원본 입력은 추가 저장하지 않음.
- Node 테스트 23개 통과: 기준 경계, 반올림 방지, 자료 부족, 이전 응답 호환, 교사 인증, 실제 서버 오류 유지 포함.
- PostgreSQL 8,100개 곱셈의 단계별 올림 분류 대조 통과. 실제 입력·완료 저장·멱등 재시도·최근 3회 집계·완료 전/이전 통계 없는 기록 제외·세 추천 결과·공개 역할 접근 차단 통과.
- 기존 점수 검증을 통계 fixture와 같은 DB에서 실행했을 때 순위 인원 전제가 달라 실패. 별도 빈 DB에 동일 마이그레이션을 적용한 뒤 채점·랜덤 세트·통합 순위·초기화·권한 회귀 검증 통과.
- 실제 로컬 통계 RPC를 가상 학생 교사 API에 연결해 IAB 1280×720, 320×568에서 확인. 上·下·中 추천과 2세트 학생 배지 숨김, 기본 근거 숨김, 모바일 근거 펼침, 직접 선택 자동 저장 확인. 문서 너비 320px, 선택창·추천 버튼 높이 44px.
- 화면: /private/tmp/99dan-teacher-recommendation-evidence/desktop.png, mobile-reason.png
- 운영 마이그레이션 목록에서 설정 마이그레이션만 확인. 아직 배포하지 않은 점수 마이그레이션에 추천 통계와 전용 조회 RPC 추가. 운영 반영은 승인 후 진행.
- Supabase 공식 함수 권한 문서 및 changelog 확인. 기존 SECURITY INVOKER·빈 search_path·service_role 전용 권한 유지. 검증에 영향 있는 신규 Supabase API나 의존성 사용 없음.

## 운영 반영

- 2026-10-02 사용자 승인 후 migration `20261002122652_gugudan_vertical_scores_recommendations` 적용 성공, gugudan-api version 9 ACTIVE 배포 성공. verify_jwt=false 및 기존 HMAC 세션 인증 유지. 배포 소스와 로컬 승인 소스 일치 확인.
- 기존 플레이어 23명, 구구단 도전 665개, 순위 기록 65개 유지. 적용 전후 학습 기록 해시와 학생별 난이도 설정 해시 동일.
- 신규 점수 테이블 RLS=true, anon/authenticated 테이블 읽기/쓰기 및 채점/통계 RPC 실행 권한 없음, service_role 통계 RPC 권한 있음. 점수·추천 통계는 초기 빈 배열 반환.
- 실제 운영 SQL에서 8,100개 곱셈의 숫자 단계와 통계 분류 단계 길이 불일치 0개.
- 운영 API: register/capabilities/verticalAssignment/verticalLeaders 200. 학생 토큰의 teacherRecords 401, 인증 없는 verticalLeaders 401, 잘못된 verticalBegin ID 400. 실제 풀이 기록을 만들거나 교사 번호를 사용한 운영 로그인은 하지 않음.
- 보안 Advisor의 구구단 관련 안내는 RLS Enabled No Policy INFO. 서비스 전용 테이블에서 공개 권한을 회수한 구성이며 의도된 상태. 안내: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

## 현재 사용자 화면 연결 확인

- 2026-10-02 localhost:5173 사용자 탭에서 두 자리수 곱셈 명예의 전당 조회 완료 및 기록 없음 정상 표시 확인. 학생 화면의 난이도 탭 없음.
- 학습 준비 화면에서 서버 설정 로딩 완료, 5문제 시작 버튼 활성화, 오류 알림 0개 확인.
- 기존 2번째 문제부터 이어 풀기 표시 유지. 새 연습 시작 또는 답 입력 없이 조회만 수행하고 처음 화면으로 복귀.
- 화면: /private/tmp/99dan-live-connection-evidence/hall.png, setup.png
