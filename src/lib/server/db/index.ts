import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

// In production (Tauri), PROSYS_DATA_DIR points to a persistent location
// outside the app bundle (~/Library/Application Support/com.prosys.app/).
// In dev mode, fall back to a local ./data directory.
const dataDir = process.env.PROSYS_DATA_DIR || resolve('data');
const DB_PATH = resolve(dataDir, 'prosys.db');

// Ensure data directory exists
mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(DB_PATH);

// Enable WAL mode for concurrent reads
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };
