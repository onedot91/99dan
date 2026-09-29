import { friendPixels, viewBoxFor } from '../game/friendArt';
export function FriendSprite({id,silhouette=false,fill=false,className=''}:{readonly id:string|null;readonly silhouette?:boolean;readonly fill?:boolean;readonly className?:string}){
  const runs=friendPixels(id,silhouette);
  if(!runs.length)return null;
  return <svg className={`friend-sprite ${className}`} viewBox={viewBoxFor(id,fill)} shapeRendering="crispEdges" aria-hidden="true">{runs.map(r=><rect key={`${r.y}:${r.x}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill}/>)}</svg>;
}
