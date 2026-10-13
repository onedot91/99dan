\ir vertical-cell-scoring-bootstrap.sql
\ir ../supabase/migrations/20261005052414_gugudan_teacher_reset_scopes.sql
\ir ../supabase/migrations/20261006000000_mythic_friends.sql
\ir ../supabase/migrations/20261008000000_gugudan_classroom_concurrency.sql
\ir ../supabase/migrations/20261012000000_vertical_exp.sql
\ir ../supabase/migrations/20261012120000_gugudan_block_runs.sql
\ir ../supabase/migrations/20261013000000_halve_run_exp.sql
-- 일반 PostgreSQL에는 Supabase 기본 service_role DELETE 권한이 없다.
grant delete on public.gugudan_runs,public.gugudan_weekly_leaders to service_role;
