import { useEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { HomeScreen } from './components/HomeScreen';
import { PlayScreen } from './components/PlayScreen';
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
import { loadStudentNumber } from './game/studentNumber';
export function App(){
  const [studentNumber,setStudentNumber]=useState(loadStudentNumber);
  return studentNumber===null?<StudentNumberScreen onConfirm={setStudentNumber}/>:<GameApp studentNumber={studentNumber} onReselect={()=>setStudentNumber(null)}/>;
}
function GameApp({studentNumber,onReselect}:{readonly studentNumber:number;readonly onReselect:()=>void}){
  const g=useRushGame();
  const cloud=useSharedGame(studentNumber,g);
  const audio=useGameAudio(g.run,g.screen);
  const content=useRef<HTMLDivElement>(null);
  const reselectClicks=useRef(0);
  useEffect(()=>{content.current?.focus({preventScroll:true});},[g.screen]);
  const handleBrandClick=()=>{
    if(g.screen==='play'){g.end(true);return;}
    reselectClicks.current+=1;
    if(reselectClicks.current<20)return;
    reselectClicks.current=0;onReselect();
  };
  return <div className={`app ${g.screen==='play'?'playing':''}`} onClickCapture={event=>{if(event.target instanceof Element&&event.target.closest('button:not(.sound-button)'))audio.tap();}}>
    <header className="header">
      <button className="brand brand-button" aria-label={g.screen==='play'?'연습을 마치고 기록 보기':'학생 프로필'} onClick={handleBrandClick}><span className="brand-mark">{cloud.profile?.avatar?<img src={cloud.profile.avatar} alt="" width="40" height="40"/>:<Icon name="bolt" size={24}/>}</span><span className="student-number">{studentNumber}번</span></button>
      <div className="header-actions">
        <button className="quiet-button sound-button" aria-label={!audio.available?'소리 사용 불가':audio.enabled?'소리 끄기':'소리 켜기'} aria-pressed={audio.enabled} disabled={!audio.available||audio.pending} onClick={()=>void audio.toggle()}><Icon name={audio.enabled?'sound':'muted'}/><span>{audio.enabled?'ON':'OFF'}</span></button>
        {g.screen==='play'?<button className="quiet-button" onClick={()=>g.end(true)}><Icon name="close"/><span>끝내기</span></button>:g.screen==='home'?<button className="quiet-button" onClick={()=>g.setScreen('records')}><Icon name="chart"/><span>내 기록</span></button>:<button className="quiet-button" onClick={()=>g.setScreen('home')}><Icon name="back"/><span>처음으로</span></button>}
      </div>
    </header>
    <div className="screen-content" ref={content} tabIndex={-1} key={g.screen}>
      {g.screen==='home'&&(cloud.blocking?<main className="connection-screen">{cloud.state==='loading'?<p role="status">불러오는 중</p>:<button className="primary-button" onClick={()=>void cloud.reload()}>연결 재시도</button>}</main>:<HomeScreen game={g}/>)}
      {g.screen==='hall'&&<HallScreen ready={cloud.ready} studentNumber={studentNumber}/>}
      {g.screen==='play'&&<PlayScreen game={g}/>}
      {(g.screen==='tables'||g.screen==='weak')&&<SetupScreen game={g}/>}
      {g.screen==='result'&&<ResultScreen game={g} syncState={cloud.state} retrySave={cloud.retrySave}/>}
      {g.screen==='records'&&<RecordsScreen game={g} best={cloud.profile?.best}/>}
    </div>
  </div>;
}
