# southside of manavgat

Community website for the hotel coast from Gündoğdu to Side. German interface, responsive desktop/mobile layout. Next.js + React + TypeScript + Leaflet, deployed on Vercel.

## Features

- Community Dolmuş routes: draw ordered points on a real OpenStreetMap, name stops, edit routes, approximate start/end and interval, weekdays, overnight service, season, fare, observed date and evidence link.
- Individual shareable hotel profiles (`/#hotel/id`), recommendations and non-recommendations, written reviews, total/food/room/beach scores and visit month. Browser-owned reviews can be updated.
- Bazaar directory: weekdays, approximate hours, notes, source and observation date. Links to community lines in the same town (not a route planner).
- Search, town filters, local favorites, share links, edit history, private error reports, moderator dashboard.
- No fabricated ratings or real-world transport schedules. Empty route/bazaar directories are intentional. Illustrations are not hotel photos. All community data is labeled unverified.

## Run

Node 22+ recommended.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

Copy `.env.example` to `.env.local` and set values through Vercel's environment settings for deployments. Never commit `.env.local` or tokens.

## Vercel configuration

- Framework: Next.js. Build: `npm run build`. Default output directory.
- Connected private Blob store: `southside-community`, Frankfurt. Its provisioning injects `BLOB_READ_WRITE_TOKEN`.
- `SESSION_SECRET`: cryptographically random, >=32 characters; stable across deployments. Changing it invalidates guest identities.
- Optional `ADMIN_SECRET`: a different random >=32-character value set privately in Vercel. Open `/#moderation` and enter it to read/resolve reports and remove contributions. The key is kept in component memory, never localStorage. Do not disclose it in repository, screenshots or URLs. Set this before inviting contributors.
- Standard Vercel Git integration can deploy `main` from `laendspotter/southsideofmanavgat` automatically.

## Persistence and concurrency

This first small-community release stores the structured dataset as a **private, versioned JSON snapshot in Vercel Blob**, not in browser storage. State includes routes, hotels, reviews, bazaars, reports and history. Every write brackets an uncached data read with storage API `head()` revision reads and uses that authoritative ETag with `ifMatch` for atomic compare-and-swap. Delivery HTTP ETags can differ from storage revision tags and are not used for writes. Competing writes retry up to four times, preserving concurrent changes. Entity timestamps detect stale edit forms and return HTTP 409 rather than silently overwriting a newer edit. Client success is shown only after the shared write completes. A deterministic initial pathname is created without overwrite to handle simultaneous first writes.

This is intentionally a bounded small-community implementation, not a relational database. Limits: 500 items per directory, 2,000 reviews, 2,000 reports, latest 2,000 history entries. Full snapshot reads/writes mean higher cost and latency with growth. Before scaling beyond a small community, migrate `lib/store.ts` to Postgres (Neon/Supabase); domain validation in `lib/model.ts` is independent. Back up the private snapshot before any migration. Do not expose the Blob token to visitors.

## Identity, trust and moderation

Contributions use a signed HttpOnly, SameSite=Strict, one-year browser cookie. This is **anonymous guest identity**, not account authentication or verified stays. One review per guest identity per hotel is enforced server-side. Clearing cookies or switching devices creates a new identity; there is no cross-device login. The UI explicitly states these limits. Do not interpret recommendation percentages as independently verified facts.

POST requests require same-origin headers, validate all data with Zod and enforce a 32KB request body limit. Per-hour, persisted abuse limits (30 successful writes per IP hash) are checked inside the same optimistic update. Hashes expire after an hour and raw IP addresses are not stored by the app. Displayed text is React-escaped and map tooltips use textContent. Only HTTP(S) evidence URLs are accepted. Route coordinates are constrained to the region.

Reports are never in the public API. Moderator requests are authorized server-side using constant-time key comparison. Deleted entries and their earlier versions are hidden from the public history. Private snapshot history retains bounded versions for recovery; operator deletion requests must also remove private history/backups when appropriate. Reports are not automatically resolved by deletion: resolve each after investigation.

Public writes are anonymous and rate-limited, not spam-proof. Before a broad launch add managed login/CAPTCHA, stronger moderation workflows, pagination and dedicated rate limiting. No fake `verified` badges are shown.

## Map and regional content

Map data © OpenStreetMap contributors, https://www.openstreetmap.org/copyright. Tiles are loaded on demand from the standard OpenStreetMap server. Follow https://operations.osmfoundation.org/policies/tiles/ ; use a suitable tile provider before high traffic. There is no offline tile download or tracking. Lines are straight segments between user-defined points; no road-snapping, live arrivals or guaranteed departures.

The hotel catalogue now contains 128 source-linked profiles covering Gündoğdu, Çolaklı, Evrenseki, Kumköy, Ilıca and Side. Ilıca is kept as its own filter because the association directory uses this district name. No external guest ratings, star classifications or hotel photographs are copied.

Primary factual directory sources (checked 2026-11-02):

- MASTOB member directory: https://mastob.com.tr/uyelerimiz
- MATOB regional directories: https://www.matob.org/otellerimiz/colakli/ , https://www.matob.org/otellerimiz/gundogdu/ , https://www.matob.org/otellerimiz/evrenseki/ , https://www.matob.org/otellerimiz/side/
- Individual hotel websites linked in `lib/hotels.json` for supplementary profiles.

Names and district information are source-linked factual catalogue entries, not verification of current hotel operations. This is an expandable directory, not a claim of complete coverage. Existing community corrections and reviews take precedence over catalogue defaults. `mergeCatalog()` adds missing profiles to already-saved data; updating `initialState()` alone would not update the deployed snapshot. Moderator removals have persistent tombstones so imports cannot resurrect deleted profiles.

The refreshed interface removes decorative Unicode glyphs that iOS rendered as colored emojis, replacing them with Lucide SVG icons. Hotel cards are compact text-and-icon records rather than invented hotel illustrations. Search ignores accents and dotless Turkish ı, region counts are dynamic, and the directory loads 24 records at a time.

## Operator setup before a public launch

The in-app privacy/about dialog explains cookies, local favorites, public contributions, IP hashing and OSM tile requests. The operator still needs to add their actual identity/contact information and appropriate legal disclosures, set the moderator key, and review hosting access. Vercel's default deployment protection may require sign-in for visitors; public access must be deliberately configured in project settings.

## Verification

`npm test` covers overnight schedules, bad geographic/time values, stale edit rejection, revision history, ownership visibility, moderation authorization, report privacy, deletion redaction, rate limiting and unsafe URLs. `npm run typecheck` and `npm run build` validate the application. Full hosted browser/storage checks are separate from unit tests. `scripts/verify-hosted.py` checks shared writes, edits, stale conflicts, reviews, routes, bazaars and moderation against the deployed site; it receives its moderator key over hidden stdin and removes its temporary records.
