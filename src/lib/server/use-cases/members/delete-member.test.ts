import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteMember } from './delete-member';
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

describe('DeleteMember', () => {
	let repo: ReturnType<typeof createMockRepo>;
	let useCase: DeleteMember;

	beforeEach(() => {
		repo = createMockRepo();
		useCase = new DeleteMember(repo);
	});

	it('deletes an existing member', () => {
		const existing = makeMemberData();
		vi.mocked(repo.findById).mockReturnValue(existing);

		useCase.execute('member-1');

		expect(repo.findById).toHaveBeenCalledWith('member-1');
		expect(repo.delete).toHaveBeenCalledOnce();
		expect(repo.delete).toHaveBeenCalledWith('member-1');
	});

	it('throws NotFoundError when member does not exist', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		expect(() => useCase.execute('nonexistent')).toThrow(NotFoundError);
		expect(() => useCase.execute('nonexistent')).toThrow(
			'Member not found: nonexistent'
		);
	});

	it('does not call delete when member is not found', () => {
		vi.mocked(repo.findById).mockReturnValue(null);

		try {
			useCase.execute('nonexistent');
		} catch {
			// Expected
		}

		expect(repo.delete).not.toHaveBeenCalled();
	});
});
