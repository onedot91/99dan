begin;

create or replace function public.gugudan_capture_weekly_leader() returns trigger
language plpgsql security invoker set search_path='' as $$
declare latest jsonb; v_duration smallint; score integer; correct_count integer;
begin
 if jsonb_array_length(new.sessions)=0 then return new; end if;
 latest:=new.sessions->(jsonb_array_length(new.sessions)-1);
 -- Removing history must not recapture an older result as a new weekly record.
 if exists(select 1 from jsonb_array_elements(old.sessions) s where s->>'id'=latest->>'id') then return new; end if;
 if latest->>'mode'<>'rush' or latest->>'scoringVersion'<>'5' then return new; end if;
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

create or replace function public.gugudan_teacher_reset_scoped(p_student integer,p_scopes jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare durations integer[]; counts integer[];
begin
 if p_student is null or p_student not between 1 and 23 then raise exception 'INVALID_STUDENT'; end if;
 if coalesce(jsonb_typeof(p_scopes),'')<>'array' then raise exception 'INVALID_RESET_SCOPES'; end if;
 if jsonb_array_length(p_scopes) not between 1 and 5
 or exists(select 1 from jsonb_array_elements(p_scopes) s where jsonb_typeof(s)<>'string' or s#>>'{}' not in ('rush-1','rush-2','rush-3','vertical-5','vertical-10'))
 or (select count(distinct s) from jsonb_array_elements(p_scopes) s)<>jsonb_array_length(p_scopes)
 then raise exception 'INVALID_RESET_SCOPES'; end if;
 select coalesce(array_agg(right(s,1)::integer),'{}') into durations from jsonb_array_elements_text(p_scopes) s where s like 'rush-%';
 select coalesce(array_agg(substring(s from 10)::integer),'{}') into counts from jsonb_array_elements_text(p_scopes) s where s like 'vertical-%';
 perform 1 from public.gugudan_players where student_number=p_student for update;
 if cardinality(durations)>0 then
   -- Leave active runs untouched; finishing them later creates a new result.
   delete from public.gugudan_runs where student_number=p_student and mode='rush' and duration=any(durations) and finished_at is not null;
   update public.gugudan_players p set
     sessions=coalesce((select jsonb_agg(s order by ord) from jsonb_array_elements(p.sessions) with ordinality v(s,ord)
       where not(s->>'mode'='rush' and (s->>'duration')::integer=any(durations))),'[]'),
     best=p.best-array(select d::text from unnest(durations) d)
   where p.student_number=p_student;
   delete from public.gugudan_weekly_leaders where student_number=p_student and duration=any(durations);
 end if;
 if cardinality(counts)>0 then
   delete from public.gugudan_vertical_runs where student_number=p_student and finished_at is not null and jsonb_array_length(questions)=any(counts);
 end if;
end; $$;

revoke all on function public.gugudan_capture_weekly_leader(),public.gugudan_teacher_reset_scoped(integer,jsonb) from public,anon,authenticated;
grant execute on function public.gugudan_teacher_reset_scoped(integer,jsonb) to service_role;
commit;
