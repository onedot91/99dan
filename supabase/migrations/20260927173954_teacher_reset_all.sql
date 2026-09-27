begin;

create function public.gugudan_teacher_reset_all() returns void
language plpgsql security invoker set search_path='' as $$
begin
 delete from public.gugudan_runs;
 delete from public.gugudan_weekly_leaders;
 update public.gugudan_players set records='{}',sessions='[]',best='{}',ordinal=0;
end; $$;

revoke all on function public.gugudan_teacher_reset_all() from public,anon,authenticated;
grant execute on function public.gugudan_teacher_reset_all() to service_role;

commit;
