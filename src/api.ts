import type { Tree, Profile } from './data';
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Ridni-Client':'web'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
  } catch {throw new ApiError(0,'Немає з’єднання із сервером. Спробуйте ще раз.');}
  let result;
  try {result=await response.json();}catch {throw new ApiError(response.status,'Сервер повернув некоректну відповідь.');}
  if(!response.ok)throw new ApiError(response.status,result.error || 'Не вдалося виконати запит.');
  return result as T;
}
export const accountTrees = () => api<{trees:Tree[]}>('/trees');
export const currentProfile = () => api<{profile:Profile}>('/auth/me');
