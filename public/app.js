/* ===================== ROBERTSON DOCTRINE — APP.JS ===================== */
/* Real-time FRED data integration + WSJ Professional Theme */

let liveData = null;
let chartInstance = null;
let spreadChartInstance = null;
let currentView = 'long';
let showFedFunds = false;

const CHART_COLORS = {
    trimmed: '#003366',    // WSJ Navy
    headline: '#cc0000',   // WSJ Red
    core: '#666666',       // WSJ Grey
    fedfunds: '#006a9d',   // Financial Blue
    grid: '#e0e0e0',
    text: '#1a1a1a',
    textMuted: '#666666'
};

// ==================== DATA FETCHING ====================
async function fetchLiveData() {
    const statusEl = document.getElementById('live-status');
    const dotEl = document.querySelector('.live-dot');
    const tsEl = document.getElementById('live-ts');
    const barEl = document.getElementById('live-bar');
    
    try {
        statusEl.textContent = 'Fetching live FRED data…';
        const resp = await fetch('/api/data');
        if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
        const data = await resp.json();
        liveData = data;
        
        if (data.isOffline) {
            statusEl.textContent = 'OFFLINE / Fallback Data';
            dotEl.style.background = '#f59e0b'; // orange
            if (barEl) barEl.style.borderBottomColor = '#f59e0b';
        } else {
            statusEl.textContent = 'Live FRED Data Active';
            dotEl.style.background = '#10b981'; // green
            if (barEl) barEl.style.borderBottomColor = 'var(--border)';
        }

        tsEl.textContent = `Last update: ${new Date(data.timestamp).toLocaleTimeString()}`;
        
        populateTickers();
        populateStats();
        buildCharts();
        populateTaylor();
        initSimulator();
        updateInsight();
        
        console.log('[APP] Data loaded:', liveData.latest);
    } catch (err) {
        console.error('[APP] Fetch error:', err);
        statusEl.textContent = `Connection error: ${err.message}. Retrying in 10s…`;
        setTimeout(fetchLiveData, 10000);
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ==================== TICKERS ====================
function populateTickers() {
    if (!liveData) return;
    const { trimmedMean, headlineCPI, coreCPI, fedFunds } = liveData.latest;
    
    if (trimmedMean) {
        document.getElementById('tv-trimmed').textContent = trimmedMean.value.toFixed(1) + '%';
        document.getElementById('ts-trimmed').textContent = formatDate(trimmedMean.date);
    }
    if (headlineCPI) {
        document.getElementById('tv-headline').textContent = headlineCPI.value.toFixed(1) + '%';
        document.getElementById('ts-headline').textContent = formatDate(headlineCPI.date);
    }
    if (coreCPI) {
        document.getElementById('tv-core').textContent = coreCPI.value.toFixed(1) + '%';
        document.getElementById('ts-core').textContent = formatDate(coreCPI.date);
    }
    if (fedFunds) {
        document.getElementById('tv-ff').textContent = fedFunds.value.toFixed(2) + '%';
        document.getElementById('ts-ff').textContent = formatDate(fedFunds.date);
    }
}

function populateStats() {
    if (!liveData) return;
    const { trimmedMean, headlineCPI, fedFunds } = liveData.latest;
    
    if (trimmedMean) {
        document.getElementById('stat-trimmed').textContent = trimmedMean.value.toFixed(1) + '%';
        document.getElementById('stat-trimmed-date').textContent = formatDate(trimmedMean.date);
    }
    if (headlineCPI) {
        document.getElementById('stat-headline').textContent = headlineCPI.value.toFixed(1) + '%';
        document.getElementById('stat-headline-date').textContent = formatDate(headlineCPI.date);
    }
    if (fedFunds) {
        document.getElementById('stat-ff').textContent = fedFunds.value.toFixed(2) + '%';
        document.getElementById('stat-ff-date').textContent = formatDate(fedFunds.date);
    }
}

function updateInsight() {
    if (!liveData) return;
    const { trimmedMean, headlineCPI } = liveData.latest;
    if (trimmedMean && headlineCPI) {
        const spread = (headlineCPI.value - trimmedMean.value).toFixed(1);
        const el = document.getElementById('insight-text');
        el.innerHTML = `The 16% trimmed mean symmetrically drops outliers. With trimmed mean at <strong style="color:var(--text);">${trimmedMean.value.toFixed(1)}%</strong> vs. headline <strong style="color:var(--text);">${headlineCPI.value.toFixed(1)}%</strong>, the spread is <strong style="color:${spread > 0 ? 'var(--accent-2)' : 'var(--accent-3)'};">${spread > 0 ? '+' : ''}${spread}%</strong>. ${spread > 0 ? 'Positive spread suggests transitory shocks are inflating headline.' : 'Negative spread indicates broad price pressures.'}`;
    }
}

// ==================== CHARTS ====================
function buildCharts() {
    if (!liveData) return;
    buildInflationChart();
    buildSpreadChart();
}

function getFilteredData(view) {
    const cutoff = view === 'long' ? '2014-01-01' : view === 'zoom' ? '2022-01-01' : '2025-01-01';
    const f = arr => arr.filter(d => d.date >= cutoff).map(d => ({ x: d.date, y: d.value }));
    return {
        h: f(liveData.series.headline),
        c: f(liveData.series.core),
        t: f(liveData.series.trimmed),
        ff: f(liveData.series.fedfunds)
    };
}

function buildInflationChart() {
    const ctx = document.getElementById('inflationChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    const d = getFilteredData(currentView);
    const datasets = [
        { label: 'Headline CPI (YoY)', data: d.h, borderColor: CHART_COLORS.headline, borderWidth: 1.5, pointRadius: 0, tension: 0, fill: false },
        { label: 'Core CPI (YoY)', data: d.c, borderColor: CHART_COLORS.core, borderWidth: 1.5, pointRadius: 0, tension: 0, fill: false, borderDash: [4, 4] },
        { label: '16% Trimmed Mean (YoY)', data: d.t, borderColor: CHART_COLORS.trimmed, borderWidth: 3, pointRadius: 0, tension: 0, fill: false },
        { label: 'Fed Funds Rate', data: d.ff, borderColor: CHART_COLORS.fedfunds, backgroundColor: 'rgba(0,106,157,0.05)', borderWidth: 1.5, pointRadius: 0, tension: 0, fill: true, hidden: !showFedFunds }
    ];
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { display: false } },
            scales: {
                x: { type: 'time', time: { unit: 'year' }, grid: { display: false }, ticks: { color: CHART_COLORS.textMuted, font: { size: 10 } } },
                y: { grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.textMuted, callback: v => v + '%' } }
            }
        }
    });
    renderLegend();
}

function renderLegend() {
    const legendEl = document.getElementById('chart-legend');
    if (!legendEl) return;
    const labels = ['Headline CPI', 'Core CPI', '16% Trimmed Mean', 'Fed Funds Rate'];
    const colors = [CHART_COLORS.headline, CHART_COLORS.core, CHART_COLORS.trimmed, CHART_COLORS.fedfunds];
    legendEl.innerHTML = labels.map((l, i) =>
        `<div class="legend-item${i === 3 && !showFedFunds ? ' dimmed' : ''}" onclick="toggleDataset(${i})">
            <div class="legend-color" style="background:${colors[i]};${i === 1 ? 'border-top:2px dashed #fff;height:1px;margin:2px 0;' : ''}"></div>
            <span>${l}</span>
        </div>`
    ).join('');
}

function buildSpreadChart() {
    const ctx = document.getElementById('spreadChart').getContext('2d');
    if (spreadChartInstance) spreadChartInstance.destroy();
    
    const d = getFilteredData(currentView);
    const trimmedMap = {};
    for (const p of d.t) trimmedMap[p.x] = p.y;
    
    const spreadData = d.h
        .filter(p => trimmedMap[p.x] !== undefined)
        .map(p => ({ x: p.x, y: parseFloat((p.y - trimmedMap[p.x]).toFixed(2)) }));
    
    spreadChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            datasets: [{
                label: 'Headline − Trimmed Mean Spread',
                data: spreadData,
                backgroundColor: spreadData.map(p => p.y >= 0 ? 'rgba(0,128,128,0.6)' : 'rgba(153,0,0,0.6)'),
                borderColor: spreadData.map(p => p.y >= 0 ? '#008080' : '#990000'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { type: 'time', time: { unit: 'year' }, grid: { display: false }, ticks: { color: CHART_COLORS.textMuted, font: { size: 10 } } },
                y: { grid: { color: CHART_COLORS.grid }, ticks: { color: CHART_COLORS.textMuted, callback: v => (v >= 0 ? '+' : '') + v + '%' } }
            }
        }
    });
}

function setChartView(view, btn) {
    if (view === 'fedfunds') {
        showFedFunds = !showFedFunds;
        btn.classList.toggle('active', showFedFunds);
        if (chartInstance) {
            chartInstance.data.datasets[3].hidden = !showFedFunds;
            const li = document.getElementById('legend-3');
            if (li) li.classList.toggle('dimmed', !showFedFunds);
            chartInstance.update();
        }
        return;
    }
    currentView = view;
    document.querySelectorAll('.chart-btn').forEach(b => { if (b.id !== 'btn-ff') b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    
    if (!liveData || !chartInstance) return;
    const d = getFilteredData(view);
    chartInstance.data.datasets[0].data = d.h;
    chartInstance.data.datasets[1].data = d.c;
    chartInstance.data.datasets[2].data = d.t;
    chartInstance.data.datasets[3].data = d.ff;
    chartInstance.options.scales.x.time.unit = view === 'close' ? 'month' : 'year';
    chartInstance.update();
}

function toggleDataset(idx) {
    if (!chartInstance) return;
    const meta = chartInstance.getDatasetMeta(idx);
    meta.hidden = !meta.hidden;
    if (idx === 3) showFedFunds = !meta.hidden;
    const li = document.getElementById('legend-' + idx);
    if (li) li.classList.toggle('dimmed', meta.hidden);
    chartInstance.update();
}

// ==================== TAYLOR RULE ====================
function populateTaylor() {
    if (!liveData || !liveData.latest.trimmedMean) return;
    const pi = liveData.latest.trimmedMean.value;
    document.getElementById('pi').value = pi;
    updateTaylor();
}

function updateTaylor() {
    const pi = parseFloat(document.getElementById('pi').value);
    const pistar = parseFloat(document.getElementById('pistar').value);
    const gap = parseFloat(document.getElementById('gap').value);
    const rstar = parseFloat(document.getElementById('rstar').value);
    const rule = document.getElementById('rule').value;

    document.getElementById('val-pi').textContent = pi.toFixed(1) + '%';
    document.getElementById('val-pistar').textContent = pistar.toFixed(2) + '%';
    document.getElementById('val-gap').textContent = gap.toFixed(1) + '%';
    document.getElementById('val-rstar').textContent = rstar.toFixed(1) + '%';

    let a1, a2, formula;
    if (rule === 'taylor') { a1 = 1.5; a2 = 0.5; formula = `r = ${rstar.toFixed(1)} + ${pi.toFixed(1)} + ${a1}×(${pi.toFixed(1)}−${pistar.toFixed(2)}) + ${a2}×(${gap.toFixed(1)})`; }
    else if (rule === 'yellen') { a1 = 1.0; a2 = 1.0; formula = `r = ${rstar.toFixed(1)} + ${pi.toFixed(1)} + ${a1}×(${pi.toFixed(1)}−${pistar.toFixed(2)}) + ${a2}×(${gap.toFixed(1)}) [Balanced]`; }
    else { a1 = 2.0; a2 = 0.0; formula = `r = ${rstar.toFixed(1)} + ${pi.toFixed(1)} + ${a1}×(${pi.toFixed(1)}−${pistar.toFixed(2)}) [Warsh Aggressive]`; }

    const result = rstar + pi + a1 * (pi - pistar) + a2 * gap;
    const resultEl = document.getElementById('taylor-result');
    resultEl.textContent = result.toFixed(2) + '%';
    
    if (Math.abs(result - 3.0) < 0.3) resultEl.style.color = 'var(--accent-2)';
    else if (result > 4.5) resultEl.style.color = 'var(--accent-3)';
    else resultEl.style.color = 'var(--accent)';
    
    document.getElementById('taylor-formula').textContent = formula + ' = ' + result.toFixed(2) + '%';
    
    // Show comparison to actual Fed Funds
    const vsEl = document.getElementById('taylor-vs');
    if (liveData && liveData.latest.fedFunds) {
        const actual = liveData.latest.fedFunds.value;
        const diff = (result - actual).toFixed(2);
        const direction = diff > 0 ? 'above' : 'below';
        const color = diff > 0 ? 'var(--accent-3)' : 'var(--accent-2)';
        vsEl.innerHTML = `Actual Fed Funds: <strong>${actual.toFixed(2)}%</strong> · Rule is <strong style="color:${color}">${Math.abs(diff)}% ${direction}</strong> current rate`;
    }
}

// ==================== FOMC RATE PATH SIMULATOR ====================
const FOMC_MEETINGS = ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov', 'Dec'];
const CUT_BPS = 0.25;

let simState = {
    currentMeeting: 0,
    cuts: 0,
    holds: 0,
    startingRate: 3.64,   // will be overridden by live data
    currentRate: 3.64,
    rateHistory: [],
    decisions: [],
    spinning: false
};
let ratePathChart = null;

function initSimulator() {
    // Use live Fed Funds if available
    if (liveData && liveData.latest.fedFunds) {
        simState.startingRate = liveData.latest.fedFunds.value;
        simState.currentRate = simState.startingRate;
    }
    simState.rateHistory = [{ label: 'Start', rate: simState.currentRate }];
    buildRatePathChart();
    updateSimulatorUI();
}

function buildRatePathChart() {
    const ctx = document.getElementById('ratePathChart').getContext('2d');
    if (ratePathChart) ratePathChart.destroy();

    const labels = ['Start', ...FOMC_MEETINGS];
    const rates = new Array(labels.length).fill(null);
    rates[0] = simState.currentRate;

    ratePathChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Simulated Rate',
                    data: rates,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.07)',
                    borderWidth: 3,
                    pointRadius: 6,
                    pointBackgroundColor: rates.map((v, i) => {
                        if (v === null) return 'transparent';
                        const d = simState.decisions[i - 1];
                        return d === 'cut' ? '#10b981' : d === 'hold' ? '#ef4444' : '#f59e0b';
                    }),
                    pointBorderColor: '#0a0e17',
                    pointBorderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    spanGaps: false
                },
                {
                    label: 'Robertson Target',
                    data: new Array(labels.length).fill(3.0),
                    borderColor: '#10b981',
                    borderWidth: 1.5,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                },
                {
                    label: 'Starting Rate',
                    data: new Array(labels.length).fill(simState.startingRate),
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderDash: [3, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1f2937', titleColor: '#e5e7eb', bodyColor: '#e5e7eb',
                    borderColor: '#374151', borderWidth: 1, padding: 10, cornerRadius: 8,
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2) ?? '—'}%` }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(55,65,81,0.3)', drawBorder: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
                y: {
                    grid: { color: 'rgba(55,65,81,0.3)', drawBorder: false },
                    ticks: { color: '#9ca3af', callback: v => v.toFixed(2) + '%', font: { size: 11 } },
                    min: Math.max(0, simState.startingRate - 2.5),
                    max: simState.startingRate + 0.5,
                    title: { display: true, text: 'Fed Funds Rate (%)', color: '#9ca3af', font: { size: 11 } }
                }
            },
            animation: { duration: 600, easing: 'easeInOutCubic' }
        }
    });
}

function updateGauge(cutPct) {
    const needle = document.getElementById('gauge-needle');
    const pctEl = document.getElementById('gauge-pct');
    const subEl = document.getElementById('gauge-sub');
    const total = simState.cuts + simState.holds;

    // Needle: -90° = full hold (left), 0° = neutral (top), +90° = full cut (right)
    const angle = (cutPct / 100) * 180 - 90;
    needle.setAttribute('transform', `rotate(${angle} 110 110)`);

    if (total === 0) {
        pctEl.textContent = '—';
        subEl.textContent = 'No flips yet';
        return;
    }

    pctEl.textContent = cutPct.toFixed(0) + '% cut';
    pctEl.style.color = cutPct >= 50 ? 'var(--accent-2)' : cutPct >= 30 ? 'var(--accent)' : 'var(--accent-3)';

    const label = cutPct >= 70 ? '📉 Strong Robertson conviction'
                : cutPct >= 50 ? '↘ Lean toward cuts'
                : cutPct >= 30 ? '↔ Mixed signals'
                : '📈 Fed holds — inflation sticky';
    subEl.textContent = label;
}

function addLogEntry(meeting, decision, rate) {
    const log = document.getElementById('decision-log');
    const empty = log.querySelector('.log-empty');
    if (empty) empty.remove();

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const delta = decision === 'cut' ? `-${CUT_BPS * 100}bps` : 'Hold';
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    entry.innerHTML = `
        <span class="log-badge ${decision}">${decision.toUpperCase()}</span>
        <span class="log-meta">${meeting} 2026 — ${delta}</span>
        <span style="color:var(--text-muted);font-size:.72rem">${time}</span>
        <span class="log-rate">${rate.toFixed(2)}%</span>
    `;
    log.insertBefore(entry, log.firstChild);

    const count = document.getElementById('log-count');
    const total = simState.cuts + simState.holds;
    count.textContent = `(${total} decision${total !== 1 ? 's' : ''})`;
}

function updateSimulatorUI() {
    const total = simState.cuts + simState.holds;
    const cutPct = total > 0 ? (simState.cuts / total) * 100 : 50;

    // Stats
    document.getElementById('stat-cuts').textContent = simState.cuts;
    document.getElementById('stat-holds').textContent = simState.holds;
    document.getElementById('stat-terminal').textContent = simState.currentRate.toFixed(2) + '%';

    const vsEl = document.getElementById('stat-vs-robertson');
    const diff = simState.currentRate - 3.0;
    vsEl.textContent = (diff >= 0 ? '+' : '') + diff.toFixed(2) + '%';
    vsEl.style.color = Math.abs(diff) < 0.13 ? 'var(--accent-2)' : diff > 0 ? 'var(--accent-3)' : 'var(--accent-2)';

    // Gauge
    updateGauge(cutPct);
}

function updateRatePathChart(meetingIdx, decision) {
    if (!ratePathChart) return;
    const dataIdx = meetingIdx + 1; // offset for 'Start'
    ratePathChart.data.datasets[0].data[dataIdx] = simState.currentRate;
    // Update point colors
    ratePathChart.data.datasets[0].pointBackgroundColor = ratePathChart.data.datasets[0].data.map((v, i) => {
        if (v === null) return 'transparent';
        const d = simState.decisions[i - 1];
        return d === 'cut' ? '#10b981' : d === 'hold' ? '#ef4444' : '#f59e0b';
    });
    ratePathChart.update();
}

function flipCoin() {
    if (simState.spinning) return;
    if (simState.currentMeeting >= FOMC_MEETINGS.length) return;

    simState.spinning = true;
    const coin = document.getElementById('coin');
    const resultEl = document.getElementById('coin-result');
    const dots = document.querySelectorAll('#fomc-timeline .fomc-dot');
    const meetingName = FOMC_MEETINGS[simState.currentMeeting];

    const isCut = Math.random() > 0.5;
    const extraSpins = Math.floor(Math.random() * 3) + 3;
    const rotation = extraSpins * 360 + (isCut ? 0 : 180) + (Math.random() - 0.5) * 40;
    coin.style.transform = `rotateY(${rotation}deg)`;

    setTimeout(() => {
        const decision = isCut ? 'cut' : 'hold';
        simState.decisions[simState.currentMeeting] = decision;

        if (isCut) {
            simState.cuts++;
            simState.currentRate = parseFloat((simState.currentRate - CUT_BPS).toFixed(2));
        } else {
            simState.holds++;
        }

        // Update timeline dot
        dots[simState.currentMeeting].classList.remove('active');
        dots[simState.currentMeeting].classList.add(decision);
        const bpsEl = document.getElementById(`fbps-${simState.currentMeeting}`);
        if (bpsEl) bpsEl.textContent = isCut ? '-25' : '—';

        // Advance meeting
        simState.currentMeeting++;
        if (simState.currentMeeting < dots.length) {
            dots[simState.currentMeeting].classList.add('active');
        }

        // Result text
        const delta = isCut ? '↓ −25bps' : '= Hold';
        resultEl.textContent = `${meetingName}: ${isCut ? 'CUT' : 'HOLD'} ${delta} → ${simState.currentRate.toFixed(2)}%`;
        resultEl.style.color = isCut ? 'var(--accent-2)' : 'var(--accent-3)';

        // All meetings done
        if (simState.currentMeeting >= FOMC_MEETINGS.length) {
            const total = simState.cuts + simState.holds;
            const totalCutsBps = simState.cuts * 25;
            setTimeout(() => {
                resultEl.textContent = `2026 Complete — ${simState.cuts} cuts (−${totalCutsBps}bps) → Terminal rate: ${simState.currentRate.toFixed(2)}%`;
            }, 800);
        }

        updateRatePathChart(simState.currentMeeting - 1, decision);
        addLogEntry(meetingName, decision, simState.currentRate);
        updateSimulatorUI();

        simState.spinning = false;
    }, 700);
}

function resetSimulator() {
    const rate = (liveData && liveData.latest.fedFunds) ? liveData.latest.fedFunds.value : 3.64;
    simState = {
        currentMeeting: 0,
        cuts: 0,
        holds: 0,
        startingRate: rate,
        currentRate: rate,
        rateHistory: [{ label: 'Start', rate }],
        decisions: [],
        spinning: false
    };

    // Reset coin
    document.getElementById('coin').style.transform = 'rotateY(0deg)';
    document.getElementById('coin-result').textContent = 'Click the coin to simulate an FOMC decision';
    document.getElementById('coin-result').style.color = 'var(--accent)';

    // Reset dots
    document.querySelectorAll('#fomc-timeline .fomc-dot').forEach((d, i) => {
        d.classList.remove('cut', 'hold', 'active');
        if (i === 0) d.classList.add('active');
        const bps = document.getElementById(`fbps-${i}`);
        if (bps) bps.textContent = '';
    });

    // Reset log
    const log = document.getElementById('decision-log');
    log.innerHTML = '<div class="log-empty">No decisions yet — flip the coin to begin</div>';
    document.getElementById('log-count').textContent = '';

    buildRatePathChart();
    updateSimulatorUI();
}

window.flipCoin = flipCoin;
window.resetSimulator = resetSimulator;

// ==================== CARD FLIP ====================
function flipCard(card) {
    const back = card.querySelector('.card-back');
    const indicator = card.querySelector('.flip-indicator');
    if (back.style.display === 'block') {
        back.style.display = 'none';
        if (indicator) indicator.textContent = 'Click to flip →';
    } else {
        back.style.display = 'block';
        if (indicator) indicator.textContent = 'Click to hide ↑';
    }
}
window.flipCard = flipCard;

// ==================== SCROLL ANIMATIONS ====================
const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

// ==================== GLOBAL BINDINGS ====================
window.setChartView = setChartView;
window.toggleDataset = toggleDataset;
window.updateTaylor = updateTaylor;

// ==================== INIT ====================
window.addEventListener('DOMContentLoaded', () => {
    fetchLiveData();
    // Auto-refresh every 30 minutes
    setInterval(fetchLiveData, 30 * 60 * 1000);
});
