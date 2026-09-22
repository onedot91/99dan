import type { Duration, Mode, Records, SessionResult } from '../types/game';
import type { SharedProfile } from './types';
export function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_RESPONSE');return Object.fromEntries(Object.entries(value));}
function number(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error('INVALID_NUMBER');return value;}
function text(value:unknown):string{if(typeof value!=='string')throw new Error('INVALID_TEXT');return value;}
function bool(value:unknown):boolean{if(typeof value!=='boolean')throw new Error('INVALID_BOOLEAN');return value;}
function duration(value:unknown):Duration{if(value!==1&&value!==2&&value!==3)throw new Error('INVALID_DURATION');return value;}
function mode(value:unknown):Mode{if(value!=='rush'&&value!=='practice'&&value!=='weak')throw new Error('INVALID_MODE');return value;}
function array(value:unknown):readonly unknown[]{if(!Array.isArray(value))throw new Error('INVALID_ARRAY');return value;}
export function avatarPath(value:unknown):string|null{return typeof value==='string'&&/^\/failure-profiles\/thumbs\/[a-z0-9-]+\.(png|svg)$/.test(value)?value:null;}
export function profile(value:unknown,studentNumber:number):SharedProfile{
  const data=object(value);if(data.studentNumber!==studentNumber)throw new Error('WRONG_STUDENT');
  const records:Records=Object.fromEntries(Object.entries(object(data.records)).map(([id,value])=>{
    if(!/^[2-9]×[2-9]$/.test(id))throw new Error('INVALID_FACT');
    const r=object(value);
    return [id,{attempts:number(r.attempts),correct:number(r.correct),wrong:number(r.wrong),totalMs:number(r.totalMs),streak:number(r.streak),fastStreak:number(r.fastStreak),recent:array(r.recent).map(value=>{const a=object(value);return {correct:bool(a.correct),ms:number(a.ms)};}),reviewAt:r.reviewAt===null?null:number(r.reviewAt),interval:number(r.interval),lastSeen:number(r.lastSeen)}];
  }));
  const sessions:readonly SessionResult[]=array(data.sessions).map(value=>{const s=object(value);return {id:text(s.id),duration:duration(s.duration),mode:mode(s.mode),score:number(s.score),correct:number(s.correct),answered:number(s.answered),bestCombo:number(s.bestCombo),fastest:s.fastest===null?null:number(s.fastest),accuracy:number(s.accuracy),endedEarly:bool(s.endedEarly)};});
  return {studentNumber,avatar:avatarPath(data.avatar),records,sessions,best:array(data.best).map(value=>{const b=object(value);return {duration:duration(b.duration),score:number(b.score),correct:number(b.correct)};})};
}
