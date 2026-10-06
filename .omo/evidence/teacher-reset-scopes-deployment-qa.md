# 종류별 초기화 운영 반영

2026-10-05 사용자 “ㅇㅇ” 승인에 따라 School_Timer 운영 DB/API에 적용했다.

- Migration `20261005052414_gugudan_teacher_reset_scopes` 적용 성공. Supabase가 발급한 실제 번호로 동일 SQL을 `supabase/migrations`에 저장했다. API보다 DB를 먼저 적용했다.
- `gugudan-api` version 14 ACTIVE. 배포 소스와 로컬이 동일하다. version 13과의 차이는 `canResetScopes:true`, 교사 전용 action 추가, 종류 검증/RPC 분기뿐이다. 기존 서명 인증과 `verify_jwt=false` 유지.
- 새 초기화 함수와 순위 트리거는 SECURITY INVOKER·빈 search_path다. anon/authenticated 실행 불가, service_role 실행 가능을 확인했다.
- `supabase/tests/teacher-reset-scopes-deployment.sql`을 REPEATABLE READ 트랜잭션에서 실행했다. 다섯 단일 종류와 다섯 종류 동시 초기화, 각 재시도, 전체 테이블 비교를 통한 다른 학생/종류/누적 정오답/펫/설정/진행 중 도전 보존, 잘못된 입력 거부가 통과했다. 각 사례는 내부 트랜잭션에서 되돌리고 최종 트랜잭션도 롤백했다. 최초 검증 SQL의 비교식에서 JSON 연산자 괄호가 누락되어 사례 실행 전에 실패했고, 비교식만 수정한 뒤 전체 검증이 통과했다.
- `node tests/teacher-reset-http.mjs`: 22개 운영 HTTP 검사 통과. 인증 없음/학생/만료·위조 교사 토큰의 scoped/full/class reset과 교사 조회는 401. 구구단 1/2/3분과 두 자리 수 5/10문제 순위 조회는 200. 토큰·키·학생별 응답은 출력/저장하지 않았다. 성공한 초기화 HTTP 요청은 보내지 않았다. 실제 교사 로그인으로 초기화하는 UI/API 경로는 합성 브라우저 fixture와 단위 테스트로 확인했고, 운영 DB 함수는 롤백 검증으로 확인했다.
- 배포 전·직후·모든 검사 후 5개 테이블의 전체 필드 정렬 해시와 개수가 일치했다: 프로필 23, 구구단 풀이 755, 주간 기록 66, 난이도 설정 19, 두 자리 수 풀이 11. 실제 기록을 영구 삭제하지 않았다.
- 보안 advisor에서 새 오류/경고는 없다. 기존 `rls_enabled_no_policy` INFO가 남아 있다. 구구단 테이블의 서비스 역할 전용 접근 설계를 유지한다. [공식 진단 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). 함수 권한은 [공식 함수 문서](https://supabase.com/docs/guides/database/functions)에 따라 확인했다.
- 로컬 구현 검증: 빌드·56개 테스트·31개 선택 조합·API/QA strict TypeScript·모바일 네 크기. 상세는 `teacher-reset-scopes-qa.md`.

프론트엔드 정식 배포, Git commit/push는 수행하지 않았다. 현재 개발 교사 화면에서 새로고침하면 운영 API의 새 capability를 받는다.
