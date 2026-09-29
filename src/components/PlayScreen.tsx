import { useRef } from 'react';
import type { RushGame } from '../game/useRushGame';
import type { Run } from '../types/game';
import { NumberPad } from './NumberPad';
import { Icon } from './Icon';
import { FLAME, Sprite } from './Sprite';
import { FriendSprite } from './FriendSprite';
const MAX_BONUS_STEPS=5;
const tierOf=(combo:number)=>combo>=10?'blaze':combo>=5?'hot':'';
// Lives in the header during play, next to the score and timer.
export function ComboMeter({run:r}:{readonly run:Run}){
  // Pips mirror the real scoring: the next correct answer earns +10 per pip.
  const bonusSteps=Math.min(r.combo,MAX_BONUS_STEPS);
  const tier=tierOf(r.combo);
  const justFilled=r.phase==='correct'&&r.combo<=MAX_BONUS_STEPS?bonusSteps-1:-1;
  return <div className={`combo-meter ${tier}`} aria-label={`연속 정답 ${r.combo}개, 다음 보너스 ${bonusSteps*10}점`}>
    {tier&&<Sprite map={FLAME} className="combo-flame"/>}
    <span className="combo-count"><small>콤보</small></span>
    <span className="combo-pips" aria-hidden="true">{Array.from({length:MAX_BONUS_STEPS},(_,i)=><i key={i} className={`${i<bonusSteps?'on':''}${i===justFilled?' just':''}`}/>)}</span>
  </div>;
}
export function PlayScreen({game:g,partner,best}:{readonly game:RushGame;readonly partner:string|null;readonly best:number|null}){
  // Where on the bar this run passed the previous best, fixed once it happens.
  const flag=useRef<{readonly runId:string;readonly at:number}|null>(null);
  const r=g.run;if(!r)return null;
  const seconds=Math.ceil(r.remaining/1000);
  const progress=Math.min(1,Math.max(0,r.mode==='rush'?r.remaining/(r.duration*60000):r.correct/r.limit));
  const combo=r.phase==='correct'&&r.combo>0&&r.combo%5===0;
  const tier=tierOf(r.combo);
  if(r.mode==='rush'&&best!==null&&best>0&&r.score>best&&flag.current?.runId!==r.id)flag.current={runId:r.id,at:progress};
  const flagAt=flag.current?.runId===r.id?flag.current.at:null;
  // The pet cheers each answer from the edge of the screen, never over the question.
  const reaction=r.phase==='correct'?combo?'combo':'hop':r.phase==='wrong'?'wobble':'';
  // Hit effects burst from the answer itself: shockwave rings plus sparks that arc and fall.
  const hitFx=r.phase==='correct'?<span className="hit-fx" key={`fx:${r.answered}`} aria-hidden="true"><i className="shock"/><i className="shock late"/>{Array.from({length:12},(_,i)=><b key={i}/>)}</span>:null;
  // Each typed digit is its own node so it can pop in as it lands.
  const answer=<strong className={`question-blank${r.entry?'':' answer-placeholder'}`} aria-label={`입력한 답 ${r.entry||'없음'}`}>{r.entry?[...r.entry].map((d,i)=><span key={`${i}:${d}`} className="digit">{d}</span>):'?'}{hitFx}</strong>;
  const a=r.fact.a,b=r.fact.b;
  return <main className={`play-screen ${r.phase}${tier?` tier-${tier}`:''}${combo?' combo-milestone':''}${r.phase==='wrong'&&r.penalty===0?' score-floor':''}${r.question.kind==='compare'?' comparison-play':''}`}>
    <div className="play-top">
      {r.mode!=='rush'&&<span className="time"><Icon name="book"/>{Math.min(r.correct+Number(r.phase==='question'),r.limit)} / {r.limit}</span>}
      <div className="time-track" role="progressbar" aria-label={r.mode==='rush'?'남은 시간':'연습 진행'} aria-valuenow={r.mode==='rush'?seconds:r.correct} aria-valuemin={0} aria-valuemax={r.mode==='rush'?r.duration*60:r.limit}><span style={{transform:`scaleX(${progress})`}}/></div>
      {/* The partner pet rides the edge of the bar: walking left as time runs out, right as practice fills up. */}
      {(partner||flagAt!==null)&&<div className="time-runner" aria-hidden="true">
        {flagAt!==null&&<span className="best-flag" style={{left:`${flagAt*100}%`}}><Icon name="flag"/><em>최고 기록 돌파!</em></span>}
        {partner&&<div className={`time-pet${r.mode==='rush'?' leftward':''}`} style={{transform:`translateX(${progress*100}%)`}}>
          <span className={`pet-react${reaction?` react-${reaction}`:''}`} key={`${r.answered}:${reaction}`}><FriendSprite id={partner} fill/>{reaction==='combo'&&Array.from({length:6},(_,i)=><i key={i}/>)}</span>
        </div>}
      </div>}
    </div>
    <section className="question-area arcade-panel" aria-label="현재 문제">
      <div className="question-content" key={r.answered+':'+r.phase}>
        {r.question.kind==='compare'?<>
          <h1 className="comparison-heading">알맞은 기호는?</h1>
          <div className="comparison-layout">
            <div className="comparison-fact left" aria-label={`왼쪽 식 ${a} 곱하기 ${b}`}>{a} × {b}</div>
            {/* On phones the pad moves below, so the sign gets its own blank between the two facts. */}
            <strong className={`compare-slot${r.entry?'':' answer-placeholder'}`} aria-hidden="true">{(['<','=','>'] as const)[Number(r.entry)-1]??'?'}</strong>
            <div className="compare-pad" role="group" aria-label="두 식 사이에 들어갈 기호 선택">{(['<','=','>'] as const).map((key,index)=><button key={key} disabled={r.phase!=='question'} aria-label={key==='<'?'왼쪽이 작다':key==='='?'두 식이 같다':'왼쪽이 크다'} className={r.phase!=='question'&&r.entry===String(index+1)?'selected':''} onClick={()=>g.input(key)}>{key}{r.entry===String(index+1)&&hitFx}</button>)}</div>
            <div className="comparison-fact right" aria-label={`오른쪽 식 ${r.question.other?.a} 곱하기 ${r.question.other?.b}`}>{r.question.other?.a} × {r.question.other?.b}</div>
          </div>
        </>
          :<h1 className="equation" aria-label={r.question.kind==='product'?`${a} 곱하기 ${b}`:`${a} 곱하기 ${b}, 빈칸 채우기`}>{r.question.kind==='missing-a'?answer:a}<span>×</span>{r.question.kind==='missing-b'?answer:b}<span>=</span>{r.question.kind==='product'?answer:a*b}</h1>}
      </div>
      <div className="answer-feedback" role="status" aria-live="polite" key={`feedback:${r.answered}`}>{r.phase==='question'?'':r.feedback}</div>
      {combo&&<div className="combo-banner" key={`banner:${r.answered}`} aria-hidden="true"><strong>{r.combo}</strong> 콤보!</div>}
    </section>
    {r.question.kind!=='compare'&&<div className="keypad-area"><NumberPad onInput={g.input} disabled={r.phase!=='question'} canSubmit={r.entry.length>0}/></div>}
  </main>;
}
