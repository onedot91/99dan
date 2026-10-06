# Teacher selective reset QA

Implemented student-specific selection of 구구단 1분/2분/3분 and 두 자리 수 5문제/10문제. Default mode is selective reset with no categories checked. Existing student/class full resets remain separate. Selected completed challenges, best scores and rankings are removed; cumulative facts, levels, pets, difficulty assignments and unfinished runs remain.

The new teacher-only `teacherResetScoped` action calls `gugudan_teacher_reset_scoped`. It never falls back to the old full-reset action. Missing `canResetScopes` capability disables selective reset. Deploy SQL before API; production application is pending user approval.

## Checks

- `node --test tests/*.test.mjs`: 56 tests passed, including signed teacher authentication, malformed category/student rejection, all 31 valid selections and legacy capability parsing.
- Isolated local PostgreSQL database `99dan_teacher_reset_scopes_20261005`, host 127.0.0.1/port 55432. `supabase/teacher-reset-scopes.sql` applied locally. `tests/teacher-reset.pg.mjs` verified all 31 selections and idempotent retries, matching finished run removal, unfinished run preservation, other category/student preservation, unchanged facts/ordinal/pets/assignments, invalid input rejection and service-role-only execution. Fixture mutations rolled back per case.
- Weekly trigger regression: shrinking sessions does not recapture an old score or refresh its date; appending a fresh ID still captures the new result. Unselected leaderboard rows remain byte-for-byte equivalent in parsed snapshots.
- Main build and strict TypeScript checks for the API and QA entries passed. No lint script is configured; the declined LSP installation was not required.
- Actual browser interactions on synthetic `tests/mobile-ui-preview.html?screen=teacher`: empty selection disabled; mixed categories submitted successfully; matching best/session entries disappeared while other scores and cumulative correct/level remained; a simulated 503 retained selection and enabled retry; retry succeeded; legacy server capability disabled selection; full reset mode warning and class typed-confirmation gate remained. Full resets were canceled.
- Final dialog layouts: 320×568 (278×470), 390×844 (348×461), 667×375 (420×351, content scrolls), 1280×800 (420×442). No horizontal overflow; selectable labels at least 44px tall. Landscape cancel was reachable by scrolling. Browser warning/error logs were empty.
- Screenshots: `/private/tmp/99dan-teacher-reset-scopes-mobile.jpg` and `/private/tmp/99dan-reset-{320,390,667,1280}.jpg`.

No production data reset, migration, deployment, Git commit or push occurred for this feature.
