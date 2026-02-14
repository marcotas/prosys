import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const DB_PATH = resolve('data', 'prosys.db');

// Ensure data directory exists
mkdirSync(resolve('data'), { recursive: true });

const sqlite = new Database(DB_PATH);

// Enable WAL mode for concurrent reads
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };
