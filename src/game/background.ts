// Early backgrounds come every level or two so new players unlock something soon; later ones are long goals.
export const BACKGROUNDS=[
  {id:'night',label:'밤',level:1},{id:'sunset',label:'노을',level:2},{id:'blossom',label:'벚꽃',level:3},
  {id:'forest',label:'숲',level:4},{id:'desert',label:'사막',level:6},{id:'ocean',label:'바다',level:8},
  {id:'snow',label:'눈',level:10},{id:'volcano',label:'화산',level:15},{id:'aurora',label:'오로라',level:20},
  {id:'space',label:'우주',level:30},
] as const;
export type BackgroundId=typeof BACKGROUNDS[number]['id'];
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
