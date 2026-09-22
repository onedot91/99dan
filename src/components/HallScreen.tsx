import { useEffect, useState } from 'react';
import { DURATIONS } from '../types/game';
import type { Duration } from '../types/game';
import { cloudConfigured, loadLeaders } from '../cloud/client';
import type { Standing } from '../cloud/types';
import { PixelArt } from './PixelArt';
import { Icon } from './Icon';
export function HallScreen({ready,studentNumber}:{readonly ready:boolean;readonly studentNumber:number}){
  const [duration,setDuration]=useState<Duration>(1);
  const [rows,setRows]=useState<readonly Standing[]>([]);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!ready||!cloudConfigured)return;
    let active=true;
    const load=async()=>{try{const next=await loadLeaders(studentNumber,duration);if(active){setRows(next);setState('ready');}}catch{if(active)setState('error');}};
    setState('loading');void load();
    const poll=window.setInterval(()=>{if(!document.hidden)void load();},15000);
    return()=>{active=false;window.clearInterval(poll);};
  },[duration,ready,retry,studentNumber]);
  return <main className="hall-screen"><div className="screen-heading"><PixelArt kind="trophy"/><h1>명예의 전당</h1></div>
    <div className="duration-tabs" role="group" aria-label="기록 단계">{DURATIONS.map(n=><button key={n} aria-pressed={duration===n} onClick={()=>setDuration(n)}>{n}분 도전</button>)}</div>
    {!cloudConfigured?<div className="empty-state" role="status">연결 필요</div>:!ready||state==='loading'?<div className="empty-state" role="status">불러오는 중</div>:state==='error'?<button className="quiet-button" onClick={()=>setRetry(n=>n+1)}>다시 불러오기</button>:rows.length?<ol className="podium">{rows.map((row,i)=><li className={i===0?'first':''} key={row.studentNumber}><strong className="rank">{i+1}</strong>{row.avatar?<img src={row.avatar} alt="" width="56" height="56"/>:<Icon name="star" size={40}/>}<span>{row.studentNumber}번</span><b>{row.score.toLocaleString()}점</b></li>)}</ol>:<div className="empty-state">기록 없음</div>}
  </main>;
}
