import type { RushGame } from '../game/useRushGame';
import { modeLabel } from '../types/game';
import { NumberPad } from './NumberPad';
import { Icon } from './Icon';
export function PlayScreen({game:g}:{readonly game:RushGame}){
  const r=g.run;if(!r)return null;
  const seconds=Math.ceil(r.remaining/1000);
  const timer=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  const progress=r.mode==='rush'?r.remaining/(r.duration*60000):r.correct/r.limit;
  const combo=r.phase==='correct'&&r.combo>0&&r.combo%5===0;
  return <main className={`play-screen ${r.phase}${combo?' combo-milestone':''}`}>
    <div className="play-top">
      <span className="play-mode"><Icon name="flag"/>{modeLabel(r.mode,r.duration)}</span>
      <span className={r.mode==='rush'&&seconds<=10?'time low-time':'time'}><Icon name={r.mode==='rush'?'clock':'book'}/>{r.mode==='rush'?timer:`${Math.min(r.correct+Number(r.phase==='question'),r.limit)} / ${r.limit}`}</span>
      <div className="time-track" role="progressbar" aria-label={r.mode==='rush'?'남은 시간':'연습 진행'} aria-valuenow={r.mode==='rush'?seconds:r.correct} aria-valuemin={0} aria-valuemax={r.mode==='rush'?r.duration*60:r.limit}><span style={{transform:`scaleX(${progress})`}}/></div>
    </div>
    <section className="question-area arcade-panel" aria-label="현재 문제">
      <div className="question-content" key={r.answered+':'+r.phase}>
        <h1 className="equation" aria-label={`${r.fact.a} 곱하기 ${r.fact.b}`}>{r.fact.a}<span>×</span>{r.fact.b}</h1>
        <div className="answer-display" aria-label={`입력한 답 ${r.entry||'없음'}`}><span className="equals">=</span><strong>{r.entry||'?'}</strong>{r.phase!=='question'&&<Icon name={r.phase==='correct'?'check':'close'} size={24}/>}</div>
      </div>
      <div className="answer-feedback" role="status" aria-live="polite">{r.phase==='question'?'':r.feedback}</div>
      {r.phase==='correct'&&<div className="pixel-sparks" key={r.answered} aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/></div>}
    </section>
    <div className="keypad-area"><NumberPad onInput={g.input} disabled={r.phase!=='question'} canSubmit={r.entry.length>0}/></div>
    <div className="play-bottom"><span>점수 <strong>{r.score.toLocaleString()}</strong></span><span><Icon name="star"/>{r.correct}개 정답</span></div>
  </main>;
}
