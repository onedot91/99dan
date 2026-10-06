create role anon;
create role authenticated;
create role service_role bypassrls;
create table public.storage_resources(resource_key text,value jsonb,deleted boolean default false);
grant select on public.storage_resources to service_role;
\ir ../supabase/schema.sql
\ir ../supabase/migrations/20260928123945_friends.sql
\ir ../supabase/migrations/20261002045629_vertical_assignments.sql
\ir ../supabase/migrations/20261002052116_vertical_scores.sql
\ir ../supabase/vertical-cell-time.sql
\ir ../supabase/vertical-question-count.sql
\ir ../supabase/vertical-manual-zero.sql
\ir ../supabase/vertical-puzzles.sql
\ir ../supabase/vertical-variety.sql
\ir ../supabase/vertical-direct-zero.sql
\ir ../supabase/vertical-tight-time.sql
