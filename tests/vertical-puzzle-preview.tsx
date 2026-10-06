import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { VerticalPlay, VerticalProgress } from '../src/components/VerticalScreen';
import { Icon } from '../src/components/Icon';
import { useVerticalGame } from '../src/game/useVerticalGame';
import { chooseMixedVerticalQuestions, difficultyOf, withVerticalPuzzles, withDirectZeroQuestions } from '../src/game/vertical';
import type { Difficulty, VerticalFact } from '../src/game/vertical';
import '../src/styles.css';
import '../src/screens.css';
import '../src/motion.css';
import '../src/vertical.css';
import '../src/mobile.css';

function Preview(){
  const game=useVerticalGame(999);
  const [playing,setPlaying]=useState(false);
  const [done,setDone]=useState(false);
  const start=(difficulty:Difficulty,addition=false,customExample?:VerticalFact)=>{
    const count=difficulty===1||addition?5:10;
    const questions=[...chooseMixedVerticalQuestions(difficulty,()=>.6,count)];
    const example=customExample??(addition?{a:99,b:99}:difficulty===1?{a:66,b:90}:difficulty===2?{a:32,b:12}:{a:47,b:21});
    const exact=questions.findIndex(f=>f.a===example.a&&f.b===example.b);
    questions.splice(exact>=0?exact:questions.findIndex(f=>difficultyOf(f)===difficultyOf(example)),1);
    game.start(difficulty,crypto.randomUUID(),withDirectZeroQuestions(withVerticalPuzzles([example,...questions],difficulty,()=>0,true,true)),true,true,true,true);
    setPlaying(true);setDone(false);
  };
  const exit=()=>{game.exit();setPlaying(false);};
  return <>
    <div className={`app vertical-app${playing?' playing vertical-playing':''}`} data-bg="night">
      <header className="header"><button className="brand brand-button" aria-label="검증용 나가기" onClick={exit}><span className="brand-mark"><Icon name="bolt"/></span><span className="student-number">19번</span></button>{playing&&<VerticalProgress game={game}/>}<div className="header-actions"><button className="quiet-button sound-button" aria-label="검증용 소리"><Icon name="muted"/><span className="wide-only">OFF</span></button><button className="quiet-button end-button" onClick={exit}><Icon name="close"/><span>나가기</span></button></div></header>
      <div className="screen-content">{playing&&!done?<VerticalPlay game={game} onExit={exit} onComplete={()=>setDone(true)} onCue={()=>{}}/>:<main className="vertical-setup"><h1>{done?`${game.session?.questions.length}문제 완료`:'빈칸 문항 검증'}</h1><button className="primary-button" onClick={()=>start(2)}>中 10문제</button><button className="primary-button" onClick={()=>start(3)}>上 10문제</button><button className="quiet-button" onClick={()=>start(1)}>66 × 90 검증</button><button className="quiet-button" onClick={()=>start(3,true)}>99 × 99 올림 검증</button><button className="quiet-button" onClick={()=>start(3,true,{a:59,b:96})}>59 × 96 색상 검증</button></main>}</div>
    </div>
    <details style={{position:'fixed',bottom:0,right:0,zIndex:100,maxWidth:300,maxHeight:200,overflow:'auto',background:'var(--panel)',fontSize:14}}><summary>검증용 입력 기록</summary><pre>{JSON.stringify(game.session?.events.slice(-8),null,2)}</pre></details>
  </>;
}
const root=createRoot(document.getElementById('root')!);
root.render(<Preview/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
