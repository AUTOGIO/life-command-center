# Life Command Center

Personal life OS for Eduardo Giovannini — deployed at [life.giovannini.us](https://life.giovannini.us)

A single-page command center for managing daily schedule, physical habits, kite/weather conditions, AI project sessions, and weekly review. Zero backend. Zero dependencies. Opens in one browser tab.

---

## Features

### Today View
- **Nudge Bar** — context-aware message that changes throughout the day based on current time block, conditions, and habit status
- **Conditions Widget** — live wind data from [Open-Meteo](https://open-meteo.com) for João Pessoa, Paraíba coast. Shows wind speed, direction, tide estimate, and a GO KITE / GYM DAY decision badge
- **Today's Schedule** — fixed daily blocks (07:00–23:00) with the current block highlighted. Below it, a simulated Google Calendar section shows realistic daily events per calendar
- **Status Panel** — shoulder recovery countdown (tap −1 day to decrement), kite repair status toggle, mood selector
- **Habits** — 4 tracked habits (Gym, Kitesurfing, Muay Thai, Dog Training). Tap to mark done. Streak tracking. 28-day heatmap
- **AI Projects** — prioritized project list (🔴/🟡/🟢). Start a session timer per project. Add/remove projects
- **Notes** — daily reflection textarea, auto-saves to memory during session

### Week View
- **KPIs** — habit completion %, total AI session hours, best streak, kite day count
- **Habit Trends** — per-habit completion bars (% of 7 days) + daily score heatmap
- **AI Project Hours** — bar chart per day showing session time
- **Kite vs Gym donut** — visual split with contextual note about wind season
- **Week Summary** — plain-language narrative across Physical, AI Work, and Habits

---

## Stack

| Layer | Tech |
|---|---|
| Markup | Vanilla HTML5 |
| Styles | Vanilla CSS (custom properties, grid, clamp) |
| Logic | Vanilla JavaScript (ES2022, no frameworks) |
| Fonts | [Cabinet Grotesk](https://www.fontshare.com/fonts/cabinet-grotesk) + [Satoshi](https://www.fontshare.com/fonts/satoshi) via Fontshare |
| Weather | [Open-Meteo API](https://open-meteo.com) — free, no key required |
| Tide | Harmonic model (semi-diurnal, João Pessoa) |
| Hosting | Cloudflare Pages → `life.giovannini.us` |

No build step. No npm. No frameworks. Open `index.html` in a browser and it runs.

---

## File Structure

```
life-command-center/
├── index.html   # Full markup — nudge bar, header, today/week panels, modals
├── style.css    # Design tokens, layout, all component styles (dark + light mode)
└── app.js       # All logic — state, clock, schedule, habits, weather, projects, weekly review
```

---

## Running Locally

```bash
# Any static server works. Examples:
npx serve .
python3 -m http.server 8080
```

Or just open `index.html` directly in Safari/Chrome.

---

## Customising

### Change your kite spot
Click the ⚙️ settings button (bottom right) and update the latitude/longitude. Default: João Pessoa, Paraíba (`-7.115, -34.863`).

### Change minimum wind threshold
Settings → "Min wind for kitesurfing". Default: 18 km/h.

### Update shoulder recovery days
Settings → "Shoulder recovery". Decrement daily via the Status card's −1 day button.

### Mark kites as ready
Status card → "Mark ready" button, or Settings → Kite status → Ready.

### Add AI projects
Projects panel → `+` button. Set name and priority. Hit ▶ to start a session timer.

### Simulated Google Calendar events
Edit the `buildGCalEvents()` function in `app.js` to match your real schedule. Each event has `title`, `start`, `end`, `cal`, and `color` fields.

---

## Deploying to Cloudflare Pages

1. Push this repo to GitHub (you're doing that now)
2. Go to [Cloudflare Pages](https://pages.cloudflare.com) → Create a project → Connect to Git
3. Select this repo — build command: _(leave empty)_, output directory: `.`
4. Add a custom domain: `life.giovannini.us`
5. Done. Every `git push` to `main` auto-deploys.

---

## Roadmap

- [ ] Real Google Calendar OAuth sync (requires a backend or Cloudflare Worker)
- [ ] Persistent habit history via Cloudflare KV or D1
- [ ] Wind sensor integration (real-time from local station near João Pessoa)
- [ ] Weekly email/WhatsApp summary via Cloudflare cron + Workers
- [ ] Muay Thai class schedule integration

---

## License

Personal use. Not intended for redistribution.
