import { useEffect, useRef, useState } from 'react';
import { loadTeacherRecords, resetStudentRecords } from '../cloud/client';
import type { SharedProfile } from '../cloud/types';
import { DURATIONS, modeLabel } from '../types/game';
import { Icon } from './Icon';

function totals(profile:SharedProfile){return Object.values(profile.records).reduce((sum,record)=>({attempts:sum.attempts+record.attempts,correct:sum.correct+record.correct,wrong:sum.wrong+record.wrong}),{attempts:0,correct:0,wrong:0});}
function TeacherDetail({profile,onReset,mobile}:{readonly profile:SharedProfile;readonly onReset:()=>void;readonly mobile:boolean}){
  const number=profile.studentNumber;
  return <section className={`teacher-detail ${mobile?'teacher-mobile-detail':'teacher-wide-detail'}`} aria-label={`${number}번 상세 기록`}>
    <div className="teacher-section-head"><h2>{number}번</h2><button className="quiet-button teacher-reset" onClick={onReset} disabled={totals(profile).attempts===0&&profile.sessions.length===0&&profile.best.length===0}>기록 초기화</button></div>
    <div className="teacher-bests">{DURATIONS.map(duration=><div key={duration}><span>{duration}분 최고</span><strong>{profile.best.find(best=>best.duration===duration)?.score.toLocaleString()??'—'}</strong></div>)}</div>
    <h3>문제별</h3>
    {Object.keys(profile.records).length?<div className="teacher-facts">{Object.entries(profile.records).sort(([a],[b])=>a.localeCompare(b,'ko')).map(([id,record])=><div key={id}><strong>{id}</strong><span>{record.correct}/{record.attempts}</span></div>)}</div>:<p className="teacher-empty">기록 없음</p>}
    <h3>최근 도전</h3>
    {profile.sessions.length?<div className="teacher-sessions">{[...profile.sessions].reverse().map(session=><div key={session.id}><strong>{modeLabel(session.mode,session.duration)}</strong><span>{session.correct}/{session.answered}</span><b>{session.score.toLocaleString()}점</b></div>)}</div>:<p className="teacher-empty">기록 없음</p>}
  </section>;
}

export function TeacherScreen({token,onExit}:{readonly token:string;readonly onExit:()=>void}){
  const [profiles,setProfiles]=useState<readonly SharedProfile[]>([]);
  const [selected,setSelected]=useState(1);
  const [state,setState]=useState<'loading'|'ready'|'error'|'expired'>('loading');
  const [resetting,setResetting]=useState(false);
  const [error,setError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  const load=async()=>{
    setState('loading');
    try{setProfiles(await loadTeacherRecords(token));setState('ready');}
    catch(cause){setState(cause instanceof Error&&cause.message==='CLOUD_401'?'expired':'error');}
  };
  useEffect(()=>{void load();},[token]);
  const reset=async()=>{
    setResetting(true);setError('');
    try{await resetStudentRecords(token,selected);dialog.current?.close();await load();}
    catch(cause){if(cause instanceof Error&&cause.message==='CLOUD_401'){dialog.current?.close();setState('expired');}else setError('초기화하지 못했습니다. 다시 시도해 주세요.');}
    finally{setResetting(false);}
  };
  const active=profiles.find(profile=>profile.studentNumber===selected);
  const openReset=()=>{setError('');dialog.current?.showModal();};
  return <div className="app teacher-app">
    <header className="header"><div className="brand"><span className="brand-mark"><Icon name="chart"/></span><span>교사 기록</span></div><button className="quiet-button" onClick={onExit}>번호 선택</button></header>
    <main className="teacher-screen">
      {state==='loading'?<p role="status">불러오는 중</p>:state==='expired'?<div className="teacher-message" role="alert"><p>교사 번호를 다시 입력해 주세요.</p><button className="primary-button" onClick={onExit}>번호 선택</button></div>:state==='error'?<div className="teacher-message" role="alert"><p>기록을 불러오지 못했습니다.</p><button className="primary-button" onClick={()=>void load()}>다시 시도</button></div>:<>
        <section className="teacher-list" aria-label="학생별 기록">
          <div className="teacher-section-head"><h1>전체 기록</h1><button className="quiet-button" onClick={()=>void load()} aria-label="기록 새로고침"><Icon name="back"/></button></div>
          <div className="teacher-table-head" aria-hidden="true"><span>번호</span><span>풀이</span><span>정답</span><span>오답</span></div>
          <div className="teacher-rows">{profiles.map(profile=>{const total=totals(profile);return <div className="teacher-row-wrap" key={profile.studentNumber}><button className="teacher-row" aria-pressed={selected===profile.studentNumber} onClick={()=>setSelected(profile.studentNumber)}><strong>{profile.studentNumber}번</strong><span>{total.attempts}</span><span>{total.correct}</span><span>{total.wrong}</span></button>{selected===profile.studentNumber&&<TeacherDetail profile={profile} onReset={openReset} mobile/>}</div>;})}</div>
        </section>
        {active&&<TeacherDetail profile={active} onReset={openReset} mobile={false}/>}
      </>}
    </main>
    <dialog ref={dialog} className="number-dialog arcade-panel" aria-labelledby="teacher-reset-title" onCancel={()=>{if(resetting)return;setError('');}}>
      <div className="number-confirm-content"><h2 id="teacher-reset-title">{selected}번 기록 초기화</h2><p>문제·도전·최고 점수가 모두 지워집니다.</p>{error&&<p className="storage-error" role="alert">{error}</p>}<div className="number-confirm-actions"><button className="quiet-button" disabled={resetting} onClick={()=>dialog.current?.close()}>취소</button><button className="primary-button" disabled={resetting} onClick={()=>void reset()}>{resetting?'처리 중':'초기화'}</button></div></div>
    </dialog>
  </div>;
}
