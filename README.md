# MineMind Arena

Level 4 prototype for a modern Minesweeper web platform.

## Product Features

- Full Minesweeper engine: seeded mines, flood reveal, flags, chording, win/loss states.
- Daily Challenge: deterministic board by date and difficulty.
- AI Coach: explainable probability hints, safe move detection, flag recommendations, risk map.
- Social layer: city-based daily leaderboard with local user placement.
- Retention: profile, city league, game history, win rate, streaks, best score per mode/difficulty.
- Monetization: Upgrade to Pro flow, premium skins, Stripe checkout-ready CTA.
- Mobile play: responsive board, flag mode, long-press flagging, adaptive panels.

## Run

Best option for submission: open `index.html`. It contains HTML, CSS, and JavaScript in one file, so styles and buttons cannot break because of missing paths.


```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Notes

This prototype is intentionally backend-free so it can be reviewed instantly. The persistence, profile, leaderboard and Pro state are stored in LocalStorage. The app is structured so Supabase/Firebase and Stripe can replace those client-side adapters without changing the game loop.

