import { useEffect, useRef } from 'react';
import { digitAt, PLACES, STAGE_LABELS, verticalScore, verticalSteps, verticalQuestionSteps, verticalSolved } from '../game/vertical';
import type { useVerticalSync } from '../cloud/useVerticalSync';
import type { DigitRow, Stage, VerticalFact, VerticalSession, VerticalStep } from '../game/vertical';
import type { VerticalGame } from '../game/useVerticalGame';
import { NumberPad } from './NumberPad';
import { Icon } from './Icon';
import { PixelArt } from './PixelArt';
import { verticalFeedback } from '../game/verticalFeedback';


function VerticalBurst(){
  return <span className="vertical-burst" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i}/>)}</span>;
}
function DigitCell({value,active,carry,source,label,wrong,confirmKey,attempt,onFocus,selectable=false}:{readonly value:string;readonly active:boolean;readonly carry:boolean;readonly source:boolean;readonly label:string;readonly wrong:boolean;readonly confirmKey:string|null;readonly attempt:number;readonly onFocus:()=>void;readonly selectable?:boolean}){
  return <button type="button" className={`vertical-cell${carry?' carry-cell':''}${selectable?' selectable-cell':''}${active?' current-cell':''}${active&&wrong?' wrong-cell':''}${!active&&value?' filled-cell':''}${source?' source-cell':''}${confirmKey?' confirmed-cell':''}`} disabled={!active&&!selectable} aria-label={`${label}${active?' 입력 칸':selectable?' 빈칸 선택':` ${value||'빈칸'}`}`} aria-current={active?'step':undefined} aria-invalid={active&&wrong?true:undefined} onClick={onFocus}>
    <span key={confirmKey??`${active}:${wrong?attempt:0}`} className="vertical-cell-face"><span className={active&&value?'vertical-entry':''} key={active?value:'answer'}>{value}</span>{confirmKey&&<VerticalBurst/>}</span>
  </button>;
}

export function VerticalBoard({fact,session,steps,current,onFocus,wrong}:{readonly fact:VerticalFact;readonly session:VerticalSession;readonly steps:readonly VerticalStep[];readonly current:VerticalStep|undefined;readonly onFocus:(step?:number)=>void;readonly wrong:boolean}){
  const puzzle=!!fact.holes;
  const direct=!puzzle&&fact.directZero===true;
  const stage=current?.stage??(direct?'tens':'sum');
  const visibleSteps=puzzle?verticalSteps(fact,true):steps;
  const solved=puzzle?verticalSolved(session):null;
  const places=[3,2,1,0];
  const answered=steps.slice(0,session.stepIndex);
  const feedback=verticalFeedback(session);
  const renderOperand=(row:'operand-a'|'operand-b',value:number)=>places.map(place=>{
    const index=puzzle?steps.findIndex(step=>step.row===row&&step.place===place):-1;
    const source=!puzzle&&!!current&&stage!=='sum'&&(row==='operand-a'?place<2:place===(stage==='ones'?0:1));
    if(index<0)return <span key={place} className={source?'source-digit':''}><span>{place<2?digitAt(value,place):''}</span></span>;
    const cell=steps[index]!,active=cell.id===current?.id,isSolved=solved?.has(index);
    return <DigitCell key={place} active={active} carry={false} source={false} selectable={!isSolved} value={active?session.entry:isSolved?String(cell.expected):''} label={`${row==='operand-a'?'위의 수':'곱하는 수'} ${PLACES[place]}의 자리`} wrong={wrong} confirmKey={feedback?.correct&&feedback.cellId===cell.id?feedback.key:null} attempt={session.events.length} onFocus={()=>onFocus(index)}/>;
  });
  const renderRow=(row:DigitRow,carry=false)=>{
    const activeStage:Stage=direct&&row==='sum'?'tens':row==='ones'||row==='carry-ones'?'ones':row==='tens'||row==='carry-tens'?'tens':'sum';
    const stageIndex={ones:0,tens:1,sum:2};
    const future=!puzzle&&stageIndex[activeStage]>stageIndex[stage];
    const product=row==='ones'||row==='carry-ones'?'ones':row==='tens'||row==='carry-tens'||direct&&row==='sum'&&!!current?'tens':undefined;
    return <div className={`vertical-row${carry?' carry-row':''}${future?' future-row':''}`} key={row} data-product={product} role="group" aria-label={carry?`${STAGE_LABELS[activeStage]} 올림`:row==='sum'?'최종 답':`${STAGE_LABELS[activeStage]} 결과`}>
      {places.map(place=>{
        const cell=visibleSteps.find(s=>s.row===row&&s.place===place);
        const index=steps.findIndex(s=>s.id===cell?.id);
        const active=!!cell&&cell.id===current?.id;
        const answer=puzzle?cell&&(index<0||solved?.has(index))?cell:undefined:answered.find(s=>s.id===cell?.id);
        const fixedZero=!puzzle&&row==='tens'&&place===0&&!session.manualZero;
        const sumPlace=current?.row==='carry-sum'?current.place-1:current?.place;
        if(fixedZero)return future?<span key={place}/>:<span className={`vertical-fixed-zero${stage==='sum'&&sumPlace===0?' source-cell':''}`} key={place} aria-label="십의 자리 곱셈의 일의 자리 0"><span>0</span></span>;
        if(!cell||(!puzzle&&!active&&!answer))return <span className="vertical-empty" key={place}/>;
        const source=!puzzle&&!!answer&&(carry?row==='carry-sum'?stage==='sum'&&current?.row==='sum'&&place===current.place:activeStage===stage&&current?.aPlace===1:stage==='sum'&&row!=='sum'&&place===sumPlace);
        return <DigitCell key={`${place}:${active}`} active={active} carry={carry} source={source} selectable={puzzle&&index>=0&&!solved?.has(index)} value={active?session.entry:answer?String(answer.expected):''} label={`${carry?'올림':row==='sum'?'답':'부분곱'} ${PLACES[place]}의 자리`} wrong={wrong} confirmKey={feedback?.correct&&feedback.cellId===cell.id?feedback.key:null} attempt={session.events.length} onFocus={()=>onFocus(puzzle?index:undefined)}/>;
      })}
    </div>;
  };
  return <div className="vertical-board" role="group" data-stage={puzzle?'puzzle':stage} data-direct-zero={direct?'true':undefined} data-addition-carry={!puzzle&&stage==='sum'&&steps.some(s=>s.row==='carry-sum')?'true':undefined} aria-label={puzzle?'빈칸이 있는 완성된 세로식':`${fact.a} 곱하기 ${fact.b}, 세로식`}>
    <div className="vertical-columns" aria-hidden="true">{places.map(place=><i key={place} className={current?.place===place?'active-column':''}/>)}</div>
    {puzzle||stage==='sum'?<div className="vertical-row carry-row" aria-hidden="true"/>:renderRow(stage==='tens'?'carry-tens':'carry-ones',true)}
    <div className="vertical-row operand-row" aria-label={puzzle?'위의 수':`위의 수 ${fact.a}`}>{renderOperand('operand-a',fact.a)}</div>
    <div className="vertical-row operand-row" aria-label={puzzle?'곱하는 수':`곱하는 수 ${fact.b}`}>{renderOperand('operand-b',fact.b).map((cell,index)=>places[index]===2?<span className="vertical-operator" data-product={!puzzle&&current&&stage!=='sum'?stage:undefined} key={2}><span>×</span></span>:cell)}</div>
    <div className="vertical-rule"/>
    {direct?<div aria-hidden="true"/>:<>
      {puzzle?<div className="vertical-row carry-row" aria-hidden="true"/>:renderRow('carry-sum',true)}
      {renderRow('ones')}
      {renderRow('tens')}
      <div className={`vertical-rule${!puzzle&&stage!=='sum'?' pending-rule':''}`}/>
    </>}
    {renderRow('sum')}
  </div>;
}

type VerticalSync=ReturnType<typeof useVerticalSync>;
function VerticalSyncNotice({sync}:{readonly sync:VerticalSync}){
  return sync.state==='saving'?<p className="sync-status" role="status">순위 저장 중</p>:sync.state==='saved'?<p className="sync-status" role="status">순위 저장 완료</p>:sync.state==='error'?<div className="vertical-assignment-error" role="alert"><p>{sync.blocked?'점수를 저장하지 못했습니다.':'연습을 시작하지 못했습니다. 다시 시작해 주세요.'}</p>{sync.blocked&&<button className="quiet-button" onClick={()=>void sync.retry()}>저장 재시도</button>}</div>:null;
}
export function VerticalSetup({sync,onStart,assignmentState,onRetry}:{readonly sync:VerticalSync;readonly onStart:()=>void;readonly assignmentState:'ready'|'loading'|'error';readonly onRetry:()=>void}){
  return <main className="vertical-setup">
    <div className="screen-heading"><h1>두 자리 수</h1><p className="wide-only">5문제 · 시간 제한 없음</p></div>
    <button className="primary-button" disabled={assignmentState!=='ready'||sync.state==='starting'||sync.blocked} onClick={onStart}>{assignmentState==='loading'||sync.state==='starting'?'불러오는 중':'5문제 시작'}<Icon name="arrow"/></button>
    {sync.blocked||sync.state==='error'?<VerticalSyncNotice sync={sync}/>:null}
    {assignmentState==='error'&&<div className="vertical-assignment-error" role="alert"><p>설정을 불러오지 못했습니다.</p><button className="quiet-button" onClick={onRetry}>다시 시도</button></div>}
  </main>;
}

export function VerticalProgress({game}:{readonly game:VerticalGame}){
  const session=game.session;
  if(!session)return null;
  const fact=session.questions[session.index];
  const complete=!!fact&&session.stepIndex===verticalQuestionSteps(fact,session.manualZero).length;
  const feedback=verticalFeedback(session);
  return <div className="vertical-progress"><span className="vertical-live-score" role="status" aria-label={`점수 ${verticalScore(session)}점`}><strong key={`score:${feedback?.key??session.index}`} className={feedback?feedback.correct?'score-earned':'score-lost':''}>{verticalScore(session).toLocaleString()}</strong><small>점</small>{feedback&&feedback.amount!==0&&<i key={`change:${feedback.key}`} className={`vertical-score-change${feedback.correct?'':' lost'}`} aria-hidden="true">{feedback.amount>0?'+':''}{feedback.amount}</i>}</span><div className={`vertical-progress-pips${session.questions.length===10?' ten-pips':''}`} role="group" aria-label={`${session.questions.length}문제 중 ${session.index+Number(complete)}문제 완성${complete?'':`, ${session.index+1}번째 문제 풀이 중`}`}>{Array.from({length:session.questions.length},(_,i)=>{const state=i<session.index+Number(complete)?'done':i===session.index?'now':'';return <span key={`${i}:${state}`} className={state}>{state==='done'?<Icon name="check" size={18}/>:i+1}</span>;})}</div>{!game.saved&&<span className="vertical-storage-warning">저장 불가</span>}</div>;
}

export function VerticalPlay({game,onExit,onComplete,onCue}:{readonly game:VerticalGame;readonly onExit:()=>void;readonly onComplete:()=>void;readonly onCue:(correct:boolean)=>void}){
  const activeCell=useRef<HTMLButtonElement|null>(null);
  const correctFeedback=useRef<HTMLDivElement|null>(null);
  const transition=useRef({next:game.next,onComplete});
  transition.current={next:game.next,onComplete};
  const session=game.session;
  const fact=session?.questions[session.index];
  const steps=fact?verticalQuestionSteps(fact,session.manualZero):[];
  const current=session?steps[session.stepIndex]:undefined;
  const complete=!!session&&!current;
  const wrong=game.feedback==='이 칸을 다시 풀어 봐요.';
  const focusCurrent=()=>activeCell.current?.focus({preventScroll:true});
  const chooseCell=(step?:number)=>{if(step!==undefined)game.select(step);else focusCurrent();};
  const input=(key:string)=>{
    if(complete)return;
    if(key==='Enter'&&session?.entry&&current)onCue(Number(session.entry)===current.expected);
    game.input(key);
  };
  useEffect(()=>{
    activeCell.current=document.querySelector<HTMLButtonElement>('.vertical-cell[aria-current="step"]');
    if(complete)correctFeedback.current?.focus({preventScroll:true});
    else activeCell.current?.focus({preventScroll:true});
  },[session?.index,session?.stepIndex,complete]);
  useEffect(()=>{
    if(!complete||session?.completed)return;
    const last=session?.index===(session?.questions.length??0)-1;
    const timer=window.setTimeout(()=>{
      transition.current.next();
      if(last)transition.current.onComplete();
    },800);
    return()=>window.clearTimeout(timer);
  },[complete,session?.id,session?.index,session?.completed]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.ctrlKey||event.metaKey||event.altKey||event.repeat)return;
      if(event.key==='Escape'){event.preventDefault();onExit();return;}
      if(event.target instanceof HTMLButtonElement&&(event.key==='Enter'||event.key===' ')){
        if(!event.target.classList.contains('vertical-cell'))return;
      }
      if(/^\d$/.test(event.key)||['Enter','Backspace','Delete'].includes(event.key)){
        event.preventDefault();input(event.key);
      }
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  });
  if(!session||!fact)return null;
  const status=complete?'한 문제 완성!':game.feedback||current?.instruction;
  return <main className={`vertical-play${wrong?' has-error':''}${complete?' problem-complete':''}`}>
    <section className="vertical-paper arcade-panel" key={`${session.id}:${session.index}`}>
      <VerticalBoard fact={fact} session={session} steps={steps} current={current} onFocus={chooseCell} wrong={wrong}/>
    </section>
    <section className="vertical-controls" aria-label="계산과 숫자 입력">
      <span className="vertical-sr-only" role="status" aria-live="polite">{status}{!complete&&current?` ${current.calculation}`:''}</span>
      <div className="vertical-pad">
        <div className="vertical-pad-keys" aria-hidden={complete?true:undefined}><NumberPad onInput={input} disabled={complete} canSubmit={session.entry.length>0}/></div>
        {complete&&<div ref={correctFeedback} className="vertical-correct-feedback" key={session.index} tabIndex={-1} aria-label="정답"><div className="vertical-check-stamp"><Icon name="check" size={80}/><VerticalBurst/></div></div>}
      </div>
    </section>
  </main>;
}

export function VerticalResult({game,sync,onHome,onAgain,onHall,assignmentState}:{readonly game:VerticalGame;readonly sync:VerticalSync;readonly onHome:()=>void;readonly onAgain:()=>void;readonly onHall:()=>void;readonly assignmentState:'ready'|'loading'|'error'}){
  const session=game.session;if(!session?.completed)return null;
  return <main className="vertical-result" data-count={session.questions.length}>
    <section className="vertical-result-hero" aria-label="완료 점수">
      <div className="vertical-result-trophy"><PixelArt kind="trophy"/><VerticalBurst/></div>
      <div className="vertical-completion-badge">두 자리 수</div>
      <h1>{session.questions.length}문제를 끝까지 풀었어요!</h1>
      <strong className="vertical-result-score">{(sync.serverScore??verticalScore(session)).toLocaleString()}<small>점</small></strong>
      <p className="vertical-score-rule">문제당 200 · 오답 −30</p>
      {session.timeScoring&&<p className="vertical-score-rule">{session.cellScoring?'칸별 1초 구간 · 오답 −10':`칸별 시간 · 문제당 최대 −${session.tightTime?60:4}`}</p>}
    </section>
    <section className="vertical-result-summary" aria-label="완성한 문제">
      <div className="vertical-finished-facts" tabIndex={session.questions.length===10?0:undefined} role={session.questions.length===10?'region':undefined} aria-label={session.questions.length===10?'완성한 10문제 목록':undefined}>{session.questions.map((fact,i)=><div key={`${fact.a}:${fact.b}`}><span>{i+1}</span><strong>{fact.a} × {fact.b} = {fact.a*fact.b}</strong><Icon name="check" size={18}/></div>)}</div>
      <button className="quiet-button vertical-hall-link" onClick={onHall}>명예의 전당<Icon name="arrow"/></button>
      <div className="vertical-result-actions"><button className="quiet-button" aria-label="처음으로" onClick={onHome}><Icon name="back"/><span className="wide-only">처음으로</span></button><button className="primary-button" disabled={assignmentState==='loading'||sync.state==='starting'||sync.blocked} onClick={onAgain}>{assignmentState==='loading'||sync.state==='starting'?'불러오는 중':`새 ${session.questions.length}문제 풀기`}<Icon name="arrow"/></button></div>
      {session.version>=3?<VerticalSyncNotice sync={sync}/>:<p className="sync-status">이전 연습은 순위에 반영하지 않습니다.</p>}
      {assignmentState==='error'&&<p role="alert" className="vertical-storage-warning">설정을 불러오지 못했습니다. 다시 시도해 주세요.</p>}
      {!game.saved&&<p className="vertical-storage-warning" role="status">완료 기록 저장 불가</p>}
    </section>
  </main>;
}
