import type { MemberData, UpdateMemberInput } from '$lib/domain/types';
import type { MemberRepository } from '$lib/server/repositories/member-repository';
import { NotFoundError } from '$lib/server/domain/errors';
import { memberRepository } from '$lib/server/repositories/member-repository';

export class UpdateMember {
	constructor(private memberRepo: MemberRepository) {}

	execute(id: string, input: UpdateMemberInput): MemberData {
		const existing = this.memberRepo.findById(id);
		if (!existing) throw new NotFoundError('Member', id);

		const fields: Record<string, unknown> = {
			updatedAt: new Date().toISOString()
		};

		if (input.name !== undefined) fields.name = input.name.trim();
		if (input.theme !== undefined) fields.theme = input.theme;
		if (input.quote !== undefined) fields.quote = input.quote;

		this.memberRepo.updatePartial(id, fields);
		return this.memberRepo.findById(id)!;
	}
}

/** Singleton wired to the real repository */
export const updateMember = new UpdateMember(memberRepository);
