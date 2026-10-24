# ADR 0010: Host at rangersfc.net/app with hash routes (for now)

**Status:** accepted. Supersedes the subdomain choice in ADR list item 1 of the blueprint for launch.

**Context.** The plan preferred `app.rangersfc.net` from its own repository. That needs a new repository with Pages switched on and a DNS record at Onamae.com, which only the club can do. The club website already deploys from `ayakent/RangersFc` to `rangersfc.net` on GitHub Pages.

**Decision.** Build the app with `base: '/app/'` and publish it into the website repository's `app/` folder, served at `https://rangersfc.net/app/`. Use hash routes (`/app/#/join/<token>`), because GitHub Pages only serves the website's own 404 page for unknown paths, so path routes such as `/app/join` would break on first open.

**Consequences.**
- Live without any DNS or Pages settings changes. Installs to the home screen with its own scope (`/app/`).
- The app shares an origin with the club website, so the website must not load third-party scripts that could read the app's storage, and must not register a service worker whose scope covers `/app/`. Checked at publish time.
- Moving later to `app.rangersfc.net` is a rebuild with `APP_BASE=/`; families would sign in again (their data is in the cloud) and re-add the home-screen icon.
