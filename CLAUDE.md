# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Run locally

The game is a single self-contained HTML file with no build step:

```bash
open index.html                  # open directly in browser (file://)
python3 -m http.server 5300      # OR serve, matches the workspace preview config on port 5300
```

When opened from `file://` or without `/api/leaderboard` reachable, the leaderboard transparently falls back to `localStorage` (key `ps_lb`). No Node/npm required for local play.

## Deploy

Vercel project, pushed via GitHub auto-deploy. The leaderboard endpoint requires a Vercel KV database to be attached to the project — Vercel injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically, which `@vercel/kv` reads.

## Architecture

**Two-file mirror.** `index.html` is the source of truth. `public/index.html` must be an exact byte-for-byte copy — Vercel serves the `public/` version. After editing `index.html`, always:

```bash
cp index.html public/index.html
```

This duplication is intentional: `open index.html` works locally because the file sits at the repo root, while Vercel's static-hosting layout expects assets in `public/`.

**Single-file game (`index.html`).** All HTML, CSS, and JS in one file. The scene is a single inline SVG with `viewBox="0 0 800 450"` and `preserveAspectRatio="xMidYMid slice"` covering the whole viewport — stadium, stands, advertising boards, grass, pitch markings, 3D goal, keeper, and ball are all drawn in that one SVG so coordinates compose cleanly. HUD/banner/power meter/dive hint/setup screen are HTML overlays positioned absolutely on top.

**Coordinate constants (in the JS block).** Always work in SVG units:

- `GF = {x:140, y:85, w:520, h:263}` — front face of the goal. Anything inside this rect with a ball-radius margin counts as "on target".
- `BALL_R = 17` — used for the "ball fully inside posts" check.
- `SPOT = {x:400, y:412}` — penalty spot, ball start position.
- `KBASE = {x:400, y:252}` — keeper's base position.

**Keeper transform (critical, non-obvious).** The keeper is wrapped in two groups:

```html
<g id="keeperWrap" transform="translate(400 252)">    <!-- SVG attr: base position -->
  <g id="keeper">                                      <!-- CSS transform: DELTA only -->
    ...sprite children at coords relative to (0,0)...
  </g>
</g>
```

The wrapper holds the base via the SVG `transform` attribute. The inner `#keeper` receives only the *delta* through `style.transform` (set by `setKeeperDelta(kx, ky, instant)`). This separation exists because setting `style.transform` on an SVG element **replaces** the SVG `transform` attribute — putting both on the same element causes the keeper to teleport to (delta, delta) in raw SVG space instead of (KBASE + delta). Any future keeper movement code must keep using the wrapper pattern.

`setKeeperDelta(kx, ky, instant=false)` toggles `transition: none` (force reflow) for drag-following and restores the CSS transition for AI dives. `resetKeeper()` clears both.

**State machine.** Single `S` object built by `mkState()`, reset at match start. The `S.phase` field drives event-handler gating:

```
setup → shoot_aim → shoot_pow → animating → (resetRound) → nextTurn
                                          ↘ (CPU turn) ↗
                  keep_wait → keep_dive → animating_keep → (resetRound)
```

The global `#app` click handler is a no-op unless `S.phase === 'shoot_pow'`. `S.phase === 'keep_dive'` enables the drag handlers attached to the scene SVG. `setKeeperDelta` only fires in valid phases. Any new interactivity should gate on `S.phase` the same way.

**Match end conditions** (in `matchOver()`): early-exit when the deficit can't be overcome (e.g. 3–0 at kick 6), normal end after both teams take 5, and golden-goal continuation when 5–5 (`S.golden = true`, then resolves whenever a pair of kicks differs).

**Leaderboard fallback.** `submitScore` tries `fetch('/api/leaderboard', { signal: AbortSignal.timeout(4000) })` with a 4-second timeout, then *always* writes to `localStorage` regardless of outcome. `fetchLB` mirrors this. The 4s timeout is what prevents the result screen from hanging when the endpoint is unreachable — don't remove it.

**Difficulty profile (`DCFG`).** Single source of truth for meter speed, AI keeper skill, CPU shooter accuracy, dive countdown window, and win/loss point values per difficulty. Win points are inverse to loss penalty (`easy: +1/-3`, `hard: +3/-1`) so playing on hard is high-risk/high-reward.

**Leaderboard API (`api/leaderboard.js`).** Vercel Node serverless function backed by Vercel KV (Upstash Redis). `GET` reads sorted set `penalty:points` (top 50) and joins game counts from hash `penalty:games`. `POST` does atomic `zincrby` + `hincrby`. Names sanitised to 24 chars, control chars stripped. No auth — friend-group toy.
