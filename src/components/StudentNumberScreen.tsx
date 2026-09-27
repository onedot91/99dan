import { useEffect, useRef, useState } from 'react';
import { saveStudentNumber } from '../game/studentNumber';
import { teacherLogin } from '../cloud/client';
import { Icon } from './Icon';
export function StudentNumberScreen({onConfirm,onTeacher}:{readonly onConfirm:(number:number)=>void;readonly onTeacher:(token:string)=>void}){
  const [pending,setPending]=useState<number|null>(null);
  const [error,setError]=useState(false);
  const [teacherOpen,setTeacherOpen]=useState(false);
  const [code,setCode]=useState('');
  const [teacherError,setTeacherError]=useState('');
  const [checking,setChecking]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null);
  const teacherDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    if(pending!==null)dialog.current?.showModal();
    else dialog.current?.close();
  },[pending]);
  useEffect(()=>{if(teacherOpen)teacherDialog.current?.showModal();else teacherDialog.current?.close();},[teacherOpen]);
  const confirm=()=>{
    if(pending===null)return;
    if(saveStudentNumber(pending))onConfirm(pending);
    else setError(true);
  };
  const checkTeacher=async(event:React.FormEvent)=>{
    event.preventDefault();if(checking||!/^\d{4}$/.test(code))return;
    setChecking(true);setTeacherError('');
    try{const token=await teacherLogin(code);setCode('');setTeacherOpen(false);onTeacher(token);}
    catch(error){setTeacherError(error instanceof Error&&error.message==='CLOUD_429'?'잠시 뒤에 다시 시도해 주세요.':error instanceof Error&&error.message==='CLOUD_401'?'번호가 맞지 않습니다.':'연결을 확인하고 다시 시도해 주세요.');}
    finally{setChecking(false);}
  };
  return <div className="app">
    <header className="header"><div className="brand"><span className="brand-mark"><Icon name="bolt"/></span><span>곱셈 게임</span></div></header>
    <div className="screen-content"><main className="student-screen">
      <div className="screen-heading"><h1>번호 선택</h1></div>
      <div className="student-grid" aria-label="학생 번호">{Array.from({length:23},(_,i)=>i+1).map(number=><button key={number} aria-label={`${number}번`} onClick={()=>{setError(false);setPending(number);}}>{number}<span>번</span></button>)}</div>
      <button className="quiet-button teacher-entry" onClick={()=>{setCode('');setTeacherError('');setTeacherOpen(true);}}>교사 번호 입력</button>
    </main></div>
    <dialog ref={dialog} className="number-dialog arcade-panel" aria-labelledby="number-confirm-title" onCancel={()=>setPending(null)}>
      <div className="number-confirm-content"><span className="number-preview">{pending}번</span><h2 id="number-confirm-title">내 번호가 맞아?</h2>
      {error&&<p className="storage-error" role="alert">번호를 저장할 수 없어.<br/>브라우저 설정을 확인해 줘.</p>}
      <div className="number-confirm-actions"><button className="quiet-button" autoFocus onClick={()=>setPending(null)}>다시 고르기</button><button className="primary-button" onClick={confirm}>맞아, 시작!</button></div></div>
    </dialog>
    <dialog ref={teacherDialog} className="number-dialog arcade-panel" aria-labelledby="teacher-login-title" onCancel={()=>setTeacherOpen(false)}>
      <form className="number-confirm-content" onSubmit={event=>void checkTeacher(event)}>
        <h2 id="teacher-login-title">교사 번호</h2>
        <input className="teacher-code" type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" aria-label="교사 번호 4자리" value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,4))} autoFocus/>
        {teacherError&&<p className="storage-error" role="alert">{teacherError}</p>}
        <div className="number-confirm-actions"><button type="button" className="quiet-button" onClick={()=>setTeacherOpen(false)}>취소</button><button className="primary-button" disabled={checking||code.length!==4}>{checking?'확인 중':'들어가기'}</button></div>
      </form>
    </dialog>
  </div>;
}
