import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { STAIRS_AHEAD, STAIRS_COIN_POINTS, STAIRS_GATE, STAIRS_LIVES, isGate, stairsHasCoin, stairsPreviewSteps, stairsScore, stairsSteps, stairsToNextGate } from '../game/stairsRun';
import type { StairsRun } from '../game/stairsRun';
import type { StairsGame } from '../game/useStairsGame';
import type { StairsSync } from '../cloud/useStairsSync';
import { VerticalBoard } from './VerticalScreen';
import { NumberPad } from './NumberPad';
import { Icon } from './Icon';
import { PixelArt } from './PixelArt';
import { FriendSprite } from './FriendSprite';
import { reducedMotion, useCountUp } from './BlockScreen';
import type { Cue } from '../game/audio';
import { stairsStreak, stairsStreakTier } from '../game/stairsFeedback';

/* 계단: 왼쪽 계단과 오르기·방향전환 버튼, 가운데 세로셈, 오른쪽 키패드. 휴대폰은 오를 때 계단, 풀 때 세로셈만 보인다. */
const CAMERA_BASELINE=.2,OVERSCAN=3;
function Hearts({lives}:{readonly lives:number}){
  return <span className="stairs-hearts" role="img" aria-label={`목숨 ${lives}개`}>{Array.from({length:STAIRS_LIVES},(_,i)=><span key={`${i}:${i<lives}`} className={i<lives?'on':'lost'}><Icon name="heart" size={22}/></span>)}</span>;
}
function StairsProgress({run}:{readonly run:StairsRun}){
  const score=stairsScore(run);
  const previous=useRef(score),[change,setChange]=useState<{readonly key:number;readonly amount:number}|null>(null);
  useEffect(()=>{const amount=score-previous.current;previous.current=score;if(amount>0)setChange({key:score,amount});},[score]);
  return <div className="stairs-progress"><Hearts lives={run.lives}/><span className="stairs-height" aria-label={`${run.height}층`}><strong key={run.height}>{run.height}</strong><small>층</small></span><span className="vertical-live-score" role="status" aria-label={`점수 ${score}점`}><strong key={`score:${score}`} className={change?'score-earned':''}>{score.toLocaleString()}</strong><small>점</small>{change&&<i key={`change:${change.key}`} className="vertical-score-change" aria-hidden="true">+{change.amount}</i>}</span></div>;
}

// 열린 궤적과 큰 화살촉으로 돌아서기와 위로 오르기를 구분한다.
const TurnIcon=()=><svg className="stairs-key-icon" viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true"><path d="M9 2 2 9l7 7v-5h7v2h2v5h-7v4h9v-2h2V11h-2V9h-2V7H9z" fill="currentColor"/></svg>;
const ClimbIcon=()=><svg className="stairs-key-icon" viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true"><path d="m12 2 10 10h-7v10H9V12H2z" fill="currentColor"/></svg>;
const CoinIcon=()=><svg className="stairs-coin-icon" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true"><path className="coin-outline" d="M5 0h6v1h2v2h2v2h1v6h-1v2h-2v2h-2v1H5v-1H3v-2H1v-2H0V5h1V3h2V1h2z"/><path className="coin-shade" d="M5 2h6v1h2v2h1v6h-1v2h-2v1H5v-1H3v-2H2V5h1V3h2z"/><path className="coin-face" d="M5 2h5v1h2v2h1v5h-1v2h-2v1H5v-1H3v-2H2V5h1V3h2z"/><path className="coin-shine" d="M5 3h5v1H5zM3 5h1v4H3z"/><path className="coin-shade" d="M7 5h3v6H7z"/><path className="coin-shine" d="M7 5h1v5H7z"/></svg>;
const StreakFlame=({className}:{readonly className:string})=><svg className={className} viewBox="0 0 32 40" shapeRendering="crispEdges" aria-hidden="true"><path className="streak-flame-outline" d="M6 40v-4H2V24h4V14h4v8h2V10h4V0h4v12h4v10h4v-6h2v10h2v10h-4v4z"/><path className="streak-flame-face" d="M8 38v-4H4V24h4v-6h2v8h4V12h4V6h2v10h4v10h4v-4h2v12h-4v4z"/><path className="streak-flame-core" d="M14 38v-4h-4v-6h4v-8h4v8h4v6h-4v4z"/></svg>;
const STREAK_SPARKS=[[-.65,-.2],[.65,-.2],[-.35,-.7],[.35,-.7],[-.9,-.45],[.9,-.45],[-.15,-1],[.15,-1]] as const;

// 높이 구간: 하늘색(낮 → 노을 → 저녁 → 밤 → 우주)과 계단 재질(돌 → 나무 → 은 → 금 → 수정)이 50칸마다 바뀐다.
const ZONES=5,zoneOf=(height:number)=>Math.min(ZONES-1,Math.floor(height/50));
function StairsField({run,pet}:{readonly run:StairsRun;readonly pet:string|null}){
  const scene=useRef<HTMLDivElement>(null);
  const [range,setRange]=useState({below:5,above:STAIRS_AHEAD});
  useLayoutEffect(()=>{
    const element=scene.current;if(!element)return;
    const measure=()=>{
      const first=element.querySelector<HTMLElement>('.stair'),second=first?.nextElementSibling;
      if(!first||!(second instanceof HTMLElement)||!second.classList.contains('stair')||element.clientHeight===0)return;
      const stride=Math.abs(parseFloat(getComputedStyle(second).bottom)-parseFloat(getComputedStyle(first).bottom));
      if(!Number.isFinite(stride)||stride<=0)return;
      // 화면 크기가 바뀔 때는 새 좌표로 바로 맞춰 카메라 보간 중 경로 끝이 드러나지 않게 한다.
      for(const node of element.querySelectorAll('.stairs-world,.stairs-climber'))for(const animation of node.getAnimations())if('transitionProperty' in animation)animation.finish();
      const above=Math.ceil(element.clientHeight*(1-CAMERA_BASELINE)/stride)+OVERSCAN;
      const below=Math.ceil(element.clientHeight*CAMERA_BASELINE/stride)+OVERSCAN;
      setRange(previous=>previous.above===above&&previous.below===below?previous:{above,below});
    };
    measure();
    const observer=new ResizeObserver(measure);observer.observe(element);
    return()=>observer.disconnect();
  },[]);
  // 칸 i의 가로 위치: 0번 칸에서 steps를 차례로 더한 값.
  const path=stairsPreviewSteps(run,range.above);
  const xs=[0];for(let i=0;i<path.length;i++)xs.push(xs[i]!+path[i]!);
  const from=Math.max(0,run.height-range.below),to=Math.min(xs.length-1,run.height+range.above);
  const here=xs[run.height]!;
  // 가까운 경로를 함께 담되 펫이 화면 가장자리로 밀리지 않게 한다.
  const ahead=xs.slice(run.height,run.height+STAIRS_GATE+1);
  const center=(Math.min(...ahead)+Math.max(...ahead))/2;
  const camera=here+Math.max(-1.5,Math.min(1.5,center-here));
  const slipping=run.lastSlip!==null&&run.lastSlip===run.log.length-1;
  const opened=(i:number)=>i<run.height||i===run.height&&run.phase!=='solve';
  const milestone=run.height>0&&run.height%50===0;
  const streak=stairsStreak(run),tier=stairsStreakTier(streak);
  const streakActive=tier>0&&run.phase==='climb'&&!slipping;
  // 방향 실수: 화면을 흔들고 가장자리를 붉게 번쩍인다.
  useEffect(()=>{
    if(run.lastSlip===null||reducedMotion())return;
    scene.current?.animate([{transform:'none'},{transform:'translate(-8px,4px)'},{transform:'translate(8px,-4px)'},{transform:'translate(-6px,2px)'},{transform:'translate(4px,0)'},{transform:'none'}],{duration:320,easing:'steps(5,end)'});
  },[run.lastSlip]);
  return <div ref={scene} className={`stairs-scene zone-${zoneOf(run.height)} streak-tier-${tier}${streakActive?' streak-active':''}${run.ended==='fallen'?' fallen':''}`} style={{'--cy':run.height,'--stairs-base':CAMERA_BASELINE} as CSSProperties} aria-hidden="true">
    {Array.from({length:ZONES},(_,z)=><i key={z} className={`stairs-sky sky-${z}`}/>)}
    <i className="stairs-sun"/><i className="stairs-stars"/><i className="stairs-horizon"/><i className="stairs-far"/><i className="stairs-near"/>
    <div className="stairs-depth"><div className="stairs-world" style={{'--cx':camera} as CSSProperties}>
      {from===0&&<i className="stairs-ground"/>}
      {Array.from({length:to-from+1},(_,k)=>{
        const i=from+k,gate=isGate(i);
        return <i key={i} className={`stair tone-${zoneOf(i)}${i===run.height?' current-stair':''}${gate?' gate':''}${gate&&opened(i)?' opened':''}`} style={{'--x':xs[i],'--y':i} as CSSProperties}>
          {gate&&<b className="stairs-chest"><i className="chest-lid"/><i className="chest-box">{opened(i)?<Icon name="check" size={14}/>:<Icon name="lock" size={14}/>}</i></b>}
          {i>run.height&&stairsHasCoin(run.seed,i)&&<span className="stairs-coin"><CoinIcon/></span>}
          {i>0&&i%10===0&&<span className={`stairs-sign${(path[i]??1)>0?' on-left':''}`}>{i}F</span>}
        </i>;
      })}
      {run.phase==='climb'&&isGate(run.height)&&<span key={`open:${run.height}`} className="stairs-burst" style={{'--x':here,'--y':run.height} as CSSProperties}>{Array.from({length:8},(_,i)=><i key={i}/>)}</span>}
      <span key={`dust:${run.height}`} className="stairs-dust" style={{'--x':here,'--y':run.height} as CSSProperties}><i/><i/><i/></span>
      {streakActive&&<span key={`sparks:${run.height}`} className="stairs-streak-step" style={{'--x':here,'--y':run.height} as CSSProperties}>{STREAK_SPARKS.slice(0,2+tier*2).map(([dx,dy],i)=><i key={i} style={{'--dx':dx,'--dy':dy} as CSSProperties}/>)}</span>}
      {streakActive&&tier>=2&&Array.from({length:tier-1},(_,i)=>{
        const at=run.height-i-1;
        return <span key={`trail:${run.height}:${i}`} className={`stairs-streak-trail${path[at-1]===1?' right':''}`} style={{'--x':xs[at],'--y':at,'--trail-order':i} as CSSProperties}>{pet?<FriendSprite id={pet} fill/>:<img src="character.png" alt=""/>}</span>;
      })}
      {!slipping&&stairsHasCoin(run.seed,run.height)&&<span key={`coin:${run.height}`} className="stairs-coin-gain" style={{'--x':here,'--y':run.height} as CSSProperties}><CoinIcon/>+{STAIRS_COIN_POINTS}</span>}
      <span className={`stairs-climber${run.facing>0?' right':''}`} style={{'--x':here,'--y':run.height} as CSSProperties}>
        {streakActive&&tier>=2&&<StreakFlame className="stairs-streak-aura"/>}
        <i className="stairs-shadow"/>
        <span key={slipping?`slip:${run.lastSlip}`:`hop:${run.height}`} className={`stairs-body${slipping?' slip':run.height>0?' hop':''}`}>
          {pet?<FriendSprite id={pet} fill/>:<img src="character.png" alt=""/>}
          {slipping&&<i className="stairs-sweat"/>}
        </span>
      </span>
    </div></div>
    {tier>0&&run.phase!=='over'&&<div key={`streak:${Math.floor(streak/5)}`} className="stairs-streak">{tier>=2&&<StreakFlame className="stairs-streak-symbol"/>}<b>{streak}</b>연속!</div>}
    {slipping&&<i key={`flash:${run.lastSlip}`} className="stairs-flash"/>}
    {run.phase==='solve'&&<strong key={`gate:${run.history.length}`} className="stairs-banner gate-banner">문제 계단!</strong>}
    {run.phase==='climb'&&milestone&&<strong key={`floor:${run.height}`} className="stairs-banner floor-banner">{run.height}층 돌파!</strong>}
    {slipping&&<strong key={`lost:${run.lastSlip}`} className="stairs-lost">-1 <Icon name="heart" size={22}/></strong>}
    {!pet&&run.height===0&&<p className="stairs-pet-hint">펫을 고르면 내 펫이 계단을 올라요</p>}
  </div>;
}

export function StairsPlay({game,pet,onCue}:{readonly game:StairsGame;readonly pet:string|null;readonly onCue:(cue:Cue)=>void}){
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
    const streak=stairsStreak(next);
    if(next.slips>run.slips){if(next.phase!=='over')onCue('invalid');}
    else if(streak===10||streak===20)onCue('combo');
    else if(next.phase==='solve')onCue('unlock');
    else if((next.coins??0)>(run.coins??0))onCue('pickup');
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
      <StairsProgress run={run}/>
      <StairsField run={run} pet={pet}/>
      <div className="stairs-buttons" role="group" aria-label="계단 조작">
        <button className="stairs-turn" aria-label="방향전환" title="방향전환 (← 또는 Z)" disabled={!climbing} onClick={()=>move('turn')}><TurnIcon/><span>방향전환</span></button>
        <button className="stairs-climb" aria-label="오르기" title="오르기 (→ 또는 X)" disabled={!climbing} onClick={()=>move('climb')}><ClimbIcon/><span>오르기</span></button>
      </div>
    </section>
    <section className={`vertical-paper arcade-panel stairs-paper${mash!==null?' mashed':''}`} key={run.history.length} aria-label="세로셈">
      {solving&&run.problem&&fact?<VerticalBoard fact={fact} session={run.problem} steps={steps} current={current} onFocus={()=>document.querySelector<HTMLElement>('.stairs-play .vertical-cell[aria-current="step"]')?.focus({preventScroll:true})} wrong={wrong}/>
        :<div className="stairs-next"><Icon name="lock" size={40}/><strong>{left}칸</strong><span>더 오르면 문제 계단!</span></div>}
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
      <div className="block-result-stats"><div><span>오른 계단</span><strong>{run.height}</strong></div><div><span>푼 문제</span><strong>{run.solved}</strong></div></div>
      {sync.state!=='local'&&<button className="quiet-button vertical-hall-link" onClick={onHall}>명예의 전당<Icon name="arrow"/></button>}
      <div className="vertical-result-actions"><button className="quiet-button" aria-label="처음으로" onClick={onHome}><Icon name="back"/><span className="wide-only">처음으로</span></button><button className="primary-button" disabled={starting||sync.state==='starting'||sync.blocked} onClick={onAgain}>{starting||sync.state==='starting'?'불러오는 중':'다시 하기'}<Icon name="arrow"/></button></div>
      <StairsSyncNotice sync={sync}/>
    </section>
  </main>;
}
