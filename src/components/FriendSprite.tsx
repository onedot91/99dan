import { friendPixels, viewBoxFor } from '../game/friendArt';
import type { PixelRun } from '../game/friendArt';
// `crop` frames just the drawn pixels (as a centred square), for small icons where empty rows would push the pet off-centre.
function cropBox(runs:readonly PixelRun[]):string{
  const left=Math.min(...runs.map(r=>r.x)),right=Math.max(...runs.map(r=>r.x+r.width));
  const top=Math.min(...runs.map(r=>r.y)),bottom=Math.max(...runs.map(r=>r.y+1));
  const size=Math.max(right-left,bottom-top);
  return `${(left+right-size)/2} ${(top+bottom-size)/2} ${size} ${size}`;
}
export function FriendSprite({id,silhouette=false,fill=false,crop=false,className=''}:{readonly id:string|null;readonly silhouette?:boolean;readonly fill?:boolean;readonly crop?:boolean;readonly className?:string}){
  const runs=friendPixels(id,silhouette);
  if(!runs.length)return null;
  return <svg className={`friend-sprite ${className}`} viewBox={crop?cropBox(runs):viewBoxFor(id,fill)} shapeRendering="crispEdges" aria-hidden="true">{runs.map(r=><rect key={`${r.y}:${r.x}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill}/>)}</svg>;
}
