import { runMigrations } from '$lib/server/db/migrate.js';

// Run migrations once on first request
runMigrations();

export const load = async () => {
	return {};
};
