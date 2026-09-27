begin;
create table public.gugudan_weekly_leaders (
  student_number smallint not null references public.gugudan_players(student_number) on delete cascade,
  duration smallint not null check(duration in (1,2,3)),
  score integer not null,
  correct integer not null,
  achieved_at timestamptz not null,
  primary key(student_number,duration)
);
alter table public.gugudan_weekly_leaders enable row level security;
revoke all on public.gugudan_weekly_leaders from public,anon,authenticated;
grant select,insert,update,delete on public.gugudan_weekly_leaders to service_role;

insert into public.gugudan_weekly_leaders(student_number,duration,score,correct,achieved_at)
select p.student_number,(entry.key)::smallint,
       (entry.value->>'score')::integer,
       (entry.value->>'correct')::integer,
       (entry.value->>'achievedAt')::timestamptz
from public.gugudan_players p
cross join lateral jsonb_each(p.best) as entry(key,value)
where entry.key in ('1','2','3')
  and entry.value->>'scoringVersion'='4'
  and entry.value ? 'achievedAt'
  and (entry.value->>'achievedAt')::timestamptz > now()-interval '7 days'
on conflict(student_number,duration) do nothing;

create or replace function public.gugudan_leaders(p_duration integer) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(row),'[]') from (
   select w.student_number as "studentNumber",w.score,w.correct,
     (select value->>'data' from public.storage_resources where resource_key='/studentLife/failureProfileAssignments/'||p.student_number and not deleted) as avatar
   from public.gugudan_weekly_leaders w join public.gugudan_players p using(student_number)
   where w.duration=p_duration and w.achieved_at>now()-interval '7 days' and p_duration in (1,2,3)
   order by w.score desc,w.achieved_at,w.student_number limit 5
 ) row;
$$;

create function public.gugudan_capture_weekly_leader() returns trigger
language plpgsql security invoker set search_path='' as $$
declare latest jsonb; duration smallint; score integer; correct_count integer;
begin
 if jsonb_array_length(new.sessions)=0 then return new; end if;
 latest:=new.sessions->(jsonb_array_length(new.sessions)-1);
 if latest->>'mode'<>'rush' or latest->>'endedEarly'<>'false' or latest->>'scoringVersion'<>'4' then return new; end if;
 duration:=(latest->>'duration')::smallint;
 score:=(latest->>'score')::integer;
 correct_count:=(latest->>'correct')::integer;
 insert into public.gugudan_weekly_leaders(student_number,duration,score,correct,achieved_at)
 values(new.student_number,duration,score,correct_count,clock_timestamp())
 on conflict(student_number,duration) do update
   set score=excluded.score,correct=excluded.correct,achieved_at=excluded.achieved_at
   where public.gugudan_weekly_leaders.achieved_at<=clock_timestamp()-interval '7 days'
      or excluded.score>public.gugudan_weekly_leaders.score;
 return new;
end; $$;

create trigger gugudan_players_capture_weekly_leader
after update of sessions on public.gugudan_players
for each row when(old.sessions is distinct from new.sessions)
execute function public.gugudan_capture_weekly_leader();
revoke all on function public.gugudan_capture_weekly_leader() from public,anon,authenticated;

create or replace function public.gugudan_teacher_reset(p_student integer) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_student is null or p_student not between 1 and 23 then raise exception 'INVALID_STUDENT'; end if;
 delete from public.gugudan_runs where student_number=p_student;
 delete from public.gugudan_weekly_leaders where student_number=p_student;
 update public.gugudan_players set records='{}',sessions='[]',best='{}',ordinal=0 where student_number=p_student;
end; $$;
commit;
