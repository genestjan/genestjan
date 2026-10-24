#!/usr/bin/env bash
# Builds the app for https://rangersfc.net/app/ and copies it into a checkout of the club website repo.
# Usage: scripts/publish-to-site.sh /path/to/rangersfc-checkout
# Reads VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY from the environment or .env.production
# (all three are public values). With no Supabase values the app runs in on-device mode.
set -euo pipefail
cd "$(dirname "$0")/.."
site="${1:?give the path of the rangersfc website checkout}"
[ -f "$site/CNAME" ] && grep -q rangersfc.net "$site/CNAME" || { echo "That folder is not the rangersfc.net website"; exit 1; }
npm run typecheck
npm test --silent
APP_BASE=/app/ npx vite build
rm -rf "$site/app"
mkdir -p "$site/app"
cp -r dist/. "$site/app/"
rm -f "$site/app/404.html"   # the club site owns the 404 page; the app uses #/ links instead
echo "Copied to $site/app. Commit and push the website repo to publish."
