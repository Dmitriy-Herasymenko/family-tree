import 'dotenv/config';
import pg from 'pg';
export const configured = Boolean(process.env.DATABASE_URL);
const connection = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (connection) connection.searchParams.set('sslmode', 'verify-full');
export const pool = new pg.Pool({ connectionString: connection?.toString(), max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000, allowExitOnIdle: true });
pool.on('error', () => console.error('PostgreSQL connection error.'));
