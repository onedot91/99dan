begin;
set local role service_role;
do $$ begin
 if public.gugudan_vertical_assignment(1)->>'difficulty'<>'1' then raise exception 'Default must be easy'; end if;
 if jsonb_array_length(public.gugudan_teacher_vertical_assignments())<>23 then raise exception 'Expected 23 students'; end if;
 perform public.gugudan_teacher_set_vertical(1,3);
 if public.gugudan_vertical_assignment(1)->>'difficulty'<>'3' then raise exception 'Assignment did not persist'; end if;
 if public.gugudan_vertical_assignment(2)->>'difficulty'<>'1' then raise exception 'Other student changed'; end if;
 perform public.gugudan_teacher_set_vertical(1,2);
 if public.gugudan_vertical_assignment(1)->>'difficulty'<>'2' then raise exception 'Update did not persist'; end if;
 begin
  perform public.gugudan_teacher_set_vertical(24,1);
  raise exception 'Invalid student accepted';
 exception when raise_exception then if sqlerrm<>'INVALID_STUDENT' then raise; end if;
 end;
 begin
  perform public.gugudan_teacher_set_vertical(1,4);
  raise exception 'Invalid difficulty accepted';
 exception when raise_exception then if sqlerrm<>'INVALID_DIFFICULTY' then raise; end if;
 end;
end $$;
set local role anon;
do $$ begin
 begin
  perform * from public.gugudan_vertical_assignments;
  raise exception 'Anonymous table access allowed';
 exception when insufficient_privilege then null;
 end;
 begin
  perform public.gugudan_teacher_set_vertical(1,3);
  raise exception 'Anonymous write allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
set local role authenticated;
do $$ begin
 begin
  perform public.gugudan_teacher_set_vertical(1,3);
  raise exception 'Authenticated direct write allowed';
 exception when insufficient_privilege then null;
 end;
 if has_function_privilege('authenticated','public.gugudan_vertical_assignment(integer)','execute') then raise exception 'Direct read RPC exposed'; end if;
end $$;
rollback;
