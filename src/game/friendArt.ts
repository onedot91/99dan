import { friendById } from './friends.ts';
import type { Friend, Palette } from './friends.ts';
const FIXED:Readonly<Record<string,string>>={
  o:'#0b0a1f',w:'#fffdf3',e:'#1c1638',c:'#ff7a8a',y:'#ffd23f',h:'#fff3a3',s:'#232048',E:'#7df9ff',
  p:'#fff4d6',q:'#d9c49a',n:'#b77a45',N:'#7d4a22',f:'#ff9f1c',r:'#ff4d5e',b:'#4cc9ff',B:'#2766c7',
  l:'#7ed957',m:'#3f8f2a',v:'#7b5cff',V:'#4b33b0',
  K:'#e0304e',U:'#3b2a8f',j:'#e6dcff',J:'#b3a2f0'
};
export const SIZE=24;
function mix(hex:string,tint:string,amount:number){
  const a=Number.parseInt(hex.slice(1),16),b=Number.parseInt(tint.slice(1),16);
  const channel=(shift:number)=>Math.round(((a>>shift)&255)*(1-amount)+((b>>shift)&255)*amount);
  return `#${((channel(16)<<16)|(channel(8)<<8)|channel(0)).toString(16).padStart(6,'0')}`;
}
function paletteOf(friend:Friend):Palette{
  const base=friend.element?.palette??friend.family.palette;
  const aura=friend.aura;
  return aura?[mix(base[0],aura.tint,aura.amount),mix(base[1],aura.tint,aura.amount),mix(base[2],aura.tint,aura.amount)]:base;
}
const mirrorRow=(row:string)=>[...row].reverse().map(ch=>ch==='L'?'G':ch).join('');
type Layer={readonly map:readonly string[];readonly x:number;readonly y:number};
// Stage 1 babies peek out of a cracked eggshell: jagged top, cream shell, darker right side.
const EGG:readonly string[]=Array.from({length:6},(_,r)=>Array.from({length:18},(_,c)=>{
  const top=c%4===1||c%4===2?0:1;
  if(r<top)return '.';
  if(r===top||r===5||c===0||c===17)return 'o';
  return c>=13||(r===3&&c%5===2)?'q':'p';
}).join(''));
// Later stages fill more of the frame, so each evolution visibly grows (feet stay on one baseline).
const STAGE_PAD={1:10,2:6,3:3,4:0} as const;
// Early stages get extra padding so they read as smaller; `fill` drops it for tiny slots.
export function viewBoxFor(id:string|null,fill=false):string{
  const pad=fill?0:STAGE_PAD[friendById(id)?.tier??4];
  return `${-pad} ${-2*pad} ${SIZE+2*pad} ${SIZE+2*pad}`;
}
const span=(row:string)=>{const left=row.search(/[^.]/);return left<0?{left:0,right:15}:{left,right:row.length-1-[...row].reverse().join('').search(/[^.]/)};};
// Final forms only: eyes (2×2 eye blocks or pixels next to a highlight) start to glow.
function glowingEyes(body:readonly string[],eye:string):readonly string[]{
  const at=(x:number,y:number)=>body[y]?.[x]??'.';
  const isEye=(ch:string)=>ch==='e'||ch==='w'||ch==='E';
  const block=(x:number,y:number)=>[[0,0],[1,0],[0,1],[1,1]].every(([dx,dy])=>isEye(at(x+dx!,y+dy!)));
  return body.map((row,y)=>[...row].map((ch,x)=>{
    if(ch==='E')return eye;
    if(ch!=='e')return ch;
    const inBlock=block(x,y)||block(x-1,y)||block(x,y-1)||block(x-1,y-1);
    return inBlock||[at(x-1,y),at(x+1,y),at(x,y-1),at(x,y+1)].includes('w')?eye:ch;
  }).join(''));
}
// Final forms wear a cloak that flares out below the shoulders.
function cloak(body:readonly string[],fromRow:number,fill:string):Layer{
  const x0=(SIZE-16)/2,rows:string[]=[];
  for(let r=fromRow;r<body.length;r++){
    const s=span(body[r]??''),flare=Math.floor((r-fromRow)/3);
    const left=Math.max(0,x0+s.left-2-flare),right=Math.min(SIZE-1,x0+s.right+2+flare);
    rows.push(Array.from({length:SIZE},(_,x)=>x<left||x>right?'.':x===left||x===right||r===body.length-1?'o':fill).join(''));
  }
  return {map:rows,x:0,y:SIZE-body.length+fromRow};
}
// Back to front: cloak, tail and wings behind the body, then body, headwear, aura sparkles.
function layersOf(friend:Friend):readonly Layer[]{
  const plain=friend.family.half.map(row=>row+mirrorRow(row));
  const body=friend.aura?glowingEyes(plain,friend.aura.id==='star'?'y':'E'):plain;
  const y0=SIZE-body.length,x0=(SIZE-16)/2;
  // Headwear sits on the first solid row, skipping thin tips like horns, ears or antennae.
  const headRow=Math.max(0,body.findIndex(row=>row.replace(/\./g,'').length>=8));
  const layers:Layer[]=[];
  if(friend.aura)layers.push(cloak(body,headRow+Math.round((body.length-headRow)*.4),friend.aura.id==='star'?'K':'U'));
  if(friend.element){
    const r=Math.round(body.length*.62),tail=friend.element.tail;
    layers.push({map:tail,x:Math.min(SIZE-tail[0]!.length,x0+span(body[r]??'').right-1),y:y0+r-tail.length+2});
  }
  if(friend.form?.id==='wing'){
    const r=Math.round(body.length*.35),s=span(body[r]??''),art=friend.form.art;
    layers.push({map:art,x:Math.max(0,x0+s.left-art[0]!.length+3),y:y0+r-3},{map:art.map(mirrorRow),x:Math.min(SIZE-art[0]!.length,x0+s.right-2),y:y0+r-3});
  }
  layers.push({map:body,x:x0,y:y0});
  if(friend.form&&friend.form.id!=='wing'){
    const art=friend.form.art,width=art[0]?.length??0;
    layers.push({map:art,x:(SIZE-width)/2,y:Math.max(0,y0+headRow-art.length+1)});
  }
  if(friend.tier===1)layers.push({map:EGG,x:x0-1,y:SIZE-EGG.length});
  if(friend.aura)for(const [x,y] of (friend.aura.id==='star'?[[0,2],[21,4],[0,15]]:[[21,1],[21,13],[0,16]]) as readonly (readonly [number,number])[])layers.push({map:friend.aura.spark,x,y});
  return layers;
}
const sunburst=(x:number,y:number)=>{
  const dx=x+.5-SIZE/2,dy=y+.5-SIZE*.42,r=Math.hypot(dx,dy);
  if(r<8.5||r>12.5)return undefined;
  const off=Math.abs(((Math.atan2(dy,dx)*180/Math.PI)%45+45)%45-22.5);
  return off>16.5?(r<10.5?FIXED.y:FIXED.h):undefined;
};
const crescent=(x:number,y:number)=>{
  const outer=Math.hypot(x+.5-5.5,y+.5-6.5),inner=Math.hypot(x+.5-7.5,y+.5-5);
  return outer<=5&&inner>4?(outer>4?FIXED.J:FIXED.j):undefined;
};
export type PixelRun={readonly x:number;readonly y:number;readonly width:number;readonly fill:string};
// Composites a friend onto a SIZE×SIZE grid and returns horizontal color runs.
export function friendPixels(id:string|null,silhouette=false,silhouetteColor='currentColor'):readonly PixelRun[]{
  const friend=friendById(id);
  if(!friend)return [];
  const [light,base,shade]=paletteOf(friend);
  const color=(ch:string)=>silhouette?silhouetteColor:ch==='L'?light:ch==='g'?base:ch==='G'?shade:FIXED[ch];
  const grid:(string|undefined)[][]=Array.from({length:SIZE},()=>Array<string|undefined>(SIZE).fill(undefined));
  for(const layer of layersOf(friend))layer.map.forEach((row,j)=>[...row].forEach((ch,i)=>{
    const x=layer.x+i,y=layer.y+j,fill=ch==='.'?undefined:color(ch);
    if(fill&&x>=0&&x<SIZE&&y>=0&&y<SIZE)(grid[y] as (string|undefined)[])[x]=fill;
  }));
  // Legendary friends get a one-pixel glow traced around the whole silhouette.
  if(friend.aura&&!silhouette){
    const filled=(x:number,y:number)=>grid[y]?.[x]!==undefined;
    const glow=grid.map((row,y)=>row.map((c,x)=>c===undefined&&(filled(x-1,y)||filled(x+1,y)||filled(x,y-1)||filled(x,y+1))));
    glow.forEach((row,y)=>row.forEach((on,x)=>{if(on)(grid[y] as (string|undefined)[])[x]=friend.aura?.glow;}));
    // Behind everything: a sunburst for 별빛, a crescent moon for 달빛. Fills only empty pixels.
    const backdrop=friend.aura.id==='star'?sunburst:crescent;
    grid.forEach((row,y)=>row.forEach((c,x)=>{const fill=c===undefined?backdrop(x,y):undefined;if(fill)row[x]=fill;}));
  }
  const runs:PixelRun[]=[];
  grid.forEach((row,y)=>{
    for(let x=0;x<SIZE;){
      const fill=row[x];let end=x+1;
      while(end<SIZE&&row[end]===fill)end+=1;
      if(fill)runs.push({x,y,width:end-x,fill});
      x=end;
    }
  });
  return runs;
}
