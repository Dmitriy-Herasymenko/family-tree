import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreActiveTree, rememberActiveTree, canEditWorkspace } from '../src/workspace';
import { isAllowedOrigin } from '../server/origin';
import { demoTree, type Profile } from '../src/data';
const profile:Profile={id:'user-a',name:'Марія',email:'maria@example.com'};
function memory(){const data=new Map<string,string>();return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};}
test('reload returns the created and selected tree instead of the first family',()=>{
  const storage=memory();const old=demoTree(),created={...demoTree(),id:'created',name:'Моя родина'};
  rememberActiveTree(created.id,profile,storage);
  assert.equal(restoreActiveTree([old,created],profile,storage),'created');
  rememberActiveTree(old.id,profile,storage);
  assert.equal(restoreActiveTree([old,created],profile,storage),old.id);
});
test('selected family is isolated per account and falls back to newest tree',()=>{
  const storage=memory();const trees=[demoTree(),{...demoTree(),id:'new-tree'}];
  rememberActiveTree(trees[0].id,profile,storage);
  assert.equal(restoreActiveTree(trees,{...profile,id:'user-b'},storage),'new-tree');
  assert.equal(restoreActiveTree(trees,profile,storage),'demo-tree');
  rememberActiveTree('removed-tree',profile,storage);
  assert.equal(restoreActiveTree(trees,profile,storage),'new-tree');
});
test('storage failures do not prevent opening server trees',()=>{
  const storage={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
  assert.doesNotThrow(()=>rememberActiveTree('id',profile,storage));
  assert.equal(restoreActiveTree([demoTree()],profile,storage),'demo-tree');
});
test('guests and offline sessions cannot silently create local trees in server mode',()=>{
  assert.equal(canEditWorkspace('ready',false),false);
  assert.equal(canEditWorkspace('offline',false),false);
  assert.equal(canEditWorkspace('offline',true),false);
  assert.equal(canEditWorkspace('checking',false),false);
  assert.equal(canEditWorkspace('ready',true),true);
  assert.equal(canEditWorkspace('demo',false),true);
});
test('localhost aliases work in development while foreign origins remain blocked',()=>{
  assert.equal(isAllowedOrigin('http://127.0.0.1:5173','http://localhost:5173',false),true);
  assert.equal(isAllowedOrigin('http://[::1]:5173','http://localhost:5173',false),true);
  assert.equal(isAllowedOrigin('http://localhost:5174','http://localhost:5173',false),false);
  assert.equal(isAllowedOrigin('https://attacker.example','http://localhost:5173',false),false);
  assert.equal(isAllowedOrigin(undefined,'http://localhost:5173',false),false);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5173','http://localhost:5173',true),false);
  assert.equal(isAllowedOrigin('https://ridni.example','https://ridni.example',true),true);
});
