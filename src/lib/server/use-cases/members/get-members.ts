import { Member } from '$lib/domain/member';
import type { MemberData, ThemeConfig } from '$lib/domain/types';
import type { MemberRepository } from '$lib/server/repositories/member-repository';
import { memberRepository } from '$lib/server/repositories/member-repository';

// ── Seed data ───────────────────────────────────────────

const seedMembers: { name: string; theme: ThemeConfig; quote: { text: string; author: string } }[] =
	[
		{
			name: 'Marco',
			theme: {
				variant: 'default',
				accent: '#4a7c59',
				accentLight: '#dcfce7',
				accentDark: '#1e3a24',
				headerBg: '#4a7c59',
				ringColor: '#4a7c59',
				checkColor: '#4a7c59',
				emoji: ''
			},
			quote: { text: 'Tiny Changes, Remarkable Results', author: 'James Clear' }
		},
		{
			name: 'Alice',
			theme: {
				variant: 'playful',
				accent: '#8b5cf6',
				accentLight: '#ede9fe',
				accentDark: '#4c1d95',
				headerBg: '#8b5cf6',
				ringColor: '#8b5cf6',
				checkColor: '#8b5cf6',
				emoji: '🦄'
			},
			quote: { text: 'Be yourself; everyone else is already taken', author: 'Oscar Wilde' }
		},
		{
			name: 'Susana',
			theme: {
				variant: 'playful',
				accent: '#ec4899',
				accentLight: '#fce7f3',
				accentDark: '#831843',
				headerBg: '#ec4899',
				ringColor: '#ec4899',
				checkColor: '#ec4899',
				emoji: '🌸'
			},
			quote: {
				text: 'You are braver than you believe, stronger than you seem, and smarter than you think',
				author: 'Winnie the Pooh'
			}
		},
		{
			name: 'Pedro',
			theme: {
				variant: 'playful',
				accent: '#3b82f6',
				accentLight: '#dbeafe',
				accentDark: '#1e3a5f',
				headerBg: '#3b82f6',
				ringColor: '#3b82f6',
				checkColor: '#3b82f6',
				emoji: '🚀'
			},
			quote: { text: 'To infinity and beyond!', author: 'Buzz Lightyear' }
		}
	];

export class GetMembers {
	constructor(private memberRepo: MemberRepository) {}

	execute(): MemberData[] {
		if (this.memberRepo.count() === 0) {
			for (const m of seedMembers) {
				const member = Member.create(m);
				this.memberRepo.insert(member.toJSON());
			}
		}
		return this.memberRepo.findAll();
	}
}

/** Singleton wired to the real repository */
export const getMembers = new GetMembers(memberRepository);
