-- 쉬는 시간 끝 수업 준비 안내(2026-10-18): School_Timer 학생 화면과 같은 시간표·교사 해제 값을 구구단 앱에도 준다.
-- School_Timer `storage_resources`는 읽기만 한다. 새 테이블은 없고, 함수 둘은 service_role(gugudan-api)만 실행한다.
-- 저장 형식: 컨테이너(kind object/array)는 자식 목록이 없고 자식 행이 value->>'parentKey'로 부모를 가리킨다.
-- 값(kind value)은 value->'data'에 있다. School_Timer `assembleStorageState`와 같은 규칙으로 다시 조립한다.
begin;
create or replace function public.gugudan_storage_tree(p_key text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare node jsonb;
begin
  select value into node from public.storage_resources where resource_key=p_key and not deleted;
  if node is null then return null; end if;
  if node->>'kind'='array' then
    return coalesce((select jsonb_agg(public.gugudan_storage_tree(c.resource_key) order by coalesce((c.value->>'order')::double precision,0),c.resource_key)
      from public.storage_resources c where c.value->>'parentKey'=p_key and not c.deleted),'[]');
  end if;
  if node->>'kind'='object' then
    return coalesce((select jsonb_object_agg(c.value->>'member',public.gugudan_storage_tree(c.resource_key))
      from public.storage_resources c where c.value->>'parentKey'=p_key and not c.deleted),'{}');
  end if;
  return node->'data';
end; $$;

-- 과목은 이번 주(한국 시간 월요일 기준) 것만 보낸다. 쌓인 지난 주 과목까지 매번 보내지 않게 한다.
create or replace function public.gugudan_class_prep() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
   'weeklySchedule',public.gugudan_storage_tree('/weeklySchedule'),
   'weeklySubjects',jsonb_build_object(week.key,public.gugudan_storage_tree('/weeklySubjects/'||week.key)),
   'scheduleClockOffsetSeconds',public.gugudan_storage_tree('/scheduleClockOffsetSeconds'),
   'classPrepRelease',public.gugudan_storage_tree('/classPrepRelease'))
 from (select to_char(date_trunc('week',now() at time zone 'Asia/Seoul'),'YYYY-MM-DD') as key) week;
$$;

revoke all on function public.gugudan_storage_tree(text),public.gugudan_class_prep() from public,anon,authenticated;
grant execute on function public.gugudan_storage_tree(text),public.gugudan_class_prep() to service_role;
commit;
