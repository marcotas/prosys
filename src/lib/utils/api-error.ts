export class ApiError extends Error {
	constructor(message: string, public status: number) {
		super(message);
		this.name = 'ApiError';
	}
}

/** Parse a non-ok fetch response into an ApiError with the server's error message */
export async function throwApiError(res: Response): Promise<never> {
	let message: string;
	try {
		const body = await res.json();
		message = body.error || `Request failed (${res.status})`;
	} catch {
		message = `Request failed (${res.status})`;
	}
	throw new ApiError(message, res.status);
}
