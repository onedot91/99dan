# 출제 다양성 운영 배포 검증

2026-10-03. 사용자의 “ㅇㅇ” 승인으로 School_Timer에 적용.

- 실제 운영 migration: `20261003034931_gugudan_vertical_variety`. 동일 SQL을 supabase/migrations에 저장.
- gugudan-api: version 12 ACTIVE. 운영 소스와 로컬 소스 일치. 기존 서명 세션 인증과 verify_jwt=false 유지.
- 운영 SQL 트랜잭션 검증: 5/10문제 × 下/中/上 6조합, 0 끝 곱하는 수 최대 1개, 中/上 빈칸 구성 및 上의 네 유형, 역순 입력, 오답 감점, 칸별 시간, 불완전 제출 거부, 시작·완료 재시도, 첫 입력 통계 통과. supabase/tests/vertical-variety-deployment.sql 실행 후 rollback.
- 운영 HTTP 14개 검사 통과: 세션 발급, 난이도 조회, 5/10 순위 조회, 인증 없는 조회와 학생의 교사 조회 거부, 잘못된 ID·문제 수·시간·빈칸 옵션 거부. 성공한 테스트 풀이 기록은 생성하지 않음.
- 신규 함수 3개: SECURITY INVOKER, 빈 search_path, anon/authenticated 실행 불가, service_role 실행 가능.
- 설정·풀이 테이블: RLS 활성, anon/authenticated 직접 SELECT 불가.
- 배포 전후 전체 행 정렬 해시와 개수 동일: 프로필 23, 구구단 풀이 667, 주간 기록 65, 난이도 설정 2, 두 자리 수 풀이 11.
- 보안 advisor는 기존 service_role 전용 테이블의 INFO rls_enabled_no_policy만 보고. [공식 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- 배포 전 로컬 빌드, 48개 테스트, Edge strict TypeScript, SQL 숫자 일치 24,300개 및 36개 호환 조합 통과. 화면 검증은 [로컬 검증](vertical-variety-qa.md) 참고.
- Supabase skill 절차에 따라 migration, 함수 소스, 역할 권한, advisor와 실제 API 응답 검증. 학생별 데이터·키·토큰을 증거에 기록하지 않음.

새 도전부터 새 출제를 사용한다. 기존 기록 재계산, Git commit/push 없음. 실제 학교 기기와 보조기술 검증은 미실시.
