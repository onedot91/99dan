import type { RushGame } from '../game/useRushGame';
import { modeLabel } from '../types/game';
import { NumberPad } from './NumberPad';
import { Icon } from './Icon';
export function PlayScreen({game:g}:{readonly game:RushGame}){
  const r=g.run;if(!r)return null;
  const seconds=Math.ceil(r.remaining/1000);
  const progress=r.mode==='rush'?r.remaining/(r.duration*60000):r.correct/r.limit;
  const combo=r.phase==='correct'&&r.combo>0&&r.combo%5===0;
  const answer=<strong className={`question-blank${r.entry?'':' answer-placeholder'}`} aria-label={`입력한 답 ${r.entry||'없음'}`}>{r.entry||'?'}</strong>;
  const a=r.fact.a,b=r.fact.b;
  return <main className={`play-screen ${r.phase}${combo?' combo-milestone':''}${r.phase==='wrong'&&r.penalty===0?' score-floor':''}${r.question.kind==='compare'?' comparison-play':''}`}>
    <div className="play-top">
      <span className="play-mode"><Icon name="flag"/>{modeLabel(r.mode,r.duration)}</span>
      {r.mode!=='rush'&&<span className="time"><Icon name="book"/>{Math.min(r.correct+Number(r.phase==='question'),r.limit)} / {r.limit}</span>}
      <div className="time-track" role="progressbar" aria-label={r.mode==='rush'?'남은 시간':'연습 진행'} aria-valuenow={r.mode==='rush'?seconds:r.correct} aria-valuemin={0} aria-valuemax={r.mode==='rush'?r.duration*60:r.limit}><span style={{transform:`scaleX(${progress})`}}/></div>
    </div>
    <section className="question-area arcade-panel" aria-label="현재 문제">
      <div className="question-content" key={r.answered+':'+r.phase}>
        {r.question.kind==='compare'?<>
          <h1 className="comparison-heading">두 식의 결과를 비교하세요</h1>
          <div className="comparison-layout">
            <div className="comparison-fact" aria-label={`왼쪽 식 ${a} 곱하기 ${b}`}>{a} × {b}</div>
            <div className="compare-pad" role="group" aria-label="두 식 사이에 들어갈 기호 선택">{(['<','=','>'] as const).map((key,index)=><button key={key} disabled={r.phase!=='question'} aria-label={key==='<'?'왼쪽이 작다':key==='='?'두 식이 같다':'왼쪽이 크다'} className={r.phase!=='question'&&r.entry===String(index+1)?'selected':''} onClick={()=>g.input(key)}>{key}</button>)}</div>
            <div className="comparison-fact" aria-label={`오른쪽 식 ${r.question.other?.a} 곱하기 ${r.question.other?.b}`}>{r.question.other?.a} × {r.question.other?.b}</div>
          </div>
        </>
          :<h1 className="equation" aria-label={r.question.kind==='product'?`${a} 곱하기 ${b}`:`${a} 곱하기 ${b}, 빈칸 채우기`}>{r.question.kind==='missing-a'?answer:a}<span>×</span>{r.question.kind==='missing-b'?answer:b}<span>=</span>{r.question.kind==='product'?answer:a*b}</h1>}
      </div>
      <div className="answer-feedback" role="status" aria-live="polite">{r.phase==='question'?'':r.feedback}</div>
      {r.phase==='correct'&&<div className="pixel-sparks" key={r.answered} aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/></div>}
    </section>
    {r.question.kind!=='compare'&&<div className="keypad-area"><NumberPad onInput={g.input} disabled={r.phase!=='question'} canSubmit={r.entry.length>0}/></div>}
  </main>;
}
