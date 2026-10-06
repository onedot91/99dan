// A device where the teacher code was entered once stays a teacher device: the code is kept so the app can
// sign in again by itself (server sessions last 30 minutes), and the open teacher screen survives a refresh.
const CODE_KEY='gugudan-rush.teacher-code';
const MODE_KEY='gugudan-rush.teacher-mode';
function read(key:string):string|null{
  try{return localStorage.getItem(key);}
  catch(error){if(error instanceof DOMException)return null;throw error;}
}
function write(key:string,value:string|null){
  try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}
  catch(error){if(!(error instanceof DOMException))throw error;}
}
export function loadTeacherCode():string|null{
  const value=read(CODE_KEY);
  return value!==null&&/^\d{4}$/.test(value)?value:null;
}
export const saveTeacherCode=(code:string)=>write(CODE_KEY,code);
export const forgetTeacherCode=()=>write(CODE_KEY,null);
export const loadTeacherMode=()=>read(MODE_KEY)==='1'&&loadTeacherCode()!==null;
export const saveTeacherMode=(on:boolean)=>write(MODE_KEY,on?'1':null);
