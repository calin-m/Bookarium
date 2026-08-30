# Architecture Matrix & Technical Specification

LibreRead is an ultra-fast, responsive web application for reading and downloading Zero-Copyright / Public Domain literature directly in modern browsers.

## Component & Module Matrix

| Module / Component | Type | Location | Responsibilities & Dependencies |
|---|---|---|---|
| `useBookshelfStore` | Zustand Store | `src/stores/useBookshelfStore.ts` | Manages offline bookmarks, queue, history, and likes with localStorage persistence. |
| `useReaderStore` | Zustand Store | `src/stores/useReaderStore.ts` | Controls reader modal state, font sizing, line height, font family, and theme (Light/Dark/Sepia). |
| `useBooks` | React Query Hook | `src/hooks/queries/useBooks.ts` | Queries Gutendex API with full-text search, topic facets, languages, and caching. |
| `useBookContent` | React Query Hook | `src/hooks/queries/useBookContent.ts` | Fetches plain text or HTML streams for books to display inside the reader modal. |
| `usePerformanceTier` | React Hook | `src/hooks/usePerformanceTier.ts` | Detects hardware/network capabilities to toggle heavy animations or prefetching. |
| `Navbar` | Presentation | `src/components/presentation/Navbar.tsx` | App navigation, brand logo, reading stats badge, and bookshelf drawer toggle. |
| `HeroSearch` | Presentation | `src/components/presentation/HeroSearch.tsx` | Search bar, topic facet chips (Philosophy, Sci-Fi, etc.), and language dropdown. |
| `BookCard` | Presentation | `src/components/presentation/BookCard.tsx` | Displays book cover, authors, downloads, bookmark button, and quick-read button. |
| `BookGrid` | Presentation | `src/components/presentation/BookGrid.tsx` | Responsive catalog grid with skeleton loaders and pagination controls. |
| `BookReaderModal` | Presentation | `src/components/presentation/BookReaderModal.tsx` | In-browser focus-mode reader with theme switcher, font scaler, and progress tracking. |
| `DownloadDrawer` | Presentation | `src/components/presentation/DownloadDrawer.tsx` | Format download hub (EPUB, Plain Text, HTML, MOBI). |
| `Footer` | Presentation | `src/components/presentation/Footer.tsx` | Public domain statement, open-source attribution, and footer links. |
| `Button` | UI Primitive | `src/components/ui/Button.tsx` | Polymorphic accessible button with variants (primary, secondary, ghost, outline). |
| `Badge` | UI Primitive | `src/components/ui/Badge.tsx` | Label pill with color variants for categories, formats, and download count. |
| `Card` | UI Primitive | `src/components/ui/Card.tsx` | Glassmorphic and flat content card wrappers. |
| `Input` | UI Primitive | `src/components/ui/Input.tsx` | Accessible text input with search icons and clear buttons. |
| `Modal` | UI Primitive | `src/components/ui/Modal.tsx` | Accessible dialog overlay with escape key dismissal and focus trap. |
| `MotionReveal` | Motion Wrapper | `src/components/motion/MotionReveal.tsx` | Viewport entry animations with Framer Motion tokens. |
| `StaggerGroup` | Motion Wrapper | `src/components/motion/StaggerGroup.tsx` | Staggered sequence animations for list and grid items. |
| `route.ts` | API Proxy | `src/app/api/books/route.ts` | Next.js API route proxying Gutendex queries with `copyright=false` safety filter. |

