// Early backgrounds come every level or two so new players unlock something soon; later ones are long goals,
// spaced further apart up to Lv.100, then every 15–25 levels up to Lv.200 and every 10 levels up to Lv.400.
export const BACKGROUNDS=[
  {id:'night',label:'밤',level:1},{id:'sunset',label:'노을',level:2},{id:'blossom',label:'벚꽃',level:3},
  {id:'forest',label:'숲',level:4},{id:'desert',label:'사막',level:6},{id:'ocean',label:'바다',level:8},
  {id:'snow',label:'눈',level:10},{id:'volcano',label:'화산',level:15},{id:'aurora',label:'오로라',level:20},
  {id:'space',label:'우주',level:30},{id:'firefly',label:'반딧불',level:35},{id:'crystal',label:'보석',level:42},
  {id:'gold',label:'황금',level:50},{id:'candy',label:'사탕',level:60},{id:'rainbow',label:'무지개',level:72},
  {id:'storm',label:'폭풍',level:85},{id:'heaven',label:'천상',level:100},
  {id:'deep',label:'심해',level:110},{id:'neon',label:'네온',level:125},{id:'cloud',label:'구름섬',level:140},
  {id:'nebula',label:'성운',level:155},{id:'clock',label:'시간',level:175},{id:'blackhole',label:'블랙홀',level:200},
  {id:'jungle',label:'정글',level:210},{id:'canyon',label:'협곡',level:220},{id:'lavender',label:'라벤더',level:230},
  {id:'glacier',label:'빙하',level:240},{id:'castle',label:'성',level:250},{id:'city',label:'도시',level:260},
  {id:'meteor',label:'유성',level:270},{id:'milkyway',label:'은하수',level:280},{id:'mushroom',label:'버섯',level:290},
  {id:'temple',label:'신전',level:300},{id:'dawn',label:'새벽',level:310},{id:'coral',label:'산호',level:320},
  {id:'planet',label:'행성',level:330},{id:'bamboo',label:'대나무',level:340},{id:'lantern',label:'등불',level:350},
  {id:'eclipse',label:'일식',level:360},{id:'portal',label:'차원문',level:370},{id:'prism',label:'프리즘',level:380},
  {id:'rune',label:'룬',level:390},{id:'infinity',label:'무한',level:400},
] as const;
export type BackgroundId=typeof BACKGROUNDS[number]['id'];
export type Background=typeof BACKGROUNDS[number];
// The picker shows one band at a time, named by its first level; each holds at most ten backgrounds.
export const BACKGROUND_TIERS=[1,35,110,210,310] as const;
export const tierOf=(level:number)=>BACKGROUND_TIERS.reduce((found,from,i)=>level>=from?i:found,0);
export const backgroundsInTier=(tier:number):readonly Background[]=>BACKGROUNDS.filter(b=>tierOf(b.level)===tier);
export const isUnlocked=(id:BackgroundId,level:number)=>level>=(BACKGROUNDS.find(b=>b.id===id)?.level??1);
// A per-device preference for each student number; losing it just falls back to night.
const storageKey=(n:number)=>`gugudan-rush.background.${n}`;
export function loadBackground(studentNumber:number):BackgroundId{
  try{
    const value=localStorage.getItem(storageKey(studentNumber));
    return BACKGROUNDS.find(b=>b.id===value)?.id??'night';
  }catch{return 'night';}
}
export function saveBackground(studentNumber:number,id:BackgroundId){
  try{localStorage.setItem(storageKey(studentNumber),id);}catch{/* storage may be unavailable; the choice lasts this visit */}
}
