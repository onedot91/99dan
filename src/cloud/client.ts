import type { Duration, Run } from '../types/game';
import type { SharedProfile, Standing } from './types';
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
export async function beginRun(studentNumber:number,run:Run):Promise<void>{await authenticated(studentNumber,'begin',{id:run.id,mode:run.mode,duration:run.duration});}
export async function finishRun(studentNumber:number,run:Run):Promise<void>{await authenticated(studentNumber,'finish',{id:run.id,endedEarly:run.endedEarly,events:run.events});}
export async function loadLeaders(studentNumber:number,duration:Duration):Promise<readonly Standing[]>{
  const data=await authenticated(studentNumber,'leaders',{duration});if(!Array.isArray(data))throw new Error('INVALID_LEADERS');
  return data.slice(0,3).map(value=>{const row=object(value);if(typeof row.studentNumber!=='number'||!Number.isInteger(row.studentNumber)||row.studentNumber<1||row.studentNumber>23||typeof row.score!=='number'||typeof row.correct!=='number')throw new Error('INVALID_LEADER');return {studentNumber:row.studentNumber,score:row.score,correct:row.correct,avatar:avatarPath(row.avatar)};});
}
