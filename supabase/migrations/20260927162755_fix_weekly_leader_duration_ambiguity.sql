begin;

create or replace function public.gugudan_capture_weekly_leader() returns trigger
language plpgsql security invoker set search_path='' as $$
declare latest jsonb; v_duration smallint; score integer; correct_count integer;
begin
 if jsonb_array_length(new.sessions)=0 then return new; end if;
 latest:=new.sessions->(jsonb_array_length(new.sessions)-1);
 if latest->>'mode'<>'rush' or latest->>'endedEarly'<>'false' or latest->>'scoringVersion'<>'5' then return new; end if;
 v_duration:=(latest->>'duration')::smallint;
 score:=(latest->>'score')::integer;
 correct_count:=(latest->>'correct')::integer;
 insert into public.gugudan_weekly_leaders(student_number,duration,score,correct,scoring_version,achieved_at)
 values(new.student_number,v_duration,score,correct_count,5,clock_timestamp())
 on conflict(student_number,duration) do update
   set score=excluded.score,correct=excluded.correct,scoring_version=excluded.scoring_version,achieved_at=excluded.achieved_at
   where public.gugudan_weekly_leaders.achieved_at<=clock_timestamp()-interval '7 days'
      or excluded.score>public.gugudan_weekly_leaders.score;
 return new;
end; $$;

commit;
