# Marketing toolkit benchmark

Checked 16 November 2026. Stars, licences and last push dates were read from
GitHub on that date. Use this before building any marketing feature from
scratch (see CLAUDE.md).

## Installed in this repo (no login, key or payment)

See `.claude/skills/README.md`: `social`, `ad-creative`, `ads`,
`reels-script`, `hook-writer`, `content-calendar`, `facebook-strategy`,
`caption-writer`, `gsap-core`, `gsap-timeline`, `motion-design`.

## Worth adding, free, but needs a login or a local install

| Tool | What it does | Licence | Needs |
|---|---|---|---|
| Official Meta Ads MCP (`claude mcp add --transport http meta-ads https://mcp.facebook.com/ads`) | Ads reporting, create and edit campaigns | Meta service, free open beta | Facebook Business login. It can edit live ads, so use with care |
| Canva connector | Generate, edit, resize and export designs | Canva service | Canva login (already connected in claude.ai) |
| heygen-com/hyperframes | HTML to MP4 video, good for logo stings and countdowns | Apache-2.0 | Node 22 and FFmpeg |
| remotion-dev/remotion | React to video | Remotion licence: free for individuals and teams up to 3 | Node |
| greensock/GSAP | Animation library | Free for commercial use (custom licence) | None |
| visioncortex/vtracer | Raster logo to layered SVG | MIT | `pip install vtracer` |
| SYSTRAN/faster-whisper, chidiwilliams/buzz | Local transcription for captions | MIT | Local install. Whisper supports Tagalog, not Cebuano |
| WyattBlue/auto-editor | Cuts silences from interviews | Unlicense | Local install |
| gpxstudio/gpx.studio | GPX editor and elevation profile for course maps | MIT | Browser only |
| gpx-animator/gpx-animator | Animated route video from a GPX file | Apache-2.0 | Java |
| taylorwilsdon/google_workspace_mcp | Sheets, Docs, Drive, Forms | MIT | Free Google Cloud OAuth client |

## Looked at and not recommended

| Tool | Why not |
|---|---|
| gitroomhq/postiz-app (AGPL-3.0) | Good open-source scheduler, but needs a server and a Meta app. Meta Business Suite schedules Facebook and Instagram for free |
| inovector/mixpost | Free edition has no Instagram |
| pipeboard-co/meta-ads-mcp | Source-available (BSL-1.1). The official Meta MCP covers it |
| irinabuht12-oss marketing skills and MCP | No licence file on the skills. The MCP fronts a paid service (about US$89 a month) |
| remotion-dev/skills | No licence detected, so not vendored |
| Strava MCP servers | Strava's API terms restrict showing other people's data. Use only on your own account |
| Ad Library scrapers | Fragile and outside Meta's terms. Use the Ad Library website by hand |
| pretix, Hi.Events, OpenSplitTime | Registration and timing platforms. Overkill for marketing work |

No maintained open-source project was found for bib or finisher-photo
generators, race countdowns, or race marketing playbooks.
