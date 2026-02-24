/**
 * Prepare the server bundle for Tauri production builds.
 *
 * 1. Uses esbuild to bundle server.js with all pure-JS dependencies inlined.
 *    - `better-sqlite3` is kept external (native addon).
 *    - `./build/handler.js` is kept external (SvelteKit build output).
 * 2. Copies the SvelteKit build output (build/) into the bundle.
 * 3. Copies the better-sqlite3 native addon and its JS dependencies
 *    (bindings, file-uri-to-path) into a local node_modules/.
 *
 * The result is a self-contained `src-tauri/server-bundle/` directory that
 * Tauri includes as a resource in the .app bundle.
 */

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, existsSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = resolve(root, 'src-tauri', 'server-bundle');

// ── Clean output directory ───────────────────────────────────────────────
if (existsSync(outDir)) {
	rmSync(outDir, { recursive: true });
}
mkdirSync(outDir, { recursive: true });

// ── 1. Bundle server.js with esbuild ─────────────────────────────────────
console.log('Bundling server.js with esbuild…');

// The banner provides a real require() function so that CJS packages (ws,
// bonjour-service) bundled into ESM format can require() Node.js built-in
// modules like 'events', 'http', 'stream', etc.
const banner =
	"import { createRequire as __createRequire } from 'module';" +
	'const require = __createRequire(import.meta.url);';

execSync(
	[
		'pnpm exec esbuild',
		resolve(root, 'server.js'),
		'--bundle',
		'--platform=node',
		'--format=esm',
		`--outfile=${resolve(outDir, 'server.js')}`,
		'--external:better-sqlite3',
		'--external:./build/handler.js',
		`--banner:js="${banner}"`
	].join(' '),
	{ cwd: root, stdio: 'inherit' }
);

// ── 2. Copy SvelteKit build output ───────────────────────────────────────
console.log('Copying build/ directory…');

cpSync(resolve(root, 'build'), resolve(outDir, 'build'), {
	recursive: true,
	dereference: true
});

// ── 3. Copy Drizzle migration files ──────────────────────────────────────
// The server runs migrate() on startup looking for a 'drizzle/' directory
// relative to its working directory.
const drizzleDir = resolve(root, 'drizzle');
if (existsSync(drizzleDir)) {
	cpSync(drizzleDir, resolve(outDir, 'drizzle'), { recursive: true });
	console.log('Copied drizzle/ migration files');
} else {
	console.warn('⚠ drizzle/ directory not found — migrations will be skipped');
}

// ── 4. Copy better-sqlite3 and its dependencies ─────────────────────────
//
// These packages cannot be bundled by esbuild because better-sqlite3 is a
// native addon. We use require.resolve() to locate them within pnpm's
// nested node_modules structure and copy the real directories.
console.log('Copying native module dependencies…');

const nodeModulesOut = resolve(outDir, 'node_modules');
mkdirSync(nodeModulesOut, { recursive: true });

/**
 * Resolve a package's root directory, walking up from the entry point.
 * Uses the given `requireFn` so we can resolve transitive deps from
 * within their parent package (needed for pnpm's strict isolation).
 */
function resolvePackageDir(requireFn, pkgName) {
	try {
		const entry = requireFn.resolve(pkgName);
		let dir = dirname(entry);
		while (dir && !dir.endsWith(`node_modules/${pkgName}`)) {
			const parent = dirname(dir);
			if (parent === dir) return null;
			dir = parent;
		}
		return realpathSync(dir);
	} catch {
		return null;
	}
}

// Resolve better-sqlite3 from the project root
const rootRequire = createRequire(resolve(root, 'package.json'));
const betterSqlite3Dir = resolvePackageDir(rootRequire, 'better-sqlite3');

// Resolve bindings from better-sqlite3's context (transitive dep)
let bindingsDir = null;
if (betterSqlite3Dir) {
	const bsRequire = createRequire(resolve(betterSqlite3Dir, 'package.json'));
	bindingsDir = resolvePackageDir(bsRequire, 'bindings');
}

// Resolve file-uri-to-path from bindings' context (transitive dep)
let fileUriDir = null;
if (bindingsDir) {
	const bindingsRequire = createRequire(resolve(bindingsDir, 'package.json'));
	fileUriDir = resolvePackageDir(bindingsRequire, 'file-uri-to-path');
}

const pkgsToCopy = [
	['better-sqlite3', betterSqlite3Dir],
	['bindings', bindingsDir],
	['file-uri-to-path', fileUriDir]
];

for (const [name, src] of pkgsToCopy) {
	const dest = resolve(nodeModulesOut, name);
	if (src) {
		cpSync(src, dest, { recursive: true, dereference: true });
		console.log(`  ✓ ${name} (from ${src})`);
	} else {
		console.warn(`  ⚠ ${name} could not be resolved — skipping`);
	}
}

// ── 5. Codesign native binaries (CI only) ───────────────────────────────
// Apple notarization requires every binary in the app bundle to be signed
// with a Developer ID certificate. Tauri signs its own binaries but not
// resource files like .node native addons.
const signingIdentity = process.env.APPLE_SIGNING_IDENTITY;
if (signingIdentity) {
	console.log('Signing native binaries for notarization…');
	signNativeBinaries(outDir, signingIdentity);
} else {
	console.log('Skipping native binary signing (no APPLE_SIGNING_IDENTITY)');
}

console.log('Server bundle ready at src-tauri/server-bundle/');

/**
 * Recursively find and codesign all .node and .dylib files in a directory.
 * Required for Apple notarization — every binary must be signed.
 */
function signNativeBinaries(dir, identity) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = resolve(dir, entry.name);
		if (entry.isDirectory()) {
			signNativeBinaries(fullPath, identity);
		} else if (entry.name.endsWith('.node') || entry.name.endsWith('.dylib')) {
			console.log(`  signing ${entry.name}…`);
			execSync(
				`codesign --force --sign "${identity}" --timestamp --options runtime "${fullPath}"`,
				{ stdio: 'inherit' }
			);
			console.log(`  ✓ ${entry.name}`);
		}
	}
}
