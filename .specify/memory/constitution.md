# genestjanramirez.com Constitution

## Core Principles

### I. Reuse before building
Before building any unfamiliar feature, search GitHub for open-source projects that already solve it, compare maintenance, licence, size and fit with this stack, check the licence, then build by reusing or adapting what was found. Ask the owner before installing anything that needs a login, an API key or payment.

### II. Static-export friendly
The main site is Next.js 14 with `output: 'export'`, deployed to GitHub Pages by `.github/workflows/pages.yml`. Every feature must work as static files: no server routes, no runtime secrets in the browser bundle. Sub-apps (ridewise, fetch, gen-pedal-hub, vpn/ui, beki-site) build separately and are copied into `out/`.

### III. Copy rules
All site copy lives in `lib/content.ts`. First person, British English, no em dashes. Never invent clients, results or testimonials.

### IV. Prove it works
Run the project's own checks before pushing: `npm run build` for the site, and `npm test` plus the build for any sub-app touched. Keep Lighthouse accessibility at 100 and do not regress performance (idle animations, optimised images).

### V. Small, safe changes
Smallest change that fully solves the task. No secrets or `.env` files committed. Private apps stay out of the sitemap and are disallowed in robots.txt.

## Owner instructions
When the owner must do something by hand, give complete step-by-step instructions simple enough for a nine-year-old: every click, every field, nothing assumed.

## Governance
This constitution and `CLAUDE.md` win over other guidance. Amend by editing this file in a commit that explains why.

**Version**: 1.0.0 | **Ratified**: 2026-11-27 | **Last Amended**: 2026-11-27
