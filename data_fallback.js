/**
 * Robertson Doctrine — Static Data Fallback
 * Last updated: 2026-05-05
 * 
 * Used when FRED API is unreachable or rate-limited.
 */
const fallbackData = {
  timestamp: "2026-05-05T19:00:00.000Z",
  source: "FRED (Cached Fallback)",
  isFallback: true,
  series: {
    // Abbreviated series for fallback to keep file size small
    headline: [
      { date: "2025-01-01", value: 3.1 }, { date: "2025-02-01", value: 3.2 },
      { date: "2025-03-01", value: 3.5 }, { date: "2025-04-01", value: 3.4 },
      { date: "2025-05-01", value: 3.3 }, { date: "2025-06-01", value: 3.0 },
      { date: "2025-07-01", value: 2.9 }, { date: "2025-08-01", value: 3.2 },
      { date: "2025-09-01", value: 3.7 }, { date: "2025-10-01", value: 3.2 },
      { date: "2025-11-01", value: 3.1 }, { date: "2025-12-01", value: 3.4 },
      { date: "2026-01-01", value: 3.1 }, { date: "2026-02-01", value: 3.2 },
      { date: "2026-03-01", value: 3.32 }
    ],
    core: [
      { date: "2025-01-01", value: 3.9 }, { date: "2025-02-01", value: 3.8 },
      { date: "2025-03-01", value: 3.8 }, { date: "2025-04-01", value: 3.6 },
      { date: "2025-05-01", value: 3.4 }, { date: "2025-06-01", value: 3.3 },
      { date: "2025-07-01", value: 3.2 }, { date: "2025-08-01", value: 3.2 },
      { date: "2025-09-01", value: 3.3 }, { date: "2025-10-01", value: 3.0 },
      { date: "2025-11-01", value: 2.9 }, { date: "2025-12-01", value: 3.9 },
      { date: "2026-01-01", value: 2.8 }, { date: "2026-02-01", value: 2.7 },
      { date: "2026-03-01", value: 2.67 }
    ],
    trimmed: [
      { date: "2025-01-01", value: 3.5 }, { date: "2025-02-01", value: 3.4 },
      { date: "2025-03-01", value: 3.4 }, { date: "2025-04-01", value: 3.2 },
      { date: "2025-05-01", value: 3.1 }, { date: "2025-06-01", value: 3.0 },
      { date: "2025-07-01", value: 2.9 }, { date: "2025-08-01", value: 2.8 },
      { date: "2025-09-01", value: 2.8 }, { date: "2025-10-01", value: 2.7 },
      { date: "2025-11-01", value: 2.6 }, { date: "2025-12-01", value: 2.7 },
      { date: "2026-01-01", value: 2.6 }, { date: "2026-02-01", value: 2.6 },
      { date: "2026-03-01", value: 2.64 }
    ],
    fedfunds: [
      { date: "2025-01-01", value: 5.33 }, { date: "2025-03-01", value: 5.33 },
      { date: "2025-06-01", value: 5.08 }, { date: "2025-09-01", value: 4.83 },
      { date: "2025-12-01", value: 4.33 }, { date: "2026-01-01", value: 4.33 },
      { date: "2026-02-01", value: 4.08 }, { date: "2026-03-01", value: 3.83 },
      { date: "2026-04-01", value: 3.64 }
    ]
  },
  latest: {
    trimmedMean: { date: "2026-03-01", value: 2.64 },
    headlineCPI: { date: "2026-03-01", value: 3.32 },
    coreCPI: { date: "2026-03-01", value: 2.67 },
    fedFunds: { date: "2026-04-01", value: 3.64 }
  }
};

module.exports = fallbackData;
