import type { Duration, Run } from '../types/game';
import type { FriendState, SharedProfile, Standing } from './types';
import { object, profile, avatarPath } from './parse';
import { validVerticalDifficulty } from '../game/verticalSets';
import type { VerticalCount } from '../game/verticalSets';
import type { Difficulty } from '../game/vertical';
import { parseVerticalQuestions } from '../game/vertical';
import type { VerticalSession, VerticalStart } from '../game/vertical';
import { validTeacherResetScopes } from '../game/teacherReset';
import type { TeacherResetScope } from '../game/teacherReset';
const env=import.meta.env;
const endpoint=env.VITE_GUGUDAN_API_URL;
const publicKey=env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfigured=Boolean(endpoint&&publicKey);
const tokens=new Map<number,string>();
const registrations=new Map<number,Promise<string>>();
async function request(action:string,payload:object={},token?:string):Promise<unknown>{
  if(!endpoint||!publicKey)throw new Error('NOT_CONFIGURED');
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:publicKey,...(token?{'X-Gugudan-Session':token}:{})},body:JSON.stringify({action,...payload}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error(`CLOUD_${response.status}`);
  return response.json();
}
async function connect(studentNumber:number):Promise<string>{
  const token=tokens.get(studentNumber);
  if(token)return token;
  let pending=registrations.get(studentNumber);
  if(!pending){
    pending=(async()=>{
      const data=object(await request('register',{studentNumber}));
      if(typeof data.token!=='string')throw new Error('INVALID_SESSION');
      return data.token;
    })();
    registrations.set(studentNumber,pending);
  }
  try{const next=await pending;tokens.set(studentNumber,next);return next;}
  finally{if(registrations.get(studentNumber)===pending)registrations.delete(studentNumber);}
}
async function authenticated(studentNumber:number,action:string,payload:object={},retry=true):Promise<unknown>{
  const token=await connect(studentNumber);
  try{return await request(action,payload,token);}
  catch(error){
    if(retry&&error instanceof Error&&error.message==='CLOUD_401'){
      tokens.delete(studentNumber);registrations.delete(studentNumber);
      return authenticated(studentNumber,action,payload,false);
    }
    throw error;
  }
}
export async function loadProfile(studentNumber:number):Promise<SharedProfile>{
  return profile(await authenticated(studentNumber,'profile'),studentNumber);
}
export type Capabilities={readonly questionTypes:boolean;readonly friends:boolean};
export async function loadCapabilities(studentNumber:number):Promise<Capabilities>{
  try{const data=object(await authenticated(studentNumber,'capabilities'));return {questionTypes:data.questionTypes===true,friends:data.friends===true};}
  catch{return {questionTypes:false,friends:false};}
}
export async function saveFriends(studentNumber:number,state:FriendState):Promise<void>{
  await authenticated(studentNumber,'saveFriends',{friends:state.owned,partner:state.partner});
}
export async function beginRun(studentNumber:number,run:Run):Promise<void>{await authenticated(studentNumber,'begin',{id:run.id,mode:run.mode,duration:run.duration});}
export async function finishRun(studentNumber:number,run:Run):Promise<void>{await authenticated(studentNumber,'finish',{id:run.id,endedEarly:run.endedEarly,events:run.events});}
export async function loadLeaders(studentNumber:number,duration:Duration):Promise<readonly Standing[]>{
  return standings(await authenticated(studentNumber,'leaders',{duration}));
}
function standings(data:unknown):readonly Standing[]{
  if(!Array.isArray(data))throw new Error('INVALID_LEADERS');
  return data.slice(0,5).map(value=>{const row=object(value);if(typeof row.studentNumber!=='number'||!Number.isInteger(row.studentNumber)||row.studentNumber<1||row.studentNumber>23||typeof row.score!=='number'||typeof row.correct!=='number')throw new Error('INVALID_LEADER');return {studentNumber:row.studentNumber,score:row.score,correct:row.correct,avatar:avatarPath(row.avatar)};});
}
export async function loadVerticalLeaders(studentNumber:number,count:VerticalCount=5):Promise<readonly Standing[]>{
  return standings(await authenticated(studentNumber,'verticalLeaders',{count,tightTime:true,cellScoring:true}));
}
// Best score (null until a cell-scored run) and finished runs for 5 and 10 questions.
export type VerticalRecord={readonly count:VerticalCount;readonly best:number|null;readonly runs:number};
export async function loadVerticalRecords(studentNumber:number):Promise<readonly VerticalRecord[]>{
  const data=await authenticated(studentNumber,'verticalRecords');
  if(!Array.isArray(data))throw new Error('INVALID_VERTICAL_RECORDS');
  return data.map(value=>{const row=object(value);if((row.count!==5&&row.count!==10)||(row.best!==null&&typeof row.best!=='number')||typeof row.runs!=='number')throw new Error('INVALID_VERTICAL_RECORDS');return {count:row.count,best:row.best,runs:row.runs};});
}
export async function beginVerticalRun(studentNumber:number,id:string,count:VerticalCount=5):Promise<VerticalStart>{
  const data=object(await authenticated(studentNumber,'verticalBegin',{id,timeScoring:true,manualZero:true,puzzles:true,puzzleOperands:true,directZero:true,tightTime:true,cellScoring:true,count}));
  const difficulty=assignment(data,studentNumber);
  const questions=parseVerticalQuestions(data.questions,difficulty,count,data.puzzles===true,data.puzzleOperands===true,data.directZero===true);
  if(data.directZero!==undefined&&typeof data.directZero!=='boolean'||data.directZero===true&&(data.puzzleOperands!==true||data.manualZero!==true||data.puzzles!==true))throw new Error('INVALID_VERTICAL_RUN');
  if(data.tightTime!==undefined&&typeof data.tightTime!=='boolean'||data.tightTime===true&&data.timeScoring!==true)throw new Error('INVALID_VERTICAL_RUN');
  if(data.cellScoring!==undefined&&typeof data.cellScoring!=='boolean'||data.cellScoring===true&&data.tightTime!==true)throw new Error('INVALID_VERTICAL_RUN');
  if(data.id!==id||!questions||data.timeScoring!==undefined&&typeof data.timeScoring!=='boolean'||data.manualZero!==undefined&&typeof data.manualZero!=='boolean'||data.puzzles!==undefined&&typeof data.puzzles!=='boolean'||data.puzzleOperands!==undefined&&typeof data.puzzleOperands!=='boolean'||data.puzzleOperands===true&&data.puzzles!==true||data.puzzles===true&&data.manualZero!==true)throw new Error('INVALID_VERTICAL_RUN');
  return {id,difficulty,questions,timeScoring:data.timeScoring===true,manualZero:data.manualZero===true,tightTime:data.tightTime===true,cellScoring:data.cellScoring===true};
}
export async function finishVerticalRun(studentNumber:number,session:VerticalSession):Promise<number>{
  if(session.version<3||!session.id||!session.completed)throw new Error('INVALID_VERTICAL_RUN');
  const result=object(await authenticated(studentNumber,'verticalFinish',{id:session.id,events:session.events}));
  if(result.id!==session.id||typeof result.score!=='number'||!Number.isInteger(result.score)||result.score<0||result.score>session.questions.length*200)throw new Error('INVALID_VERTICAL_SCORE');
  return result.score;
}
export async function teacherLogin(code:string):Promise<string>{
  const data=object(await request('teacherLogin',{code}));
  if(typeof data.token!=='string')throw new Error('INVALID_SESSION');
  return data.token;
}
export async function loadTeacherRecords(token:string):Promise<readonly SharedProfile[]>{
  const data=await request('teacherRecords',{},token);
  if(!Array.isArray(data)||data.length!==23)throw new Error('INVALID_TEACHER_RECORDS');
  return data.map((value,index)=>profile(value,index+1));
}
export async function resetStudentRecords(token:string,studentNumber:number):Promise<void>{
  if(!Number.isInteger(studentNumber)||studentNumber<1||studentNumber>23)throw new Error('INVALID_STUDENT');
  await request('teacherReset',{studentNumber},token);
}
export async function resetAllStudentRecords(token:string):Promise<void>{
  await request('teacherResetAll',{},token);
}
export async function resetStudentRecordScopes(token:string,studentNumber:number,scopes:readonly TeacherResetScope[]):Promise<void>{
  if(!Number.isInteger(studentNumber)||studentNumber<1||studentNumber>23)throw new Error('INVALID_STUDENT');
  if(!validTeacherResetScopes(scopes))throw new Error('INVALID_RESET_SCOPES');
  const result=object(await request('teacherResetScoped',{studentNumber,scopes},token));
  if(result.ok!==true)throw new Error('INVALID_RESET_RESULT');
}
function assignment(value:unknown,studentNumber:number):Difficulty{
  const data=object(value);
  if(data.studentNumber!==studentNumber||!validVerticalDifficulty(data.difficulty))throw new Error('INVALID_VERTICAL_ASSIGNMENT');
  return data.difficulty;
}
export async function loadVerticalAssignment(studentNumber:number):Promise<Difficulty>{
  return assignment(await authenticated(studentNumber,'verticalAssignment'),studentNumber);
}
export async function saveVerticalAssignment(token:string,studentNumber:number,difficulty:Difficulty):Promise<Difficulty>{
  if(!Number.isInteger(studentNumber)||studentNumber<1||studentNumber>23||!validVerticalDifficulty(difficulty))throw new Error('INVALID_VERTICAL_ASSIGNMENT');
  return assignment(await request('teacherSetVertical',{studentNumber,difficulty},token),studentNumber);
}
