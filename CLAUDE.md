# Working rules for this repo

## Before building any unfamiliar feature

Do not write it from scratch first.

1. Search GitHub for open-source projects that already solve it.
2. Compare the main approaches: maintenance activity, licence, size, and fit
   with this stack (Next.js 14 static export, deployed to GitHub Pages).
3. Install the skills, MCP servers or plugins that help, and tell the owner
   what was added.
4. Then build, reusing or adapting what was found.

Check the licence before reusing any code. Ask before installing anything
that needs a login, an API key, or payment.

## When the owner has to do something by hand

If a step cannot be done from here, give complete step-by-step instructions
simple enough for a nine-year-old to follow: every click, every field, nothing
assumed.

## Site copy

All copy lives in `lib/content.ts`. First person, British English, no em
dashes.

## Ruflo

Ruflo (formerly Claude Flow, MIT, pinned to 3.80.0) is installed: agents,
skills and commands in `.claude/`, its hooks in `.claude/settings.json`, its
MCP server in `.mcp.json`. Use its swarms and multi-agent runs only when the
owner asks, since they use up the Claude usage limit quickly. Its memory
(`.swarm/`) and run data stay out of git because this repo is public: never
commit them, and never store client details, partner names or passwords in
its memory.
