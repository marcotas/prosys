/**
 * ULID (Universally Unique Lexicographically Sortable Identifier) value object.
 *
 * 26 characters, Crockford Base32 encoded:
 *   - First 10 chars = millisecond timestamp (sortable)
 *   - Last 16 chars  = cryptographic randomness
 *
 * Alphabet: 0123456789ABCDEFGHJKMNPQRSTVWXYZ
 */

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = 32;
const ULID_LEN = 26;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

// Maximum timestamp encodable in 10 Crockford Base32 chars: 32^10 - 1
const MAX_TIME = Math.pow(ENCODING_LEN, TIME_LEN) - 1;

function encodeTime(now: number): string {
	if (now < 0 || now > MAX_TIME) {
		throw new Error(`Timestamp out of range: ${now}`);
	}

	let remaining = now;
	const chars: string[] = new Array(TIME_LEN);
	for (let i = TIME_LEN - 1; i >= 0; i--) {
		chars[i] = ENCODING[remaining % ENCODING_LEN];
		remaining = Math.floor(remaining / ENCODING_LEN);
	}
	return chars.join('');
}

function encodeRandom(): string {
	const bytes = new Uint8Array(RANDOM_LEN);
	crypto.getRandomValues(bytes);

	const chars: string[] = new Array(RANDOM_LEN);
	for (let i = 0; i < RANDOM_LEN; i++) {
		chars[i] = ENCODING[bytes[i] % ENCODING_LEN];
	}
	return chars.join('');
}

export class ID {
	private constructor(private readonly value: string) {}

	/**
	 * Generates a new ULID using the current timestamp and cryptographic randomness.
	 */
	static generate(): ID {
		const timePart = encodeTime(Date.now());
		const randomPart = encodeRandom();
		return new ID(timePart + randomPart);
	}

	/**
	 * Wraps an existing ULID string after validating its format.
	 * Throws if the string is not a valid 26-char Crockford Base32 ULID.
	 */
	static from(raw: string): ID {
		if (!ULID_REGEX.test(raw)) {
			throw new Error(`Invalid ULID: "${raw}"`);
		}
		return new ID(raw);
	}

	/**
	 * Returns the underlying ULID string.
	 */
	toString(): string {
		return this.value;
	}

	/**
	 * Value equality: two IDs are equal if they contain the same ULID string.
	 */
	equals(other: ID): boolean {
		return this.value === other.value;
	}
}
