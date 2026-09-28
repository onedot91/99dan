import type { ReactElement } from 'react';
// Sprites are ASCII maps: each character is one pixel, '.' is transparent. Colors come from CSS tokens.
const TONES:Readonly<Record<string,string>>={
  o:'px-outline',w:'px-white',s:'px-screen',e:'px-glow',c:'px-coral',k:'px-ground',
  L:'px-mint-hi',g:'px-mint',G:'px-mint-lo',
  h:'px-gold-hi',y:'px-gold',Y:'px-gold-lo',
  f:'px-orange',r:'px-red',b:'px-blue',
  a:'px-silver',A:'px-silver-lo',n:'px-bronze',N:'px-bronze-lo'
};
export type SpriteMap=readonly string[];
export function SpriteLayer({map,x=0,y=0,className}:{readonly map:SpriteMap;readonly x?:number;readonly y?:number;readonly className?:string}){
  const runs:ReactElement[]=[];
  map.forEach((row,j)=>{
    for(let i=0;i<row.length;){
      const tone=row[i]??'.';let end=i+1;
      while(row[end]===tone)end+=1;
      const fill=TONES[tone];
      if(fill)runs.push(<rect key={`${j}:${i}`} className={fill} x={x+i} y={y+j} width={end-i} height={1}/>);
      i=end;
    }
  });
  return <g className={className}>{runs}</g>;
}
export const STAR:SpriteMap=[
  '....o....',
  '...oho...',
  'ooooyoooo',
  'ohhyyyyYo',
  '.ohyyyYo.',
  '..oyyYo..',
  '.oyYoYYo.',
  '.oYo.oYo.',
  '.oo...oo.'
];
export const FLAME:SpriteMap=[
  '...o....',
  '..oro...',
  '..ofro..',
  '.ofyfro.',
  '.ofyyfo.',
  'ofyhyyfo',
  'ofyhhyfo',
  '.ofyyfo.',
  '..oooo..'
];
export const CROWN:SpriteMap=[
  'o....o....o',
  'oyo.oyo.oyo',
  'oyyoyhyoyyo',
  'oyyyyyyyyYo',
  'oyryybyyrYo',
  'oYYYYYYYYYo',
  'ooooooooooo'
];
export function Sprite({map,className='',label}:{readonly map:SpriteMap;readonly className?:string;readonly label?:string}){
  const width=Math.max(...map.map(row=>row.length));
  return <svg className={`sprite ${className}`} viewBox={`0 0 ${width} ${map.length}`} shapeRendering="crispEdges" role={label?'img':undefined} aria-label={label} aria-hidden={label?undefined:true}><SpriteLayer map={map}/></svg>;
}
