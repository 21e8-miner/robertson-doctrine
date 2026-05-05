// Load .env if present (dev convenience — not required in production)
try { require('fs').existsSync('.env') && require('child_process').execSync(''); } catch (_) {}
if (require('fs').existsSync('.env')) {
    const lines = require('fs').readFileSync('.env', 'utf8').split('\n');
    for (const line of lines) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
    }
}

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const { version } = require('./package.json');

const app = express();
const PORT = parseInt(process.env.PORT || '8420', 10);

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// ===================== FRED DATA FETCHER =====================
// Uses FRED's public observation download endpoint (no API key needed for CSV)
const FRED_BASE = 'https://fred.stlouisfed.org/graph/fredgraph.csv';

// Cache with 1-hour TTL
let dataCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = parseInt(process.env.CACHE_TTL_MS || String(60 * 60 * 1000), 10);
const FRED_API_KEY = process.env.FRED_API_KEY || null;

/**
 * Fetch a FRED series as CSV and parse into {date, value} array
 */
async function fetchFredCSV(seriesId, startDate = '2014-01-01') {
    const params = new URLSearchParams({ id: seriesId, cosd: startDate, fq: 'Monthly' });
    if (FRED_API_KEY) params.set('api_key', FRED_API_KEY);
    const url = `${FRED_BASE}?${params}`;
    console.log(`[FRED] Fetching ${seriesId}...`);
    const resp = await fetch(url, {
        headers: {
            'User-Agent': 'RobertsonDoctrine/1.0 (Fed Analysis Dashboard)',
            'Accept': 'text/csv'
        }
    });
    if (!resp.ok) throw new Error(`FRED fetch failed for ${seriesId}: ${resp.status}`);
    const text = await resp.text();
    const lines = text.trim().split('\n');
    const header = lines[0];
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 2) {
            const date = parts[0].trim();
            const val = parseFloat(parts[1].trim());
            if (!isNaN(val) && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                data.push({ date, value: val });
            }
        }
    }
    console.log(`[FRED] ${seriesId}: ${data.length} observations loaded (${data[0]?.date} to ${data[data.length-1]?.date})`);
    return data;
}

/**
 * Compute YoY percent change from a level series
 * For each month, find the value 12 months ago and compute ((current/prior) - 1) * 100
 */
function computeYoY(levelData) {
    const byDate = {};
    for (const d of levelData) {
        const key = d.date.slice(0, 7); // YYYY-MM
        byDate[key] = d.value;
    }
    const results = [];
    for (const d of levelData) {
        const curDate = new Date(d.date);
        const priorDate = new Date(curDate);
        priorDate.setFullYear(priorDate.getFullYear() - 1);
        const priorKey = `${priorDate.getFullYear()}-${String(priorDate.getMonth() + 1).padStart(2, '0')}`;
        if (byDate[priorKey] !== undefined && byDate[priorKey] > 0) {
            const yoy = ((d.value / byDate[priorKey]) - 1) * 100;
            results.push({ date: d.date, value: parseFloat(yoy.toFixed(2)) });
        }
    }
    return results;
}

/**
 * Fetch all data series and compute derived metrics
 */
async function fetchAllData() {
    const now = Date.now();
    if (dataCache && (now - cacheTimestamp) < CACHE_TTL) {
        console.log('[CACHE] Returning cached data');
        return dataCache;
    }

    try {
        // Fetch all series in parallel
        const [cpiLevels, coreLevels, trimmedYoY, fedfunds] = await Promise.all([
            fetchFredCSV('CPIAUCSL', '2013-01-01'),      // Headline CPI (level index)
            fetchFredCSV('CPILFESL', '2013-01-01'),       // Core CPI (level index)
            fetchFredCSV('TRMMEANCPIM159SFRBCLE', '2014-01-01'), // 16% Trimmed Mean (already YoY %)
            fetchFredCSV('FEDFUNDS', '2014-01-01')        // Fed Funds Rate (%)
        ]);

        // Compute YoY from level indices
        const headlineYoY = computeYoY(cpiLevels);
        const coreYoY = computeYoY(coreLevels);

        // Get latest values
        const latestTrimmed = trimmedYoY[trimmedYoY.length - 1];
        const latestHeadline = headlineYoY[headlineYoY.length - 1];
        const latestCore = coreYoY[coreYoY.length - 1];
        const latestFF = fedfunds[fedfunds.length - 1];

        const result = {
            timestamp: new Date().toISOString(),
            source: 'FRED (Federal Reserve Economic Data)',
            series: {
                headline: headlineYoY.filter(d => d.date >= '2014-01-01'),
                core: coreYoY.filter(d => d.date >= '2014-01-01'),
                trimmed: trimmedYoY,
                fedfunds: fedfunds
            },
            latest: {
                trimmedMean: latestTrimmed ? { date: latestTrimmed.date, value: latestTrimmed.value } : null,
                headlineCPI: latestHeadline ? { date: latestHeadline.date, value: latestHeadline.value } : null,
                coreCPI: latestCore ? { date: latestCore.date, value: latestCore.value } : null,
                fedFunds: latestFF ? { date: latestFF.date, value: latestFF.value } : null
            },
            meta: {
                headlineCount: headlineYoY.length,
                coreCount: coreYoY.length,
                trimmedCount: trimmedYoY.length,
                fedfundsCount: fedfunds.length,
                fredSeries: {
                    headline: 'CPIAUCSL (YoY computed)',
                    core: 'CPILFESL (YoY computed)',
                    trimmed: 'TRMMEANCPIM159SFRBCLE',
                    fedfunds: 'FEDFUNDS'
                }
            }
        };

        dataCache = result;
        cacheTimestamp = now;
        console.log(`[DATA] All series loaded. Latest trimmed mean: ${latestTrimmed?.value}% (${latestTrimmed?.date}), Fed Funds: ${latestFF?.value}% (${latestFF?.date})`);
        return result;

    } catch (err) {
        console.error('[ERROR] Failed to fetch FRED data:', err.message);
        // Return cached data if available, even if stale
        if (dataCache) {
            console.log('[CACHE] Returning stale cached data due to fetch error');
            return dataCache;
        }
        throw err;
    }
}

// ===================== API ROUTES =====================

app.get('/api/data', async (req, res) => {
    try {
        const data = await fetchAllData();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        cached: !!dataCache, 
        cacheAge: dataCache ? Math.round((Date.now() - cacheTimestamp) / 1000) + 's' : null,
        port: PORT
    });
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===================== START SERVER =====================
const server = app.listen(PORT, () => {
    console.log(`\n╔════════════════════════════════════════════╗`);
    console.log(`║  Robertson Doctrine v${version} — Fed Analysis  ║`);
    console.log(`║  http://localhost:${PORT}                    ║`);
    console.log(`║  FRED data · Cache TTL: ${Math.round(CACHE_TTL/60000)}min             ║`);
    if (FRED_API_KEY) console.log(`║  ✓ FRED API key configured                 ║`);
    console.log(`╚════════════════════════════════════════════╝\n`);
    
    // Pre-warm cache
    fetchAllData().then(() => {
        console.log('[INIT] Data cache pre-warmed successfully');
    }).catch(err => {
        console.error('[INIT] Cache pre-warm failed (will retry on first request):', err.message);
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] SIGTERM received — closing server');
    server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
    console.log('[SHUTDOWN] SIGINT received — closing server');
    server.close(() => process.exit(0));
});
