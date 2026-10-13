-- 두 자리 수·블록 경험치를 문제당 20에서 10으로 낮춘다(2026-10-13). 이미 받은 경험치는 그대로 둔다.
-- 판마다 문제당 경험치를 저장한다: 열을 기본값 20으로 추가해 기존 판(진행 중 포함)을 20으로 채우고,
-- 기본값을 10으로 바꿔 이후 시작하는 판부터 10을 쓴다. 상수 기본값이라 열 추가는 테이블을 다시 쓰지 않는다.
-- src/game/learning.ts의 VERTICAL_EXP_PER_QUESTION과 맞춘다.
begin;
alter table public.gugudan_vertical_runs add column exp_per_question smallint not null default 20 check(exp_per_question>=0);
alter table public.gugudan_vertical_runs alter column exp_per_question set default 10;
alter table public.gugudan_block_runs add column exp_per_question smallint not null default 20 check(exp_per_question>=0);
alter table public.gugudan_block_runs alter column exp_per_question set default 10;

create or replace function public.gugudan_vertical_exp(p_student integer) returns integer
language sql stable security invoker set search_path='' as $$
 select coalesce(sum(jsonb_array_length(questions)*exp_per_question),0)::integer
 from public.gugudan_vertical_runs where student_number=p_student and finished_at is not null;
$$;

create or replace function public.gugudan_block_exp(p_student integer) returns integer
language sql stable security invoker set search_path='' as $$
 select coalesce(sum(solved*exp_per_question),0)::integer
 from public.gugudan_block_runs where student_number=p_student and finished_at is not null;
$$;
commit;
