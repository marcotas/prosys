# Domain-Driven Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extract business logic from Svelte stores and API routes into a framework-agnostic domain layer using TypeScript classes with the ChangeNotifier pattern.

**Architecture:** Domain entities (Task, Habit, Member) use the hybrid constructor pattern — private constructors, `create()` validates + throws, `fromData()` trusts. Collections manage `Map<string, Entity[]>` caches. ChangeNotifier provides vanilla TypeScript observable state. Controllers (deferred) will own collections and handle network/WS/offline.

**Tech Stack:** TypeScript, Vitest (already configured), Svelte 5 writable stores (for adapter)

**Design doc:** `docs/plans/2026-03-03-domain-driven-architecture-design.md`

---

## Steps

Each step is a self-contained TDD task. Execute in order — later steps depend on earlier ones.

| # | Step | File | Description |
|---|------|------|-------------|
| 1 | [Update Domain Types](ddd-steps/01-update-domain-types.md) | `src/lib/domain/types.ts` | Rename entity interfaces to `*Data`, add backward compat aliases |
| 2 | [ChangeNotifier Base Class](ddd-steps/02-change-notifier.md) | `src/lib/domain/change-notifier.ts` | Observable base class for controllers |
| 3 | [Task Entity Class](ddd-steps/03-task-entity.md) | `src/lib/domain/task.ts` | Replace pure functions with Task class |
| 4 | [TaskCollection Class](ddd-steps/04-task-collection.md) | `src/lib/domain/task-collection.ts` | Manage `Map<string, Task[]>` cache |
| 5 | [Habit Entity Class](ddd-steps/05-habit-entity.md) | `src/lib/domain/habit.ts` | Habit entity with validation |
| 6 | [HabitCollection Class](ddd-steps/06-habit-collection.md) | `src/lib/domain/habit-collection.ts` | Manage `Map<string, Habit[]>` cache |
| 7 | [Member Entity Class](ddd-steps/07-member-entity.md) | `src/lib/domain/member.ts` | Member entity with deep-copy for nested objects |
| 8 | [MemberCollection Class](ddd-steps/08-member-collection.md) | `src/lib/domain/member-collection.ts` | Manage `Map<string, Member>` cache (flat, not grouped) |
| 9 | [Svelte Adapter](ddd-steps/09-svelte-adapter.md) | `src/lib/adapters/svelte.ts` | Bridge ChangeNotifier to Svelte writable store |
| 10 | [Architecture Documentation](ddd-steps/10-architecture-documentation.md) | `docs/architecture.md` | Architecture overview, design decisions, usage patterns |

## Dependencies

```
Step 1 (types) ← Steps 3, 5, 7 (entities)
Step 3 (Task) ← Step 4 (TaskCollection)
Step 5 (Habit) ← Step 6 (HabitCollection)
Step 7 (Member) ← Step 8 (MemberCollection)
Step 2 (ChangeNotifier) ← Step 9 (Svelte adapter)
Steps 1-9 ← Step 10 (documentation)
```

Steps 2, 3, 5, 7 are independent of each other (all depend only on Step 1).
Step 10 runs last — documents the completed architecture.

## Commands

- **Run all tests:** `pnpm test`
- **Run tests in watch mode:** `pnpm test:watch`
- **Run a specific test file:** `pnpm test src/lib/domain/task.test.ts`

## What's Deferred

- **Controllers** (TaskController, HabitController, MemberController) — will own collections, handle fetch/WS/offline
- **API route migration** — controllers will replace inline logic in routes
- **Store replacement** — Svelte adapter + controllers will replace rune-based stores
- **Domain Services** — cross-entity coordination (e.g., cascading member deletion)
