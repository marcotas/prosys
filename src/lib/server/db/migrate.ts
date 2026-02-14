import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './index.js';

let migrated = false;

/**
 * Run pending migrations. Idempotent — only runs once per process.
 */
export function runMigrations() {
	if (migrated) return;
	migrate(db, { migrationsFolder: 'drizzle' });
	migrated = true;
}
