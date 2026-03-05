import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateMember } from './create-member';
import type { MemberRepository } from '$lib/server/repositories/member-repository';
import type { ThemeConfig } from '$lib/domain/types';

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

describe('CreateMember', () => {
	let repo: ReturnType<typeof createMockRepo>;
	let useCase: CreateMember;

	beforeEach(() => {
		repo = createMockRepo();
		useCase = new CreateMember(repo);
	});

	it('creates a member and inserts it via the repository', () => {
		const input = {
			name: 'Alice',
			theme: testTheme,
			quote: { text: 'Hello world', author: 'Alice' }
		};

		const result = useCase.execute(input);

		expect(result.name).toBe('Alice');
		expect(result.theme).toEqual(testTheme);
		expect(result.quote).toEqual({ text: 'Hello world', author: 'Alice' });
		expect(result.id).toBeTruthy();
		expect(result.createdAt).toBeTruthy();
		expect(result.updatedAt).toBeTruthy();
		expect(repo.insert).toHaveBeenCalledOnce();
		expect(repo.insert).toHaveBeenCalledWith(result);
	});

	it('trims whitespace from name', () => {
		const input = {
			name: '  Alice  ',
			theme: testTheme,
			quote: { text: 'Hello', author: 'Alice' }
		};

		const result = useCase.execute(input);

		expect(result.name).toBe('Alice');
	});

	it('throws ValidationError when name is empty', () => {
		const input = {
			name: '',
			theme: testTheme,
			quote: { text: 'Hello', author: 'Alice' }
		};

		expect(() => useCase.execute(input)).toThrow('Name is required');
	});

	it('throws ValidationError when name is whitespace only', () => {
		const input = {
			name: '   ',
			theme: testTheme,
			quote: { text: 'Hello', author: 'Alice' }
		};

		expect(() => useCase.execute(input)).toThrow('Name is required');
	});

	it('does not call repository insert when validation fails', () => {
		const input = {
			name: '',
			theme: testTheme,
			quote: { text: 'Hello', author: 'Alice' }
		};

		try {
			useCase.execute(input);
		} catch {
			// Expected
		}

		expect(repo.insert).not.toHaveBeenCalled();
	});

	it('generates unique ids for each member', () => {
		const input = {
			name: 'Alice',
			theme: testTheme,
			quote: { text: 'Hello', author: 'Alice' }
		};

		const result1 = useCase.execute(input);
		const result2 = useCase.execute(input);

		expect(result1.id).not.toBe(result2.id);
	});
});
