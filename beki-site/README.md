# Beki Eakins draft website

Served at https://genestjanramirez.com/BekiEakinsdraftwebsite/ (noindex). The deploy
(`.github/workflows/pages.yml`) runs `python beki-site/build.py` with `BEKI_OUT=out/BekiEakinsdraftwebsite`.

- Words, pictures and the order of home page sections: `content/*.yml`, edited in the dashboard at
  `/BekiEakinsdraftwebsite/admin/` (Sveltia CMS, sign in with a GitHub token). Each Publish commits here
  and the site rebuilds in about two minutes.
- Layout and animation: `build.py`, `assets/beki.css`, `assets/beki.js`. If a dashboard edit breaks the
  build, the deploy fails and the site stays on the last good version.
- Genie (dbf.bekieakins.com/draftwebsite) shows this site in a frame, so it updates too.
