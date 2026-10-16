import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, tokenHash, sessionToken } from '../server/security';
import { credentials, validateTree } from '../server/validation';
import { demoTree } from '../src/data';

test('passwords are salted, verifiable, and never stored as plaintext',async()=>{
  const a=await hashPassword('correct-horse-123');const b=await hashPassword('correct-horse-123');
  assert.notEqual(a,b);assert.ok(!a.includes('correct-horse-123'));
  assert.equal(await verifyPassword('correct-horse-123',a),true);
  assert.equal(await verifyPassword('incorrect-horse',a),false);
  assert.equal(await verifyPassword('correct-horse-123','malformed'),false);
});
test('session cookies parse exactly and tokens are stored as hashes',()=>{
  const token='a'.repeat(64);
  assert.equal(sessionToken(`other=1; ridni_session=${token}; ignored=2`),token);
  assert.equal(sessionToken('ridni_session=invalid'),'');
  assert.equal(sessionToken(`other_ridni_session=${token}`),'');
  assert.equal(sessionToken(undefined),'');
  assert.notEqual(tokenHash(token),token);assert.equal(tokenHash(token).length,64);
});
test('credentials normalize email and reject short passwords',()=>{
  assert.deepEqual(credentials({name:' Марія ',email:' MARIA@EXAMPLE.COM ',password:'password-123'},true),{name:'Марія',email:'maria@example.com',password:'password-123'});
  assert.throws(()=>credentials({email:'bad',password:'password-123'}));
  assert.throws(()=>credentials({email:'a@example.com',password:'short'}));
});
test('server validates complete trees and strips unexpected fields',()=>{
  const input={...demoTree(),owner_id:'attacker'};const tree=validateTree(input);
  assert.equal(tree.people.length,6);assert.equal('owner_id' in tree,false);
  assert.doesNotThrow(()=>validateTree({...demoTree(),people:[],rootId:''}));
  assert.throws(()=>validateTree({...demoTree(),rootId:'missing'}));
});
test('server rejects invalid dates, duplicate ids, and missing relatives',()=>{
  const tree=demoTree();
  assert.throws(()=>validateTree({...tree,people:[...tree.people,tree.people[0]]}));
  assert.throws(()=>validateTree({...tree,people:tree.people.map((p,i)=>i===0?{...p,birth:'2020-02-31'}:p)}));
  assert.throws(()=>validateTree({...tree,people:tree.people.map((p,i)=>i===0?{...p,parents:['missing']}:p)}));
  assert.throws(()=>validateTree({...tree,people:tree.people.map((p,i)=>i===0?{...p,photo:'javascript:alert(1)'}:p)}));
});
test('server rejects ancestry cycles and one-sided partnerships',()=>{
  const tree=demoTree();
  assert.throws(()=>validateTree({...tree,people:tree.people.map((p,i)=>i===0?{...p,parents:['p5']}:p)}),/предком/);
  assert.throws(()=>validateTree({...tree,people:tree.people.map((p,i)=>i===0?{...p,partner:''}:p)}),/взаємним/);
});
