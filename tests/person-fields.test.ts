import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { demoTree, fullName, personLocation, matchesPerson } from '../src/data';
import { savePersonToTree } from '../src/domain';
import { validateTree } from '../server/validation';
import PersonFields from '../src/PersonFields';

const female = () => ({...demoTree().people[3],patronymic:' Петрівна ',maidenName:' Шевченко ',region:' Львівська '});
test('new optional details survive domain save, server validation and JSON roundtrip',()=>{
  const saved=savePersonToTree(demoTree(),female());
  const validated=validateTree(JSON.parse(JSON.stringify(saved)));
  const p=validated.people.find(p=>p.id==='p4')!;
  assert.equal(p.patronymic,'Петрівна');assert.equal(p.maidenName,'Шевченко');assert.equal(p.region,'Львівська');
  assert.equal(p.lastName,'Коваленко');assert.equal(p.place,'Львів, Україна');
  assert.equal(fullName(p),'Наталія Коваленко (Шевченко) Петрівна');
  assert.equal(personLocation(p),'Львів, Україна, Львівська');
});
test('existing records without new fields can still be edited and validated',()=>{
  const tree=demoTree();tree.people=tree.people.map(p=>{const {patronymic,region,maidenName,...legacy}=p;return legacy;});
  assert.equal(fullName(tree.people[0]),'Микола Коваленко');
  const saved=savePersonToTree(tree,{...tree.people[0],bio:'Оновлено стару картку'});
  const validated=validateTree(saved);
  assert.equal(validated.people[0].patronymic,'');assert.equal(validated.people[0].region,'');assert.equal(validated.people[0].maidenName,'');
  assert.equal(validated.people[0].bio,'Оновлено стару картку');
});
test('server trims new optional fields and rejects invalid types and lengths',()=>{
  const tree=demoTree();
  const changed=(field:string,value:unknown)=>({...tree,people:tree.people.map((p,i)=>i===0?{...p,[field]:value}:p)});
  assert.equal(validateTree(changed('patronymic',' Іванович ')).people[0].patronymic,'Іванович');
  for(const field of ['patronymic','maidenName','region']){
    assert.throws(()=>validateTree(changed(field,42)));
    assert.throws(()=>validateTree(changed(field,'a'.repeat(field==='region'?121:61))));
  }
});
test('search finds patronymic, maiden name and region case insensitively',()=>{
  const p=female();
  for(const query of ['петрівна','ШЕВЧЕНКО','львівська','Наталія','Коваленко'])assert.equal(matchesPerson(p,query),true);
  assert.equal(matchesPerson(p,'Полтавська'),false);
});
test('maiden name input appears only for women; patronymic and region are separate optional inputs',()=>{
  for(const gender of ['male','female','other'] as const){
    const html=renderToStaticMarkup(createElement(PersonFields,{person:{...female(),gender},onChange:()=>{}}));
    assert.match(html,/name="patronymic"/);assert.match(html,/name="region"/);
    assert.equal(html.includes('name="maidenName"'),gender==='female');
    assert.match(html,/По батькові/);assert.match(html,/Область/);
    assert.doesNotMatch(html,/<input[^>]*name="(?:patronymic|region|maidenName)"[^>]*required/);
  }
});
test('linking children preserves the new details of every family member',()=>{
  const tree=demoTree();tree.people=tree.people.map(p=>p.id==='p4'?{...female(),patronymic:'Петрівна',maidenName:'Шевченко',region:'Львівська'}:p);
  const next=savePersonToTree(tree,tree.people.find(p=>p.id==='p3')!,{children:['p5']});
  const mother=next.people.find(p=>p.id==='p4')!;
  assert.equal(mother.patronymic,'Петрівна');assert.equal(mother.maidenName,'Шевченко');assert.equal(mother.region,'Львівська');
});

test('name order is first name, surname with optional maiden name, then patronymic',()=>{
  const p=female();
  assert.equal(fullName(p),'Наталія Коваленко (Шевченко) Петрівна');
  assert.equal(fullName({...p,maidenName:''}),'Наталія Коваленко Петрівна');
  assert.equal(fullName({...p,maidenName:'   ',patronymic:undefined}),'Наталія Коваленко');
  assert.equal(fullName({...p,patronymic:''}),'Наталія Коваленко (Шевченко)');
});
