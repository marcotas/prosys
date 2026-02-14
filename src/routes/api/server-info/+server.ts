import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import os from 'node:os';

/** Returns the server's LAN IPv4 address and port so clients can build the connect URL. */
export const GET: RequestHandler = ({ request }) => {
	const nets = os.networkInterfaces();
	let ip = 'localhost';

	for (const iface of Object.values(nets)) {
		for (const entry of iface ?? []) {
			if (entry.family === 'IPv4' && !entry.internal) {
				ip = entry.address;
				break;
			}
		}
		if (ip !== 'localhost') break;
	}

	// Derive port from the Host header so it works in both dev (5173) and prod (3000)
	const host = request.headers.get('host') ?? '';
	const portMatch = host.match(/:(\d+)$/);
	const port = portMatch ? parseInt(portMatch[1], 10) : 80;

	return json({ ip, port });
};
