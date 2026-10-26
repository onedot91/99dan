import { validVerticalCount, verticalCounts, verticalSet } from './verticalSets.ts';
import type { VerticalCount } from './verticalSets.ts';
import { VERTICAL_CORRECT_POINTS, VERTICAL_WRONG_PENALTY, WRONG_PENALTY } from './points.ts';
export type Difficulty=1|2|3;
export type VerticalFact={readonly a:number;readonly b:number;readonly holes?:readonly string[];readonly directZero?:true};
export type VerticalStart={readonly id:string;readonly difficulty:Difficulty;readonly questions:readonly VerticalFact[];readonly timeScoring?:boolean;readonly manualZero?:boolean;readonly tightTime?:boolean;readonly cellScoring?:boolean};
export type Stage='ones'|'tens'|'sum';
export type DigitRow='ones'|'tens'|'sum'|'carry-ones'|'carry-tens'|'carry-sum'|'operand-a'|'operand-b';
export type VerticalStep={readonly id:string;readonly stage:Stage;readonly row:DigitRow;readonly place:number;readonly expected:number;readonly instruction:string;readonly calculation:string;readonly aPlace:number|null;readonly bPlace:number|null};
export const STAGE_LABELS={ones:'일의 자리 곱하기',tens:'십의 자리 곱하기',sum:'두 줄 더하기'} as const;
export const PLACES=['일','십','백','천'] as const;
export const digitAt=(value:number,place:number)=>Math.floor(value/10**place)%10;
const widthOf=(value:number)=>String(value).length;
const cellId=(row:DigitRow,place:number)=>`${row}:${place}`;

export function verticalSteps({a,b,directZero}:VerticalFact,manualZero=false):readonly VerticalStep[]{
  if(directZero)return verticalSteps({a,b},true).filter(step=>step.stage==='tens').map(step=>step.row==='tens'?{...step,id:cellId('sum',step.place),row:'sum' as const}:step);
  const steps:VerticalStep[]=[];
  const add=(step:Omit<VerticalStep,'id'>)=>steps.push({...step,id:cellId(step.row,step.place)});
  for(const shift of [0,1] as const){
    const stage=shift===0?'ones':'tens';
    const multiplier=digitAt(b,shift);
    const unit=digitAt(a,0)*multiplier;
    const carry=Math.floor(unit/10);
    const placeName=shift===0?'일':'십';
    if(shift===1&&manualZero)add({stage,row:stage,place:0,expected:0,instruction:'십의 자리 곱셈은 일의 자리에 0을 써요',calculation:'일의 자리에 0',aPlace:null,bPlace:null});
    if(multiplier===0){add({stage,row:stage,place:shift,expected:0,instruction:'0을 곱하면 0이에요',calculation:`${a} × 0`,aPlace:null,bPlace:shift});continue;}
    add({stage,row:stage,place:shift,expected:unit%10,instruction:shift===0?'일의 자리부터 곱해요':`${multiplier}은 ${multiplier*10}! 한 칸 왼쪽에 써요`,calculation:`${digitAt(a,0)} × ${multiplier}`,aPlace:0,bPlace:shift});
    if(carry)add({stage,row:`carry-${stage}`,place:shift+1,expected:carry,instruction:`${PLACES[shift+1]}의 자리 위에 올림을 적어요`,calculation:`${digitAt(a,0)} × ${multiplier} = ${unit}`,aPlace:0,bPlace:shift});
    const tens=digitAt(a,1)*multiplier+carry;
    const calculation=`${digitAt(a,1)} × ${multiplier}${carry?` + ${carry}`:''}`;
    add({stage,row:stage,place:shift+1,expected:tens%10,instruction:carry?'곱한 값에 올림도 더해요':`${placeName}의 자리와 계속 곱해요`,calculation,aPlace:1,bPlace:shift});
    if(tens>=10)add({stage,row:stage,place:shift+2,expected:Math.floor(tens/10),instruction:'남은 숫자를 왼쪽 칸에 써요',calculation:`${calculation} = ${tens}`,aPlace:1,bPlace:shift});
  }
  const first=a*digitAt(b,0),second=a*digitAt(b,1)*10;
  const width=widthOf(a*b);
  let carry=0;
  for(let place=0;place<width;place++){
    const x=digitAt(first,place),y=digitAt(second,place);
    const total=x+y+carry;
    const calculation=`${x} + ${y}${carry?` + ${carry}`:''}`;
    add({stage:'sum',row:'sum',place,expected:total%10,instruction:carry?`${PLACES[place]}의 자리, 올림도 더해요`:`${PLACES[place]}의 자리끼리 더해요`,calculation,aPlace:null,bPlace:null});
    carry=Math.floor(total/10);
    if(carry&&place<width-1)add({stage:'sum',row:'carry-sum',place:place+1,expected:carry,instruction:`${PLACES[place+1]}의 자리 위에 올림을 적어요`,calculation:`${calculation} = ${total}`,aPlace:null,bPlace:null});
  }
  return steps;
}

export function difficultyOf(fact:VerticalFact):Difficulty{
  const steps=verticalSteps({a:fact.a,b:fact.b});
  if(steps.some(s=>s.row==='carry-sum'))return 3;
  return steps.some(s=>s.row==='carry-ones'||s.row==='carry-tens')?2:1;
}

export function verticalPuzzleSteps(fact:VerticalFact):readonly VerticalStep[]{
  const operands:VerticalStep[]=(['operand-a','operand-b'] as const).flatMap(row=>[0,1].map(place=>({id:cellId(row,place),stage:'ones' as const,row,place,expected:digitAt(row==='operand-a'?fact.a:fact.b,place),instruction:'빈칸을 골라 숫자를 채워요',calculation:'',aPlace:null,bPlace:null})));
  return [...verticalSteps(fact,true),...operands];
}
export function verticalQuestionSteps(fact:VerticalFact,manualZero=false):readonly VerticalStep[]{
  const steps=fact.holes?verticalPuzzleSteps(fact):verticalSteps(fact,manualZero);
  return fact.holes?fact.holes.map(id=>steps.find(step=>step.id===id)).filter((step):step is VerticalStep=>!!step).map(step=>({...step,instruction:'빈칸을 골라 숫자를 채워요',calculation:'',aPlace:null,bPlace:null})):steps;
}
export function verticalSolved(session:VerticalSession):ReadonlySet<number>{
  const fact=session.questions[session.index];
  const steps=fact?verticalQuestionSteps(fact,session.manualZero):[];
  return new Set(session.events.filter(event=>event.question===session.index&&event.answer===steps[event.step]?.expected).map(event=>event.step));
}
export function withVerticalPuzzles(questions:readonly VerticalFact[],difficulty:Difficulty,random:()=>number=Math.random,operands=false,directZero=false):readonly VerticalFact[]{
  if(questions.length!==10||difficulty===1)return questions;
  const remaining=questions.flatMap((fact,index)=>directZero&&fact.b%10===0?[]:[index]),selected=new Set<number>();
  const take=<T,>(items:readonly T[]):T=>items[Math.floor(Math.min(1-Number.EPSILON,Math.max(0,random()))*items.length)]!;
  for(let i=0;i<(difficulty===2?3:5);i++){const index=take(remaining);selected.add(index);remaining.splice(remaining.indexOf(index),1);}
  const patterns=operands?[0,1,2,3]:[0];
  if(operands)for(let i=patterns.length-1;i>0;i--){const j=Math.floor(Math.min(1-Number.EPSILON,Math.max(0,random()))*(i+1));[patterns[i],patterns[j]]=[patterns[j]!,patterns[i]!];}
  let puzzleIndex=0;
  return questions.map((fact,index)=>{
    if(!selected.has(index))return fact;
    const steps=verticalPuzzleSteps(fact),pattern=patterns[puzzleIndex++%patterns.length];
    const rows=pattern===1?['operand-a','ones']:pattern===2?['operand-b','tens']:pattern===3?['operand-b','ones']:['ones','tens'];
    const holes=[...rows,...(difficulty===3?['sum']:[])].map(row=>take(steps.filter(step=>step.row===row&&step.id!=='tens:0'&&(row!=='operand-b'||step.place===(pattern===2?0:1)))).id);
    return {...fact,holes};
  });
}
export function withDirectZeroQuestions(questions:readonly VerticalFact[]):readonly VerticalFact[]{
  return questions.map(fact=>fact.b%10===0&&!fact.holes?{...fact,directZero:true}:fact);
}

const pools=new Map<Difficulty,readonly VerticalFact[]>();
export function questionPool(difficulty:Difficulty):readonly VerticalFact[]{
  const previous=pools.get(difficulty);if(previous)return previous;
  const pool:VerticalFact[]=[];
  for(let a=10;a<=99;a++)for(let b=10;b<=99;b++)if(difficultyOf({a,b})===difficulty)pool.push({a,b});
  const complexity=(fact:VerticalFact)=>verticalSteps(fact).filter(s=>s.row.startsWith('carry')).length*10+Number(fact.a%10===0||fact.b%10===0)*2+Number(fact.a*fact.b>=1000);
  pool.sort((a,b)=>complexity(a)-complexity(b));pools.set(difficulty,pool);return pool;
}

export function chooseVerticalQuestions(difficulty:Difficulty,random:()=>number=Math.random):readonly VerticalFact[]{
  const pool=questionPool(difficulty);
  return Array.from({length:5},(_,index)=>{
    const start=Math.floor(pool.length*index/5),end=Math.floor(pool.length*(index+1)/5);
    const sample=Math.min(1-Number.EPSILON,Math.max(0,random()));
    const fact=pool[start+Math.floor(sample*(end-start))];
    if(!fact)throw new Error('Vertical question pool is empty');
    return fact;
  });
}

export type VerticalAnswer={readonly question:number;readonly step:number;readonly answer:number;readonly ms?:number};
export type VerticalSession={readonly version:1|2|3|4;readonly id:string|null;readonly events:readonly VerticalAnswer[];readonly difficulty:Difficulty;readonly questions:readonly VerticalFact[];readonly index:number;readonly stepIndex:number;readonly entry:string;readonly mistakes:readonly number[];readonly completed:boolean;readonly timeScoring?:true;readonly manualZero?:true;readonly tightTime?:true;readonly cellScoring?:true};
export function verticalCellPoints(cells:number,step:number,ms:number):number{
  const base=Math.floor((step+1)*VERTICAL_CORRECT_POINTS/cells)-Math.floor(step*VERTICAL_CORRECT_POINTS/cells);
  const seconds=Math.min(20,Math.max(2,Math.ceil(ms/1000)));
  return Math.max(1,Math.floor(base*(100-(seconds-2)*5)/100));
}
export function verticalTimePenalty(session:VerticalSession):number{
  if(!session.timeScoring)return 0;
  const steps=session.questions.map(fact=>verticalQuestionSteps(fact,session.manualZero)),times=session.questions.map(()=>0);
  if(session.cellScoring)return session.events.reduce((total,event)=>{
    const question=steps[event.question];
    if(!question||event.answer!==question[event.step]?.expected)return total;
    const base=Math.floor((event.step+1)*VERTICAL_CORRECT_POINTS/question.length)-Math.floor(event.step*VERTICAL_CORRECT_POINTS/question.length);
    return total+base-verticalCellPoints(question.length,event.step,event.ms??0);
  },0);
  for(const event of session.events){
    if(event.answer===steps[event.question]?.[event.step]?.expected)times[event.question]=(times[event.question]??0)+(session.tightTime?Math.min(Math.max((event.ms??0)-2000,0),18000):Math.min(event.ms??0,20000));
  }
  return times.reduce((total,ms,index)=>total+Math.floor(session.tightTime?ms*60/(18000*(steps[index]?.length??1)):ms/(5000*(steps[index]?.length??1))),0);
}
export function verticalScore(session:VerticalSession):number{
  if(session.cellScoring){
    const steps=session.questions.map(fact=>verticalQuestionSteps(fact,session.manualZero));
    const earned=session.events.reduce((sum,event)=>event.answer===steps[event.question]?.[event.step]?.expected?sum+verticalCellPoints(steps[event.question]!.length,event.step,event.ms??0):sum,0);
    return Math.max(0,earned-session.mistakes.reduce((sum,n)=>sum+n,0)*VERTICAL_WRONG_PENALTY);
  }
  const fact=session.questions[session.index];
  const cells=fact?verticalQuestionSteps(fact,session.manualZero).length:0;
  const points=VERTICAL_CORRECT_POINTS;
  const partial=cells?Math.floor((fact?.holes?verticalSolved(session).size:session.stepIndex)*points/cells):0;
  return Math.max(0,session.index*points+partial-session.mistakes.reduce((sum,n)=>sum+n,0)*WRONG_PENALTY-verticalTimePenalty(session));
}
export type VerticalAction={readonly type:'input';readonly key:string;readonly ms?:number}|{readonly type:'next'}|{readonly type:'select';readonly step:number};
export function chooseMixedVerticalQuestions(difficulty:Difficulty,random:()=>number=Math.random,questionCount:VerticalCount=5):readonly VerticalFact[]{
  const sample=()=>Math.min(1-Number.EPSILON,Math.max(0,random()));
  const counts=verticalCounts(difficulty,questionCount),zeroKinds=[0,1].filter(index=>counts[index]!>0);
  const zeroKind=sample()<.25?zeroKinds[Math.floor(sample()*zeroKinds.length)]:undefined;
  const questions=counts.flatMap((count,index)=>{
    const pool=questionPool(index+1 as Difficulty).filter(fact=>fact.b%10!==0);
    return Array.from({length:count},(_,position)=>{
      if(index===zeroKind&&position===0){const zeros=questionPool(index+1 as Difficulty).filter(fact=>fact.b%10===0);return {...zeros[Math.floor(sample()*zeros.length)]!};}
      const [fact]=pool.splice(Math.floor(sample()*pool.length),1);
      if(!fact)throw new Error('Vertical question pool is empty');
      return {...fact};
    });
  });
  for(let i=questions.length-1;i>0;i--){const j=Math.floor(sample()*(i+1));[questions[i],questions[j]]=[questions[j]!,questions[i]!];}
  return questions;
}
export function parseVerticalQuestions(value:unknown,difficulty:Difficulty,count:VerticalCount=5,puzzles=false,operands=false,directZero=false):readonly VerticalFact[]|null{
  if(!Array.isArray(value)||value.length!==count)return null;
  const facts:VerticalFact[]=[];
  for(const item of value){
    if(!item||typeof item!=='object')return null;
    const f=item as Record<string,unknown>;
    if(typeof f.a!=='number'||typeof f.b!=='number'||!Number.isInteger(f.a)||!Number.isInteger(f.b)||f.a<10||f.a>99||f.b<10||f.b>99)return null;
    if(f.directZero!==undefined&&(!directZero||f.directZero!==true||f.b%10!==0||f.holes!==undefined))return null;
    if(directZero&&f.b%10===0&&f.directZero!==true)return null;
    const fact:VerticalFact={a:f.a,b:f.b,...(f.directZero===true?{directZero:true}:{})};
    if(f.holes!==undefined){
      const first=Array.isArray(f.holes)?f.holes[0]:undefined;
      const firstRows=operands&&typeof first==='string'&&first.startsWith('operand-a:')?['operand-a','ones']:operands&&first==='operand-b:0'?['operand-b','tens']:operands&&first==='operand-b:1'?['operand-b','ones']:['ones','tens'];
      const rows=[...firstRows,...(difficulty===3?['sum']:[])];
      const steps=operands?verticalPuzzleSteps(fact):verticalSteps(fact,true);
      if(!puzzles||count!==10||difficulty===1||!Array.isArray(f.holes)||f.holes.length!==rows.length||f.holes.some((id,index)=>typeof id!=='string'||id==='tens:0'||!steps.some(step=>step.id===id&&step.row===rows[index])))return null;
      facts.push({...fact,holes:f.holes as string[]});
    }else facts.push(fact);
  }
  if(new Set(facts.map(f=>`${f.a}:${f.b}`)).size!==count)return null;
  const counts=verticalCounts(difficulty,count);
  const puzzleCount=puzzles&&count===10&&difficulty>1?difficulty===2?3:5:0;
  return facts.filter(fact=>fact.holes).length===puzzleCount&&counts.every((count,index)=>facts.filter(f=>difficultyOf(f)===index+1).length===count)?facts:null;
}
export function createVerticalSession(difficulty:Difficulty,id:string=crypto.randomUUID(),questions:readonly VerticalFact[]=chooseMixedVerticalQuestions(difficulty),timeScoring=false,manualZero=false,tightTime=false,cellScoring=false):VerticalSession{
  if(!validVerticalCount(questions.length))throw new Error('INVALID_VERTICAL_COUNT');
  return {version:4,id,events:[],difficulty,questions:questions.map(fact=>({...fact,...(fact.holes?{holes:[...fact.holes]}:{})})),index:0,stepIndex:0,entry:'',mistakes:questions.map(()=>0),completed:false,...(timeScoring?{timeScoring:true as const}:{}),...(manualZero?{manualZero:true as const}:{}),...(timeScoring&&tightTime?{tightTime:true as const}:{}),...(timeScoring&&tightTime&&cellScoring?{cellScoring:true as const}:{})};
}
export function reduceVertical(session:VerticalSession,action:VerticalAction):VerticalSession{
  if(session.completed)return session;
  const fact=session.questions[session.index];if(!fact)return session;
  const steps=verticalQuestionSteps(fact,session.manualZero),step=steps[session.stepIndex];
  if(action.type==='select')return fact.holes&&step&&Number.isInteger(action.step)&&action.step>=0&&action.step<steps.length&&!verticalSolved(session).has(action.step)?{...session,stepIndex:action.step,entry:''}:session;
  if(action.type==='next'){
    if(step)return session;
    return session.index===session.questions.length-1?{...session,completed:true}:{...session,index:session.index+1,stepIndex:0,entry:''};
  }
  if(!step)return session;
  if(action.key==='Enter'){
    if(!session.entry)return session;
    const previous=fact.holes?session.events.filter(event=>event.question===session.index&&event.step===session.stepIndex).at(-1):session.events.at(-1);
    const previousMs=previous?.question===session.index&&previous.step===session.stepIndex?previous.ms??0:0;
    const ms=Math.max(previousMs,Math.min(1000000000,Math.max(0,Math.floor(action.ms??0))));
    const events=session.version>=3?[...session.events,{question:session.index,step:session.stepIndex,answer:Number(session.entry),...(session.timeScoring?{ms}:{})}]:session.events;
    if(Number(session.entry)===step.expected){
      const solved=fact.holes?new Set([...verticalSolved(session),session.stepIndex]):null;
      const next=solved?steps.findIndex((_,index)=>!solved.has(index)):session.stepIndex+1;
      return {...session,events,stepIndex:next<0?steps.length:next,entry:''};
    }
    return {...session,events,mistakes:session.mistakes.map((value,i)=>i===session.index?value+1:value),entry:''};
  }
  if(action.key==='Backspace'||action.key==='Delete')return {...session,entry:''};
  if(/^\d$/.test(action.key))return {...session,entry:action.key};
  return session;
}

export function parseVerticalSession(value:unknown):VerticalSession|null{
  if(!value||typeof value!=='object')return null;
  const v=value as Record<string,unknown>;
  if((v.version!==1&&v.version!==2&&v.version!==3&&v.version!==4)||![1,2,3].includes(Number(v.difficulty))||typeof v.difficulty!=='number')return null;
  if(v.timeScoring!==undefined&&(v.version!==4||v.timeScoring!==true))return null;
  if(v.tightTime!==undefined&&(v.version!==4||v.tightTime!==true||v.timeScoring!==true))return null;
  if(v.cellScoring!==undefined&&(v.version!==4||v.cellScoring!==true||v.timeScoring!==true||v.tightTime!==true))return null;
  if(v.manualZero!==undefined&&(v.version!==4||v.manualZero!==true))return null;
  if(!Array.isArray(v.questions)||!validVerticalCount(v.questions.length)||v.version!==4&&v.questions.length!==5)return null;
  const count=v.questions.length;
  const questions:VerticalFact[]=[];
  for(const item of v.questions){
    if(!item||typeof item!=='object')return null;
    const f=item as Record<string,unknown>;
    if(typeof f.a!=='number'||typeof f.b!=='number'||!Number.isInteger(f.a)||!Number.isInteger(f.b)||f.a<10||f.a>99||f.b<10||f.b>99)return null;
    const fact={a:f.a,b:f.b};if(v.version===1&&difficultyOf(fact)!==v.difficulty||v.version!==4&&f.holes!==undefined)return null;
    if(f.directZero!==undefined&&(v.version!==4||v.manualZero!==true||f.directZero!==true))return null;
    questions.push({...fact,...(f.holes!==undefined?{holes:f.holes as readonly string[]}:{}),...(f.directZero===true?{directZero:true as const}:{})});
  }
  if((v.version===2||v.version===3)&&questions.some((fact,index)=>{const expected=verticalSet(v.difficulty as Difficulty).legacyQuestions[index];return !expected||fact.a!==expected.a||fact.b!==expected.b;}))return null;
  const puzzles=questions.some(fact=>fact.holes!==undefined);
  if(puzzles&&v.manualZero!==true)return null;
  const operands=questions.some(fact=>Array.isArray(fact.holes)&&fact.holes.some(id=>typeof id==='string'&&id.startsWith('operand-')));
  if(v.version===4&&!parseVerticalQuestions(questions,v.difficulty as Difficulty,count,puzzles,operands,questions.some(f=>f.directZero)))return null;
  if(typeof v.index!=='number'||!Number.isInteger(v.index)||v.index<0||v.index>=count)return null;
  const current=questions[v.index];if(!current)return null;
  if(typeof v.stepIndex!=='number'||!Number.isInteger(v.stepIndex)||v.stepIndex<0||v.stepIndex>verticalQuestionSteps(current,v.manualZero===true).length)return null;
  if(typeof v.entry!=='string'||!/^\d?$/.test(v.entry)||typeof v.completed!=='boolean')return null;
  if(!Array.isArray(v.mistakes)||v.mistakes.length!==count||!v.mistakes.every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0))return null;
  if(v.completed&&(v.index!==count-1||v.stepIndex!==verticalQuestionSteps(current,v.manualZero===true).length))return null;
  let id:string|null=null,events:readonly VerticalAnswer[]=[];
  if(v.version===3||v.version===4){
    if(typeof v.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.id)||!Array.isArray(v.events)||v.events.length>2000)return null;
    id=v.id;
    let replay=createVerticalSession(v.difficulty as Difficulty,id,questions,v.timeScoring===true,v.manualZero===true,v.tightTime===true,v.cellScoring===true);
    for(const value of v.events){
      if(!value||typeof value!=='object')return null;
      const event=value as Record<string,unknown>;
      if(v.timeScoring===true&&(typeof event.ms!=='number'||!Number.isSafeInteger(event.ms)||event.ms<0||event.ms>1000000000)||v.timeScoring!==true&&event.ms!==undefined)return null;
      if(event.question===replay.index+1)replay=reduceVertical(replay,{type:'next'});
      if(replay.questions[replay.index]?.holes&&event.question===replay.index&&typeof event.step==='number'){
        if(verticalSolved(replay).has(event.step))return null;
        replay=reduceVertical(replay,{type:'select',step:event.step});
      }
      if(event.question!==replay.index||event.step!==replay.stepIndex||typeof event.answer!=='number'||!Number.isInteger(event.answer)||event.answer<0||event.answer>9)return null;
      const fact=replay.questions[replay.index];if(!fact||!verticalQuestionSteps(fact,replay.manualZero)[replay.stepIndex])return null;
      replay=reduceVertical(reduceVertical(replay,{type:'input',key:String(event.answer)}),{type:'input',key:'Enter',...(typeof event.ms==='number'?{ms:event.ms}:{})});
      if(v.timeScoring===true&&replay.events.at(-1)?.ms!==event.ms)return null;
    }
    if(v.index===replay.index+1||v.completed)replay=reduceVertical(replay,{type:'next'});
    if(replay.questions[replay.index]?.holes&&v.index===replay.index)replay=reduceVertical(replay,{type:'select',step:v.stepIndex});
    if(replay.index!==v.index||replay.stepIndex!==v.stepIndex||replay.completed!==v.completed||replay.mistakes.some((n,i)=>n!==(v.mistakes as number[])[i]))return null;
    events=replay.events;
  }
  return {version:v.version,id,events,difficulty:v.difficulty as Difficulty,questions,index:v.index,stepIndex:v.stepIndex,entry:v.entry,mistakes:v.mistakes as number[],completed:v.completed,...(v.timeScoring===true?{timeScoring:true as const}:{}),...(v.manualZero===true?{manualZero:true as const}:{}),...(v.tightTime===true?{tightTime:true as const}:{}),...(v.cellScoring===true?{cellScoring:true as const}:{})};
}
