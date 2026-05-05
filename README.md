# The Robertson Doctrine

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/21e8-miner/robertson-doctrine)

> **Interactive monetary policy analysis dashboard** — live FRED data, Trimmed Mean CPI vs. Headline vs. Core, Taylor Rule calculator, and FOMC decision simulator.

Based on George Robertson's May 5, 2026 analysis advocating for rules-based, data-driven monetary policy under a Warsh Fed.

![Hero Screenshot](docs/screenshots/hero.png)

---

## Live Data

All charts and statistics are powered by **real-time data fetched directly from FRED** (Federal Reserve Economic Data, St. Louis Fed). No API key required.

| Series | FRED ID | Description |
|--------|---------|-------------|
| 16% Trimmed Mean CPI | `TRMMEANCPIM159SFRBCLE` | Year-over-year %, seasonally adjusted |
| Headline CPI | `CPIAUCSL` | CPI-U all items index (YoY computed) |
| Core CPI | `CPILFESL` | CPI-U less food & energy (YoY computed) |
| Fed Funds Rate | `FEDFUNDS` | Effective federal funds rate, monthly avg |

Data is cached server-side for 1 hour and auto-refreshes on the frontend every 30 minutes.

---

## Features

### 📊 Chapter 1 — Inflation Chart
- Full 2014–2026 long view, 2022–2026 zoom, and 2025–2026 close-up
- Toggle Fed Funds Rate as an overlay
- Click legend items to show/hide individual series
- Interactive crosshair tooltip with all three series values

### 📉 Chapter 1b — Headline–Trimmed Mean Spread
- Bar chart showing the gap between headline and trimmed mean CPI
- Green = positive spread (transitory shocks inflating headline → room to cut)
- Red = negative spread (broad-based price pressure)
- Dynamic insight box updates with live spread computation

### 🃏 Chapter 2 — Doctrine Cards
- Flip cards comparing Neo-Wicksellian doctrine vs. Warsh's reactionary function
- Click any card to reveal the counterargument

### 🧮 Chapter 3 — Taylor Rule Calculator
- Pre-populated with live trimmed mean CPI from FRED
- Classic Taylor (1993), Yellen Balanced (2015), and Warsh Aggressive variants
- Shows prescribed rate vs. actual Fed Funds (live gap computation)
- Adjustable: π, π*, output gap, r*

### 🪙 Chapter 4 — FOMC Coin Flip Simulator
- Animates each FOMC meeting as a purely data-dependent coin toss
- Tracks past decisions (cut/hold) across the 2026 meeting calendar

### ⚖️ Chapter 5 — Steel-Man / Straw-Man
- Balanced strengths and limitations of the Robertson/Warsh framework

---

## Quick Start

```bash
# Clone the repo
git clone https://github.com/your-username/robertson-doctrine.git
cd robertson-doctrine

# Install dependencies
npm install

# Start the server
npm start
```

Open **http://localhost:8420** in your browser.

### Development (auto-restart on file changes)

```bash
npm run dev
```

> Requires Node.js 18+. Uses the built-in `--watch` flag — no nodemon needed.

---

## Configuration

Copy `.env.example` to `.env` and edit as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8420` | HTTP server port |
| `CACHE_TTL_MS` | `3600000` | Server-side FRED cache TTL (ms) |
| `FRED_API_KEY` | *(none)* | Optional — higher rate limits from FRED |

A FRED API key is **not required** — the dashboard uses the public CSV download endpoint. A key only helps if you expect very high traffic.

Get a free key at [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html).

---

## Project Structure

```
robertson-doctrine/
├── server.js           # Express server — fetches & caches FRED data
├── public/
│   ├── index.html      # Single-page app structure
│   ├── style.css       # Design system (dark mode, CSS variables)
│   └── app.js          # Client-side data fetch, charts, interactivity
├── .env.example        # Environment variable template
├── package.json
├── LICENSE             # MIT
└── README.md
```

### API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/data` | All FRED series + computed YoY values + latest figures |
| `GET /api/health` | Server health, cache status, cache age |

**`/api/data` response shape:**
```json
{
  "timestamp": "2026-05-05T21:47:00.000Z",
  "source": "FRED (Federal Reserve Economic Data)",
  "series": {
    "headline": [{ "date": "2014-01-01", "value": 1.58 }, ...],
    "core":     [{ "date": "2014-01-01", "value": 1.59 }, ...],
    "trimmed":  [{ "date": "2014-01-01", "value": 2.01 }, ...],
    "fedfunds": [{ "date": "2014-01-01", "value": 0.07 }, ...]
  },
  "latest": {
    "trimmedMean":  { "date": "2026-03-01", "value": 2.64 },
    "headlineCPI":  { "date": "2026-03-01", "value": 3.32 },
    "coreCPI":      { "date": "2026-03-01", "value": 2.67 },
    "fedFunds":     { "date": "2026-04-01", "value": 3.64 }
  },
  "meta": { ... }
}
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js 18+ · Express 5 |
| Data | FRED public CSV API (St. Louis Fed) |
| Charts | Chart.js 4.4 + chartjs-adapter-date-fns |
| Fonts | Google Fonts — Inter · JetBrains Mono |
| Frontend | Vanilla HTML + CSS + JS (zero build step) |

---

## The Robertson Thesis

> *"Inflation expectations is something invented post GFC by the Neo-Wicksell Fed doxology. Warsh will return the Fed to reactionary function, dropping Fed Funds quickly to 3%. The CPI Trimmed Mean is not a ruse but the best inflation gauge."*
>
> — George Robertson, May 5, 2026

The 16% trimmed mean CPI (Cleveland Fed) strips the highest and lowest 8% of components by monthly price change — removing pandemic-era outliers, energy spikes, and used car distortions symmetrically, without the *ad hoc* fixed exclusions of "core." Empirical research from the Dallas and Cleveland Feds confirms it has a higher signal-to-noise ratio for underlying trend inflation than either headline or core.

With trimmed mean at **2.6%** (Mar 2026) vs. headline **3.3%**, Robertson argues the Fed has meaningful room to ease toward a neutral rate of ~3%.

---

## Data Sources & Citations

- **Cleveland Fed** — [16% Trimmed-Mean CPI](https://www.clevelandfed.org/indicators-and-data/median-cpi)
- **BLS** — [Consumer Price Index (CPI-U)](https://www.bls.gov/cpi/)
- **FRED / St. Louis Fed**:
  - [`TRMMEANCPIM159SFRBCLE`](https://fred.stlouisfed.org/series/TRMMEANCPIM159SFRBCLE)
  - [`CPIAUCSL`](https://fred.stlouisfed.org/series/CPIAUCSL)
  - [`CPILFESL`](https://fred.stlouisfed.org/series/CPILFESL)
  - [`FEDFUNDS`](https://fred.stlouisfed.org/series/FEDFUNDS)

> **Not investment advice.** This dashboard is for educational and research purposes only.

---

## License

[MIT](LICENSE) © 2026 Robertson Doctrine Project
