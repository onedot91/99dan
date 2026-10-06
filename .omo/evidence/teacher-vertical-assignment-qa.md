# 학생별 세로셈 세트 검증

## 구현
- 기존 교사 번호 입력과 30분 서명 세션을 사용한다.
- 학생 선택 → 쉬움/보통/어려움 → 고정 5문항 미리보기 → 난이도 저장.
- 기본 쉬움. 세트 비중은 올림 없음/곱셈 올림만/덧셈 올림 포함 기준 2/2/1, 1/2/2, 0/1/4.
- 새 연습은 최신 서버 설정으로 시작하고, 진행 중인 세트와 이전 version 1 저장은 보존한다.
- 기록 초기화가 설정을 지우지 않도록 별도 설정 테이블에 저장한다.

## 검증 결과
- `npm run build` 통과.
- `node --test tests/vertical.test.mjs tests/vertical-api.test.mjs` 10/10 통과. 8,100개 계산, 혼합 세트 비중, 이전 저장 재개, 교사 인증·위조/만료/학생 토큰 거부, 입력 검증, 학생 세션 번호로만 읽기 포함.
- Edge Function의 별도 TypeScript 검사 통과(`tests/edge-runtime.d.ts` 사용).
- 격리된 PostgreSQL 17.11에서 실제 설정 마이그레이션과 `supabase/tests/vertical_assignments.sql` 실행 통과. 기본값, 23명 조회, 저장/업데이트, 학생 간 분리, 잘못된 값 거부, anon/authenticated 직접 접근 거부.
- 실제 IAB에서 가짜 교사 번호와 임시 DB만 사용한 테스트: 1번 어려움, 3번 보통을 각각 저장하고 재조회했다. 2번은 기본 쉬움을 유지했다.
- 별도 교사 탭에서 1번을 쉬움으로 바꿔도 진행 중 어려움 세트는 그대로 재개했다. 68×32, 58×61, 78×63, 87×79, 93×68을 모두 완료했다. 새 5문제 시작은 쉬움 12×13으로 바뀌었다.
- 테스트 API를 종료하고 실패 동작 확인: 교사 저장 실패 안내, 학생 새 시작 비활성화, 기존 이어서 풀기 활성화.
- 1280×650, 320×568에서 가로 넘침 없음. 모바일 교사 학생 목록과 상세 영역이 겹치던 문제를 수정하고 실제 좌표/이미지로 재검증했다.
- `git diff --check` 통과. 추가 의존성·커밋·푸시 없음.

## 증거
`/private/tmp/99dan-teacher-assignment-evidence/`의 teacher-1280.png, teacher-320.png, student-setup-320.png, student-hard-320.png, student-result-320.png, student-next-easy-320.png, teacher-save-error-320.png, student-load-error-320.png.

## 운영 상태
2026-10-02 사용자 승인 후 `20261002045629_vertical_assignments.sql`을 동일 프로젝트에 적용하고 `gugudan-api` version 8을 배포했다(ACTIVE, 기존 custom auth/verify_jwt=false 유지). 운영 SQL 조회에서 기본값 1, 23명, RLS 활성화, anon 테이블 읽기 불가, authenticated setter 실행 불가를 확인했다. 보안 Advisor의 정책 없음 INFO는 공개 권한을 회수한 서비스 전용 테이블에서 의도된 구성이다. 실제 교사 번호로 로그인해 운영 저장하는 검증은 수행하지 않았다. 이어지는 점수/순위 마이그레이션은 별도 검증 중이며 아직 운영에 반영하지 않았다.
