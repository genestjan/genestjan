# Working preferences (Jan)

These apply to every project in this repository (the website, RideWise and the Rangers app).

## Unfamiliar features: research before building

For any feature or integration that is new to the codebase (for example uploads to a cloud service, push
notifications, maps, payments, sign-in flows, media processing, AI features), do not write it from scratch first:

1. Search GitHub (and the plugin catalogue) for open-source projects, libraries and working examples that already
   solve it.
2. Compare at least two approaches on: how well maintained it is (recent commits, open issues), licence (MIT, Apache
   or BSD preferred; flag GPL), size and dependencies, security record, cost (free first), and fit with the
   existing stack.
3. Install the skills, MCP servers or plugins that help, when they are available in the session.
4. Tell Jan in a few lines what was found, which approach was chosen and why, then build.
5. Write it from scratch only when nothing suitable exists, or when the best option would break a rule (bundle
   size budget, children's data, licence). Say so when that happens.

In the Rangers app, a new dependency still needs an ADR and a pinned version (see `rangers-app/CLAUDE.md`).
