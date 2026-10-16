import { useSyncExternalStore } from 'react';
export type AuthRoute = '/login' | '/register';
export function authRoute(path: string): AuthRoute { return path === '/register' ? '/register' : '/login'; }
export function redirectPath(path: string, authenticated: boolean): string | null {
  if (authenticated) return path === '/' ? null : '/';
  return path === '/login' || path === '/register' ? null : '/login';
}
export function navigate(path: string, replace = false) {
  if (window.location.pathname === path) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
const subscribe = (callback: () => void) => { window.addEventListener('popstate', callback); return () => window.removeEventListener('popstate', callback); };
export function usePathname() { return useSyncExternalStore(subscribe, () => window.location.pathname, () => '/login'); }
