import type { Duration, Mode, Records, SessionResult } from '../types/game';
import type { FriendState, SharedProfile, VerticalSession } from './types';
import { friendById, sanitizeOwned } from '../game/friends';
import { validVerticalDifficulty } from '../game/verticalSets';
import { parseVerticalMetrics } from '../game/verticalRecommendation';
export function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_RESPONSE');return Object.fromEntries(Object.entries(value));}
function number(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error('INVALID_NUMBER');return value;}
function score(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value))throw new Error('INVALID_SCORE');return value;}
function text(value:unknown):string{if(typeof value!=='string')throw new Error('INVALID_TEXT');return value;}
function bool(value:unknown):boolean{if(typeof value!=='boolean')throw new Error('INVALID_BOOLEAN');return value;}
function duration(value:unknown):Duration{if(value!==1&&value!==2&&value!==3)throw new Error('INVALID_DURATION');return value;}
function mode(value:unknown):Mode{if(value!=='rush'&&value!=='practice'&&value!=='weak')throw new Error('INVALID_MODE');return value;}
function array(value:unknown):readonly unknown[]{if(!Array.isArray(value))throw new Error('INVALID_ARRAY');return value;}
export function avatarPath(value:unknown):string|null{return typeof value==='string'&&/^\/failure-profiles\/thumbs\/[a-z0-9-]+\.(png|svg)$/.test(value)?value:null;}
function friends(data:Record<string,unknown>):FriendState|null{
  if(!Array.isArray(data.friends))return null;
  const owned=sanitizeOwned(data.friends);
  const partner=typeof data.partner==='string'&&owned.includes(data.partner)&&friendById(data.partner)?data.partner:null;
  return {owned,partner};
}
export function profile(value:unknown,studentNumber:number):SharedProfile{
  const data=object(value);if(data.studentNumber!==studentNumber)throw new Error('WRONG_STUDENT');
  const records:Records=Object.fromEntries(Object.entries(object(data.records)).map(([id,value])=>{
    if(!/^[2-9]×[2-9]$/.test(id))throw new Error('INVALID_FACT');
    const r=object(value);
    return [id,{attempts:number(r.attempts),correct:number(r.correct),wrong:number(r.wrong),totalMs:number(r.totalMs),streak:number(r.streak),fastStreak:number(r.fastStreak),recent:array(r.recent).map(value=>{const a=object(value);return {correct:bool(a.correct),ms:number(a.ms)};}),reviewAt:r.reviewAt===null?null:number(r.reviewAt),interval:number(r.interval),lastSeen:number(r.lastSeen)}];
  }));
  const sessions:readonly SessionResult[]=array(data.sessions).map(value=>{const s=object(value);return {id:text(s.id),finishedAt:typeof s.finishedAt==='string'&&Number.isFinite(Date.parse(s.finishedAt))?s.finishedAt:null,duration:duration(s.duration),mode:mode(s.mode),score:score(s.score),correct:number(s.correct),answered:number(s.answered),bestCombo:number(s.bestCombo),fastest:s.fastest===null?null:number(s.fastest),accuracy:number(s.accuracy),endedEarly:bool(s.endedEarly),scoringVersion:s.scoringVersion===5?5:s.scoringVersion===4?4:s.scoringVersion===3?3:s.scoringVersion===2?2:1};});
  // Only the teacher records carry two-digit runs; an older server leaves them out.
  const verticalSessions:readonly VerticalSession[]=data.verticalSessions===undefined?[]:array(data.verticalSessions).map(value=>{const s=object(value);const finishedAt=text(s.finishedAt);if(!Number.isFinite(Date.parse(finishedAt)))throw new Error('INVALID_DATE');return {id:text(s.id),finishedAt,count:number(s.count),score:score(s.score),mistakes:number(s.mistakes)};});
  if(data.verticalDifficulty!==undefined&&!validVerticalDifficulty(data.verticalDifficulty))throw new Error('INVALID_VERTICAL_DIFFICULTY');
  if(data.canResetScopes!==undefined&&typeof data.canResetScopes!=='boolean')throw new Error('INVALID_RESET_CAPABILITY');
  return {studentNumber,canResetScopes:data.canResetScopes===true,verticalMetrics:parseVerticalMetrics(data.verticalMetrics),avatar:avatarPath(data.avatar),records,sessions,verticalSessions,friends:friends(data),verticalDifficulty:validVerticalDifficulty(data.verticalDifficulty)?data.verticalDifficulty:null,best:array(data.best).map(value=>{const b=object(value);return {duration:duration(b.duration),score:score(b.score),correct:number(b.correct)};})};
}
