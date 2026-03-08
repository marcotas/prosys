export class DomainError extends Error {
	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}

export class NotFoundError extends DomainError {
	constructor(entity: string, id: string) {
		super(`${entity} not found: ${id}`);
	}
}

export class ValidationError extends DomainError {
	constructor(message: string) {
		super(message);
	}
}

export class ConflictError extends DomainError {
	constructor(message: string) {
		super(message);
	}
}
