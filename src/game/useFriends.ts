import { useEffect, useMemo, useRef, useState } from 'react';
import { saveFriends } from '../cloud/client';
import type { FriendState, SharedProfile } from '../cloud/types';
import { levelFor } from './learning';
import { FRIENDS, friendById, offersFor, sanitizeOwned } from './friends';
import { isSpare } from './studentNumber';
const EMPTY:FriendState={owned:[],partner:null};
const storageKey=(n:number)=>`gugudan-rush.friends.${n}`;
function readLocal(n:number):FriendState{
  if(isSpare(n)){
    // The spare number owns every pet; only the partner choice is remembered.
    const owned=FRIENDS.map(f=>f.id);
    try{const raw:unknown=JSON.parse(localStorage.getItem(storageKey(n))??'null');const partner=raw&&typeof raw==='object'&&'partner' in raw&&typeof raw.partner==='string'&&owned.includes(raw.partner)?raw.partner:owned[0]??null;return {owned,partner};}
    catch{return {owned,partner:owned[0]??null};}
  }
  try{
    const raw:unknown=JSON.parse(localStorage.getItem(storageKey(n))??'null');
    if(!raw||typeof raw!=='object'||!('owned' in raw)||!Array.isArray(raw.owned))return EMPTY;
    const owned=sanitizeOwned(raw.owned);
    const partner='partner' in raw&&typeof raw.partner==='string'&&owned.includes(raw.partner)?raw.partner:null;
    return {owned,partner};
  }catch{return EMPTY;}
}
function writeLocal(n:number,state:FriendState){try{localStorage.setItem(storageKey(n),JSON.stringify(state));}catch{/* storage may be unavailable; the server copy still counts */}}
// The server is the source of truth once it supports friends; until then picks live in this browser.
export function useFriends(studentNumber:number,totalCorrect:number,cloud:{readonly friendsSync:boolean;readonly profile:SharedProfile|null}){
  const [state,setState]=useState<FriendState>(()=>readLocal(studentNumber));
  const [syncError,setSyncError]=useState(false);
  const inFlight=useRef(0);
  // Saves go out one at a time and only the newest unsent state is kept, so an older save can never land last.
  const queued=useRef<FriendState|null>(null);
  const sending=useRef(false);
  const flush=async()=>{
    if(sending.current)return;
    sending.current=true;
    try{
      for(let next=queued.current;next;next=queued.current){
        queued.current=null;
        try{await saveFriends(studentNumber,next);}catch{setSyncError(true);}
      }
    }finally{sending.current=false;inFlight.current=0;}
  };
  const level=levelFor(totalCorrect).number;
  const persist=(next:FriendState)=>{
    setState(next);writeLocal(studentNumber,next);
    if(!cloud.friendsSync)return;
    inFlight.current+=1;setSyncError(false);
    queued.current=next;void flush();
  };
  const server=cloud.friendsSync?cloud.profile?.friends??null:null;
  useEffect(()=>{
    if(!server||inFlight.current>0)return;
    const local=readLocal(studentNumber);
    // Carry picks made before the server supported friends, if they still fit the level.
    if(!server.owned.length&&local.owned.length&&local.owned.length<=level){persist(local);return;}
    setState(server);writeLocal(studentNumber,server);
  },[server]);
  const pending=isSpare(studentNumber)?0:Math.max(0,level-state.owned.length);
  const offers=useMemo(()=>pending?offersFor(state.owned,studentNumber):[],[pending,state.owned,studentNumber]);
  const pick=(id:string)=>{
    if(!offers.some(f=>f.id===id))return;
    persist({owned:[...state.owned,id],partner:id});
  };
  const setPartner=(id:string)=>{if(state.owned.includes(id))persist({...state,partner:id});};
  return {owned:state.owned,partner:friendById(state.partner)?state.partner:null,pending,offers,pick,setPartner,syncError,shared:cloud.friendsSync};
}
export type Friends=ReturnType<typeof useFriends>;
