// Friend tech tree: family (tier 1) → element (tier 2) → form (tier 3) → aura (tier 4) → myth (tier 5).
// 12 families × (1 + 4 + 4·3 + 4·3·2 + 4·3·2·2) = 1068 friends. Each level grants one pick.
export type Palette=readonly [light:string,base:string,shade:string];
type Family={readonly id:string;readonly name:string;readonly blurb:string;readonly palette:Palette;readonly half:readonly string[]};
type Branch={readonly id:string;readonly name:string;readonly blurb:string};
// Bodies are the left 8 columns; the right half is mirrored with highlights (L) turned to shade (G).
export const FAMILIES:readonly Family[]=[
  {id:'slime',name:'슬라임',blurb:'말랑말랑 통통 튀어요',palette:['#b4f5c8','#5ee08a','#2a9d5c'],half:[
    '......oo','....ooLL','...oLLgg','..oLgggg','.oLggggg','.oLgwegg','oLggeegg','oLgggggg','oLgcgggg','oLGggggg','.oGGgggg','..oooooo']},
  {id:'robot',name:'로봇',blurb:'삐빅! 계산은 맡겨요',palette:['#dfe8f5','#9fb4d8','#5b6f96'],half:[
    '.......o','......oy','.......o','..oooooo','.oLLLLLL','.oLooooo','.oLossss','.oLosEss','.oLosEss','.oLossss','.oLooooo','.oGGgggg','..oooooo','...oLgyy','...oLggg','...ooooo']},
  {id:'dragon',name:'드래곤',blurb:'작지만 용감해요',palette:['#d9b8ff','#a878ff','#6a44c2'],half:[
    '.o......','.oyo....','..oyoooo','...oLLLL','..oLgggg','.oLggggg','.oLgwegg','.oLgeegg','.oLggggg','.oLcgggg','..oLgggg','...oLggg','..oLgyyy','.oLggyyy','.oLgoyyy','..oooooo']},
  {id:'bird',name:'짹짹이',blurb:'노래하며 날아요',palette:['#bfeaff','#4cc9ff','#2766c7'],half:[
    '.......o','......oL','...ooooL','..oLLLLg','.oLggggg','.oLgwegg','oLggeegg','oLggggyy','oLgggggy','oLgggggg','.oGGgggg','..oooooo','....oyo.']},
  {id:'cat',name:'고양이',blurb:'살금살금 호기심 대장',palette:['#ffd6a0','#ff9f43','#c2641c'],half:[
    '.o......','.oo.....','.oco....','.occo...','.occLooo','.oLLLLLL','.oLggggg','oLgggggg','oLgweggg','oLgeeggg','eeeggggc','oLeggogo','.oLgggog','..oLgggg','.oLggggg','.oLgoggg','..oooooo']},
  {id:'ghost',name:'유령',blurb:'부끄럼을 많이 타요',palette:['#ffffff','#e4e0ff','#9f98d6'],half:[
    '.....ooo','...ooLLL','..oLLggg','.oLggggg','.oLgeegg','.oLgeegg','oLgggggg','oLgcgggg','oLgggggo','oLgggggg','oLgggggg','oGGgGGgG','o.oo.oo.']},
  {id:'mushroom',name:'버섯',blurb:'비 오는 날 쑥쑥 자라요',palette:['#ffb3b3','#ff5b5b','#b8324a'],half:[
    '.....ooo','...ooLLL','..oLgppg','.oLgppgg','.oLggggp','oLppgggg','oGgggggg','oooooooo','...opppp','...opwep','...opeep','...opcpp','...opqqq','....oooo']},
  {id:'turtle',name:'거북이',blurb:'느려도 끝까지 가요',palette:['#a8f0e0','#3cc8a8','#1f8a70'],half:[
    '.....ooo','....oLLL','....oweg','....oeeg','....oggg','..oooooo','.onnnnnn','onnNnnnN','onNnnnNn','onnnnnnn','oyyyyyyy','.oLgo...','.oooo...']},
  // Later families: round ears, tentacles, a horn and flippers keep every silhouette distinct,
  // and chocolate, magenta, lemon and navy are colours no earlier family uses.
  {id:'bear',name:'곰',blurb:'든든하게 안아 줘요',palette:['#d9a07a','#8d5a3b','#5a3420'],half:[
    '.ooo....','oLLgo...','oLcgoooo','.ooLLLLL','.oLggggg','oLgggggg','oLgweggg','oLgeeggp','oLggggpp','oLcggppe','oLgggppp','.oLggggg','.oLgpppp','.oLgpppp','..oLgggg','..oLggo.','..ooooo.']},
  {id:'octopus',name:'문어',blurb:'여덟 팔로 척척 풀어요',palette:['#ffb8ec','#ff5fcf','#b8288c'],half:[
    '....oooo','..ooLLLL','.oLLgggg','oLgggggg','oLgggggg','oLgweggg','oLgeeggg','oLcggggg','.oLggggg','..oLgggg','.oLgogLg','oLgo.oLg','oLo..oLg','.o...ooo']},
  {id:'unicorn',name:'유니콘',blurb:'반짝반짝 꿈을 꿔요',palette:['#fff6c2','#ffe066','#d6a514'],half:[
    '.......o','......op','...o..oq','..oLo.op','.ooLLooL','oroLgggg','ofoLgggg','oyLgwegg','olLgeegg','obLggggg','ovLcgggg','.oLgggpp','..oLgpep','...oLppp','....oooo']},
  {id:'penguin',name:'펭귄',blurb:'추워도 씩씩해요',palette:['#8a9ad0','#3d4a80','#232a52'],half:[
    '.....ooo','...ooLLL','..oLgggg','.oLggwww','.oLgwwew','.oLgweew','.oLgwwoo','.oLggwof','o.oLgwwo','ogoLgwww','ogoLgwww','.ooLgwww','..oLgwww','..oLggww','..offooo','..ooo...']}
];
export const ELEMENTS:readonly (Branch&{readonly palette:Palette;readonly tail:readonly string[]})[]=[
  {id:'fire',name:'불꽃',blurb:'뜨거운 열정',palette:['#ffd0a0','#ff7a3c','#c23a1c'],tail:['...o..','..ofo.','.ofyfo','ofyhfo','ofyfo.','offo..','oo....']},
  {id:'water',name:'물결',blurb:'시원한 집중력',palette:['#c0f0ff','#3ca8ff','#1d5fc2'],tail:['....oo','...obo','..obbo','.obwbo','obbbBo','.ooooo']},
  {id:'leaf',name:'새싹',blurb:'쑥쑥 자라는 힘',palette:['#d4f7a0','#7ed957','#3f8f2a'],tail:['...ooo','..ollo','.ollmo','ollmo.','olmo..','oo....']},
  {id:'bolt',name:'번개',blurb:'번쩍 빠른 머리',palette:['#fff6a8','#ffd23f','#c7900a'],tail:['..ooo.','.oyyo.','.oyo..','oyyyyo','..oyo.','.oyo..','.oo...']}
];
export const FORMS:readonly (Branch&{readonly art:readonly string[]})[]=[
  {id:'wing',name:'날개',blurb:'하늘을 날아요',art:['.....ooo','...ooppo','..oppppo','.opppqqo','oppqqqqo','.oqqqqo.','..ooooo.']},
  {id:'crown',name:'왕관',blurb:'반짝이는 왕관',art:['o..oo..o','oyoyyoyo','oyyhhyyo','oooooooo']},
  {id:'wizard',name:'마법',blurb:'마법 모자를 썼어요',art:['....oo....','...ovvo...','..ovvvvo..','..ovhhvo..','.ovvvvvvo.','oooooooooo']}
];
export const AURAS:readonly (Branch&{readonly tint:string;readonly amount:number;readonly glow:string;readonly spark:readonly string[]})[]=[
  {id:'star',name:'별빛',blurb:'별처럼 빛나요',tint:'#ffffff',amount:.28,glow:'#ffd23f',spark:['.h.','hyh','.h.']},
  {id:'moon',name:'달빛',blurb:'밤하늘을 닮았어요',tint:'#6a4cff',amount:.18,glow:'#b39bff',spark:['.v.','vVv','.v.']}
];
// Tier 5 adds one more layer on top of a legend: a halo with feathered wings, or a planet ring with moons.
export const MYTHS:readonly (Branch&{readonly glow:string})[]=[
  {id:'angel',name:'천사',blurb:'하늘의 고리를 받았어요',glow:'#fffdf3'},
  {id:'cosmos',name:'우주',blurb:'행성을 거느렸어요',glow:'#7df9ff'}
];
export type Friend={
  readonly id:string;readonly parent:string|null;readonly tier:1|2|3|4|5;readonly name:string;readonly blurb:string;
  readonly family:Family;readonly element:(typeof ELEMENTS)[number]|null;readonly form:(typeof FORMS)[number]|null;readonly aura:(typeof AURAS)[number]|null;
  readonly myth:(typeof MYTHS)[number]|null;
};
export const FRIENDS:readonly Friend[]=FAMILIES.flatMap(family=>{
  const base:Friend={id:family.id,parent:null,tier:1,name:family.name,blurb:family.blurb,family,element:null,form:null,aura:null,myth:null};
  return [base,...ELEMENTS.flatMap(element=>{
    const second:Friend={...base,id:`${family.id}.${element.id}`,parent:family.id,tier:2,name:`${element.name} ${family.name}`,blurb:element.blurb,element};
    return [second,...FORMS.flatMap(form=>{
      const third:Friend={...second,id:`${second.id}.${form.id}`,parent:second.id,tier:3,name:`${form.name} ${second.name}`,blurb:form.blurb,form};
      return [third,...AURAS.flatMap(aura=>{
        const fourth:Friend={...third,id:`${third.id}.${aura.id}`,parent:third.id,tier:4,name:`${aura.name} ${third.name}`,blurb:aura.blurb,aura};
        return [fourth,...MYTHS.map(myth=>({...fourth,id:`${fourth.id}.${myth.id}`,parent:fourth.id,tier:5 as const,name:`${myth.name} ${fourth.name}`,blurb:myth.blurb,myth}))];
      })];
    })];
  })];
});
const BY_ID=new Map(FRIENDS.map(f=>[f.id,f]));
export const friendById=(id:string|null|undefined)=>id?BY_ID.get(id)??null:null;
export const TIER_LABEL={1:'아기',2:'속성',3:'변신',4:'전설',5:'신화'} as const;
// The part a stage adds, e.g. 불꽃 / 날개 / 별빛 / 천사; the full name stacks all of them.
export const stepName=(f:Friend)=>f.myth?.name??f.aura?.name??f.form?.name??f.element?.name??f.family.name;
// Only keep ids that exist and whose parent is also kept, so a bad save can't break the tree.
export function sanitizeOwned(ids:readonly unknown[]):readonly string[]{
  const kept:string[]=[];
  for(const id of ids)if(typeof id==='string'&&!kept.includes(id)){const f=BY_ID.get(id);if(f&&(f.parent===null||kept.includes(f.parent)))kept.push(id);}
  return kept;
}
function rng(seed:number){
  let a=seed>>>0;
  return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function shuffle<T>(items:readonly T[],next:()=>number):T[]{
  const out=[...items];
  for(let i=out.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[out[i],out[j]]=[out[j] as T,out[i] as T];}
  return out;
}
// Three choices, seeded by student and pick count so a refresh can't reroll them:
// up to two evolutions of different friends plus one new family when possible.
export function offersFor(owned:readonly string[],studentNumber:number):readonly Friend[]{
  const have=new Set(owned);
  const next=rng(studentNumber*7919+owned.length*104729+17);
  const frontier=FRIENDS.filter(f=>!have.has(f.id)&&(f.parent===null||have.has(f.parent)));
  const fresh=shuffle(frontier.filter(f=>f.tier===1),next);
  if(!owned.length)return fresh.slice(0,3);
  const evolutions=shuffle(frontier.filter(f=>f.tier>1),next);
  const picks:Friend[]=[];
  for(const f of evolutions)if(picks.length<2&&!picks.some(p=>p.parent===f.parent))picks.push(f);
  if(fresh[0])picks.push(fresh[0]);
  for(const f of [...evolutions,...fresh])if(picks.length<3&&!picks.includes(f))picks.push(f);
  return picks;
}
