import type { Profile, Tree } from './data';

type StorageReader = Pick<Storage, 'getItem'>;
type StorageWriter = Pick<Storage, 'setItem'>;
const activeKey = (profile: Profile) => `ridni-active-tree:${profile.id || profile.email.toLowerCase()}`;

export function restoreActiveTree(trees: Tree[], profile: Profile, storage: StorageReader): string {
  let preferred: string | null = null;
  try { preferred = storage.getItem(activeKey(profile)); } catch { /* Tree content remains on the server. */ }
  return trees.find(tree => tree.id === preferred)?.id || trees.at(-1)?.id || '';
}

export function rememberActiveTree(id: string, profile: Profile, storage: StorageWriter): void {
  try { storage.setItem(activeKey(profile), id); } catch { /* Selecting a tree must work even if storage is unavailable. */ }
}

export function canEditWorkspace(backend: 'checking' | 'ready' | 'demo' | 'offline', authenticated: boolean): boolean {
  return backend === 'demo' || (backend === 'ready' && authenticated);
}
