// 개발 서버 전용(?review=division): 블록 세로셈의 빈칸 순서를 문항별로 직접 풀어 보며 검토한다. 배포 빌드에는 들어가지 않는다.
import { useEffect, useState } from 'react';
import { createDivisionProblem, divisionLessonOf, divisionSolved, divisionSteps, reduceDivision } from '../game/division';
import type { DivisionFact, DivisionLesson, DivisionStep } from '../game/division';
import { DivisionBoard } from '../components/BlockScreen';
import { NumberPad } from '../components/NumberPad';
import '../styles.css';
import '../dark.css';
import '../screens.css';
import '../vertical.css';
import '../block.css';

const fact=(dividend:number,divisor:number,lesson?:DivisionLesson):DivisionFact=>({dividend,divisor,lesson:lesson??divisionLessonOf(dividend,divisor)!.lesson});
const SAMPLES:readonly {readonly fact:DivisionFact;readonly note:string}[]=[
  {fact:fact(844,8),note:'몫 중간 0'},
  {fact:fact(612,3),note:'몫 중간 0'},
  {fact:fact(840,4),note:'몫 끝 0'},
  {fact:fact(220,2),note:'몫 끝 0'},
  {fact:fact(100,2),note:'몫 끝 0'},
  {fact:fact(252,6),note:'두 자리 곱'},
  {fact:fact(536,4),note:'세 자리'},
  {fact:fact(75,3),note:'두 자리 곱'},
  {fact:fact(70,5),note:'몇십÷몇'},
  {fact:fact(42,2),note:'참고 그림'},
  {fact:fact(61,3),note:'나머지=내림'},
  {fact:fact(25,3),note:'몫 한 자리'},
  {fact:fact(55,4,8),note:'검산'},
  {fact:fact(60,3),note:'몫만'},
];
const ROW:Record<DivisionStep['row'],string>={quotient:'몫',product:'곱',rest:'차','check-product':'검산 곱','check-sum':'검산 합'};
const label=(s:DivisionStep)=>s.bringDown?'내림':ROW[s.row];

export function DivisionReview(){
  const [index,setIndex]=useState(0);
  const sample=SAMPLES[index]!;
  const [problem,setProblem]=useState(()=>createDivisionProblem(sample.fact));
  const [wrong,setWrong]=useState(false);
  useEffect(()=>{setProblem(createDivisionProblem(sample.fact));setWrong(false);},[index]);
  const steps=divisionSteps(problem.fact),step=steps[problem.stepIndex];
  const input=(key:string)=>{
    if(key==='Enter'&&problem.entry&&step)setWrong(Number(problem.entry)!==step.expected);
    setProblem(p=>reduceDivision(p,{type:'input',key}));
  };
  const fill=()=>{if(!step)return;setWrong(false);setProblem(p=>{let next=p;for(const key of String(step.expected))next=reduceDivision(next,{type:'input',key});return reduceDivision(next,{type:'input',key:'Enter'});});};
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if(/^\d$/.test(event.key)||['Enter','Backspace','Delete'].includes(event.key)){event.preventDefault();input(event.key);}};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  });
  return <div className="app vertical-app review-app" data-bg="night">
    <style>{`
      .review-app{min-height:100dvh;padding:var(--s4);display:grid;gap:var(--s4);grid-template-rows:auto 1fr;color:var(--paper-hi)}
      .review-list{display:flex;flex-wrap:wrap;gap:var(--s2)}
      .review-list button{padding:var(--s2) var(--s3);font:inherit;font-family:var(--mono);background:var(--panel);color:inherit;border:0;box-shadow:var(--ring);cursor:pointer}
      .review-list button[aria-pressed=true]{background:var(--yellow);color:var(--ink)}
      .review-list small{display:block;font-size:12px;opacity:.75}
      .review-main{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) minmax(0,.9fr);gap:var(--s4);align-items:start}
      .review-main .division-paper{height:min(70dvh,560px)}
      .review-steps{margin:0;padding:var(--s3) var(--s3) var(--s3) var(--s8);background:var(--panel);box-shadow:var(--ring);font-family:var(--mono);line-height:1.9}
      .review-steps li.done{opacity:.55}.review-steps li.now{color:var(--yellow)}
      .review-tools{display:flex;gap:var(--s2);margin-top:var(--s3)}
      .review-tools button{flex:1;padding:var(--s3);font:inherit;background:var(--panel);color:inherit;border:0;box-shadow:var(--ring);cursor:pointer}
      @media(max-width:800px){.review-main{grid-template-columns:1fr}}
    `}</style>
    <nav className="review-list" aria-label="검토 문항">{SAMPLES.map((s,i)=><button key={i} aria-pressed={i===index} onClick={()=>setIndex(i)}>{s.fact.dividend}÷{s.fact.divisor}<small>{s.note}</small></button>)}</nav>
    <div className="review-main">
      <section className="division-paper vertical-paper arcade-panel" key={index} aria-label="나눗셈"><DivisionBoard problem={problem} wrong={wrong}/></section>
      <section aria-label="입력 순서">
        <ol className="review-steps">{steps.map((s,i)=><li key={s.id} className={i<problem.stepIndex?'done':i===problem.stepIndex?'now':''}>{label(s)} {s.expected}</li>)}</ol>
        {divisionSolved(problem)&&<p>완료</p>}
      </section>
      <section className="vertical-controls" aria-label="숫자 입력">
        <div className="vertical-pad"><div className="vertical-pad-keys"><NumberPad onInput={input} disabled={divisionSolved(problem)} canSubmit={problem.entry.length>0}/></div></div>
        <div className="review-tools"><button onClick={fill} disabled={!step}>정답 넣기</button><button onClick={()=>{setProblem(createDivisionProblem(sample.fact));setWrong(false);}}>처음부터</button></div>
      </section>
    </div>
  </div>;
}
