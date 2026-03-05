import { Member } from '$lib/domain/member';
import type { CreateMemberInput, MemberData } from '$lib/domain/types';
import type { MemberRepository } from '$lib/server/repositories/member-repository';
import { memberRepository } from '$lib/server/repositories/member-repository';
import { ValidationError } from '$lib/server/domain/errors';

export class CreateMember {
	constructor(private memberRepo: MemberRepository) {}

	execute(input: CreateMemberInput): MemberData {
		let member: Member;
		try {
			member = Member.create(input);
		} catch (err) {
			throw new ValidationError((err as Error).message);
		}
		const data = member.toJSON();
		this.memberRepo.insert(data);
		return data;
	}
}

/** Singleton wired to the real repository */
export const createMember = new CreateMember(memberRepository);
