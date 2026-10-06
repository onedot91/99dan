# 빈칸 문항 운영 배포 검증

2026-10-03. 사용자가 새 SQL 적용과 `gugudan-api` 재배포를 `ㅇㅇ`로 승인했다. 대상은 현재 99dan 프로젝트가 사용하는 School_Timer (`dxibhawclfhoabfgwria`)다.

- 운영 상태 ACTIVE_HEALTHY, 기존 API version 10 ACTIVE 및 custom signed auth/verify_jwt=false 확인.
- 배포 전 소스 비교: API의 puzzles 요청 타입 검사와 새 RPC 분기만 추가됨. 나머지 운영 소스와 일치.
- `supabase/vertical-puzzles.sql`을 migration `20261003032217_gugudan_vertical_puzzles`로 적용 성공. 서버 이력에서 실제 버전을 확인해 동일 이름의 로컬 migration 파일 저장.
- `gugudan-api` version 11 ACTIVE 배포 성공. 다시 읽은 운영 파일이 로컬 `index.ts`와 정확히 일치. 기존 verify_jwt=false와 서명 번호 세션 검증 유지.
- 운영 `supabase/tests/vertical-puzzles-deployment.sql` 통과. service_role로 5/10문제 × 下/中/上 6개 구성, 中 3/上 5 빈칸 문항, 역순 입력, 오답 −30점·칸당 10초의 문제당 시간 감점 2점, 불완전 제출 거부, 시작·완료 동일 재시도, 첫 시도 통계 검증 후 rollback. 검증용 기록을 남기지 않음.
- 운영 HTTP 11개 검사 통과: 세션 발급·난이도 설정 조회·5/10순위 200, 무인증 순위와 학생의 교사 조회 401, 잘못된 ID·puzzles 타입·manual 플래그 누락·문제 수·음수 시간 400. 세션 토큰·순위 학생 데이터는 로그에 출력하지 않음. 실제 교사 번호를 사용하거나 풀이 저장·설정 변경을 하지 않음.
- 배포 전/직후/검증 후 동일한 전체 필드 해시와 개수: 플레이어 23, 구구단 풀이 667, 주간 기록 65, 난이도 설정 1, 두 자리 수 풀이 10. 삭제·재계산 없음.
- 새 함수 및 교체 함수 6개: SECURITY INVOKER, 빈 search_path, anon/authenticated execute=false, service_role=true. 설정·풀이 테이블 RLS=true, 공개 역할 SELECT=false.
- Security advisor의 구구단 항목은 RLS enabled no policy INFO만 확인. 공개 역할 직접 접근은 차단돼 있어 기존 service_role 전용 설계 유지. [공식 진단 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- 로컬 기능 검증은 `vertical-puzzles-qa.md`: 빌드, 43개 테스트, Edge strict TypeScript, 36개 격리 DB 조합, 中·上 실제 10문제 완주 및 모바일 레이아웃.
- Git commit/push와 별도 프론트엔드 호스팅 배포는 수행하지 않음. localhost의 현재 프론트엔드는 새 API를 사용한다. 새 中·上 10문제 연습부터 빈칸 문항이 생성됨.

사용한 [Supabase 스킬](/Users/ibyeonghyeon/.codex/plugins/cache/openai-curated-remote/supabase/1.0.0/skills/supabase/SKILL.md). 공식 변경 이력과 [Edge Function 인증 문서](https://supabase.com/docs/guides/functions/auth)를 확인했다.
