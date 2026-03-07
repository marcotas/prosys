import { throwApiError } from '$lib/utils/api-error';

export class ApiClient {
	private clientId = '';

	setClientId(id: string): void {
		this.clientId = id;
	}

	async get<T>(url: string): Promise<T> {
		return this.request<T>('GET', url);
	}

	async post<T>(url: string, body?: unknown): Promise<T> {
		return this.request<T>('POST', url, body);
	}

	async patch<T>(url: string, body?: unknown): Promise<T> {
		return this.request<T>('PATCH', url, body);
	}

	async put<T>(url: string, body?: unknown): Promise<T> {
		return this.request<T>('PUT', url, body);
	}

	async delete<T>(url: string): Promise<T> {
		return this.request<T>('DELETE', url);
	}

	/** Returns headers needed for offline queue replay (X-WS-Client-Id). */
	getHeaders(): Record<string, string> {
		return this.clientId ? { 'X-WS-Client-Id': this.clientId } : {};
	}

	private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};
		if (this.clientId) {
			headers['X-WS-Client-Id'] = this.clientId;
		}

		const init: RequestInit = { method, headers };
		if (body !== undefined) {
			init.body = JSON.stringify(body);
		}

		const res = await fetch(url, init);
		if (!res.ok) await throwApiError(res);
		return res.json();
	}
}
