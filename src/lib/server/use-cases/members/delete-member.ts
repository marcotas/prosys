import { NotFoundError } from '$lib/server/domain/errors';
import type { MemberRepository } from '$lib/server/repositories/member-repository';
import { memberRepository } from '$lib/server/repositories/member-repository';

export class DeleteMember {
	constructor(private memberRepo: MemberRepository) {}

	execute(id: string): void {
		const existing = this.memberRepo.findById(id);
		if (!existing) throw new NotFoundError('Member', id);
		this.memberRepo.delete(id);
	}
}

/** Singleton wired to the real repository */
export const deleteMember = new DeleteMember(memberRepository);
