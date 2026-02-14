# Gotchas

Non-obvious pitfalls discovered through debugging, with cause and fix for each.

## 1. Svelte 5 `$state<Map>` reactivity

**Symptom**: Optimistic updates modify the store but `$derived` in components never re-fires.

**Cause**: `$state<Map>()` creates a deep reactive proxy. When the entire Map is replaced (which happens on every mutation), `$derived` computations in other components may not detect the change.

**Fix**: Use `$state.raw<Map>()` for collections that are replaced on mutation. This switches to reference-level tracking.

```ts
// BAD -- deep proxy, derived may not fire
let weekCache = $state<Map<string, Task[]>>(new Map());

// GOOD -- reference tracking, works correctly
let weekCache = $state.raw<Map<string, Task[]>>(new Map());
```

**Affected files**: `src/lib/stores/tasks.svelte.ts`, `src/lib/stores/habits.svelte.ts`

## 2. Vite SSR externals: dev vs production

**Symptom**: Dev: `require is not defined`. Production: `ERR_MODULE_NOT_FOUND: Cannot find package 'ws'`.

**Cause**: CJS packages (`ws`, `qrcode`) use `require()` internally. In dev, Vite's ESM SSR loader can't handle this. In production, Vite transforms CJS to ESM during the build -- but if the package is marked `external`, it stays as a bare `import` and must exist in `node_modules/`.

**Fix**: Externalize CJS packages only in dev mode. In production, let Vite bundle them.

```ts
// vite.config.ts
export default defineConfig(({ command }) => ({
  ssr: {
    noExternal: true,
    external: command === 'serve'
      ? ['better-sqlite3', 'ws', 'qrcode']   // dev: keep external
      : ['better-sqlite3']                     // prod: only native addons
  }
}));
```

**Rule**: Native addons (e.g., `better-sqlite3`) must ALWAYS be external. Pure-JS packages should only be external in dev if they cause CJS issues.

## 3. `crypto.randomUUID()` on LAN HTTP

**Symptom**: `TypeError: crypto.randomUUID is not a function` on mobile Safari.

**Cause**: `crypto.randomUUID()` requires a secure context (HTTPS or localhost). LAN connections via `http://10.x.x.x` are not secure contexts.

**Fix**: Wrap in try/catch with a fallback.

```ts
try {
  clientId = crypto.randomUUID();
} catch {
  clientId = 'fb-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
```

**Affected file**: `src/lib/stores/ws.svelte.ts`

## 4. App bundle is ephemeral

**Symptom**: Database and user data lost after every `pnpm tauri:build`.

**Cause**: `ProSys.app/Contents/Resources/` is recreated from scratch on every build. Any files written inside the bundle (database, config) are destroyed.

**Fix**: Store persistent data outside the bundle via `PROSYS_DATA_DIR` env var, set by Tauri's `app.path().app_data_dir()` (resolves to `~/Library/Application Support/com.prosys.app/`).

**Affected files**: `src-tauri/src/lib.rs`, `src/lib/server/db/index.ts`

## 5. SvelteKit API routes skip layout loaders

**Symptom**: `SqliteError: no such table: family_members` on direct API call.

**Cause**: `runMigrations()` runs as module-level code in `+layout.server.ts`, which only executes on page loads. API routes (`+server.ts`) do NOT go through layout server loaders. A direct API call (e.g., curl) before any page has loaded hits an uninitialized database.

**Implication**: In practice, the Tauri webview loads a page first (triggering migrations), so this only matters for direct API testing. Be aware when testing endpoints via curl.

## 6. esbuild CJS-to-ESM banner

**Context**: The production `server.js` is bundled by esbuild with `--format=esm`. CJS packages bundled into ESM lose access to `require()`.

**Fix**: The banner in `scripts/prepare-server-bundle.js` injects a `require()` polyfill:

```js
const banner = "import { createRequire as __createRequire } from 'module';"
             + "const require = __createRequire(import.meta.url);";
```

**Rule**: If adding new CJS dependencies to `server.js`, they will be handled by this banner. No action needed unless the dependency does something unusual with `require.resolve()` paths.

## 7. pnpm strict isolation for native addons

**Context**: pnpm's strict `node_modules` structure means transitive dependencies of native addons aren't hoisted.

**Fix**: `prepare-server-bundle.js` resolves each package via chained `createRequire()` from its parent package's context:

```
better-sqlite3 (resolved from project root)
  -> bindings (resolved from better-sqlite3's context)
    -> file-uri-to-path (resolved from bindings' context)
```

**Rule**: When adding new native addon dependencies, add them to the copy chain in `prepare-server-bundle.js` following this pattern.
