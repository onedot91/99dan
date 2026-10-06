import { useState } from 'react';
import { AURAS, ELEMENTS, FAMILIES, FORMS, FRIENDS, MYTHS, TIER_LABEL, friendById, stepName } from '../game/friends';
import type { Friend } from '../game/friends';
import type { Friends } from '../game/useFriends';
import { FriendSprite } from './FriendSprite';
// 을/를 follows whether the last syllable has a final consonant.
const objectJosa=(name:string)=>{const code=name.charCodeAt(name.length-1)-0xac00;return code>=0&&code<11172&&code%28!==0?'을':'를';};
const Stars=({tier}:{readonly tier:number})=><span className="tier-stars" aria-label={`${tier}단계 ${TIER_LABEL[tier as 1|2|3|4|5]}`}>{'★'.repeat(tier)}<i>{'★'.repeat(5-tier)}</i></span>;
function PickView({friends,onPicked}:{readonly friends:Friends;readonly onPicked:(id:string)=>void}){
  const have=new Set(friends.owned);
  return <section className="friend-pick" aria-labelledby="friend-pick-title">
    <div className="screen-heading"><h1 id="friend-pick-title">{friends.owned.length?'새 펫을 골라요!':'첫 펫을 골라요!'}</h1><p className="friend-pick-count">남은 선택 <strong>{friends.pending}</strong>번</p></div>
    <div className="friend-offers">{friends.offers.map(f=>{const parent=friendById(f.parent);return <button key={f.id} className="friend-offer" onClick={()=>onPicked(f.id)}>
      <span className={`offer-tag ${f.tier===1?'new':'evolve'}`}>{f.tier===1?'새 펫':'진화'}</span>
      <FriendSprite id={f.id}/>
      <strong>{f.name}</strong>
      <Stars tier={f.tier}/>
      <small>{parent&&have.has(parent.id)?`${parent.name}에서 진화`:f.blurb}</small>
    </button>;})}</div>
  </section>;
}
function Reveal({id,more,onNext}:{readonly id:string;readonly more:boolean;readonly onNext:()=>void}){
  const f=friendById(id);if(!f)return null;
  return <section className="friend-reveal" role="status" aria-live="polite">
    <div className="reveal-stage"><FriendSprite id={id}/><span className="reveal-sparks" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i}/>)}</span></div>
    <h1>새 펫 <strong>{f.name}</strong>{objectJosa(f.name)} 만났어요!</h1>
    <p>{f.blurb}</p>
    <button className="primary-button" autoFocus onClick={onNext}>{more?'다음 펫 고르기':'펫 나무 보기'}</button>
  </section>;
}
function TreeView({friends,onPick}:{readonly friends:Friends;readonly onPick:()=>void}){
  const have=new Set(friends.owned);
  const [family,setFamily]=useState(()=>friendById(friends.partner)?.family.id??FAMILIES[0]?.id??'slime');
  const [element,setElement]=useState(()=>friendById(friends.partner)?.element?.id??ELEMENTS[0]?.id??'fire');
  const [selected,setSelected]=useState<string>(()=>friends.partner??family);
  // Stage 5 shows the two myths of one legend at a time: the last legend tapped, else the first one.
  const [legend,setLegend]=useState(()=>friends.partner?.split('.').slice(0,4).join('.')??'');
  const branch=legend.split('.').length===4&&legend.startsWith(`${family}.${element}.`)?legend:`${family}.${element}.${FORMS[0]?.id}.${AURAS[0]?.id}`;
  const open=(f:Friend)=>have.has(f.id)||(f.parent===null||have.has(f.parent));
  const node=(id:string)=>{
    const f=friendById(id);if(!f)return null;
    const state=have.has(id)?'owned':open(f)?'open':'locked';
    return <button key={id} className={`tree-node ${state}${friends.partner===id?' partner':''}${branch===id?' branch':''}${selected===id?' selected':''}`} aria-pressed={selected===id} aria-label={`${state==='locked'?'잠긴 펫':f.name}${state==='owned'?', 모음':state==='open'?', 고를 수 있음':''}`} onClick={()=>{setSelected(id);if(f.tier>=4)setLegend(id.split('.').slice(0,4).join('.'));}}>
      <span className="tree-art"><FriendSprite id={id} silhouette={state!=='owned'}/></span><small>{stepName(f)}</small>
    </button>;
  };
  const current=friendById(selected);
  const currentState=current?have.has(current.id)?'owned':open(current)?'open':'locked':'locked';
  return <div className="friend-tree-view">
    <section className="friend-detail" aria-live="polite">
      <p className="friend-total">모은 펫 <strong>{friends.owned.length}</strong> / {FRIENDS.length}</p>
      {current&&<>
        <div className={`friend-portrait ${currentState}`}><FriendSprite id={current.id} silhouette={currentState!=='owned'}/></div>
        <h2>{currentState==='locked'?'???':current.name}</h2>
        <Stars tier={current.tier}/>
        <p className="friend-blurb">{currentState==='owned'?current.blurb:currentState==='open'?'레벨 업하면 고를 수 있어요':(p=>p?`${p.name}${objectJosa(p.name)} 먼저 모아요`:'')(friendById(current.parent))}</p>
        {currentState==='owned'&&(friends.partner===current.id?<p className="partner-tag">함께 걷는 펫</p>:<button className="quiet-button" onClick={()=>friends.setPartner(current.id)}>함께 걷기</button>)}
      </>}
      {friends.pending>0&&<button className="primary-button friend-pick-button" onClick={onPick}>새 펫 고르기 ({friends.pending})</button>}
    </section>
    <section className="friend-tree" aria-label="펫 나무">
      <div className="family-tabs" role="group" aria-label="펫 종류">{FAMILIES.map(f=>{const count=friends.owned.filter(id=>id.split('.')[0]===f.id).length;return <button key={f.id} aria-pressed={family===f.id} aria-label={`${f.name} ${count}마리`} onClick={()=>{setFamily(f.id);setSelected(f.id);}}><FriendSprite id={f.id} silhouette={!have.has(f.id)} crop/><small>{count}</small></button>;})}</div>
      <div className="element-tabs" role="group" aria-label="속성">{ELEMENTS.map(e=>{const count=friends.owned.filter(id=>id.startsWith(`${family}.${e.id}`)).length;return <button key={e.id} aria-pressed={element===e.id} onClick={()=>{setElement(e.id);setSelected(`${family}.${e.id}`);}}>{e.name}<small>{count}</small></button>;})}</div>
      {/* Five stages, left to right. Each stage only adds one thing to the friend before it. */}
      <div className="stage-grid">
        {([1,2,3,4,5] as const).map(t=><p key={t} className="stage-head"><strong>{t}단계</strong><span> {TIER_LABEL[t]}</span></p>)}
        <div className="stage-col">{node(family)}</div>
        <div className="stage-col">{node(`${family}.${element}`)}</div>
        <div className="stage-col">{FORMS.map(form=>node(`${family}.${element}.${form.id}`))}</div>
        <div className="stage-col">{FORMS.map(form=><div key={form.id} className="stage-pair">{AURAS.map(a=>node(`${family}.${element}.${form.id}.${a.id}`))}</div>)}</div>
        <div className="stage-col">{MYTHS.map(m=>node(`${branch}.${m.id}`))}</div>
      </div>
    </section>
  </div>;
}
export function FriendsScreen({friends,onCelebrate}:{readonly friends:Friends;readonly onCelebrate:()=>void}){
  const [view,setView]=useState<'pick'|'tree'>(friends.pending>0?'pick':'tree');
  const [revealed,setRevealed]=useState<string|null>(null);
  return <main className="friends-screen">
    {friends.syncError&&<p className="storage-error" role="alert">펫을 저장하지 못했어요. 이 기기에는 남아 있어요.</p>}
    {revealed?<Reveal id={revealed} more={friends.pending>0} onNext={()=>{setRevealed(null);setView(friends.pending>0?'pick':'tree');}}/>
      :view==='pick'&&friends.pending>0?<PickView friends={friends} onPicked={id=>{friends.pick(id);onCelebrate();setRevealed(id);}}/>
      :<TreeView friends={friends} onPick={()=>setView('pick')}/>}
  </main>;
}
