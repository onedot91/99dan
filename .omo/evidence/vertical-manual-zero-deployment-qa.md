# 수동 0 입력과 운영 반영 검증

- 요청: 십의 자리 부분곱에 자동 표시되던 회색 0을 학생 입력 칸으로 전환. 이후 사용자가 칸별 시간·10문제 SQL 적용과 API 재배포 승인.
- 변경: 새 시작에 manualZero를 추가. tens:0을 먼저 확인하고 다음 부분곱 칸으로 진행. 점수·시간·오답·피드백·첫 시도 통계 포함. 기존 transcript와 완료 기록은 플래그 없음/false로 이전 순서 유지.
- 화면: 별도 예비 번호 탭에서 60 × 23 실행. 일의 자리 결과 180 완료 뒤 십의 자리 부분곱의 일의 자리에 빈 노란 입력 칸이 표시됨. fixed-zero DOM 0개. 잘못된 1 제출 시 같은 칸 aria-invalid=true, 점수 54→24. 0 정답 시 다음 십의 자리 칸으로 이동, 점수 24→42. 채운 0 색상 rgb(28,22,56). 390×720 가로 넘침 없음.
- 증거: `/private/tmp/99dan-manual-zero-input.png`.
- 빌드/검사: npm run build 통과(80 modules). tests/*.test.mjs 38개 통과. Edge strict TypeScript 검사 통과. LSP는 사용자가 설치를 거절한 상태이며 CLI 컴파일 검증 사용.
- 로컬 SQL: 수동 0 숫자·skills 8,100개 순서 일치. 기존/새 5/10문제 × 난이도 × 시간 여부 24개 세트의 JS/SQL 점수, 0 오답·건너뛰기 거부·불완전 제출·재시도·첫 시도 통계·역할 권한 통과.
- 기존 회귀: 복제 DB의 과거 가상 완료 순위 때문에 기존 ranking 검사 처음 실패. 자료를 삭제하지 않고 새 빈 `99dan_vertical_score_zero_regression_20261003`에 fixture 설치 후 기존 8,100개 채점·순위 회귀, 21개 시간 사례, 8,100개 통계·교사 추천 검사 통과.
- 운영: School_Timer의 승인된 migration `20261003024558_gugudan_vertical_cell_time_counts_manual_zero` 적용. 실제 이력 버전으로 로컬 migration 파일 저장. gugudan-api version 10 ACTIVE, 소스 일치, 기존 verify_jwt=false와 custom signed identity 유지.
- 운영 API: 5/10문제 순위 200, 무인증 순위/학생 교사 조회 401, 잘못된 시작 ID·manualZero·count·ms 400.
- 운영 RPC: 트랜잭션 안에서 5/10문제 수동 0·시간 시작, 모든 정답 제출, 1000/2000 점수, 동일 제출 재시도 검사 후 rollback. 검증 풀이 기록은 남기지 않음.
- 보존: 적용 전후 플레이어 23명, 구구단 풀이 667개, 주간 기록 65개, 설정 1개, 두 자리 수 풀이 10개의 개수·기존 필드 해시 일치. 기존 두 자리 수 10개 모두 legacy 모드 유지.
- 보안: 공개 anon/authenticated 새 함수 실행 false, service_role true. 새 함수 security invoker/빈 search_path 확인. Advisor RLS no policy INFO는 서비스 역할 전용 설계이며 공개 역할 테이블 접근은 차단됨.
- 운영에 데이터 삭제·학생 설정 변경·완료 점수 재계산 없음. Git 커밋/푸시 및 별도 프론트엔드 호스팅 배포는 요청하지 않아 실행하지 않음.
