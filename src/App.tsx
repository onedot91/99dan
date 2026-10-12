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
import type { HallPart } from './components/HallScreen';
import { useSharedGame } from './cloud/useSharedGame';
import { StudentNumberScreen } from './components/StudentNumberScreen';
import { TeacherScreen } from './components/TeacherScreen';
import { loadTeacherMode, saveTeacherMode } from './game/teacherDevice';
import './teacher.css';
import { isSpare, loadStudentNumber, numberLabel } from './game/studentNumber';
import { cloudConfigured } from './cloud/client';
import { bestBefore, useRunRewards } from './game/useRunRewards';
import { useFriends } from './game/useFriends';
import { FriendsScreen } from './components/FriendsScreen';
import './friends.css';
import { BACKGROUNDS, isUnlocked, loadBackground, saveBackground } from './game/background';
import { BackgroundPicker } from './components/BackgroundPicker';
import { levelFor } from './game/learning';
import { useVerticalGame } from './game/useVerticalGame';
import { VerticalPlay, VerticalProgress, VerticalResult, VerticalSetup } from './components/VerticalScreen';
import { useVerticalAssignment } from './cloud/useVerticalAssignment';
import { useVerticalSync } from './cloud/useVerticalSync';
import { validVerticalCount } from './game/verticalSets';
import type { VerticalCount } from './game/verticalSets';
import { useBlockGame } from './game/useBlockGame';
import { useBlockSync } from './cloud/useBlockSync';
import { BlockPlay, BlockProgress, BlockResult, BlockStopDialog } from './components/BlockScreen';
import './vertical.css';
import './block.css';
import './mobile.css';
export function App(){
  const [studentNumber,setStudentNumber]=useState(loadStudentNumber);
  const [teacher,setTeacher]=useState(loadTeacherMode);
  const openTeacher=(on:boolean)=>{saveTeacherMode(on);setTeacher(on);};
  useEffect(()=>{
    const handleKeyDown=(event:KeyboardEvent)=>{
      if(studentNumber===null||teacher||event.key!=='Enter'||!event.altKey||!event.metaKey||event.ctrlKey||event.shiftKey)return;
      event.preventDefault();
      setStudentNumber(null);
    };
    window.addEventListener('keydown',handleKeyDown);
    return ()=>window.removeEventListener('keydown',handleKeyDown);
  },[studentNumber,teacher]);
  return teacher?<TeacherScreen onExit={()=>{openTeacher(false);setStudentNumber(null);}}/>:studentNumber===null?<StudentNumberScreen onConfirm={setStudentNumber} onTeacher={()=>openTeacher(true)}/>:<GameApp studentNumber={studentNumber} onReselect={()=>setStudentNumber(null)}/>;
}
function GameApp({studentNumber,onReselect}:{readonly studentNumber:number;readonly onReselect:()=>void}){
  const g=useRushGame(!cloudConfigured||isSpare(studentNumber));
  const cloud=useSharedGame(studentNumber,g);
  // 두 자리 수·블록은 서버가 계산한 경험치(끝낸 문제당 20)를 구구단 정답 수에 더한다.
  const serverExp=(cloud.profile?.verticalExp??0)+(cloud.profile?.blockExp??0);
  const exp=g.totalCorrect+serverExp;
  const rewards=useRunRewards(g,cloud.profile?.best,serverExp);
  const friends=useFriends(studentNumber,exp,cloud);
  const audio=useGameAudio(g.run,g.screen,rewards?.newRecord?'record':rewards?.levelUp?'levelup':'finish');
  const vertical=useVerticalGame(studentNumber);
  const block=useBlockGame(studentNumber);
  const assignment=useVerticalAssignment(studentNumber);
  const verticalSync=useVerticalSync(studentNumber,vertical.session);
  // A saved two-digit run adds experience on the server; reload the profile so the level catches up.
  const reloadProfile=cloud.reload;
  useEffect(()=>{if(verticalSync.state==='saved')void reloadProfile();},[verticalSync.state,reloadProfile]);
  const blockSync=useBlockSync(studentNumber);
  useEffect(()=>{if(blockSync.state==='saved')void reloadProfile();},[blockSync.state,reloadProfile]);
  const [hallPart,setHallPart]=useState<HallPart>('rush');
  useEffect(()=>{if(g.screen==='play')setHallPart('rush');},[g.screen]);
  const blockPlaying=g.screen==='block-play';
  const verticalPlaying=g.screen==='vertical-play'||blockPlaying;
  const verticalScreen=g.screen.startsWith('vertical-')||g.screen.startsWith('block-');
  const currentScreen=useRef(g.screen);
  currentScreen.current=g.screen;
  const [verticalStarting,setVerticalStarting]=useState(false);
  const verticalStartPending=useRef(false);
  const startVertical=async(count:VerticalCount=5)=>{
    if(verticalStartPending.current||verticalSync.blocked)return;
    verticalStartPending.current=true;setVerticalStarting(true);
    const startingScreen=g.screen;
    try{
      const difficulty=await assignment.reload();if(difficulty===null||currentScreen.current!==startingScreen)return;
      const id=crypto.randomUUID();const assigned=await verticalSync.begin(id,difficulty,count);if(assigned===null||currentScreen.current!==startingScreen)return;
      vertical.start(assigned.difficulty,assigned.id,assigned.questions,assigned.timeScoring,assigned.manualZero,assigned.tightTime,assigned.cellScoring);g.setScreen('vertical-play');
    }finally{verticalStartPending.current=false;setVerticalStarting(false);}
  };
  const exitVertical=()=>{vertical.exit();g.setScreen('home');};
  const [blockStarting,setBlockStarting]=useState(false);
  const startBlock=async()=>{
    // 블록은 시범 운영 중이라 예비 번호에서만 시작한다.
    if(blockStarting||!isSpare(studentNumber))return;
    setBlockStarting(true);
    const startingScreen=g.screen;
    try{const seed=await blockSync.begin();if(seed===null||currentScreen.current!==startingScreen)return;block.start(seed);g.setScreen('block-play');}
    finally{setBlockStarting(false);}
  };
  // 그만하기: 확인한 뒤 그때까지의 점수로 결과를 보여 준다.
  // 그만하기: 앱 안의 확인 창에서 확인하면 그때까지의 점수로 결과를 보여 준다.
  const [stopAsk,setStopAsk]=useState(false);
  const stopBlock=()=>setStopAsk(true);
  useEffect(()=>{if(!blockPlaying)setStopAsk(false);},[blockPlaying]);
  const blockOver=block.run?.phase==='over';
  // 끝난 판(막힘·그만하기)의 입력 기록을 서버로 보낸다. finish는 판마다 한 번만 보낸다.
  useEffect(()=>{if(blockPlaying&&blockOver&&block.run)blockSync.finish(block.run);},[blockPlaying,blockOver]);
  useEffect(()=>{if(blockPlaying&&blockOver){const stuck=block.run?.ended==='stuck';audio.cue(stuck?'gameover':'finish');const t=window.setTimeout(()=>g.setScreen('block-result'),stuck?1600:0);return()=>window.clearTimeout(t);}return undefined;},[blockPlaying,blockOver]);
  const [savedBackground,setBackground]=useState(()=>loadBackground(studentNumber));
  // The spare number has every background unlocked.
  const level=isSpare(studentNumber)?Infinity:levelFor(exp).number;
  // A background above the current level (e.g. after a teacher reset) falls back to night.
  const background=isUnlocked(savedBackground,level)?savedBackground:'night';
  const changeBackground=(id:typeof background)=>{setBackground(id);saveBackground(studentNumber,id);};
  // Backgrounds this run's level-up opened (the spare number already has them all).
  const unlockedNow=rewards?.levelUp&&!isSpare(studentNumber)?BACKGROUNDS.filter(b=>b.level>rewards.levelBefore.number&&b.level<=rewards.levelAfter.number).map(b=>b.id):[];
  const content=useRef<HTMLDivElement>(null);
  const numberChangeClickCount=useRef(0);
  useEffect(()=>{if(!verticalPlaying)content.current?.focus({preventScroll:true});},[g.screen]);
  useEffect(()=>{numberChangeClickCount.current=0;},[g.screen]);
  const timerSeconds=Math.ceil((g.run?.remaining??0)/1000);
  const headerTimer=g.screen==='play'&&g.run?.mode==='rush'?`${Math.floor(timerSeconds/60)}:${String(timerSeconds%60).padStart(2,'0')}`:null;
  const handleBrandClick=()=>{
    if(blockPlaying){stopBlock();return;}
    if(verticalPlaying){exitVertical();return;}
    if(g.screen==='play'){g.end(true);return;}
    const next=numberChangeClickCount.current+1;
    if(next>=20){numberChangeClickCount.current=0;onReselect();return;}
    numberChangeClickCount.current=next;
  };
  return <div className={`app ${g.screen==='play'||verticalPlaying?'playing':''}${verticalScreen?' vertical-app':''}${verticalPlaying?' vertical-playing':''}`} data-bg={background} onClickCapture={event=>{if(event.target instanceof Element&&event.target.closest('button:not(.sound-button)'))audio.tap();}}>
    <header className="header">
      <button className="brand brand-button" aria-label={blockPlaying?'블록 그만하기':verticalPlaying?'두 자리 수에서 나가기':g.screen==='play'?'연습을 마치고 기록 보기':'번호 변경하려면 20번 누르기'} onClick={handleBrandClick}><span className="brand-mark">{cloud.profile?.avatar?<img src={cloud.profile.avatar} alt="" width="40" height="40"/>:<Icon name="bolt" size={24}/>}</span><span className="student-number">{numberLabel(studentNumber)}</span></button>
      {g.screen==='play'&&g.run&&<div className="header-status">
        <span className={`header-score score-display${g.run.phase==='wrong'?' wrong':''}${g.run.phase==='correct'?' gained':''}${g.run.phase==='wrong'&&g.run.penalty===0?' score-floor':''}`}><span className="score-word">점수</span> <strong key={g.run.score}>{g.run.score.toLocaleString()}</strong>{g.run.phase==='correct'&&<em className="score-gain" key={g.run.answered} aria-hidden="true">{/^\+\d+/.exec(g.run.feedback)?.[0]}</em>}{g.run.phase==='wrong'&&g.run.penalty>0&&<em className="score-loss" key={g.run.answered} aria-hidden="true">-{g.run.penalty}</em>}</span>
        {headerTimer&&<div className="header-timer" role="timer" aria-label="남은 시간" aria-live="off"><Icon name="clock"/><span>{headerTimer}</span></div>}
        <ComboMeter run={g.run}/>
      </div>}
      {blockPlaying&&block.run&&<BlockProgress run={block.run}/>}
      {verticalPlaying&&!blockPlaying&&<VerticalProgress game={vertical}/>}
      <div className="header-actions">
        <button className="quiet-button sound-button" aria-label={!audio.available?'소리 사용 불가':audio.enabled?'소리 끄기':'소리 켜기'} aria-pressed={audio.enabled} disabled={!audio.available||audio.pending} onClick={()=>void audio.toggle()}><Icon name={audio.enabled?'sound':'muted'}/><span className="wide-only">{audio.enabled?'ON':'OFF'}</span></button>
        {g.screen!=='play'&&!verticalPlaying&&<BackgroundPicker value={background} level={level} onChange={changeBackground}/>}
        {blockPlaying?<button className="quiet-button end-button" disabled={blockOver} onClick={stopBlock}><Icon name="close"/><span>그만하기</span></button>:verticalPlaying?<button className="quiet-button end-button" onClick={exitVertical}><Icon name="close"/><span>나가기</span></button>:g.screen==='play'?<button className="quiet-button end-button" onClick={()=>g.end(true)}><Icon name="close"/><span>끝내기</span></button>:g.screen==='home'?<button className="quiet-button" aria-label="내 기록" onClick={()=>g.setScreen('records')}><Icon name="chart"/><span className="wide-only">내 기록</span></button>:<button className="quiet-button home-button" aria-label="처음으로" onClick={()=>g.setScreen('home')}><Icon name="back"/><span className="wide-only">처음으로</span></button>}
      </div>
    </header>
    <div className="screen-content" ref={content} tabIndex={-1} key={g.screen}>
      {g.screen==='home'&&(cloud.blocking?<main className="connection-screen">{cloud.state==='loading'?<p role="status">불러오는 중</p>:<button className="primary-button" onClick={()=>void cloud.reload()}>연결 재시도</button>}</main>:<HomeScreen game={g} exp={exp} friends={friends} studentNumber={studentNumber} onVertical={count=>void startVertical(count)} onBlock={()=>void startBlock()} blockSync={{starting:blockStarting||blockSync.state==='starting',blocked:blockSync.blocked,saving:blockSync.state==='saving',error:blockSync.state==='error',retry:()=>void blockSync.retry()}} verticalStarting={verticalStarting} verticalBlocked={verticalSync.blocked} verticalSaving={verticalSync.state==='saving'} verticalError={assignment.state==='error'||verticalSync.state==='error'} onVerticalRetry={()=>void verticalSync.retry()} onHall={()=>{setHallPart('rush');g.setScreen('hall');}}/>)}
      {g.screen==='vertical-setup'&&<VerticalSetup sync={verticalSync} assignmentState={assignment.state} onRetry={()=>void assignment.reload()} onStart={()=>void startVertical()}/>}
      {g.screen==='vertical-play'&&<VerticalPlay game={vertical} onExit={exitVertical} onComplete={()=>{audio.cue('finish');g.setScreen('vertical-result');}} onCue={correct=>audio.cue(correct?'correct':'wrong')}/>}
      {g.screen==='vertical-result'&&<VerticalResult game={vertical} sync={verticalSync} assignmentState={assignment.state} onHome={()=>g.setScreen('home')} onAgain={()=>{const count=vertical.session?.questions.length;void startVertical(validVerticalCount(count)?count:5);}} onHall={()=>{setHallPart('vertical');g.setScreen('hall');}}/>}
      {g.screen==='block-play'&&<BlockPlay game={block} onCue={(cue,step)=>audio.cue(cue,step)}/>}
      {g.screen==='block-play'&&<BlockStopDialog open={stopAsk&&!blockOver} onKeep={()=>setStopAsk(false)} onStop={()=>{setStopAsk(false);block.stop();}}/>}
      {g.screen==='block-result'&&<BlockResult game={block} sync={blockSync} starting={blockStarting} onHome={()=>{block.exit();g.setScreen('home');}} onAgain={()=>void startBlock()} onHall={()=>{setHallPart('block');g.setScreen('hall');}}/>}
      {g.screen==='hall'&&<HallScreen ready={cloud.ready} studentNumber={studentNumber} initialDuration={g.run?.duration??g.duration} initialPart={hallPart} initialCount={hallPart==='vertical'&&validVerticalCount(vertical.session?.questions.length)?vertical.session.questions.length:5}/>}
      {g.screen==='play'&&<PlayScreen game={g} partner={friends.partner} best={bestBefore(g,cloud.profile?.best)}/>}
      {(g.screen==='tables'||g.screen==='weak')&&<SetupScreen game={g}/>}
      {g.screen==='result'&&<ResultScreen game={g} rewards={rewards} friends={friends} syncState={cloud.state} retrySave={cloud.retrySave} unlocked={unlockedNow} onUseBackground={changeBackground}/>}
      {g.screen==='friends'&&<FriendsScreen friends={friends} onCelebrate={()=>audio.cue('friend')}/>}
      {g.screen==='records'&&<RecordsScreen game={g} exp={exp} best={cloud.profile?.best} studentNumber={studentNumber}/>}
    </div>
  </div>;
}
