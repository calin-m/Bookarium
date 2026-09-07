const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const rootDir = path.resolve(__dirname, '..');
const gutenbergDir = path.join(rootDir, 'src', 'lib', 'gutenberg');
const outputPath = path.join(rootDir, 'docs', 'GUTENBERG_PARSER.md');

/**
 * Parses a TypeScript file into a Babel AST
 */
function parseAst(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  return {
    code,
    ast: parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript'],
    }),
  };
}

/**
 * Programmatically extracts configuration constants from types.ts
 */
function extractConfig() {
  const typesPath = path.join(gutenbergDir, 'types.ts');
  const { ast } = parseAst(typesPath);
  const config = [];

  traverse(ast, {
    VariableDeclarator(p) {
      if (p.node.id.name === 'GUTENBERG_PARSER_CONFIG') {
        const init = p.node.init?.type === 'TSAsExpression' ? p.node.init.expression : p.node.init;
        if (init && init.type === 'ObjectExpression') {
          for (const prop of init.properties) {
            if (prop.type === 'ObjectProperty') {
              const key = prop.key.name || prop.key.value;
              let val = '';
              if (prop.value.type === 'NumericLiteral') val = prop.value.value;
              else if (prop.value.type === 'StringLiteral') val = `"${prop.value.value}"`;
              else val = 'expression';
              config.push({ key, val });
            }
          }
        }
      }
    },
  });

  return config;
}

/**
 * Extracts exported functions, parameter lists, and JSDoc comments from a file
 */
function extractModuleExports(filename) {
  const filePath = path.join(gutenbergDir, filename);
  if (!fs.existsSync(filePath)) return [];
  const { code, ast } = parseAst(filePath);
  const exportsList = [];

  traverse(ast, {
    ExportNamedDeclaration(p) {
      if (p.node.declaration) {
        if (p.node.declaration.type === 'FunctionDeclaration') {
          const fn = p.node.declaration;
          const name = fn.id.name;
          const params = fn.params.map((param) => {
            if (param.type === 'Identifier') return param.name;
            if (param.type === 'AssignmentPattern') return `${param.left.name} (optional)`;
            return 'param';
          });

          // Extract leading JSDoc / comments
          let doc = '';
          const comments = p.node.leadingComments || fn.leadingComments;
          if (comments && comments.length > 0) {
            doc = comments
              .map((c) => c.value.replace(/^\s*\* ?/gm, '').trim())
              .filter(Boolean)
              .join(' ');
          }

          exportsList.push({ name, params, doc });
        } else if (p.node.declaration.type === 'VariableDeclaration') {
          for (const decl of p.node.declaration.declarations) {
            if (decl.id && decl.id.name) {
              exportsList.push({
                name: decl.id.name,
                params: [],
                doc: 'Exported constant / dictionary',
              });
            }
          }
        }
      }
    },
  });

  return exportsList;
}

/**
 * Generates the Markdown documentation
 */
function generateMarkdown() {
  const config = extractConfig();
  const timestamp = new Date().toISOString().split('T')[0];

  const modules = [
    {
      file: 'segmentation.ts',
      title: 'Chapter Segmentation & Subtitle Harvesting',
      description:
        'Slices raw plain-text into ordered, clean `ChapterSection` entities. Normalizes diverse heading styles, harvests subtitles from Roman/Arabic TOC listings and body subtitles, strips ghost TOC chapters, and detects standalone body headings.',
      exports: extractModuleExports('segmentation.ts'),
    },
    {
      file: 'pagination.ts',
      title: 'Virtual Sentence-Snapped Pagination & Reading Metrics',
      description:
        'Calculates virtual page spreads snapped cleanly to paragraph and sentence boundaries. Backed by a 500-entry LRU memory cache and dynamic font-size scaling. Derives 200 WPM reading estimates.',
      exports: extractModuleExports('pagination.ts'),
    },
    {
      file: 'metadata.ts',
      title: 'Preamble Metadata Extraction & Language Mapping',
      description:
        'Scans the initial 5,000 bytes of Gutenberg plain-text headers to extract Title, Author, and ISO 639-1 Language Codes across 25+ language identifiers.',
      exports: extractModuleExports('metadata.ts'),
    },
    {
      file: 'reflow.ts',
      title: 'Heuristic Paragraph Reflow',
      description:
        'Unwraps hard 70-character single newlines into fluid paragraphs for responsive reading, while preserving poetry, verse, stanza breaks, and blockquotes with 4+ spaces indentation or lines under 45 characters.',
      exports: extractModuleExports('reflow.ts'),
    },
    {
      file: 'passages.ts',
      title: 'Dynamic Literary Passage & Quote Extraction',
      description:
        'Scans up to 120,000 characters of narrative chapters to dynamically harvest memorable dialogue quotes, opening paragraphs, and literary excerpts for the 3D Book Preview Modal.',
      exports: extractModuleExports('passages.ts'),
    },
    {
      file: 'types.ts',
      title: 'Type Contracts & Centralized Parser Configuration',
      description:
        'Defines `ChapterSection`, `DynamicBookPassage`, and the immutable `GUTENBERG_PARSER_CONFIG` parameter dictionary.',
      exports: extractModuleExports('types.ts'),
    },
  ];

  const lines = [
    '# Project Gutenberg Text Processing & Segmentation Engine — Bookarium',
    '',
    '> **Auto-Generated Living Reference**: Programmatically compiled from Source AST via `scripts/generate-parser-docs.js` (Governance Rule 2).  ',
    `> **Last Synchronized**: \`${timestamp}\`  `,
    `> **Target Subsystem**: \`src/lib/gutenberg/\` (100% Client/Worker Compatible, Zero Node.js Dependencies)`,
    '',
    '---',
    '',
    '## 🏛️ Pipeline Architecture & Text Flow',
    '',
    'Project Gutenberg books are distributed as plain ASCII/UTF-8 text files without HTML markup, structured metadata, or standardized chapter tags. Bookarium processes these files through a multi-stage deterministic pipeline:',
    '',
    '```mermaid',
    'flowchart TD',
    '    Raw["📄 Raw Gutenberg Text (.txt)"] --> Pre["Preamble Scanner (metadata.ts)"]',
    '    Pre --> Meta["Title, Author & ISO Language"]',
    '    Raw --> Strip["Header / License Slicer"]',
    '    Strip --> TOC["TOC Subtitle Harvester (segmentation.ts)"]',
    '    TOC --> Seg["Heading Segmenter (Chapters, Books, Cantos)"]',
    '    Seg --> Dedup["Phantom Chapter Deduplicator"]',
    '    Dedup --> BodySub["Standalone Body Subtitle Matcher"]',
    '    BodySub --> Flow["Paragraph Reflower (reflow.ts)"]',
    '    Flow --> Pag["Sentence-Snapped Paginator (pagination.ts)"]',
    '    Pag --> Cache["500-Entry LRU Cache (Map)"]',
    '    Flow --> Passages["Dynamic Quote Harvester (passages.ts)"]',
    '```',
    '',
    '---',
    '',
    '## ⚙️ Centralized Configuration (`GUTENBERG_PARSER_CONFIG`)',
    '',
    'All limits, thresholds, and window sizes are centralized in `src/lib/gutenberg/types.ts` to prevent magic numbers across modules:',
    '',
    '| Configuration Key | Live Value | Functional Purpose |',
    '|---|---|---|',
  ];

  for (const item of config) {
    let purpose = '';
    switch (item.key) {
      case 'CHARS_PER_PAGE_BASE':
        purpose = 'Baseline character count per virtual page at 18px font size (~850 words)';
        break;
      case 'MIN_CHARS_PER_PAGE':
        purpose = 'Safety floor preventing pages from becoming too small on large typography';
        break;
      case 'TOC_MAX_HEADING_LENGTH':
        purpose = 'Maximum character length of a heading candidate before discarding as prose';
        break;
      case 'TOC_ANALYTICAL_MAX_LENGTH':
        purpose = 'Safety threshold for analytical TOC entries containing multi-line plot synopses';
        break;
      case 'TOC_SEARCH_WINDOW_BYTES':
        purpose = 'Byte offset window from start of text to search for front-matter Table of Contents';
        break;
      case 'TOC_CLUSTER_BODY_THRESHOLD':
        purpose = 'Minimum distance from text start to avoid confusing body chapters with TOC listings';
        break;
      case 'ESTIMATED_WORDS_PER_MINUTE':
        purpose = 'Average reading speed used to calculate chapter read times';
        break;
      case 'HEADER_SCAN_BYTES':
        purpose = 'Initial byte window scanned for Project Gutenberg title, author, and language metadata';
        break;
      case 'PASSAGE_SCAN_BYTES':
        purpose = 'Maximum text slice analyzed for dynamic quote extraction to protect the event loop';
        break;
      case 'TOC_SLICE_BYTES':
        purpose = 'Window size used to extract TOC sections from front-matter';
        break;
      case 'ANTHOLOGY_MIN_DISTANCE_CHARS':
        purpose = 'Minimum character distance between anthology story headings to prevent over-segmentation';
        break;
      case 'MIN_PARAGRAPH_LENGTH':
        purpose = 'Minimum character threshold for a paragraph to be eligible for dynamic quote extraction';
        break;
      case 'MAX_PARAGRAPH_LENGTH':
        purpose = 'Maximum character threshold for quote extraction candidates';
        break;
      case 'MIN_QUOTE_LENGTH':
        purpose = 'Minimum character length of an inner dialogue quote string';
        break;
      case 'DEFAULT_QUOTE_MAX_LEN':
        purpose = 'Maximum excerpt length before adding ellipses truncation';
        break;
      default:
        purpose = 'Pipeline threshold';
    }
    lines.push(`| \`${item.key}\` | \`${item.val}\` | ${purpose} |`);
  }

  lines.push(
    '',
    '---',
    '',
    '## 🧩 Subsystem Modules & API Contracts',
    ''
  );

  for (const mod of modules) {
    lines.push(`### \`${mod.file}\` — ${mod.title}`);
    lines.push('');
    lines.push(mod.description);
    lines.push('');
    if (mod.exports.length > 0) {
      lines.push('**Exported Functions & Symbols:**');
      lines.push('');
      lines.push('| Symbol | Signature | Contract / Rationale |');
      lines.push('|---|---|---|');
      for (const exp of mod.exports) {
        const sig = exp.params.length > 0 ? `(${exp.params.join(', ')})` : 'constant';
        const doc = exp.doc || 'Public subsystem export';
        lines.push(`| \`${exp.name}\` | \`${sig}\` | ${doc} |`);
      }
      lines.push('');
    }
  }

  lines.push(
    '---',
    '',
    '## 🔍 Heuristic Parser Rules & Segmentation Logic',
    '',
    '### 1. Heading Normalization (`normalizeHeadingId`)',
    'To bridge the gap between front-matter Tables of Contents and actual body chapters, headings are mapped to a canonical key format (`${prefix}-${num}`):',
    '- **Keyword Headings**: `CHAPTER I`, `Chapter 1`, `BOOK II`, `ACT III`, `SCENE IV`, `PART V`, `CANTO VI`, `SECTION VII`, `STORY VIII`.',
    '- **Roman Numeral TOC**: `I. THE HIRED CAR` maps to `ch-i`.',
    '- **Arabic Numeral TOC**: `1. Down the Rabbit-Hole` maps to `ch-1`.',
    '- **Casing Rule**: Roman numerals in chapter titles are strictly formatted uppercase (`Chapter I: The Hired Car`, `Chapter XVI`).',
    '',
    '### 2. Chapter Subtitle Harvesting (`recordSubtitle`)',
    'Subtitles are harvested across two primary vectors:',
    '1. **Keyword Subtitles**: Matches `CHAPTER I: THE HIRED CAR` or `CHAPTER 1 - THE HIRED CAR`. Trailing page numbers (e.g. `... 24`) are stripped and titles are title-cased.',
    '2. **Front-Matter TOC Items**: Matches items like `I. THE HIRED CAR 1` or `1. Down the Rabbit-Hole ... 1`. Strips dot-leaders (`...`) and trailing page numbers.',
    '3. **Standalone Body Subtitles**: When a book lacks a front-matter TOC (or the TOC entry was wrapped), the parser checks the lines immediately following `CHAPTER [num]` in the body. If a standalone 2–90 character line is followed by a blank line and contains no ending punctuation, it is harvested as the chapter subtitle.',
    '',
    '### 3. Phantom Chapter Deduplication',
    'When a book includes a Table of Contents in the front-matter, naive splitters treat TOC lines as individual chapters. Bookarium applies a strict two-stage deduplication guard:',
    '- **Guard Condition**: A candidate chapter is only dropped as a ghost TOC listing if `isVeryShort` (`bodyLength < 150` chars) **AND** `hasLaterDuplicate` (a subsequent section shares the same normalized heading key).',
    '- **Safety**: Legitimate short chapters (e.g. epigrams, author notes) are never dropped because they lack later duplicates.',
    '',
    '### 4. Sentence-Snapped Virtual Pagination (`paginateChapterContent`)',
    'Splits prose without ever breaking words across virtual page turns using a 3-tier boundary hierarchy:',
    '1. **Paragraph Boundary (`\\n\\n`)**: Preferred split within the search window `[0.75 * charsPerPage, charsPerPage + 60]`.',
    '2. **Sentence Boundary (`[.!?]["\']?\\s+`)**: Snaps to full sentences if no paragraph break is present.',
    '3. **Word Boundary (`\\s`)**: Snaps to the nearest word boundary before `charsPerPage`.',
    '',
    '### 5. Paragraph Reflow (`reflowGutenbergParagraphs`)',
    '- Joins single hard newlines (70–75 chars) with a single space for responsive fluid reading across any device viewport.',
    '- Preserves poetry, verse, and blockquotes if all lines are indented with 4+ spaces or if lines are consistently under 45 characters.',
    '',
    '---',
    '',
    '## 🔒 Verification & Compliance',
    '',
    'This living specification is verified deterministically by **Pass 4 of the 7-Gateway Quality Engine** (`npm run verify`) and synchronized via `npm run docs:sync`. Any drift between AST exports and this specification triggers an immediate verification failure.',
    ''
  );

  return lines.join('\n');
}

// Generate and write documentation
const content = generateMarkdown();
fs.writeFileSync(outputPath, content, 'utf-8');
console.log('✔ [SUCCESS] Living docs/GUTENBERG_PARSER.md generated successfully from AST.');
