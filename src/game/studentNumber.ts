const STORAGE_KEY='gugudan-rush.student-number';
export function loadStudentNumber():number|null{
  try{
    const value=localStorage.getItem(STORAGE_KEY);
    return value!==null&&/^(?:[1-9]|1\d|2[0-3])$/.test(value)?Number(value):null;
  }catch(error){if(error instanceof DOMException)return null;throw error;}
}
export function saveStudentNumber(value:number):boolean{
  if(!Number.isInteger(value)||value<1||value>23)return false;
  try{localStorage.setItem(STORAGE_KEY,String(value));return true;}
  catch(error){if(error instanceof DOMException)return false;throw error;}
}
