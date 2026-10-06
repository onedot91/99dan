import type { Difficulty } from './vertical';

export type SkillAccuracy={readonly attempts:number;readonly correct:number};
export type VerticalMetrics={readonly runs:number;readonly first:SkillAccuracy;readonly multiply:SkillAccuracy;readonly sum:SkillAccuracy};
export type VerticalRecommendation={readonly difficulty:Difficulty;readonly reason:string};

export function parseVerticalMetrics(value:unknown):VerticalMetrics|null{
  if(value===undefined||value===null)return null;
  if(typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_VERTICAL_METRICS');
  const data=Object.fromEntries(Object.entries(value));
  if(!Number.isInteger(data.runs)||typeof data.runs!=='number'||data.runs<0||data.runs>3)throw new Error('INVALID_VERTICAL_METRICS');
  const accuracy=(value:unknown):SkillAccuracy=>{
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_VERTICAL_METRICS');
    const row=Object.fromEntries(Object.entries(value));
    if(typeof row.attempts!=='number'||!Number.isSafeInteger(row.attempts)||row.attempts<0||typeof row.correct!=='number'||!Number.isSafeInteger(row.correct)||row.correct<0||row.correct>row.attempts)throw new Error('INVALID_VERTICAL_METRICS');
    return {attempts:row.attempts,correct:row.correct};
  };
  const first=accuracy(data.first),multiply=accuracy(data.multiply),sum=accuracy(data.sum);
  if(multiply.attempts+sum.attempts>first.attempts||(data.runs===0&&first.attempts!==0)||(data.runs>0&&first.attempts===0))throw new Error('INVALID_VERTICAL_METRICS');
  return {runs:data.runs,first,multiply,sum};
}

export function recommendVertical(metrics:VerticalMetrics|null):VerticalRecommendation|null{
  if(!metrics||metrics.runs<3||metrics.first.attempts===0||metrics.multiply.attempts<5||metrics.sum.attempts<5)return null;
  const atLeast=(skill:SkillAccuracy,percent:number)=>skill.correct*100>=skill.attempts*percent;
  if(!atLeast(metrics.first,80))return {difficulty:1,reason:'기본 계산을 조금 더 연습하면 좋아요.'};
  if(!atLeast(metrics.multiply,60))return {difficulty:1,reason:'곱셈 올림을 조금 더 연습하면 좋아요.'};
  if(!atLeast(metrics.sum,60))return {difficulty:1,reason:'덧셈 올림을 조금 더 연습하면 좋아요.'};
  if(atLeast(metrics.first,90)&&atLeast(metrics.multiply,85)&&atLeast(metrics.sum,85))return {difficulty:3,reason:'최근 풀이에서 계산과 올림 처리가 안정적이에요.'};
  return {difficulty:2,reason:!atLeast(metrics.multiply,85)?'곱셈 올림을 익히는 단계예요.':!atLeast(metrics.sum,85)?'덧셈 올림을 익히는 단계예요.':'계산의 정확도를 조금 더 높이는 단계예요.'};
}
