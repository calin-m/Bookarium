# Bookarium System Contracts & Behavioral Invariants (AST-Compiled)

> **Auto-Generated Living Specification**: This document is 100% compiled by [`scripts/generate-contracts-docs.js`](../scripts/generate-contracts-docs.js) using [`scripts/lib/ast-parser.js`](../scripts/lib/ast-parser.js). Never edit this file directly — author `@scope`, `@invariant`, `@rationale` (`@why`), and `@adr` JSDoc tags in source files and run `npm run docs:contracts` (or `npm run docs:sync`).

While [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) (and its modular subsystem slices under `docs/architecture/`) maps structural topology and [`docs/DECISIONS.md`](DECISIONS.md) records historical architectural decisions, **`SYSTEM_CONTRACTS.md`** documents **code-level intent**: what each module owns, which invariants must never be broken, why non-obvious constraints exist, its live caller blast radius, and its co-located test contract.

---

## 📐 Writing Contract JSDoc Annotations

Annotate a module header (above imports or tagged `@module`) or an exported function/class/type directly in `src/` or `scripts/**/*.js`:

```ts
/**
 * @scope Intended ownership boundary and responsibilities for this module or symbol.
 * @invariant Hard rule, ordering constraint, or security guarantee that must never regress.
 * @invariant Additional repeatable @invariant tags become separate enforceable bullets.
 * @rationale Why the code is shaped this exact way (database index behavior, SSR races, browser quirks).
 * @adr ADR-070, ADR-080
 */
```

> **Zero-Debt Authoring Rule**: Prefer citing exported constant or symbol identifiers (e.g., `MAX_ANNOTATION_TEXT_LENGTH`, `PASSIVE_SYNC_COOLDOWN_MS`, `QUOTE_POOL_SETTLE_TIMEOUT_MS`) inside `@invariant` tags instead of duplicating mutable numeric literals, and update existing tags incrementally when modifying those modules.

---

## 📊 Contract Coverage Telemetry (Across All Executable Modules)

- **Total Scanned Executable Modules**: `286` (`src/**`, `scripts/**/*.js`, `next.config.ts`, `public/sw.js`)
- **Annotated Contract Modules**: `85` (**29.7%** coverage; `20` Tier-1 + `22` Tier-2 + `23` Tier-3 + `20` Tier-4 = `85` Protected)
- **Extracted Module Invariants**: `149`
- **Symbol-Level Contracts**: `1`
- **Pending Annotation Queue**: `201` *(auto-ranked below by AST blast radius & external boundary exposure)*

| Architectural Layer | Total Modules | Contracted | Pending | Coverage |
| :--- | :---: | :---: | :---: | :---: |
| **Edge Proxy & API Routes** | `6` | `6` | `0` | 100.0% |
| **Domain Engines & Adapters** | `50` | `34` | `16` | 68.0% |
| **State Stores (Zustand)** | `10` | `10` | `0` | 100.0% |
| **React Hooks & Queries** | `36` | `11` | `25` | 30.6% |
| **Web Workers** | `2` | `2` | `0` | 100.0% |
| **App Router Pages & Layouts** | `25` | `6` | `19` | 24.0% |
| **UI & Feature Components** | `117` | `1` | `116` | 0.9% |
| **Config & Type Contracts** | `18` | `1` | `17` | 5.6% |
| **CLI Pipelines & Governance** | `22` | `14` | `8` | 63.6% |

---

## 🛡️ Active Behavioral Contracts & Invariants

### Layer: Edge Proxy & API Routes (6 Contracted)

#### [`src/app/api/books/content/metadata-cache.ts`](../src/app/api/books/content/metadata-cache.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Server-side LRU metadata (`MAX_METADATA_CACHE_ENTRIES`) and plain-text (`MAX_CACHED_BOOKS`, `MAX_CACHEABLE_BOOK_CHARS`, `CACHE_TTL_MS`) cache powering `/api/books/content` copyright resolution and private Cloudflare R2 streaming across Supabase and curated fixtures.
- **Behavioral Invariants (`@invariant`)**:
  - Pin LRU Map instances on `globalThis`, enforce `MAX_METADATA_CACHE_ENTRIES` and `MAX_CACHED_BOOKS` FIFO-LRU eviction, and skip caching empty or oversized (`> MAX_CACHEABLE_BOOK_CHARS`) payloads.
  - Enrich Supabase book metadata missing author lifespans from `FEATURED_HERO_BOOKS` (`enrichWithFeaturedLifespans`) and return `null` cleanly rather than throwing on unconfigured or failed lookups.
- **Design Rationale (`@rationale`)**:
  - Separating bounded server caches from the route handler keeps Vercel serverless cold/warm invocations predictable without risking OOM memory spikes on massive omnibus volumes.
- **Governing Decisions (`@adr`)**: [ADR-036](DECISIONS.md), [ADR-039](DECISIONS.md), [ADR-070](DECISIONS.md), [ADR-082](DECISIONS.md), [ADR-084](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/app/api/books/content/route.ts`](../src/app/api/books/content/route.ts))
- **Cross-Boundary Coupling**: DB Tables: `public.books`
- **Test Contract**: [`src/app/api/books/content/metadata-cache.test.ts`](../src/app/api/books/content/metadata-cache.test.ts) (10 tests)

#### [`src/app/api/books/content/route.ts`](../src/app/api/books/content/route.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Multi-purpose book asset endpoint streaming plain-text volumes (`type=''`), R2-backed cover JPEGs (`type=cover`), and stateless `1200x630` OpenGraph reading cards (`type=card`).
- **Behavioral Invariants (`@invariant`)**:
  - Reject disallowed query params (`ALLOWED_CONTENT_QUERY_KEYS`, allowing `s` exclusively with `type=card` and rejecting `?url=` upstream proxies with `400 no-store`), enforce defense-in-depth Fetch Metadata anti-deeplink & cross-site isolation (`guardContentAssetRequest` returning `403 no-store` outside `type=card` and headerless crawlers), enforce mode-scoped rate limiters, reject HTTP `200` `text/html` outage/interstitial pages (`isHtmlPayload`), and bound payloads (`MAX_R2_BOOK_BYTES` text / `MAX_R2_COVER_BYTES` cover).
  - Enforce `HTTP 451` gatekeeping whenever resolved metadata restricts a volume in the caller's jurisdiction (including US `copyright === true` blocks) on plain-text and `type=card` requests, fail closed with `503` for non-US requests when metadata is unavailable, and bypass `resolveBookMetadata` for `type=cover` requests; emit `Cross-Origin-Resource-Policy: cross-origin` exclusively for `200` `type=card` PNGs.
  - Serve `type=cover` and plain text strictly from private Cloudflare R2 (`404` on R2 miss, `503` when R2 is unconfigured for plain text / `404` for covers, zero Project Gutenberg or external mirror fallback), coalesce concurrent upstream R2 fetches per `bookId` inside `inFlightR2Fetches`, cache resolved text in `bookContentLruCache`, and attach `Vercel-Cache-Tag` (`covers` on `200` cover responses, `book-content` on `200` plain-text responses) while keeping `no-store` errors untagged.
- **Design Rationale (`@rationale`)**:
  - Keeping R2 credentials server-only eliminates browser/runtime Project Gutenberg requests and external cover hotlinking completely, ensuring 100% ToS compliance while preserving IndexedDB offline reading and optional Supabase `books.content` reads.
- **Governing Decisions (`@adr`)**: [ADR-016](DECISIONS.md), [ADR-022](DECISIONS.md), [ADR-039](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-082](DECISIONS.md), [ADR-084](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: DB Tables: `public.books`
- **Test Contract**: [`src/app/api/books/content/route.test.ts`](../src/app/api/books/content/route.test.ts) (30 tests) + [`src/app/api/books/content/route.security.test.ts`](../src/app/api/books/content/route.security.test.ts) (9)

#### [`src/app/api/books/route.ts`](../src/app/api/books/route.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Read-only Edge/serverless catalog gateway serving paginated searches, ID lookups, and the 2-spread rotating quote pool (`?pool=quotes`).
- **Behavioral Invariants (`@invariant`)**:
  - Enforce strict parameter allowlisting (`ALLOWED_CATALOG_QUERY_KEYS`, dev-only `?country=`), `booksApiRateLimiter`, and `Cross-Origin-Resource-Policy: same-origin` across all responses.
  - Fail closed with HTTP `504` on PostgreSQL statement timeouts (`57014`) and HTTP `503` with `Cache-Control: no-store, max-age=0` on transient Supabase outages or `pool=quotes` unavailability; never return static fixture fallback on live DB errors.
  - Differentiate CDN caching by query mode (`s-maxage=43200` + `Vercel-Cache-Tag: quotes` for `?pool=quotes`, `s-maxage=604800` + `Vary: Accept-Encoding` for jurisdiction-independent lookups, `Vary: x-vercel-ip-country, cf-ipcountry, x-bookarium-country, Accept-Encoding` for country-filtered pages).
- **Design Rationale (`@rationale`)**:
  - Prevents Vercel Edge CDN cache poisoning during DB outages, stops query-cache busting abuse, and shields the 78k-row database via global CDN offloading.
- **Governing Decisions (`@adr`)**: [ADR-022](DECISIONS.md), [ADR-037](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/app/api/books/route.test.ts`](../src/app/api/books/route.test.ts) (9 tests)

#### [`src/app/api/books/translations/route.ts`](../src/app/api/books/translations/route.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Stateless API route handler (`GET /api/books/translations`) serving FRBR-linked alternate language editions filtered by resolved client copyright jurisdiction.
- **Behavioral Invariants (`@invariant`)**:
  - Enforce IP rate limiting (`booksApiRateLimiter`), reject unknown query keys outside `id` (plus dev-only `country`), and validate numeric `bookId` within `1..MAX_BOOK_ID` (`10_000_000`).
  - Emit `Cache-Control` with `Vary: x-vercel-ip-country` and `Vercel-Cache-Tag: translations` on `200` responses, and fail closed with `Cache-Control: no-store` (`createNoStoreErrorResponse`) on `400`/`500` errors.
- **Design Rationale (`@rationale`)**:
  - Varying Edge caches strictly by Geo-IP country prevents cross-jurisdiction public-domain leakage while pinning error responses to `no-store` prevents Edge caching transient failures.
- **Governing Decisions (`@adr`)**: [ADR-010](DECISIONS.md), [ADR-016](DECISIONS.md), [ADR-022](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/app/api/books/translations/route.test.ts`](../src/app/api/books/translations/route.test.ts) (4 tests)

#### [`src/app/api/profiles/card/route.ts`](../src/app/api/profiles/card/route.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Stateless Next.js GET route rendering 1200x630 OpenGraph PNG scholar profile cards via `ImageResponse` with strict ADR-033 anti-enumeration fallback.
- **Behavioral Invariants (`@invariant`)**:
  - Enforce `profileCardRateLimiter` via `getClientIp`, reject disallowed query keys outside `ALLOWED_PROFILE_CARD_QUERY_KEYS` with `createNoStoreErrorResponse` (`400 no-store`), decode `?s=<token>` strictly for visual flags (`theme`, `includeStats`) via `decodeProfileCardShareToken`, collapse private, missing, malformed, and unavailable accounts uniformly onto an identical neutral Bookarium card, and emit `Cross-Origin-Resource-Policy: cross-origin` on rendered PNG responses.
- **Design Rationale (`@rationale`)**:
  - Rendering Scholar Sanctuary cards from live `is_public = true` Supabase rows while keeping `?s=` purely visual prevents client claim spoofing and guarantees zero profile enumeration across social crawler requests.
- **Governing Decisions (`@adr`)**: [ADR-022](DECISIONS.md), [ADR-033](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/app/api/profiles/card/route.test.ts`](../src/app/api/profiles/card/route.test.ts) (3 tests)

#### [`src/proxy.ts`](../src/proxy.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Edge middleware proxy coordinating Fetch Metadata anti-deeplink/cross-site isolation on `/api/books/content*`, jurisdiction resolution (`x-vercel-ip-country` / `bookarium-geo-country`), share token forwarding (`?s=`), and conditional Supabase SSR session refresh.
- **Behavioral Invariants (`@invariant`)**:
  - Short-circuit direct browser deeplinks (`Sec-Fetch-Dest: document|iframe|frame|embed|object|fencedframe`, `Sec-Fetch-Mode: navigate`) and `cross-site` subresource hotlinks on `/api/books/content*` (outside `type=card`) with `403 no-store` (`guardContentAssetRequest`) ahead of origin execution while leaving missing-header crawlers and `Vary` keys untouched; never execute `updateSession` or set `bookarium-geo-country` cookies on public `/api/books*` and `/api/profiles*` paths, `/auth/*` routes, service-worker precaches, or Next.js router prefetches; configure browser-readable geo/override cookies with `sameSite: 'lax'` and protocol-aware `secure: isHttpsRequest(request)`.
  - Bypass SSR token rotation on App Router RSC navigations (`rsc: 1`) outside `/account` and `/account/*`; only set `x-middleware-override-headers` when `validShareToken` is present.
- **Design Rationale (`@rationale`)**:
  - Rejecting browser deeplinks and cross-site hotlinks at the Edge via Fetch Metadata protects private Cloudflare R2 assets without altering `Vary` or fragmenting `s-maxage` CDN keys, while skipping cookies and `x-middleware-override-headers` on public API and RSC requests preserves Edge caching and prevents concurrent OAuth refresh races.
- **Governing Decisions (`@adr`)**: [ADR-033](DECISIONS.md), [ADR-035](DECISIONS.md), [ADR-042](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-082](DECISIONS.md)
- **AST Blast Radius**: 2 runtime, 0 type-only ([`src/app/layout.tsx`](../src/app/layout.tsx), [`src/stores/useJurisdictionStore.ts`](../src/stores/useJurisdictionStore.ts))
- **Cross-Boundary Coupling**: Env Vars: `NODE_ENV`
- **Test Contract**: [`src/proxy.test.ts`](../src/proxy.test.ts) (13 tests)


### Layer: Domain Engines & Adapters (34 Contracted)

#### [`src/lib/annotation-cloud-sync.ts`](../src/lib/annotation-cloud-sync.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Pure/adapter utilities for `user_annotations` cloud outbox mapping, RFC 4122 UUID generation, and Symposium fellow identity resolution.
- **Behavioral Invariants (`@invariant`)**:
  - Enforce `MAX_ANNOTATION_TEXT_LENGTH` (`5000`) and `MAX_ANNOTATION_NOTE_LENGTH` (`2000`) bounds and generate valid v4 UUIDs even over non-HTTPS LAN development contexts.
  - Never overwrite verified companion handles with placeholder usernames (`isPlaceholderUsername`) when resolving fellow marginalia attribution (`resolveFellowIdentityMap`).
- **Design Rationale (`@rationale`)**:
  - Normalizing annotation cloud payloads and fellow handle lookups outside React components guarantees consistent validation across optimistic store mutations and background outbox replays.
- **Governing Decisions (`@adr`)**: [ADR-019](DECISIONS.md), [ADR-059](DECISIONS.md), [ADR-068](DECISIONS.md), [ADR-071](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/stores/useAnnotationStore.ts`](../src/stores/useAnnotationStore.ts))
- **Cross-Boundary Coupling**: DB Tables: `public.user_annotations`
- **Test Contract**: [`src/lib/annotation-cloud-sync.test.ts`](../src/lib/annotation-cloud-sync.test.ts) (8 tests)

#### [`src/lib/api-utils.ts`](../src/lib/api-utils.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Shared HTTP security utilities enforcing API query allowlists, Fetch Metadata isolation (`guardContentAssetRequest`), `nosniff`/`CORP` response headers, HTTPS proxy detection, and rightmost-hop client IP extraction.
- **Behavioral Invariants (`@invariant`)**:
  - Reject unexpected query keys (`hasUnexpectedQueryParams`, restricting dev diagnostic params to `NODE_ENV !== 'production'`), block browser deeplinks and cross-site subresource hotlinks on `/api/books/content*` (`isBlockedContentAssetRequest`, returning `403 no-store` while keeping `type=card` and headerless crawlers intact), and emit `Cache-Control: no-store, max-age=0` + `Cross-Origin-Resource-Policy` (`same-origin` default) on all error and rate-limit responses.
- **Design Rationale (`@rationale`)**:
  - Centralizing Fetch Metadata, proxy header precedence (`x-vercel-forwarded-for`, rightmost `x-forwarded-for`), and `no-store` error headers prevents security-header drift or cache poisoning across API route handlers.
- **Governing Decisions (`@adr`)**: [ADR-016](DECISIONS.md), [ADR-022](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-082](DECISIONS.md)
- **AST Blast Radius**: 7 runtime, 0 type-only ([`src/app/api/books/content/route.ts`](../src/app/api/books/content/route.ts), [`src/app/api/books/route.ts`](../src/app/api/books/route.ts), [`src/app/api/books/translations/route.ts`](../src/app/api/books/translations/route.ts), [`src/app/api/profiles/card/route.ts`](../src/app/api/profiles/card/route.ts), …)
- **Cross-Boundary Coupling**: Env Vars: `NODE_ENV`
- **Test Contract**: [`src/lib/api-utils.test.ts`](../src/lib/api-utils.test.ts) (15 tests)

#### [`src/lib/auth-recovery.ts`](../src/lib/auth-recovery.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Fail-closed Supabase JWT `amr` claim verifier and single-use password-recovery consumption marker manager (`bookarium-consumed-recovery`).
- **Behavioral Invariants (`@invariant`)**:
  - Authorize password-recovery reset flows ONLY when signed JWT `amr` claims prove a fresh (`<= RECOVERY_LINK_TTL_SECONDS = 3600`s) unconsumed `'recovery'` or post-request `'otp'` event matching `recoverySentAt`.
  - Persist consumed `recoverySentAt` timestamps per user (`markRecoveryConsumed`) so `?recovery=true` URLs or back-button reloads cannot replay recovery privileges.
- **Design Rationale (`@rationale`)**:
  - Treating client `?recovery=true` query parameters as untrusted hints closes password-reset session hijacking if an already signed-in or magic-link session visits the URL.
- **Governing Decisions (`@adr`)**: [ADR-005](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/stores/useAuthStore.ts`](../src/stores/useAuthStore.ts))
- **Cross-Boundary Coupling**: Storage/Cookies: `bookarium-consumed-recovery`
- **Test Contract**: [`src/lib/auth-recovery.test.ts`](../src/lib/auth-recovery.test.ts) (7 tests)

#### [`src/lib/book-metadata.ts`](../src/lib/book-metadata.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Canonical bibliographic identity normalization, placeholder guard predicates (`isPlaceholderAuthor`, `isPlaceholderTitle`), and multi-source book metadata resolution utilities.
- **Behavioral Invariants (`@invariant`)**:
  - Identify generic fallback strings (`"Anonymous"`, `"Unknown Author"`, `"Classic Masterwork"`, `"Gutenberg Volume #N"`) consistently so storage, sync, and ledger layers never overwrite authentic author metadata with placeholders.
  - Resolve authentic title/author identity in priority order `FEATURED_HERO_BOOKS` / `currentBook` -> `booksData` -> `extractedMeta` while cleaning raw Project Gutenberg title preambles (`cleanBookTitle`).
- **Design Rationale (`@rationale`)**:
  - Consistent placeholder detection across Reader, Bookshelf, Cloud Sync, and IndexedDB is foundational to preventing both metadata loss and false non-US `HTTP 451` copyright blocks.
- **Governing Decisions (`@adr`)**: [ADR-070](DECISIONS.md), [ADR-074](DECISIONS.md)
- **AST Blast Radius**: 20 runtime, 0 type-only ([`src/app/page.tsx`](../src/app/page.tsx), [`src/app/read/[id]/layout.tsx`](../src/app/read/[id]/layout.tsx), [`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/app/read/[id]/reader-layout-utils.ts`](../src/app/read/[id]/reader-layout-utils.ts), …)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/book-metadata.test.ts`](../src/lib/book-metadata.test.ts) (17 tests)

#### [`src/lib/book-sorting.ts`](../src/lib/book-sorting.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Pure bookshelf and favorites sorting/filtering utilities, desktop vs. mobile drawer preset partitioning, and downloaded offline blob overlay merging.
- **Behavioral Invariants (`@invariant`)**:
  - Keep `'favorites'` in desktop `BOOKSHELF_BASE_SORT_OPTIONS` while omitting it from mobile `BOOKSHELF_DRAWER_SORT_OPTIONS` so `CollectionFilterDrawer` renders Favorites as a composable monochrome `filter` switch (`Saved ∩ Favorited`).
  - Overlay locally cached IndexedDB `coverBlob` object URLs via `mergeDownloadedShelfBooks` and filter downloaded entries strictly against `offlineIds` + bookshelf membership.
- **Design Rationale (`@rationale`)**:
  - Decoupling drawer filter state from sort ordering lets mobile users combine Favorites with any shelf, `Downloaded` scope, or sort direction without duplicating presets or mutating desktop dropdown ergonomics.
- **Governing Decisions (`@adr`)**: [ADR-062](DECISIONS.md), [ADR-066](DECISIONS.md), [ADR-071](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 3 runtime, 0 type-only ([`src/app/page.tsx`](../src/app/page.tsx), [`src/components/presentation/BookshelfRack.tsx`](../src/components/presentation/BookshelfRack.tsx), [`src/hooks/usePersonalCollectionsController.ts`](../src/hooks/usePersonalCollectionsController.ts))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/book-sorting.test.ts`](../src/lib/book-sorting.test.ts) (16 tests)

#### [`src/lib/bookshelf-cloud-sync.ts`](../src/lib/bookshelf-cloud-sync.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Supabase bi-directional synchronization and offline outbox engine for `bookshelves`, `bookshelf_items`, `user_favorites`, and `user_book_curation`.
- **Behavioral Invariants (`@invariant`)**:
  - Coalesce outbox flushes via `coalesceInFlightByUser` with dirty tracking (`dirtyOutboxFlushUsers`), guard reads/writes behind `verifyActiveCloudSession`, and respect `15,000ms` passive mount cooldowns unless dirty outboxes exist.
  - Preserve richer local `CatalogBook` lifespans/subjects via `mergeCloudBookWithLocal` and enforce tombstone filtering (`deletedBookIds`, `deletedFavoriteBookIds`) before committing multi-shelf deduplicated state.
- **Design Rationale (`@rationale`)**:
  - Single-commit atomic state reconciliation plus snapshot-safe dirty-outbox queues prevent offline additions or custom shelf moves from flickering or being overwritten by concurrent pulls.
- **Governing Decisions (`@adr`)**: [ADR-005](DECISIONS.md), [ADR-069](DECISIONS.md), [ADR-071](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/stores/useBookshelfStore.ts`](../src/stores/useBookshelfStore.ts))
- **Cross-Boundary Coupling**: DB Tables: `public.bookshelf_items`, `public.bookshelves`, `public.user_book_curation`, `public.user_favorites`
- **Test Contract**: [`src/lib/bookshelf-cloud-sync.test.ts`](../src/lib/bookshelf-cloud-sync.test.ts) (13 tests)

#### [`src/lib/catalog/query-parser.ts`](../src/lib/catalog/query-parser.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Authoritative input parser and sanitizer (`parseCatalogQuery`) normalizing `/api/books` search parameters and resolving active client copyright jurisdiction.
- **Behavioral Invariants (`@invariant`)**:
  - Enforce strict upper bounds (`MAX_CATALOG_PAGE`, `MAX_SEARCH_LENGTH`, `MAX_TOPIC_LENGTH`, `MAX_IDS_BATCH`, `MAX_LANGUAGES`, `MAX_MIME_TYPE_LENGTH`, `MIN_ERA_YEAR`..`MAX_ERA_YEAR`, and `DEFAULT_QUOTE_POOL_LIMIT` when `pool === 'quotes'`), validate regex patterns for ISO languages/IDs/MIME types, and delegate jurisdiction resolution exclusively to `resolveClientCountry`.
- **Design Rationale (`@rationale`)**:
  - Bounding page offsets, ID batch counts, string lengths, and quote pool limits upfront shields the 78k-row PostgreSQL database and Vercel Edge cache keys from unconstrained offset scans and cache-busting payloads.
- **Governing Decisions (`@adr`)**: [ADR-022](DECISIONS.md), [ADR-036](DECISIONS.md), [ADR-037](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/app/api/books/route.ts`](../src/app/api/books/route.ts))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/catalog/query-parser.test.ts`](../src/lib/catalog/query-parser.test.ts) (11 tests)

#### [`src/lib/catalog/supabase-provider.ts`](../src/lib/catalog/supabase-provider.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Authoritative Supabase PostgreSQL catalog provider with GIN full-text search, pre-computed lifespan filtering, 2-spread quote projections, planner-safe counts, bounded L4 LRU caches (`__bookariumCatalogQueryCache`, `__bookariumTranslationCache`), and per-key in-flight request coalescing.
- **Behavioral Invariants (`@invariant`)**:
  - Never chain `.order('id', { ascending: true })` onto `.order('download_count', { ascending: false })` in SQL across the 78k-row `public.books` table; perform deterministic `id ASC` tie-breaking in memory in JS.
  - Never combine `.neq('quotes', '[]')` with `ORDER BY download_count DESC` without a Primary Key `.in('id', chunk)` bound (`books_pkey`); cap quote pool transfers at `DEFAULT_QUOTE_POOL_LIMIT` (`48`) using `quote0:quotes->0, quote1:quotes->1`, strip 1-item bibliographic sentinel rows, share `fetchQuoteEnrichedPool` across countries while normalizing `searchBooks` and `getBookTranslations` L4 keys by `jurisdictionRule` (cloning caller `clientCountry` without caching `getBookTranslations` DB errors), and coalesce concurrent cold misses per key cleanly.
  - Use `{ count: 'planned' }` on multi-predicate filtered initial queries (`search`/`topic`/`languages`/`era`), omit count options during `backfillQuery` chunks, fail fast with `HTTP 504` without retrying SQLSTATE `57014` (`isStatementTimeoutError`), short-circuit deep pagination past `MAX_CATALOG_OFFSET` (`160_000`), and enforce `limit + 1` dynamic backfill under non-US copyright filters.
- **Design Rationale (`@rationale`)**:
  - Single-column `idx_books_download_count` has `77,500+` tied zero-download rows, while PostgREST `count: 'estimated'` executes a duplicate `LIMIT 1001` scan (`pgrst_source_count`) whenever fewer than 1,001 rows match selective filters; skipping redundant count/retry scans on `57014` timeouts prevents compounding 8s `statement_timeout` failures, while cross-country `jurisdictionRule` normalization, translation LRU caching, and in-flight coalescing cut warm serverless read egress cleanly.
- **Governing Decisions (`@adr`)**: [ADR-037](DECISIONS.md), [ADR-038](DECISIONS.md), [ADR-043](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-086](DECISIONS.md)
- **AST Blast Radius**: 7 runtime, 0 type-only ([`src/app/api/books/content/metadata-cache.ts`](../src/app/api/books/content/metadata-cache.ts), [`src/app/api/books/content/route.ts`](../src/app/api/books/content/route.ts), [`src/app/api/books/route.ts`](../src/app/api/books/route.ts), [`src/app/api/books/translations/route.ts`](../src/app/api/books/translations/route.ts), …)
- **Cross-Boundary Coupling**: DB Tables: `public.book_translations`, `public.books` · Env Vars: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`
- **Test Contract**: [`src/lib/catalog/supabase-provider.test.ts`](../src/lib/catalog/supabase-provider.test.ts) (41 tests)

#### [`src/lib/copyright-engine.ts`](../src/lib/copyright-engine.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Authoritative pure-domain evaluator computing regional public domain eligibility across US, Life+70, Life+80, and Life+100 statutes.
- **Behavioral Invariants (`@invariant`)**:
  - US jurisdictions allow works published `<= 1930` or cleared with `copyright === false`; non-US jurisdictions apply strict post-mortem terms from the last surviving contributor (`max_author_death_year` across authors + translators).
  - Missing author death years apply a conservative 100-year longevity heuristic rather than defaulting to allowed; placeholder names (`"Anonymous"`) must never overwrite authentic lifespans upstream.
- **Design Rationale (`@rationale`)**:
  - Centralizing legal rules in a pure zero-network module guarantees SSR, Edge routes, catalog queries, and Reader `HTTP 451` checks produce identical deterministic decisions.
- **Governing Decisions (`@adr`)**: [ADR-002](DECISIONS.md), [ADR-036](DECISIONS.md), [ADR-044](DECISIONS.md), [ADR-070](DECISIONS.md)
- **AST Blast Radius**: 22 runtime, 2 type-only ([`src/app/api/books/content/metadata-cache.ts`](../src/app/api/books/content/metadata-cache.ts), [`src/app/api/books/content/route.ts`](../src/app/api/books/content/route.ts), [`src/app/api/books/route.ts`](../src/app/api/books/route.ts), [`src/app/layout.tsx`](../src/app/layout.tsx), [`src/components/presentation/NotablePassagesSpread.tsx`](../src/components/presentation/NotablePassagesSpread.tsx) *(type)*, [`src/types/catalog.types.ts`](../src/types/catalog.types.ts) *(type)*, …)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/copyright-engine.test.ts`](../src/lib/copyright-engine.test.ts) (34 tests)

#### [`src/lib/country-resolver.ts`](../src/lib/country-resolver.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Deterministic 8-tier jurisdiction resolver (`resolveClientCountry`) mapping Edge Geo-IP headers, proxy stamps, session cookies, and dev-only overrides to ISO 3166-1 alpha-2 country codes.
- **Behavioral Invariants (`@invariant`)**:
  - Restrict `?country=`, `DEV_COUNTRY`, `bookarium-dev-country-override`, and timezone inference strictly to `process.env.NODE_ENV === 'development'` so production users cannot bypass territorial copyright gates via query/env spoofing.
  - Evaluate production requests strictly in precedence `Edge IP Headers (x-vercel-ip-country | cf-ipcountry | request.geo)` -> `x-bookarium-country` -> `bookarium-geo-country` cookie -> `'US'`, enforcing 2-letter uppercase ISO format (`^[A-Z]{2}$`).
- **Design Rationale (`@rationale`)**:
  - Isolating dev overrides behind `NODE_ENV === 'development'` prevents HTTP 451 copyright circumvention in production while allowing zero-network local jurisdiction testing.
- **Governing Decisions (`@adr`)**: [ADR-036](DECISIONS.md), [ADR-042](DECISIONS.md)
- **AST Blast Radius**: 5 runtime, 0 type-only ([`src/app/api/books/content/route.ts`](../src/app/api/books/content/route.ts), [`src/app/api/books/translations/route.ts`](../src/app/api/books/translations/route.ts), [`src/lib/catalog/query-parser.ts`](../src/lib/catalog/query-parser.ts), [`src/proxy.ts`](../src/proxy.ts), …)
- **Cross-Boundary Coupling**: Env Vars: `DEV_COUNTRY`, `NODE_ENV`
- **Test Contract**: [`src/lib/country-resolver.test.ts`](../src/lib/country-resolver.test.ts) (16 tests)

#### [`src/lib/fellowship-cloud-sync.ts`](../src/lib/fellowship-cloud-sync.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Privacy-safe scholar identity resolution, handle formatting, and non-regressive profile healing for Reader Circles and Symposiums.
- **Behavioral Invariants (`@invariant`)**:
  - Treat blank, `'scholar'`, and `'fellow_scholar'` strings as replaceable placeholders (`isPlaceholderUsername`) and preserve authentic usernames during `healProfileIdentity`.
  - Batch-query only non-sensitive public columns (`id, username, display_name`) from `public.profiles` and degrade gracefully to empty maps when offline.
- **Design Rationale (`@rationale`)**:
  - Keeping fellow handle resolution zero-PII and offline-resilient lets Bookmarks, Notebook, and Reader popovers attribute shared highlights without exposing emails or crashing offline.
- **Governing Decisions (`@adr`)**: [ADR-033](DECISIONS.md), [ADR-055](DECISIONS.md), [ADR-059](DECISIONS.md), [ADR-068](DECISIONS.md)
- **AST Blast Radius**: 2 runtime, 0 type-only ([`src/lib/annotation-cloud-sync.ts`](../src/lib/annotation-cloud-sync.ts), [`src/stores/useFellowshipStore.ts`](../src/stores/useFellowshipStore.ts))
- **Cross-Boundary Coupling**: DB Tables: `public.profiles`
- **Test Contract**: [`src/lib/fellowship-cloud-sync.test.ts`](../src/lib/fellowship-cloud-sync.test.ts) (3 tests)

#### [`src/lib/gutenberg-parser.ts`](../src/lib/gutenberg-parser.ts) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Public TypeScript barrel re-exporting all Gutenberg parsing, pagination, passage extraction, and typography normalization helpers from `./gutenberg`.
- **Behavioral Invariants (`@invariant`)**:
  - Preserve every public export from `./gutenberg` unchanged so client hooks, Web Workers, tests, and doc generators keep backward-compatible `@/lib/gutenberg-parser` imports.
- **Design Rationale (`@rationale`)**:
  - Allows incremental internal decomposition of `src/lib/gutenberg/*` without churning consumer imports across reader pages, workers, or test suites.
- **Governing Decisions (`@adr`)**: [ADR-017](DECISIONS.md)
- **AST Blast Radius**: 8 runtime, 1 type-only ([`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/components/reader/ReaderSurface.tsx`](../src/components/reader/ReaderSurface.tsx), [`src/components/reader/ReaderTocDrawer.tsx`](../src/components/reader/ReaderTocDrawer.tsx), [`src/hooks/reader/useGutenbergParserWorker.ts`](../src/hooks/reader/useGutenbergParserWorker.ts), [`src/components/reader/ReaderSearchDrawer.tsx`](../src/components/reader/ReaderSearchDrawer.tsx) *(type)*, …)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/gutenberg-parser.test.ts`](../src/lib/gutenberg-parser.test.ts) (2 tests)

#### [`src/lib/gutenberg/pagination.ts`](../src/lib/gutenberg/pagination.ts) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Virtual page-spread slicer (`paginateChapterContent`, `calculateVolumePageSpread`) and reading-time estimator (`calculateReadingTime`).
- **Behavioral Invariants (`@invariant`)**:
  - Snap page splits strictly to paragraph (`\n\n`), sentence (`[.!?]`), or whole-word whitespace boundaries (`>= 75%` window) so words are never torn across pages.
  - Bound `paginationCache` via `MAX_PAGINATION_CACHE_ENTRIES` (`500`) FIFO eviction keyed on length, `charsPerPage`, head, and tail samples.
- **Design Rationale (`@rationale`)**:
  - Bounded memoization eliminates redundant O(N) text re-slicing during rapid chapter/font-size adjustments while keeping browser memory flat on omnibus editions.
- **Governing Decisions (`@adr`)**: [ADR-001](DECISIONS.md), [ADR-017](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/lib/gutenberg/index.ts`](../src/lib/gutenberg/index.ts))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/gutenberg/pagination.test.ts`](../src/lib/gutenberg/pagination.test.ts) (5 tests)

#### [`src/lib/gutenberg/passages.ts`](../src/lib/gutenberg/passages.ts) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Dynamic literary passage and dialogue extractor (`extractDynamicBookPassages`) filtering raw Gutenberg texts into clean spreads.
- **Behavioral Invariants (`@invariant`)**:
  - Bound scan windows via `PASSAGE_SCAN_BYTES` (or `900 KB` when `maxPassages > 5`), exclude preamble/license/Distributed Proofreading/ASCII dividers/copyright colophons, and enforce `MIN_PASSAGE_LETTERS` (`25`) + `MIN_ALPHABETIC_DENSITY` (`50%`).
  - Truncate long quotes inside `safeCleanQuote` strictly at sentence endings or whole-word whitespace boundaries without mid-word clipping.
- **Design Rationale (`@rationale`)**:
  - Bounded scanning keeps extraction instantaneous in browser modals and CLI quote ingestion alike while blocking proofreader banners and separator art from appearing as literary excerpts.
- **Governing Decisions (`@adr`)**: [ADR-074](DECISIONS.md)
- **AST Blast Radius**: 6 runtime, 0 type-only ([`src/components/presentation/HeroFeaturedBook2DCard.tsx`](../src/components/presentation/HeroFeaturedBook2DCard.tsx), [`src/components/presentation/HeroFeaturedBook3D.tsx`](../src/components/presentation/HeroFeaturedBook3D.tsx), [`src/components/presentation/NotablePassagesSpread.tsx`](../src/components/presentation/NotablePassagesSpread.tsx), [`src/components/presentation/OpenBookLeftPageSpread.tsx`](../src/components/presentation/OpenBookLeftPageSpread.tsx), …)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/gutenberg/passages.test.ts`](../src/lib/gutenberg/passages.test.ts) (12 tests)

#### [`src/lib/gutenberg/reflow.ts`](../src/lib/gutenberg/reflow.ts) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Plain-text Gutenberg typography normalizer (`formatGutenbergTypography`) and hard-wrap paragraph reflow engine (`reflowGutenbergParagraphs`).
- **Behavioral Invariants (`@invariant`)**:
  - Preserve divider rules, `4+`-space indented verse/blockquotes, and alternating-indent short poetry (`maxTrimmedLen <= 62`, `avgTrimmedLen <= 52`), while unwrapping hard 70-column prose lines into fluid browser paragraphs.
  - Convert prose double-hyphens (`--`) to em-dashes (`—`) without mutating ASCII table borders (`+--+`, `|--|`), `---` rules, or `-->` arrows, and strip `_italic_` underscores while keeping redacted `____` blanks and `snake_case` intact.
- **Design Rationale (`@rationale`)**:
  - Project Gutenberg texts mix hard-wrapped prose, poetry, and tabular illustrations; geometry-aware reflow adapts prose cleanly to responsive columns without mangling verse stanzas or typographic artifacts.
- **Governing Decisions (`@adr`)**: [ADR-017](DECISIONS.md), [ADR-074](DECISIONS.md)
- **AST Blast Radius**: 2 runtime, 0 type-only ([`src/lib/gutenberg/index.ts`](../src/lib/gutenberg/index.ts), [`src/lib/gutenberg/segmentation.ts`](../src/lib/gutenberg/segmentation.ts))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/gutenberg/reflow.test.ts`](../src/lib/gutenberg/reflow.test.ts) (5 tests)

#### [`src/lib/gutenberg/segmentation.ts`](../src/lib/gutenberg/segmentation.ts) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Project Gutenberg structural chapter parser (`parseGutenbergChapters`) and duplicate heading suppression (`stripDuplicateLeadingChapterHeading`).
- **Behavioral Invariants (`@invariant`)**:
  - Preserve the Project Gutenberg `Colophon & License` section on parsed multi-chapter books and suppress front-matter TOC false chapter splits.
  - Keep `chapter.content` unmodified while stripping duplicate top headings inside `stripDuplicateLeadingChapterHeading` so virtual page boundaries and canonical text offsets never shift.
- **Design Rationale (`@rationale`)**:
  - Project Gutenberg terms require retaining license notices in distributed e-texts, while display-only heading stripping prevents redundant stacked chapter banners without invalidating saved page coordinates or annotations.
- **Governing Decisions (`@adr`)**: [ADR-017](DECISIONS.md), [ADR-028](DECISIONS.md), [ADR-069](DECISIONS.md)
- **AST Blast Radius**: 2 runtime, 0 type-only ([`src/lib/gutenberg/index.ts`](../src/lib/gutenberg/index.ts), [`src/lib/gutenberg/passages.ts`](../src/lib/gutenberg/passages.ts))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/gutenberg/segmentation.test.ts`](../src/lib/gutenberg/segmentation.test.ts) (18 tests)

#### [`src/lib/offline-storage.ts`](../src/lib/offline-storage.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Browser IndexedDB persistence (`BookariumOfflineDB` / `offline_books` + bounded `cover_cache` LRU), `coverObjectUrlCache` reuse, background cover warming, and non-regressive author metadata healing.
- **Behavioral Invariants (`@invariant`)**:
  - Never overwrite authentic author metadata with placeholder names (`isPlaceholderAuthor`, e.g., `"Anonymous"`); heal missing contributor lifespans via `patchOfflineBookAuthors`.
  - Lookup cover art in-memory (`getMemoryCachedCoverUrl`) and across IndexedDB via a single-transaction dual-store read (`[offline_books, cover_cache]`, returning `offline_books.coverBlob` before non-expired `cover_cache.blob` capped at `MAX_CACHED_COVERS` and `COVER_CACHE_TTL_MS`), populate via same-origin `/api/books/content?id=...&type=cover` with `{ cache: 'force-cache' }`, manage `coverObjectUrlCache` revocation on eviction/removal/clear, clear both stores in `clearAllOfflineBooks`, and broadcast changes through `OFFLINE_BOOKS_UPDATED_EVENT` (`bookarium:offline-updated`).
- **Design Rationale (`@rationale`)**:
  - Cross-origin Service Worker image caching triggers CSP `connect-src`/CORS failures, whereas a bounded canonical `bookId`-keyed IndexedDB cover cache using single-transaction reads and browser HTTP cache reuse prevents repeat downloads across refreshes behind `/api/books/content?type=cover` (Cloudflare R2) while reverting offline authors to `"Anonymous"` would cause false `HTTP 451` copyright blocks outside US jurisdictions.
- **Governing Decisions (`@adr`)**: [ADR-020](DECISIONS.md), [ADR-069](DECISIONS.md), [ADR-070](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-082](DECISIONS.md), [ADR-086](DECISIONS.md)
- **AST Blast Radius**: 7 runtime, 0 type-only ([`src/components/presentation/DownloadDrawer.tsx`](../src/components/presentation/DownloadDrawer.tsx), [`src/hooks/queries/useBookContent.ts`](../src/hooks/queries/useBookContent.ts), [`src/hooks/useCollectionAutoHeal.ts`](../src/hooks/useCollectionAutoHeal.ts), [`src/hooks/useOfflineBooks.ts`](../src/hooks/useOfflineBooks.ts), …)
- **Cross-Boundary Coupling**: API Calls: `/api/books/content` · Signals: emits `CustomEvent:bookarium:offline-updated` · Storage/Cookies: `BookariumOfflineDB`
- **Test Contract**: [`src/lib/offline-storage.test.ts`](../src/lib/offline-storage.test.ts) (21 tests)

#### [`src/lib/password.ts`](../src/lib/password.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Client-safe password generation (`generateStrongPassword`) and heuristic strength scoring (`evaluatePasswordStrength`) shared across registration and account security forms.
- **Behavioral Invariants (`@invariant`)**:
  - Use Web Crypto `window.crypto.getRandomValues` whenever available in browser contexts and score empty or sub-6-character passwords deterministically at `score: 0` without blocking form submission logic.
- **Design Rationale (`@rationale`)**:
  - Centralizing CSPRNG password generation and complexity feedback keeps AuthModal and AccountSecuritySection aligned without adding third-party zxcvbn bundle weight.
- **Governing Decisions (`@adr`)**: [ADR-005](DECISIONS.md)
- **AST Blast Radius**: 2 runtime, 2 type-only ([`src/components/auth/AuthModal.tsx`](../src/components/auth/AuthModal.tsx), [`src/hooks/useAccountSecurityActions.ts`](../src/hooks/useAccountSecurityActions.ts), [`src/components/account/AccountSecuritySection.tsx`](../src/components/account/AccountSecuritySection.tsx) *(type)*, [`src/components/ui/PasswordStrengthMeter.tsx`](../src/components/ui/PasswordStrengthMeter.tsx) *(type)*)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/password.test.ts`](../src/lib/password.test.ts) (8 tests)

#### [`src/lib/preferences-sync.ts`](../src/lib/preferences-sync.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Cross-store scholar preferences coordinator bundling active display/narration settings, `customDefaults` presets, and LWW `public.profiles.preferences` cloud sync.
- **Behavioral Invariants (`@invariant`)**:
  - Sanitize every untrusted local or cloud field through `sanitizePreferencesSnapshot` with clamped numeric bounds and resolve responsive baseline font sizing (`15px` / `17px` / `18px`) via `getFactoryPreferences`.
  - Perform Last-Write-Wins reconciliation strictly on `updatedAt` timestamps without resetting unauthenticated local customization on sign-out unless explicitly requested.
- **Design Rationale (`@rationale`)**:
  - Centralizing cross-store capture/application breaks circular dependencies between `useThemeStore`, `useReaderStore`, `usePreferencesStore`, and `useAnnotationStore`.
- **Governing Decisions (`@adr`)**: [ADR-071](DECISIONS.md), [ADR-079](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 4 runtime, 0 type-only ([`src/app/account/page.tsx`](../src/app/account/page.tsx), [`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/components/presentation/Navbar.tsx`](../src/components/presentation/Navbar.tsx), [`src/stores/useAuthStore.ts`](../src/stores/useAuthStore.ts))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/preferences-sync.test.ts`](../src/lib/preferences-sync.test.ts) (9 tests)

#### [`src/lib/profile-card-export.ts`](../src/lib/profile-card-export.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Client 1200x630 Scholar Sanctuary Canvas card renderer, human-readable share copy formatter, and handle-salted visual-only `?s=<token>` integrity codec.
- **Behavioral Invariants (`@invariant`)**:
  - Bind `?s=<token>` FNV-1a signatures strictly to the normalized lowercase handle via `'bookarium-profile-card-v1'` and encode ONLY visual display flags (`theme`, `includeStats`) — never embedding client-supplied bio text or reading counts inside URL tokens.
- **Design Rationale (`@rationale`)**:
  - Keeping profile card share URLs free of serialized user claims allows stateless server `/api/profiles/card` renders to verify visibility toggles and live scholar metadata directly against public Supabase rows (ADR-033).
- **Governing Decisions (`@adr`)**: [ADR-033](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 5 runtime, 0 type-only ([`src/app/api/profiles/card/route.ts`](../src/app/api/profiles/card/route.ts), [`src/app/u/[username]/layout.tsx`](../src/app/u/[username]/layout.tsx), [`src/app/u/[username]/profile-layout-utils.ts`](../src/app/u/[username]/profile-layout-utils.ts), [`src/components/profile/ProfileShareModal.tsx`](../src/components/profile/ProfileShareModal.tsx), …)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/profile-card-export.test.ts`](../src/lib/profile-card-export.test.ts) (6 tests)

#### [`src/lib/r2-client.ts`](../src/lib/r2-client.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Server-only Cloudflare R2 S3-compatible AWS SigV4 fetch and gzip decompression client for private book texts (`books/<id>.txt.gz`) and cover artwork (`covers/<id>.jpg`).
- **Behavioral Invariants (`@invariant`)**:
  - Never expose `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, or `R2_SECRET_ACCESS_KEY` to client bundles, validate `accountId` and `bucket` identifiers before URL construction, enforce `redirect: 'manual'` on all outbound R2 requests, and bound streamed cover payloads (`MAX_R2_COVER_BYTES`) and gzip decompression output (`MAX_R2_BOOK_BYTES`).
  - Return explicit `'unconfigured'` status when `R2_*` credentials are absent so local unconfigured environments fail closed predictably (`404`/`503`) without unhandled configuration errors or Project Gutenberg fallbacks.
- **Design Rationale (`@rationale`)**:
  - Using built-in `node:crypto` AWS Signature V4 signing and bounded `node:zlib` `gunzip` keeps R2 reads completely dependency-free, fast on serverless Node runtimes, and resilient against decompression bombs or open redirects.
- **Governing Decisions (`@adr`)**: [ADR-082](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/app/api/books/content/route.ts`](../src/app/api/books/content/route.ts))
- **Cross-Boundary Coupling**: Env Vars: `R2_ACCESS_KEY_ID`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_SECRET_ACCESS_KEY`
- **Test Contract**: [`src/lib/r2-client.test.ts`](../src/lib/r2-client.test.ts) (5 tests)

#### [`src/lib/rate-limiter.ts`](../src/lib/rate-limiter.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Route-mode-scoped sliding-window rate limiters (`booksApiRateLimiter`, `bookContentRateLimiter`, `bookCardRateLimiter`, `bookCoverRateLimiter`, `profileCardRateLimiter`) anchored on `globalThis`.
- **Behavioral Invariants (`@invariant`)**:
  - Anchor singleton limiters (`booksApiRateLimiter`, `bookContentRateLimiter`, `bookCardRateLimiter`, `bookCoverRateLimiter`, `profileCardRateLimiter`) on `globalThis` with bounded `maxKeys` capacity and periodic `pruneStaleRecords` eviction to prevent unbounded memory growth.
  - Keep `bookContentRateLimiter`, `bookCardRateLimiter`, `bookCoverRateLimiter`, `booksApiRateLimiter`, and `profileCardRateLimiter` buckets isolated so cover or card bursts never starve reader text requests.
- **Design Rationale (`@rationale`)**:
  - Zero-dependency `globalThis` persistence preserves quota tracking across hot reloads and warm serverless invocations without requiring external Redis infrastructure.
- **Governing Decisions (`@adr`)**: [ADR-016](DECISIONS.md), [ADR-022](DECISIONS.md), [ADR-033](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 4 runtime, 0 type-only ([`src/app/api/books/content/route.ts`](../src/app/api/books/content/route.ts), [`src/app/api/books/route.ts`](../src/app/api/books/route.ts), [`src/app/api/books/translations/route.ts`](../src/app/api/books/translations/route.ts), [`src/app/api/profiles/card/route.ts`](../src/app/api/profiles/card/route.ts))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/rate-limiter.test.ts`](../src/lib/rate-limiter.test.ts) (9 tests)

#### [`src/lib/reader-annotator.ts`](../src/lib/reader-annotator.ts) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Canonical text span matching (`findAllCanonicalTextSpans`), dual-band self+fellow overlap interval slicing, and highlight reconciliation utilities.
- **Behavioral Invariants (`@invariant`)**:
  - Execute an `O(N)` exact `indexOf` fast path first before falling back to `buildCanonicalIndexMap` (`--` <-> `—`, `_italic_`, whitespace, curly <-> straight quote equivalence) so saved annotations and bookmarks remain resilient across typography updates.
  - Slice overlapping personal and fellow marginalia into non-overlapping `AnnotationSpan` segments while filtering PII (`isFellowAnnotation`) cleanly.
- **Design Rationale (`@rationale`)**:
  - Character-index-mapped canonical search prevents annotation orphaning across reflow changes without slowing down common exact-match highlights.
- **Governing Decisions (`@adr`)**: [ADR-019](DECISIONS.md), [ADR-059](DECISIONS.md), [ADR-060](DECISIONS.md)
- **AST Blast Radius**: 11 runtime, 0 type-only ([`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/components/presentation/NotebookQuoteCard.tsx`](../src/components/presentation/NotebookQuoteCard.tsx), [`src/components/presentation/NotebookView.tsx`](../src/components/presentation/NotebookView.tsx), [`src/components/reader/ReaderAnnotationsDrawer.tsx`](../src/components/reader/ReaderAnnotationsDrawer.tsx), …)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/reader-annotator.test.ts`](../src/lib/reader-annotator.test.ts) (27 tests)

#### [`src/lib/reader-bookmark-geometry.ts`](../src/lib/reader-bookmark-geometry.ts) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: DOM `Range` row-geometry engine measuring per-line bookmark placement (`extractRowTextFromElement`) and duplicate-line reflow resolution (`resolveTextRowSpanInElement`).
- **Behavioral Invariants (`@invariant`)**:
  - Exclude injected `[data-testid="fellow-highlight-badge"]` DOM superscripts inside `collectContentTextSegments` (`TreeWalker`) so character offsets stay aligned with pure canonical page text.
  - Binary-search rendered character bounding rectangles (`measureCharRect`) and disambiguate duplicate phrases on the same page by shortest row distance to `fallbackRow` with relative ratio tiebreaking.
- **Design Rationale (`@rationale`)**:
  - Separating pure DOM `Range` geometry from React components allows reflow-resilient multi-row bookmark snapping to remain fast and deterministically unit-tested.
- **Governing Decisions (`@adr`)**: [ADR-068](DECISIONS.md)
- **AST Blast Radius**: 2 runtime, 0 type-only ([`src/components/reader/ReaderSurface.tsx`](../src/components/reader/ReaderSurface.tsx), [`src/hooks/reader/useReaderExitBookmark.ts`](../src/hooks/reader/useReaderExitBookmark.ts))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/reader-bookmark-geometry.test.ts`](../src/lib/reader-bookmark-geometry.test.ts) (8 tests)

#### [`src/lib/reader-cloud-sync.ts`](../src/lib/reader-cloud-sync.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Serialization, fractional row-bookmark decoding, synthetic Page-1 ghost detection, and lifespan-preserving author extraction for `public.reading_progress`.
- **Behavioral Invariants (`@invariant`)**:
  - Encode row bookmark offsets fractionally on `scroll_offset` (`page + row / 1000`) alongside reflow-anchored `bookmark_text`, and identify empty Page-1 rows cleanly via `isGhostReadingPosition` / `isGhostCloudRow`.
  - Preserve embedded contributor lifespans (`hasEmbeddedLifespans`) when merging remote rows so missing remote death years never strip local public domain dates (`extractVerifiedAuthors`).
- **Design Rationale (`@rationale`)**:
  - Shared row encoding and ghost classification let `useReaderStore` batch/prune cloud progress identically across mobile and desktop clients without `HTTP 451` lifespan regressions.
- **Governing Decisions (`@adr`)**: [ADR-014](DECISIONS.md), [ADR-068](DECISIONS.md), [ADR-070](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/stores/useReaderStore.ts`](../src/stores/useReaderStore.ts))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/reader-cloud-sync.test.ts`](../src/lib/reader-cloud-sync.test.ts) (2 tests)

#### [`src/lib/redirect-sanitizer.ts`](../src/lib/redirect-sanitizer.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Open-redirect validator, canonical auth/share origin resolver, recovery query scrubber, and signed Reading Card share URL builder.
- **Behavioral Invariants (`@invariant`)**:
  - Force relative redirects through `sanitizeRedirectPath` (single leading `/`, rejecting protocol-relative `//` and backslashes `\` / `/\`), and strip `recovery` params after consumption.
  - Normalize ephemeral Vercel preview hosts (`bookarium-*.vercel.app`) to canonical `SITE_CONFIG.SITE_URL` inside `resolveCanonicalAuthOrigin` / `resolveCanonicalShareOrigin` while preserving `localhost` / `127.0.0.1` for local dev.
- **Design Rationale (`@rationale`)**:
  - Prevents Open Redirect (`CWE-601`) and stops Vercel Deployment Protection URLs from leaking into OAuth confirmation emails or public OpenGraph share links.
- **Governing Decisions (`@adr`)**: [ADR-022](DECISIONS.md), [ADR-035](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 5 runtime, 0 type-only ([`src/app/auth/callback/route.ts`](../src/app/auth/callback/route.ts), [`src/components/profile/ProfileShareModal.tsx`](../src/components/profile/ProfileShareModal.tsx), [`src/components/reader/ReaderShareModal.tsx`](../src/components/reader/ReaderShareModal.tsx), [`src/components/ui/CursorTooltip.tsx`](../src/components/ui/CursorTooltip.tsx), …)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/redirect-sanitizer.test.ts`](../src/lib/redirect-sanitizer.test.ts) (13 tests)

#### [`src/lib/safe-storage.ts`](../src/lib/safe-storage.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: SSR-safe, quota-resilient Zustand `StateStorage` wrapper (`safeLocalStorage`) around `window.localStorage`.
- **Behavioral Invariants (`@invariant`)**:
  - Short-circuit to `null`/no-op whenever `typeof window === 'undefined'` and catch all `QuotaExceededError` / `SecurityError` browser exceptions cleanly without rethrowing.
- **Design Rationale (`@rationale`)**:
  - Node 22+ emits warnings or `TypeError`s on bare `localStorage` access during SSR, while private browsing modes can throw synchronously on `getItem`/`setItem`.
- **Governing Decisions (`@adr`)**: [ADR-003](DECISIONS.md), [ADR-069](DECISIONS.md)
- **AST Blast Radius**: 9 runtime, 0 type-only ([`src/stores/useAccoladesStore.ts`](../src/stores/useAccoladesStore.ts), [`src/stores/useAnnotationStore.ts`](../src/stores/useAnnotationStore.ts), [`src/stores/useAuthStore.ts`](../src/stores/useAuthStore.ts), [`src/stores/useBookshelfStore.ts`](../src/stores/useBookshelfStore.ts), …)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/safe-storage.test.ts`](../src/lib/safe-storage.test.ts) (7 tests)

#### [`src/lib/server-rsc-nav.ts`](../src/lib/server-rsc-nav.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Server-only App Router navigation header inspector isolating `next/headers` checks from client component bundles.
- **Behavioral Invariants (`@invariant`)**:
  - Read Next.js internal flight/prefetch headers (`rsc`, `next-router-state-tree`, `next-router-prefetch`, `accept`) defensively inside `try/catch`, returning `false` outside active request scopes and never importing client-side modules.
- **Design Rationale (`@rationale`)**:
  - Keeping `next/headers` inside a dedicated server leaf lets layout utilities detect RSC transitions cleanly without failing `Pass 0.5` transitive client-to-server AST isolation checks.
- **Governing Decisions (`@adr`)**: [ADR-035](DECISIONS.md), [ADR-042](DECISIONS.md)
- **AST Blast Radius**: 2 runtime, 0 type-only ([`src/app/read/[id]/reader-layout-utils.ts`](../src/app/read/[id]/reader-layout-utils.ts), [`src/app/u/[username]/layout.tsx`](../src/app/u/[username]/layout.tsx))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/server-rsc-nav.test.ts`](../src/lib/server-rsc-nav.test.ts) (2 tests)

#### [`src/lib/session-device-parser.ts`](../src/lib/session-device-parser.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: User-Agent browser/OS/device classifier and session payload normalizer supporting `get_active_sessions` device security cards.
- **Behavioral Invariants (`@invariant`)**:
  - Evaluate ordered browser signatures (`Edge` / `Opera` / `Chrome` / `Safari` precedence) safely without throwing on malformed or null `User-Agent` strings, falling back cleanly to `'Browser session'` / `'unknown'`.
- **Design Rationale (`@rationale`)**:
  - Parsing UA strings purely from `userAgent` tokens lets `/account` display recognizable active-device rows without storing invasive fingerprinting metadata.
- **Governing Decisions (`@adr`)**: [ADR-072](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 2 type-only ([`src/components/account/AccountSecuritySection.tsx`](../src/components/account/AccountSecuritySection.tsx), [`src/hooks/useAccountSecurityActions.ts`](../src/hooks/useAccountSecurityActions.ts) *(type)*, [`src/stores/useAuthStore.ts`](../src/stores/useAuthStore.ts) *(type)*)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/session-device-parser.test.ts`](../src/lib/session-device-parser.test.ts) (6 tests)

#### [`src/lib/share-card-primitives.ts`](../src/lib/share-card-primitives.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Shared 1200x630 HTML5 canvas bookplate primitives, Light/Sepia/Dark archival color palettes, privacy-preserving Web Intent builders, and handle/book-salted Base64URL FNV-1a token codecs.
- **Behavioral Invariants (`@invariant`)**:
  - Constrain all client and server canvas geometry to `CARD_DIMENSIONS` (`1200x630`), validate Base64URL token envelopes strictly against `^[A-Za-z0-9_-]{8,64}$`, and bind FNV-1a integrity signatures to an explicit caller namespace (`computeSaltedShareSignature`).
- **Design Rationale (`@rationale`)**:
  - Centralizing palette definitions, word wrapping, archival border ornaments, Web Intent URL formatting, and Base64URL codecs prevents UI or cryptographic drift between book Reading Cards and Scholar Sanctuary Profile Cards.
- **Governing Decisions (`@adr`)**: [ADR-033](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 6 runtime, 0 type-only ([`src/app/api/profiles/card/route.ts`](../src/app/api/profiles/card/route.ts), [`src/app/u/[username]/layout.tsx`](../src/app/u/[username]/layout.tsx), [`src/components/profile/ProfileShareModal.tsx`](../src/components/profile/ProfileShareModal.tsx), [`src/components/share/SocialSharePanel.tsx`](../src/components/share/SocialSharePanel.tsx), …)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/share-card-primitives.test.ts`](../src/lib/share-card-primitives.test.ts) (5 tests)

#### [`src/lib/supabase/client.ts`](../src/lib/supabase/client.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Browser Supabase SSR client factory plus shared URL and User-Agent sanitization helpers consumed across browser, server, and Edge middleware Supabase clients.
- **Behavioral Invariants (`@invariant`)**:
  - Strip trailing `/rest/v*` suffixes and trailing slashes inside `sanitizeSupabaseUrl`, falling back to `https://placeholder.supabase.co` and `'placeholder-anon-key'` when env vars are unset so zero-API-key builds succeed.
  - Strip CR/LF/tabs and cap `sanitizeForwardedUserAgent` at `512` characters before forwarding client User-Agent headers in server-side Supabase Auth requests.
- **Design Rationale (`@rationale`)**:
  - Header injection sanitization prevents malformed Auth session telemetry, while keyless placeholders maintain strict local offline parity without mandatory `.env` setup.
- **Governing Decisions (`@adr`)**: [ADR-005](DECISIONS.md), [ADR-072](DECISIONS.md)
- **AST Blast Radius**: 19 runtime, 1 type-only ([`src/app/api/books/content/metadata-cache.ts`](../src/app/api/books/content/metadata-cache.ts), [`src/app/api/books/content/route.ts`](../src/app/api/books/content/route.ts), [`src/app/read/[id]/reader-layout-utils.ts`](../src/app/read/[id]/reader-layout-utils.ts), [`src/app/u/[username]/page.tsx`](../src/app/u/[username]/page.tsx), [`src/lib/fellowship-cloud-sync.ts`](../src/lib/fellowship-cloud-sync.ts) *(type)*, …)
- **Cross-Boundary Coupling**: Env Vars: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`
- **Test Contract**: [`src/lib/supabase/client.test.ts`](../src/lib/supabase/client.test.ts) (4 tests)

#### [`src/lib/supabase/middleware.ts`](../src/lib/supabase/middleware.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Edge Proxy session refresh helper (`updateSession`) synchronizing Supabase Auth cookies and propagating the short-lived `CLIENT_IP_SYNC` trigger cookie on rotated tokens.
- **Behavioral Invariants (`@invariant`)**:
  - Short-circuit immediately when Supabase env vars or `SUPABASE_AUTH_COOKIE_PATTERN` cookies are absent, and ignore `setAll` calls containing solely empty cookie values (`Max-Age=0` deletion protection) so raced server refreshes never wipe active sessions.
  - Stamp `STORAGE_KEYS.CLIENT_IP_SYNC` (`120s` TTL, `sameSite: 'lax'`, `secure: isHttpsRequest(request)`) whenever a non-empty auth token cookie rotates, and swallow transient `supabase.auth.getUser()` network errors without blocking navigation.
- **Design Rationale (`@rationale`)**:
  - Concurrent SSR requests can race single-use Supabase refresh tokens; refusing empty cookie deletions preserves valid browser sessions while allowing explicit client sign-out to clear credentials deterministically.
- **Governing Decisions (`@adr`)**: [ADR-035](DECISIONS.md), [ADR-072](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/proxy.ts`](../src/proxy.ts))
- **Cross-Boundary Coupling**: Storage/Cookies: `bookarium-client-ip-sync` · Env Vars: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`
- **Test Contract**: [`src/lib/supabase/middleware.test.ts`](../src/lib/supabase/middleware.test.ts) (5 tests)

#### [`src/lib/supabase/server.ts`](../src/lib/supabase/server.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Request-scoped Next.js Server Component & Route Handler Supabase SSR client factory.
- **Behavioral Invariants (`@invariant`)**:
  - Bind per-request `cookies()` getters/setters while catching `cookieStore.set` read-only throws inside Server Components, and forward only sanitized User-Agent headers (`sanitizeForwardedUserAgent`).
- **Design Rationale (`@rationale`)**:
  - Allows Server Components and `/auth/callback` route handlers to read authenticated Supabase sessions cleanly while preserving accurate multi-device session logs without crashing RSC renders.
- **Governing Decisions (`@adr`)**: [ADR-005](DECISIONS.md), [ADR-042](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/app/auth/callback/route.ts`](../src/app/auth/callback/route.ts))
- **Cross-Boundary Coupling**: Env Vars: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`
- **Test Contract**: [`src/lib/supabase/server.test.ts`](../src/lib/supabase/server.test.ts) (3 tests)

#### [`src/lib/sync-utils.ts`](../src/lib/sync-utils.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Cross-store Supabase cloud synchronization coordinator and session-validity re-export hub.
- **Behavioral Invariants (`@invariant`)**:
  - Reject empty `userId` and coalesce overlapping sync calls per `userId` via `coalesceInFlightByUser` so concurrent mount/focus events share one Promise identity (`p1 === p2`).
  - Verify an active authenticated cookie/session via `verifyActiveCloudSession` before dispatching PostgREST queries across the 7 syncable stores, executing all stores under `Promise.allSettled` for partial-failure isolation and forwarding optional `PASSIVE_SYNC_COOLDOWN_MS` (`authMinSyncIntervalMs` / `minSyncIntervalMs`) cleanly when supplied.
- **Design Rationale (`@rationale`)**:
  - Without pre-sync token verification, stale tabs whose `sb-*-auth-token` cookies were cleared emit bursts of PostgreSQL `42501` RLS write violations and overwrite state with false empty `SELECT` arrays; opt-in `authMinSyncIntervalMs` deduplicates redundant profile fetches immediately after bootstrap or token refreshes without delaying collection store recovery.
- **Governing Decisions (`@adr`)**: [ADR-005](DECISIONS.md), [ADR-035](DECISIONS.md), [ADR-069](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-086](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/app/providers.tsx`](../src/app/providers.tsx))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/lib/sync-utils.test.ts`](../src/lib/sync-utils.test.ts) (5 tests)

**Exported & Symbol-Level Contracts:**

| Symbol | Signature | Scope / Invariants / Rationale |
| :--- | :--- | :--- |
| `syncAllStoresWithCloud` | `(userId, options)` | **Scope**: Fans out unified 7-store cloud synchronization for a verified `userId`. **Invariants**: Must execute `verifyActiveCloudSession` inside the coalesced per-user flight before calling `syncWithCloud` / `fetchFellowshipData`. |


### Layer: State Stores (Zustand) (10 Contracted)

#### [`src/stores/useAccoladesStore.ts`](../src/stores/useAccoladesStore.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Literary accolades unlock ledger, pending celebration queue, personal Ex-Libris showcase pinning (`MAX_PINNED_ACCOLADES = 3`), and offline pin outbox sync.
- **Behavioral Invariants (`@invariant`)**:
  - Cap showcased bookplates strictly at `MAX_PINNED_ACCOLADES` (`3`), preserve pending offline pin mutations (`pendingPinUpdates`) until cloud flush succeeds, and coalesce sync via `coalesceInFlightByUser`.
  - Bypass `15,000ms` passive mount cooldown (`lastAccoladesSyncByUser`) on explicit unlocks/pins (`invalidateAccoladesSyncCooldown`).
- **Design Rationale (`@rationale`)**:
  - Coalescing sync flights and isolating `pendingPinUpdates` prevents celebration loops or un-pinned showcase regressions when reconnecting after offline milestones.
- **Governing Decisions (`@adr`)**: [ADR-027](DECISIONS.md), [ADR-030](DECISIONS.md), [ADR-032](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 5 runtime, 0 type-only ([`src/app/u/[username]/page.tsx`](../src/app/u/[username]/page.tsx), [`src/components/accolades/AccoladeCelebrationModal.tsx`](../src/components/accolades/AccoladeCelebrationModal.tsx), [`src/components/account/AccountAccoladesCard.tsx`](../src/components/account/AccountAccoladesCard.tsx), [`src/lib/sync-utils.ts`](../src/lib/sync-utils.ts), …)
- **Cross-Boundary Coupling**: DB Tables: `public.user_accolades` · Storage/Cookies: `bookarium-accolades-storage`
- **Test Contract**: [`src/stores/useAccoladesStore.test.ts`](../src/stores/useAccoladesStore.test.ts) (11 tests)

#### [`src/stores/useAnnotationStore.ts`](../src/stores/useAnnotationStore.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Personal Commonplace highlights/notes, Fellow Marginalia feed, chapter Spoiler Shield state, and queued annotation outbox sync.
- **Behavioral Invariants (`@invariant`)**:
  - Prune flushed deletion `tombstones` after cloud delete confirmation while advancing `lastAnnotationSyncAt` so stale local tombstones never block restored annotations or resurrect remotely deleted highlights.
  - Exclude internal `upsertError` retries from marking `dirty*Users` retry loops, enforce `MAX_ANNOTATION_TEXT_LENGTH` / `MAX_ANNOTATION_NOTE_LENGTH` bounds, and coalesce reads via `coalesceInFlightByUser` (`15,000ms` passive cooldowns).
- **Design Rationale (`@rationale`)**:
  - Separating persisted LWW `lastAnnotationSyncAt` anchors from ephemeral passive cooldowns prevents multi-device highlight count divergence without re-fetching unchanged marginalia on drawer switches.
- **Governing Decisions (`@adr`)**: [ADR-019](DECISIONS.md), [ADR-055](DECISIONS.md), [ADR-059](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 12 runtime, 11 type-only ([`src/app/account/page.tsx`](../src/app/account/page.tsx), [`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/components/account/AccountAccoladesCard.tsx`](../src/components/account/AccountAccoladesCard.tsx), [`src/components/account/HighlightBioPickerModal.tsx`](../src/components/account/HighlightBioPickerModal.tsx), [`src/components/presentation/NotebookQuoteCard.tsx`](../src/components/presentation/NotebookQuoteCard.tsx) *(type)*, [`src/components/presentation/notebook/NotebookFilterStrip.tsx`](../src/components/presentation/notebook/NotebookFilterStrip.tsx) *(type)*, …)
- **Cross-Boundary Coupling**: DB Tables: `public.user_annotations` · Storage/Cookies: `bookarium-annotations-storage`
- **Test Contract**: [`src/stores/useAnnotationStore.test.ts`](../src/stores/useAnnotationStore.test.ts) (38 tests)

#### [`src/stores/useAuthStore.ts`](../src/stores/useAuthStore.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Authentication lifecycle, Cloudflare Turnstile & honeypot bot guards, active session verification, session revocation RPCs, and 3-layer GDPR account deletion.
- **Behavioral Invariants (`@invariant`)**:
  - Non-wipe `resetClientAuthState` teardown must clear all user collections BEFORE setting `user: null` while preserving IndexedDB `offline_books`; `wipeDeviceStorage: true` during `deleteAccount` must erase all 10 Zustand slices, localStorage keys, cookies, and IndexedDB in lockstep (`Rule 9`).
  - Persist `STORAGE_KEYS.PENDING_STORE_CLEANUP` synchronously across teardowns so interrupted reloads finish cleanup in `initializeAuth()` without affecting offline signed-in sessions or guest users.
  - Verify `verifyActiveCloudSession` strictly read-only/coalesced across tabs, ignoring transient offline/`5xx` errors while tearing down dead/cleared sessions, and honor optional `minSyncIntervalMs` cooldown in `syncWithCloud` after live `fetchProfile` completion unless `pendingProfileUpdates` or dirty markers exist.
- **Design Rationale (`@rationale`)**:
  - Ordering collection resets before nullifying `user` prevents guest persistence leaks or stale UI flashes, reload-safe cleanup markers eliminate orphaned personal records after tab close mid-signout, and opt-in `minSyncIntervalMs` skips duplicate bootstrap/token-refresh profile queries without blocking offline flush recovery.
- **Governing Decisions (`@adr`)**: [ADR-005](DECISIONS.md), [ADR-072](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-086](DECISIONS.md)
- **AST Blast Radius**: 22 runtime, 0 type-only ([`src/app/account/page.tsx`](../src/app/account/page.tsx), [`src/app/auth/confirm-deletion/page.tsx`](../src/app/auth/confirm-deletion/page.tsx), [`src/app/providers.tsx`](../src/app/providers.tsx), [`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), …)
- **Cross-Boundary Coupling**: DB Tables: `public.bookshelf_items`, `public.bookshelves`, `public.profiles`, `public.reader_circles`, `public.reading_progress`, `public.symposium_sessions`, `public.user_accolades`, `public.user_annotations`, `public.user_book_curation`, `public.user_favorites`, `public.user_reading_habits` · RPCs: `public.delete_current_user()`, `public.get_active_sessions()`, `public.revoke_user_session()` · API Calls: `/auth/callback` · Signals: emits `CustomEvent:bookarium:auth-token-refreshed` · Storage/Cookies: `bookarium-auth-hint`, `bookarium-auth-profile`, `bookarium-client-ip-sync`, `bookarium-pending-store-cleanup`, `bookarium_auto_heal_attempted` · Env Vars: `NODE_ENV`
- **Test Contract**: [`src/stores/useAuthStore.test.ts`](../src/stores/useAuthStore.test.ts) (52 tests)

#### [`src/stores/useBookshelfStore.ts`](../src/stores/useBookshelfStore.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Personal library state (saved volumes, queue, favorites, custom named shelves, ratings, statuses), tombstone tracking, and offline outbox orchestration.
- **Behavioral Invariants (`@invariant`)**:
  - Preserve authentic contributor lifespans (`isPlaceholderAuthor`) during `enrichSavedBooks` and retain IndexedDB `offline_books` whenever a removed book still exists on another shelf, in `favoriteBookIds`, or in active reading progress.
  - Route all Supabase persistence through `bookshelf-cloud-sync.ts` outbox queues, tombstone filters (`deletedBookIds`, `deletedFavoriteBookIds`), and `15,000ms` passive mount cooldown invalidation (`invalidateBookshelfSyncCooldown`).
- **Design Rationale (`@rationale`)**:
  - Scoped IndexedDB retention prevents losing downloaded chapters while organizing multiple shelves, and outbox + tombstone separation keeps offline edits deterministic across multi-device syncs.
- **Governing Decisions (`@adr`)**: [ADR-003](DECISIONS.md), [ADR-069](DECISIONS.md), [ADR-071](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 26 runtime, 0 type-only ([`src/app/account/page.tsx`](../src/app/account/page.tsx), [`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/app/u/[username]/page.tsx`](../src/app/u/[username]/page.tsx), [`src/components/account/AccountAccoladesCard.tsx`](../src/components/account/AccountAccoladesCard.tsx), …)
- **Cross-Boundary Coupling**: DB Tables: `public.bookshelf_items`, `public.user_book_curation`, `public.user_favorites` · Signals: emits `CustomEvent:bookarium:offline-updated` · Storage/Cookies: `bookarium-bookshelf-storage`
- **Test Contract**: [`src/stores/useBookshelfStore.test.ts`](../src/stores/useBookshelfStore.test.ts) (50 tests)

#### [`src/stores/useFellowshipStore.ts`](../src/stores/useFellowshipStore.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Reader Circle 1-on-1 fellowship state, per-volume Literary Symposium dual-reading sessions, and offline symposium progress outbox.
- **Behavioral Invariants (`@invariant`)**:
  - Guard `fetchFellowshipData` / `syncWithCloud` behind `verifyActiveCloudSession` and `coalesceInFlightByUser` (`15,000ms` passive cooldown invalidated on membership or symposium mutations).
  - Resolve placeholder usernames cleanly via `healProfileIdentity` / `fetchScholarProfilesMap` without leaking private profile PII or overwriting verified scholar handles.
- **Design Rationale (`@rationale`)**:
  - Pre-sync session validation and per-user promise coalescing stop participant RLS errors after cookie expiry while keeping companion progress synchronized offline-first.
- **Governing Decisions (`@adr`)**: [ADR-055](DECISIONS.md), [ADR-069](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 20 runtime, 0 type-only ([`src/app/account/page.tsx`](../src/app/account/page.tsx), [`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/components/account/AccountAccoladesCard.tsx`](../src/components/account/AccountAccoladesCard.tsx), [`src/components/account/AccountSymposiumSection.tsx`](../src/components/account/AccountSymposiumSection.tsx), …)
- **Cross-Boundary Coupling**: DB Tables: `public.profiles`, `public.reader_circles`, `public.symposium_sessions` · RPCs: `public.lookup_scholar_by_username()` · Storage/Cookies: `bookarium-fellowship-storage`
- **Test Contract**: [`src/stores/useFellowshipStore.test.ts`](../src/stores/useFellowshipStore.test.ts) (15 tests)

#### [`src/stores/useHabitsStore.ts`](../src/stores/useHabitsStore.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Reading streak telemetry (`MIN_STREAK_DURATION_SECONDS = 300`), daily activity calendar, annual reading goal tracking, and dual reading vs. listening immersion counters.
- **Behavioral Invariants (`@invariant`)**:
  - Require `>= 300` active daily immersion seconds to unlock a streak day, coalesce syncs via `coalesceInFlightByUser`, and skip redundant `user_reading_habits` upserts when `isRemoteAlreadyConverged` holds.
  - Bypass the `15,000ms` passive mount cooldown (`lastHabitsSyncByUser`) whenever debounce timers or dirty updates are pending, resetting timers cleanly on factory resets.
- **Design Rationale (`@rationale`)**:
  - Skipping converged no-op upserts cuts redundant Postgres writes across navigation/account mounts while preserving monotonically merged dates and active immersion totals.
- **Governing Decisions (`@adr`)**: [ADR-027](DECISIONS.md), [ADR-029](DECISIONS.md), [ADR-032](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 7 runtime, 1 type-only ([`src/app/account/page.tsx`](../src/app/account/page.tsx), [`src/app/u/[username]/page.tsx`](../src/app/u/[username]/page.tsx), [`src/components/account/AccountAccoladesCard.tsx`](../src/components/account/AccountAccoladesCard.tsx), [`src/components/account/AccountHabitsCard.tsx`](../src/components/account/AccountHabitsCard.tsx), [`src/lib/accolades-engine.ts`](../src/lib/accolades-engine.ts) *(type)*, …)
- **Cross-Boundary Coupling**: DB Tables: `public.user_reading_habits` · Storage/Cookies: `bookarium-habits-storage`
- **Test Contract**: [`src/stores/useHabitsStore.test.ts`](../src/stores/useHabitsStore.test.ts) (17 tests)

#### [`src/stores/useJurisdictionStore.ts`](../src/stores/useJurisdictionStore.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Client-side regional copyright jurisdiction state (`country`, `rule`, `overrideCountry`) synchronized with `bookarium-geo-country` cookie context.
- **Behavioral Invariants (`@invariant`)**:
  - Normalize every ISO country code through `normalizeCountryCode`, resolve initial territory synchronously from `GEO_COOKIE_NAME` (or dev timezone / `'US'` default), and recompute `rule` via `getJurisdictionRule`.
  - Never persist `overrideCountry` across reloads or allow stale cookie drift to bypass copyright gating.
- **Design Rationale (`@rationale`)**:
  - Synchronous initial country resolution avoids client hydration flicker on regional availability badges while matching server edge-proxy `bookarium-geo-country` headers.
- **Governing Decisions (`@adr`)**: [ADR-036](DECISIONS.md), [ADR-042](DECISIONS.md), [ADR-044](DECISIONS.md)
- **AST Blast Radius**: 10 runtime, 0 type-only ([`src/app/providers.tsx`](../src/app/providers.tsx), [`src/components/presentation/BookshelfRack.tsx`](../src/components/presentation/BookshelfRack.tsx), [`src/components/presentation/EditorialQuoteSection.tsx`](../src/components/presentation/EditorialQuoteSection.tsx), [`src/components/presentation/HeroSearch.tsx`](../src/components/presentation/HeroSearch.tsx), …)
- **Cross-Boundary Coupling**: Env Vars: `NODE_ENV`
- **Test Contract**: [`src/stores/useJurisdictionStore.test.ts`](../src/stores/useJurisdictionStore.test.ts) (9 tests)

#### [`src/stores/usePreferencesStore.ts`](../src/stores/usePreferencesStore.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Persisted UI/accessibility preferences (`stickyScrollEnabled`, `exitBookmarkReminderEnabled`, Web Speech narration voice/rate settings), saved user `customDefaults` snapshot, and `preferencesUpdatedAt` watermark.
- **Behavioral Invariants (`@invariant`)**:
  - Keep `FACTORY_PREFERENCES` alignment for sticky scroll, exit bookmark reminder, and TTS settings, and reset every field to factory defaults on `resetAllPreferencesStore()` during account deletion (`Rule 9`).
  - Coordinate cross-store preset capture/restore and Supabase `profiles.preferences` JSONB sync exclusively through `src/lib/preferences-sync.ts`.
- **Design Rationale (`@rationale`)**:
  - Separating durable user presets and audio settings from volatile reader positions ensures full 10-store local erasure parity (`clearLocalUserStores({ wipeDeviceStorage: true })`) without cross-store cycles.
- **Governing Decisions (`@adr`)**: [ADR-009](DECISIONS.md), [ADR-018](DECISIONS.md), [ADR-072](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 5 runtime, 0 type-only ([`src/app/account/page.tsx`](../src/app/account/page.tsx), [`src/app/page.tsx`](../src/app/page.tsx), [`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/lib/preferences-sync.ts`](../src/lib/preferences-sync.ts), …)
- **Cross-Boundary Coupling**: Storage/Cookies: `bookarium-navigation-preferences`
- **Test Contract**: [`src/stores/usePreferencesStore.test.ts`](../src/stores/usePreferencesStore.test.ts) (7 tests)

#### [`src/stores/useReaderStore.ts`](../src/stores/useReaderStore.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Focus Reader persisted typography/theme state, reflow-safe reading positions, silk row-bookmark persistence, and batched `reading_progress` cloud reconciliation.
- **Behavioral Invariants (`@invariant`)**:
  - Suppress and scrub synthetic `0%` Page-1 ghost coordinates (`isGhostReadingPosition` / `isGhostCloudRow`) from local dirty tracking and cloud writes while preserving explicit user `'finished'` statuses.
  - Track dirty edits via `dirtyPositionBookIds` and clear uploaded IDs (`clearUploadedDirtyPositions`) before pruning stale non-dirty cloud deletions; never erase authentic contributor lifespans (`hasEmbeddedLifespans` / `isPlaceholderAuthor`).
  - Batch multi-volume `reading_progress` synchronization via `upsertReadingProgressBatch` and cancel pending `progressDebounceTimers` whenever a newer cloud bookmark is adopted.
- **Design Rationale (`@rationale`)**:
  - Eliminates mount-reflow bookmark overwrites (`aad64bf`), collapses 34+ parallel HTTP upserts into one conflict-resolved batch, and prevents stale tabs from resurrecting deleted bookmarks.
- **Governing Decisions (`@adr`)**: [ADR-003](DECISIONS.md), [ADR-014](DECISIONS.md), [ADR-068](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 28 runtime, 20 type-only ([`src/app/account/page.tsx`](../src/app/account/page.tsx), [`src/app/page.tsx`](../src/app/page.tsx), [`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/app/u/[username]/page.tsx`](../src/app/u/[username]/page.tsx), [`src/components/account/AccountPreferencesSection.tsx`](../src/components/account/AccountPreferencesSection.tsx) *(type)*, [`src/components/account/AccountTypographySubPanel.tsx`](../src/components/account/AccountTypographySubPanel.tsx) *(type)*, …)
- **Cross-Boundary Coupling**: DB Tables: `public.reading_progress` · Storage/Cookies: `bookarium-reader-preferences`
- **Test Contract**: [`src/stores/useReaderStore.test.ts`](../src/stores/useReaderStore.test.ts) (35 tests)

#### [`src/stores/useThemeStore.ts`](../src/stores/useThemeStore.ts) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Global visual theme state (`light` Day Paper, `sepia` Cozy Coffee, `dark` Obsidian) with zero-flash SSR cookie synchronization (`STORAGE_KEYS.THEME`).
- **Behavioral Invariants (`@invariant`)**:
  - Mirror every theme transition synchronously to `document.documentElement` classes (`dark` / `sepia`), `colorScheme`, and the `bookarium-theme-preference` cookie alongside Zustand `persist` storage.
  - Resolve client-persisted `dark`/`sepia` overrides inside `initializeTheme` without reverting explicit SSR non-light initializations.
- **Design Rationale (`@rationale`)**:
  - Synchronizing the theme cookie lets `src/app/layout.tsx` server-render the exact theme class on initial HTML response, guaranteeing 0.00 CLS and zero white-flash on dark/sepia loads.
- **Governing Decisions (`@adr`)**: [ADR-001](DECISIONS.md), [ADR-042](DECISIONS.md), [ADR-079](DECISIONS.md)
- **AST Blast Radius**: 8 runtime, 7 type-only ([`src/app/account/page.tsx`](../src/app/account/page.tsx), [`src/app/providers.tsx`](../src/app/providers.tsx), [`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/components/presentation/Navbar.tsx`](../src/components/presentation/Navbar.tsx), [`src/app/layout.tsx`](../src/app/layout.tsx) *(type)*, [`src/components/account/AccountBottomDock.tsx`](../src/components/account/AccountBottomDock.tsx) *(type)*, …)
- **Cross-Boundary Coupling**: Storage/Cookies: `bookarium-theme-preference`
- **Test Contract**: [`src/stores/useThemeStore.test.ts`](../src/stores/useThemeStore.test.ts) (8 tests)


### Layer: React Hooks & Queries (11 Contracted)

#### [`src/hooks/queries/useBookContent.ts`](../src/hooks/queries/useBookContent.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Reader text fetcher and React Query hook (`useBookContent`) resolving IndexedDB offline storage, same-origin `/api/books/content?id=<bookId>` R2 streams, and typed `LegalRestrictionError` (`HTTP 451`) failures.
- **Behavioral Invariants (`@invariant`)**:
  - Configure `networkMode: 'always'` so locally persisted IndexedDB books resolve instantaneously when offline, and resolve authoritative local author lifespans before serving offline volumes in non-US jurisdictions while online.
  - Never dispatch legacy `?url=` proxy queries without a positive integer `bookId`, never retry `LegalRestrictionError` (`HTTP 451`) or requests while `!navigator.onLine`, align React Query `staleTime` and `gcTime` on `BOOK_CONTENT_CACHE_TTL_MS` (`60m`), and fall back to local IndexedDB text on network timeouts (`BOOK_CONTENT_TIMEOUT_MS`).
- **Design Rationale (`@rationale`)**:
  - Default React Query `online` mode pauses queries when the browser reports offline, breaking IndexedDB offline reading; `networkMode: 'always'` preserves local-first reading while enforcing territorial clearance and zero Project Gutenberg fallback.
- **Governing Decisions (`@adr`)**: [ADR-020](DECISIONS.md), [ADR-036](DECISIONS.md), [ADR-070](DECISIONS.md), [ADR-082](DECISIONS.md), [ADR-084](DECISIONS.md), [ADR-086](DECISIONS.md)
- **AST Blast Radius**: 3 runtime, 0 type-only ([`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/components/reader/ReaderErrorView.tsx`](../src/components/reader/ReaderErrorView.tsx), [`src/hooks/useBookPassageShuffle.ts`](../src/hooks/useBookPassageShuffle.ts))
- **Cross-Boundary Coupling**: API Calls: `/api/books/content`
- **Test Contract**: [`src/hooks/queries/useBookContent.test.ts`](../src/hooks/queries/useBookContent.test.ts) (19 tests)

#### [`src/hooks/queries/useBookTranslations.ts`](../src/hooks/queries/useBookTranslations.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Two-tier edition discovery hook (`useBookTranslations`) resolving alternate language editions via relational `/api/books/translations` links with root-title + author-surname fallback lookup.
- **Behavioral Invariants (`@invariant`)**:
  - Normalize titles and author surnames (`extractRootTitle`, `extractAuthorSurname`) while ignoring placeholder authors (`isPlaceholderAuthor`) when constructing fallback search queries, and partition Tier-1 & Tier-2 query keys by normalized `effectiveCountry` so jurisdiction changes never reuse stale regional edition lists.
  - Deduplicate Tier-1 relational DB translations and Tier-2 `/api/books` fallback candidates against `currentBookId`, preserving ISO-639-1 human-readable language labels via `resolveLanguageLabel`.
- **Design Rationale (`@rationale`)**:
  - Combines exact Wikidata FRBR links from Supabase with deterministic catalog search fallback so unseeded or locally tested books still surface sibling translations reliably.
- **Governing Decisions (`@adr`)**: [ADR-010](DECISIONS.md), [ADR-038](DECISIONS.md), [ADR-086](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 2 type-only ([`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/components/reader/ReaderHeader.tsx`](../src/components/reader/ReaderHeader.tsx) *(type)*, [`src/components/reader/ReaderLanguageDrawer.tsx`](../src/components/reader/ReaderLanguageDrawer.tsx) *(type)*)
- **Cross-Boundary Coupling**: API Calls: `/api/books`, `/api/books/translations`
- **Test Contract**: [`src/hooks/queries/useBookTranslations.test.ts`](../src/hooks/queries/useBookTranslations.test.ts) (19 tests)

#### [`src/hooks/queries/useBooks.ts`](../src/hooks/queries/useBooks.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: TanStack React Query hooks and fetchers for `/api/books` catalog search (`useBooks`), featured passage hydration (`useFeaturedQuotes`), and popularity-ranked quote pools (`useQuoteEnrichedBooks`).
- **Behavioral Invariants (`@invariant`)**:
  - Force `copyright=false` on every outbound `/api/books` request, bound requests with a `15s` `AbortController`, never auto-retry `HTTP 504` / abort timeouts or `400`/`429` rejections, and re-filter returned books through `isBookPublicDomainInJurisdiction` unless `includeRestrictedMetadata` is requested.
  - Guard `useQuoteEnrichedBooks` with `bookarium-quote-enriched-books-v1` `localStorage` caching and `QUOTE_POOL_SETTLE_TIMEOUT_MS` (`1500ms`) so UI quote consumers wait cleanly until `isPoolSettled` without swapping database text over fallback text in place; consult `bookarium-extracted-passages-v1` read-only (`>= 3` locally extracted passages) inside `fetchFeaturedQuotesMap` without writing server DB quotes back into `bookarium-extracted-passages-v1`.
- **Design Rationale (`@rationale`)**:
  - Client-side copyright filtering, deterministic quote sorting, and non-retrying timeout errors prevent regional/visual flash regressions and retry storms against timed-out catalog scans, while read-only passage reuse avoids redundant deep-quote requests without suppressing dynamic text extraction.
- **Governing Decisions (`@adr`)**: [ADR-004](DECISIONS.md), [ADR-036](DECISIONS.md), [ADR-043](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-086](DECISIONS.md)
- **AST Blast Radius**: 10 runtime, 0 type-only ([`src/app/page.tsx`](../src/app/page.tsx), [`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/components/presentation/BookPreviewModal.tsx`](../src/components/presentation/BookPreviewModal.tsx), [`src/components/presentation/EditorialQuoteSection.tsx`](../src/components/presentation/EditorialQuoteSection.tsx), …)
- **Cross-Boundary Coupling**: DB Tables: `public.books` · API Calls: `/api/books` · Storage/Cookies: `bookarium-quote-enriched-books-v1`
- **Test Contract**: [`src/hooks/queries/useBooks.test.ts`](../src/hooks/queries/useBooks.test.ts) (25 tests)

#### [`src/hooks/reader/useContinueReadingLedger.ts`](../src/hooks/reader/useContinueReadingLedger.ts) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Headless Continue Reading ledger hook merging multi-store book metadata (`favorites -> saved -> recent -> offline -> currentBook -> API`), reading coordinates, and offline/status filtering for `/bookmarks`.
- **Behavioral Invariants (`@invariant`)**:
  - Merge metadata non-regressively inside `setOrMergeBook` using `hasAuthenticAuthors` and `hasLifespan` checks so offline or partial records never replace verified author lifespans with fallback placeholders.
  - Hydrate remaining incomplete IDs only once mounted (`hasMounted`) via session-tracked `attemptedMissingIds` deduplication and expose accurate tab counts (`all`, `in_progress`, `completed`, `on_hold`, `downloaded`).
- **Design Rationale (`@rationale`)**:
  - Reading ledgers combine data stored before and after metadata healing; prioritizing verified author lifespans preserves offline reading accuracy and non-US copyright clearance.
- **Governing Decisions (`@adr`)**: [ADR-013](DECISIONS.md), [ADR-070](DECISIONS.md), [ADR-071](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/components/presentation/BookmarksView.tsx`](../src/components/presentation/BookmarksView.tsx))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/hooks/reader/useContinueReadingLedger.test.ts`](../src/hooks/reader/useContinueReadingLedger.test.ts) (31 tests)

#### [`src/hooks/reader/useReaderSession.ts`](../src/hooks/reader/useReaderSession.ts) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Headless Reader session controller managing chapter pagination state, `bookmarkText`-first reflow-resilient auto-resume, bidirectional page navigation, active `pinnedBookmark` inspection, and coordinate persistence.
- **Behavioral Invariants (`@invariant`)**:
  - Restore saved positions via `findCanonicalTextSpan` when `bookmarkText` shifts pages across font/viewport reflows, expose immutable `pinnedBookmark` coordinates (`PinnedBookmarkCoordinate`) while preserving them across passive page turns, clamp out-of-bounds chapter/page indices safely, and separate layout adjustments (`isLayoutSync`) from user bookmark mutations (`hasUserModifiedSessionRef`).
  - Flush position and percentage progress updates (`saveReadingPosition`, `setProgress`) synchronously on chapter/page navigation and unmount cleanup without dropping `bookmarkRow` or `bookmarkText`.
- **Design Rationale (`@rationale`)**:
  - Font size changes and desktop-to-mobile transitions alter virtual page numbers; phrase-anchored coordinate resolution keeps readers anchored to their exact sentence, while exposing `pinnedBookmark` lets drawers display and jump back to the active silk bookmark across chapters.
- **Governing Decisions (`@adr`)**: [ADR-003](DECISIONS.md), [ADR-014](DECISIONS.md), [ADR-068](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/hooks/reader/useReaderSession.test.ts`](../src/hooks/reader/useReaderSession.test.ts) (18 tests)

#### [`src/hooks/useAccountSecurityActions.ts`](../src/hooks/useAccountSecurityActions.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Headless Account Security controller managing current-password verified updates, email verification resends, OAuth identity linking/unlinking, deletion requests, and multi-device sessions.
- **Behavioral Invariants (`@invariant`)**:
  - Guard OAuth unlinking behind `canUnlinkGoogle` (`hasGoogleIdentity && hasPasswordIdentity`), require `currentPassword` validation on password updates, and synchronize session revocations across tabs via `BroadcastChannel('bookarium-sessions-sync')` plus `bookarium:auth-token-refreshed`.
  - Suppress session and security mutations cleanly when `isOffline` or `isPreviewMode`, preserving clear recovery/verification cooldown timers without orphaned network actions.
- **Design Rationale (`@rationale`)**:
  - Centralizing OWASP re-authentication, cross-tab session revocation signaling, and identity invariants keeps security components purely presentational.
- **Governing Decisions (`@adr`)**: [ADR-005](DECISIONS.md), [ADR-072](DECISIONS.md), [ADR-073](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/app/account/page.tsx`](../src/app/account/page.tsx))
- **Cross-Boundary Coupling**: Signals: emits `BroadcastChannel:bookarium-sessions-sync`; listens `BroadcastChannel:bookarium-sessions-sync`, `CustomEvent:bookarium:auth-token-refreshed`
- **Test Contract**: [`src/hooks/useAccountSecurityActions.test.ts`](../src/hooks/useAccountSecurityActions.test.ts) (8 tests)

#### [`src/hooks/useBookPassageShuffle.ts`](../src/hooks/useBookPassageShuffle.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Interactive book preview passage coordinator managing three-tier quote sourcing, bounded `EXTRACTED_PASSAGES_CACHE_KEY` caching, and reduced-motion-safe 3D leaf-turn resets.
- **Behavioral Invariants (`@invariant`)**:
  - Prioritize pre-seeded `supabaseQuotes` (skipping redundant full-text fetches whenever `>= 2` passages are present), falling back to bounded `EXTRACTED_PASSAGES_CACHE_KEY` (`MAX_EXTRACTED_PASSAGES_ENTRIES`, `EXTRACTED_PASSAGES_TTL_MS`) or `curatedPassages`.
  - Reset `isTurningLeaf` via timeout safety fallback so page-turn interactions never lock under `prefers-reduced-motion` or 2D mobile mode.
- **Design Rationale (`@rationale`)**:
  - Avoiding unnecessary full-text fetches on quote-enriched Hero and Catalog volumes honors zero-pull homepage protection while preserving instant passage shuffling everywhere.
- **Governing Decisions (`@adr`)**: [ADR-074](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 3 runtime, 0 type-only ([`src/components/presentation/BookPreviewModal.tsx`](../src/components/presentation/BookPreviewModal.tsx), [`src/components/presentation/HeroFeaturedBook3D.tsx`](../src/components/presentation/HeroFeaturedBook3D.tsx), [`src/hooks/queries/useBooks.ts`](../src/hooks/queries/useBooks.ts))
- **Cross-Boundary Coupling**: Storage/Cookies: `bookarium-extracted-passages-v1`
- **Test Contract**: [`src/hooks/useBookPassageShuffle.test.ts`](../src/hooks/useBookPassageShuffle.test.ts) (6 tests)

#### [`src/hooks/useCollectionAutoHeal.ts`](../src/hooks/useCollectionAutoHeal.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Background metadata recovery hook (`useCollectionAutoHeal`) healing missing author lifespans and titles across Bookshelf, Favorites, Reading Positions, Annotations, and IndexedDB offline books.
- **Behavioral Invariants (`@invariant`)**:
  - Synchronously enrich matching `FEATURED_HERO_BOOKS` first and batch remaining incomplete IDs into a single deduplicated `/api/books?ids=...` request gated by `hasMounted` and `!isOffline`.
  - Record queried book IDs inside `sessionStorage` (`bookarium_auto_heal_attempted`) and guard store/offline patching behind `patchOfflineBookAuthors` so un-annotated works never trigger infinite refetch loops or metadata regressions.
- **Design Rationale (`@rationale`)**:
  - Older localStorage snapshots or sparse mobile sync records may omit author lifespan bounds needed for non-US copyright evaluation; session-bounded batch healing repairs them silently without UI blocking.
- **Governing Decisions (`@adr`)**: [ADR-070](DECISIONS.md), [ADR-071](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/app/page.tsx`](../src/app/page.tsx))
- **Cross-Boundary Coupling**: Storage/Cookies: `bookarium_auto_heal_attempted`
- **Test Contract**: [`src/hooks/useCollectionAutoHeal.test.tsx`](../src/hooks/useCollectionAutoHeal.test.tsx) (13 tests)

#### [`src/hooks/useNetworkStatus.ts`](../src/hooks/useNetworkStatus.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Hydration-safe React connectivity hook (`useNetworkStatus`) tracking browser `online` and `offline` events.
- **Behavioral Invariants (`@invariant`)**:
  - Use `useSyncExternalStore` returning a constant `true` from `getServerNetworkSnapshot` so SSR markup and initial client hydration never diverge.
- **Design Rationale (`@rationale`)**:
  - Prevents React hydration mismatch warnings while keeping navbar indicators, catalog fallbacks, and offline guards reactive to browser connectivity changes.
- **Governing Decisions (`@adr`)**: [ADR-069](DECISIONS.md)
- **AST Blast Radius**: 20 runtime, 0 type-only ([`src/app/account/page.tsx`](../src/app/account/page.tsx), [`src/app/page.tsx`](../src/app/page.tsx), [`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx), [`src/components/account/AccountPublicProfileSection.tsx`](../src/components/account/AccountPublicProfileSection.tsx), …)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/hooks/useNetworkStatus.test.ts`](../src/hooks/useNetworkStatus.test.ts) (4 tests)

#### [`src/hooks/useOfflineBooks.ts`](../src/hooks/useOfflineBooks.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Client hook orchestrating IndexedDB offline book downloads, storage quota reporting, background idle cover backfill, and cross-component custom event synchronization.
- **Behavioral Invariants (`@invariant`)**:
  - Normalize offline authors via `isPlaceholderAuthor`, Zustand Bookshelf state, and `FEATURED_HERO_BOOKS` before `saveOfflineBook` so offline records never regress to `"Anonymous"` or trigger false `HTTP 451` blocks.
  - Pre-warm dynamic Reader/Preview/Download JS bundles after persisting an offline download and broadcast `OFFLINE_BOOKS_UPDATED_EVENT` / `OFFLINE_DOWNLOADING_EVENT` so sibling hooks stay synchronized.
- **Design Rationale (`@rationale`)**:
  - Static pre-warming avoids `ChunkLoadError` when opening a downloaded volume offline, while `syncEpochRef` and signature diffs prevent stale IndexedDB snapshots from overwriting newer updates.
- **Governing Decisions (`@adr`)**: [ADR-020](DECISIONS.md), [ADR-069](DECISIONS.md), [ADR-070](DECISIONS.md)
- **AST Blast Radius**: 11 runtime, 0 type-only ([`src/app/page.tsx`](../src/app/page.tsx), [`src/components/account/AccountSymposiumSection.tsx`](../src/components/account/AccountSymposiumSection.tsx), [`src/components/account/HighlightBioPickerModal.tsx`](../src/components/account/HighlightBioPickerModal.tsx), [`src/components/presentation/BookCard.tsx`](../src/components/presentation/BookCard.tsx), …)
- **Cross-Boundary Coupling**: API Calls: `/api/books/content` · Signals: emits `CustomEvent:bookarium:offline-downloading`, `CustomEvent:bookarium:offline-updated`; listens `CustomEvent:bookarium:offline-downloading`, `CustomEvent:bookarium:offline-updated`
- **Test Contract**: [`src/hooks/useOfflineBooks.test.ts`](../src/hooks/useOfflineBooks.test.ts) (17 tests)

#### [`src/hooks/useOfflineCoverImage.ts`](../src/hooks/useOfflineCoverImage.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Local-first book cover image resolution (`coverObjectUrlCache` -> IndexedDB `offline_books`/`cover_cache` -> same-origin `/api/books/content?type=cover`) and background cache warming.
- **Behavioral Invariants (`@invariant`)**:
  - Resolve synchronous `getMemoryCachedCoverUrl` hits first, inspect IndexedDB (`getOfflineBookCover`) before releasing online requests, and rewrite all Project Gutenberg / mirror cover URLs (`GUTENBERG_COVER_HOSTS`) strictly to same-origin `/api/books/content?id=<bookId>&type=cover` without client-side mirror hotlinking or cascading host fallbacks.
  - Trigger `warmCoverCache` on successful online `handleImageLoad` (`!blob:`), transition directly to `imageError: true` on cover load failure so cards render their dark typographic fallback cover, and revoke only `isOwned` fallback `blob:` URLs via `URL.revokeObjectURL` on unmount while leaving shared pooled `getOrCreateMemoryCoverUrl` URLs intact.
- **Design Rationale (`@rationale`)**:
  - Routing all online cover reads through the same-origin R2-backed endpoint eliminates external Gutenberg `<img>` hotlinking, tightens CSP `img-src` to `'self' data: blob:`, and makes missing R2 covers visibly fall back to typographic card artwork.
- **Governing Decisions (`@adr`)**: [ADR-070](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-082](DECISIONS.md)
- **AST Blast Radius**: 2 runtime, 0 type-only ([`src/components/presentation/BookCard.tsx`](../src/components/presentation/BookCard.tsx), [`src/components/presentation/BookmarkCard.tsx`](../src/components/presentation/BookmarkCard.tsx))
- **Cross-Boundary Coupling**: API Calls: `/api/books/content`
- **Test Contract**: [`src/hooks/useOfflineCoverImage.test.ts`](../src/hooks/useOfflineCoverImage.test.ts) (6 tests)


### Layer: Web Workers (2 Contracted)

#### [`public/sw.js`](../public/sw.js) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Offline App Shell Service Worker managing `CACHE_NAME` precaching, bounded `CACHE_URLS` warmups, and network/cache routing strategies.
- **Behavioral Invariants (`@invariant`)**:
  - Enforce strict same-origin (`url.origin === self.location.origin`) and non-`/auth/` non-`/api/` path sanitization (`sanitizePrecacheUrl`, bounded by `MAX_MESSAGE_PRECACHE_URLS`), never intercept cross-origin or `/auth/*` requests, never return HTML documents for `_rsc`/`RSC: 1` requests, and return `503` JSON for offline `/api/*` fetches.
- **Design Rationale (`@rationale`)**:
  - Bounding message-driven precaching and bypassing `/auth/*`, `/api/*`, and cross-origin origins prevents CSWSH/cache poisoning and stale OAuth loops while keeping saved IndexedDB reader routes functional offline.
- **Governing Decisions (`@adr`)**: [ADR-020](DECISIONS.md), [ADR-073](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/components/pwa/ServiceWorkerRegister.test.tsx`](../src/components/pwa/ServiceWorkerRegister.test.tsx) (8 tests)

#### [`src/workers/gutenberg.worker.ts`](../src/workers/gutenberg.worker.ts) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Background Web Worker off-loading `parseGutenbergChapters` and `calculateVolumePageSpread` off the UI main thread.
- **Behavioral Invariants (`@invariant`)**:
  - Guard `typeof self !== 'undefined'` cleanly for SSR/test compatibility, ignore malformed messages missing `id` or `contentText`, and swallow non-fatal parse exceptions rather than crashing the worker loop.
- **Design Rationale (`@rationale`)**:
  - Parsing multi-megabyte classics like War and Peace off-thread preserves 60fps scrolling and zero main-thread jank when opening the Reader.
- **Governing Decisions (`@adr`)**: [ADR-014](DECISIONS.md), [ADR-017](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/hooks/reader/useGutenbergParserWorker.ts`](../src/hooks/reader/useGutenbergParserWorker.ts))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`src/workers/gutenberg.worker.test.ts`](../src/workers/gutenberg.worker.test.ts) (3 tests)


### Layer: App Router Pages & Layouts (6 Contracted)

#### [`src/app/auth/callback/route.ts`](../src/app/auth/callback/route.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: OAuth PKCE code exchange and email OTP verification callback route (`GET /auth/callback`).
- **Behavioral Invariants (`@invariant`)**:
  - Validate origins via `resolveCanonicalAuthOrigin`, constrain `?next=` targets via `sanitizeRedirectPath`, strip recovery query routes on non-recovery flows (`stripRecoveryFromRedirectPath`), and allowlist strictly known `VALID_OTP_TYPES`.
  - Map cross-device PKCE verifier failures cleanly to `?auth_notice=recovery_cross_device` or `?auth_notice=email_verified`, and stamp `AUTH_HINT` + conditional `CLIENT_IP_SYNC` cookies with `sameSite: 'lax'` and `secure: isHttpsRequest(request)` on successful authentication.
- **Design Rationale (`@rationale`)**:
  - Prevents open redirects, accidental recovery-mode entry via normal logins, and confusing error screens when users confirm signup links on a secondary mobile mail client.
- **Governing Decisions (`@adr`)**: [ADR-005](DECISIONS.md), [ADR-022](DECISIONS.md), [ADR-034](DECISIONS.md), [ADR-072](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: Storage/Cookies: `bookarium-auth-hint`, `bookarium-client-ip-sync`
- **Test Contract**: [`src/app/auth/callback/route.test.ts`](../src/app/auth/callback/route.test.ts) (12 tests)

#### [`src/app/layout.tsx`](../src/app/layout.tsx) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Next.js App Router root HTML layout hydrating SSR jurisdiction, theme class (`light`/`dark`/`sepia`), auth hint state, and JSON-LD structured metadata without client flash.
- **Behavioral Invariants (`@invariant`)**:
  - Read SSR cookies/headers defensively inside `try/catch` (`GEO_COOKIE_NAME` / edge headers -> `normalizeCountryCode`, `STORAGE_KEYS.THEME`, `STORAGE_KEYS.AUTH_HINT` + `sb-*-auth-token` cookie check) without requiring external secrets during build or offline rendering, and forward hydrated props cleanly into `Providers`.
- **Design Rationale (`@rationale`)**:
  - Computing country, theme class, and optimistic auth hints on the server eliminates first-paint theme flicker and incorrect guest/jurisdiction states during SSR hydration.
- **Governing Decisions (`@adr`)**: [ADR-005](DECISIONS.md), [ADR-036](DECISIONS.md), [ADR-042](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: Storage/Cookies: `bookarium-auth-hint`, `bookarium-theme-preference` · Env Vars: `NEXT_PUBLIC_SUPABASE_URL`
- **Test Contract**: [`src/app/layout.test.tsx`](../src/app/layout.test.tsx) (6 tests)

#### [`src/app/providers.tsx`](../src/app/providers.tsx) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Client runtime provider orchestrating TanStack Query defaults, synchronous jurisdiction/theme initialization, auth notice consumption, online/focus/interval session validity polling, and multi-store cloud sync triggers.
- **Behavioral Invariants (`@invariant`)**:
  - Hydrate `initializeJurisdiction` and `initializeTheme` synchronously during initial state setup, honor passive sync cooldown (`lastSyncTimeRef`), trigger `verifyActiveSessionValidity` on `online`, `visibilitychange` (`visible`), and visible-tab `60_000ms` intervals while flushing `syncAllStoresWithCloud` (passing `{ authMinSyncIntervalMs: PASSIVE_SYNC_COOLDOWN_MS }` on bootstrap mount and `bookarium:auth-token-refreshed`), and consume one-time `auth_notice` / `auth_error` URL params via `window.history.replaceState`.
- **Design Rationale (`@rationale`)**:
  - Consolidating session lifecycle listeners, token-refresh events (`bookarium:auth-token-refreshed`), and reconnect outbox synchronization in a single client boundary keeps Zustand stores decoupled from DOM/window listeners.
- **Governing Decisions (`@adr`)**: [ADR-005](DECISIONS.md), [ADR-069](DECISIONS.md), [ADR-072](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-086](DECISIONS.md)
- **AST Blast Radius**: 2 runtime, 0 type-only ([`src/app/layout.tsx`](../src/app/layout.tsx), [`src/components/presentation/Navbar.tsx`](../src/components/presentation/Navbar.tsx))
- **Cross-Boundary Coupling**: Signals: listens `CustomEvent:bookarium:auth-token-refreshed`
- **Test Contract**: [`src/app/providers.test.tsx`](../src/app/providers.test.tsx) (12 tests)

#### [`src/app/read/[id]/reader-layout-utils.ts`](../src/app/read/[id]/reader-layout-utils.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Server-side Reader volume metadata resolver, bounded negative-lookup LRU (`confirmedNotFoundIds`), and structured SEO schema builder for `/read/[id]`.
- **Behavioral Invariants (`@invariant`)**:
  - Anchor `serverMetadataCache` and `confirmedNotFoundIds` on `globalThis` capped at `MAX_SERVER_METADATA_CACHE_ENTRIES` FIFO-LRU entries, only mark IDs confirmed missing when Supabase is configured and responded cleanly (`!supabaseUnavailable`), and preserve curated fallback lifespans before emitting `noindex` or metadata.
- **Design Rationale (`@rationale`)**:
  - Distinguishing transient Supabase outages from confirmed missing volume IDs prevents search-engine deindexing during upstream hiccups while keeping server memory bounded across warm SSR module reloads.
- **Governing Decisions (`@adr`)**: [ADR-036](DECISIONS.md), [ADR-070](DECISIONS.md), [ADR-086](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`src/app/read/[id]/layout.tsx`](../src/app/read/[id]/layout.tsx))
- **Cross-Boundary Coupling**: DB Tables: `public.books`
- **Test Contract**: [`src/app/read/[id]/reader-layout-utils.test.ts`](../src/app/read/[id]/reader-layout-utils.test.ts) (16 tests)

#### [`src/app/u/[username]/page.tsx`](../src/app/u/[username]/page.tsx) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Client UI page rendering opt-in public Scholar Sanctuaries (`is_public = true`), non-PII shelves, pinned accolades, and reading habit summaries.
- **Behavioral Invariants (`@invariant`)**:
  - Validate normalized handles strictly (`^[a-z0-9_-]{1,40}$`), verify exact normalized username equality after `.ilike()` lookups to neutralize `_` wildcards, enforce `.eq('is_public', true)`, and render `PrivateProfileNotice` uniformly for both missing and private accounts (`Scholar Sanctuary Not Found`).
- **Design Rationale (`@rationale`)**:
  - Collapsing private, invalid, and nonexistent handles onto a single zero-PII fallback UI enforces ADR-033 anti-enumeration and prevents exposure of private reader activity.
- **Governing Decisions (`@adr`)**: [ADR-033](DECISIONS.md), [ADR-053](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: DB Tables: `public.bookshelf_items`, `public.bookshelves`, `public.profiles`, `public.user_accolades`, `public.user_reading_habits`
- **Test Contract**: [`src/app/u/[username]/page.test.tsx`](../src/app/u/[username]/page.test.tsx) (10 tests)

#### [`src/app/u/[username]/profile-layout-utils.ts`](../src/app/u/[username]/profile-layout-utils.ts) *(Tier-3 Protected)*

- **Intended Scope (`@scope`)**: Server-side public handle resolution and bounded LRU metadata cache (`serverProfileCache`) powering `/u/[username]` layout metadata, `/api/profiles/card`, and privacy gates.
- **Behavioral Invariants (`@invariant`)**:
  - Anchor `serverProfileCache` on `globalThis` bounded via `MAX_PROFILE_CACHE_ENTRIES` and `PROFILE_CACHE_TTL_MS`, normalize handles via `VALID_HANDLE_REGEX`, enforce exact lowercase username equality after `.ilike()` lookups, never cache `'unavailable'` errors, and collapse private or missing accounts uniformly to `private_or_missing`.
  - Gate `fetchPublicScholarCardPayload` metric queries and pill formatting strictly behind `is_public = true` and `show_streak`, `show_challenge`, `show_bookshelves`, `show_saved_books`, and `show_custom_shelves`, capping pinned bookplates at `MAX_PUBLIC_PINNED_BOOKPLATES`.
- **Design Rationale (`@rationale`)**:
  - Bounding handle LRU entries and neutralizing SQL `_` wildcard matching protects server memory across warm SSR reloads and enforces ADR-033 anti-enumeration across public profile and OpenGraph card routes.
- **Governing Decisions (`@adr`)**: [ADR-033](DECISIONS.md), [ADR-053](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-086](DECISIONS.md)
- **AST Blast Radius**: 2 runtime, 0 type-only ([`src/app/api/profiles/card/route.ts`](../src/app/api/profiles/card/route.ts), [`src/app/u/[username]/layout.tsx`](../src/app/u/[username]/layout.tsx))
- **Cross-Boundary Coupling**: DB Tables: `public.bookshelves`, `public.profiles`, `public.user_accolades`, `public.user_reading_habits`
- **Test Contract**: [`src/app/u/[username]/profile-layout-utils.test.ts`](../src/app/u/[username]/profile-layout-utils.test.ts) (10 tests)


### Layer: UI & Feature Components (1 Contracted)

#### [`src/components/auth/TurnstileWidget.tsx`](../src/components/auth/TurnstileWidget.tsx) *(Tier-2 Protected)*

- **Intended Scope (`@scope`)**: Shared Cloudflare Turnstile Managed CAPTCHA widget wrapper for authentication, resend verification, and account password-reset forms.
- **Behavioral Invariants (`@invariant`)**:
  - Render zero external scripts, containers, or UI overhead when `getTurnstileSiteKey()` is blank or `active` is false, isolate per-mount widget lifecycles via `removeTurnstileInstance`, and clear tokens deterministically on reset/expiration/error callbacks.
- **Design Rationale (`@rationale`)**:
  - Keeping CAPTCHA rendering strictly optional and keyless-graceful preserves 100% zero-config local/offline usability while hardening public auth forms in production deployments.
- **Governing Decisions (`@adr`)**: [ADR-034](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: 4 runtime, 0 type-only ([`src/components/account/AccountIdentityCard.tsx`](../src/components/account/AccountIdentityCard.tsx), [`src/components/account/AccountSecuritySection.tsx`](../src/components/account/AccountSecuritySection.tsx), [`src/components/auth/AuthModal.tsx`](../src/components/auth/AuthModal.tsx), [`src/components/auth/EmailSentView.tsx`](../src/components/auth/EmailSentView.tsx))
- **Cross-Boundary Coupling**: Env Vars: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- **Test Contract**: [`src/components/auth/TurnstileWidget.test.tsx`](../src/components/auth/TurnstileWidget.test.tsx) (2 tests)


### Layer: Config & Type Contracts (1 Contracted)

#### [`next.config.ts`](../next.config.ts) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Next.js application security headers, strict Content-Security-Policy, zero-remote image allowlist, and collection view rewrites.
- **Behavioral Invariants (`@invariant`)**:
  - Enforce `X-Frame-Options: DENY`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, `base-uri 'self'`, `img-src 'self' data: blob:`, strip `'unsafe-eval'` outside `isDev`, and emit HSTS (`max-age=63072000`) in production builds while locking `images.remotePatterns` to `[]`.
- **Design Rationale (`@rationale`)**:
  - Enforcing strict security headers and CSP at the Next.js platform boundary blocks XSS, clickjacking, MIME sniffing, and external cover hotlinking across every HTML and static response.
- **Governing Decisions (`@adr`)**: [ADR-022](DECISIONS.md), [ADR-073](DECISIONS.md), [ADR-080](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`scripts/lib/sast-validators.test.ts`](../scripts/lib/sast-validators.test.ts) (16 tests)


### Layer: CLI Pipelines & Governance (14 Contracted)

#### [`scripts/approval-gate.js`](../scripts/approval-gate.js) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Governance pre-commit gate validating `.agents/hooks.json` schema completeness (`preCommit`, `prePush`, `postBuild`), npm script bindings against `package.json`, and static `.husky/pre-commit` hook integrity.
- **Behavioral Invariants (`@invariant`)**:
  - Require non-empty `preCommit`, `prePush`, and `postBuild` arrays inside `.agents/hooks.json`, fail closed (`exit 1`) if any `npm run <script>` entry is absent from `package.json`, and verify `.husky/pre-commit` (when present) still invokes `approval-gate.js` and `verify-build.js`.
- **Design Rationale (`@rationale`)**:
  - Prevents silent hook bypasses when npm scripts are renamed, `.agents/hooks.json` becomes malformed, or `.husky/pre-commit` loses pre-commit gate bindings.
- **Governing Decisions (`@adr`)**: [ADR-078](DECISIONS.md), [ADR-081](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: _Covered via runtime/verification harness_

#### [`scripts/eslint-rules/bookarium-security.js`](../scripts/eslint-rules/bookarium-security.js) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Unified 9-rule Babel/ESLint SAST plugin enforcing SSRF guards, open-redirect sanitization, API rate limiting & security header parity, cookie flags, client/server isolation, query safety, secret env boundaries, copyright gates, zero tautological tests, and XSS/tabnabbing/`CWE-116` double-escaping sinks.
- **Behavioral Invariants (`@invariant`)**:
  - Keep all 9 rules synchronized cleanly across both IDE ESLint plugin listeners (`rules`) and the standalone zero-IDE Babel AST auditor (`runStandaloneAstSecurityAudit`) scanning `src/`, `scripts/`, `public/sw.js`, and `next.config.ts` (reporting parse failures explicitly), including Node HTTP client (`https.get`/`http.get`) checks, `{ shell: false }` enforcement in `scripts/`, `CWE-116` chained XML/HTML entity `.replace()` double-escaping/double-unescaping detection, and `process.argv` CLI taint into shell/URL/redirect sinks.
  - Track intra-procedural taint flows across sanitized helper boundaries (`FETCH_SANITIZER_FUNCTIONS`, `REDIRECT_SANITIZER_FUNCTIONS`, `DB_AND_QUERY_SANITIZER_FUNCTIONS`) without reporting false positives on allowlisted wrappers, CLI `--cache-file` flags, or static single-slash client routes.
- **Design Rationale (`@rationale`)**:
  - Sharing one AST rule suite across IDE linting and CI Pass 0.75 guarantees developers catch request-taint, client/server boundary leaks, response header/cookie omissions, entity double-escaping, and weak assertions in real time before commit.
- **Governing Decisions (`@adr`)**: [ADR-067](DECISIONS.md), [ADR-073](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-082](DECISIONS.md), [ADR-083](DECISIONS.md), [ADR-084](DECISIONS.md)
- **AST Blast Radius**: 3 runtime, 0 type-only ([`scripts/generate-architecture-matrix.js`](../scripts/generate-architecture-matrix.js), [`scripts/generate-quality-report.js`](../scripts/generate-quality-report.js), [`scripts/verify-build.js`](../scripts/verify-build.js))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`scripts/eslint-rules/bookarium-security.test.ts`](../scripts/eslint-rules/bookarium-security.test.ts) (30 tests)

#### [`scripts/ingest-catalog.js`](../scripts/ingest-catalog.js) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Offline SQL starter seed generator compiling idempotent `supabase/seed_books.sql` from `CURATED_CLASSICS` (with `--with-content` live Gutenberg mirror scraping retired under ADR-084).
- **Behavioral Invariants (`@invariant`)**:
  - Retire legacy `--pages=N` Gutendex pagination and `--with-content` Project Gutenberg HTTP text scraping safely while emitting idempotent PostgreSQL `INSERT ... ON CONFLICT DO UPDATE` seed scripts without requiring network credentials for `--dry-run`.
  - Construct dynamic User-Agent headers via `resolveIngestUserAgent` honoring `NEXT_PUBLIC_GITHUB_REPO`, `BOOKARIUM_REPO_URL`, `GITHUB_REPOSITORY`, or site origin fallbacks alongside optional `GUTENBERG_CONTACT_EMAIL`, and keep pure `generateContentUpdateSql` formatter side-effect free.
- **Design Rationale (`@rationale`)**:
  - Gives local developers and fresh Supabase installs clean curated catalog metadata SQL seeds aligned with `public.books` lifespan bounds while keeping online text storage strictly on Cloudflare R2 (`npm run r2:sync`).
- **Governing Decisions (`@adr`)**: [ADR-038](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-084](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: Env Vars: `BOOKARIUM_REPO_URL`, `GUTENBERG_CONTACT_EMAIL`, `NEXT_PUBLIC_GITHUB_REPO`, `NEXT_PUBLIC_SITE_URL`
- **Test Contract**: [`scripts/ingest-catalog.test.ts`](../scripts/ingest-catalog.test.ts) (10 tests)

#### [`scripts/ingest-translations.js`](../scripts/ingest-translations.js) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Wikidata SPARQL (`P2034` / `P407`) FRBR work-clustering CLI populating idempotent cross-language edition links in `public.book_translations`.
- **Behavioral Invariants (`@invariant`)**:
  - Enforce all anti-collision clustering defenses (`isOmnibusOrAnthology`, surname compatibility, significant keyword matching, singleton pruning), enforce bounded `WIKIDATA_SPARQL_TIMEOUT_MS` (`45s`) HTTP socket timeout cleanly triggering `Defense 3` snapshot fallback, validate `book_id` public-domain catalog presence (`copyright !== true` via `filterValidCatalogBookIds` and `WHERE b.copyright = false` in `generateAtomicSeedSql`, handling empty-catalog `validBookIds.size === 0` skips), and execute bounded-retry bisected upserts (`upsertTranslationBatchesWithRetry`) failing non-zero on persistent write errors.
  - Support offline `--dry-run` / `--output=...` atomic SQL seed generation (`generateAtomicSeedSql`) cleanly even when Supabase env credentials are absent.
- **Design Rationale (`@rationale`)**:
  - Strict anthology rejection, socket-bounded Wikidata queries, catalog FK pre-validation, bisected batch retries, and public-domain `copyright !== true` filtering eliminate stalled CI runners, silent upsert drops, spurious cross-author translation links, and copyrighted volume associations.
- **Governing Decisions (`@adr`)**: [ADR-010](DECISIONS.md), [ADR-038](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-085](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: DB Tables: `public.book_translations`, `public.books` · Env Vars: `BOOKARIUM_REPO_URL`, `GUTENBERG_CONTACT_EMAIL`, `NEXT_PUBLIC_GITHUB_REPO`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- **Test Contract**: [`scripts/ingest-translations.test.ts`](../scripts/ingest-translations.test.ts) (19 tests)

#### [`scripts/lib/ast-parser.js`](../scripts/lib/ast-parser.js) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Central Babel 8 AST, SQL, YAML & config static analysis engine compiling module dependency graphs, cross-boundary coupling catalogs, `@scope`/`@invariant` contracts (across `src/`, `scripts/`, `next.config.ts`, and `public/sw.js`), SQL<->TS entities (incl. `userScopedTables` cascade targets), live runtime/CI specs (`extractRuntimeSpecConstants`, `extractWorkflowTriggerBranches`, `extractWorkflowSpecCatalog`), shared governance & architecture corpus registries (`REQUIRED_GOVERNANCE_DOCS`, `GENERATOR_LOOKUP_MAP_COUNT`, `loadArchitectureCorpus`), `.env.example` consumer discovery (`src/`, `next.config.ts`, `scripts/` incl. `lib/` & `eslint-rules/`, workflows), and Markdown Mermaid diagram syntax/cycle validation.
- **Behavioral Invariants (`@invariant`)**:
  - Separate runtime edges from `_(type)_` edges cleanly (`analyzeDependencyGraph`) with OS-independent codepoint sorting (`compareCodepoint`) across dependency graphs, cross-boundary catalogs, and pending contract queues, detect import cycles (`hasCycles` strictly matches `cycles.length > 0`), normalize LF byte counts for text assets (`getDeterministicTextOrBinaryBytes`), resolve `process.env`, defaulted parameter (`env = process.env`/`loadEnv`), and local `loadEnv()` variable bindings cleanly across `scripts/` (`collectScriptFiles`), extract declared constants/thresholds/triggers read-only from configs/sources/workflows (`extractRuntimeSpecConstants`, `extractWorkflowTriggerBranches`, `extractWorkflowSpecCatalog`), and surface Babel syntax parse failures (`getAstParseErrors`) rather than silently swallowing broken modules.
  - Audit all `14` `generate-architecture-matrix.js` lookup registries plus `varMetaMap`, `workerRoleMap`, and `roleMap` (`findOrphanedGeneratorLookupKeys`), load the hub-and-subdoc living architecture corpus deterministically (`loadArchitectureCorpus` spanning `docs/ARCHITECTURE.md` and `docs/architecture/*.md`), reject fatal Mermaid subgraph cycles, unquoted special-char edge labels, HTML-swallowed tags, undeclared endpoints, and strictly orphan nodes via quote-aware linear tokenization (`validateMermaidDiagramsInMarkdown` / `splitMermaidEdgeChainSegments`), enforce placeholder guards in JSDoc contract tags (`parseJsDocContractTags`), and expose `PROTECTED_CONTRACTED_MODULES` (`TIER_1`..`TIER_4`).
- **Design Rationale (`@rationale`)**:
  - Providing one shared AST engine across `docs:sync` generators and `Pass 5` guarantees that architecture diagrams, contract docs, schema parity, and CI verification never diverge on different parsers or regexes.
- **Governing Decisions (`@adr`)**: [ADR-078](DECISIONS.md), [ADR-079](DECISIONS.md), [ADR-081](DECISIONS.md), [ADR-084](DECISIONS.md)
- **AST Blast Radius**: 5 runtime, 0 type-only ([`scripts/generate-architecture-matrix.js`](../scripts/generate-architecture-matrix.js), [`scripts/generate-contracts-docs.js`](../scripts/generate-contracts-docs.js), [`scripts/generate-parser-docs.js`](../scripts/generate-parser-docs.js), [`scripts/generate-quality-report.js`](../scripts/generate-quality-report.js), …)
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`scripts/lib/ast-parser.test.ts`](../scripts/lib/ast-parser.test.ts) (25 tests)

#### [`scripts/lib/cli-progress.js`](../scripts/lib/cli-progress.js) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Zero-dependency TTY- and CI-aware CLI progress telemetry utility rendering single-line `\r` overwrites in interactive terminals, throttled `\n` heartbeat checkpoints (`ciIntervalMs` / `ciPercentStep`) in GitHub Actions or non-TTY runners, and atomic event alerts across ingestion and scanning pipelines.
- **Behavioral Invariants (`@invariant`)**:
  - Keep stdout cleanly silent when `enabled === false` (`--json` mode), never emit raw `\r` overwrites when `GITHUB_ACTIONS` / `CI` is set or stdout is non-TTY, break/clear active `\r` lines atomically ahead of `logEvent()` alerts and `finish()`, and maintain zero third-party dependencies so zero-`npm ci` workflows (`r2-content-scan.yml`) execute cleanly.
- **Design Rationale (`@rationale`)**:
  - GitHub Actions live log viewers buffer `\r` overwrites and strip cursor-control sequences, whereas naive per-item `console.log()` lines flood logs across 78,000+ book scans. Routing progress updates through a shared throttled reporter delivers real-time visibility in CI, crisp single-line tickers locally, and live match/anomaly alerts without drowning logs.
- **Governing Decisions (`@adr`)**: [ADR-085](DECISIONS.md)
- **AST Blast Radius**: 4 runtime, 0 type-only ([`scripts/scan-r2-content.js`](../scripts/scan-r2-content.js), [`scripts/sync-featured-quotes.js`](../scripts/sync-featured-quotes.js), [`scripts/sync-gutenberg-catalog.js`](../scripts/sync-gutenberg-catalog.js), [`scripts/sync-r2-assets.js`](../scripts/sync-r2-assets.js))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`scripts/lib/cli-progress.test.ts`](../scripts/lib/cli-progress.test.ts) (4 tests)

#### [`scripts/lib/r2-sigv4.js`](../scripts/lib/r2-sigv4.js) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Shared zero-dependency AWS Signature V4 transport, SSRF allowlist, strict config verification, paginated XML listing, and bounded `.txt.gz` reader for private Cloudflare R2 storage across CLI pipelines (`sync-r2-assets.js`, `scan-r2-content.js`, `sync-featured-quotes.js`).
- **Behavioral Invariants (`@invariant`)**:
  - Strictly validate `R2_ACCOUNT_ID` and `R2_BUCKET_NAME` via `assertValidR2ConfigIfPresent` (failing fast on partial or malformed configs while returning `null` only when all 4 `R2_*` variables are unset), lock all outbound requests to `isAllowedR2EndpointUrl` (`https://<account>.r2.cloudflarestorage.com`) with `redirect: 'manual'`, enforce bounded reads and gzip decompression (`MAX_R2_BOOK_BYTES`), and decode `ListObjectsV2` XML entities in a single regex pass (`XML_ENTITY_MAP`, `CWE-116` safe).
- **Design Rationale (`@rationale`)**:
  - Centralizing S3-compatible R2 SigV4 transport primitives into a zero-third-party-dependency module prevents duplicated cryptographic signing and allows standalone maintenance workflows such as `r2-content-scan.yml` to run on Node 22 without `npm ci`.
- **Governing Decisions (`@adr`)**: [ADR-083](DECISIONS.md), [ADR-085](DECISIONS.md)
- **AST Blast Radius**: 2 runtime, 0 type-only ([`scripts/scan-r2-content.js`](../scripts/scan-r2-content.js), [`scripts/sync-r2-assets.js`](../scripts/sync-r2-assets.js))
- **Cross-Boundary Coupling**: Env Vars: `R2_ACCESS_KEY_ID`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_SECRET_ACCESS_KEY`
- **Test Contract**: [`scripts/lib/r2-sigv4.test.ts`](../scripts/lib/r2-sigv4.test.ts) (5 tests)

#### [`scripts/lib/sast-validators.js`](../scripts/lib/sast-validators.js) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Stateless Babel AST header, compiled Next routes manifest, npm lockfile/lifecycle/license SCA, GitHub Actions YAML security, Service Worker, env/privilege boundary, API route, redirect, public-domain filter, Rule 9 auth-store parity, circular `SECURITY.md` parity, and live HTTP response validators.
- **Behavioral Invariants (`@invariant`)**:
  - Enforce `REQUIRED_SECURITY_HEADERS` (`X-Frame-Options: DENY`, `nosniff`, `same-origin` COOP, conditional `!isDev` HSTS, CSP directives without ungated `unsafe-eval`), immutable 40-char commit-SHA `uses:` pinning and zero-checkout `gh` `--repo`/`GH_REPO` scoping (`validateGitHubWorkflowSecurity`), banned `BANNED_LIFECYCLE_HOOKS` & `BANNED_PACKAGE_LICENSES` (`GPL`/`AGPL`), `validateLiveHttpSecurityResponse` runtime response contracts, `auditSecurityDocumentationParity` (`SECURITY.md` marker/ESLint-rule/SAST-export/RLS-count/feed-integrity checks), and fail-closed Babel AST validation across `validateServiceWorkerSecurity`, `validateEnvAndPrivilegeBoundariesAst`, `validateApiRoutesSecurityAst`, `validateRedirectRoutesAst`, `validatePublicDomainFilterAst`, and `validateRule9AuthStoreParityAst` without executing external shells.
- **Design Rationale (`@rationale`)**:
  - Isolating pure validators away from top-level CLI runners allows direct unit testing against intentionally vulnerable fixtures while keeping `Pass 0.75` and `Pass 7` fast and deterministic.
- **Governing Decisions (`@adr`)**: [ADR-073](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-081](DECISIONS.md), [ADR-082](DECISIONS.md), [ADR-084](DECISIONS.md)
- **AST Blast Radius**: 2 runtime, 0 type-only ([`scripts/generate-architecture-matrix.js`](../scripts/generate-architecture-matrix.js), [`scripts/verify-build.js`](../scripts/verify-build.js))
- **Cross-Boundary Coupling**: Self-contained / pure domain computation
- **Test Contract**: [`scripts/lib/sast-validators.test.ts`](../scripts/lib/sast-validators.test.ts) (16 tests)

#### [`scripts/purge-vercel-cache.js`](../scripts/purge-vercel-cache.js) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Post-ingestion CDN invalidation CLI purging tagged Vercel Edge Cache entries (`catalog`, `quotes`, `translations`).
- **Behavioral Invariants (`@invariant`)**:
  - Exit with status `0` cleanly (`skipped: true`) whenever `VERCEL_API_TOKEN` or `VERCEL_PROJECT_ID` is absent or `--dry-run` is active, so community forks and credential-free local runs never fail.
  - Allowlist cache tag formats strictly against `VALID_TAG_REGEX`, enforce `ALLOWED_PURGE_TARGETS` (`production` | `preview`), apply bounded `Retry-After` / exponential retries (`<= 5` retries) on `429`/`5xx`, and log status markdown to `$GITHUB_STEP_SUMMARY`.
- **Design Rationale (`@rationale`)**:
  - Prevents stale 12h/24h Vercel Edge cache entries after Sunday catalog/quote syncs while preserving zero-key fork safety and explicit CI observability.
- **Governing Decisions (`@adr`)**: [ADR-080](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: Env Vars: `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`
- **Test Contract**: [`scripts/purge-vercel-cache.test.ts`](../scripts/purge-vercel-cache.test.ts) (5 tests)

#### [`scripts/scan-r2-content.js`](../scripts/scan-r2-content.js) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: Zero-dependency read-only Cloudflare R2 content integrity scanner listing `books/<id>.txt.gz` objects via AWS SigV4 `ListObjectsV2` (or targeted `--ids`) and scanning gunzipped payloads for unwanted or injected terms (`asiafilm` default) without touching Vercel, Supabase, or Project Gutenberg mirrors.
- **Behavioral Invariants (`@invariant`)**:
  - Enforce `assertValidR2ConfigIfPresent` (clean `exit 0` skip when all 4 `R2_*` vars are unset, fail-fast on partial or malformed configs), lock key scope to `ALLOWED_SCAN_PREFIXES` (`books/`), match terms strictly via literal `String.prototype.indexOf` (`CWE-1333` ReDoS-safe, never `new RegExp()` on CLI input), cap concurrent `GetObject` streams (`MAX_SCAN_CONCURRENCY = 64`), enforce `MAX_R2_BOOK_BYTES` (`15 MB`) bounded gzip reads via `scripts/lib/r2-sigv4.js`, suppress progress chatter cleanly under `--json` while driving TTY/CI heartbeat + live match alerts + `MAX_INLINE_SCAN_ERRORS`-capped error logs via `scripts/lib/cli-progress.js`, and sanitize output snippets in `$GITHUB_STEP_SUMMARY`.
- **Design Rationale (`@rationale`)**:
  - Scanning directly against private Cloudflare R2 via zero-dependency Node 22 built-ins eliminates `npm ci` workflow overhead, incurs zero R2 egress, consumes `< 0.8%` of the monthly Class B free quota across 78k books (`0` under `--dry-run`), isolates audit runs completely from production Next.js and PostgreSQL compute, and gives operators real-time discovery/scan progress and instant hit feedback without dumping 78k lines.
- **Governing Decisions (`@adr`)**: [ADR-083](DECISIONS.md), [ADR-085](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: Helpers: `scripts/lib/cli-progress.js`, `scripts/lib/r2-sigv4.js`
- **Test Contract**: [`scripts/scan-r2-content.test.ts`](../scripts/scan-r2-content.test.ts) (6 tests)

#### [`scripts/sync-featured-quotes.js`](../scripts/sync-featured-quotes.js) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Bounded Two-Tier quote extraction worker maintaining the `Top 500 Popular + Rolling 64 Most Recent` JSONB spread pool in `public.books.quotes`.
- **Behavioral Invariants (`@invariant`)**:
  - Select text transport via `normalizeQuoteTextSource` (`auto`, `r2`, `mirrors`), reading from Supabase `public.books.content` or private Cloudflare R2 (`books/<id>.txt.gz` via `fetchBookTextFromR2`, `0s` delay) ahead of Project Gutenberg mirror-first pacing (`8.0s–16.0s` per worker) unless `--source=mirrors`, failing fast in `r2` mode when `R2_*` credentials are missing, failing non-zero via `shouldFailFeaturedQuotesRun` when `updated === 0` or `>= 50%` of `>= 5` attempted volumes fail, and recording uncached R2 volumes as non-sentinel `r2-miss` skips without writing false `[]`/placeholder entries, while enforcing redirect SSRF validation (`isAllowedPglafMirrorUrl`), `15 MB` text limit, `row.copyright !== true` exclusion across both automated Two-Tier pools and manual `--ids` runs, and 1-item sentinel guard (`buildSentinelQuoteSpread`) when available text yields 0 extractable spreads.
  - Query quoted pool membership strictly via Primary-Key chunked `.in('id', chunk).neq('quotes', '[]')` (`books_pkey`) or partial index `idx_books_with_quotes_popular`, and prune out-of-window surplus via Option-A 1-for-1 sliding window up to `DEFAULT_MAX_PRUNE_PER_RUN` (`2,000`).
- **Design Rationale (`@rationale`)**:
  - Keeps database `quotes` footprint bounded (`<= 564` active books / ~2 MB), shifts CI quote extraction off external Project Gutenberg mirrors onto zero-egress private R2 when populated while retaining official PGLAF/Aleph/ReadingRoo mirror fallback for scheduled/manual runs without contacting `www.gutenberg.org`, and avoids 78k-row PostgreSQL statement timeouts.
- **Governing Decisions (`@adr`)**: [ADR-074](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-083](DECISIONS.md), [ADR-084](DECISIONS.md), [ADR-085](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: DB Tables: `public.books` · Env Vars: `BOOKARIUM_REPO_URL`, `GUTENBERG_CONTACT_EMAIL`, `NEXT_PUBLIC_GITHUB_REPO`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` · Helpers: `scripts/lib/cli-progress.js`, `scripts/sync-r2-assets.js`
- **Test Contract**: [`scripts/sync-featured-quotes.test.ts`](../scripts/sync-featured-quotes.test.ts) (22 tests)

#### [`scripts/sync-gutenberg-catalog.js`](../scripts/sync-gutenberg-catalog.js) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Weekly streaming ingestion pipeline reconciling Project Gutenberg metadata (`pg_catalog.csv.gz` + `rdf-files.tar.bz2`) into `public.books`.
- **Behavioral Invariants (`@invariant`)**:
  - Prioritize PGLAF/Aleph feed mirrors exclusively (never `www.gutenberg.org`, pinned or ordered via `--feed-source`), reject HTML outage responses, fail closed on truncated `Content-Length` streams or non-zero `tar` exit codes while computing feed wire `SHA-256` digests, extract both `<pgterms:downloads>` and `<dcterms:rights>` (`copyright: true` for copyrighted PG entries), preserve cached and live DB `copyright` flags when RDF feeds are unavailable (including under `--update-existing`), and defer unverified brand-new books during unexpected RDF outages (`reconcileBatchWithoutRdfRights`).
  - Diff in RAM against `gutenberg-catalog-cache.json.gz` (emitting companion `.sha256` sidecars verified via `crypto.timingSafeEqual` on restore, preserving existing `quotes` column on `ignoreDuplicates: false` upserts) and emit `--diff-output=quote-diff.json` for zero-scan downstream quote sync.
  - Gate withdrawn-book deletion (`reconcileWithdrawnCatalogBooks`) behind `MIN_ACTIVE_CATALOG_FOR_PRUNE`, `MAX_WITHDRAWN_PRUNE_PER_RUN`, and `PROTECTED_HERO_BOOK_IDS`.
- **Design Rationale (`@rationale`)**:
  - Prevents copyrighted Project Gutenberg titles from bypassing US public-domain filters (even when both RDF mirrors fail during `--update-existing` or new releases), detects truncated/corrupted mirror streams or tampered snapshot caches fail-closed, keeps heavy archive sync strictly on official mirrors rather than `www.gutenberg.org`, and avoids exhausting Supabase read egress during partial upstream outages.
- **Governing Decisions (`@adr`)**: [ADR-040](DECISIONS.md), [ADR-073](DECISIONS.md), [ADR-080](DECISIONS.md), [ADR-084](DECISIONS.md), [ADR-085](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: DB Tables: `public.books` · Env Vars: `BOOKARIUM_REPO_URL`, `GUTENBERG_CONTACT_EMAIL`, `NEXT_PUBLIC_GITHUB_REPO`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` · Helpers: `scripts/lib/cli-progress.js`
- **Test Contract**: [`scripts/sync-gutenberg-catalog.test.ts`](../scripts/sync-gutenberg-catalog.test.ts) (42 tests)

#### [`scripts/sync-r2-assets.js`](../scripts/sync-r2-assets.js) *(Tier-1 Protected)*

- **Intended Scope (`@scope`)**: Automated Cloudflare R2 delta synchronization and backfill engine managing `books/<id>.txt.gz`, `covers/<id>.jpg`, and missing-asset cooldown state `_meta/r2-sync-state.json.gz` via zero-dependency AWS Signature V4 S3 calls and targeted multi-host `rsync --files-from` (`aleph.gutenberg.org` <-> `rsync.ibiblio.org`) / PGLAF HTTPS transfers.
- **Behavioral Invariants (`@invariant`)**:
  - Unconditionally enforce `copyright !== true` (`Rule 2/4`) on all R2 uploads, enforce `MIN_ACTIVE_CATALOG_FOR_PRUNE` before pruning withdrawn IDs (bounded by `DEFAULT_MAX_PRUNE_PER_RUN` unless `--force-prune`), fail fast via `assertValidR2ConfigIfPresent` on partial or malformed `R2_*` configs while exiting `0` cleanly when all `R2_*` variables are unset, prevent transient `_meta/r2-sync-state.json.gz` read errors or `rsync` transport faults from wiping/poisoning 90-day missing cooldowns (union-merging remote state before writes and flushing state cleanly in `try ... finally` alongside mid-batch `isOverBudget` checks), rotate failing `rsync` batches across `RSYNC_HOSTS` (`aleph.gutenberg.org` <-> `rsync.ibiblio.org`) via `resolveRsyncHostOrder` (`--rsync-host=auto|aleph|ibiblio`), parallelize `putR2Object` writes via `DEFAULT_R2_PUT_CONCURRENCY` (`8`), emit conditional purge tags (`--purge-tags-file`) strictly for deleted or `--force`-overwritten assets, fail non-zero via `shouldFailR2SyncRun` on total or `>= 50%` infrastructure failures, decode `ListObjectsV2` XML entities in a single pass via `XML_ENTITY_MAP` (`CWE-116` safe), validate all remote endpoints via `isAllowedR2EndpointUrl` and `isAllowedGutenbergAssetUrl` with `redirect: 'manual'` and bounded payload limits (`MAX_R2_BOOK_BYTES`, `MAX_R2_COVER_BYTES`), and invoke `rsync`/`wsl` strictly with `{ shell: false }`.
- **Design Rationale (`@rationale`)**:
  - Scanning private R2 prefixes with `ListObjectsV2` consumes ~157 Class A operations across ~78,000 books without requiring SQL indexes, sharing zero-dependency SigV4 transport helpers in `scripts/lib/r2-sigv4.js`, targeted `rsync --files-from` with automatic multi-host failover (`aleph.gutenberg.org` zero-lag primary to `rsync.ibiblio.org` mirror, or `--rsync-host=ibiblio` for bulk backfills) and parallel R2 uploads accelerates multi-run seeding while honoring PG mirror etiquette, state read-fail guards + union merges prevent concurrent `catalog-sync`/`r2-sync` cooldown corruption, and prioritizing `PRIORITY_HERO_BOOK_IDS` followed by `download_count DESC` accelerates Quote Pool and classic asset readiness.
- **Governing Decisions (`@adr`)**: [ADR-083](DECISIONS.md), [ADR-085](DECISIONS.md)
- **AST Blast Radius**: 1 runtime, 0 type-only ([`scripts/sync-featured-quotes.js`](../scripts/sync-featured-quotes.js))
- **Cross-Boundary Coupling**: DB Tables: `public.books` · Env Vars: `BOOKARIUM_REPO_URL`, `GUTENBERG_CONTACT_EMAIL`, `NEXT_PUBLIC_GITHUB_REPO`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` · Helpers: `scripts/lib/cli-progress.js`, `scripts/lib/r2-sigv4.js`
- **Test Contract**: [`scripts/sync-r2-assets.test.ts`](../scripts/sync-r2-assets.test.ts) (14 tests)

#### [`scripts/verify-build.js`](../scripts/verify-build.js) *(Tier-4 Protected)*

- **Intended Scope (`@scope`)**: 7-Gateway Closed-Loop Quality Engine orchestrating secret/boundary scans (`Pass 0.5`), 7-Pillar SAST & offline license SCA (`Pass 0.75`), TypeScript (`Pass 1`), MSW API/query tests (`Pass 2`), V8 coverage thresholds (`Pass 3`), DAG-ordered living docs sync (`Pass 4`), bidirectional ADR/schema/graph/contract/colocation parity (`Pass 5`), ESLint/Knip (`Pass 6`), and Next.js production build + loopback HTTP probes (`Pass 7`).
- **Behavioral Invariants (`@invariant`)**:
  - Enforce zero live secrets, zero `ast-parse-error` bypasses, `PROTECTED_CONTRACTED_MODULES` (`TIER_1`..`TIER_4`) `@scope`/`@invariant` contracts, strict bidirectional heading/count parity on `docs/SYSTEM_CONTRACTS.md`, bidirectional TOC + corpus parity across `docs/ARCHITECTURE.md` and `docs/architecture/*.md`, circular `SECURITY.md` symbol parity, `README.md` Diagram 1 + `jurisdictionBaselines` + SQL index parity, relative Markdown link validity, dynamic `scripts/` co-location outside `STANDALONE_RUNNER_SCRIPTS`, and zero-drift workflow/threshold/1:1 test co-location compliance across `--security-only`, `--fast`, and `--pass6-verified` execution modes.
- **Design Rationale (`@rationale`)**:
  - Providing a single fail-closed CLI orchestrator shared by pre-commit hooks, local verification, and GitHub Actions CI eliminates blind spots between static security rules, database schemas, build outputs, and living documentation.
- **Governing Decisions (`@adr`)**: [ADR-073](DECISIONS.md), [ADR-078](DECISIONS.md), [ADR-079](DECISIONS.md), [ADR-081](DECISIONS.md)
- **AST Blast Radius**: Entrypoint / zero static importers
- **Cross-Boundary Coupling**: Helpers: `scripts/eslint-rules/bookarium-security.js`, `scripts/generate-architecture-matrix.js`, `scripts/generate-changelog.js`, `scripts/generate-contracts-docs.js`, `scripts/generate-parser-docs.js`, `scripts/generate-roadmap.js`, `scripts/lib/ast-parser.js`, `scripts/lib/sast-validators.js`
- **Test Contract**: _Covered via runtime/verification harness_

---

## 📋 AST-Prioritized Pending Contract Queue (201 Modules)

Unannotated modules ranked automatically by AST **fan-in blast radius** and **cross-boundary exposure** (`Supabase DB`, `RPC`, `/api/*`, `CustomEvent`/`BroadcastChannel`, `localStorage`/Cookies, `process.env.*`):

### High-Coupling Priority Candidates (50 Modules, Score >= 8)

| Priority Score | Module | Layer | Callers (Runtime / Type) | Cross-Boundary Touchpoints |
| :---: | :--- | :--- | :---: | :--- |
| `98` | [`src/config/site-config.ts`](../src/config/site-config.ts) | Config & Type Contracts | `37` / `0` | Env Vars: `BOOKARIUM_REPO_URL`, `GUTENBERG_CONTACT_EMAIL`, `NEXT_PUBLIC_GITHUB_REPO`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_LEGAL_CONTACT_FORM`, `NEXT_PUBLIC_SITE_URL` |
| `92` | [`src/components/ui/Button.tsx`](../src/components/ui/Button.tsx) | UI & Feature Components | `46` / `0` | Pure / internal |
| `68` | [`src/lib/utils.ts`](../src/lib/utils.ts) | Domain Engines & Adapters | `32` / `0` | Pure / internal |
| `64` | [`src/config/routes.ts`](../src/config/routes.ts) | Config & Type Contracts | `32` / `0` | Pure / internal |
| `44` | [`src/types/book.types.ts`](../src/types/book.types.ts) | Config & Type Contracts | `0` / `44` | Pure / internal |
| `37` | [`src/hooks/useHasMounted.ts`](../src/hooks/useHasMounted.ts) | React Hooks & Queries | `17` / `0` | Pure / internal |
| `36` | [`src/config/featured-books.ts`](../src/config/featured-books.ts) | Config & Type Contracts | `17` / `2` | Pure / internal |
| `32` | [`src/components/ui/Modal.tsx`](../src/components/ui/Modal.tsx) | UI & Feature Components | `16` / `0` | Pure / internal |
| `32` | [`src/config/reader-themes.ts`](../src/config/reader-themes.ts) | Config & Type Contracts | `15` / `2` | Pure / internal |
| `30` | [`src/components/ui/CursorTooltip.tsx`](../src/components/ui/CursorTooltip.tsx) | UI & Feature Components | `11` / `0` | Signals: emits `CustomEvent:bookarium:book-link-copied`; listens `CustomEvent:bookarium:book-link-copied` |
| `26` | [`src/lib/scroll-utils.ts`](../src/lib/scroll-utils.ts) | Domain Engines & Adapters | `11` / `0` | Pure / internal |
| `22` | [`src/types/database.types.ts`](../src/types/database.types.ts) | Config & Type Contracts | `0` / `22` | Pure / internal |
| `20` | [`src/lib/adapters/book.adapter.ts`](../src/lib/adapters/book.adapter.ts) | Domain Engines & Adapters | `6` / `0` | API Calls: `/api/books/content` |
| `18` | [`src/config/reader-config.ts`](../src/config/reader-config.ts) | Config & Type Contracts | `9` / `0` | Pure / internal |
| `16` | [`src/components/presentation/Navbar.tsx`](../src/components/presentation/Navbar.tsx) | UI & Feature Components | `6` / `0` | Storage/Cookies: `bookarium-auth-hint` |
| `16` | [`src/components/ui/Select.tsx`](../src/components/ui/Select.tsx) | UI & Feature Components | `8` / `0` | Pure / internal |
| `16` | [`src/lib/reading-analytics.ts`](../src/lib/reading-analytics.ts) | Domain Engines & Adapters | `6` / `0` | Pure / internal |
| `15` | [`src/hooks/useBookCopyright.ts`](../src/hooks/useBookCopyright.ts) | React Hooks & Queries | `6` / `0` | Pure / internal |
| `15` | [`src/types/accolades.types.ts`](../src/types/accolades.types.ts) | Config & Type Contracts | `6` / `3` | Pure / internal |
| `14` | [`src/components/ui/ConfirmActionModal.tsx`](../src/components/ui/ConfirmActionModal.tsx) | UI & Feature Components | `7` / `0` | Pure / internal |
| `14` | [`src/config/accolades-config.ts`](../src/config/accolades-config.ts) | Config & Type Contracts | `7` / `0` | Pure / internal |
| `14` | [`src/config/annotation-tokens.ts`](../src/config/annotation-tokens.ts) | Config & Type Contracts | `7` / `0` | Pure / internal |
| `14` | [`src/config/api-endpoints.ts`](../src/config/api-endpoints.ts) | Config & Type Contracts | `7` / `0` | Pure / internal |
| `14` | [`src/lib/gutenberg/types.ts`](../src/lib/gutenberg/types.ts) | Domain Engines & Adapters | `5` / `0` | Pure / internal |
| `12` | [`src/components/presentation/Footer.tsx`](../src/components/presentation/Footer.tsx) | UI & Feature Components | `6` / `0` | Pure / internal |
| `12` | [`src/components/reader/ReaderDrawerShell.tsx`](../src/components/reader/ReaderDrawerShell.tsx) | UI & Feature Components | `6` / `0` | Pure / internal |
| `12` | [`src/components/ui/Input.tsx`](../src/components/ui/Input.tsx) | UI & Feature Components | `6` / `0` | Pure / internal |
| `12` | [`src/components/ui/SegmentedControl.tsx`](../src/components/ui/SegmentedControl.tsx) | UI & Feature Components | `6` / `0` | Pure / internal |
| `12` | [`src/lib/smart-search.ts`](../src/lib/smart-search.ts) | Domain Engines & Adapters | `4` / `0` | Pure / internal |
| `11` | [`src/config/catalog-filters.ts`](../src/config/catalog-filters.ts) | Config & Type Contracts | `5` / `1` | Pure / internal |
| `11` | [`src/hooks/useDialogFocusTrap.ts`](../src/hooks/useDialogFocusTrap.ts) | React Hooks & Queries | `4` / `0` | Pure / internal |
| `10` | [`src/components/motion/ContentCrossfade.tsx`](../src/components/motion/ContentCrossfade.tsx) | UI & Feature Components | `5` / `0` | Pure / internal |
| `10` | [`src/components/presentation/DownloadDrawer.tsx`](../src/components/presentation/DownloadDrawer.tsx) | UI & Feature Components | `3` / `0` | API Calls: `/api/books/content` |
| `10` | [`src/components/ui/RemoveOfflineBookModal.tsx`](../src/components/ui/RemoveOfflineBookModal.tsx) | UI & Feature Components | `5` / `0` | Pure / internal |
| `10` | [`src/components/ui/StarRating.tsx`](../src/components/ui/StarRating.tsx) | UI & Feature Components | `5` / `0` | Pure / internal |
| `10` | [`src/lib/accolades-engine.ts`](../src/lib/accolades-engine.ts) | Domain Engines & Adapters | `3` / `0` | Pure / internal |
| `10` | [`src/lib/content-advisory.ts`](../src/lib/content-advisory.ts) | Domain Engines & Adapters | `3` / `0` | Pure / internal |
| `10` | [`src/lib/reading-card-export.ts`](../src/lib/reading-card-export.ts) | Domain Engines & Adapters | `3` / `0` | Pure / internal |
| `10` | [`src/lib/speech-utils.ts`](../src/lib/speech-utils.ts) | Domain Engines & Adapters | `3` / `0` | Pure / internal |
| `9` | [`src/hooks/useAmbientDockScrollState.ts`](../src/hooks/useAmbientDockScrollState.ts) | React Hooks & Queries | `3` / `0` | Pure / internal |
| `9` | [`src/hooks/useCursorTooltip.ts`](../src/hooks/useCursorTooltip.ts) | React Hooks & Queries | `3` / `0` | Pure / internal |
| `9` | [`src/hooks/usePerformanceTier.ts`](../src/hooks/usePerformanceTier.ts) | React Hooks & Queries | `3` / `0` | Pure / internal |
| `9` | [`src/hooks/useTouchDevice.ts`](../src/hooks/useTouchDevice.ts) | React Hooks & Queries | `3` / `0` | Pure / internal |
| `8` | [`src/app/read/[id]/page.tsx`](../src/app/read/[id]/page.tsx) | App Router Pages & Layouts | `3` / `0` | Pure / internal |
| `8` | [`src/components/presentation/CollectionEmptyState.tsx`](../src/components/presentation/CollectionEmptyState.tsx) | UI & Feature Components | `4` / `0` | Pure / internal |
| `8` | [`src/components/ui/Alert.tsx`](../src/components/ui/Alert.tsx) | UI & Feature Components | `4` / `0` | Pure / internal |
| `8` | [`src/components/ui/RemoveCollectionBookModal.tsx`](../src/components/ui/RemoveCollectionBookModal.tsx) | UI & Feature Components | `4` / `0` | Pure / internal |
| `8` | [`src/components/ui/Textarea.tsx`](../src/components/ui/Textarea.tsx) | UI & Feature Components | `4` / `0` | Pure / internal |
| `8` | [`src/config/views.config.ts`](../src/config/views.config.ts) | Config & Type Contracts | `3` / `2` | Pure / internal |
| `8` | [`src/lib/book-tags.ts`](../src/lib/book-tags.ts) | Domain Engines & Adapters | `2` / `0` | Pure / internal |

<details><summary>Standard & Leaf Modules Pending Optional Annotation (151 Modules)</summary>

| Priority Score | Module | Layer | Callers (Runtime / Type) | Cross-Boundary Touchpoints |
| :---: | :--- | :--- | :---: | :--- |
| `7` | [`scripts/generate-roadmap.js`](../scripts/generate-roadmap.js) | CLI Pipelines & Governance | `2` / `0` | Leaf / pure |
| `7` | [`src/hooks/useCatalogFilters.ts`](../src/hooks/useCatalogFilters.ts) | React Hooks & Queries | `1` / `2` | Leaf / pure |
| `7` | [`src/hooks/useMobileViewSwipe.ts`](../src/hooks/useMobileViewSwipe.ts) | React Hooks & Queries | `2` / `0` | Leaf / pure |
| `7` | [`src/hooks/useMobileViewportCardFocus.ts`](../src/hooks/useMobileViewportCardFocus.ts) | React Hooks & Queries | `2` / `0` | Leaf / pure |
| `7` | [`src/hooks/useScrollDirection.ts`](../src/hooks/useScrollDirection.ts) | React Hooks & Queries | `2` / `0` | Leaf / pure |
| `7` | [`src/hooks/useVisualViewportKeyboard.ts`](../src/hooks/useVisualViewportKeyboard.ts) | React Hooks & Queries | `2` / `0` | Leaf / pure |
| `6` | [`src/app/read/[id]/layout.tsx`](../src/app/read/[id]/layout.tsx) | App Router Pages & Layouts | `0` / `0` | API Calls: `/api/books/content` |
| `6` | [`src/components/presentation/BookPreviewModal.tsx`](../src/components/presentation/BookPreviewModal.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/presentation/BookshelfRack.tsx`](../src/components/presentation/BookshelfRack.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/presentation/CollectionBottomDock.tsx`](../src/components/presentation/CollectionBottomDock.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/presentation/CollectionFilterDrawer.tsx`](../src/components/presentation/CollectionFilterDrawer.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/presentation/CollectionFloatingSearch.tsx`](../src/components/presentation/CollectionFloatingSearch.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/presentation/CollectionToolbar.tsx`](../src/components/presentation/CollectionToolbar.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/presentation/ContentAdvisoryBanner.tsx`](../src/components/presentation/ContentAdvisoryBanner.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/pwa/ServiceWorkerRegister.tsx`](../src/components/pwa/ServiceWorkerRegister.tsx) | UI & Feature Components | `1` / `0` | Env Vars: `NODE_ENV` |
| `6` | [`src/components/reader/DeleteAnnotationModal.tsx`](../src/components/reader/DeleteAnnotationModal.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/symposium/SymposiumInviteModal.tsx`](../src/components/symposium/SymposiumInviteModal.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/ui/AmbientCapsuleDock.tsx`](../src/components/ui/AmbientCapsuleDock.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/ui/BackToTop.tsx`](../src/components/ui/BackToTop.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/ui/BrandLogo.tsx`](../src/components/ui/BrandLogo.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/ui/Pagination.tsx`](../src/components/ui/Pagination.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/components/ui/SectionHeader.tsx`](../src/components/ui/SectionHeader.tsx) | UI & Feature Components | `3` / `0` | Leaf / pure |
| `6` | [`src/config/literary-quotes.ts`](../src/config/literary-quotes.ts) | Config & Type Contracts | `3` / `0` | Leaf / pure |
| `6` | [`src/hooks/reader/useReaderSpeech.ts`](../src/hooks/reader/useReaderSpeech.ts) | React Hooks & Queries | `1` / `1` | Leaf / pure |
| `6` | [`src/lib/catalog/curated-fallback.ts`](../src/lib/catalog/curated-fallback.ts) | Domain Engines & Adapters | `1` / `0` | Leaf / pure |
| `6` | [`src/lib/gutenberg/index.ts`](../src/lib/gutenberg/index.ts) | Domain Engines & Adapters | `1` / `0` | Leaf / pure |
| `6` | [`src/lib/gutenberg/metadata.ts`](../src/lib/gutenberg/metadata.ts) | Domain Engines & Adapters | `1` / `0` | Leaf / pure |
| `6` | [`src/lib/in-book-search.ts`](../src/lib/in-book-search.ts) | Domain Engines & Adapters | `1` / `0` | Leaf / pure |
| `6` | [`src/lib/notebook-sorting.ts`](../src/lib/notebook-sorting.ts) | Domain Engines & Adapters | `1` / `0` | Leaf / pure |
| `6` | [`src/types/catalog.types.ts`](../src/types/catalog.types.ts) | Config & Type Contracts | `2` / `2` | Leaf / pure |
| `5` | [`scripts/generate-architecture-matrix.js`](../scripts/generate-architecture-matrix.js) | CLI Pipelines & Governance | `1` / `0` | Helpers: `scripts/eslint-rules/bookarium-security.js`, `scripts/generate-roadmap.js`, `scripts/lib/ast-parser.js`, `scripts/lib/sast-validators.js` |
| `5` | [`scripts/generate-changelog.js`](../scripts/generate-changelog.js) | CLI Pipelines & Governance | `1` / `0` | Leaf / pure |
| `5` | [`scripts/generate-contracts-docs.js`](../scripts/generate-contracts-docs.js) | CLI Pipelines & Governance | `1` / `0` | Helpers: `scripts/lib/ast-parser.js` |
| `5` | [`scripts/generate-parser-docs.js`](../scripts/generate-parser-docs.js) | CLI Pipelines & Governance | `1` / `0` | Helpers: `scripts/lib/ast-parser.js` |
| `5` | [`src/components/presentation/CollectionSortDropdown.tsx`](../src/components/presentation/CollectionSortDropdown.tsx) | UI & Feature Components | `1` / `3` | Leaf / pure |
| `5` | [`src/hooks/reader/useGutenbergParserWorker.ts`](../src/hooks/reader/useGutenbergParserWorker.ts) | React Hooks & Queries | `1` / `0` | Leaf / pure |
| `5` | [`src/hooks/reader/useReaderAnnotationActions.ts`](../src/hooks/reader/useReaderAnnotationActions.ts) | React Hooks & Queries | `1` / `0` | Leaf / pure |
| `5` | [`src/hooks/reader/useReaderDrawers.ts`](../src/hooks/reader/useReaderDrawers.ts) | React Hooks & Queries | `1` / `0` | Leaf / pure |
| `5` | [`src/hooks/reader/useReaderExitBookmark.ts`](../src/hooks/reader/useReaderExitBookmark.ts) | React Hooks & Queries | `1` / `0` | Leaf / pure |
| `5` | [`src/hooks/reader/useReaderGestures.ts`](../src/hooks/reader/useReaderGestures.ts) | React Hooks & Queries | `1` / `0` | Leaf / pure |
| `5` | [`src/hooks/reader/useReaderHabitTelemetry.ts`](../src/hooks/reader/useReaderHabitTelemetry.ts) | React Hooks & Queries | `1` / `0` | Leaf / pure |
| `5` | [`src/hooks/useBookshelfCapacity.ts`](../src/hooks/useBookshelfCapacity.ts) | React Hooks & Queries | `1` / `0` | Leaf / pure |
| `5` | [`src/hooks/useCopyFeedback.ts`](../src/hooks/useCopyFeedback.ts) | React Hooks & Queries | `1` / `0` | Leaf / pure |
| `5` | [`src/hooks/useNotebookMetadataResolver.ts`](../src/hooks/useNotebookMetadataResolver.ts) | React Hooks & Queries | `1` / `0` | Leaf / pure |
| `5` | [`src/hooks/useOfflineCatalogFallback.ts`](../src/hooks/useOfflineCatalogFallback.ts) | React Hooks & Queries | `1` / `0` | Leaf / pure |
| `5` | [`src/hooks/usePersonalCollectionsController.ts`](../src/hooks/usePersonalCollectionsController.ts) | React Hooks & Queries | `1` / `0` | Leaf / pure |
| `5` | [`src/hooks/useReadingTimer.ts`](../src/hooks/useReadingTimer.ts) | React Hooks & Queries | `1` / `0` | Leaf / pure |
| `4` | [`src/app/account/page.tsx`](../src/app/account/page.tsx) | App Router Pages & Layouts | `1` / `0` | Leaf / pure |
| `4` | [`src/components/accolades/ExLibrisBookplate.tsx`](../src/components/accolades/ExLibrisBookplate.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/bookshelf/ReadingStatusSelector.tsx`](../src/components/bookshelf/ReadingStatusSelector.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/motion/motion-config.ts`](../src/components/motion/motion-config.ts) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/presentation/BookCard.tsx`](../src/components/presentation/BookCard.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/presentation/CopyrightNoticeBanner.tsx`](../src/components/presentation/CopyrightNoticeBanner.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/presentation/OpenBookLeftPageSpread.tsx`](../src/components/presentation/OpenBookLeftPageSpread.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/presentation/bookshelf/BookshelfMobileModal.tsx`](../src/components/presentation/bookshelf/BookshelfMobileModal.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/profile/PrivateProfileNotice.tsx`](../src/components/profile/PrivateProfileNotice.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/reader/ReaderLoadingView.tsx`](../src/components/reader/ReaderLoadingView.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/share/SocialSharePanel.tsx`](../src/components/share/SocialSharePanel.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/ui/Badge.tsx`](../src/components/ui/Badge.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/ui/BottomSheetDrawerShell.tsx`](../src/components/ui/BottomSheetDrawerShell.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/ui/PasswordStrengthMeter.tsx`](../src/components/ui/PasswordStrengthMeter.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/components/ui/Switch.tsx`](../src/components/ui/Switch.tsx) | UI & Feature Components | `2` / `0` | Leaf / pure |
| `4` | [`src/config/library-tokens.ts`](../src/config/library-tokens.ts) | Config & Type Contracts | `2` / `0` | Leaf / pure |
| `3` | [`scripts/generate-pwa-icons.js`](../scripts/generate-pwa-icons.js) | CLI Pipelines & Governance | `0` / `0` | Leaf / pure |
| `3` | [`scripts/generate-quality-report.js`](../scripts/generate-quality-report.js) | CLI Pipelines & Governance | `0` / `0` | Helpers: `scripts/eslint-rules/bookarium-security.js`, `scripts/lib/ast-parser.js` |
| `3` | [`scripts/open-browser.js`](../scripts/open-browser.js) | CLI Pipelines & Governance | `0` / `0` | Leaf / pure |
| `3` | [`src/components/profile/PinnedAccoladesShelf.tsx`](../src/components/profile/PinnedAccoladesShelf.tsx) | UI & Feature Components | `1` / `1` | Leaf / pure |
| `2` | [`src/app/account/layout.tsx`](../src/app/account/layout.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/auth/confirm-deletion/layout.tsx`](../src/app/auth/confirm-deletion/layout.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/auth/confirm-deletion/page.tsx`](../src/app/auth/confirm-deletion/page.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/copyright/layout.tsx`](../src/app/copyright/layout.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/copyright/page.tsx`](../src/app/copyright/page.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/error.tsx`](../src/app/error.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/global-error.tsx`](../src/app/global-error.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/loading.tsx`](../src/app/loading.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/manifest.ts`](../src/app/manifest.ts) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/not-found.tsx`](../src/app/not-found.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/page.tsx`](../src/app/page.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/privacy/layout.tsx`](../src/app/privacy/layout.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/privacy/page.tsx`](../src/app/privacy/page.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/robots.ts`](../src/app/robots.ts) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/sitemap.ts`](../src/app/sitemap.ts) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/app/u/[username]/layout.tsx`](../src/app/u/[username]/layout.tsx) | App Router Pages & Layouts | `0` / `0` | Leaf / pure |
| `2` | [`src/components/accolades/AccoladeCelebrationModal.tsx`](../src/components/accolades/AccoladeCelebrationModal.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/AccountAccoladesCard.tsx`](../src/components/account/AccountAccoladesCard.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/AccountBottomDock.tsx`](../src/components/account/AccountBottomDock.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/AccountDeleteModal.tsx`](../src/components/account/AccountDeleteModal.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/AccountHabitsCard.tsx`](../src/components/account/AccountHabitsCard.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/AccountIdentityCard.tsx`](../src/components/account/AccountIdentityCard.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/AccountNarrationSubPanel.tsx`](../src/components/account/AccountNarrationSubPanel.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/AccountPreferencesSection.tsx`](../src/components/account/AccountPreferencesSection.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/AccountPublicProfileSection.tsx`](../src/components/account/AccountPublicProfileSection.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/AccountSecuritySection.tsx`](../src/components/account/AccountSecuritySection.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/AccountSymposiumSection.tsx`](../src/components/account/AccountSymposiumSection.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/AccountTypographySubPanel.tsx`](../src/components/account/AccountTypographySubPanel.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/HighlightBioPickerModal.tsx`](../src/components/account/HighlightBioPickerModal.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/symposium/FellowshipInvitationsSubTab.tsx`](../src/components/account/symposium/FellowshipInvitationsSubTab.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/symposium/ReaderCircleSubTab.tsx`](../src/components/account/symposium/ReaderCircleSubTab.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/account/symposium/SymposiumPactsSubTab.tsx`](../src/components/account/symposium/SymposiumPactsSubTab.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/auth/AuthModal.tsx`](../src/components/auth/AuthModal.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/auth/EmailSentView.tsx`](../src/components/auth/EmailSentView.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/AdvancedFilterDrawer.tsx`](../src/components/presentation/AdvancedFilterDrawer.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/BookGrid.tsx`](../src/components/presentation/BookGrid.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/BookmarkCard.tsx`](../src/components/presentation/BookmarkCard.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/BookmarksView.tsx`](../src/components/presentation/BookmarksView.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/CatalogMobileBottomDock.tsx`](../src/components/presentation/CatalogMobileBottomDock.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/CatalogOfflineView.tsx`](../src/components/presentation/CatalogOfflineView.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/CatalogTelemetryBadge.tsx`](../src/components/presentation/CatalogTelemetryBadge.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/CollectionClearConfirmModal.tsx`](../src/components/presentation/CollectionClearConfirmModal.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/CollectionTopPagination.tsx`](../src/components/presentation/CollectionTopPagination.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/EditorialQuoteSection.tsx`](../src/components/presentation/EditorialQuoteSection.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/HeroFeaturedBook2DCard.tsx`](../src/components/presentation/HeroFeaturedBook2DCard.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/HeroFeaturedBook3D.tsx`](../src/components/presentation/HeroFeaturedBook3D.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/HeroSearch.tsx`](../src/components/presentation/HeroSearch.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/LanguageSelector.tsx`](../src/components/presentation/LanguageSelector.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/LiteraryQuotes.tsx`](../src/components/presentation/LiteraryQuotes.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/NotablePassagesSpread.tsx`](../src/components/presentation/NotablePassagesSpread.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/NotebookQuoteCard.tsx`](../src/components/presentation/NotebookQuoteCard.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/NotebookView.tsx`](../src/components/presentation/NotebookView.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/StickyCatalogToolbar.tsx`](../src/components/presentation/StickyCatalogToolbar.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/bookshelf/BookshelfManageModals.tsx`](../src/components/presentation/bookshelf/BookshelfManageModals.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/bookshelf/BookshelfSpine.tsx`](../src/components/presentation/bookshelf/BookshelfSpine.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/notebook/NotebookFilterStrip.tsx`](../src/components/presentation/notebook/NotebookFilterStrip.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/notebook/NotebookVolumeGroup.tsx`](../src/components/presentation/notebook/NotebookVolumeGroup.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/presentation/notebook/QuickColorSwatchPopover.tsx`](../src/components/presentation/notebook/QuickColorSwatchPopover.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/profile/ProfileShareModal.tsx`](../src/components/profile/ProfileShareModal.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/profile/PublicProfileView.tsx`](../src/components/profile/PublicProfileView.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/GutenbergInfoModal.tsx`](../src/components/reader/GutenbergInfoModal.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/QuoteDeletePreview.tsx`](../src/components/reader/QuoteDeletePreview.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderAnnotationsDrawer.tsx`](../src/components/reader/ReaderAnnotationsDrawer.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderControls.tsx`](../src/components/reader/ReaderControls.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderErrorView.tsx`](../src/components/reader/ReaderErrorView.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderExitBookmarkModal.tsx`](../src/components/reader/ReaderExitBookmarkModal.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderFloatingToolsPod.tsx`](../src/components/reader/ReaderFloatingToolsPod.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderFooter.tsx`](../src/components/reader/ReaderFooter.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderHeader.tsx`](../src/components/reader/ReaderHeader.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderLanguageDrawer.tsx`](../src/components/reader/ReaderLanguageDrawer.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderRowBookmark.tsx`](../src/components/reader/ReaderRowBookmark.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderSearchDrawer.tsx`](../src/components/reader/ReaderSearchDrawer.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderShareModal.tsx`](../src/components/reader/ReaderShareModal.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderSpeechBar.tsx`](../src/components/reader/ReaderSpeechBar.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderSubHeaderRibbon.tsx`](../src/components/reader/ReaderSubHeaderRibbon.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderSurface.tsx`](../src/components/reader/ReaderSurface.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/ReaderTocDrawer.tsx`](../src/components/reader/ReaderTocDrawer.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/TextHighlightPopover.tsx`](../src/components/reader/TextHighlightPopover.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/reader/VolumeCompletionModal.tsx`](../src/components/reader/VolumeCompletionModal.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/ui/Card.tsx`](../src/components/ui/Card.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/components/ui/EditorialUnderlineTabs.tsx`](../src/components/ui/EditorialUnderlineTabs.tsx) | UI & Feature Components | `1` / `0` | Leaf / pure |
| `2` | [`src/config/translation-languages.ts`](../src/config/translation-languages.ts) | Config & Type Contracts | `1` / `0` | Leaf / pure |
| `0` | [`src/components/motion/MotionReveal.tsx`](../src/components/motion/MotionReveal.tsx) | UI & Feature Components | `0` / `0` | Leaf / pure |
| `0` | [`src/components/motion/StaggerGroup.tsx`](../src/components/motion/StaggerGroup.tsx) | UI & Feature Components | `0` / `0` | Leaf / pure |

</details>

---

## 🔒 Verification & Compliance

This living contract reference is compiled in **Pass 4** and validated in **Pass 5 of the 7-Gateway Quality Engine** (`npm run verify`, `npm run security:audit`) alongside Tier-1..Tier-4 protected module preservation and `ADR-XXX` cross-reference checks (`ADR-081`).
