# 0으로 끝나는 곱하는 수의 한 줄 답안

2026-10-03. 요청: 곱하는 수의 일의 자리가 0이면 부분곱을 두 줄로 나누지 않고 결과를 바로 입력.

- 새 문항에 `directZero:true` 표시를 저장. 예: 66×90은 답 한 줄 5940, 입력 0 → 4 → 곱셈 올림 5 → 9 → 5. ×0 부분곱과 마지막 덧셈을 생략. 자리 맞춤 0과 올림은 실제 입력·채점한다.
- 5/10문제, 下/中/上 올림 비중·0 최대 1문항·중복 없는 숫자 구성 유지. 中/上 빈칸 3/5문항은 0으로 끝나지 않는 곱하는 수에 배정.
- 문제당 200점, 오답 −30점, 칸별 시간·문제당 최대 −4점 유지. 이전 문항은 표시가 없으므로 기존 입력 순서와 점수를 보존. 이전 API는 새 요청 표시를 무시하며, 클라이언트는 응답에 따라 이전 방식으로 동작.
- SQL 원본은 `supabase/vertical-direct-zero.sql`. 새 출제/시작 함수 두 개와 기존 채점 칸 함수 확장. SECURITY INVOKER, 빈 search_path, 새 RPC는 service_role만 실행. 테이블 변경·기존 기록 재계산 없음.

## 자동 검증

- `npm run build`: 통과, 80 modules.
- `node --experimental-strip-types --test tests/*.test.mjs`: 53/53 통과.
- 810개 두 자리 수 × 10의 배수: 최종 답 일치, 불필요한 부분곱/덧셈 단계 없음, 곱셈 올림 유지.
- 6개 난이도/문제 수 조합 × 100세트: 기존 올림 비중·빈칸 문항 수, 저장·복원 검증.
- 기존 서명 세션 신원과 교사 난이도 사용, 잘못된 directZero/연관 플래그는 RPC 전에 400 거부.
- QA 진입점 strict TypeScript 및 Edge strict TypeScript 검사 통과. `git diff --check` 통과. 사용자가 설치를 거절한 LSP는 사용하지 않았고 의존성 추가 없음.
- localhost:55432의 격리 DB `99dan_vertical_direct_zero_20261003`에 SQL 적용 후 `tests/vertical-direct-zero.pg.mjs` 통과. 810개 숫자/숙련도 매핑 JS/SQL 일치, 24,300개 이전 피연산자 빈칸 매핑 호환, 새/이전 4개 모드 × 5/10문제 × 下/中/上 × 시간 적용 여부의 48개 조합 채점·통계·오답·역순 선택·재시도 확인. 중복 정답·불완전 제출 거부, 공개 역할의 시작 RPC 실행 차단. SQL 240개 세트의 0 빈도 상한 확인. 고정 66×90 채점은 격리 DB의 가상 QA 시작 기록만 교체해서 검사.

## 실제 화면

실제 VerticalPlay/Progress/useVerticalGame을 사용하는 QA 진입점, 학생 999 로컬 연습. 운영 학생의 도전을 시작·제출하지 않음.

- 320×568에서 0 → 4 → 올림 5 → 9 → 5 입력. 결과 5940 한 줄, 가로선 하나. 칸마다 점수가 반영되고 정답 모션 후 둘째 20×87로 자동 전환.
- 320×568, 390×844, 568×320, 667×375, 844×390, 1280×800: 문서 가로/세로 넘침 0, 숫자 패드 최소 높이 44px, 답안 한 줄 유지.
- 568×320의 곱셈 올림 입력 타깃 74×44px. console warn/error 없음.
- 실제 iOS Safari/Android 기기 검증은 미실시. 사용자 승인 후 운영 SQL/API는 migration `20261003043756_gugudan_vertical_direct_zero`와 version 13 ACTIVE로 반영 완료. 실제 운영 버전의 SQL을 supabase/migrations에 동기화했다. 프론트엔드 정식 배포·Git commit/push는 미실시. 상세: [운영 검증](vertical-direct-zero-deployment-qa.md).

![한 줄 결과](/private/tmp/99dan-direct-zero-complete.jpg)

![가로 화면 올림](/private/tmp/99dan-direct-zero-landscape.jpg)
