import 'dotenv/config';
import pg from 'pg';
import { databaseConfig } from './database-config.js';
const config = databaseConfig(process.env.DATABASE_URL);
export const configured = Boolean(config.connectionString);
export const configurationIssue = config.issue;
export const pool = new pg.Pool({ connectionString: config.connectionString, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000, allowExitOnIdle: true });
pool.on('error', () => console.error('PostgreSQL connection error.'));
