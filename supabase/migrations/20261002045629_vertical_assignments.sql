begin;
create table public.gugudan_vertical_assignments (
  student_number smallint primary key check(student_number between 1 and 23),
  difficulty smallint not null default 1 check(difficulty between 1 and 3),
  updated_at timestamptz not null default now()
);
alter table public.gugudan_vertical_assignments enable row level security;
revoke all on public.gugudan_vertical_assignments from public,anon,authenticated;
grant select,insert,update on public.gugudan_vertical_assignments to service_role;

create function public.gugudan_vertical_assignment(p_student integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('studentNumber',p_student,'difficulty',coalesce(a.difficulty,1))
 from (select p_student as n) input left join public.gugudan_vertical_assignments a on a.student_number=input.n
 where p_student between 1 and 23;
$$;

create function public.gugudan_teacher_vertical_assignments() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_agg(jsonb_build_object('studentNumber',n,'difficulty',coalesce(a.difficulty,1)) order by n)
 from generate_series(1,23) n left join public.gugudan_vertical_assignments a on a.student_number=n;
$$;

create function public.gugudan_teacher_set_vertical(p_student integer,p_difficulty integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if p_student is null or p_student not between 1 and 23 then raise exception 'INVALID_STUDENT'; end if;
 if p_difficulty is null or p_difficulty not between 1 and 3 then raise exception 'INVALID_DIFFICULTY'; end if;
 insert into public.gugudan_vertical_assignments(student_number,difficulty) values(p_student,p_difficulty)
 on conflict(student_number) do update set difficulty=excluded.difficulty,updated_at=now();
 return public.gugudan_vertical_assignment(p_student);
end; $$;

revoke all on function public.gugudan_vertical_assignment(integer),public.gugudan_teacher_vertical_assignments(),public.gugudan_teacher_set_vertical(integer,integer) from public,anon,authenticated;
grant execute on function public.gugudan_vertical_assignment(integer),public.gugudan_teacher_vertical_assignments(),public.gugudan_teacher_set_vertical(integer,integer) to service_role;
commit;
