import { type Person, type Tree } from './data';

export function savePersonToTree(tree: Tree, draft: Person, options: { makeRoot?: boolean; parentOf?: string; children?: string[] } = {}): Tree {
  const person: Person = { ...draft, firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), patronymic: (draft.patronymic ?? '').trim(), region: (draft.region ?? '').trim(), maidenName: (draft.maidenName ?? '').trim(), place: draft.place.trim(), bio: draft.bio.trim(), parents: [...new Set(draft.parents.filter(Boolean))] };
  if ((person.patronymic?.length ?? 0) > 60 || (person.maidenName?.length ?? 0) > 60 || (person.region?.length ?? 0) > 120) throw new Error('По батькові й дівоче прізвище — до 60 символів, область — до 120.');
  if (!person.firstName || !person.lastName) throw new Error('Вкажіть ім’я та прізвище.');
  if (person.birth && person.death && person.birth > person.death) throw new Error('Дата смерті не може бути раніше дати народження.');
  if (person.birth && person.birth > new Date().toISOString().slice(0, 10)) throw new Error('Дата народження не може бути в майбутньому.');
  if (person.parents.length > 2) throw new Error('Можна вказати не більше двох батьків.');
  const ids = new Set(tree.people.map(p => p.id)); ids.add(person.id);
  if (person.parents.some(id => !ids.has(id)) || (person.partner && !ids.has(person.partner))) throw new Error('Оберіть родича з цього дерева.');
  if (person.partner === person.id) throw new Error('Людина не може бути власним партнером.');
  let people = tree.people.map(p => p.id === person.id ? person : ({ ...p, parents: [...p.parents] }));
  if (!tree.people.some(p => p.id === person.id)) people.push(person);
  if (options.children !== undefined) {
    const children = new Set(options.children);
    if (children.has(person.id)) throw new Error('Людина не може бути власною дитиною.');
    if ([...children].some(id => !ids.has(id))) throw new Error('Оберіть дитину з цього дерева.');
    people = people.map(child => {
      if (!children.has(child.id)) return { ...child, parents: child.parents.filter(id => id !== person.id) };
      if (child.parents.includes(person.id)) return child;
      if (child.parents.length >= 2) throw new Error('У вибраної дитини вже вказано двох батьків. Спершу відредагуйте її зв’язки.');
      return { ...child, parents: [...child.parents, person.id] };
    });
  }

  if (options.parentOf) {
    const child = people.find(p => p.id === options.parentOf);
    if (!child) throw new Error('Не знайдено людину, до якої потрібно додати батьків.');
    if (child.parents.length >= 2) throw new Error('У цієї людини вже вказано двох батьків. Спершу відредагуйте її зв’язки.');
    child.parents.push(person.id);
  }
  const hasCycle = (id: string, path = new Set<string>()): boolean => {
    if (path.has(id)) return true;
    path.add(id);
    return (people.find(p => p.id === id)?.parents || []).some(parent => hasCycle(parent, new Set(path)));
  };
  if (people.some(p => hasCycle(p.id))) throw new Error('Такий зв’язок створює цикл: людина не може бути власним предком.');
  const isAncestor = (ancestor: string, id: string): boolean => (people.find(p => p.id === id)?.parents || []).some(parent => parent === ancestor || isAncestor(ancestor, parent));
  if (person.partner && (isAncestor(person.id, person.partner) || isAncestor(person.partner, person.id))) throw new Error('Партнер не може одночасно бути предком або нащадком цієї людини.');
  // Unlink former partners before establishing the new reciprocal partnership.
  people = people.map(p => ({ ...p, partner: p.partner === person.id && p.id !== person.partner ? '' : p.partner }));
  if (person.partner) {
    const previous = people.find(p => p.id === person.partner)?.partner;
    people = people.map(p => p.id === person.partner ? { ...p, partner: person.id } : p.id === previous && p.id !== person.id ? { ...p, partner: '' } : p);
  }
  // Validate every partnership: changing parents may also affect an existing couple.
  for (const p of people) if (p.partner && (isAncestor(p.id, p.partner) || isAncestor(p.partner, p.id))) throw new Error('Зв’язок батьків суперечить наявному партнерству. Перевірте родинні зв’язки.');
  return { ...tree, people, rootId: options.makeRoot || !tree.rootId ? person.id : tree.rootId };
}

export function removePersonFromTree(tree: Tree, id: string): Tree {
  const people = tree.people.filter(p => p.id !== id).map(p => ({ ...p, parents: p.parents.filter(parent => parent !== id), partner: p.partner === id ? '' : p.partner }));
  return { ...tree, people, rootId: tree.rootId === id ? people[0]?.id || '' : tree.rootId };
}

export function availableChildren(people: Person[], parent: Person, selected: string[]): Person[] {
  const ancestors = new Set<string>();
  const visit = (id: string) => {
    if (ancestors.has(id)) return;
    ancestors.add(id);
    people.find(p => p.id === id)?.parents.forEach(visit);
  };
  parent.parents.forEach(visit);
  return people.filter(child => child.id !== parent.id && child.id !== parent.partner && !ancestors.has(child.id) && !selected.includes(child.id) && (child.parents.length < 2 || child.parents.includes(parent.id)));
}
