// 블록 종목의 세로셈 나눗셈. lesson은 교과서 차시(2~10)이며 출제에만 쓰고 학생 화면에는 표시하지 않는다.
export type DivisionLesson=2|3|4|5|6|7|8|9|10;
export const DIVISION_LESSONS:readonly DivisionLesson[]=[2,3,4,5,6,7,8,9,10];
export type DivisionFact={readonly dividend:number;readonly divisor:number;readonly lesson:DivisionLesson};
// quotient: 몫, product: 몫 한 자리×나누는 수, rest: 뺄셈의 차와 내려 쓴 숫자(마지막 rest는 나머지), check-*: 검산 두 줄.
export type DivisionRow='quotient'|'product'|'rest'|'check-product'|'check-sum';
// expected는 세로셈 칸이면 한 자리(0~9), 검산 칸이면 수 전체다.
export type DivisionStep={readonly id:string;readonly row:DivisionRow;readonly stage:number;readonly place:number;readonly expected:number;readonly bringDown?:true};

const digitsOf=(value:number)=>String(value).split('').map(Number);
export const divisionQuotient=({dividend,divisor}:DivisionFact)=>Math.floor(dividend/divisor);
export const divisionRemainder=({dividend,divisor}:DivisionFact)=>dividend%divisor;

export function divisionSteps(fact:DivisionFact):readonly DivisionStep[]{
  const {dividend,divisor,lesson}=fact,steps:DivisionStep[]=[];
  const add=(row:DivisionRow,stage:number,place:number,expected:number,bringDown=false)=>steps.push({id:`${row}-${stage}:${place}`,row,stage,place,expected,...(bringDown?{bringDown:true as const}:{})});
  const addNumber=(row:DivisionRow,stage:number,value:number,lowest=0)=>{const digits=digitsOf(value);digits.forEach((digit,index)=>add(row,stage,lowest+digits.length-1-index,digit));};
  // (몇십)÷(몇)은 몫만 쓴다: 60÷3 → 2, 0.
  if(lesson===2){addNumber('quotient',0,divisionQuotient(fact));return steps;}
  const digits=digitsOf(dividend),last=digits.length-1;
  let current=0,stage=-1;
  digits.forEach((digit,index)=>{
    const place=last-index;
    // 앞에서 나누어떨어지고 마지막 숫자가 0이면 내려 쓰지 않고 몫에 0만 쓴다(220÷2 → 110).
    if(index===last&&digit===0&&stage>=0&&current===0){add('quotient',stage+1,place,0);return;}
    // 내려 쓴 숫자로 나눌 수 없으면(844÷8의 4) 내려 쓴 뒤 몫에 0을 쓴다.
    if(stage>=0)add('rest',stage,place,digit,true);
    current=current*10+digit;
    if(stage<0&&current<divisor)return;
    const q=Math.floor(current/divisor);
    add('quotient',stage+1,place,q);
    // 내려 쓴 수가 나누는 수보다 작으면 몫에 0만 쓰고 곱·뺄셈 줄은 쓰지 않는다.
    if(q===0)return;
    stage++;
    addNumber('product',stage,q*divisor,place);
    current-=q*divisor;
    // 중간 차의 0은 쓰지 않고, 마지막 차(나머지)는 0이어도 쓴다. 남은 숫자가 끝자리 0 하나뿐이면 이 차가 마지막 차다.
    const finalRest=index===last||(index===last-1&&digits[last]===0&&current===0);
    if(finalRest||current>0)add('rest',stage,place,current);
  });
  // 검산은 가로식이라 자리별로 나누지 않고 수 하나로 한 번에 입력한다(5×17=85, 85+2=87).
  if(lesson===8){const product=divisor*divisionQuotient(fact);add('check-product',0,0,product);add('check-sum',0,0,product+divisionRemainder(fact));}
  return steps;
}

// 차시 유형과 변형(몫에 0이 들어가거나 몫이 한 자리) 여부. 8차시는 6·7차시 기본 문제에 검산을 붙여 만든다.
export function divisionLessonOf(dividend:number,divisor:number):{readonly lesson:Exclude<DivisionLesson,8>;readonly variant:boolean}|null{
  if(!Number.isInteger(dividend)||!Number.isInteger(divisor)||divisor<2||divisor>9||dividend<10||dividend>999)return null;
  const quotient=Math.floor(dividend/divisor),remainder=dividend%divisor;
  if(dividend>=100)return {lesson:Math.floor(dividend/100)>=divisor?9:10,variant:String(quotient).includes('0')};
  const t=Math.floor(dividend/10),o=dividend%10;
  if(t<divisor)return remainder&&o?{lesson:7,variant:true}:null;
  if(o===0)return t%divisor===0?{lesson:2,variant:false}:remainder===0?{lesson:4,variant:false}:null;
  if(t%divisor===0)return remainder===0?{lesson:3,variant:false}:{lesson:6,variant:o<divisor};
  return {lesson:remainder===0?5:7,variant:false};
}

// 내려 쓴 줄이 0으로 시작하는 세로식(200÷2의 00, 602÷3의 02)은 교과서에 나오지 않으므로 내지 않는다.
// 0만 내려 쓴 줄(200÷2의 0)도 같은 이유로 내지 않는다.
const readableRows=(fact:DivisionFact)=>{const rest=divisionSteps(fact).filter(s=>s.row==='rest');return rest.every(s=>s.expected!==0||!rest.some(o=>o.stage===s.stage&&o.place<s.place)&&!(s.bringDown&&!rest.some(o=>o.stage===s.stage&&o.place>s.place)));};
const pools=new Map<string,readonly DivisionFact[]>();
export function divisionPool(lesson:DivisionLesson,variant=false):readonly DivisionFact[]{
  const key=`${lesson}:${variant}`,previous=pools.get(key);if(previous)return previous;
  const pool:DivisionFact[]=[];
  for(let dividend=10;dividend<=999;dividend++)for(let divisor=2;divisor<=9;divisor++){
    const kind=divisionLessonOf(dividend,divisor);
    if(!kind)continue;
    const fact={dividend,divisor,lesson};
    if((lesson===8?!variant&&(kind.lesson===6||kind.lesson===7)&&!kind.variant:kind.lesson===lesson&&kind.variant===variant)&&readableRows(fact))pool.push(fact);
  }
  pools.set(key,pool);return pool;
}

export const DIVISION_VARIANT_RATE=.2;
// 차시를 고르게 뽑되 같은 차시가 세 번 연속 나오지 않게 하고, 직전과 같은 식은 다시 내지 않는다.
export function nextDivisionFact(random:()=>number,history:readonly DivisionFact[]=[]):DivisionFact{
  const sample=()=>Math.min(1-Number.EPSILON,Math.max(0,random()));
  const [a,b]=history.slice(-2),previous=history.at(-1);
  const lessons=a&&b&&a.lesson===b.lesson?DIVISION_LESSONS.filter(lesson=>lesson!==a.lesson):DIVISION_LESSONS;
  const lesson=lessons[Math.floor(sample()*lessons.length)]!;
  const variant=(lesson===6||lesson===7||lesson===9||lesson===10)&&sample()<DIVISION_VARIANT_RATE;
  const pool=divisionPool(lesson,variant).filter(fact=>!previous||fact.dividend!==previous.dividend||fact.divisor!==previous.divisor);
  const fact=pool[Math.floor(sample()*pool.length)];
  if(!fact)throw new Error('Division question pool is empty');
  return fact;
}

// 서버와 같은 순서로 문제·블록을 만들기 위한 시드 난수(mulberry32). state를 저장해 두면 같은 지점부터 이어서 뽑을 수 있다.
export function seededGenerator(seed:number){
  let state=seed>>>0;
  return {random:()=>{state=(state+0x6d2b79f5)>>>0;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;},get state(){return state;}};
}
export const seededRandom=(seed:number):(()=>number)=>seededGenerator(seed).random;

export type DivisionAnswer={readonly step:number;readonly answer:number;readonly ms?:number};
export type DivisionProblem={readonly fact:DivisionFact;readonly stepIndex:number;readonly entry:string;readonly mistakes:number;readonly events:readonly DivisionAnswer[]};
export type DivisionAction={readonly type:'input';readonly key:string;readonly ms?:number};
export const createDivisionProblem=(fact:DivisionFact):DivisionProblem=>({fact,stepIndex:0,entry:'',mistakes:0,events:[]});
export const divisionSolved=(problem:DivisionProblem)=>problem.stepIndex>=divisionSteps(problem.fact).length;
export function reduceDivision(problem:DivisionProblem,action:DivisionAction):DivisionProblem{
  const step=divisionSteps(problem.fact)[problem.stepIndex];
  if(!step)return problem;
  if(action.key==='Enter'){
    if(!problem.entry)return problem;
    const answer=Number(problem.entry),ms=Math.min(1000000000,Math.max(0,Math.floor(action.ms??0)));
    const events=[...problem.events,{step:problem.stepIndex,answer,...(action.ms!==undefined?{ms}:{})}];
    return answer===step.expected?{...problem,events,stepIndex:problem.stepIndex+1,entry:''}:{...problem,events,mistakes:problem.mistakes+1,entry:''};
  }
  // 세로셈 칸은 숫자 하나(새로 누르면 바뀜), 검산 칸은 세 자리까지 이어 쓴다.
  const whole=step.row==='check-product'||step.row==='check-sum';
  if(action.key==='Backspace')return {...problem,entry:whole?problem.entry.slice(0,-1):''};
  if(action.key==='Delete')return {...problem,entry:''};
  if(/^\d$/.test(action.key))return {...problem,entry:whole?(problem.entry+action.key).slice(0,3):action.key};
  return problem;
}
