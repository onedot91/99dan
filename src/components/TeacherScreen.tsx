import { useEffect, useRef, useState } from 'react';
import { loadTeacherRecords, resetAllStudentRecords, resetStudentRecords } from '../cloud/client';
import type { SharedProfile } from '../cloud/types';
import { DURATIONS, modeLabel } from '../types/game';
import { Icon } from './Icon';
import { levelFor } from '../game/learning';
import { FRIENDS, friendById } from '../game/friends';
import { FriendSprite } from './FriendSprite';

function totals(profile:SharedProfile){return Object.values(profile.records).reduce((sum,record)=>({attempts:sum.attempts+record.attempts,correct:sum.correct+record.correct,wrong:sum.wrong+record.wrong}),{attempts:0,correct:0,wrong:0});}
function TeacherDetail({profile,onReset}:{readonly profile:SharedProfile;readonly onReset:()=>void}){
  const number=profile.studentNumber;
  const total=totals(profile);
  const recent=profile.sessions.slice(-5).reverse();
  const level=levelFor(total.correct);
  const partner=friendById(profile.friends?.partner);
  return <section className="teacher-detail" aria-label={`${number}번 상세 기록`}>
    <div className="teacher-section-head"><h2>{number}번</h2><button className="quiet-button teacher-reset" onClick={onReset} disabled={totals(profile).attempts===0&&profile.sessions.length===0&&profile.best.length===0}>기록 초기화</button></div>
    <div className="teacher-level">
      <span className="level-number"><small>Lv.</small>{level.number}</span>
      <div><strong>{level.label}</strong><small>다음 레벨까지 {(level.next??level.floor)-total.correct}문제</small></div>
      <div className="teacher-friend">{partner?<><FriendSprite id={partner.id}/><span><strong>{partner.name}</strong><small>펫 {profile.friends?.owned.length??0} / {FRIENDS.length}</small></span></>:<small>{profile.friends?'아직 고른 펫 없음':'펫은 서버 업데이트 후 표시'}</small>}</div>
    </div>
    <p className="teacher-summary">정답 <strong>{total.correct}</strong><span aria-hidden="true">·</span> 오답 <strong>{total.wrong}</strong></p>
    <div className="teacher-bests">{DURATIONS.map(duration=><div key={duration}><span>{duration}분 최고</span><strong>{profile.best.find(best=>best.duration===duration)?.score.toLocaleString()??'—'}</strong></div>)}</div>
    <h3>최근 도전</h3>
    {recent.length?<div className="teacher-sessions">{recent.map(session=><div key={session.id}><strong>{modeLabel(session.mode,session.duration)}</strong><span>정답 {session.correct}개</span><b>{session.score.toLocaleString()}점</b></div>)}</div>:<p className="teacher-empty">기록 없음</p>}
  </section>;
}

export function TeacherScreen({token,onExit}:{readonly token:string;readonly onExit:()=>void}){
  const [profiles,setProfiles]=useState<readonly SharedProfile[]>([]);
  const [selected,setSelected]=useState(1);
  const [state,setState]=useState<'loading'|'ready'|'error'|'expired'>('loading');
  const [resetting,setResetting]=useState(false);
  const [resetTarget,setResetTarget]=useState<number|'all'>(1);
  const [confirmation,setConfirmation]=useState('');
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
    try{if(resetTarget==='all')await resetAllStudentRecords(token);else await resetStudentRecords(token,resetTarget);dialog.current?.close();setConfirmation('');await load();}
    catch(cause){if(cause instanceof Error&&cause.message==='CLOUD_401'){dialog.current?.close();setState('expired');}else setError('초기화하지 못했습니다. 다시 시도해 주세요.');}
    finally{setResetting(false);}
  };
  const active=profiles.find(profile=>profile.studentNumber===selected);
  const openReset=(target:number|'all')=>{setResetTarget(target);setConfirmation('');setError('');dialog.current?.showModal();};
  return <div className="app teacher-app">
    <header className="header"><div className="brand"><span className="brand-mark"><Icon name="chart"/></span><span>교사 기록</span></div><button className="quiet-button" onClick={onExit}>번호 선택</button></header>
    <main className="teacher-screen">
      {state==='loading'?<p role="status">불러오는 중</p>:state==='expired'?<div className="teacher-message" role="alert"><p>교사 번호를 다시 입력해 주세요.</p><button className="primary-button" onClick={onExit}>번호 선택</button></div>:state==='error'?<div className="teacher-message" role="alert"><p>기록을 불러오지 못했습니다.</p><button className="primary-button" onClick={()=>void load()}>다시 시도</button></div>:<>
        <section className="teacher-list" aria-label="학생 선택">
          <div className="teacher-section-head"><h1>학생 선택</h1><div className="teacher-list-actions"><button className="quiet-button" onClick={()=>void load()} aria-label="기록 새로고침">새로고침</button><button className="quiet-button teacher-reset-all" onClick={()=>openReset('all')}>전체 기록 초기화</button></div></div>
          <div className="teacher-number-grid">{profiles.map(profile=>{const hasRecords=totals(profile).attempts>0||profile.sessions.length>0||profile.best.length>0;return <button key={profile.studentNumber} className="teacher-number" aria-label={`${profile.studentNumber}번${hasRecords?', 기록 있음':''}`} aria-pressed={selected===profile.studentNumber} onClick={()=>setSelected(profile.studentNumber)}><span>{profile.studentNumber}번</span>{hasRecords&&<small className="teacher-number-level">Lv.{levelFor(totals(profile).correct).number}</small>}{hasRecords&&<span className="teacher-record-dot" aria-hidden="true"/>}</button>;})}</div>
        </section>
        {active&&<TeacherDetail profile={active} onReset={()=>openReset(selected)}/>}
      </>}
    </main>
    <dialog ref={dialog} className="number-dialog arcade-panel" aria-labelledby="teacher-reset-title" onCancel={()=>{if(resetting)return;setError('');setConfirmation('');}}>
      <div className="number-confirm-content"><h2 id="teacher-reset-title">{resetTarget==='all'?'전체 학생 기록 초기화':`${resetTarget}번 기록 초기화`}</h2><p>{resetTarget==='all'?'1~23번 모든 학생의 문제·도전·최고 점수와 명예의 전당 기록이 삭제됩니다. 되돌릴 수 없습니다.':'문제·도전·최고 점수가 모두 지워집니다.'}</p>{resetTarget==='all'&&<label className="teacher-confirm-label">계속하려면 <strong>전체 초기화</strong>를 입력하세요<input className="teacher-confirm-input" value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off" /></label>}{error&&<p className="storage-error" role="alert">{error}</p>}<div className="number-confirm-actions"><button className="quiet-button" disabled={resetting} onClick={()=>dialog.current?.close()}>취소</button><button className={resetTarget==='all'?'quiet-button teacher-reset-all-confirm':'primary-button'} disabled={resetting||(resetTarget==='all'&&confirmation.trim()!=='전체 초기화')} onClick={()=>void reset()}>{resetting?'처리 중':resetTarget==='all'?'전체 기록 삭제':'초기화'}</button></div></div>
    </dialog>
  </div>;
}
