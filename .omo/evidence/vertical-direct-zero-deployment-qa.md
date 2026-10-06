# 한 줄 답안 운영 배포 검증

2026-10-03, 사용자 “ㅇㅇ” 승인에 따라 School_Timer에 적용.

- 운영 migration: `20261003043756_gugudan_vertical_direct_zero`. Supabase가 발급한 실제 버전으로 동일 SQL을 supabase/migrations에 동기화. 기존 테이블·학습 기록·난이도 설정의 데이터 변경 없음.
- `gugudan-api` version 13 ACTIVE, 배포 소스와 로컬 일치. 배포 전 version 12와의 소스 차이는 승인한 directZero 검증/분기 두 줄뿐임을 확인. 기존 서명 세션 인증과 verify_jwt=false 유지.
- `supabase/tests/vertical-direct-zero-deployment.sql` 운영 트랜잭션 검증 후 rollback. 810가지 두 자리 수 × 10의 배수에서 숫자·곱셈 올림 숙련도 매핑 일치, 이전 문항의 채점 순서 보존. 下/中/上 × 5/10문제 6조합의 0 상한·새 문항 표시·빈칸 유형·오답 감점·칸별 시간·불완전 제출 거부·시작/완료 재시도·첫 입력 통계 확인. 고정 66×90 사례도 롤백되는 QA 기록으로 검사.
- `tests/vertical-direct-zero-http.mjs`: 운영 HTTP 16개 통과. stateless 세션 발급, 인증 없는 요청과 학생의 교사 조회 거부, 잘못된 ID·문제 수·모드·시간 거부, 난이도·5/10문제 순위 조회. 성공한 시작/완료 HTTP 호출은 하지 않아 운영 풀이·점수 기록을 생성하지 않음. 토큰·키·학생별 데이터는 출력하거나 저장하지 않음.
- 새 함수 두 개와 확장한 칸 매핑 함수: SECURITY INVOKER, 빈 search_path, anon/authenticated 실행 불가, service_role 실행 가능. 두 자리 수 설정/풀이 테이블의 RLS 활성·공개 역할 SELECT 차단 유지.
- 배포 전후 전체 행 정렬 해시와 개수 동일: 프로필 23, 구구단 풀이 669, 주간 기록 65, 난이도 설정 19, 두 자리 수 풀이 11.
- 보안 advisor는 배포 전후 기존 INFO `rls_enabled_no_policy`만 동일하게 보고. 구구단 테이블은 service_role 전용 설계이며 공개 접근은 차단됨. [공식 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- 배포 전 로컬 빌드·53개 테스트·Edge/QA strict TypeScript·48개 SQL 호환 조합 및 모바일 화면 검증 통과. [구현 검증](vertical-direct-zero-qa.md) 참고.

새 방식은 새 directZero 도전부터 적용. 기존 기록 재계산·Git commit/push·프론트엔드 정식 배포 없음. 실제 학교 기기와 보조기술 검증은 미실시.
