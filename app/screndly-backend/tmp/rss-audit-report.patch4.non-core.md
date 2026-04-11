# RSS Audit Report

Generated: 2026-04-10T19:32:58.683Z
Total articles scanned: 17
Publish passes: 0
Publish blocks: 17

## Top Failure Codes

- IMAGE_NOT_FOUND: 17
- IMAGE_NOT_FOUND_FALSE_BLOCK: 17
- PROJECT_FALLBACK_EMPTY: 17
- CAPTION_CANONICAL_ENTITY_MISMATCH: 7
- CAPTION_ARTICLE_PACKAGE_LABEL: 2
- CAPTION_BROKEN_QUOTE: 2
- CAPTION_HEADLINE_JUNK: 2
- CAPTION_MALFORMED_HEADLINE: 2
- CAPTION_PACKAGE_LABEL_LEAK: 2
- CAPTION_CONTAINS_HTML_ENTITY: 1
- CAPTION_HTML_ENTITY_LEAK: 1

## Failure Codes By Source

### Variety
- CAPTION_CANONICAL_ENTITY_MISMATCH: 2
- IMAGE_NOT_FOUND: 2
- IMAGE_NOT_FOUND_FALSE_BLOCK: 2
- PROJECT_FALLBACK_EMPTY: 2

### Deadline
- CAPTION_BROKEN_QUOTE: 1
- CAPTION_CANONICAL_ENTITY_MISMATCH: 1
- IMAGE_NOT_FOUND: 1
- IMAGE_NOT_FOUND_FALSE_BLOCK: 1
- PROJECT_FALLBACK_EMPTY: 1

### THR
- IMAGE_NOT_FOUND: 1
- IMAGE_NOT_FOUND_FALSE_BLOCK: 1
- PROJECT_FALLBACK_EMPTY: 1

### ComicBook
- IMAGE_NOT_FOUND: 8
- IMAGE_NOT_FOUND_FALSE_BLOCK: 8
- PROJECT_FALLBACK_EMPTY: 8
- CAPTION_ARTICLE_PACKAGE_LABEL: 2
- CAPTION_HEADLINE_JUNK: 2
- CAPTION_MALFORMED_HEADLINE: 2
- CAPTION_PACKAGE_LABEL_LEAK: 2
- CAPTION_BROKEN_QUOTE: 1

### TheWrap
- IMAGE_NOT_FOUND: 3
- IMAGE_NOT_FOUND_FALSE_BLOCK: 3
- PROJECT_FALLBACK_EMPTY: 3
- CAPTION_CANONICAL_ENTITY_MISMATCH: 2
- CAPTION_CONTAINS_HTML_ENTITY: 1
- CAPTION_HTML_ENTITY_LEAK: 1

### IndieWire
- CAPTION_CANONICAL_ENTITY_MISMATCH: 1
- IMAGE_NOT_FOUND: 1
- IMAGE_NOT_FOUND_FALSE_BLOCK: 1
- PROJECT_FALLBACK_EMPTY: 1

### SlashFilm
- CAPTION_CANONICAL_ENTITY_MISMATCH: 1
- IMAGE_NOT_FOUND: 1
- IMAGE_NOT_FOUND_FALSE_BLOCK: 1
- PROJECT_FALLBACK_EMPTY: 1

## Failure Codes By Event Type

### other
- CAPTION_CANONICAL_ENTITY_MISMATCH: 2
- IMAGE_NOT_FOUND: 2
- IMAGE_NOT_FOUND_FALSE_BLOCK: 2
- PROJECT_FALLBACK_EMPTY: 2
- CAPTION_BROKEN_QUOTE: 1

### shopping
- IMAGE_NOT_FOUND: 14
- IMAGE_NOT_FOUND_FALSE_BLOCK: 14
- PROJECT_FALLBACK_EMPTY: 14
- CAPTION_CANONICAL_ENTITY_MISMATCH: 5
- CAPTION_ARTICLE_PACKAGE_LABEL: 2
- CAPTION_HEADLINE_JUNK: 2
- CAPTION_MALFORMED_HEADLINE: 2
- CAPTION_PACKAGE_LABEL_LEAK: 2
- CAPTION_BROKEN_QUOTE: 1
- CAPTION_CONTAINS_HTML_ENTITY: 1
- CAPTION_HTML_ENTITY_LEAK: 1

### casting
- IMAGE_NOT_FOUND: 1
- IMAGE_NOT_FOUND_FALSE_BLOCK: 1
- PROJECT_FALLBACK_EMPTY: 1

## Screen Render Scope Split

- not_screenrender_core: 17

## Failure Codes By Scope

### not_screenrender_core
- IMAGE_NOT_FOUND: 17
- IMAGE_NOT_FOUND_FALSE_BLOCK: 17
- PROJECT_FALLBACK_EMPTY: 17
- CAPTION_CANONICAL_ENTITY_MISMATCH: 7
- CAPTION_ARTICLE_PACKAGE_LABEL: 2
- CAPTION_BROKEN_QUOTE: 2
- CAPTION_HEADLINE_JUNK: 2
- CAPTION_MALFORMED_HEADLINE: 2
- CAPTION_PACKAGE_LABEL_LEAK: 2
- CAPTION_CONTAINS_HTML_ENTITY: 1
- CAPTION_HTML_ENTITY_LEAK: 1

## Repeated Bad TMDb Matches

- None

## Duplicate Story Candidates

- None

## Ranked Patch Recommendations

- Add a recovery path for valid TMDb assets once canonical extraction is reliable. Occurrences: 17. Codes: IMAGE_NOT_FOUND_FALSE_BLOCK. Files: src/services/rss-image-selection.service.ts, src/services/rss-tmdb-image-selection.service.ts. Examples: 67fe756b77514c1f, e182e1868a119c38, 9cd7b3886248876f, 9f06698041983821, 17c4019e1a6d5dbf.
- Improve fallback policy for feed images only when they are explicitly project-linked and renderable. Occurrences: 17. Codes: IMAGE_NOT_FOUND. Files: src/services/rss-image-selection.service.ts. Examples: 67fe756b77514c1f, e182e1868a119c38, 9cd7b3886248876f, 9f06698041983821, 17c4019e1a6d5dbf.
- Validate caption headline entity against canonical media title and allowed entities. Occurrences: 7. Codes: CAPTION_CANONICAL_ENTITY_MISMATCH. Files: src/services/ai.service.ts, src/services/rss.service.ts. Examples: 67fe756b77514c1f, e182e1868a119c38, 9cd7b3886248876f, 926d7a91f5e65d23, 53f7ee3996a6358e.
- Reject broken quote fragments before captions can pass final validation. Occurrences: 2. Codes: CAPTION_BROKEN_QUOTE. Files: src/services/ai.service.ts. Examples: 9cd7b3886248876f, cc0c11026c13e169.
- Strip outlet package labels before deterministic caption generation. Occurrences: 2. Codes: CAPTION_MALFORMED_HEADLINE, CAPTION_PACKAGE_LABEL_LEAK. Files: src/services/ai.service.ts. Examples: 9e3250ede6969d2e, 5d5323a9bcb7dec4.
- Normalize HTML entities before quote validation and final caption validation. Occurrences: 1. Codes: CAPTION_HTML_ENTITY_LEAK. Files: src/services/ai.service.ts, src/services/rss.service.ts. Examples: 53f7ee3996a6358e.
