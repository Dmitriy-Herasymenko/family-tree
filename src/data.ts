export type Person = {
  id: string; firstName: string; lastName: string; gender: 'male' | 'female' | 'other';
  patronymic?: string; region?: string; maidenName?: string;
  birth: string; death: string; place: string; bio: string; photo: string;
  parents: string[]; partner: string; createdAt: string;
};
export type Tree = { id: string; name: string; description: string; people: Person[]; rootId: string; createdAt: string; version?: number };
export type Profile = { id?: string; name: string; email: string };
const portrait = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=160&h=160&q=85`;
export const photos = {
  grandfather: portrait('photo-1500648767791-00dcc994a43e'),
  grandmother: portrait('photo-1438761681033-6461ffad8d80'),
  father: portrait('photo-1560250097-0b93528c311a'),
  mother: portrait('photo-1580489944761-15a19d654956'),
  son: portrait('photo-1506794778202-cad84cf45f1d'),
  daughter: portrait('photo-1534528741775-53994a69daeb'),
};
const make = (id: string, firstName: string, lastName: string, gender: Person['gender'], birth: string, place: string, photo: string, parents: string[] = [], partner = '', bio = '', death = ''): Person => ({id, firstName, lastName, patronymic: '', region: '', maidenName: '', gender, birth, place, photo, parents, partner, bio, death, createdAt: '2026-10-16T10:00:00Z'});
export function demoTree(): Tree {
  return { id: 'demo-tree', name: 'Родина Коваленків', description: 'Наше коріння. Наші історії. Наша родина.', rootId: 'p5', createdAt: '2026-10-16T10:00:00Z', people: [
    make('p1','Микола','Коваленко','male','1942-03-15','Полтава, Україна',photos.grandfather,[],'p2','Дідусь умів знаходити радість у простих речах. Щоліта ми збиралися в його саду, слухали історії про дитинство й разом доглядали яблуні.','2020-11-08'),
    make('p2','Галина','Коваленко','female','1945-06-22','Полтава, Україна',photos.grandmother,[],'p1','Бабусина оселя завжди пахне свіжою випічкою. Вона зберігає сімейні фотографії, вишиті рушники та пам’ятає історію кожного з нас.'),
    make('p3','Олександр','Коваленко','male','1968-09-04','Київ, Україна',photos.father,['p1','p2'],'p4','Тато навчив нас любити подорожі. Його улюблена традиція — щонеділі збирати всю родину за великим столом.'),
    make('p4','Наталія','Коваленко','female','1971-02-18','Львів, Україна',photos.mother,[],'p3','Мама — серце нашої родини. Вона захоплюється живописом, вирощує квіти та збирає рецепти, які передаються з покоління в покоління.'),
    make('p5','Андрій','Коваленко','male','1995-07-12','Київ, Україна',photos.son,['p3','p4'],'','Збираю історію нашої родини, щоб зберегти найдорожчі спогади для наступних поколінь.'),
    make('p6','Софія','Коваленко','female','1999-05-25','Київ, Україна',photos.daughter,['p3','p4'],'','Люблю фотографувати моменти нашого спільного життя. Мрію створити великий сімейний альбом.'),
  ]};
}
export const blankPerson = (): Person => ({ id: crypto.randomUUID(), firstName: '', lastName: '', patronymic: '', region: '', maidenName: '', gender: 'male', birth: '', death: '', place: '', bio: '', photo: '', parents: [], partner: '', createdAt: new Date().toISOString() });
export const displaySurname = (p: Person) => [p.lastName.trim(), p.gender === 'female' && p.maidenName?.trim() ? `(${p.maidenName.trim()})` : ''].filter(Boolean).join(' ');
export const fullName = (p: Person) => [p.firstName, displaySurname(p), p.patronymic].map(part => part?.trim()).filter(Boolean).join(' ');
export const personLocation = (p: Person) => [p.place, p.region].filter(Boolean).join(', ');
export const matchesPerson = (p: Person, query: string) => [fullName(p), p.maidenName, p.region, p.place, p.bio].filter(Boolean).join(' ').toLocaleLowerCase('uk').includes(query.trim().toLocaleLowerCase('uk'));
export const years = (p: Person) => p.birth ? `${p.birth.slice(0,4)}${p.death ? ' — '+p.death.slice(0,4) : ' — дотепер'}` : 'Дата народження невідома';
export function generationMap(people: Person[]): Map<string, number> {
  const levels = new Map<string, number>();
  const visit = (id: string, visiting = new Set<string>()): number => {
    if (levels.has(id)) return levels.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const p = people.find(p => p.id === id);
    const level = p?.parents.length ? Math.max(...p.parents.map(pid => visit(pid, new Set(visiting)))) + 1 : 0;
    levels.set(id, level); return level;
  };
  people.forEach(p => visit(p.id));
  for (let i = 0; i < people.length; i++) people.forEach(p => {
    if (p.partner && levels.has(p.partner)) {
      const level = Math.max(levels.get(p.id)!, levels.get(p.partner)!);
      levels.set(p.id, level); levels.set(p.partner, level);
    }
    if(p.parents.length) levels.set(p.id, Math.max(levels.get(p.id)!, ...p.parents.map(id => (levels.get(id) ?? -1) + 1)));
  });
  return levels;
}
