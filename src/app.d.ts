// See https://svelte.dev/docs/kit/types#app.d.ts

/** App version injected by Vite at build time from package.json */
declare const __APP_VERSION__: string;

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** WebSocket client ID from X-WS-Client-Id header */
			wsClientId?: string;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
