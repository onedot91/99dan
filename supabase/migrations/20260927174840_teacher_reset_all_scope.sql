begin;

create or replace function public.gugudan_teacher_reset_all() returns void
language plpgsql security invoker set search_path='' as $$
begin
 delete from public.gugudan_runs where student_number between 1 and 23;
 delete from public.gugudan_weekly_leaders where student_number between 1 and 23;
 update public.gugudan_players set records='{}',sessions='[]',best='{}',ordinal=0 where student_number between 1 and 23;
end; $$;

commit;
