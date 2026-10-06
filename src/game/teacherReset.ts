export const TEACHER_RESET_SCOPES=[
  {id:'rush-1',label:'구구단 1분'},
  {id:'rush-2',label:'구구단 2분'},
  {id:'rush-3',label:'구구단 3분'},
  {id:'vertical-5',label:'두 자리 수 5문제'},
  {id:'vertical-10',label:'두 자리 수 10문제'},
] as const;
export type TeacherResetScope=typeof TEACHER_RESET_SCOPES[number]['id'];
export function validTeacherResetScopes(value:unknown):value is readonly TeacherResetScope[]{
  return Array.isArray(value)&&value.length>0&&value.length<=TEACHER_RESET_SCOPES.length&&new Set(value).size===value.length&&value.every(id=>TEACHER_RESET_SCOPES.some(scope=>scope.id===id));
}
