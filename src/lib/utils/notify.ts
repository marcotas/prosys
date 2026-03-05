import { toast } from 'svelte-sonner';
import { browser } from '$app/environment';

export function notifyError(message: string) {
	if (browser) toast.error(message);
}
