import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { divisionQuotient, divisionRemainder, divisionSteps } from '../game/division';
import type { DivisionProblem, DivisionStep } from '../game/division';
import { BOARD_SIZE, fits, place, shapeColor } from '../game/blocks';
import type { Shape } from '../game/blocks';
import { blockPieces, blockScore } from '../game/blockRun';
import type { BlockClear, BlockRun } from '../game/blockRun';
import type { BlockGame } from '../game/useBlockGame';
import type { BlockSync } from '../cloud/useBlockSync';
import { NumberPad } from './NumberPad';
import { Icon } from './Icon';
import { PixelArt } from './PixelArt';
import type { Cue } from '../game/audio';

const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function Burst(){return <span className="vertical-burst" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i}/>)}</span>;}

const ROW_LABEL={quotient:'몫','product':'곱','rest':'뺄셈','check-product':'검산 곱','check-sum':'검산 더하기'} as const;
function Digit({step,value,active,source,wrong,attempt,confirmKey=null}:{readonly step:DivisionStep;readonly value:string;readonly active:boolean;readonly source?:boolean;readonly wrong:boolean;readonly attempt:number;readonly confirmKey?:string|null}){
  return <button type="button" className={`vertical-cell${active?' current-cell':''}${active&&wrong?' wrong-cell':''}${!active&&value?' filled-cell':''}${source?' source-cell':''}${confirmKey?' confirmed-cell':''}`} disabled={!active} aria-label={`${ROW_LABEL[step.row]}${active?' 입력 칸':` ${value}`}`} aria-current={active?'step':undefined} aria-invalid={active&&wrong?true:undefined}>
    <span key={confirmKey??`${active}:${wrong?attempt:0}`} className="vertical-cell-face"><span className={active&&value?'vertical-entry':''}>{value}</span>{confirmKey&&<Burst/>}</span>
  </button>;
}

// 세로셈 나눗셈 판: [나누는 수][)][나누어지는 수 자리들]. 몫은 위, 곱·뺄셈 줄은 아래로 쌓인다.
// 블록을 놓을 때는 문제가 바뀌지 않으므로 다시 그리지 않는다.
export const DivisionBoard=memo(function DivisionBoard({problem,wrong}:{readonly problem:DivisionProblem;readonly wrong:boolean}){
  const {fact,stepIndex,entry}=problem;
  const steps=divisionSteps(fact),current=steps[stepIndex];
  const width=String(fact.dividend).length;
  const stages=Math.max(-1,...steps.filter(s=>s.row==='product').map(s=>s.stage))+1;
  const seen=(row:DivisionStep['row'],stage:number)=>steps.some((s,i)=>s.row===row&&s.stage===stage&&i<=stepIndex);
  const done=(row:DivisionStep['row'],stage:number)=>steps.every((s,i)=>s.row!==row||s.stage!==stage||i<stepIndex);
  const attempt=problem.events.length;
  // 방금 맞힌 칸은 확정 모션과 작은 파편을 보여 준다.
  const last=problem.events.at(-1),confirmed=last&&last.answer===steps[last.step]?.expected?last.step:-1;
  const confirmKey=(index:number)=>index===confirmed?`ok${attempt}`:null;
  // 지금 칸을 계산할 때 보는 숫자를 파랗게 표시한다.
  const sourceDividend=(place:number)=>!!current&&(current.bringDown===true&&current.place===place);
  const sourceDivisor=!!current&&(current.row==='quotient'||current.row==='product');
  const cell=(row:DivisionStep['row'],stage:number,place:number,column:number,gridRow:number)=>{
    const index=steps.findIndex(s=>s.row===row&&(row==='quotient'||s.stage===stage)&&s.place===place);
    const step=steps[index];
    const style={gridColumn:column,gridRow} as CSSProperties;
    if(!step||index>stepIndex)return <span key={`${row}${stage}:${place}`} style={style}/>;
    const source=!!current&&current.row==='product'&&row==='quotient'&&step.stage===current.stage;
    return <span key={`${row}${stage}:${place}`} style={style} className="division-slot"><Digit step={step} value={index===stepIndex?entry:String(step.expected)} active={index===stepIndex} source={source} wrong={wrong} attempt={attempt} confirmKey={confirmKey(index)}/></span>;
  };
  const places=Array.from({length:width},(_,i)=>width-1-i);
  const column=(place:number)=>3+(width-1-place);
  const rows:ReactNode[]=[];
  let gridRow=3;
  for(let stage=0;stage<stages;stage++){
    if(seen('product',stage))rows.push(...places.map(place=>cell('product',stage,place,column(place),gridRow)));
    gridRow++;
    if(done('product',stage))rows.push(<i key={`rule${stage}`} className="division-rule" style={{gridRow,gridColumn:`3 / span ${width}`}}/>);
    gridRow++;
    if(seen('rest',stage))rows.push(...places.map(place=>cell('rest',stage,place,column(place),gridRow)));
    gridRow++;
  }
  const checkStart=steps.findIndex(s=>s.row==='check-product');
  const showCheck=checkStart>=0&&stepIndex>=checkStart;
  const checkRow=(row:'check-product'|'check-sum')=>steps.flatMap((s,i)=>s.row===row?[i]:[]).map(i=>i>stepIndex?<span key={i} className="division-slot"/>:<span key={i} className="division-slot"><Digit step={steps[i]!} value={i===stepIndex?entry:String(steps[i]!.expected)} active={i===stepIndex} wrong={wrong} attempt={attempt} confirmKey={confirmKey(i)}/></span>);
  const product=fact.divisor*divisionQuotient(fact);
  return <div className="division-board" role="group" aria-label={`${fact.dividend} 나누기 ${fact.divisor}, 세로셈`} style={{'--division-width':width,'--division-rows':2+stages*2+(checkStart>=0?2:0)} as CSSProperties}>
    <div className="division-grid">
      {places.map(place=>cell('quotient',0,place,column(place),1))}
      <span className={`division-given${sourceDivisor?' source-digit':''}`} style={{gridColumn:1,gridRow:2}}>{fact.divisor}</span>
      <span className="division-bracket" style={{gridColumn:2,gridRow:2}} aria-hidden="true"/>
      {places.map(place=><span key={`d${place}`} className={`division-given division-dividend${sourceDividend(place)?' source-digit':''}`} style={{gridColumn:column(place),gridRow:2}}>{Math.floor(fact.dividend/10**place)%10}</span>)}
      {rows}
    </div>
    {showCheck&&<div className="division-check" role="group" aria-label="검산">
      <div><span>{fact.divisor} × {divisionQuotient(fact)} =</span>{checkRow('check-product')}</div>
      {stepIndex>=steps.findIndex(s=>s.row==='check-sum')&&<div><span>{product} + {divisionRemainder(fact)} =</span>{checkRow('check-sum')}</div>}
    </div>}
  </div>;
});

function PieceArt({piece}:{readonly piece:Shape}){
  const {rows,cols}=pieceSize(piece);
  return <span className="block-piece" data-c={shapeColor(piece)} style={{gridTemplateRows:`repeat(${rows},var(--piece-cell))`,gridTemplateColumns:`repeat(${cols},var(--piece-cell))`}}>{piece.cells.map(([r,c])=><i key={`${r}:${c}`} style={{gridRow:r+1,gridColumn:c+1}}/>)}</span>;
}
const pieceSize=(piece:Shape)=>({rows:Math.max(...piece.cells.map(c=>c[0]))+1,cols:Math.max(...piece.cells.map(c=>c[1]))+1});

// 줄 지우기 연출: 지워진 칸이 줄을 따라 차례로 번쩍이고 조각나 흩어진다. 줄마다 빛줄기, 가운데 점수·칭찬·콤보 배너.
const PRAISE=['','','좋아요!','멋져요!','대단해요!','최고예요!'] as const;
function ClearEffect({clear}:{readonly clear:BlockClear}){
  const lines=clear.rows.length+clear.cols.length;
  const rows=clear.cells.map(c=>Math.floor(c.index/BOARD_SIZE)),cols=clear.cells.map(c=>c.index%BOARD_SIZE);
  const midRow=rows.reduce((a,b)=>a+b,0)/rows.length,midCol=cols.reduce((a,b)=>a+b,0)/cols.length;
  const banner=clear.allClear?'올 클리어!':PRAISE[Math.min(lines,5)]||null;
  return <div className="block-fx" aria-hidden="true" data-lines={Math.min(lines,4)}>
    {clear.rows.map(r=><u key={`r${r}`} className="fx-beam" style={{gridRow:r+1,gridColumn:'1 / -1'}}/>)}
    {clear.cols.map(c=><u key={`c${c}`} className="fx-beam vertical" style={{gridColumn:c+1,gridRow:'1 / -1'}}/>)}
    {clear.cells.map(({index,color})=>{
      const r=Math.floor(index/BOARD_SIZE),c=index%BOARD_SIZE,delay=Math.round(Math.hypot(r-midRow,c-midCol)*22);
      const angle=Math.atan2(r-midRow+.01,c-midCol+.01);
      return <b key={index} data-c={color} style={{gridRow:r+1,gridColumn:c+1,'--delay':`${delay}ms`} as CSSProperties}>
        <i/>
        {[0,1,2].map(k=>{const a=angle+(k-1)*.9,dist=40+((index*7+k*13)%30);return <s key={k} style={{'--dx':`${Math.cos(a)*dist}px`,'--dy':`${Math.sin(a)*dist-20}px`,'--spin':`${(k-1)*160}deg`} as CSSProperties}/>;})}
      </b>;
    })}
    <em className="fx-points" style={{top:`${(midRow+.5)/BOARD_SIZE*100}%`,left:`${(midCol+.5)/BOARD_SIZE*100}%`}}>+{clear.points}</em>
    {(banner||clear.combo>=2)&&<div className={`fx-banner${clear.allClear?' all-clear':''}`}>{banner&&<strong>{banner}</strong>}{clear.combo>=2&&<span>콤보 ×{clear.combo}</span>}</div>}
  </div>;
}

// 끌기는 다시 그리지 않고 ref로만 따라간다. 잡은 지점(블록 안의 비율)을 유지하고, 터치는 손가락 위로 띄운다.
type Drag={readonly index:number;readonly startX:number;readonly startY:number;readonly grabX:number;readonly grabY:number;readonly lift:number;moved:boolean};
type Spot={readonly row:number;readonly col:number};
function BlockBoard({run,onPlace,selected,setSelected,onCue}:{readonly run:BlockRun;readonly onPlace:(piece:number,row:number,col:number)=>boolean;readonly selected:number|null;readonly setSelected:(index:number|null)=>void;readonly onCue:(cue:Cue)=>void}){
  const boardRef=useRef<HTMLDivElement>(null);
  const ghostRef=useRef<HTMLDivElement>(null);
  const dragRef=useRef<Drag|null>(null);
  const [dragging,setDragging]=useState<number|null>(null);
  const [target,setTarget]=useState<Spot|null>(null);
  const targetRef=useRef<Spot|null>(null);
  const [cursor,setCursor]=useState<Spot|null>(null);
  const pieces=blockPieces(run);
  const placing=run.phase==='place';
  const active=dragging??selected;
  const activePiece=active!==null?pieces[active]??null:null;
  // 판 안쪽 칸의 시작점·칸 크기·간격을 실제 칸 위치에서 잰다(판 여백과 칸 사이 간격 포함).
  const grid=()=>{
    const cells=boardRef.current?.children;const a=cells?.[0]?.getBoundingClientRect(),b=cells?.[1]?.getBoundingClientRect(),c=cells?.[BOARD_SIZE]?.getBoundingClientRect();
    return a&&b&&c?{left:a.left,top:a.top,cell:a.width,pitchX:b.left-a.left,pitchY:c.top-a.top}:null;
  };
  const anchor=dragging!==null?target:selected!==null?cursor:null;
  const valid=!!activePiece&&!!anchor&&fits(run.board,activePiece,anchor.row,anchor.col);
  const preview=new Map<number,boolean>();
  if(activePiece&&anchor)for(const [r,c] of activePiece.cells){const y=anchor.row+r,x=anchor.col+c;if(y>=0&&x>=0&&y<BOARD_SIZE&&x<BOARD_SIZE)preview.set(y*BOARD_SIZE+x,valid);}
  // 놓으면 지워질 줄을 미리 밝힌다.
  const willClear=new Set<number>();
  if(valid&&activePiece&&anchor){const result=place(run.board,activePiece,anchor.row,anchor.col);if(result){for(const r of result.rows)for(let c=0;c<BOARD_SIZE;c++)willClear.add(r*BOARD_SIZE+c);for(const c of result.cols)for(let r=0;r<BOARD_SIZE;r++)willClear.add(r*BOARD_SIZE+c);}}
  const cleared=new Set<number>();
  if(run.lastClear){for(const r of run.lastClear.rows)for(let c=0;c<BOARD_SIZE;c++)cleared.add(r*BOARD_SIZE+c);for(const c of run.lastClear.cols)for(let r=0;r<BOARD_SIZE;r++)cleared.add(r*BOARD_SIZE+c);}
  const tryPlace=(index:number,row:number,col:number)=>{if(onPlace(index,row,col)){setSelected(null);setCursor(null);return true;}return false;};
  const pickCell=(event:{clientX:number;clientY:number})=>{
    const g=grid(),piece=selected!==null?pieces[selected]:null;if(!g||!piece)return null;
    const size=pieceSize(piece);
    return {row:Math.floor((event.clientY-g.top)/g.pitchY)-Math.floor((size.rows-1)/2),col:Math.floor((event.clientX-g.left)/g.pitchX)-Math.floor((size.cols-1)/2)};
  };
  // 판 위치는 끌기 시작할 때 한 번만 잰다. 움직일 때마다 재면 매번 화면 배치를 다시 계산해 끊긴다.
  const gridCache=useRef<ReturnType<typeof grid>>(null);
  const frame=useRef(0);
  const moveGhost=(x:number,y:number)=>{
    const d=dragRef.current,g=gridCache.current??grid(),piece=d?pieces[d.index]:null;if(!d||!g||!piece)return;
    const size=pieceSize(piece);
    const left=x-d.grabX*(size.cols*g.pitchX),top=y-d.grabY*(size.rows*g.pitchY)-d.lift;
    if(ghostRef.current)ghostRef.current.style.transform=`translate3d(${left}px,${top}px,0)`;
    const next={row:Math.round((top-g.top)/g.pitchY),col:Math.round((left-g.left)/g.pitchX)};
    const onBoard=next.row>-size.rows&&next.col>-size.cols&&next.row<BOARD_SIZE&&next.col<BOARD_SIZE;
    const spot=onBoard?next:null,previous=targetRef.current;
    if(spot?.row!==previous?.row||spot?.col!==previous?.col){targetRef.current=spot;setTarget(spot);}
  };
  const lastPoint=useRef({x:0,y:0});
  useLayoutEffect(()=>{
    const g=gridCache.current;
    if(dragging!==null&&ghostRef.current&&g){ghostRef.current.style.setProperty('--piece-cell',`${g.cell}px`);ghostRef.current.style.setProperty('--piece-gap',`${g.pitchX-g.cell}px`);}
    if(dragging!==null)moveGhost(lastPoint.current.x,lastPoint.current.y);
  },[dragging]);
  const onPiecePointerDown=(index:number,event:ReactPointerEvent<HTMLButtonElement>)=>{
    if(!placing||!pieces[index])return;
    try{event.currentTarget.setPointerCapture(event.pointerId);}catch{/* 이미 끝난 포인터면 캡처 없이 끈다 */}
    const art=event.currentTarget.querySelector('.block-piece')?.getBoundingClientRect();
    const clamp=(n:number)=>Math.min(1,Math.max(0,n));
    const grabX=art?clamp((event.clientX-art.left)/art.width):.5,grabY=art?clamp((event.clientY-art.top)/art.height):.5;
    gridCache.current=grid();
    const lift=event.pointerType==='touch'?(gridCache.current?.pitchY??40)*1.5:0;
    dragRef.current={index,startX:event.clientX,startY:event.clientY,grabX,grabY,lift,moved:false};
  };
  const onPiecePointerMove=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    const d=dragRef.current;if(!d)return;
    lastPoint.current={x:event.clientX,y:event.clientY};
    if(!d.moved&&Math.hypot(event.clientX-d.startX,event.clientY-d.startY)>6){d.moved=true;setDragging(d.index);onCue('pickup');}
    // 한 화면 프레임에 한 번만 옮긴다.
    if(d.moved&&!frame.current)frame.current=requestAnimationFrame(()=>{frame.current=0;moveGhost(lastPoint.current.x,lastPoint.current.y);});
  };
  const endDrag=()=>{if(frame.current){cancelAnimationFrame(frame.current);frame.current=0;}dragRef.current=null;targetRef.current=null;gridCache.current=null;setDragging(null);setTarget(null);};
  const onPiecePointerUp=(event:ReactPointerEvent<HTMLButtonElement>)=>{
    const d=dragRef.current;if(!d)return;
    // 아직 그리지 않은 마지막 위치까지 반영한 뒤 놓을 칸을 정한다.
    if(d.moved){if(frame.current){cancelAnimationFrame(frame.current);frame.current=0;}lastPoint.current={x:event.clientX,y:event.clientY};moveGhost(event.clientX,event.clientY);}
    const spot=targetRef.current;
    if(d.moved){
      if(spot&&tryPlace(d.index,spot.row,spot.col)){endDrag();return;}
      // 놓을 수 없으면 블록이 제자리(블록 칸)로 미끄러져 돌아간다.
      onCue('invalid');
      const ghost=ghostRef.current,slot=document.querySelectorAll('.block-tray>*')[d.index]?.querySelector('.block-piece')?.getBoundingClientRect();
      dragRef.current=null;
      if(ghost&&slot&&!reducedMotion()){const back=ghost.animate([{transform:ghost.style.transform},{transform:`translate3d(${slot.left}px,${slot.top}px,0) scale(.4)`,opacity:.3}],{duration:180,easing:'steps(5,end)'});back.onfinish=endDrag;return;}
    }else{setSelected(selected===d.index?null:d.index);boardRef.current?.focus({preventScroll:true});}
    endDrag();
  };
  // 키보드: 1·2·3으로 블록 고르기, 방향키로 옮기기, Enter로 놓기, Escape로 고르기 취소.
  useEffect(()=>{if(selected!==null&&!cursor){const piece=pieces[selected];if(piece){for(let row=0;row<BOARD_SIZE;row++)for(let col=0;col<BOARD_SIZE;col++)if(fits(run.board,piece,row,col)){setCursor({row,col});return;}setCursor({row:0,col:0});}}},[selected]);
  const onBoardKey=(event:ReactKeyboardEvent)=>{
    if(selected===null||!cursor)return;
    const piece=pieces[selected];if(!piece)return;
    const size=pieceSize(piece);
    const move=(dr:number,dc:number)=>{event.preventDefault();setCursor({row:Math.min(BOARD_SIZE-size.rows,Math.max(0,cursor.row+dr)),col:Math.min(BOARD_SIZE-size.cols,Math.max(0,cursor.col+dc))});};
    if(event.key==='ArrowUp')move(-1,0);else if(event.key==='ArrowDown')move(1,0);else if(event.key==='ArrowLeft')move(0,-1);else if(event.key==='ArrowRight')move(0,1);
    else if(event.key==='Enter'||event.key===' '){event.preventDefault();tryPlace(selected,cursor.row,cursor.col);}
    else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setSelected(null);setCursor(null);}
  };
  const color=activePiece?shapeColor(activePiece):0;
  // 줄을 지우면 판만 흔들린다(지운 줄 수만큼 세게). 화면 전체는 흔들지 않는다.
  useEffect(()=>{
    const clear=run.lastClear;if(!clear||clear.key!==run.lastPlace?.key||reducedMotion())return;
    const n=clear.rows.length+clear.cols.length,amp=Math.min(10,3+n*2+(clear.allClear?4:0));
    boardRef.current?.animate([{transform:'none'},{transform:`translate(${-amp}px,${amp/2}px)`},{transform:`translate(${amp}px,${-amp/2}px)`},{transform:`translate(${-amp/2}px,0)`},{transform:'none'}],{duration:260+n*40,easing:'steps(8,end)'});
  },[run.lastClear?.key]);
  const placed=new Set(run.lastPlace?.cells??[]);
  const filled=run.board.filter(Boolean).length;
  const danger=placing&&filled>=BOARD_SIZE*BOARD_SIZE*.6;
  const over=run.ended==='stuck';
  const fresh=run.lastClear&&run.lastClear.key===run.lastPlace?.key?run.lastClear:null;
  return <div className="block-area">
    <div ref={boardRef} className={`block-board${selected!==null?' choosing':''}${danger?' danger':''}${over?' game-over':''}`} role="grid" aria-label={`블록 판${selected!==null?', 방향키로 옮기고 Enter로 놓기':''}`} tabIndex={placing?0:-1} onKeyDown={onBoardKey}
      onPointerMove={event=>{if(selected!==null&&dragging===null&&event.pointerType==='mouse'){const c=pickCell(event);if(c&&(c.row!==cursor?.row||c.col!==cursor?.col))setCursor(c);}}}
      onClick={event=>{if(selected===null||!placing)return;const c=pickCell(event);if(c&&!tryPlace(selected,c.row,c.col))setCursor(c);}}>
      {run.board.map((value,i)=>{const p=preview.get(i),pop=placed.has(i)&&!!value;return <i key={`${i}:${pop?`p${run.lastPlace?.key}`:''}`} data-c={p===true?color:value||undefined} style={over?{'--row':Math.floor(i/BOARD_SIZE)} as CSSProperties:undefined} className={`${value?'filled':''}${p===true?' preview':p===false?' blocked':''}${willClear.has(i)?' will-clear':''}${pop?' placed':''}`}/>;})}
      {fresh&&<ClearEffect key={fresh.key} clear={fresh}/>}
    </div>
    <div className={`block-tray${placing?' unlocked':' locked'}`} role="group" aria-label={placing?'놓을 블록':'문제를 풀면 나오는 블록'}>
      {/* 블록은 문제를 다 풀어야 공개된다. 푸는 동안은 물음표 칸만 보인다. */}
      {pieces.map((piece,index)=>!placing&&piece?<span key={`${run.history.length}:${index}`} className="block-slot hidden-piece" aria-hidden="true"><b>?</b></span>:piece?<button key={`${run.history.length}:${index}`} type="button" className={`block-slot${selected===index?' selected':''}${dragging===index?' dragging':''}`} disabled={!placing} aria-label={`${index+1}번 블록, ${piece.cells.length}칸`} aria-pressed={selected===index}
        onPointerDown={event=>onPiecePointerDown(index,event)} onPointerMove={onPiecePointerMove} onPointerUp={onPiecePointerUp} onPointerCancel={endDrag}
        onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(index);boardRef.current?.focus({preventScroll:true});}}}>
        <PieceArt piece={piece}/></button>:<span key={`${run.history.length}:${index}`} className="block-slot used"/>)}
    </div>
    {/* 판 영역은 크기 컨테이너라 position:fixed의 기준이 되므로 끄는 블록은 body에 그린다. */}
    {dragging!==null&&activePiece&&createPortal(<div ref={ghostRef} className={`block-ghost${target&&valid?' over-valid':''}`} aria-hidden="true"><PieceArt piece={activePiece}/></div>,document.body)}
  </div>;
}

export function BlockProgress({run}:{readonly run:BlockRun}){
  const score=blockScore(run);
  const previous=useRef(score),[change,setChange]=useState<{readonly key:number;readonly amount:number}|null>(null);
  useEffect(()=>{const amount=score-previous.current;previous.current=score;if(amount)setChange({key:score*10+Math.sign(amount),amount});},[score]);
  return <div className="vertical-progress block-progress"><span className="vertical-live-score" role="status" aria-label={`점수 ${score}점`}><strong key={score} className={change?change.amount>0?'score-earned':'score-lost':''}>{score.toLocaleString()}</strong><small>점</small>{change&&<i key={change.key} className={`vertical-score-change${change.amount>0?'':' lost'}`} aria-hidden="true">{change.amount>0?'+':''}{change.amount}</i>}</span><span className="block-solved" aria-label={`푼 문제 ${run.solved}개`}><Icon name="check" size={18}/>{run.solved}</span></div>;
}

export function BlockPlay({game,onCue}:{readonly game:BlockGame;readonly onCue:(cue:Cue,step?:number)=>void}){
  const run=game.run;
  const [selected,setSelected]=useState<number|null>(null);
  const [wrong,setWrong]=useState(false);
  const active=useRef<HTMLElement|null>(null);
  const input=(key:string)=>{
    if(!run||run.phase!=='solve')return;
    const step=divisionSteps(run.problem.fact)[run.problem.stepIndex];
    if(key==='Enter'&&run.problem.entry&&step){const correct=Number(run.problem.entry)===step.expected;setWrong(!correct);onCue(correct?'correct':'wrong');}
    else if(/^\d$/.test(key))setWrong(false);
    game.input(key);
  };
  const onPlace=(piece:number,row:number,col:number)=>game.placePiece(piece,row,col);
  // 놓기: 줄을 지웠으면 지운 줄 수·콤보만큼 높은 지우기 소리, 아니면 쿵.
  useEffect(()=>{
    const place=run?.lastPlace;if(!run||!place)return;
    const clear=run.lastClear?.key===place.key?run.lastClear:null;
    if(!clear)onCue('place');
    else if(clear.allClear)onCue('allclear');
    else onCue('clear',(clear.rows.length+clear.cols.length-1)*2+(clear.combo-1)*2);
  },[run?.lastPlace?.key]);
  // 문제를 다 풀면 도장을 잠깐 보여 주고(휴대폰은 이때 블록 화면으로 넘어간다) 블록이 열리는 소리.
  const [handoff,setHandoff]=useState(false);
  const solvedBefore=useRef(run?.solved??0);
  useEffect(()=>{
    if(!run||run.solved<=solvedBefore.current){solvedBefore.current=run?.solved??0;return undefined;}
    solvedBefore.current=run.solved;setHandoff(true);
    const cue=window.setTimeout(()=>onCue('unlock'),220),done=window.setTimeout(()=>setHandoff(false),reducedMotion()?200:650);
    return()=>{window.clearTimeout(cue);window.clearTimeout(done);};
  },[run?.solved]);
  useEffect(()=>{setSelected(null);},[run?.history.length,run?.phase]);
  useEffect(()=>{
    if(run?.phase==='solve'){active.current=document.querySelector<HTMLElement>('.division-board .vertical-cell[aria-current="step"]');active.current?.focus({preventScroll:true});}
    else if(run?.phase==='place')document.querySelector<HTMLElement>('.block-slot:not(.used)')?.focus({preventScroll:true});
  },[run?.phase,run?.problem.stepIndex,run?.history.length]);
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(!run||event.ctrlKey||event.metaKey||event.altKey||event.repeat||document.querySelector('dialog[open]'))return;
      if(run.phase==='solve'&&(/^\d$/.test(event.key)||['Enter','Backspace','Delete'].includes(event.key))){
        if(event.target instanceof HTMLButtonElement&&(event.key==='Enter'||event.key===' ')&&!event.target.classList.contains('vertical-cell'))return;
        event.preventDefault();input(event.key);
      }else if(run.phase==='place'&&/^[1-3]$/.test(event.key)&&run.pieces[Number(event.key)-1]){
        event.preventDefault();setSelected(Number(event.key)-1);document.querySelector<HTMLElement>('.block-board')?.focus({preventScroll:true});
      }
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  });
  if(!run)return null;
  const solving=run.phase==='solve'||handoff&&run.phase==='place';
  return <main className={`block-play${solving?' solving':' placing'}${handoff?' handoff':''}`}>
    <section className="block-field" aria-label="블록">
      <BlockBoard run={run} onPlace={onPlace} selected={selected} setSelected={setSelected} onCue={onCue}/>
    </section>
    <section className="division-paper vertical-paper arcade-panel" key={run.history.length} aria-label="나눗셈">
      <DivisionBoard problem={run.problem} wrong={wrong}/>
      {handoff&&<div className="vertical-check-stamp block-stamp" aria-hidden="true"><Icon name="check" size={80}/><Burst/></div>}
    </section>
    <section className="vertical-controls block-controls" aria-label="숫자 입력">
      <span className="vertical-sr-only" role="status" aria-live="polite">{solving?wrong?'이 칸을 다시 풀어 봐요.':'':'블록을 판에 놓아요.'}</span>
      <div className="vertical-pad"><div className="vertical-pad-keys"><NumberPad onInput={input} disabled={run.phase!=='solve'} canSubmit={run.phase==='solve'&&run.problem.entry.length>0}/></div></div>
    </section>
  </main>;
}

// 결과 점수는 0부터 올라가며 끝나면 도장처럼 찍힌다.
function useCountUp(target:number,ms=900){
  const [value,setValue]=useState(()=>reducedMotion()?target:0);
  useEffect(()=>{
    if(reducedMotion()){setValue(target);return undefined;}
    const start=performance.now();let frame=0;
    const tick=(now:number)=>{const t=Math.min(1,(now-start)/ms);setValue(Math.round(target*(1-(1-t)**3)));if(t<1)frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[target,ms]);
  return value;
}
function BlockSyncNotice({sync}:{readonly sync:BlockSync}){
  return sync.state==='saving'?<p className="sync-status" role="status">순위 저장 중</p>:sync.state==='saved'?<p className="sync-status" role="status">순위 저장 완료</p>:sync.state==='rejected'?<p className="sync-status" role="status">이번 판은 순위에 넣지 못했어요</p>:sync.state==='error'?<div className="vertical-assignment-error" role="alert"><p>{sync.blocked?'점수를 저장하지 못했습니다.':'시작하지 못했습니다. 다시 시도해 주세요.'}</p>{sync.blocked&&<button className="quiet-button" onClick={()=>void sync.retry()}>저장 재시도</button>}</div>:null;
}
export function BlockResult({game,sync,starting,onHome,onAgain,onHall}:{readonly game:BlockGame;readonly sync:BlockSync;readonly starting:boolean;readonly onHome:()=>void;readonly onAgain:()=>void;readonly onHall:()=>void}){
  const run=game.run;if(!run||run.phase!=='over')return null;
  // 서버가 재생해 매긴 점수가 오면 그 점수를, 최고 기록은 서버와 이 기기 중 높은 쪽과 비교한다.
  const score=sync.serverScore??blockScore(run);
  const bestBefore=sync.serverBest===null?game.bestBefore:game.bestBefore===null?sync.serverBest:Math.max(sync.serverBest,game.bestBefore);
  const record=bestBefore===null||score>bestBefore;
  return <BlockResultView run={run} score={score} record={record} bestBefore={bestBefore} sync={sync} starting={starting} onHome={onHome} onAgain={onAgain} onHall={onHall}/>;
}
function BlockResultView({run,score,record,bestBefore,sync,starting,onHome,onAgain,onHall}:{readonly run:BlockRun;readonly score:number;readonly record:boolean;readonly bestBefore:number|null;readonly sync:BlockSync;readonly starting:boolean;readonly onHome:()=>void;readonly onAgain:()=>void;readonly onHall:()=>void}){
  const shown=useCountUp(score),done=shown===score;
  return <main className="vertical-result block-result">
    <section className="vertical-result-hero" aria-label="결과">
      <div className="vertical-result-trophy"><PixelArt kind="trophy"/></div>
      <div className="vertical-completion-badge">블록</div>
      <h1>{run.ended==='stuck'?'블록이 꽉 찼어요!':'여기까지!'}</h1>
      <strong className={`vertical-result-score${done?' counted':''}`} aria-label={`${score}점`}>{shown.toLocaleString()}<small>점</small></strong>
      <p className={`vertical-score-rule${done&&record?' block-record':''}`}>{record?bestBefore===null?'첫 기록!':'최고 기록 갱신!':`최고 ${bestBefore!.toLocaleString()}점`}</p>
    </section>
    <section className="vertical-result-summary block-result-summary" aria-label="기록">
      <div className="block-result-stats"><div><span>푼 문제</span><strong>{run.solved}</strong></div><div><span>지운 줄</span><strong>{run.lines}</strong></div><div><span>최대 콤보</span><strong>{run.bestCombo}</strong></div></div>
      {sync.state!=='local'&&<button className="quiet-button vertical-hall-link" onClick={onHall}>명예의 전당<Icon name="arrow"/></button>}
      <div className="vertical-result-actions"><button className="quiet-button" aria-label="처음으로" onClick={onHome}><Icon name="back"/><span className="wide-only">처음으로</span></button><button className="primary-button" disabled={starting||sync.state==='starting'||sync.blocked} onClick={onAgain}>{starting||sync.state==='starting'?'불러오는 중':'다시 하기'}<Icon name="arrow"/></button></div>
      <BlockSyncNotice sync={sync}/>
    </section>
  </main>;
}

// 그만하기 확인. 브라우저 기본 confirm은 일부 환경(앱 안 브라우저 등)에서 막혀 앱 안의 대화상자를 쓴다.
export function BlockStopDialog({open,onKeep,onStop}:{readonly open:boolean;readonly onKeep:()=>void;readonly onStop:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=dialog.current;if(!d)return;if(open&&!d.open)d.showModal();else if(!open&&d.open)d.close();},[open]);
  return <dialog ref={dialog} className="number-dialog arcade-panel block-stop-dialog" aria-labelledby="block-stop-title" onCancel={event=>{event.preventDefault();onKeep();}}>
    <div className="number-confirm-content"><h2 id="block-stop-title">여기까지 할까요?</h2><p className="spare-note">지금까지의 점수를 남겨요.</p>
    <div className="number-confirm-actions"><button className="quiet-button" autoFocus onClick={onKeep}>계속하기</button><button className="primary-button" onClick={onStop}>그만하기</button></div></div>
  </dialog>;
}
