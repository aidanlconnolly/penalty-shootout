# Penalty Shoot-out

Best-of-five penalty shoot-out — pick a country, a name, a difficulty, and trade kicks with a CPU keeper / shooter. Win or lose, your points land on a shared leaderboard you can share with friends.

## Run locally

Just open the file:

```bash
open "index.html"
```

Or serve it (matches the Claude Code preview config on port 5300):

```bash
python3 -m http.server 5300
# then visit http://localhost:5300
```

When opened as `file://` or without the `/api/leaderboard` endpoint reachable, scores save to `localStorage` under `penalty_leaderboard_local`.

## Deploy

Push to a Vercel project. The leaderboard requires Vercel KV:

1. In Vercel → Storage → create a new **KV** database, attach it to the project.
2. The env vars `KV_REST_API_URL` and `KV_REST_API_TOKEN` are populated automatically.
3. Push to `main`. The Edge/Node function in `api/leaderboard.js` will service GET/POST.

## Controls

- **Aim**: move mouse over the goal, click to lock target.
- **Accuracy / Power / Curve meters**: click (or press Space) when each meter is in the spot you want. Center accuracy = no error; red power triggers a subtle screen-shake on goal; left curve bends the ball left→right, right curve bends right→left.
- **Defending**: wait for the "DIVE!" prompt, then click where you think the ball is going.

## Scoring

| Difficulty | Win | Loss |
|---|---|---|
| Easy   | +1 | -3 |
| Medium | +2 | -2 |
| Hard   | +3 | -1 |

Matches end early when the deficit can't be overcome (e.g. 3–0 at kick 6). 5–5 goes to golden goal — round-by-round until one team scores and the other doesn't.

## Notes

- No auth on the leaderboard — anyone can POST any name. Treat it as a friend-group toy.
- Names are sanitized server-side (control chars stripped, max 24 chars).
