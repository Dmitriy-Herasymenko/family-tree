import { readFile } from 'node:fs/promises';
import { pool, configured } from './db.js';
try {
  if (!configured) throw new Error('Missing DATABASE_URL');
  await pool.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  console.log('Neon: schema ready.');
} catch {
  console.error('Could not initialize database. Check DATABASE_URL and network access.');
  process.exitCode = 1;
} finally { await pool.end(); }
