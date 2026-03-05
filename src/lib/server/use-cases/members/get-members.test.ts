import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetMembers } from './get-members';
import type { MemberRepository } from '$lib/server/repositories/member-repository';
import type { MemberData, ThemeConfig } from '$lib/domain/types';

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

describe('GetMembers', () => {
	let repo: ReturnType<typeof createMockRepo>;
	let useCase: GetMembers;

	beforeEach(() => {
		repo = createMockRepo();
		useCase = new GetMembers(repo);
	});

	it('returns existing members when DB is not empty', () => {
		const members = [
			makeMemberData({ id: 'm1', name: 'Alice' }),
			makeMemberData({ id: 'm2', name: 'Bob' })
		];
		vi.mocked(repo.count).mockReturnValue(2);
		vi.mocked(repo.findAll).mockReturnValue(members);

		const result = useCase.execute();

		expect(result).toEqual(members);
		expect(result).toHaveLength(2);
		expect(repo.insert).not.toHaveBeenCalled();
	});

	it('seeds 4 default members when DB is empty', () => {
		vi.mocked(repo.count).mockReturnValue(0);
		vi.mocked(repo.findAll).mockReturnValue([]);

		useCase.execute();

		expect(repo.insert).toHaveBeenCalledTimes(4);
	});

	it('seeds Marco, Alice, Susana, Pedro in that order', () => {
		vi.mocked(repo.count).mockReturnValue(0);
		vi.mocked(repo.findAll).mockReturnValue([]);

		useCase.execute();

		const insertCalls = vi.mocked(repo.insert).mock.calls;
		expect(insertCalls[0][0].name).toBe('Marco');
		expect(insertCalls[1][0].name).toBe('Alice');
		expect(insertCalls[2][0].name).toBe('Susana');
		expect(insertCalls[3][0].name).toBe('Pedro');
	});

	it('seeds with correct theme variants', () => {
		vi.mocked(repo.count).mockReturnValue(0);
		vi.mocked(repo.findAll).mockReturnValue([]);

		useCase.execute();

		const insertCalls = vi.mocked(repo.insert).mock.calls;
		expect(insertCalls[0][0].theme.variant).toBe('default'); // Marco
		expect(insertCalls[1][0].theme.variant).toBe('playful'); // Alice
		expect(insertCalls[2][0].theme.variant).toBe('playful'); // Susana
		expect(insertCalls[3][0].theme.variant).toBe('playful'); // Pedro
	});

	it('seeds with correct accent colors', () => {
		vi.mocked(repo.count).mockReturnValue(0);
		vi.mocked(repo.findAll).mockReturnValue([]);

		useCase.execute();

		const insertCalls = vi.mocked(repo.insert).mock.calls;
		expect(insertCalls[0][0].theme.accent).toBe('#4a7c59'); // Marco - green
		expect(insertCalls[1][0].theme.accent).toBe('#8b5cf6'); // Alice - purple
		expect(insertCalls[2][0].theme.accent).toBe('#ec4899'); // Susana - pink
		expect(insertCalls[3][0].theme.accent).toBe('#3b82f6'); // Pedro - blue
	});

	it('seeds with correct quotes', () => {
		vi.mocked(repo.count).mockReturnValue(0);
		vi.mocked(repo.findAll).mockReturnValue([]);

		useCase.execute();

		const insertCalls = vi.mocked(repo.insert).mock.calls;
		expect(insertCalls[0][0].quote.author).toBe('James Clear');
		expect(insertCalls[1][0].quote.author).toBe('Oscar Wilde');
		expect(insertCalls[2][0].quote.author).toBe('Winnie the Pooh');
		expect(insertCalls[3][0].quote.author).toBe('Buzz Lightyear');
	});

	it('seeds with correct emojis', () => {
		vi.mocked(repo.count).mockReturnValue(0);
		vi.mocked(repo.findAll).mockReturnValue([]);

		useCase.execute();

		const insertCalls = vi.mocked(repo.insert).mock.calls;
		expect(insertCalls[0][0].theme.emoji).toBe(''); // Marco - no emoji
		expect(insertCalls[1][0].theme.emoji).toBe('\u{1F984}'); // Alice - unicorn
		expect(insertCalls[2][0].theme.emoji).toBe('\u{1F338}'); // Susana - cherry blossom
		expect(insertCalls[3][0].theme.emoji).toBe('\u{1F680}'); // Pedro - rocket
	});

	it('returns result from findAll after seeding', () => {
		const seededMembers = [
			makeMemberData({ id: 'm1', name: 'Marco' }),
			makeMemberData({ id: 'm2', name: 'Alice' })
		];
		vi.mocked(repo.count).mockReturnValue(0);
		vi.mocked(repo.findAll).mockReturnValue(seededMembers);

		const result = useCase.execute();

		expect(result).toEqual(seededMembers);
		expect(repo.findAll).toHaveBeenCalledOnce();
	});

	it('does not seed when there is at least one member', () => {
		vi.mocked(repo.count).mockReturnValue(1);
		vi.mocked(repo.findAll).mockReturnValue([makeMemberData()]);

		useCase.execute();

		expect(repo.insert).not.toHaveBeenCalled();
	});
});
