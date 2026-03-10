// See https://svelte.dev/docs/kit/types#app.d.ts

declare global {
	/** App version injected by Vite at build time from package.json */
	const __APP_VERSION__: string;

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
