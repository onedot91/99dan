import { useEffect, useRef, useState } from 'react';
import { saveStudentNumber } from '../game/studentNumber';
import { Icon } from './Icon';
export function StudentNumberScreen({onConfirm}:{readonly onConfirm:(number:number)=>void}){
  const [pending,setPending]=useState<number|null>(null);
  const [error,setError]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    if(pending!==null)dialog.current?.showModal();
    else dialog.current?.close();
  },[pending]);
  const confirm=()=>{
    if(pending===null)return;
    if(saveStudentNumber(pending))onConfirm(pending);
    else setError(true);
  };
  return <div className="app">
    <header className="header"><div className="brand"><span className="brand-mark"><Icon name="bolt"/></span><span>구구단 게임</span></div></header>
    <div className="screen-content"><main className="student-screen">
      <div className="screen-heading"><h1>번호 선택</h1></div>
      <div className="student-grid" aria-label="학생 번호">{Array.from({length:23},(_,i)=>i+1).map(number=><button key={number} aria-label={`${number}번`} onClick={()=>{setError(false);setPending(number);}}>{number}<span>번</span></button>)}</div>
    </main></div>
    <dialog ref={dialog} className="number-dialog arcade-panel" aria-labelledby="number-confirm-title" onCancel={()=>setPending(null)}>
      <div className="number-confirm-content"><span className="number-preview">{pending}번</span><h2 id="number-confirm-title">내 번호가 맞아?</h2>
      {error&&<p className="storage-error" role="alert">번호를 저장할 수 없어.<br/>브라우저 설정을 확인해 줘.</p>}
      <div className="number-confirm-actions"><button className="quiet-button" autoFocus onClick={()=>setPending(null)}>다시 고르기</button><button className="primary-button" onClick={confirm}>맞아, 시작!</button></div></div>
    </dialog>
  </div>;
}
