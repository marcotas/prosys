import type { MemberData, CreateMemberInput, ThemeConfig } from './types';
import { ID } from './id';

export class Member {
	private constructor(private data: MemberData) {}

	static create(input: CreateMemberInput): Member {
		const errors: string[] = [];
		if (!input.name?.trim()) errors.push('Name is required');
		if (errors.length > 0) throw new Error(errors.join('; '));

		const now = new Date().toISOString();
		return new Member({
			id: ID.generate().toString(),
			name: input.name.trim(),
			theme: { ...input.theme },
			quote: { ...input.quote },
			createdAt: now,
			updatedAt: now
		});
	}

	static fromData(data: MemberData): Member {
		return new Member({
			...data,
			theme: { ...data.theme },
			quote: { ...data.quote }
		});
	}

	// ── Getters ──────────────────────────────────────────

	get id(): string {
		return this.data.id;
	}

	get name(): string {
		return this.data.name;
	}

	get theme(): ThemeConfig {
		return { ...this.data.theme };
	}

	get quote(): { text: string; author: string } {
		return { ...this.data.quote };
	}

	get createdAt(): string {
		return this.data.createdAt;
	}

	get updatedAt(): string {
		return this.data.updatedAt;
	}

	// ── Mutations ────────────────────────────────────────

	updateName(name: string): void {
		if (!name.trim()) throw new Error('Name cannot be empty');
		this.data.name = name.trim();
		this.data.updatedAt = new Date().toISOString();
	}

	updateTheme(theme: ThemeConfig): void {
		this.data.theme = { ...theme };
		this.data.updatedAt = new Date().toISOString();
	}

	updateQuote(quote: { text: string; author: string }): void {
		this.data.quote = { ...quote };
		this.data.updatedAt = new Date().toISOString();
	}

	// ── Serialization ────────────────────────────────────

	toJSON(): MemberData {
		return {
			...this.data,
			theme: { ...this.data.theme },
			quote: { ...this.data.quote }
		};
	}

	clone(): Member {
		return Member.fromData(this.toJSON());
	}
}
