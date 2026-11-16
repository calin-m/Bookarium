/**
 * Project Gutenberg Chapter Segmentation & Pagination Engine (Facade Barrel)
 *
 * Re-exports modularized Gutenberg domain subsystems from `@/lib/gutenberg`
 * for 100% backward compatibility with existing components, stores, and tests.
 *
 * @module
 * @scope Public TypeScript barrel re-exporting all Gutenberg parsing, pagination, passage extraction, and typography normalization helpers from `./gutenberg`.
 * @invariant Preserve every public export from `./gutenberg` unchanged so client hooks, Web Workers, tests, and doc generators keep backward-compatible `@/lib/gutenberg-parser` imports.
 * @rationale Allows incremental internal decomposition of `src/lib/gutenberg/*` without churning consumer imports across reader pages, workers, or test suites.
 * @adr ADR-017
 */

export * from './gutenberg';
