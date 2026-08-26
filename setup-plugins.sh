#!/usr/bin/env bash
#
# Reproducible install for the Claude Code plugin + MCP server set.
#
# Installs 3 Claude Code plugins, 1 skill, 1 CLI tool, and 9 MCP servers.
# Idempotent: safe to re-run.
#
# Usage:  ./setup-plugins.sh
#
# Servers marked NEEDS KEY are registered with REPLACE_ME placeholders and
# will connect but fail on first real call until you swap the credential:
#   claude mcp remove <name> -s user
#   claude mcp add <name> -s user --env KEY=real_value -- <command>

set -uo pipefail

MCP_ROOT="${MCP_ROOT:-/opt/mcp}"
say() { printf '\n=== %s ===\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

mkdir -p "$MCP_ROOT"

# ---------------------------------------------------------------------------
# System prerequisites
# ---------------------------------------------------------------------------
say "system prerequisites"
if ! have ffmpeg; then
  # apt index in fresh containers is usually stale; update first or fetches 404.
  apt-get update -q && apt-get install -y -q ffmpeg
fi

# ---------------------------------------------------------------------------
# Claude Code plugins (marketplace-based)
# ---------------------------------------------------------------------------
say "plugin marketplaces"
claude plugin marketplace add headroomlabs-ai/headroom          || true
claude plugin marketplace add dietrichgebert/ponytail           || true
claude plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill || true

say "plugins"
claude plugin install headroom@headroom-marketplace       || true
claude plugin install ponytail@ponytail                   || true
claude plugin install ui-ux-pro-max@ui-ux-pro-max-skill   || true

# ---------------------------------------------------------------------------
# Standalone CLI tools
# ---------------------------------------------------------------------------
say "codeburn (AI spend dashboard)"
npm install -g codeburn

# ---------------------------------------------------------------------------
# glyph — Go MCP server, built from source (no Linux brew package)
# ---------------------------------------------------------------------------
say "glyph"
if [ ! -x /usr/local/bin/glyph ]; then
  rm -rf "$MCP_ROOT/glyph"
  git clone --depth 1 https://github.com/benmyles/glyph.git "$MCP_ROOT/glyph"
  ( cd "$MCP_ROOT/glyph" && go build -o /usr/local/bin/glyph ./... )
fi
claude mcp add glyph -s user -- /usr/local/bin/glyph mcp || true

# ---------------------------------------------------------------------------
# graphify — Python. The `graphify install` self-registration command is not
# used here; we register its bundled MCP server directly instead.
# NOTE: the base `graphifyy` package does NOT pull in `mcp`; without it
# graphify-mcp exits immediately with ModuleNotFoundError.
# ---------------------------------------------------------------------------
say "graphify"
if [ ! -x "$MCP_ROOT/graphify/.venv/bin/graphify-mcp" ]; then
  mkdir -p "$MCP_ROOT/graphify"
  uv venv "$MCP_ROOT/graphify/.venv"
  uv pip install --python "$MCP_ROOT/graphify/.venv/bin/python" graphifyy
fi
uv pip install --python "$MCP_ROOT/graphify/.venv/bin/python" mcp
claude mcp add graphify -s user -- "$MCP_ROOT/graphify/.venv/bin/graphify-mcp" || true

# ---------------------------------------------------------------------------
# higgsfield — Python MCP server. NEEDS KEY (api key + secret).
# Package is not installed, so PYTHONPATH must point at src/.
# ---------------------------------------------------------------------------
say "higgsfield"
if [ ! -d "$MCP_ROOT/higgsfield_ai_mcp" ]; then
  git clone --depth 1 https://github.com/geopopos/higgsfield_ai_mcp.git "$MCP_ROOT/higgsfield_ai_mcp"
  uv venv "$MCP_ROOT/higgsfield_ai_mcp/.venv"
  uv pip install --python "$MCP_ROOT/higgsfield_ai_mcp/.venv/bin/python" \
    -r "$MCP_ROOT/higgsfield_ai_mcp/requirements.txt"
fi
claude mcp add higgsfield -s user \
  --env PYTHONPATH="$MCP_ROOT/higgsfield_ai_mcp/src" \
  --env HIGGSFIELD_API_KEY=REPLACE_ME \
  --env HIGGSFIELD_SECRET=REPLACE_ME \
  -- "$MCP_ROOT/higgsfield_ai_mcp/.venv/bin/python" -m higgsfield_mcp.server || true

# ---------------------------------------------------------------------------
# quickbooks — TypeScript, must be compiled. NEEDS KEY (OAuth credentials).
# ---------------------------------------------------------------------------
say "quickbooks"
if [ ! -f "$MCP_ROOT/quickbooks-online-mcp-server/dist/index.js" ]; then
  git clone --depth 1 https://github.com/intuit/quickbooks-online-mcp-server.git \
    "$MCP_ROOT/quickbooks-online-mcp-server"
  ( cd "$MCP_ROOT/quickbooks-online-mcp-server" && npm install && npm run build )
fi
claude mcp add quickbooks -s user \
  --env QUICKBOOKS_CLIENT_ID=REPLACE_ME \
  --env QUICKBOOKS_CLIENT_SECRET=REPLACE_ME \
  --env QUICKBOOKS_REFRESH_TOKEN=REPLACE_ME \
  --env QUICKBOOKS_REALM_ID=REPLACE_ME \
  -- node "$MCP_ROOT/quickbooks-online-mcp-server/dist/index.js" || true

# ---------------------------------------------------------------------------
# mcp-chrome — the `mcp-chrome-bridge` binary is a native-host REGISTRAR,
# not an MCP server. The actual stdio server is a separate file inside the
# package. Also requires the Chrome extension loaded in a real browser.
# ---------------------------------------------------------------------------
say "mcp-chrome"
npm install -g mcp-chrome-bridge
CHROME_STDIO="$(npm root -g)/mcp-chrome-bridge/dist/mcp/mcp-server-stdio.js"
claude mcp add mcp-chrome -s user -- node "$CHROME_STDIO" || true

# ---------------------------------------------------------------------------
# video-use — a SKILL, not an MCP server. NEEDS KEY (ElevenLabs).
# ---------------------------------------------------------------------------
say "video-use"
if [ ! -d "$MCP_ROOT/video-use" ]; then
  git clone --depth 1 https://github.com/browser-use/video-use.git "$MCP_ROOT/video-use"
  ( cd "$MCP_ROOT/video-use" && uv sync )
fi
mkdir -p "$HOME/.claude/skills"
ln -sfn "$MCP_ROOT/video-use" "$HOME/.claude/skills/video-use"

# ---------------------------------------------------------------------------
# npx-based MCP servers (no local build required)
# ---------------------------------------------------------------------------
say "npx-based MCP servers"
claude mcp add playwright -s user -- npx -y @playwright/mcp@latest || true

# NEEDS KEY
claude mcp add perplexity -s user --env PERPLEXITY_API_KEY=REPLACE_ME \
  -- npx -y @perplexity-ai/mcp-server || true
claude mcp add firecrawl -s user --env FIRECRAWL_API_KEY=REPLACE_ME \
  -- npx -y firecrawl-mcp || true

# 21st.dev — HTTP transport. Reads the key from the environment so the
# credential is never hardcoded in this file or in shell history.
if [ -n "${TWENTYFIRST_API_KEY:-}" ]; then
  claude mcp add --transport http 21st -s user https://21st.dev/api/mcp \
    --header "x-api-key: ${TWENTYFIRST_API_KEY}" || true
else
  echo "  SKIPPED 21st: set TWENTYFIRST_API_KEY and re-run to register it."
fi

say "done — verifying"
claude mcp list
claude plugin list
