import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { TEACHER_RESET_SCOPES, validTeacherResetScopes } from '../src/game/teacherReset.ts';
registerHooks({resolve(specifier,context,next){
 try{return next(specifier,context);}
 catch(error){if(error.code==='ERR_MODULE_NOT_FOUND'&&specifier.startsWith('.')&&!/\.[a-z]+$/.test(specifier))return next(specifier+'.ts',context);throw error;}
}});
const { profile }=await import('../src/cloud/parse.ts');

test('all 31 nonempty category selections are valid; malformed selections are rejected',()=>{
 const ids=TEACHER_RESET_SCOPES.map(s=>s.id);
 for(let mask=1;mask<32;mask++)assert.equal(validTeacherResetScopes(ids.filter((_,i)=>mask&(1<<i))),true);
 for(const value of [null,undefined,{},'rush-1',[],[1],['rush-4'],['rush-1','rush-1'],Array(6).fill('rush-1')])assert.equal(validTeacherResetScopes(value),false);
});

test('old servers cannot enable scoped resets and malformed capability responses fail closed',()=>{
 const raw={studentNumber:1,records:{},sessions:[],best:[]};
 assert.equal(profile(raw,1).canResetScopes,false);
 assert.equal(profile({...raw,canResetScopes:false},1).canResetScopes,false);
 assert.equal(profile({...raw,canResetScopes:true},1).canResetScopes,true);
 for(const flag of ['true',1,null])assert.throws(()=>profile({...raw,canResetScopes:flag},1),/INVALID_RESET_CAPABILITY/);
});
