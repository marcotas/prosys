import { describe, it, expect } from 'vitest';
import { DomainError, NotFoundError, ValidationError, ConflictError } from './errors';

// ── DomainError ──────────────────────────────────────────

describe('DomainError', () => {
	it('sets name to "DomainError"', () => {
		const err = new DomainError('something went wrong');
		expect(err.name).toBe('DomainError');
	});

	it('preserves the message', () => {
		const err = new DomainError('something went wrong');
		expect(err.message).toBe('something went wrong');
	});

	it('is an instance of Error', () => {
		const err = new DomainError('test');
		expect(err).toBeInstanceOf(Error);
	});
});

// ── NotFoundError ────────────────────────────────────────

describe('NotFoundError', () => {
	it('sets name to "NotFoundError"', () => {
		const err = new NotFoundError('Task', 'abc-123');
		expect(err.name).toBe('NotFoundError');
	});

	it('formats message with entity and id', () => {
		const err = new NotFoundError('Task', 'abc-123');
		expect(err.message).toBe('Task not found: abc-123');
	});

	it('is an instance of DomainError', () => {
		const err = new NotFoundError('Member', 'xyz');
		expect(err).toBeInstanceOf(DomainError);
	});

	it('is an instance of Error', () => {
		const err = new NotFoundError('Habit', '999');
		expect(err).toBeInstanceOf(Error);
	});
});

// ── ValidationError ──────────────────────────────────────

describe('ValidationError', () => {
	it('sets name to "ValidationError"', () => {
		const err = new ValidationError('Name is required');
		expect(err.name).toBe('ValidationError');
	});

	it('preserves the message', () => {
		const err = new ValidationError('Day index must be 0-6');
		expect(err.message).toBe('Day index must be 0-6');
	});

	it('is an instance of DomainError', () => {
		const err = new ValidationError('invalid');
		expect(err).toBeInstanceOf(DomainError);
	});

	it('is an instance of Error', () => {
		const err = new ValidationError('invalid');
		expect(err).toBeInstanceOf(Error);
	});
});

// ── ConflictError ───────────────────────────────────────

describe('ConflictError', () => {
	it('sets name to "ConflictError"', () => {
		const err = new ConflictError('Resource already exists');
		expect(err.name).toBe('ConflictError');
	});

	it('preserves the message', () => {
		const err = new ConflictError('Habit completion already exists');
		expect(err.message).toBe('Habit completion already exists');
	});

	it('is an instance of DomainError', () => {
		const err = new ConflictError('conflict');
		expect(err).toBeInstanceOf(DomainError);
	});

	it('is an instance of Error', () => {
		const err = new ConflictError('conflict');
		expect(err).toBeInstanceOf(Error);
	});
});
