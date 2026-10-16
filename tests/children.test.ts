import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { demoTree, blankPerson, type Tree } from '../src/data';
import { savePersonToTree, availableChildren } from '../src/domain';
import { validateTree } from '../server/validation';
import ChildPicker from '../src/ChildPicker';

function fixture():Tree {
  const child={...blankPerson(),id:'existing-child',firstName:'Марія',lastName:'Тестова',bio:'Збережена історія',birth:'2000-01-01',parents:['p2']};
  return {...demoTree(),people:[...demoTree().people,child]};
}
test('links an existing child without creating a person or changing their details',()=>{
  const tree=fixture();const parent=tree.people.find(p=>p.id==='p3')!;
  const next=savePersonToTree(tree,parent,{children:['p5','p6','existing-child']});
  assert.equal(next.people.length,tree.people.length);
  const child=next.people.find(p=>p.id==='existing-child')!;
  assert.deepEqual(child.parents,['p2','p3']);
  assert.equal(child.firstName,'Марія');assert.equal(child.bio,'Збережена історія');
  assert.deepEqual(tree.people.find(p=>p.id==='existing-child')!.parents,['p2']);
  assert.deepEqual(next.people.map(p=>p.id),tree.people.map(p=>p.id));
  assert.doesNotThrow(()=>validateTree(next));
});
test('unlinking a child preserves the person and their other parent',()=>{
  const tree=demoTree();const parent=tree.people.find(p=>p.id==='p3')!;
  const next=savePersonToTree(tree,parent,{children:['p6']});
  assert.equal(next.people.length,6);
  assert.deepEqual(next.people.find(p=>p.id==='p5')!.parents,['p4']);
  assert.deepEqual(next.people.find(p=>p.id==='p6')!.parents,['p3','p4']);
});
test('linking does not overwrite two existing parents or duplicate the same parent',()=>{
  const tree=demoTree();
  assert.throws(()=>savePersonToTree(tree,tree.people[0],{children:['p5']}),/двох батьків/);
  const next=savePersonToTree(tree,tree.people.find(p=>p.id==='p3')!,{children:['p5','p5','p6']});
  assert.deepEqual(next.people.find(p=>p.id==='p5')!.parents,['p3','p4']);
});
test('rejects self, missing child and ancestor cycles',()=>{
  const tree=demoTree();const parent=tree.people.find(p=>p.id==='p5')!;
  assert.throws(()=>savePersonToTree(tree,parent,{children:['p5']}),/власною дитиною/);
  assert.throws(()=>savePersonToTree(tree,parent,{children:['missing']}),/цього дерева/);
  assert.throws(()=>savePersonToTree(tree,parent,{children:['p1']}),/цикл/);
});
test('editing the parent and selecting existing children is saved atomically',()=>{
  const tree=fixture();const parent={...tree.people.find(p=>p.id==='p3')!,bio:'Оновлена історія'};
  const next=savePersonToTree(tree,parent,{children:['p5','p6','existing-child']});
  assert.equal(next.people.find(p=>p.id==='p3')!.bio,'Оновлена історія');
  assert.ok(next.people.find(p=>p.id==='existing-child')!.parents.includes('p3'));
});
test('picker offers only valid candidates and needs no new name',()=>{
  const tree=fixture();const parent=tree.people.find(p=>p.id==='p3')!;
  assert.deepEqual(availableChildren(tree.people,parent,['p5','p6']).map(p=>p.id),['existing-child']);
  const html=renderToStaticMarkup(createElement(ChildPicker,{people:tree.people,parent,value:['p5','p6'],onChange:()=>{}}));
  assert.match(html,/<select/);assert.match(html,/value="existing-child"/);
  assert.doesNotMatch(html,/<input|<form/);
  assert.match(html,/Відв’язати дитину/);
});
