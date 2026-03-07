import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

// Lazy-initialized singleton — avoids SQLITE_BUSY when multiple test files
// import repository modules in parallel and each triggers module-level DB creation.
let _sqlite: DatabaseType | null = null;
let _db: BetterSQLite3Database<typeof schema> | null = null;

function init() {
	if (_sqlite) return;

	// In production (Tauri), PROSYS_DATA_DIR points to a persistent location
	// outside the app bundle (~/Library/Application Support/com.prosys.app/).
	// In dev mode, fall back to a local ./data directory.
	const dataDir = process.env.PROSYS_DATA_DIR || resolve('data');
	const dbPath = resolve(dataDir, 'prosys.db');

	mkdirSync(dataDir, { recursive: true });

	_sqlite = new Database(dbPath);
	_sqlite.pragma('journal_mode = WAL');
	_sqlite.pragma('foreign_keys = ON');

	_db = drizzle(_sqlite, { schema });
}

export const sqlite = new Proxy({} as DatabaseType, {
	get(_target, prop, receiver) {
		init();
		return Reflect.get(_sqlite!, prop, receiver);
	}
});

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
	get(_target, prop, receiver) {
		init();
		return Reflect.get(_db!, prop, receiver);
	}
});
