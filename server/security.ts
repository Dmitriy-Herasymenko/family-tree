import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, expected] = stored.split(':');
  if (algorithm !== 'scrypt' || !salt || !expected) return false;
  const hash = await scrypt(password, salt, 64) as Buffer;
  const value = Buffer.from(expected, 'hex');
  return hash.length === value.length && timingSafeEqual(hash, value);
}
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function sessionToken(header: string | undefined): string {
  const value = header?.split(';').map(p => p.trim()).find(p => p.startsWith('ridni_session='))?.slice('ridni_session='.length) || '';
  return /^[a-f0-9]{64}$/.test(value) ? value : '';
}
