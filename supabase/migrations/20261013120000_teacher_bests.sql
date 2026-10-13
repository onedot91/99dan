-- 교사 화면: 구구단 1·3분 최고 점수 옆에 두 자리 수 5·10문제와 블록의 전체 최고 점수도 보여 준다(2026-10-13).
-- 두 자리 수 최고는 학생 내 기록(verticalRecords)과 같이 칸별 채점(cell_scoring) 판만 센다.
begin;
create or replace function public.gugudan_teacher_block_records() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'studentNumber',n,
   'blockExp',public.gugudan_block_exp(n),
   'verticalExp',public.gugudan_vertical_exp(n),
   'blockBest',(select max(score) from public.gugudan_block_runs b where b.student_number=n and b.finished_at is not null),
   'verticalBest',jsonb_build_object(
     '5',(select max(score) from public.gugudan_vertical_runs v where v.student_number=n and v.finished_at is not null and v.cell_scoring and jsonb_array_length(v.questions)=5),
     '10',(select max(score) from public.gugudan_vertical_runs v where v.student_number=n and v.finished_at is not null and v.cell_scoring and jsonb_array_length(v.questions)=10)),
   'blockSessions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'finishedAt',finished_at,'score',score,'solved',solved,'lines',lines,'mistakes',mistakes,'ended',ended) order by finished_at desc)
     from (select * from public.gugudan_block_runs b where b.student_number=n and b.finished_at is not null order by b.finished_at desc limit 5) recent),'[]')
 ) order by n),'[]')
 from generate_series(1,23) n;
$$;
commit;
