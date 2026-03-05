---
"prosys": minor
---

Centralized API error handling with domain-driven error types and client-side toast notifications

- Added `apiHandler` wrapper to eliminate repetitive try-catch boilerplate across all 13 API route handlers
- Added `ConflictError` domain error type (409) and `SyntaxError` handling for malformed JSON (400)
- Expanded `handleDomainError` to map all domain errors to proper HTTP status codes including a catch-all for the base `DomainError` class
- Added svelte-sonner toast notifications so API errors are surfaced to users instead of being silently swallowed
- Stores now parse server error responses via `ApiError`/`throwApiError` and show toasts after optimistic rollback
