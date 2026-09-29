const STORAGE_KEY='gugudan-rush.student-number';
// The spare number never reaches the server (which only knows 1~23): it stays in this browser
// and has every pet and background unlocked, for guests and trying things out.
export const SPARE_NUMBER=24;
export const isSpare=(n:number)=>n===SPARE_NUMBER;
export const numberLabel=(n:number)=>isSpare(n)?'예비':`${n}번`;
export function loadStudentNumber():number|null{
  try{
    const value=localStorage.getItem(STORAGE_KEY);
    return value!==null&&/^(?:[1-9]|1\d|2[0-4])$/.test(value)?Number(value):null;
  }catch(error){if(error instanceof DOMException)return null;throw error;}
}
export function saveStudentNumber(value:number):boolean{
  if(!Number.isInteger(value)||value<1||value>SPARE_NUMBER)return false;
  try{localStorage.setItem(STORAGE_KEY,String(value));return true;}
  catch(error){if(error instanceof DOMException)return false;throw error;}
}
