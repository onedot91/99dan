import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { STAIRS_LIVES, isGate, stairsDifficulty, stairsScore, stairsSteps, stairsToNextGate } from '../game/stairsRun';
import type { StairsRun } from '../game/stairsRun';
import type { StairsGame } from '../game/useStairsGame';
import type { StairsSync } from '../cloud/useStairsSync';
import { VERTICAL_SETS } from '../game/verticalSets';
import { VerticalBoard } from './VerticalScreen';
import { NumberPad } from './NumberPad';
import { Icon } from './Icon';
import { PixelArt } from './PixelArt';
import { FriendSprite } from './FriendSprite';
import { reducedMotion, useCountUp } from './BlockScreen';
import type { Cue } from '../game/audio';

/* 계단: 왼쪽 계단과 오르기·방향전환 버튼, 가운데 세로셈, 오른쪽 키패드. 휴대폰은 오를 때 계단, 풀 때 세로셈만 보인다. */
const BELOW=5,ABOVE=11;
function Hearts({lives}:{readonly lives:number}){
  return <span className="stairs-hearts" role="img" aria-label={`목숨 ${lives}개`}>{Array.from({length:STAIRS_LIVES},(_,i)=><span key={`${i}:${i<lives}`} className={i<lives?'on':'lost'}><Icon name="heart" size={20}/></span>)}</span>;
}
export function StairsProgress({run}:{readonly run:StairsRun}){
  const score=stairsScore(run);
  const previous=useRef(score),[change,setChange]=useState<{readonly key:number;readonly amount:number}|null>(null);
  useEffect(()=>{const amount=score-previous.current;previous.current=score;if(amount>0)setChange({key:score,amount});},[score]);
  return <div className="vertical-progress stairs-progress"><span className="vertical-live-score" role="status" aria-label={`점수 ${score}점`}><strong key={`score:${score}`} className={change?'score-earned':''}>{score.toLocaleString()}</strong><small>점</small>{change&&<i key={`change:${change.key}`} className="vertical-score-change" aria-hidden="true">+{change.amount}</i>}</span><Hearts lives={run.lives}/><span className="stairs-height" aria-label={`${run.height}칸`}><Icon name="stairs" size={18}/>{run.height}</span></div>;
}

function StairsField({run,partner}:{readonly run:StairsRun;readonly partner:string|null}){
  // 칸 i의 가로 위치: 0번 칸에서 steps를 차례로 더한 값.
  const xs=[0];for(let i=0;i<run.steps.length;i++)xs.push(xs[i]!+run.steps[i]!);
  const from=Math.max(0,run.height-BELOW),to=Math.min(xs.length-1,run.height+ABOVE);
  const here=xs[run.height]!;
  const slipping=run.lastSlip!==null&&run.lastSlip===run.log.length-1;
  return <div className={`stairs-scene${run.ended==='fallen'?' fallen':''}`} aria-hidden="true">
    <div className="stairs-world" style={{'--cx':here,'--cy':run.height} as CSSProperties}>
      {Array.from({length:to-from+1},(_,k)=>{
        const i=from+k,gate=isGate(i);
        return <i key={i} className={`stair${gate?' gate':''}${gate&&i<run.height||gate&&i===run.height&&run.phase!=='solve'?' opened':''}${i===run.height?' here':''}`} style={{'--x':xs[i],'--y':i} as CSSProperties}>{gate&&<b>{i<run.height||i===run.height&&run.phase!=='solve'?<Icon name="check" size={16}/>:<Icon name="lock" size={16}/>}</b>}</i>;
      })}
      <span key={slipping?`slip:${run.lastSlip}`:'climber'} className={`stairs-climber${run.facing<0?' left':''}${slipping?' slip':''}`} style={{'--x':here,'--y':run.height} as CSSProperties}>
        {partner?<FriendSprite id={partner} fill/>:<img src="character.png" alt=""/>}
      </span>
    </div>
    {slipping&&<strong key={`lost:${run.lastSlip}`} className="stairs-lost">-1 <Icon name="heart" size={22}/></strong>}
  </div>;
}

export function StairsPlay({game,partner,onCue}:{readonly game:StairsGame;readonly partner:string|null;readonly onCue:(cue:Cue)=>void}){
  const run=game.run;
  const [wrong,setWrong]=useState(false);
  const steps=run?.problem?stairsSteps(run.problem):[];
  const current=run?.problem?steps[run.problem.stepIndex]:undefined;
  const input=(key:string)=>{
    if(!run||run.phase!=='solve'||!run.problem)return;
    if(key==='Enter'&&run.problem.entry&&current){const correct=Number(run.problem.entry)===current.expected;setWrong(!correct);onCue(correct?'correct':'wrong');}
    else if(/^\d$/.test(key))setWrong(false);
    game.input(key);
  };
  const move=(type:'climb'|'turn')=>{
    if(!run||run.phase!=='climb')return;
    const next=type==='climb'?game.climb():game.turn();
    if(!next||next===run)return;
    if(next.slips>run.slips){if(next.phase!=='over')onCue('invalid');}
    else if(next.phase==='solve')onCue('unlock');
    else onCue('place');
  };
  // 문제를 다 풀면 도장을 잠깐 보여 주고(휴대폰은 이때 계단 화면으로 넘어간다) 다시 오른다.
  const [handoff,setHandoff]=useState(false);
  const solvedBefore=useRef(run?.solved??0);
  useEffect(()=>{
    if(!run||run.solved<=solvedBefore.current){solvedBefore.current=run?.solved??0;return undefined;}
    solvedBefore.current=run.solved;setHandoff(true);setWrong(false);
    const t=window.setTimeout(()=>setHandoff(false),reducedMotion()?200:650);
    return()=>window.clearTimeout(t);
  },[run?.solved]);
  // 찍기: 세로셈 위에 목숨 -1 도장을 찍고 종이를 흔든다.
  const [mash,setMash]=useState<number|null>(null);
  useEffect(()=>{
    if(run?.lastMash==null)return undefined;
    setMash(run.lastMash);if(run.phase!=='over')onCue('invalid');
    const t=window.setTimeout(()=>setMash(null),reducedMotion()?900:1300);return()=>window.clearTimeout(t);
  },[run?.lastMash]);
  useEffect(()=>{
    if(run?.phase==='solve')document.querySelector<HTMLElement>('.stairs-play .vertical-cell[aria-current="step"]')?.focus({preventScroll:true});
  },[run?.phase,run?.problem?.stepIndex]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(!run||event.ctrlKey||event.metaKey||event.altKey||event.repeat||document.querySelector('dialog[open]'))return;
      if(run.phase==='climb'){
        const type=event.key==='ArrowRight'||event.key==='x'||event.key==='X'?'climb':event.key==='ArrowLeft'||event.key==='z'||event.key==='Z'?'turn':null;
        if(type){event.preventDefault();move(type);}
      }else if(run.phase==='solve'&&(/^\d$/.test(event.key)||['Enter','Backspace','Delete'].includes(event.key))){
        if(event.target instanceof HTMLButtonElement&&(event.key==='Enter'||event.key===' ')&&!event.target.classList.contains('vertical-cell'))return;
        event.preventDefault();input(event.key);
      }
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  });
  if(!run)return null;
  const solving=run.phase==='solve'||handoff;
  const climbing=run.phase==='climb';
  const fact=run.problem?.questions[0];
  const left=stairsToNextGate(run);
  return <main className={`stairs-play${solving?' solving':' climbing'}`}>
    <section className="stairs-field arcade-panel" aria-label="계단">
      <StairsField run={run} partner={partner}/>
      <div className="stairs-buttons" role="group" aria-label="계단 조작">
        <button className="stairs-turn" disabled={!climbing} onClick={()=>move('turn')}><Icon name="turn" size={28}/><span>방향전환</span><kbd className="wide-only">←</kbd></button>
        <button className="stairs-climb" disabled={!climbing} onClick={()=>move('climb')}><Icon name="stairs" size={28}/><span>오르기</span><kbd className="wide-only">→</kbd></button>
      </div>
    </section>
    <section className={`vertical-paper arcade-panel stairs-paper${mash!==null?' mashed':''}`} key={run.history.length} aria-label="세로셈">
      {solving&&run.problem&&fact?<VerticalBoard fact={fact} session={run.problem} steps={steps} current={current} onFocus={()=>document.querySelector<HTMLElement>('.stairs-play .vertical-cell[aria-current="step"]')?.focus({preventScroll:true})} wrong={wrong}/>
        :<div className="stairs-next"><Icon name="lock" size={40}/><strong>{left}칸</strong><span>더 오르면 문제 계단!</span><small>{VERTICAL_SETS[stairsDifficulty(run.solved)-1]!.label}</small></div>}
      {handoff&&<div className="vertical-check-stamp block-stamp" aria-hidden="true"><Icon name="check" size={80}/></div>}
      {mash!==null&&<div key={mash} className="block-mash" role="alert"><strong>-1 <Icon name="heart" size={28}/></strong><span>천천히 생각해요!</span></div>}
    </section>
    <section className="vertical-controls stairs-controls" aria-label="숫자 입력">
      <span className="vertical-sr-only" role="status" aria-live="polite">{run.phase==='solve'?wrong?'이 칸을 다시 풀어 봐요.':current?.instruction??'':run.phase==='climb'?'계단을 올라요.':''}</span>
      <div className="vertical-pad"><div className="vertical-pad-keys"><NumberPad onInput={input} disabled={run.phase!=='solve'} canSubmit={run.phase==='solve'&&!!run.problem?.entry}/></div></div>
    </section>
  </main>;
}

function StairsSyncNotice({sync}:{readonly sync:StairsSync}){
  return sync.state==='saving'?<p className="sync-status" role="status">순위 저장 중</p>:sync.state==='saved'?<p className="sync-status" role="status">순위 저장 완료</p>:sync.state==='rejected'?<p className="sync-status" role="status">이번 판은 순위에 넣지 못했어요</p>:sync.state==='error'?<div className="vertical-assignment-error" role="alert"><p>{sync.blocked?'점수를 저장하지 못했습니다.':'시작하지 못했습니다. 다시 시도해 주세요.'}</p>{sync.blocked&&<button className="quiet-button" onClick={()=>void sync.retry()}>저장 재시도</button>}</div>:null;
}
export function StairsResult({game,sync,starting,onHome,onAgain,onHall}:{readonly game:StairsGame;readonly sync:StairsSync;readonly starting:boolean;readonly onHome:()=>void;readonly onAgain:()=>void;readonly onHall:()=>void}){
  const run=game.run;if(!run||run.phase!=='over')return null;
  // 서버가 재생해 매긴 점수가 오면 그 점수를, 최고 기록은 서버와 이 기기 중 높은 쪽과 비교한다.
  const score=sync.serverScore??stairsScore(run);
  const bestBefore=sync.serverBest===null?game.bestBefore:game.bestBefore===null?sync.serverBest:Math.max(sync.serverBest,game.bestBefore);
  return <StairsResultView run={run} score={score} record={bestBefore===null||score>bestBefore} bestBefore={bestBefore} sync={sync} starting={starting} onHome={onHome} onAgain={onAgain} onHall={onHall}/>;
}
function StairsResultView({run,score,record,bestBefore,sync,starting,onHome,onAgain,onHall}:{readonly run:StairsRun;readonly score:number;readonly record:boolean;readonly bestBefore:number|null;readonly sync:StairsSync;readonly starting:boolean;readonly onHome:()=>void;readonly onAgain:()=>void;readonly onHall:()=>void}){
  const shown=useCountUp(score),done=shown===score;
  return <main className="vertical-result block-result stairs-result">
    <section className="vertical-result-hero" aria-label="결과">
      <div className="vertical-result-trophy"><PixelArt kind="trophy"/></div>
      <div className="vertical-completion-badge">계단</div>
      <h1>{run.ended==='fallen'?'떨어졌어요!':'여기까지!'}</h1>
      <strong className={`vertical-result-score${done?' counted':''}`} aria-label={`${score}점`}>{shown.toLocaleString()}<small>점</small></strong>
      <p className={`vertical-score-rule${done&&record?' block-record':''}`}>{record?bestBefore===null?'첫 기록!':'최고 기록 갱신!':`최고 ${bestBefore!.toLocaleString()}점`}</p>
    </section>
    <section className="vertical-result-summary block-result-summary" aria-label="기록">
      <div className="block-result-stats"><div><span>오른 계단</span><strong>{run.height}</strong></div><div><span>푼 문제</span><strong>{run.solved}</strong></div><div><span>난이도</span><strong>{VERTICAL_SETS[stairsDifficulty(Math.max(0,run.history.length-1))-1]!.label}</strong></div></div>
      {sync.state!=='local'&&<button className="quiet-button vertical-hall-link" onClick={onHall}>명예의 전당<Icon name="arrow"/></button>}
      <div className="vertical-result-actions"><button className="quiet-button" aria-label="처음으로" onClick={onHome}><Icon name="back"/><span className="wide-only">처음으로</span></button><button className="primary-button" disabled={starting||sync.state==='starting'||sync.blocked} onClick={onAgain}>{starting||sync.state==='starting'?'불러오는 중':'다시 하기'}<Icon name="arrow"/></button></div>
      <StairsSyncNotice sync={sync}/>
    </section>
  </main>;
}
