// The service key stays inside Supabase Edge Functions. Browser requests carry a number-bound signed session.
const url=Deno.env.get('SUPABASE_URL')??'';
const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'';
const encoder=new TextEncoder();
const signingKey=crypto.subtle.importKey('raw',encoder.encode(`gugudan-v1:${key}`),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,apikey,x-gugudan-session','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const validNumber=(n:unknown):n is number=>typeof n==='number'&&Number.isInteger(n)&&n>=1&&n<=23;
const validDuration=(n:unknown):n is number=>n===1||n===2||n===3;
const validId=(id:unknown):id is string=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
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
async function rpc(name:string,args:object):Promise<unknown>{
  const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('DATABASE_REQUEST_FAILED');
  const text=await response.text();return text?JSON.parse(text):null;
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
    const student=await identity(request.headers.get('X-Gugudan-Session'));
    if(student===null)return json({error:'SESSION_REQUIRED'},401);
    if(data.action==='profile')return json(await rpc('gugudan_profile',{p_student:student}));
    if(data.action==='leaders')return validDuration(data.duration)?json(await rpc('gugudan_leaders',{p_duration:data.duration})):json({error:'INVALID_DURATION'},400);
    if(data.action==='begin'&&validId(data.id)&&validDuration(data.duration)&&['rush','practice','weak'].includes(String(data.mode))){await rpc('gugudan_begin',{p_student:student,p_id:data.id,p_mode:data.mode,p_duration:data.duration});return json({ok:true});}
    if(data.action==='finish'&&validId(data.id)&&typeof data.endedEarly==='boolean'&&Array.isArray(data.events)&&data.events.length<=1200){await rpc('gugudan_finish',{p_student:student,p_id:data.id,p_ended_early:data.endedEarly,p_events:data.events});return json({ok:true});}
    return json({error:'INVALID_ACTION'},400);
  }catch{return json({error:'REQUEST_FAILED'},503);}
});
