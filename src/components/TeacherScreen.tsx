import { useEffect, useRef, useState } from 'react';
import { loadTeacherRecords, resetAllStudentRecords, resetStudentRecords, resetStudentRecordScopes } from '../cloud/client';
import type { SharedProfile } from '../cloud/types';
import { DURATIONS, modeLabel } from '../types/game';
import { Icon } from './Icon';
import { levelFor, VERTICAL_EXP_PER_QUESTION } from '../game/learning';
import { FRIENDS, friendById } from '../game/friends';
import { FriendSprite } from './FriendSprite';
import { playedToday } from '../game/teacherActivity';
import { TEACHER_RESET_SCOPES } from '../game/teacherReset';
import { HallScreen } from './HallScreen';
import type { TeacherResetScope } from '../game/teacherReset';

// 서버가 전체 기록으로 계산한 두 자리 수·블록 경험치를 쓴다. 이전 서버는 두 자리 수 최근 기록으로 대신한다.
const expOf=(profile:SharedProfile)=>totals(profile).correct+(profile.verticalExp||profile.verticalSessions.reduce((sum,s)=>sum+s.count*VERTICAL_EXP_PER_QUESTION,0))+profile.blockExp+profile.stairsExp;
function totals(profile:SharedProfile){return Object.values(profile.records).reduce((sum,record)=>({attempts:sum.attempts+record.attempts,correct:sum.correct+record.correct,wrong:sum.wrong+record.wrong}),{attempts:0,correct:0,wrong:0});}
const sessionDate=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function TeacherDetail({profile,onReset}:{readonly profile:SharedProfile;readonly onReset:()=>void}){
  const number=profile.studentNumber;
  const total=totals(profile);
  // Times-table and two-digit runs in one list, newest first; old sessions without a date go last.
  const recent=[
    ...profile.sessions.slice(-5).reverse().map(s=>({id:s.id,label:modeLabel(s.mode,s.duration),finishedAt:s.finishedAt??null,detail:`정답 ${s.correct}개`,score:s.score})),
    ...profile.verticalSessions.map(s=>({id:s.id,label:`두 자리 수 ${s.count}문제`,finishedAt:s.finishedAt,detail:`오답 ${s.mistakes}개`,score:s.score})),
    ...profile.blockSessions.map(s=>({id:s.id,label:'블록',finishedAt:s.finishedAt,detail:`${s.solved}문제 · ${s.lines}줄`,score:s.score})),
    ...profile.stairsSessions.map(s=>({id:s.id,label:'계단',finishedAt:s.finishedAt,detail:`${s.height}칸 · ${s.solved}문제`,score:s.score}))
  ].sort((a,b)=>(b.finishedAt?Date.parse(b.finishedAt):-Infinity)-(a.finishedAt?Date.parse(a.finishedAt):-Infinity)).slice(0,5);
  const exp=expOf(profile);
  const level=levelFor(exp);
  const partner=friendById(profile.friends?.partner);
  // All-time bests from the server; an older server only sends recent runs, so their best stands in.
  const recentBest=(scores:readonly number[])=>scores.length?Math.max(...scores):null;
  const other=profile.otherBests??{
    vertical5:recentBest(profile.verticalSessions.filter(s=>s.count===5).map(s=>s.score)),
    vertical10:recentBest(profile.verticalSessions.filter(s=>s.count===10).map(s=>s.score)),
    block:recentBest(profile.blockSessions.map(s=>s.score))};
  const bests:readonly (readonly [string,number|null|undefined])[]=[
    ...DURATIONS.map(duration=>[`${duration}분`,profile.best.find(best=>best.duration===duration)?.score] as const),
    ['계단',profile.stairsBest],['블록',other.block],['5문제',other.vertical5],['10문제',other.vertical10]];
  return <section className="teacher-detail" aria-label={`${number}번 상세 기록`}>
    <div className="teacher-section-head"><h2>{number}번</h2><button className="quiet-button teacher-reset teacher-icon-button" aria-label="기록 초기화" title={`${number}번 기록 초기화`} onClick={onReset}><Icon name="trash" size={22}/></button></div>
    <div className="teacher-level">
      <span className="level-number"><small>Lv.</small>{level.number}</span>
      <div><strong>{level.label}</strong><small>다음 레벨까지 {(level.next??level.floor)-exp}점</small></div>
      <div className="teacher-friend">{partner?<><FriendSprite id={partner.id}/><span><strong>{partner.name}</strong><small>펫 {profile.friends?.owned.length??0} / {FRIENDS.length}</small></span></>:<small>{profile.friends?'아직 고른 펫 없음':'펫은 서버 업데이트 후 표시'}</small>}</div>
    </div>
    <p className="teacher-summary">정답 <strong>{total.correct}</strong><span aria-hidden="true">·</span> 오답 <strong>{total.wrong}</strong></p>
    <div className="teacher-bests">{bests.map(([label,value])=><div key={label}><span>{label}</span><strong>{value?.toLocaleString()??'—'}</strong></div>)}</div>
    <h3>최근 도전</h3>
    {recent.length?<div className="teacher-sessions">{recent.map(session=><div key={session.id}><div className="teacher-session-info"><strong>{session.label}</strong>{session.finishedAt?<time dateTime={session.finishedAt}>{sessionDate.format(new Date(session.finishedAt))}</time>:<small>날짜 정보 없음</small>}</div><span>{session.detail}</span><b>{session.score.toLocaleString()}점</b></div>)}</div>:<p className="teacher-empty">기록 없음</p>}
  </section>;
}

export function TeacherScreen({onExit}:{readonly onExit:()=>void}){
  const [profiles,setProfiles]=useState<readonly SharedProfile[]>([]);
  const [selected,setSelected]=useState(1);
  const [state,setState]=useState<'loading'|'ready'|'error'|'expired'>('loading');
  const [resetting,setResetting]=useState(false);
  const [resetTarget,setResetTarget]=useState<number|'all'>(1);
  const [resetMode,setResetMode]=useState<'partial'|'full'>('partial');
  const [resetScopes,setResetScopes]=useState<readonly TeacherResetScope[]>([]);
  const [confirmation,setConfirmation]=useState('');
  const [error,setError]=useState('');
  const [now,setNow]=useState(()=>new Date());
  const [hall,setHall]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const resetPending=useRef(false);
  const load=async()=>{
    setState('loading');
    try{setProfiles(await loadTeacherRecords());setState('ready');}
    catch(cause){setState(cause instanceof Error&&cause.message==='CLOUD_401'?'expired':'error');}
  };
  useEffect(()=>{void load();},[]);
  useEffect(()=>{
    const updateDay=()=>setNow(new Date());
    const timer=window.setInterval(updateDay,60000);
    document.addEventListener('visibilitychange',updateDay);
    return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',updateDay);};
  },[]);
  const reset=async()=>{
    if(resetPending.current||resetTarget!=='all'&&resetMode==='partial'&&(!resetScopes.length||!profiles.find(p=>p.studentNumber===resetTarget)?.canResetScopes))return;
    resetPending.current=true;
    setResetting(true);setError('');
    try{if(resetTarget==='all')await resetAllStudentRecords();else if(resetMode==='partial')await resetStudentRecordScopes(resetTarget,resetScopes);else await resetStudentRecords(resetTarget);dialog.current?.close();setConfirmation('');await load();}
    catch(cause){if(cause instanceof Error&&cause.message==='CLOUD_401'){dialog.current?.close();setState('expired');}else setError('초기화하지 못했습니다. 다시 시도해 주세요.');}
    finally{resetPending.current=false;setResetting(false);}
  };
  const active=profiles.find(profile=>profile.studentNumber===selected);
  const openReset=(target:number|'all')=>{setResetTarget(target);setResetMode(target==='all'?'full':'partial');setResetScopes([]);setConfirmation('');setError('');dialog.current?.showModal();};
  const partial=resetTarget!=='all'&&resetMode==='partial';
  const partialSupported=resetTarget!=='all'&&profiles.find(p=>p.studentNumber===resetTarget)?.canResetScopes===true;
  return <div className="app teacher-app">
    <header className="header"><div className="brand"><span className="brand-mark"><Icon name="chart"/></span><span>{hall?'명예의 전당':'교사 기록'}</span></div><div className="teacher-header-actions"><button className="quiet-button" onClick={()=>setHall(value=>!value)}>{hall?'학생 기록':'명예의 전당'}</button><button className="quiet-button" onClick={onExit}>번호 선택</button></div></header>
    {hall?<HallScreen ready studentNumber={null} initialDuration={1}/>:<main className="teacher-screen">
      {state==='loading'?<p role="status">불러오는 중</p>:state==='expired'?<div className="teacher-message" role="alert"><p>교사 번호를 다시 입력해 주세요.</p><button className="primary-button" onClick={onExit}>번호 선택</button></div>:state==='error'?<div className="teacher-message" role="alert"><p>기록을 불러오지 못했습니다.</p><button className="primary-button" onClick={()=>void load()}>다시 시도</button></div>:<>
        <section className="teacher-list" aria-label="학생 선택">
          <div className="teacher-section-head"><h1>학생 선택</h1><div className="teacher-list-actions"><button className="quiet-button teacher-icon-button" onClick={()=>void load()} aria-label="기록 새로고침" title="기록 새로고침"><Icon name="refresh" size={22}/></button><button className="quiet-button teacher-reset-all teacher-icon-button" aria-label="전체 기록 초기화" title="전체 기록 초기화" onClick={()=>openReset('all')}><Icon name="trashAll" size={22}/></button></div></div>
          <div className="teacher-number-grid">{profiles.map(profile=>{const hasRecords=totals(profile).attempts>0||profile.sessions.length>0||profile.best.length>0||expOf(profile)>0;const today=playedToday([...profile.sessions,...profile.verticalSessions.map(s=>({finishedAt:s.finishedAt,answered:s.count})),...profile.blockSessions.map(s=>({finishedAt:s.finishedAt,answered:s.solved})),...profile.stairsSessions.map(s=>({finishedAt:s.finishedAt,answered:Math.max(s.solved,s.height)}))],now);return <button key={profile.studentNumber} className={`teacher-number${today?' played-today':''}`} aria-label={`${profile.studentNumber}번${hasRecords?', 기록 있음':''}${today?', 오늘 플레이':''}`} aria-pressed={selected===profile.studentNumber} onClick={()=>setSelected(profile.studentNumber)}><span>{profile.studentNumber}번</span><small className="teacher-number-level">{hasRecords?`Lv.${levelFor(expOf(profile)).number}`:'\u00a0'}</small></button>;})}</div>
        </section>
        {active&&<TeacherDetail profile={active} onReset={()=>openReset(selected)}/>}
      </>}
    </main>}
    <dialog ref={dialog} className="number-dialog arcade-panel teacher-reset-dialog" aria-labelledby="teacher-reset-title" onCancel={event=>{if(resetting){event.preventDefault();return;}setError('');setConfirmation('');}}>
      <div className="number-confirm-content"><h2 id="teacher-reset-title">{resetTarget==='all'?'전체 학생 기록 초기화':`${resetTarget}번 기록 초기화`}</h2>
        {resetTarget!=='all'&&<div className="teacher-reset-modes" role="group" aria-label="초기화 범위"><button className="quiet-button" disabled={resetting} aria-pressed={partial} onClick={()=>{setResetMode('partial');setError('');}}>종류 선택</button><button className="quiet-button" disabled={resetting} aria-pressed={!partial} onClick={()=>{setResetMode('full');setError('');}}>모든 기록</button></div>}
        {partial&&<fieldset className="teacher-reset-scopes" disabled={resetting||!partialSupported}><legend className="vertical-sr-only">초기화할 도전 종류</legend>{TEACHER_RESET_SCOPES.filter(scope=>scope.id==='block'?profiles.find(p=>p.studentNumber===resetTarget)?.canResetBlock:scope.id==='stairs'?profiles.find(p=>p.studentNumber===resetTarget)?.canResetStairs:true).map(scope=><label key={scope.id}><input type="checkbox" checked={resetScopes.includes(scope.id)} onChange={event=>{const checked=event.target.checked;setResetScopes(previous=>checked?[...previous,scope.id]:previous.filter(id=>id!==scope.id));}}/><span>{scope.label}</span></label>)}</fieldset>}
        <p>{resetTarget==='all'?'1~23번 모든 학생의 문제·도전·최고 점수와 명예의 전당 기록이 삭제됩니다. 되돌릴 수 없습니다.':partial?'선택한 도전·최고점·순위만 삭제합니다. 누적 정오답·레벨·펫은 유지됩니다.':'문제·도전·최고 점수와 펫이 모두 지워집니다. 되돌릴 수 없습니다.'}</p>
        {partial&&!partialSupported&&<p className="storage-error" role="alert">서버 업데이트 후 종류별 초기화를 사용할 수 있습니다.</p>}
        {resetTarget==='all'&&<label className="teacher-confirm-label">계속하려면 <strong>전체 초기화</strong>를 입력하세요<input className="teacher-confirm-input" value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off" /></label>}
        {error&&<p className="storage-error" role="alert">{error}</p>}<div className="number-confirm-actions"><button className="quiet-button" disabled={resetting} onClick={()=>dialog.current?.close()}>취소</button><button className={resetTarget==='all'?'quiet-button teacher-reset-all-confirm':'primary-button'} disabled={resetting||(resetTarget==='all'&&confirmation.trim()!=='전체 초기화')||(partial&&(!partialSupported||resetScopes.length===0))} onClick={()=>void reset()}>{resetting?'처리 중':resetTarget==='all'?'전체 기록 삭제':partial?'선택 기록 초기화':'모든 기록 초기화'}</button></div>
      </div>
    </dialog>
  </div>;
}
