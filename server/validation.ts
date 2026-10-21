import type { Person, Tree } from '../src/data.js';
import { HttpError } from './validation-error.js';
import { validatePhoto } from './photos.js';
export { HttpError } from './validation-error.js';
export function text(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new HttpError(400, `Перевірте поле «${label}».`);
  return value.trim();
}
export function credentials(body: Record<string, unknown>, register = false) {
  const email = text(body.email, 'Електронна пошта', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Вкажіть коректну електронну пошту.');
  if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) throw new HttpError(400, 'Пароль має містити від 8 до 128 символів.');
  return { email, password: body.password, name: register ? text(body.name, 'Ім’я', 80, true) : '' };
}
function date(value: unknown): string {
  if (value === '') return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw new HttpError(400, 'Вкажіть коректну дату.');
  return value;
}
export function validateTree(value: unknown): Tree {
  if (!value || typeof value !== 'object') throw new HttpError(400, 'Невірні дані дерева.');
  const t = value as Record<string, unknown>;
  if (!Array.isArray(t.people) || t.people.length > 1000) throw new HttpError(400, 'Дерево може містити до 1000 людей.');
  const people: Person[] = t.people.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new HttpError(400, 'Невірні дані людини.');
    const p = value as Record<string, unknown>;
    const id = text(p.id, 'ID', 100, true);
    if (!Array.isArray(p.parents) || p.parents.length > 2 || p.parents.some(id => typeof id !== 'string')) throw new HttpError(400, 'Перевірте зв’язки батьків.');
    if (!['male', 'female', 'other'].includes(p.gender as string)) throw new HttpError(400, 'Невірна стать.');
    const birth = date(p.birth), death = date(p.death);
    if (birth > new Date().toISOString().slice(0,10) || (birth && death && death < birth)) throw new HttpError(400, 'Перевірте дати життя.');
    const photo = validatePhoto(p.photo);
    return { id, firstName: text(p.firstName, 'Ім’я', 60, true), lastName: text(p.lastName, 'Прізвище', 60, true), patronymic: text(p.patronymic === undefined ? '' : p.patronymic, 'По батькові', 60), region: text(p.region === undefined ? '' : p.region, 'Область', 120), maidenName: text(p.maidenName === undefined ? '' : p.maidenName, 'Дівоче прізвище', 60), gender: p.gender as Person['gender'], birth, death, place: text(p.place, 'Місце', 120), bio: text(p.bio, 'Історія', 5000), photo, parents: p.parents as string[], partner: text(p.partner, 'Партнер', 100), createdAt: typeof p.createdAt === 'string' && Number.isFinite(Date.parse(p.createdAt)) ? p.createdAt : new Date().toISOString() };
  });
  const byId = new Map(people.map(p => [p.id, p]));
  if (byId.size !== people.length) throw new HttpError(400, 'ID людей мають бути унікальними.');
  const rootId = text(t.rootId, 'Корінь', 100);
  if (people.length ? !byId.has(rootId) : rootId !== '') throw new HttpError(400, 'Оберіть корінь дерева.');
  for (const p of people) {
    if (new Set(p.parents).size !== p.parents.length || p.parents.some(id => !byId.has(id) || id === p.id)) throw new HttpError(400, 'Перевірте зв’язки батьків.');
    if (p.partner && (p.partner === p.id || byId.get(p.partner)?.partner !== p.id)) throw new HttpError(400, 'Партнерство має бути взаємним.');
  }
  const done = new Set<string>(); const visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new HttpError(400, 'Людина не може бути власним предком.');
    if (done.has(id)) return;
    visiting.add(id); byId.get(id)!.parents.forEach(visit); visiting.delete(id); done.add(id);
  };
  people.forEach(p => visit(p.id));
  const ancestors = new Map<string, Set<string>>();
  const getAncestors = (id: string): Set<string> => {
    if (ancestors.has(id)) return ancestors.get(id)!;
    const result = new Set<string>();
    byId.get(id)!.parents.forEach(parent => { result.add(parent); getAncestors(parent).forEach(id => result.add(id)); });
    ancestors.set(id, result); return result;
  };
  for (const p of people) if (p.partner && (getAncestors(p.id).has(p.partner) || getAncestors(p.partner).has(p.id))) throw new HttpError(400, 'Партнер не може бути предком або нащадком.');
  return { id: typeof t.id === 'string' ? t.id : '', name: text(t.name, 'Назва дерева', 80, true), description: text(t.description, 'Опис', 300), rootId, people, createdAt: typeof t.createdAt === 'string' && Number.isFinite(Date.parse(t.createdAt)) ? t.createdAt : new Date().toISOString() };
}
