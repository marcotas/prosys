import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateMember } from './update-member';
import type { MemberData, ThemeConfig } from '$lib/domain/types';
import type { MemberRepository } from '$lib/server/repositories/member-repository';
import { NotFoundError } from '$lib/server/domain/errors';

const testTheme: ThemeConfig = {
	variant: 'default',
	accent: '#4a7c59',
	accentLight: '#dcfce7',
	accentDark: '#1e3a24',
	headerBg: '#4a7c59',
	ringColor: '#4a7c59',
	checkColor: '#4a7c59',
	emoji: ''
};

function makeMemberData(overrides: Partial<MemberData> = {}): MemberData {
	return {
		id: 'member-1',
		name: 'Alice',
		theme: { ...testTheme },
		quote: { text: 'Hello world', author: 'Alice' },
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides
	};
}

function createMockRepo(): MemberRepository {
	return {
		findById: vi.fn(),
		findAll: vi.fn(),
		count: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
		updatePartial: vi.fn(),
		delete: vi.fn()
	} as unknown as MemberRepository;
}

describe('UpdateMember', () => {
	let repo: ReturnType<typeof createMockRepo>;
	let useCase: UpdateMember;

	beforeEach(() => {
		repo = createMockRepo();
		useCase = new UpdateMember(repo);
	});

	it('updates a member name and returns updated data', () => {
		const existing = makeMemberData();
		const updated = makeMemberData({ name: 'Bob', updatedAt: '2026-06-01T00:00:00.000Z' });
		vi.mocked(repo.findById)
			.mockReturnValueOnce(existing) // first call: existence check
			.mockReturnValueOnce(updated); // second call: return updated

		const result = useCase.execute('member-1', { name: 'Bob' });

		expect(result.name).toBe('Bob');
		expect(repo.updatePartial).toHaveBeenCalledOnce();
		const [id, fields] = vi.mocked(repo.updatePartial).mock.calls[0];
		expect(id).toBe('member-1');
		expect(fields.name).toBe('Bob');
		expect(fields.updatedAt).toBeTruthy();
	});

	it('updates theme only', () => {
		const existing = makeMemberData();
		const newTheme: ThemeConfig = {
			...testTheme,
			variant: 'playful',
			accent: '#8b5cf6',
			emoji: '🦄'
		};
		const updated = makeMemberData({ theme: newTheme, updatedAt: '2026-06-01T00:00:00.000Z' });
		vi.mocked(repo.findById)
			.mockReturnValueOnce(existing)
			.mockReturnValueOnce(updated);

		const result = useCase.execute('member-1', { theme: newTheme });

		expect(result.theme.variant).toBe('playful');
		expect(result.theme.accent).toBe('#8b5cf6');
		const [, fields] = vi.mocked(repo.updatePartial).mock.calls[0];
		expect(fields.theme).toEqual(newTheme);
		expect(fields.name).toBeUndefined();
	});

	it('updates quote only', () => {
		const existing = makeMemberData();
		const newQuote = { text: 'New quote', author: 'Bob' };
		const updated = makeMemberData({ quote: newQuote, updatedAt: '2026-06-01T00:00:00.000Z' });
		vi.mocked(repo.findById)
			.mockReturnValueOnce(existing)
			.mockReturnValueOnce(updated);

		const result = useCase.execute('member-1', { quote: newQuote });

		expect(result.quote).toEqual(newQuote);
		const [, fields] = vi.mocked(repo.updatePartial).mock.calls[0];
		expect(fields.quote).toEqual(newQuote);
		expect(fields.name).toBeUndefined();
		expect(fields.theme).toBeUndefined();
	});

	it('updates multiple fields at once', () => {
		const existing = makeMemberData();
		const newTheme: ThemeConfig = { ...testTheme, accent: '#ff0000' };
		const newQuote = { text: 'Updated', author: 'Updated' };
		const updated = makeMemberData({
			name: 'Charlie',
			theme: newTheme,
			quote: newQuote,
			updatedAt: '2026-06-01T00:00:00.000Z'
		});
		vi.mocked(repo.findById)
			.mockReturnValueOnce(existing)
			.mockReturnValueOnce(updated);

		const result = useCase.execute('member-1', {
			name: 'Charlie',
			theme: newTheme,
			quote: newQuote
		});

		expect(result.name).toBe('Charlie');
		expect(result.theme.accent).toBe('#ff0000');
		expect(result.quote.text).toBe('Updated');
	});

	it('trims whitespace from name', () => {
		const existing = makeMemberData();
		const updated = makeMemberData({ name: 'Bob', updatedAt: '2026-06-01T00:00:00.000Z' });
		vi.mocked(repo.findById)
			.mockReturnValueOnce(existing)
			.mockReturnValueOnce(updated);

		useCase.execute('member-1', { name: '  Bob  ' });

		const [, fields] = vi.mocked(repo.updatePartial).mock.calls[0];
		expect(fields.name).toBe('Bob');
	});

	it('throws NotFoundError when member does not exist', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		expect(() => useCase.execute('nonexistent', { name: 'Bob' })).toThrow(NotFoundError);
		expect(() => useCase.execute('nonexistent', { name: 'Bob' })).toThrow(
			'Member not found: nonexistent'
		);
	});

	it('does not call updatePartial when member is not found', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		try {
			useCase.execute('nonexistent', { name: 'Bob' });
		} catch {
			// Expected
		}

		expect(repo.updatePartial).not.toHaveBeenCalled();
	});

	it('always sets updatedAt timestamp', () => {
		const existing = makeMemberData();
		vi.mocked(repo.findById)
			.mockReturnValueOnce(existing)
			.mockReturnValueOnce(existing);

		useCase.execute('member-1', { name: 'Bob' });

		const [, fields] = vi.mocked(repo.updatePartial).mock.calls[0];
		expect(fields.updatedAt).toBeTruthy();
		expect(typeof fields.updatedAt).toBe('string');
	});
});
