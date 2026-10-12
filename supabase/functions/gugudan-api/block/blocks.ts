// 블록 종목의 8×8 판. 블록은 회전하지 않고, 가로·세로 줄이 차면 지운다.
export const BOARD_SIZE=8;
export type Cell=readonly [row:number,col:number];
export type Shape={readonly id:string;readonly cells:readonly Cell[]};
// 칸 값 0은 빈칸, 1~7은 그 칸을 채운 블록의 색.
export type Board=readonly number[];
export const emptyBoard=():Board=>Array.from({length:BOARD_SIZE*BOARD_SIZE},()=>0);

const shape=(id:string,rows:readonly string[]):Shape=>({id,cells:rows.flatMap((line,row)=>[...line].flatMap((ch,col)=>ch==='#'?[[row,col] as Cell]:[]))});
// 블록 블라스트의 블록 구성(회전 없이 방향별로 따로): small 2·3칸 막대와 작은 ㄱ자, medium 2×2와 4칸 막대·L·J·T·S·Z, large 5칸 막대·큰 ㄴ자·2×3 직사각형·3×3.
// 1칸 블록은 일반 출제에 없고 판이 꽉 찼을 때 놓을 자리를 보장하는 대체 블록으로만 쓴다.
export const DOT=shape('dot',['#']);
export const SHAPES={
  small:[shape('h2',['##']),shape('v2',['#','#']),shape('h3',['###']),shape('v3',['#','#','#']),shape('c1',['##','#.']),shape('c2',['##','.#']),shape('c3',['#.','##']),shape('c4',['.#','##'])],
  medium:[shape('sq2',['##','##']),shape('h4',['####']),shape('v4',['#','#','#','#']),shape('l1',['#.','#.','##']),shape('l2',['##','.#','.#']),shape('l3',['###','#..']),shape('l4',['..#','###']),shape('j1',['.#','.#','##']),shape('j2',['###','..#']),shape('t1',['###','.#.']),shape('t2',['.#.','###']),shape('t3',['#.','##','#.']),shape('t4',['.#','##','.#']),shape('s1',['.##','##.']),shape('s2',['#.','##','.#']),shape('z1',['##.','.##']),shape('z2',['.#','##','#.'])],
  large:[shape('h5',['#####']),shape('v5',['#','#','#','#','#']),shape('L1',['#..','#..','###']),shape('L2',['###','..#','..#']),shape('L3',['###','#..','#..']),shape('L4',['..#','..#','###']),shape('r23',['###','###']),shape('r32',['##','##','##']),shape('sq3',['###','###','###'])],
} as const satisfies Record<string,readonly Shape[]>;
export const ALL_SHAPES:readonly Shape[]=[...SHAPES.small,...SHAPES.medium,...SHAPES.large,DOT];
export const shapeById=(id:string)=>ALL_SHAPES.find(s=>s.id===id);
export const BLOCK_COLORS=7;
// 모양마다 색을 정해 두어 같은 모양은 늘 같은 색이다.
export const shapeColor=(piece:Shape)=>ALL_SHAPES.findIndex(s=>s.id===piece.id)%BLOCK_COLORS+1;

// 갈수록 어렵게: 푼 문제 수에 따라 큰 블록 비중을 늘리고 놓을 자리 보장을 줄인다.
export type BlockTier={readonly small:number;readonly medium:number;readonly large:number;readonly guarantee:0|1|3};
// 처음부터 큰 블록도 섞어 다양하게 나오고, 갈수록 큰 블록이 늘고 놓을 자리 보장이 줄어든다.
export const BLOCK_TIERS={easy:3,normal:10,hard:20} as const;
export function blockTier(solved:number):BlockTier{
  if(solved<BLOCK_TIERS.easy)return {small:.4,medium:.4,large:.2,guarantee:3};
  if(solved<BLOCK_TIERS.normal)return {small:.3,medium:.4,large:.3,guarantee:3};
  if(solved<BLOCK_TIERS.hard)return {small:.25,medium:.4,large:.35,guarantee:1};
  const large=Math.min(.55,.4+(solved-BLOCK_TIERS.hard)*.01);
  return {small:.6-large,medium:.4,large,guarantee:0};
}

export const fits=(board:Board,piece:Shape,row:number,col:number)=>piece.cells.every(([r,c])=>{const y=row+r,x=col+c;return y>=0&&x>=0&&y<BOARD_SIZE&&x<BOARD_SIZE&&!board[y*BOARD_SIZE+x];});
export function fitsAnywhere(board:Board,piece:Shape):boolean{
  for(let row=0;row<BOARD_SIZE;row++)for(let col=0;col<BOARD_SIZE;col++)if(fits(board,piece,row,col))return true;
  return false;
}

export const BLOCK_CELL_POINTS=1,BLOCK_LINE_POINTS=20,BLOCK_MULTI_LINE_BONUS=10;
// cleared: 지워진 칸의 위치와 색(연출용). placed: 이번에 놓인 칸 위치.
export type Placement={readonly board:Board;readonly rows:readonly number[];readonly cols:readonly number[];readonly points:number;readonly placed:readonly number[];readonly cleared:readonly {readonly index:number;readonly color:number}[]};
export function place(board:Board,piece:Shape,row:number,col:number):Placement|null{
  if(!fits(board,piece,row,col))return null;
  const next=[...board];
  const color=shapeColor(piece);
  for(const [r,c] of piece.cells)next[(row+r)*BOARD_SIZE+col+c]=color;
  const lines=Array.from({length:BOARD_SIZE},(_,i)=>i);
  const rows=lines.filter(r=>lines.every(c=>next[r*BOARD_SIZE+c]));
  const cols=lines.filter(c=>lines.every(r=>next[r*BOARD_SIZE+c]));
  const gone=new Set([...rows.flatMap(r=>lines.map(c=>r*BOARD_SIZE+c)),...cols.flatMap(c=>lines.map(r=>r*BOARD_SIZE+c))]);
  const cleared=[...gone].sort((a,b)=>a-b).map(index=>({index,color:next[index]!}));
  for(const index of gone)next[index]=0;
  const lineCount=rows.length+cols.length;
  return {board:next,rows,cols,placed:piece.cells.map(([r,c])=>(row+r)*BOARD_SIZE+col+c),cleared,points:piece.cells.length*BLOCK_CELL_POINTS+lineCount*BLOCK_LINE_POINTS+Math.max(0,lineCount-1)*BLOCK_MULTI_LINE_BONUS};
}

// 초반 도우미: 처음 몇 문제는 확률적으로, 판에 거의 찬 줄이 있을 때만 그 줄을 지울 수 있는 블록이 섞인 묶음을 고른다.
// 매번 돕지 않고(확률이 문제마다 줄어듦) 묶음의 나머지 블록은 평소처럼 무작위라 학생이 알아채기 어렵다.
export const BLOCK_HELP=[.8,.75,.65,.55,.45] as const;
const HELP_CANDIDATES=8;
// 이 블록을 어디에 놓으면 가장 좋은지: 지우는 줄 수 × 100 + 가장 많이 찬 줄의 칸 수.
export function clearPotential(board:Board,piece:Shape):number{
  let best=-1;
  for(let row=0;row<BOARD_SIZE;row++)for(let col=0;col<BOARD_SIZE;col++){
    const result=place(board,piece,row,col);if(!result)continue;
    const lines=result.rows.length+result.cols.length;
    let fullest=0;
    if(!lines)for(let i=0;i<BOARD_SIZE;i++){let r=0,c=0;for(let j=0;j<BOARD_SIZE;j++){if(result.board[i*BOARD_SIZE+j])r++;if(result.board[j*BOARD_SIZE+i])c++;}fullest=Math.max(fullest,r,c);}
    best=Math.max(best,lines*100+(lines?BOARD_SIZE:fullest));
  }
  return best;
}
const nearlyFullLine=(board:Board)=>{for(let i=0;i<BOARD_SIZE;i++){let r=0,c=0;for(let j=0;j<BOARD_SIZE;j++){if(board[i*BOARD_SIZE+j])r++;if(board[j*BOARD_SIZE+i])c++;}if(r>=4||c>=4)return true;}return false;};

// 블록 3개를 뽑는다. 보장 수만큼은 지금 판 어딘가에 놓을 수 있는 블록이어야 한다.
export function drawPieces(random:()=>number,board:Board,solved:number):readonly Shape[]{
  const help=BLOCK_HELP[solved];
  if(help===undefined||!nearlyFullLine(board)||random()>=help)return drawSet(random,board,solved);
  let best:readonly Shape[]=[],bestScore=-1;
  for(let n=0;n<HELP_CANDIDATES;n++){
    const pieces=drawSet(random,board,solved),score=Math.max(...pieces.map(p=>clearPotential(board,p)));
    if(score>=100)return pieces;
    if(score>bestScore){best=pieces;bestScore=score;}
  }
  return best;
}
function drawSet(random:()=>number,board:Board,solved:number):readonly Shape[]{
  const tier=blockTier(solved),sample=()=>Math.min(1-Number.EPSILON,Math.max(0,random()));
  const draw=()=>{const roll=sample();const group=roll<tier.small?SHAPES.small:roll<tier.small+tier.medium?SHAPES.medium:SHAPES.large;return group[Math.floor(sample()*group.length)]!;};
  let best:Shape[]=[];
  for(let attempt=0;attempt<30;attempt++){
    const pieces=[draw(),draw(),draw()];
    const fitting=pieces.filter(p=>fitsAnywhere(board,p)).length;
    if(fitting>=tier.guarantee)return pieces;
    if(!best.length||fitting>best.filter(p=>fitsAnywhere(board,p)).length)best=pieces;
  }
  // 판이 너무 찼으면 보장해야 할 자리를 1칸 블록으로 채운다.
  let needed=tier.guarantee-best.filter(p=>fitsAnywhere(board,p)).length;
  return best.map(p=>needed>0&&!fitsAnywhere(board,p)?(needed--,DOT):p);
}
