// The service key stays inside Supabase Edge Functions. Browser requests carry a number-bound signed session.
const url=Deno.env.get('SUPABASE_URL')??'';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const teacherCode=Deno.env.get('GUGUDAN_TEACHER_CODE')??'';
const encoder=new TextEncoder();
const signingKey=crypto.subtle.importKey('raw',encoder.encode(`gugudan-v1:${key}`),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,apikey,x-gugudan-session','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const validNumber=(n:unknown):n is number=>typeof n==='number'&&Number.isInteger(n)&&n>=1&&n<=23;
const validDuration=(n:unknown):n is number=>n===1||n===2||n===3;
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const attempts=new Map<string,{count:number;until:number}>();
function sameCode(value:unknown){
  if(typeof value!=='string'||!teacherCode||value.length!==teacherCode.length)return false;
  let difference=0;for(let i=0;i<value.length;i++)difference|=value.charCodeAt(i)^teacherCode.charCodeAt(i);
  return difference===0;
}
async function issueTeacher(){
  const payload=`teacher.${Math.floor(Date.now()/1000)+1800}`;
  const signature=await crypto.subtle.sign('HMAC',await signingKey,encoder.encode(payload));
  return `${payload}.${Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,'0')).join('')}`;
}
async function teacherIdentity(token:string|null){
  if(!token)return false;
  const [role,expiry,signature,...rest]=token.split('.');
  if(rest.length||role!=='teacher'||!expiry||!/^\d+$/.test(expiry)||Number(expiry)<=Date.now()/1000||!signature||!/^[a-f0-9]{64}$/.test(signature))return false;
  const bytes=Uint8Array.from(signature.match(/../g)??[],s=>Number.parseInt(s,16));
  return crypto.subtle.verify('HMAC',await signingKey,bytes,encoder.encode(`${role}.${expiry}`));
}
async function issue(student:number){
  const payload=`${student}.${Math.floor(Date.now()/1000)+86400}`;
  const signature=await crypto.subtle.sign('HMAC',await signingKey,encoder.encode(payload));
  return `${payload}.${Array.from(new Uint8Array(signature),b=>b.toString(16).padStart(2,'0')).join('')}`;
}
async function identity(token:string|null):Promise<number|null>{
  if(!token)return null;
  const [student,expiry,signature,...rest]=token.split('.');
  if(rest.length||!student||!expiry||!signature||!/^\d+$/.test(student)||!/^\d+$/.test(expiry)||!/^[a-f0-9]{64}$/.test(signature))return null;
  const n=Number(student);if(!validNumber(n)||Number(expiry)<=Date.now()/1000)return null;
  const bytes=Uint8Array.from(signature.match(/../g)??[],s=>Number.parseInt(s,16));
  return await crypto.subtle.verify('HMAC',await signingKey,bytes,encoder.encode(`${student}.${expiry}`))?n:null;
}
async function rpc(name:string,args:object,optional=false):Promise<unknown>{
  const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
  if(!response.ok){if(optional&&response.status===404&&record(await response.json()).code==='PGRST202')return null;throw new Error('DATABASE_REQUEST_FAILED');}
  const text=await response.text();return text?JSON.parse(text):null;
}
function record(value:unknown):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('INVALID_DATABASE_RESPONSE');
  return Object.fromEntries(Object.entries(value));
}
async function teacherRecords(){
  const result=await rpc('gugudan_teacher_records',{});
  if(!Array.isArray(result))throw new Error('INVALID_DATABASE_RESPONSE');
  const profiles=result.map(record);
  const ids=profiles.flatMap(profile=>Array.isArray(profile.sessions)?profile.sessions.slice(-5).map(session=>record(session).id).filter(validId):[]);
  const dates=new Map<string,string>();
  for(let offset=0;offset<ids.length;offset+=60){
    const query=new URLSearchParams({select:'id,finished_at',id:`in.(${ids.slice(offset,offset+60).join(',')})`,finished_at:'not.is.null'});
    const response=await fetch(`${url}/rest/v1/gugudan_runs?${query}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('DATABASE_REQUEST_FAILED');
    const rows:unknown=await response.json();
    if(!Array.isArray(rows))throw new Error('INVALID_DATABASE_RESPONSE');
    for(const value of rows){const row=record(value);if(validId(row.id)&&typeof row.finished_at==='string')dates.set(row.id,row.finished_at);}
  }
  // Finished two-digit runs live in their own table; keep each student's latest five for 최근 도전.
  const verticalQuery=new URLSearchParams({select:'id,student_number,questions,score,mistakes,finished_at',finished_at:'not.is.null',order:'finished_at.desc',limit:'1000'});
  const verticalResponse=await fetch(`${url}/rest/v1/gugudan_vertical_runs?${verticalQuery}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});
  if(!verticalResponse.ok)throw new Error('DATABASE_REQUEST_FAILED');
  const verticalRows:unknown=await verticalResponse.json();
  if(!Array.isArray(verticalRows))throw new Error('INVALID_DATABASE_RESPONSE');
  const verticalSessions=new Map<number,unknown[]>();
  for(const value of verticalRows){
    const row=record(value),list=verticalSessions.get(Number(row.student_number))??[];
    if(!validNumber(row.student_number)||!validId(row.id)||typeof row.finished_at!=='string'||!Array.isArray(row.questions)||list.length>=5)continue;
    list.push({id:row.id,finishedAt:row.finished_at,count:row.questions.length,score:row.score,mistakes:row.mistakes});verticalSessions.set(row.student_number,list);
  }
  const settings=await rpc('gugudan_teacher_vertical_assignments',{});
  if(!Array.isArray(settings))throw new Error('INVALID_DATABASE_RESPONSE');
  const difficulties=new Map(settings.map(value=>{const row=record(value);if(!validNumber(row.studentNumber)||!validDuration(row.difficulty))throw new Error('INVALID_DATABASE_RESPONSE');return [row.studentNumber,row.difficulty];}));
  const metrics=await rpc('gugudan_teacher_vertical_metrics',{},true);
  if(metrics!==null&&!Array.isArray(metrics))throw new Error('INVALID_DATABASE_RESPONSE');
  const summaries=new Map((metrics??[]).map((value:unknown)=>{const row=record(value);if(!validNumber(row.studentNumber))throw new Error('INVALID_DATABASE_RESPONSE');return [row.studentNumber,row.stats];}));
  return profiles.map(profile=>({...profile,canResetScopes:true,verticalSessions:verticalSessions.get(Number(profile.studentNumber))??[],verticalMetrics:summaries.get(Number(profile.studentNumber))??null,verticalDifficulty:difficulties.get(Number(profile.studentNumber))??1,sessions:Array.isArray(profile.sessions)?profile.sessions.map(value=>{const session=record(value);return {...session,finishedAt:typeof session.id==='string'?dates.get(session.id)??null:null};}):[]}));
}
Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
  if(!url||!key)return json({error:'UNAVAILABLE'},503);
  try{
    const text=await request.text();if(encoder.encode(text).length>160000)return json({error:'TOO_LARGE'},413);
    let body:unknown;try{body=JSON.parse(text);}catch{return json({error:'INVALID_JSON'},400);}
    if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'INVALID_BODY'},400);
    const data=Object.fromEntries(Object.entries(body));
    if(data.action==='register')return validNumber(data.studentNumber)?json({token:await issue(data.studentNumber)}):json({error:'INVALID_STUDENT'},400);
    if(data.action==='teacherLogin'){
      const address=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()??'unknown';
      const now=Date.now();const previous=attempts.get(address);
      if(previous&&previous.until>now&&previous.count>=5)return json({error:'TOO_MANY_ATTEMPTS'},429);
      if(!sameCode(data.code)){
        attempts.set(address,{count:(previous&&previous.until>now?previous.count:0)+1,until:now+15*60000});
        return json({error:'INVALID_CODE'},401);
      }
      attempts.delete(address);return json({token:await issueTeacher()});
    }
    if(data.action==='teacherRecords'||data.action==='teacherReset'||data.action==='teacherResetAll'||data.action==='teacherResetScoped'||data.action==='teacherSetVertical'){
      if(!await teacherIdentity(request.headers.get('X-Gugudan-Session')))return json({error:'SESSION_REQUIRED'},401);
      if(data.action==='teacherRecords')return json(await teacherRecords());
      if(data.action==='teacherResetAll'){await rpc('gugudan_teacher_reset_all',{});return json({ok:true});}
      if(!validNumber(data.studentNumber))return json({error:'INVALID_STUDENT'},400);
      if(data.action==='teacherResetScoped'){
        const scopes=data.scopes;
        if(!Array.isArray(scopes)||scopes.length<1||scopes.length>5||new Set(scopes).size!==scopes.length||!scopes.every(scope=>['rush-1','rush-2','rush-3','vertical-5','vertical-10'].includes(scope)))return json({error:'INVALID_RESET_SCOPES'},400);
        await rpc('gugudan_teacher_reset_scoped',{p_student:data.studentNumber,p_scopes:scopes});return json({ok:true});
      }
      if(data.action==='teacherSetVertical'){
        if(!validDuration(data.difficulty))return json({error:'INVALID_DIFFICULTY'},400);
        return json(await rpc('gugudan_teacher_set_vertical',{p_student:data.studentNumber,p_difficulty:data.difficulty}));
      }
      await rpc('gugudan_teacher_reset',{p_student:data.studentNumber});return json({ok:true});
    }
    const student=await identity(request.headers.get('X-Gugudan-Session'));
    if(student===null)return json({error:'SESSION_REQUIRED'},401);
    if(data.action==='verticalAssignment')return json(await rpc('gugudan_vertical_assignment',{p_student:student}));
    // A student's own two-digit records for 내 기록: best cell-scored score (as the hall of fame ranks it) and finished runs, per 5/10 questions.
    if(data.action==='verticalRecords'){
      const query=new URLSearchParams({select:'questions,score,cell_scoring',student_number:`eq.${student}`,finished_at:'not.is.null',limit:'5000'});
      const response=await fetch(`${url}/rest/v1/gugudan_vertical_runs?${query}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw new Error('DATABASE_REQUEST_FAILED');
      const rows:unknown=await response.json();
      if(!Array.isArray(rows))throw new Error('INVALID_DATABASE_RESPONSE');
      const totals=[5,10].map(count=>({count,best:null as number|null,runs:0}));
      for(const value of rows){
        const row=record(value),total=totals.find(t=>Array.isArray(row.questions)&&t.count===row.questions.length);
        if(!total)continue;
        total.runs+=1;
        if(row.cell_scoring===true&&typeof row.score==='number'&&(total.best===null||row.score>total.best))total.best=row.score;
      }
      return json(totals);
    }
    if(data.action==='verticalLeaders'){
      if(data.count!==undefined&&data.count!==5&&data.count!==10)return json({error:'INVALID_COUNT'},400);
      if(data.tightTime!==undefined&&typeof data.tightTime!=='boolean')return json({error:'INVALID_RUN'},400);
      if(data.cellScoring!==undefined&&typeof data.cellScoring!=='boolean')return json({error:'INVALID_RUN'},400);
      if(data.cellScoring===true)return json(await rpc('gugudan_vertical_leaders_cells',{p_count:data.count===10?10:5}));
      if(data.tightTime===true)return json(await rpc('gugudan_vertical_leaders_tight',{p_count:data.count===10?10:5}));
      return json(await rpc(data.count===10?'gugudan_vertical_leaders_count':'gugudan_vertical_leaders',data.count===10?{p_count:10}:{}));
    }
    if(data.action==='verticalBegin'){
      if(data.cellScoring!==undefined&&typeof data.cellScoring!=='boolean'||data.cellScoring===true&&data.tightTime!==true)return json({error:'INVALID_RUN'},400);
      if(data.tightTime!==undefined&&typeof data.tightTime!=='boolean'||data.tightTime===true&&(data.timeScoring!==true||data.directZero!==true))return json({error:'INVALID_RUN'},400);
      if(data.directZero!==undefined&&typeof data.directZero!=='boolean'||data.directZero===true&&(data.puzzleOperands!==true||data.puzzles!==true||data.manualZero!==true))return json({error:'INVALID_RUN'},400);
      if(data.puzzleOperands!==undefined&&typeof data.puzzleOperands!=='boolean'||data.puzzleOperands===true&&(data.puzzles!==true||data.manualZero!==true))return json({error:'INVALID_RUN'},400);
      if(!validId(data.id)||(data.timeScoring!==undefined&&typeof data.timeScoring!=='boolean')||(data.manualZero!==undefined&&typeof data.manualZero!=='boolean')||(data.puzzles!==undefined&&typeof data.puzzles!=='boolean')||(data.puzzles===true&&data.manualZero!==true)||(data.count!==undefined&&data.count!==5&&data.count!==10))return json({error:'INVALID_RUN'},400);
      if(data.cellScoring===true)return json(await rpc('gugudan_vertical_begin_cells',{p_student:student,p_id:data.id,p_count:data.count===10?10:5}));
      if(data.tightTime===true)return json(await rpc('gugudan_vertical_begin_tight',{p_student:student,p_id:data.id,p_count:data.count===10?10:5}));
      if(data.directZero===true)return json(await rpc('gugudan_vertical_begin_direct_zero',{p_student:student,p_id:data.id,p_count:data.count===10?10:5,p_timed:data.timeScoring===true}));
      if(data.puzzleOperands===true)return json(await rpc('gugudan_vertical_begin_variety',{p_student:student,p_id:data.id,p_count:data.count===10?10:5,p_timed:data.timeScoring===true}));
      if(data.puzzles===true)return json(await rpc('gugudan_vertical_begin_puzzles',{p_student:student,p_id:data.id,p_count:data.count===10?10:5,p_timed:data.timeScoring===true}));
      if(data.manualZero===true)return json(await rpc('gugudan_vertical_begin_manual',{p_student:student,p_id:data.id,p_count:data.count===10?10:5,p_timed:data.timeScoring===true}));
      return json(await rpc(data.count===10?'gugudan_vertical_begin_count':data.timeScoring===true?'gugudan_vertical_begin_timed':'gugudan_vertical_begin',data.count===10?{p_student:student,p_id:data.id,p_count:10,p_timed:data.timeScoring===true}:{p_student:student,p_id:data.id}));
    }
    if(data.action==='verticalFinish'){
      if(!validId(data.id)||!Array.isArray(data.events)||data.events.length>2000||!data.events.every(value=>{
        if(!value||typeof value!=='object'||Array.isArray(value))return false;
        const event=Object.fromEntries(Object.entries(value));
        return typeof event.question==='number'&&Number.isInteger(event.question)&&event.question>=0&&event.question<10&&typeof event.step==='number'&&Number.isInteger(event.step)&&event.step>=0&&event.step<100&&typeof event.answer==='number'&&Number.isInteger(event.answer)&&event.answer>=0&&event.answer<=9&&(event.ms===undefined||typeof event.ms==='number'&&Number.isInteger(event.ms)&&event.ms>=0&&event.ms<=1000000000);
      }))return json({error:'INVALID_EVENTS'},400);
      return json(await rpc('gugudan_vertical_finish',{p_student:student,p_id:data.id,p_events:data.events}));
    }
    if(data.action==='capabilities')return json({questionTypes:true,friends:true});
    if(data.action==='saveFriends'){
      const friends=data.friends,partner=data.partner;
      if(!Array.isArray(friends)||friends.length>400||!friends.every(id=>typeof id==='string'&&/^[a-z]+(\.[a-z]+){0,4}$/.test(id))||(partner!==null&&typeof partner!=='string'))return json({error:'INVALID_FRIENDS'},400);
      await rpc('gugudan_save_friends',{p_student:student,p_friends:friends,p_partner:partner});return json({ok:true});
    }
    if(data.action==='profile')return json(await rpc('gugudan_profile',{p_student:student}));
    if(data.action==='leaders')return validDuration(data.duration)?json(await rpc('gugudan_leaders',{p_duration:data.duration})):json({error:'INVALID_DURATION'},400);
    if(data.action==='begin'&&validId(data.id)&&validDuration(data.duration)&&['rush','practice','weak'].includes(String(data.mode))){await rpc('gugudan_begin',{p_student:student,p_id:data.id,p_mode:data.mode,p_duration:data.duration});return json({ok:true});}
    if(data.action==='finish'&&validId(data.id)&&typeof data.endedEarly==='boolean'&&Array.isArray(data.events)&&data.events.length<=1200){await rpc('gugudan_finish',{p_student:student,p_id:data.id,p_ended_early:data.endedEarly,p_events:data.events});return json({ok:true});}
    return json({error:'INVALID_ACTION'},400);
  }catch{return json({error:'REQUEST_FAILED'},503);}
});
