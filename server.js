// Load .env if present
const fs = require('fs');
if (fs.existsSync('.env')) {
    const env = fs.readFileSync('.env', 'utf8');
    env.split('\n').forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value.length > 0) {
            process.env[key.trim()] = value.join('=').trim();
        }
    });
}

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const { version } = require('./package.json');
const fallbackData = require('./data_fallback');

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
 * Includes retry logic with exponential backoff to handle "socket hang up"
 */
async function fetchFredCSV(seriesId, startDate = '2014-01-01', retries = 3) {
    const params = new URLSearchParams({ id: seriesId, cosd: startDate, fq: 'Monthly' });
    if (FRED_API_KEY) params.set('api_key', FRED_API_KEY);
    const url = `${FRED_BASE}?${params}`;
    
    const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`[FRED] Fetching ${seriesId} (Attempt ${attempt}/${retries})...`);
            const resp = await fetch(url, {
                headers: {
                    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
                    'Accept': 'text/csv'
                },
                timeout: 30000 // 30s timeout
            });

            if (!resp.ok) {
                if (resp.status === 429 || resp.status >= 500) {
                    throw new Error(`HTTP ${resp.status}`);
                }
                throw new Error(`FRED fetch failed for ${seriesId}: ${resp.status}`);
            }

            const text = await resp.text();
            const lines = text.trim().split('\n');
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
            if (data.length === 0) throw new Error(`No valid data parsed for ${seriesId}`);
            console.log(`[FRED] ${seriesId}: ${data.length} observations loaded (${data[0]?.date} to ${data[data.length-1]?.date})`);
            return data;

        } catch (err) {
            console.warn(`[FRED] Attempt ${attempt} failed for ${seriesId}: ${err.message}`);
            if (attempt === retries) throw err;
            // Exponential backoff: 1s, 2s, 4s...
            const delay = Math.pow(2, attempt - 1) * 1000 + (Math.random() * 500);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
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
        // Fetch series sequentially to avoid triggering rate limits or "socket hang up"
        const cpiLevels = await fetchFredCSV('CPIAUCSL', '2013-01-01');
        await new Promise(resolve => setTimeout(resolve, 300)); // Small pause
        const coreLevels = await fetchFredCSV('CPILFESL', '2013-01-01');
        await new Promise(resolve => setTimeout(resolve, 300));
        const trimmedYoY = await fetchFredCSV('TRMMEANCPIM159SFRBCLE', '2014-01-01');
        await new Promise(resolve => setTimeout(resolve, 300));
        const fedfunds = await fetchFredCSV('FEDFUNDS', '2014-01-01');

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
        console.error('[ERROR] Failed to fetch live FRED data:', err.message);
        
        // Return cached data if available, even if stale
        if (dataCache) {
            console.log('[CACHE] Returning stale cached data due to fetch error');
            return dataCache;
        }

        // Return hardcoded fallback as absolute last resort
        console.warn('[FALLBACK] Serving hardcoded data fallback');
        return {
            ...fallbackData,
            timestamp: new Date().toISOString(),
            isOffline: true
        };
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
