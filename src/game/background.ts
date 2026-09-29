export const BACKGROUNDS=[{id:'night',label:'밤'},{id:'sunset',label:'노을'},{id:'forest',label:'숲'},{id:'ocean',label:'바다'},{id:'snow',label:'눈'}] as const;
export type BackgroundId=typeof BACKGROUNDS[number]['id'];
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
export function nextBackground(id:BackgroundId):BackgroundId{
  return BACKGROUNDS[(BACKGROUNDS.findIndex(b=>b.id===id)+1)%BACKGROUNDS.length]?.id??'night';
}
