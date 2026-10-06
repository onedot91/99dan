# 칸별 점수 운영 반영과 곱셈 기호 색상

2026-10-05. 사용자의 운영 SQL/API 반영 승인과 계산 단계별 곱하기 기호 색상 변경 요청을 처리했다.

- 대상은 기존 운영 프로젝트 dxibhawclfhoabfgwria다. 배포 전 gugudan-api version 15와 이전 채점 함수를 읽고, 준비한 코드가 cellScoring 검사·분기만 추가하는 것을 확인했다. 신규 열/RPC가 아직 없는 것도 확인했다.
- migration 20261005070249_gugudan_vertical_cell_scoring 적용 성공. 도구가 반환한 실제 버전으로 동일 SQL을 저장했다. 기존 cell_scoring 기본 false, 새 시작에만 true, 기존 ID/모드 변환 거절, 새·이전 순위 분리를 적용했다.
- gugudan-api version 16 ACTIVE. 배포 후 다운로드한 index.ts가 준비한 소스와 정확히 일치한다. 기존 verify_jwt=false와 내부 서명 인증을 유지했다.
- 운영 SQL 480개 사례 통과. 새 칸별 기준·이전 tightTime·이전 시간 기준·무시간 기준, 5/10문제, 세 난이도, 1~20초를 조합했다. 정답 점수, 오답 −10/이전 −30, 시작과 완료 재전송, 모드 혼용 차단, 새 순위, 공개 역할의 RPC 실행 차단을 확인했다. 시험 기록과 임시 난이도 변경은 REPEATABLE READ 트랜잭션 안에서 모두 롤백했다. 파일: supabase/tests/vertical-cell-scoring-deployment.sql.
- 운영 HTTP 23개 통과. 미인증 차단, 잘못된 플래그·모드·문제 수·ID 차단, 기존·tightTime·cellScoring 5/10문제 순위 조회를 확인했다. 학생 서명 발급은 메모리에만 유지했고 도전 시작·완료 저장 요청은 보내지 않았다. 파일: tests/vertical-cell-scoring-http.mjs.
- 배포 전과 검증 후 기존 전체 필드 집계 해시/개수가 일치한다. players 23, runs 755, weekly 66, assignments 19, vertical 11. vertical 해시에서는 추가 cell_scoring 필드만 제외했으며 기존 11개 기록 모두 cell_scoring=false임을 확인했다. 점수를 삭제하거나 재계산하지 않았다.
- 앞선 관련 Node 테스트 63개와 로컬 PostgreSQL/JS 점수 비교 576개 통과. 이번 색상 수정 후 npm run build 및 git diff --check 통과.

곱하기 기호는 현재 계산 중인 일반 세로식에서 data-product를 설정한다. 일의 자리 단계는 기존 product-ones 색상 rgb(184,50,74), 십의 자리 단계는 product-tens 색상 rgb(39,102,199)를 사용한다. 덧셈, 완료된 식, 완성된 식의 빈칸 문항은 검정이다. 단계별 색상에 새 색상을 별도로 만들지 않았다.

검증용 999 세션의 실제 59×96 화면에서 일의 자리 단계 × 빨강을 확인하고 4·5·5·3을 입력한 뒤 십의 자리 단계 × 파랑, 다음 0·1·8·3·5를 입력한 뒤 덧셈 단계 × 검정 rgb(0,0,0)을 확인했다. screenshot은 /private/tmp/99dan-operator-red.png, /private/tmp/99dan-operator-blue.png다. 시험 화면은 서버 기록을 저장하지 않으며 생성한 탭은 검증 후 닫는다.

주요 UI 변경 파일은 src/components/VerticalScreen.tsx와 src/vertical.css다. 현재 localhost 화면에 반영됐으며 프론트엔드 정식 호스팅 배포와 Git commit/push는 진행하지 않았다.
