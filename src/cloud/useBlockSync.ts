import { useCallback, useEffect, useRef, useState } from 'react';
import { beginBlockRun, cloudConfigured, finishBlockRun, loadBlockRecords } from './client';
import type { BlockFinish } from './client';
import { isSpare } from '../game/studentNumber';
import type { BlockRun } from '../game/blockRun';

// 블록 판의 서버 연결: 시작에 시드를 받고, 끝나면 입력 기록을 보내 서버가 재생한 점수로 저장한다.
// 보내지 못한 끝 기록은 이 기기에 남겨 두었다가 다시 보낸다(같은 ID·같은 입력이라 중복 저장되지 않는다).
export type BlockSyncState='local'|'idle'|'starting'|'saving'|'saved'|'error'|'rejected';
const pendingKey=(studentNumber:number)=>`gugudan-rush.block-pending.${studentNumber}`;
function loadPending(studentNumber:number):BlockFinish|null{
  try{
    const raw=localStorage.getItem(pendingKey(studentNumber));if(!raw)return null;
    const data:unknown=JSON.parse(raw);
    if(!data||typeof data!=='object'||Array.isArray(data))return null;
    const value=Object.fromEntries(Object.entries(data));
    return typeof value.id==='string'&&(value.ended==='stuck'||value.ended==='stopped')&&Array.isArray(value.answers)&&Array.isArray(value.moves)?{id:value.id,ended:value.ended,answers:value.answers,moves:value.moves}:null;
  }catch{return null;}
}
function storePending(studentNumber:number,finish:BlockFinish|null){
  try{if(finish)localStorage.setItem(pendingKey(studentNumber),JSON.stringify(finish));else localStorage.removeItem(pendingKey(studentNumber));}catch{/* 저장 재시도만 못 한다 */}
}
const finalRejection=(error:unknown)=>error instanceof Error&&/^CLOUD_4\d\d$/.test(error.message);
export function useBlockSync(studentNumber:number){
  const remote=cloudConfigured&&!isSpare(studentNumber);
  const [state,setState]=useState<BlockSyncState>(remote?'idle':'local');
  const [pending,setPending]=useState<BlockFinish|null>(()=>remote?loadPending(studentNumber):null);
  const [serverScore,setServerScore]=useState<number|null>(null);
  // 서버의 내 최고 점수(이번 판 전). 결과 화면의 '최고 기록 갱신'에 쓴다.
  const [serverBest,setServerBest]=useState<number|null>(null);
  const runId=useRef<string|null>(null);
  const busy=useRef(false);
  const pendingRef=useRef(pending);pendingRef.current=pending;
  const refreshBest=useCallback(async()=>{if(!remote)return;try{setServerBest((await loadBlockRecords(studentNumber)).best);}catch{/* 기기 기록으로 대신한다 */}},[remote,studentNumber]);
  useEffect(()=>{void refreshBest();},[refreshBest]);
  const save=useCallback(async()=>{
    const finish=pendingRef.current;
    if(!remote||!finish||busy.current)return;
    busy.current=true;setState('saving');
    try{const score=await finishBlockRun(studentNumber,finish);storePending(studentNumber,null);setPending(null);setServerScore(score);setState('saved');}
    catch(error){
      // 서버가 재생을 거부한 기록은 다시 보내도 같으므로 버린다.
      if(finalRejection(error)){storePending(studentNumber,null);setPending(null);setState('rejected');}
      else setState('error');
    }finally{busy.current=false;}
  },[remote,studentNumber]);
  useEffect(()=>{if(pending)void save();},[pending,save]);
  // 시작: 원격이면 서버 시드, 아니면 기기 난수. 저장하지 못한 판이 남아 있으면 시작하지 않는다.
  const begin=async():Promise<number|null>=>{
    if(busy.current||pendingRef.current)return null;
    setServerScore(null);runId.current=null;
    if(!remote)return Math.floor(Math.random()*2**32);
    busy.current=true;setState('starting');
    try{const id=crypto.randomUUID(),seed=await beginBlockRun(studentNumber,id);runId.current=id;setState('idle');void refreshBest();return seed;}
    catch{setState('error');return null;}finally{busy.current=false;}
  };
  const finish=(run:BlockRun)=>{
    const id=runId.current;runId.current=null;
    if(!remote||!id||run.phase!=='over'||!run.ended)return;
    const next:BlockFinish={id,ended:run.ended,answers:run.answers,moves:run.moves};
    storePending(studentNumber,next);setPending(next);
  };
  return {state,begin,finish,retry:save,blocked:remote&&pending!==null,serverScore,serverBest};
}
export type BlockSync=ReturnType<typeof useBlockSync>;
