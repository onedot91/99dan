import { createRoot } from 'react-dom/client';
import { TeacherScreen } from '../src/components/TeacherScreen';
import { StudentNumberScreen } from '../src/components/StudentNumberScreen';
import { HomeScreen } from '../src/components/HomeScreen';
import { HallScreen } from '../src/components/HallScreen';
import { VerticalResult } from '../src/components/VerticalScreen';
import { Icon } from '../src/components/Icon';
import { useRushGame } from '../src/game/useRushGame';
import { useFriends } from '../src/game/useFriends';
import { useVerticalGame } from '../src/game/useVerticalGame';
import { useVerticalSync } from '../src/cloud/useVerticalSync';
import { chooseMixedVerticalQuestions, createVerticalSession, reduceVertical, verticalQuestionSteps } from '../src/game/vertical';
import '../src/styles.css';
import '../src/screens.css';
import '../src/results.css';
import '../src/motion.css';
import '../src/student.css';
import '../src/hall.css';
import '../src/teacher.css';
import '../src/friends.css';
import '../src/vertical.css';
import '../src/mobile.css';

// All API responses are synthetic; this entry never contacts the school server.
const profiles=Array.from({length:23},(_,i)=>({
  studentNumber:i+1,avatar:null,verticalDifficulty:i%3+1,friends:[],partner:null,canResetScopes:!new URLSearchParams(location.search).has('legacyReset'),
  records:{'2×2':{attempts:700,correct:650,wrong:50,totalMs:100000,streak:3,fastStreak:1,recent:[],reviewAt:null,interval:1,lastSeen:1}},
  verticalMetrics:{runs:3,first:{attempts:30,correct:29},multiply:{attempts:10,correct:9},sum:{attempts:10,correct:9}},
  best:[1,2,3].map(duration=>({duration,score:123456,correct:99})),
  sessions:Array.from({length:5},(_,j)=>({id:`qa-${i}-${j}`,finishedAt:new Date(Date.now()-(i%3===0?0:86400000)-j*60000).toISOString(),duration:j%3+1,mode:'rush',score:123456,correct:99,answered:100,bestCombo:20,fastest:500,accuracy:99,endedEarly:false,scoringVersion:5}))
}));
let resetFailure=new URLSearchParams(location.search).has('resetFailure');
window.fetch=async(_input,init)=>{
  const body=typeof init?.body==='string'?JSON.parse(init.body):{};
  if(body.action==='teacherResetScoped'){
    if(resetFailure){resetFailure=false;return Response.json({error:'QA_FAILURE'},{status:503});}
    const target=profiles[body.studentNumber-1]!;
    const durations=(body.scopes as string[]).filter(scope=>scope.startsWith('rush-')).map(scope=>Number(scope.slice(5)));
    target.sessions=target.sessions.filter(session=>!durations.includes(session.duration));
    target.best=target.best.filter(best=>!durations.includes(best.duration));
    return Response.json({ok:true});
  }
  const data=body.action==='teacherRecords'?profiles:body.action==='teacherSetVertical'?(Object.assign(profiles[body.studentNumber-1]!,{verticalDifficulty:body.difficulty}),{studentNumber:body.studentNumber,difficulty:body.difficulty}):body.action==='register'?{token:'local-qa'}:body.action==='leaders'||body.action==='verticalLeaders'?Array.from({length:5},(_,i)=>({studentNumber:i+19,avatar:null,score:body.action==='verticalLeaders'?2000-i:123456-i,correct:99})):null;
  return new Response(JSON.stringify(data),{status:data===null?400:200,headers:{'Content-Type':'application/json'}});
};
function Preview(){
  const game=useRushGame();
  const friends=useFriends(999,0,{friendsSync:false,profile:null});
  const vertical=useVerticalGame(998);
  const sync=useVerticalSync(24,null);
  const page=new URLSearchParams(location.search).get('screen');
  if(page==='teacher')return <TeacherScreen token="local-qa" onExit={()=>{}}/>;
  if(page==='number')return <StudentNumberScreen onConfirm={()=>{}} onTeacher={()=>{}}/>;
  let result=createVerticalSession(3,'mobile-qa',chooseMixedVerticalQuestions(3,()=>.6,10),true,true);
  for(let q=0;q<10;q++){
    for(const step of verticalQuestionSteps(result.questions[q]!,true)){
      result=reduceVertical(result,{type:'input',key:String(step.expected)});
      result=reduceVertical(result,{type:'input',key:'Enter',ms:1000});
    }
    result=reduceVertical(result,{type:'next'});
  }
  return <div className={`app${page==='result'?' vertical-app':''}`} data-bg="night">
    <header className="header"><button className="brand brand-button"><span className="brand-mark"><Icon name="bolt"/></span><span className="student-number">검증</span></button><div className="header-actions"><button className="quiet-button sound-button" aria-label="소리 켜기"><Icon name="muted"/><span className="wide-only">OFF</span></button><button className="quiet-button" aria-label="배경"><Icon name="image"/><span className="wide-only">배경</span></button><button className="quiet-button" aria-label="처음으로"><Icon name="back"/><span className="wide-only">처음으로</span></button></div></header>
    <div className="screen-content">{page==='hall'?<HallScreen ready studentNumber={19} initialDuration={3}/>:page==='result'?<VerticalResult game={{...vertical,session:result}} sync={sync} assignmentState="ready" onHome={()=>{}} onAgain={()=>{}} onHall={()=>{}}/>:<HomeScreen game={game} friends={friends} studentNumber={999} onVertical={()=>{}} onHall={()=>{}} verticalStarting={false} verticalBlocked={false} verticalSaving={false} verticalError={false} onVerticalRetry={()=>{}}/>}</div>
  </div>;
}
const root=createRoot(document.getElementById('root')!);
root.render(<Preview/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
