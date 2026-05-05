/* ===================== ROBERTSON DOCTRINE — APP.JS ===================== */
/* Real-time FRED data integration + all interactive features */

let liveData = null;
let chartInstance = null;
let spreadChartInstance = null;
let currentView = 'long';
let showFedFunds = false;

// ==================== DATA FETCHING ====================
async function fetchLiveData() {
    const statusEl = document.getElementById('live-status');
    const dotEl = document.querySelector('.live-dot');
    const tsEl = document.getElementById('live-ts');
    
    try {
        statusEl.textContent = 'Fetching live FRED data…';
        const resp = await fetch('/api/data');
        if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
        liveData = await resp.json();
        
        dotEl.classList.add('connected');
        statusEl.textContent = `FRED Live · ${liveData.meta.trimmedCount} trimmed mean · ${liveData.meta.headlineCount} CPI · ${liveData.meta.fedfundsCount} fed funds observations`;
        tsEl.textContent = new Date(liveData.timestamp).toLocaleTimeString();
        
        populateTickers();
        populateStats();
        buildCharts();
        populateTaylor();
        updateInsight();
        
        console.log('[APP] Live data loaded:', liveData.latest);
    } catch (err) {
        console.error('[APP] Fetch error:', err);
        dotEl.classList.remove('connected');
        statusEl.textContent = `Connection error: ${err.message}. Retrying in 10s…`;
        setTimeout(fetchLiveData, 10000);
    }
}

function formatDate(dateStr) {
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
        el.innerHTML = `The 16% trimmed mean symmetrically drops outliers without fixed exclusions. With trimmed mean at <strong style="color:var(--text);">${trimmedMean.value.toFixed(1)}%</strong> (${formatDate(trimmedMean.date)}) vs. headline <strong style="color:var(--text);">${headlineCPI.value.toFixed(1)}%</strong>, the spread is <strong style="color:${spread > 0 ? 'var(--accent-2)' : 'var(--accent-3)'};">${spread > 0 ? '+' : ''}${spread}%</strong>. ${spread > 0 ? 'A positive spread suggests transitory shocks are inflating headline — the Fed has more room to cut.' : 'A negative spread is unusual — trimmed mean exceeding headline indicates broad-based price pressures.'}`;
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
    
    const d = getFilteredData('long');
    const datasets = [
        { label: 'Headline CPI YoY', data: d.h, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.04)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false },
        { label: 'Core CPI YoY', data: d.c, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.04)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: false },
        { label: '16% Trimmed Mean CPI YoY', data: d.t, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.06)', borderWidth: 3, pointRadius: 0, tension: 0.3, fill: false },
        { label: 'Fed Funds Rate', data: d.ff, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.04)', borderWidth: 2, pointRadius: 0, tension: 0.1, fill: false, borderDash: [6, 3], hidden: !showFedFunds }
    ];
    
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1f2937', titleColor: '#e5e7eb', bodyColor: '#e5e7eb',
                    borderColor: '#374151', borderWidth: 1, padding: 12, cornerRadius: 8,
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%` }
                }
            },
            scales: {
                x: { type: 'time', time: { unit: 'year', displayFormats: { year: 'yyyy', month: 'MMM yyyy' } },
                    grid: { color: 'rgba(55,65,81,0.4)', drawBorder: false }, ticks: { color: '#9ca3af', font: { size: 11 } } },
                y: { grid: { color: 'rgba(55,65,81,0.4)', drawBorder: false },
                    ticks: { color: '#9ca3af', callback: v => v + '%', font: { size: 11 } },
                    title: { display: true, text: 'Year-over-Year %', color: '#9ca3af', font: { size: 11 } } }
            }
        }
    });
    
    // Build legend
    const legendEl = document.getElementById('chart-legend');
    const colors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981'];
    const labels = ['Headline CPI', 'Core CPI', '16% Trimmed Mean', 'Fed Funds Rate'];
    legendEl.innerHTML = labels.map((l, i) =>
        `<div class="legend-item${i === 3 && !showFedFunds ? ' dimmed' : ''}" id="legend-${i}" onclick="toggleDataset(${i})"><div class="legend-dot" style="background:${colors[i]};${i === 3 ? 'border:2px dashed #10b981;background:transparent;' : ''}"></div><span>${l}</span></div>`
    ).join('');
}

function buildSpreadChart() {
    const ctx = document.getElementById('spreadChart').getContext('2d');
    if (spreadChartInstance) spreadChartInstance.destroy();
    
    // Compute headline - trimmed spread
    const trimmedMap = {};
    for (const d of liveData.series.trimmed) trimmedMap[d.date.slice(0, 7)] = d.value;
    
    const spreadData = liveData.series.headline
        .filter(d => trimmedMap[d.date.slice(0, 7)] !== undefined)
        .map(d => ({
            x: d.date,
            y: parseFloat((d.value - trimmedMap[d.date.slice(0, 7)]).toFixed(2))
        }));
    
    spreadChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            datasets: [{
                label: 'Headline − Trimmed Mean Spread',
                data: spreadData,
                backgroundColor: spreadData.map(d => d.y >= 0 ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'),
                borderColor: spreadData.map(d => d.y >= 0 ? '#10b981' : '#ef4444'),
                borderWidth: 1,
                borderRadius: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1f2937', titleColor: '#e5e7eb', bodyColor: '#e5e7eb',
                    borderColor: '#374151', borderWidth: 1, padding: 12, cornerRadius: 8,
                    callbacks: {
                        label: ctx => {
                            const v = ctx.parsed.y;
                            return `Spread: ${v >= 0 ? '+' : ''}${v.toFixed(2)}% — ${v >= 0 ? 'Transitory shocks inflating headline' : 'Broad-based pressure'}`;
                        }
                    }
                }
            },
            scales: {
                x: { type: 'time', time: { unit: 'year' },
                    grid: { color: 'rgba(55,65,81,0.3)', drawBorder: false }, ticks: { color: '#9ca3af' } },
                y: { grid: { color: 'rgba(55,65,81,0.3)', drawBorder: false },
                    ticks: { color: '#9ca3af', callback: v => (v >= 0 ? '+' : '') + v + '%' },
                    title: { display: true, text: 'Headline − Trimmed Mean (pp)', color: '#9ca3af' } }
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

// ==================== COIN FLIP ====================
let coinFlips = 0;
const pastDecisions = [];
function flipCoin() {
    const coin = document.getElementById('coin');
    const result = document.getElementById('coin-result');
    const dots = document.querySelectorAll('#fomc-timeline .fomc-dot');
    coinFlips = (coinFlips + 1) % dots.length;
    const isCut = Math.random() > 0.5;
    const extraSpins = Math.floor(Math.random() * 3) + 3;
    const rotation = extraSpins * 360 + (isCut ? 0 : 180) + (Math.random() - 0.5) * 60;
    pastDecisions[coinFlips] = isCut;
    coin.style.transform = `rotateY(${rotation}deg)`;
    setTimeout(() => {
        result.textContent = isCut ? 'FOMC Decision: CUT 25bps ▼' : 'FOMC Decision: HOLD —';
        result.style.color = isCut ? 'var(--accent-2)' : 'var(--accent-3)';
        dots.forEach((d, i) => {
            d.classList.remove('active', 'cut', 'hold');
            if (i < coinFlips) d.classList.add(pastDecisions[i] ? 'cut' : 'hold');
            else if (i === coinFlips) d.classList.add('active');
        });
    }, 600);
}
window.flipCoin = flipCoin;

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
