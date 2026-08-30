# Changelog

All notable changes to LibreRead will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-30
### Added
- Initial scaffold for LibreRead with Next.js 15 App Router, React 19, and Tailwind CSS.
- Zero-Copyright Public Domain discovery layer backed by Gutendex API (`copyright=false`).
- In-browser focus-mode reader with light/dark/sepia themes, font scaling, and reading position persistence.
- Offline Personal Bookshelf backed by Zustand and `localStorage`.
- Zero-Copyright Download Hub supporting EPUB, Plain Text, and Kindle formats.
- Complete testing suite with Vitest, MSW, and Testing Library (>= 80% coverage).
- Automated governance scripts: AST parser, architecture matrix generator, quality audit suite, build verifier, ADR creator, and changelog generator.

