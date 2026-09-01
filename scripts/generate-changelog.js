const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');
const adrPath = path.join(rootDir, 'docs', 'DECISIONS.md');

// Exhaustive milestone catalog adhering to Keep a Changelog 1.0.0 & SemVer
const RELEASES = [
  {
    version: '1.4.0',
    date: '2026-09-01',
    title: 'Classic Library Aesthetics, Tactile Hardwood Bookshelves & Cross-Theme Harmonization',
    sections: {
      Added: [
        'Unified Bookcase Architecture: Integrated shelf back-wall alcove and solid hardwood timber rail into a single structural module, guaranteeing zero vertical air gap on desktop and smooth flush touch-scrolling on mobile.',
        'Convex 3D Spine Physics: Created `.book-spine-convex` multi-stop cylindrical specular lighting overlay simulating authentic curved hardcover spines and hinge creases.',
        'Hot-Foil Typography & Seals: Designed `.spine-emboss-gold` and `.spine-emboss-silver` text treatments with gilded headcap rules and embossed author volume stamps.',
        'Curated Library Palettes: Implemented 8 authentic bookbinding colorways (Oxblood Burgundy, Imperial Navy, Emerald Leather, Amber Saddle, Royal Plum, Aged Charcoal, Dark Teal, Espresso).',
        'Theme-Tailored Wood Railings: Added dedicated `.sepia .shelf-wood-ledge` (dark mahogany) and `.dark .shelf-wood-ledge` (charcoal walnut) with top specular bevel lines (`inset 0 1px 0`).',
        'Ambient Alcove Lighting: Added `.shelf-ambient-niche` soft radial spotlight vignette behind books across Light, Sepia, and Dark themes.',
        'Semantic Border Parity: Bound shelf container borders to 100% opacity theme tokens (`--border: #462e22` for Sepia, `#292524` for Dark) matching Profile page cards.',
      ],
      Changed: [
        'Hover Physics: Upgraded spine interaction to grounded pull-forward expansion (`origin-bottom scale-105`) with ambient drop shadow while preserving baseline alignment.',
        'Toolbar Ergonomics: Relocated shelf Rename and Delete action buttons to the right-aligned toolbar beside cloud sync status, preserving uniform shelf switcher tab sizing.',
      ],
      Fixed: [
        'Eliminated mobile horizontal scroll overflow where book spines previously extended beyond the bottom rail ledge.',
        'Fixed floating preview card reading percentage to accurately display 0% on page 1 of freshly opened books.',
      ],
    },
  },
  {
    version: '1.3.0',
    date: '2026-09-01',
    title: 'Cloud Bookshelves, Multi-Category Indexing & Supabase Synchronization',
    sections: {
      Added: [
        'Supabase PostgreSQL Cloud Sync: Bi-directional synchronization for custom named bookshelves and bookshelf items with Row Level Security (RLS) isolation.',
        'Master "General" Shelf: Aggregated view displaying all saved volumes across all custom collections with real-time volume counters.',
        'Floating "Move to Shelf" Dropdown: Instant shelf reassignment selector on spine hover cards with optimistic UI updates and background cloud persistence.',
        'Safe Shelf Deletion Workflow: Modal confirmation flow that automatically reassigns orphaned volumes back to the master "General" shelf before deleting the category.',
        'Custom Shelf Modals: Non-intrusive modal dialogs for creating, renaming, and deleting custom shelves with auto-focus inputs and validation.',
        'Guest-to-Cloud Migration: Automatic one-click sync that safely uploads local Zustand `localStorage` collections into Supabase upon user sign-in.',
      ],
      Changed: [
        '`useBookshelfStore` Architecture: Multi-shelf indexing with dynamic filtering, optimistic updates, and fallback handling for unassigned items.',
      ],
      Fixed: [
        'Fixed "Browse Catalog" button on empty shelf states to smoothly transition active view back to catalog browsing.',
        'Resolved shelf item mapping fallbacks for books saved prior to custom category creation.',
      ],
    },
  },
  {
    version: '1.2.0',
    date: '2026-08-31',
    title: 'Multi-Volume Gutenberg Parser, Table of Contents & Reader Navigation',
    sections: {
      Added: [
        'Multi-Volume Segmentation Engine: Intelligent detection and segmentation for multi-volume works (e.g. Volumes I-III, Books 1-12, Cantos, Acts, Tomes).',
        'Volume Selector Drawer: Quick drawer interface allowing readers to switch between individual volumes of multi-part works.',
        'Smart Chapter Heading Detector: Automatic Roman numeral, numbered, and titled chapter hierarchy parser.',
        'Table of Contents Drawer (`ReaderTocDrawer`): Accessible slide-out navigation with direct chapter jumps and active section tracking.',
        'Typography Preferences: Reader controls for font size scaling (12px-36px), line height adjustments (1.2-2.6), and serif/sans/monospace font families.',
        'Reader Drop-Cap Styling: Classic editorial initial-letter styling for opening chapter paragraphs.',
        'Verified Reader Profile (`/profile`): User account dashboard with reading statistics (saved volumes, liked titles, custom shelves) and atmosphere settings.',
      ],
      Changed: [
        'Progress Precision: Recalibrated reading progress tracking to strictly report 0% on page 1 with rounded integer percentages.',
        'Theme Engine: Full support for Light, Sepia (antique parchment), and Dark (midnight) modes with zero-CLS scrollbar stability (`scrollbar-gutter: stable`).',
      ],
      Fixed: [
        'Prevented premature reading completion flags when completing intermediate sub-volumes of multi-volume anthologies.',
        'Tiered Metadata Fallbacks: Implemented 4-tier resolution engine (static fixtures -> Zustand store -> REST API -> raw text headers) eliminating placeholder titles and authors.',
      ],
    },
  },
  {
    version: '1.1.0',
    date: '2026-08-31',
    title: '3D Interactive Catalog, Zero-Copyright Download Hub & Instant Discovery',
    sections: {
      Added: [
        '3D Interactive Book Rig: Realistic 3D perspective book cards (`.book-3d-rig`, `.book-3d-flipper`) with interactive hover opening physics.',
        'Zero-Copyright Download Hub: Client-side download drawer supporting EPUB, Plain Text (UTF-8), and Kindle (MOBI) formats directly from public domain mirrors.',
        'Instant & Remote Search: Dual-tier search combining debounced Gutendex API querying with instant local fuzzy filtering over featured library books.',
        'Topic & Language Drawers: Filtering drawers across genres (Fiction, Philosophy, Poetry, Science, History) and languages (English, French, German, Spanish, Italian, Latin, Ancient Greek).',
        'Literary Quote Banner: Dynamic rotator carousel featuring curated public domain passages and quotes.',
        'Back-to-Top Navigation: Floating action button with smooth window scroll restoration.',
      ],
      Changed: [
        'TanStack React Query Cache: Implemented 5-minute stale-time caching strategy with preloaded static fixtures for instant hero catalog rendering.',
      ],
    },
  },
  {
    version: '1.0.0',
    date: '2026-08-30',
    title: 'Initial Scaffold, Public Domain Discovery & 7-Gateway Governance Engine',
    sections: {
      Added: [
        'Core Next.js Architecture: Next.js App Router, React 19, and Tailwind CSS.',
        'Public Domain Integrity Layer: API route proxy (`/api/books`, `/api/books/content`) strictly enforcing `copyright=false` queries.',
        'Offline Focus Reader: In-browser focus reading surface with local storage progress persistence via Zustand.',
        'Testing Suite: Complete test suite with Vitest, MSW v2 network interception, and Testing Library (>= 80% coverage co-located with every component, hook, and store).',
        '7-Gateway Quality Engine (`scripts/verify-build.js`): Automated pre-commit verification pipeline enforcing secret prevention, type checking, unit tests, coverage floor, living docs sync, ADR schema validation, ESLint/Knip audits, and Next.js production builds.',
        'Living Documentation: AST-driven architecture matrix parser (`scripts/generate-architecture-matrix.js`) and ADR decision ledger (`docs/DECISIONS.md`).',
      ],
    },
  },
];

function generateChangelog() {
  let content = `# Changelog

All notable changes to Bookarium are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---
`;

  for (const rel of RELEASES) {
    content += `\n## [${rel.version}] - ${rel.date}\n`;
    if (rel.title) {
      content += `### *${rel.title}*\n\n`;
    }

    for (const [sectionName, items] of Object.entries(rel.sections)) {
      if (items && items.length > 0) {
        content += `### ${sectionName}\n`;
        for (const item of items) {
          content += `- ${item}\n`;
        }
        content += '\n';
      }
    }
  }

  // Link ADRs if available
  if (fs.existsSync(adrPath)) {
    const adrContent = fs.readFileSync(adrPath, 'utf-8');
    const adrMatches = [...adrContent.matchAll(/## (ADR-\d+: [^\n]+)/g)].map((m) => m[1]);
    if (adrMatches.length > 0) {
      content += `---

## Architectural Decision Records (ADRs)
The following key architectural decisions are recorded in [\`docs/DECISIONS.md\`](docs/DECISIONS.md):
`;
      for (const adr of adrMatches) {
        content += `- **${adr}**\n`;
      }
      content += '\n';
    }
  }

  fs.writeFileSync(changelogPath, content.trim() + '\n', 'utf-8');
  console.log('✔ [SUCCESS] CHANGELOG.md generated successfully.');
}

generateChangelog();