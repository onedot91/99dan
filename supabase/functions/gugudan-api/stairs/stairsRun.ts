import { seededGenerator } from './division.ts';
import { questionPool, reduceVertical, verticalQuestionSteps } from './vertical.ts';
import type { Difficulty, VerticalFact, VerticalSession } from './vertical.ts';
import { VERTICAL_CORRECT_POINTS } from './points.ts';

// 계단 종목(무한의 계단 × 두 자리 수 세로셈). 「오르기」는 보는 방향으로 한 칸, 「방향전환」은 돌아서 한 칸 오른다.
// 다음 칸과 방향이 다르면 목숨 하나를 잃고 그 자리에 선다. STAIRS_GATE칸마다 문제 계단이 있어 세로셈 한 문제를 다 풀어야 다시 오른다.
// 세로셈은 틀려도 다시 풀면 되고, 블록과 같은 찍기(같은 칸에서 1초 안에 또 틀리거나 같은 문제의 세 번째 오답부터)만 목숨을 잃는다.
// 목숨이 다 떨어지면 끝난다(무한 모드).
export type StairsDir=-1|1;
export type StairsPhase='climb'|'solve'|'over';
// 판 전체의 입력 기록. 서버가 같은 시드로 순서대로 재생한다. 세로셈 칸의 답은 0~9, ms는 칸을 시작한 뒤 흐른 시간이다.
export type StairsEntry='climb'|'turn'|{readonly answer:number;readonly ms?:number};
export type StairsRun={
  readonly seed:number;readonly stairRng:number;readonly problemRng:number;
  // steps[i]: i번째 칸에서 다음 칸으로 가는 방향(-1 왼쪽, 1 오른쪽). 화면에 보이도록 늘 앞쪽까지 만들어 둔다.
  readonly steps:readonly StairsDir[];readonly height:number;readonly facing:StairsDir;readonly lives:number;
  readonly phase:StairsPhase;readonly ended:'fallen'|'stopped'|null;
  readonly history:readonly VerticalFact[];readonly problem:VerticalSession|null;
  readonly solved:number;readonly coins:number;readonly mistakes:number;readonly mashes:number;readonly slips:number;readonly log:readonly StairsEntry[];
  // 연출용 기록(점수에는 영향 없음): 마지막 방향 실수·찍기가 난 입력 번호.
  readonly lastSlip:number|null;readonly lastMash:number|null;
};
export type StairsAction={readonly type:'climb'}|{readonly type:'turn'}|{readonly type:'stop'}|{readonly type:'input';readonly key:string;readonly ms?:number};

export const STAIRS_LIVES=3,STAIRS_GATE=7,STAIRS_AHEAD=24,STAIR_POINTS=10;
export const STAIRS_COIN_POINTS=50,STAIRS_COIN_CHANCE=.25;
export const STAIRS_MASH_MS=1000,STAIRS_FREE_TRIES=2;
export const stairsScore=(run:StairsRun)=>run.height*STAIR_POINTS+run.solved*VERTICAL_CORRECT_POINTS+(run.coins??0)*STAIRS_COIN_POINTS;
export const isGate=(height:number)=>height>0&&height%STAIRS_GATE===0;
// 경로·문제 난수와 분리해 화면 크기나 미리보기 범위가 달라도 코인 위치는 같다.
export function stairsHasCoin(seed:number,height:number):boolean{
  return height>0&&!isGate(height)&&seededGenerator((seed^Math.imul(height,0x9e3779b1)^0xc01dcafe)>>>0).random()<STAIRS_COIN_CHANCE;
}
export const stairsToNextGate=(run:StairsRun)=>STAIRS_GATE-run.height%STAIRS_GATE;
// 오를수록 어렵게: 푼 문제 수에 따라 올림 없음(下) → 곱셈 올림(中) → 덧셈 올림까지(上).
export const stairsDifficulty=(solved:number):Difficulty=>solved<3?1:solved<8?2:3;
export const stairsSteps=(problem:VerticalSession)=>verticalQuestionSteps(problem.questions[0]!);

function extendSteps(steps:readonly StairsDir[],rng:number,length:number){
  if(steps.length>=length)return {steps,rng};
  const generator=seededGenerator(rng),next=[...steps];
  while(next.length<length){
    const last=next.at(-1)??1;
    // 한쪽으로 4칸 넘게 이어지지 않게 하고, 처음 몇 칸은 덜 꺾는다.
    let run=0;while(run<next.length&&next[next.length-1-run]===last)run++;
    const turn=next.length===0?false:run>=4||generator.random()<(next.length<6?.2:.35);
    next.push(turn?(-last as StairsDir):last);
  }
  return {steps:next,rng:generator.state};
}
// 화면 밖 경로도 같은 시드로 미리 그린다. 실제 판의 경로와 난수 상태는 바꾸지 않는다.
export function stairsPreviewSteps(run:StairsRun,ahead:number):readonly StairsDir[]{
  return extendSteps(run.steps,run.stairRng,run.height+Math.max(STAIRS_AHEAD,Math.ceil(ahead))).steps;
}
// 0이 든 문제(50×60처럼 곱셈 칸이 0뿐인 문제)는 계단에서 내지 않는다.
const stairsPools=new Map<Difficulty,readonly VerticalFact[]>();
function stairsPool(difficulty:Difficulty){
  let pool=stairsPools.get(difficulty);
  if(!pool){pool=questionPool(difficulty).filter(({a,b})=>a%10!==0&&b%10!==0);stairsPools.set(difficulty,pool);}
  return pool;
}
function nextProblem(run:StairsRun):StairsRun{
  const generator=seededGenerator(run.problemRng),pool=stairsPool(stairsDifficulty(run.solved));
  const recent=new Set(run.history.slice(-10).map(fact=>`${fact.a}x${fact.b}`));
  let fact=pool[Math.floor(generator.random()*pool.length)]!;
  for(let i=0;i<8&&recent.has(`${fact.a}x${fact.b}`);i++)fact=pool[Math.floor(generator.random()*pool.length)]!;
  const problem:VerticalSession={version:4,id:null,events:[],difficulty:stairsDifficulty(run.solved),questions:[{a:fact.a,b:fact.b}],index:0,stepIndex:0,entry:'',mistakes:[0],completed:false,timeScoring:true};
  return {...run,problemRng:generator.state,history:[...run.history,{a:fact.a,b:fact.b}],problem,phase:'solve'};
}
export function createStairsRun(seed:number=Math.floor(Math.random()*2**32)):StairsRun{
  const first=extendSteps([],seed>>>0,STAIRS_AHEAD);
  return {seed,stairRng:first.rng,problemRng:(seed^0x9e3779b9)>>>0,steps:first.steps,height:0,facing:1,lives:STAIRS_LIVES,phase:'climb',ended:null,
    history:[],problem:null,solved:0,coins:0,mistakes:0,mashes:0,slips:0,log:[],lastSlip:null,lastMash:null};
}
const loseLife=(run:StairsRun):StairsRun=>run.lives<=1?{...run,lives:0,phase:'over',ended:'fallen'}:{...run,lives:run.lives-1};

export function reduceStairsRun(run:StairsRun,action:StairsAction):StairsRun{
  if(run.phase==='over')return run;
  if(action.type==='stop')return {...run,phase:'over',ended:'stopped'};
  if(action.type==='climb'||action.type==='turn'){
    if(run.phase!=='climb')return run;
    const key=run.log.length,log=[...run.log,action.type];
    const facing=action.type==='turn'?(-run.facing as StairsDir):run.facing;
    // 방향 실수: 그 자리에 서서 보던 방향도 그대로라 맞는 조작이 바뀌지 않는다.
    if(run.steps[run.height]!==facing)return loseLife({...run,log,slips:run.slips+1,lastSlip:key});
    const height=run.height+1,more=extendSteps(run.steps,run.stairRng,height+STAIRS_AHEAD);
    const coins=(run.coins??0)+Number(stairsHasCoin(run.seed,height));
    const climbed={...run,log,facing,height,coins,steps:more.steps,stairRng:more.rng};
    return isGate(height)?nextProblem(climbed):climbed;
  }
  if(run.phase!=='solve'||!run.problem)return run;
  const before=run.problem,problem=reduceVertical(before,action);
  if(problem===before)return run;
  const submitted=problem.events.length>before.events.length?problem.events.at(-1):undefined;
  if(!submitted)return {...run,problem};
  const key=run.log.length,log=[...run.log,submitted.ms!==undefined?{answer:submitted.answer,ms:submitted.ms}:{answer:submitted.answer}];
  const wrong=problem.stepIndex===before.stepIndex;
  if(!wrong)return problem.stepIndex>=stairsSteps(problem).length?{...run,problem,log,solved:run.solved+1,phase:'climb'}:{...run,problem,log};
  // 같은 칸의 직전 기록은 늘 오답이다(정답이면 다음 칸으로 넘어가므로).
  const previous=before.events.at(-1),triedBefore=before.mistakes[before.index]??0;
  const fast=!!previous&&previous.step===submitted.step&&submitted.ms!==undefined&&previous.ms!==undefined&&submitted.ms-previous.ms<STAIRS_MASH_MS;
  const counted={...run,problem,log,mistakes:run.mistakes+1};
  return fast||triedBefore>=STAIRS_FREE_TRIES?loseLife({...counted,mashes:run.mashes+1,lastMash:key}):counted;
}

// 서버 검증(기록은 요청 크기 제한 160KB 안에 들도록 5000개까지): 같은 시드로 새 판을 만들고 기록을 순서대로 재생한다. 오를 차례에는 'climb'/'turn'을, 풀 차례에는 답을 쓴다.
// 효과 없는 입력·남는 기록·끝난 방식이 맞지 않으면 null이다.
export const STAIRS_REPLAY_LIMIT=5000;
export function replayStairsRun(seed:number,log:readonly StairsEntry[],ended:'fallen'|'stopped'):StairsRun|null{
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||log.length>STAIRS_REPLAY_LIMIT)return null;
  let run=createStairsRun(seed),used=0;
  while(run.phase!=='over'&&used<log.length){
    const entry=log[used++]!;
    let next:StairsRun;
    if(entry==='climb'||entry==='turn')next=reduceStairsRun(run,{type:entry});
    else if(typeof entry==='object'&&entry&&Number.isInteger(entry.answer)&&entry.answer>=0&&entry.answer<=9){
      const typed=reduceStairsRun(run,{type:'input',key:String(entry.answer)});
      next=typed===run?run:reduceStairsRun(typed,{type:'input',key:'Enter',...(entry.ms!==undefined?{ms:entry.ms}:{})});
      if(next===typed)return null;
    }else return null;
    if(next===run||next.log.length!==run.log.length+1)return null;
    run=next;
  }
  if(used!==log.length)return null;
  if(run.phase==='over')return run.ended===ended?run:null;
  return ended==='stopped'?reduceStairsRun(run,{type:'stop'}):null;
}
