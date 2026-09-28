import type { Duration, Run } from '../types/game';
import type { FriendState, SharedProfile, Standing } from './types';
import { object, profile, avatarPath } from './parse';
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
  const data=await authenticated(studentNumber,'leaders',{duration});if(!Array.isArray(data))throw new Error('INVALID_LEADERS');
  return data.slice(0,5).map(value=>{const row=object(value);if(typeof row.studentNumber!=='number'||!Number.isInteger(row.studentNumber)||row.studentNumber<1||row.studentNumber>23||typeof row.score!=='number'||typeof row.correct!=='number')throw new Error('INVALID_LEADER');return {studentNumber:row.studentNumber,score:row.score,correct:row.correct,avatar:avatarPath(row.avatar)};});
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
