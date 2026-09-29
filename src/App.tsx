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
import { isSpare, loadStudentNumber, numberLabel } from './game/studentNumber';
import { cloudConfigured } from './cloud/client';
import { bestBefore, useRunRewards } from './game/useRunRewards';
import { useFriends } from './game/useFriends';
import { FriendsScreen } from './components/FriendsScreen';
import './friends.css';
import './mobile.css';
import { BACKGROUNDS, isUnlocked, loadBackground, saveBackground } from './game/background';
import { BackgroundPicker } from './components/BackgroundPicker';
import { levelFor } from './game/learning';
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
  const g=useRushGame(!cloudConfigured||isSpare(studentNumber));
  const cloud=useSharedGame(studentNumber,g);
  const rewards=useRunRewards(g,cloud.profile?.best);
  const friends=useFriends(studentNumber,g.totalCorrect,cloud);
  const audio=useGameAudio(g.run,g.screen,rewards?.newRecord?'record':rewards?.levelUp?'levelup':'finish');
  const [savedBackground,setBackground]=useState(()=>loadBackground(studentNumber));
  // The spare number has every background unlocked.
  const level=isSpare(studentNumber)?Infinity:levelFor(g.totalCorrect).number;
  // A background above the current level (e.g. after a teacher reset) falls back to night.
  const background=isUnlocked(savedBackground,level)?savedBackground:'night';
  const changeBackground=(id:typeof background)=>{setBackground(id);saveBackground(studentNumber,id);};
  // Backgrounds this run's level-up opened (the spare number already has them all).
  const unlockedNow=rewards?.levelUp&&!isSpare(studentNumber)?BACKGROUNDS.filter(b=>b.level>rewards.levelBefore.number&&b.level<=rewards.levelAfter.number).map(b=>b.id):[];
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
      <button className="brand brand-button" aria-label={g.screen==='play'?'연습을 마치고 기록 보기':'번호 변경하려면 20번 누르기'} onClick={handleBrandClick}><span className="brand-mark">{cloud.profile?.avatar?<img src={cloud.profile.avatar} alt="" width="40" height="40"/>:<Icon name="bolt" size={24}/>}</span><span className="student-number">{numberLabel(studentNumber)}</span></button>
      {g.screen==='play'&&g.run&&<div className="header-status">
        <span className={`header-score score-display${g.run.phase==='wrong'?' wrong':''}${g.run.phase==='correct'?' gained':''}${g.run.phase==='wrong'&&g.run.penalty===0?' score-floor':''}`}><span className="score-word">점수</span> <strong key={g.run.score}>{g.run.score.toLocaleString()}</strong>{g.run.phase==='correct'&&<em className="score-gain" key={g.run.answered} aria-hidden="true">{/^\+\d+/.exec(g.run.feedback)?.[0]}</em>}{g.run.phase==='wrong'&&g.run.penalty>0&&<em className="score-loss" key={g.run.answered} aria-hidden="true">-{g.run.penalty}</em>}</span>
        {headerTimer&&<div className="header-timer" role="timer" aria-label="남은 시간" aria-live="off"><Icon name="clock"/><span>{headerTimer}</span></div>}
        <ComboMeter run={g.run}/>
      </div>}
      <div className="header-actions">
        <button className="quiet-button sound-button" aria-label={!audio.available?'소리 사용 불가':audio.enabled?'소리 끄기':'소리 켜기'} aria-pressed={audio.enabled} disabled={!audio.available||audio.pending} onClick={()=>void audio.toggle()}><Icon name={audio.enabled?'sound':'muted'}/><span className="wide-only">{audio.enabled?'ON':'OFF'}</span></button>
        {g.screen!=='play'&&<BackgroundPicker value={background} level={level} onChange={changeBackground}/>}
        {g.screen==='play'?<button className="quiet-button end-button" onClick={()=>g.end(true)}><Icon name="close"/><span>끝내기</span></button>:g.screen==='home'?<button className="quiet-button" aria-label="내 기록" onClick={()=>g.setScreen('records')}><Icon name="chart"/><span className="wide-only">내 기록</span></button>:<button className="quiet-button home-button" aria-label="처음으로" onClick={()=>g.setScreen('home')}><Icon name="back"/><span className="wide-only">처음으로</span></button>}
      </div>
    </header>
    <div className="screen-content" ref={content} tabIndex={-1} key={g.screen}>
      {g.screen==='home'&&(cloud.blocking?<main className="connection-screen">{cloud.state==='loading'?<p role="status">불러오는 중</p>:<button className="primary-button" onClick={()=>void cloud.reload()}>연결 재시도</button>}</main>:<HomeScreen game={g} friends={friends} studentNumber={studentNumber}/>)}
      {g.screen==='hall'&&<HallScreen ready={cloud.ready} studentNumber={studentNumber} initialDuration={g.run?.duration??g.duration}/>}
      {g.screen==='play'&&<PlayScreen game={g} partner={friends.partner} best={bestBefore(g,cloud.profile?.best)}/>}
      {(g.screen==='tables'||g.screen==='weak')&&<SetupScreen game={g}/>}
      {g.screen==='result'&&<ResultScreen game={g} rewards={rewards} friends={friends} syncState={cloud.state} retrySave={cloud.retrySave} unlocked={unlockedNow} onUseBackground={changeBackground}/>}
      {g.screen==='friends'&&<FriendsScreen friends={friends} onCelebrate={()=>audio.cue('friend')}/>}
      {g.screen==='records'&&<RecordsScreen game={g} best={cloud.profile?.best}/>}
    </div>
  </div>;
}
