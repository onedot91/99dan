import { useEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { HomeScreen } from './components/HomeScreen';
import { ComboMeter, PlayScreen } from './components/PlayScreen';
import { ResultScreen } from './components/ResultScreen';
import { RecordsScreen } from './components/RecordsScreen';
import { SetupScreen } from './components/SetupScreen';
import { useRushGame } from './game/useRushGame';
import { useGameAudio } from './game/useGameAudio';
import './screens.css';
import './results.css';
import './motion.css';
import './student.css';
import './hall.css';
import { HallScreen } from './components/HallScreen';
import { useSharedGame } from './cloud/useSharedGame';
import { StudentNumberScreen } from './components/StudentNumberScreen';
import { TeacherScreen } from './components/TeacherScreen';
import './teacher.css';
import { loadStudentNumber } from './game/studentNumber';
import { cloudConfigured } from './cloud/client';
import { useRunRewards } from './game/useRunRewards';
import { useFriends } from './game/useFriends';
import { FriendsScreen } from './components/FriendsScreen';
import './friends.css';
import { BACKGROUNDS, loadBackground, nextBackground, saveBackground } from './game/background';
export function App(){
  const [studentNumber,setStudentNumber]=useState(loadStudentNumber);
  const [teacherToken,setTeacherToken]=useState<string|null>(null);
  useEffect(()=>{
    const handleKeyDown=(event:KeyboardEvent)=>{
      if(studentNumber===null||teacherToken!==null||event.key!=='Enter'||!event.altKey||!event.metaKey||event.ctrlKey||event.shiftKey)return;
      event.preventDefault();
      setStudentNumber(null);
    };
    window.addEventListener('keydown',handleKeyDown);
    return ()=>window.removeEventListener('keydown',handleKeyDown);
  },[studentNumber,teacherToken]);
  return teacherToken?<TeacherScreen token={teacherToken} onExit={()=>{setTeacherToken(null);setStudentNumber(null);}}/>:studentNumber===null?<StudentNumberScreen onConfirm={setStudentNumber} onTeacher={setTeacherToken}/>:<GameApp studentNumber={studentNumber} onReselect={()=>setStudentNumber(null)}/>;
}
function GameApp({studentNumber,onReselect}:{readonly studentNumber:number;readonly onReselect:()=>void}){
  const g=useRushGame(!cloudConfigured);
  const cloud=useSharedGame(studentNumber,g);
  const rewards=useRunRewards(g,cloud.profile?.best);
  const friends=useFriends(studentNumber,g.totalCorrect,cloud);
  const audio=useGameAudio(g.run,g.screen,rewards?.newRecord?'record':rewards?.levelUp?'levelup':'finish');
  const [background,setBackground]=useState(()=>loadBackground(studentNumber));
  const backgroundLabel=BACKGROUNDS.find(b=>b.id===background)?.label;
  const changeBackground=()=>{const next=nextBackground(background);setBackground(next);saveBackground(studentNumber,next);};
  const content=useRef<HTMLDivElement>(null);
  const numberChangeClickCount=useRef(0);
  useEffect(()=>{content.current?.focus({preventScroll:true});},[g.screen]);
  useEffect(()=>{numberChangeClickCount.current=0;},[g.screen]);
  const timerSeconds=Math.ceil((g.run?.remaining??0)/1000);
  const headerTimer=g.screen==='play'&&g.run?.mode==='rush'?`${Math.floor(timerSeconds/60)}:${String(timerSeconds%60).padStart(2,'0')}`:null;
  const handleBrandClick=()=>{
    if(g.screen==='play'){g.end(true);return;}
    const next=numberChangeClickCount.current+1;
    if(next>=20){numberChangeClickCount.current=0;onReselect();return;}
    numberChangeClickCount.current=next;
  };
  return <div className={`app ${g.screen==='play'?'playing':''}`} data-bg={background} onClickCapture={event=>{if(event.target instanceof Element&&event.target.closest('button:not(.sound-button)'))audio.tap();}}>
    <header className="header">
      <button className="brand brand-button" aria-label={g.screen==='play'?'연습을 마치고 기록 보기':'번호 변경하려면 20번 누르기'} onClick={handleBrandClick}><span className="brand-mark">{cloud.profile?.avatar?<img src={cloud.profile.avatar} alt="" width="40" height="40"/>:<Icon name="bolt" size={24}/>}</span><span className="student-number">{studentNumber}번</span></button>
      {g.screen==='play'&&g.run&&<div className="header-status">
        <span className={`header-score score-display${g.run.phase==='wrong'?' wrong':''}${g.run.phase==='correct'?' gained':''}${g.run.phase==='wrong'&&g.run.penalty===0?' score-floor':''}`}>점수 <strong key={g.run.score}>{g.run.score.toLocaleString()}</strong>{g.run.phase==='correct'&&<em className="score-gain" key={g.run.answered} aria-hidden="true">{/^\+\d+/.exec(g.run.feedback)?.[0]}</em>}{g.run.phase==='wrong'&&g.run.penalty>0&&<em className="score-loss" key={g.run.answered} aria-hidden="true">-{g.run.penalty}</em>}</span>
        {headerTimer&&<div className="header-timer" role="timer" aria-label="남은 시간" aria-live="off"><Icon name="clock"/><span>{headerTimer}</span></div>}
        <ComboMeter run={g.run}/>
      </div>}
      <div className="header-actions">
        <button className="quiet-button sound-button" aria-label={!audio.available?'소리 사용 불가':audio.enabled?'소리 끄기':'소리 켜기'} aria-pressed={audio.enabled} disabled={!audio.available||audio.pending} onClick={()=>void audio.toggle()}><Icon name={audio.enabled?'sound':'muted'}/><span>{audio.enabled?'ON':'OFF'}</span></button>
        {g.screen!=='play'&&<button className="quiet-button background-button" aria-label={`배경 바꾸기, 지금 ${backgroundLabel}`} onClick={changeBackground}><Icon name="image"/><span>{backgroundLabel}</span></button>}
        {g.screen==='play'?<button className="quiet-button" onClick={()=>g.end(true)}><Icon name="close"/><span>끝내기</span></button>:g.screen==='home'?<button className="quiet-button" onClick={()=>g.setScreen('records')}><Icon name="chart"/><span>내 기록</span></button>:<button className="quiet-button" onClick={()=>g.setScreen('home')}><Icon name="back"/><span>처음으로</span></button>}
      </div>
    </header>
    <div className="screen-content" ref={content} tabIndex={-1} key={g.screen}>
      {g.screen==='home'&&(cloud.blocking?<main className="connection-screen">{cloud.state==='loading'?<p role="status">불러오는 중</p>:<button className="primary-button" onClick={()=>void cloud.reload()}>연결 재시도</button>}</main>:<HomeScreen game={g} friends={friends}/>)}
      {g.screen==='hall'&&<HallScreen ready={cloud.ready} studentNumber={studentNumber} initialDuration={g.run?.duration??g.duration}/>}
      {g.screen==='play'&&<PlayScreen game={g} partner={friends.partner}/>}
      {(g.screen==='tables'||g.screen==='weak')&&<SetupScreen game={g}/>}
      {g.screen==='result'&&<ResultScreen game={g} rewards={rewards} friends={friends} syncState={cloud.state} retrySave={cloud.retrySave}/>}
      {g.screen==='friends'&&<FriendsScreen friends={friends} onCelebrate={()=>audio.cue('friend')}/>}
      {g.screen==='records'&&<RecordsScreen game={g} best={cloud.profile?.best}/>}
    </div>
  </div>;
}
