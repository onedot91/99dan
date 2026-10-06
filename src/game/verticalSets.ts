import type { Difficulty, VerticalFact } from './vertical';
export type VerticalCount=5|10;
export const validVerticalCount=(value:unknown):value is VerticalCount=>value===5||value===10;
export function verticalCounts(difficulty:Difficulty,count:VerticalCount=5){return verticalSet(difficulty).counts.map(n=>n*count/5);}

type VerticalSet={readonly id:Difficulty;readonly label:string;readonly mix:readonly string[];readonly counts:readonly [number,number,number];readonly legacyQuestions:readonly VerticalFact[]};
export const VERTICAL_SETS:readonly VerticalSet[]=[
  {id:1,label:'下',mix:['올림 없음 2','곱셈 올림만 2','덧셈 올림 포함 1'],counts:[2,2,1],legacyQuestions:[{a:12,b:13},{a:21,b:12},{a:15,b:12},{a:16,b:12},{a:23,b:14}]},
  {id:2,label:'中',mix:['올림 없음 1','곱셈 올림만 2','덧셈 올림 포함 2'],counts:[1,2,2],legacyQuestions:[{a:22,b:12},{a:47,b:21},{a:34,b:17},{a:36,b:12},{a:48,b:23}]},
  {id:3,label:'上',mix:['곱셈 올림만 1','덧셈 올림 포함 4'],counts:[0,1,4],legacyQuestions:[{a:68,b:32},{a:58,b:61},{a:78,b:63},{a:87,b:79},{a:93,b:68}]},
];
export const validVerticalDifficulty=(value:unknown):value is Difficulty=>value===1||value===2||value===3;
export function verticalSet(difficulty:Difficulty){
  const set=VERTICAL_SETS.find(set=>set.id===difficulty);
  if(!set)throw new Error('INVALID_VERTICAL_DIFFICULTY');
  return set;
}
