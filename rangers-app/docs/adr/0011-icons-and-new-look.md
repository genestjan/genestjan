# ADR 0011: Icon set and the new look

Date: 24 October 2026. Approved by Jan (he supplied the design mockup).

## Decision
- Adopt Jan's mockup: royal blue background, gold main buttons, white text, icon tab bar (Home, Schedule, Team or Tasks, Inbox, More), picture header with the crest, tiles, date blocks, list rows with chevrons.
- Add `lucide-react` 1.52.0 (MIT, pinned) for icons. Only the icons used are bundled (tree-shaken). The football icon is a small inline SVG because the set has none.
- The Home and Team headers show the club's own photo from `rangersfc.net/assets/` at runtime. The photo is not copied into this repository (no real child data in the repo). If it cannot load, a pitch pattern shows instead.

## Consequences
- Main bundle is about 198 KB gzipped (budget 250 KB). Watch it when adding screens.
- Branding rules in CLAUDE.md are updated to match.
