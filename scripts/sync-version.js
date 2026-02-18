/**
 * Sync the version from package.json → tauri.conf.json and Cargo.toml.
 *
 * Run this after `pnpm changeset version` so all three files stay in sync.
 * The Tauri app reads its version from tauri.conf.json at build time via
 * `app.package_info().version`, which drives the upgrade/cache-clearing
 * logic in src-tauri/src/lib.rs.
 *
 * Usage: node scripts/sync-version.js
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Read source of truth ─────────────────────────────────────────────────
const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

if (!version) {
	console.error('Error: could not read version from package.json');
	process.exit(1);
}

console.log(`Syncing version ${version} to Tauri files…`);

// ── Sync tauri.conf.json ─────────────────────────────────────────────────
const tauriConfPath = resolve(root, 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(readFileSync(tauriConfPath, 'utf8'));
const prevTauriVersion = tauriConf.version;
tauriConf.version = version;
writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
console.log(`  tauri.conf.json: ${prevTauriVersion} → ${version}`);

// ── Sync Cargo.toml ──────────────────────────────────────────────────────
// Regex targets only the [package] section's version field, not dependency
// versions.  The pattern matches from [package] up to (but not including)
// the next section header.
const cargoPath = resolve(root, 'src-tauri', 'Cargo.toml');
const cargo = readFileSync(cargoPath, 'utf8');

const cargoMatch = cargo.match(/^\[package\][^[]*version\s*=\s*"([^"]+)"/ms);

if (!cargoMatch) {
	console.warn('  Warning: Cargo.toml version field not found in [package] section.');
} else {
	const prevCargoVersion = cargoMatch[1];
	const cargoUpdated = cargo.replace(
		/^(\[package\][^[]*version\s*=\s*")([^"]+)(")/ms,
		`$1${version}$3`
	);
	writeFileSync(cargoPath, cargoUpdated, 'utf8');
	console.log(`  Cargo.toml:      ${prevCargoVersion} → ${version}`);
}

console.log('Done.');
