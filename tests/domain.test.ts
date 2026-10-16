import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoTree, blankPerson, generationMap } from '../src/data';
import { savePersonToTree, removePersonFromTree } from '../src/domain';

test('demo contains three generations and six people', () => {
  const tree = demoTree();
  assert.equal(tree.people.length, 6);
  assert.equal(Math.max(...generationMap(tree.people).values()) + 1, 3);
});
test('adding a child preserves parents and the original tree', () => {
  const tree = demoTree();
  const child = { ...blankPerson(), firstName: ' Марія ', lastName: ' Коваленко ', parents: ['p5'] };
  const next = savePersonToTree(tree, child);
  assert.equal(next.people.length, 7);
  assert.equal(next.people.at(-1)?.firstName, 'Марія');
  assert.deepEqual(next.people.at(-1)?.parents, ['p5']);
  assert.equal(tree.people.length, 6);
  assert.equal(Math.max(...generationMap(next.people).values()) + 1, 4);
});
test('adding a parent links the selected child and shifts later generations', () => {
  const tree = demoTree();
  const parent = { ...blankPerson(), firstName: 'Петро', lastName: 'Коваленко' };
  const next = savePersonToTree(tree, parent, { parentOf: 'p1' });
  assert.deepEqual(next.people.find(p => p.id === 'p1')?.parents, [parent.id]);
  assert.deepEqual(tree.people.find(p => p.id === 'p1')?.parents, []);
  assert.equal(Math.max(...generationMap(next.people).values()) + 1, 4);
});
test('editing a person cannot create a cycle through descendants', () => {
  const tree = demoTree();
  assert.throws(() => savePersonToTree(tree, { ...tree.people[0], parents: ['p5'] }), /цикл/);
  assert.throws(() => savePersonToTree(tree, { ...tree.people[0], parents: ['p1'] }), /цикл/);
});
test('partnership is reciprocal and replacing it detaches both former spouses', () => {
  const tree = demoTree();
  const next = savePersonToTree(tree, { ...tree.people[0], partner: 'p4' });
  assert.equal(next.people.find(p => p.id === 'p1')?.partner, 'p4');
  assert.equal(next.people.find(p => p.id === 'p4')?.partner, 'p1');
  assert.equal(next.people.find(p => p.id === 'p2')?.partner, '');
  assert.equal(next.people.find(p => p.id === 'p3')?.partner, '');
  assert.equal(tree.people[0].partner, 'p2');
});
test('partners cannot also be ancestors or descendants', () => {
  const tree = demoTree();
  assert.throws(() => savePersonToTree(tree, { ...tree.people[0], partner: 'p5' }), /предком/);
  assert.throws(() => savePersonToTree(tree, { ...tree.people[0], parents: ['p2'] }), /предком/);
});
test('rejects unknown relatives, future birth and inverted life dates', () => {
  const tree = demoTree();
  assert.throws(() => savePersonToTree(tree, { ...tree.people[0], parents: ['missing'] }), /цього дерева/);
  assert.throws(() => savePersonToTree(tree, { ...tree.people[0], birth: '2999-01-01', death: '' }), /майбутньому/);
  assert.throws(() => savePersonToTree(tree, { ...tree.people[0], birth: '2000-01-01', death: '1990-01-01' }), /раніше/);
});
test('first person becomes root, and another person can be selected as root', () => {
  const tree = { ...demoTree(), people: [], rootId: '' };
  const person = { ...blankPerson(), firstName: 'Марія', lastName: 'Шевченко' };
  assert.equal(savePersonToTree(tree, person).rootId, person.id);
  const demo = demoTree();
  assert.equal(savePersonToTree(demo, demo.people[0], { makeRoot: true }).rootId, 'p1');
});
test('deleting a person detaches relatives, updates root and supports an empty tree', () => {
  const tree = demoTree();
  const next = removePersonFromTree(tree, 'p3');
  assert.equal(next.people.find(p => p.id === 'p4')?.partner, '');
  assert.deepEqual(next.people.find(p => p.id === 'p5')?.parents, ['p4']);
  assert.equal(tree.people.find(p => p.id === 'p4')?.partner, 'p3');
  const noRoot = removePersonFromTree(tree, tree.rootId);
  assert.ok(noRoot.people.some(p => p.id === noRoot.rootId));
  let empty = tree;
  tree.people.forEach(p => { empty = removePersonFromTree(empty, p.id); });
  assert.equal(empty.people.length, 0);
  assert.equal(empty.rootId, '');
});
