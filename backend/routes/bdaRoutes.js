/**
 * BDA (Big Data Analytics) read API for the municipal dashboard.
 *
 * Serves the outputs of the Kafka → data lake → Spark pipeline in bda/. Nothing
 * here is computed from assumptions: every number is read from the bronze /
 * silver / gold layers the Spark jobs wrote, or aggregated from them on load.
 * Rainfall is real (Open-Meteo ERA5); civic reports in the lake are simulated
 * and flagged as such — the API surfaces that so the UI can say so.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');

const DATA_DIR = process.env.BDA_DATA_DIR || path.resolve(__dirname, '../../bda/data');
const LAKE = path.join(DATA_DIR, 'lake');
const P = {
    wardMaster: path.join(DATA_DIR, 'reference/ward_master.csv'),
    rainfall: path.join(DATA_DIR, 'reference/rainfall_daily.csv'),
    fused: path.join(LAKE, 'gold/fusion/ward_date_fused_gold.csv'),
    vulnerability: path.join(LAKE, 'gold/fusion/ward_vulnerability.csv'),
    lag: path.join(LAKE, 'gold/fusion/lag_correlation.json'),
    veracity: path.join(LAKE, 'gold/analytics/veracity_report.json'),
    dedupAudit: path.join(LAKE, 'gold/analytics/dedup_audit.csv'),
    cleanComparison: path.join(LAKE, 'gold/analytics/clean_comparison.json'),
    edaSummary: path.join(LAKE, 'gold/analytics/eda_summary.json'),
    kafkaLatest: path.join(LAKE, 'bronze/events/kafka_events_latest.jsonl'),
    bronzeHistory: path.join(LAKE, 'bronze/events/civic_history.jsonl'),
    bronzeWeather: path.join(LAKE, 'bronze/weather/rainfall_raw.jsonl'),
    silverReports: path.join(LAKE, 'silver/events_clean/reports'),
};

const HEAVY_MM = 45;
const DRY_MM = 5;
const RAIN_BINS = [
    { id: 'dry', label: 'Dry (<5 mm)', min: 0, max: DRY_MM },
    { id: 'light', label: 'Light (5–20 mm)', min: DRY_MM, max: 20 },
    { id: 'moderate', label: 'Moderate (20–45 mm)', min: 20, max: HEAVY_MM },
    { id: 'heavy', label: 'Heavy (≥45 mm)', min: HEAVY_MM, max: Infinity },
];

// ── tiny readers ─────────────────────────────────────────────────────────────

function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let q = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') q = false;
            else cur += c;
        } else if (c === '"') q = true;
        else if (c === ',') { out.push(cur); cur = ''; }
        else cur += c;
    }
    out.push(cur);
    return out;
}

function readCsv(file) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    const head = parseCsvLine(lines[0]);
    return lines.slice(1).map((l) => {
        const v = parseCsvLine(l);
        const row = {};
        head.forEach((h, i) => {
            const raw = v[i];
            const n = Number(raw);
            row[h] = raw === '' || raw === undefined ? null : Number.isFinite(n) && /^-?[\d.]+(e-?\d+)?$/i.test(raw) ? n : raw;
        });
        return row;
    });
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const exists = (f) => { try { fs.accessSync(f); return true; } catch { return false; } };
const mtime = (f) => { try { return fs.statSync(f).mtime.toISOString(); } catch { return null; } };
const size = (f) => { try { return fs.statSync(f).size; } catch { return 0; } };

function dirStats(dir) {
    let files = 0;
    let bytes = 0;
    const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (!e.name.endsWith('.crc') && !e.name.startsWith('_')) { files++; bytes += fs.statSync(p).size; }
        }
    };
    try { walk(dir); } catch { /* missing layer */ }
    return { files, bytes };
}

async function countLines(file) {
    if (!exists(file)) return 0;
    let n = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    for await (const l of rl) if (l.trim()) n++;
    return n;
}

async function kafkaProfile(file) {
    const topics = {};
    if (!exists(file)) return { messages: 0, topics: [] };
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    let messages = 0;
    let first = null;
    let last = null;
    const categories = {};
    for await (const l of rl) {
        if (!l.trim()) continue;
        try {
            const e = JSON.parse(l);
            messages++;
            const t = (topics[e.topic] ||= { topic: e.topic, messages: 0, partitions: {} });
            t.messages++;
            t.partitions[e.partition] = (t.partitions[e.partition] || 0) + 1;
            const at = e.payload?.created_at;
            if (at) { if (!first || at < first) first = at; if (!last || at > last) last = at; }
            const cat = e.payload?.category;
            if (cat) categories[cat] = (categories[cat] || 0) + 1;
        } catch { /* skip malformed line */ }
    }
    return {
        messages,
        eventTimeRange: { from: first, to: last },
        topics: Object.values(topics).map((t) => ({
            topic: t.topic,
            messages: t.messages,
            partitions: Object.entries(t.partitions).map(([p, n]) => ({ partition: Number(p), messages: n })),
        })),
        categories: Object.entries(categories).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    };
}

// ── model, built once and rebuilt when the gold tables change ────────────────

let cache = null;

async function build() {
    const fused = readCsv(P.fused);
    const master = readCsv(P.wardMaster);
    const vuln = readCsv(P.vulnerability);
    const lag = readJson(P.lag);

    // Wards: reference geography joined with the Spark vulnerability mart.
    const vulnById = Object.fromEntries(vuln.map((v) => [v.ward_id, v]));
    const wards = master.map((m) => {
        const v = vulnById[m.ward_id] || {};
        return {
            id: m.ward_id,
            name: m.ward_name,
            zone: m.zone,
            lat: m.centroid_lat,
            lon: m.centroid_lon,
            station: m.station_id,
            roadKm: m.road_km,
            population: m.population_2011,
            drainageCapacity: m.drainage_capacity_mm_hr,
            surgeRatio48h: v.surge_ratio_48h ?? null,
            dryBaseline: v.dry_baseline ?? null,
            recurrence: v.recurrence_events ?? null,
            drainageDeficit: v.drainage_deficit ?? null,
            cvi: v.cvi ?? null,
            rank: v.cvi_rank ?? null,
            tier: v.vulnerability_tier ?? 'UNKNOWN',
        };
    }).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

    // Per-ward ordered daily series + yearly totals.
    const byWard = {};
    for (const r of fused) (byWard[r.ward_id] ||= []).push(r);
    for (const id of Object.keys(byWard)) byWard[id].sort((a, b) => (a.calendar_date < b.calendar_date ? -1 : 1));

    const wardTotals = {};
    for (const [id, rows] of Object.entries(byWard)) {
        wardTotals[id] = rows.reduce(
            (acc, r) => ({
                incidents: acc.incidents + (r.complaint_count || 0),
                rawReports: acc.rawReports + (r.raw_report_count || 0),
                severe: acc.severe + (r.severe_incidents || 0),
                road: acc.road + (r.road_incidents || 0),
                rainfall: acc.rainfall + (r.total_rainfall_mm || 0),
                heavyDays: acc.heavyDays + ((r.total_rainfall_mm || 0) >= HEAVY_MM ? 1 : 0),
            }),
            { incidents: 0, rawReports: 0, severe: 0, road: 0, rainfall: 0, heavyDays: 0 },
        );
    }
    wards.forEach((w) => Object.assign(w, wardTotals[w.id] || {}));

    // Citywide daily series: complaints summed over wards, rainfall averaged.
    const byDate = {};
    for (const r of fused) {
        const d = (byDate[r.calendar_date] ||= { date: r.calendar_date, rain: 0, wards: 0, incidents: 0, rawReports: 0, severe: 0, maxRain: 0 });
        d.rain += r.total_rainfall_mm || 0;
        d.maxRain = Math.max(d.maxRain, r.total_rainfall_mm || 0);
        d.wards++;
        d.incidents += r.complaint_count || 0;
        d.rawReports += r.raw_report_count || 0;
        d.severe += r.severe_incidents || 0;
    }
    const daily = Object.values(byDate)
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((d) => ({ date: d.date, rainMm: +(d.rain / d.wards).toFixed(1), maxRainMm: +d.maxRain.toFixed(1), incidents: d.incidents, rawReports: d.rawReports, severe: d.severe }));

    // Monthly roll-up (seasonality).
    const monthly = {};
    for (const d of daily) {
        const m = d.date.slice(0, 7);
        const x = (monthly[m] ||= { month: m, rainMm: 0, incidents: 0, rawReports: 0, heavyDays: 0 });
        x.rainMm += d.rainMm;
        x.incidents += d.incidents;
        x.rawReports += d.rawReports;
        x.heavyDays += d.maxRainMm >= HEAVY_MM ? 1 : 0;
    }

    // Empirical response curve: complaints `lagDays` after a day in each rain band.
    // Averaged over ward-days, per ward and citywide — this is what the planner uses.
    const binOf = (mm) => RAIN_BINS.find((b) => mm >= b.min && mm < b.max).id;
    const response = (rows, lagDays) => {
        const acc = Object.fromEntries(RAIN_BINS.map((b) => [b.id, { sum: 0, n: 0 }]));
        for (let i = 0; i + lagDays < rows.length; i++) {
            const a = acc[binOf(rows[i].total_rainfall_mm || 0)];
            a.sum += rows[i + lagDays].complaint_count || 0;
            a.n++;
        }
        return RAIN_BINS.map((b) => ({ bin: b.id, label: b.label, avg: acc[b.id].n ? +(acc[b.id].sum / acc[b.id].n).toFixed(3) : null, samples: acc[b.id].n }));
    };
    const responseByWard = {};
    const cityResponse = {};
    for (const lagDays of [0, 1, 2, 3]) {
        const merged = Object.fromEntries(RAIN_BINS.map((b) => [b.id, { sum: 0, n: 0 }]));
        for (const [id, rows] of Object.entries(byWard)) {
            const r = response(rows, lagDays);
            (responseByWard[id] ||= {})[lagDays] = r;
            r.forEach((x) => { if (x.avg !== null) { merged[x.bin].sum += x.avg * x.samples; merged[x.bin].n += x.samples; } });
        }
        cityResponse[lagDays] = RAIN_BINS.map((b) => ({ bin: b.id, label: b.label, avg: merged[b.id].n ? +(merged[b.id].sum / merged[b.id].n).toFixed(3) : null, samples: merged[b.id].n }));
    }

    // Heavy-rain episodes: each citywide day with a ward ≥ heavy, and the 72h that followed.
    const avgIncidents = daily.reduce((s, d) => s + d.incidents, 0) / daily.length;
    const episodes = daily
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => d.maxRainMm >= HEAVY_MM)
        .map(({ d, i }) => {
            const next = daily.slice(i + 1, i + 4);
            const after72 = next.reduce((s, x) => s + x.incidents, 0);
            return {
                date: d.date,
                rainMm: d.rainMm,
                maxRainMm: d.maxRainMm,
                wardsHeavy: (fused.filter((r) => r.calendar_date === d.date && (r.total_rainfall_mm || 0) >= HEAVY_MM)).length,
                incidentsNext72h: after72,
                liftVsAverage: next.length ? +(after72 / (avgIncidents * next.length)).toFixed(2) : null,
            };
        })
        .sort((a, b) => b.incidentsNext72h - a.incidentsNext72h);

    // Rainfall stations (real data) summary.
    const rain = readCsv(P.rainfall);
    const stations = {};
    for (const r of rain) {
        const s = (stations[r.station_id] ||= { station: r.station_id, totalMm: 0, days: 0, rainyDays: 0, heavyDays: 0, maxMm: 0, maxDate: null });
        s.totalMm += r.precipitation_mm || 0;
        s.days++;
        if ((r.precipitation_mm || 0) >= 2.5) s.rainyDays++;
        if ((r.precipitation_mm || 0) >= HEAVY_MM) s.heavyDays++;
        if ((r.precipitation_mm || 0) > s.maxMm) { s.maxMm = r.precipitation_mm; s.maxDate = r.date; }
    }

    const [historyLines, weatherLines, kafka] = await Promise.all([countLines(P.bronzeHistory), countLines(P.bronzeWeather), kafkaProfile(P.kafkaLatest)]);

    const layers = {
        bronze: dirStats(path.join(LAKE, 'bronze')),
        silver: dirStats(path.join(LAKE, 'silver')),
        gold: dirStats(path.join(LAKE, 'gold')),
    };

    return {
        builtAt: new Date().toISOString(),
        sourceMtime: mtime(P.fused),
        dateRange: { from: daily[0]?.date, to: daily[daily.length - 1]?.date, days: daily.length },
        thresholds: { heavyMm: HEAVY_MM, dryMm: DRY_MM },
        lag,
        wards,
        byWard,
        daily,
        monthly: Object.values(monthly).map((m) => ({ ...m, rainMm: +m.rainMm.toFixed(1) })),
        cityResponse,
        responseByWard,
        episodes,
        stations: Object.values(stations).map((s) => ({ ...s, totalMm: +s.totalMm.toFixed(1) })),
        veracity: exists(P.veracity) ? readJson(P.veracity) : null,
        dedupAudit: exists(P.dedupAudit) ? readCsv(P.dedupAudit) : [],
        cleanComparison: exists(P.cleanComparison) ? readJson(P.cleanComparison) : null,
        edaSummary: exists(P.edaSummary) ? readJson(P.edaSummary) : null,
        ingest: { historyEvents: historyLines, weatherRecords: weatherLines, kafka },
        layers,
        files: {
            fused: { rows: fused.length, updatedAt: mtime(P.fused), bytes: size(P.fused) },
            vulnerability: { rows: vuln.length, updatedAt: mtime(P.vulnerability) },
            lag: { updatedAt: mtime(P.lag) },
            veracity: { updatedAt: mtime(P.veracity) },
        },
    };
}

async function model() {
    const m = mtime(P.fused);
    if (!cache || cache.sourceMtime !== m) cache = await build();
    return cache;
}

function guard(handler) {
    return async (req, res) => {
        try {
            if (!exists(P.fused)) return res.status(503).json({ message: `BDA gold tables not found at ${LAKE}. Run the Spark pipeline (bda/run_bda.sh all).` });
            await handler(req, res, await model());
        } catch (e) {
            console.error('BDA route error:', e.message);
            res.status(500).json({ message: e.message });
        }
    };
}

// GET /api/bda/overview — pipeline, lake layers, headline findings
router.get('/overview', protect, admin, guard((req, res, m) => {
    const v = m.veracity || {};
    const totals = m.wards.reduce((a, w) => ({ incidents: a.incidents + (w.incidents || 0), raw: a.raw + (w.rawReports || 0) }), { incidents: 0, raw: 0 });
    res.json({
        dateRange: m.dateRange,
        thresholds: m.thresholds,
        lag: m.lag,
        builtAt: m.builtAt,
        files: m.files,
        layers: m.layers,
        ingest: m.ingest,
        veracity: m.veracity,
        headline: {
            wards: m.wards.length,
            criticalWards: m.wards.filter((w) => w.tier === 'CRITICAL').map((w) => ({ id: w.id, name: w.name, cvi: w.cvi })),
            peakLagHours: m.lag.peak_lag_hours,
            peakSurge: m.lag[`${m.lag.peak_lag_hours}h`],
            rawReports: v.silver_reports ?? totals.raw,
            incidents: v.distinct_incidents ?? totals.incidents,
            dispatchSaved: v.silver_reports && v.distinct_incidents ? +(1 - v.distinct_incidents / v.silver_reports).toFixed(3) : null,
            heavyRainEpisodes: m.episodes.length,
        },
        provenance: {
            rainfall: 'Real — Open-Meteo ERA5 reanalysis, 5 Mumbai stations',
            wards: 'Real — 24 BMC administrative wards (centroids, drainage capacity, census 2011)',
            reports: 'Simulated civic reports (is_simulated = true); the rain→complaint lag is recovered by Spark, not read from the generator',
        },
    });
}));

// GET /api/bda/fusion — rain vs complaints time series, seasonality, lag curve
router.get('/fusion', protect, admin, guard((req, res, m) => {
    const ward = req.query.ward && m.byWard[req.query.ward] ? req.query.ward : null;
    const daily = ward
        ? m.byWard[ward].map((r) => ({ date: r.calendar_date, rainMm: r.total_rainfall_mm, rolling48hMm: r.rolling_48h_rain_mm, incidents: r.complaint_count, rawReports: r.raw_report_count, severe: r.severe_incidents }))
        : m.daily;
    res.json({
        ward: ward ? m.wards.find((w) => w.id === ward) : null,
        daily,
        monthly: m.monthly,
        lag: m.lag,
        response: ward ? m.responseByWard[ward] : m.cityResponse,
        episodes: m.episodes.slice(0, 12),
        stations: m.stations,
    });
}));

// GET /api/bda/wards — ward risk mart for the map and ranking
router.get('/wards', protect, admin, guard((req, res, m) => {
    res.json({ wards: m.wards, thresholds: m.thresholds });
}));

// GET /api/bda/planner?rain=60&lag=2 — expected incidents per ward for a rain forecast
router.get('/planner', protect, admin, guard((req, res, m) => {
    const rain = Math.max(0, Number(req.query.rain) || 0);
    const lagDays = [0, 1, 2, 3].includes(Number(req.query.lag)) ? Number(req.query.lag) : 2;
    const bin = RAIN_BINS.find((b) => rain >= b.min && rain < b.max);
    const rows = m.wards.map((w) => {
        const resp = m.responseByWard[w.id]?.[lagDays] || [];
        const dry = resp.find((r) => r.bin === 'dry');
        const hit = resp.find((r) => r.bin === bin.id);
        const expected = hit?.avg ?? null;
        return {
            id: w.id,
            name: w.name,
            zone: w.zone,
            tier: w.tier,
            cvi: w.cvi,
            lat: w.lat,
            lon: w.lon,
            expectedIncidents: expected,
            dryBaseline: dry?.avg ?? null,
            lift: expected !== null && dry?.avg ? +(expected / dry.avg).toFixed(2) : null,
            samples: hit?.samples ?? 0,
        };
    }).sort((a, b) => (b.expectedIncidents ?? 0) - (a.expectedIncidents ?? 0));
    const total = rows.reduce((s, r) => s + (r.expectedIncidents || 0), 0);
    const dryTotal = rows.reduce((s, r) => s + (r.dryBaseline || 0), 0);
    res.json({
        rainMm: rain,
        lagDays,
        band: bin,
        expectedTotal: +total.toFixed(1),
        dryTotal: +dryTotal.toFixed(1),
        cityLift: dryTotal ? +(total / dryTotal).toFixed(2) : null,
        wards: rows,
        method: `Average incidents observed ${lagDays * 24}h after historical ward-days in the "${bin.label}" rain band (${m.dateRange.from} → ${m.dateRange.to}).`,
    });
}));

// GET /api/bda/quality — veracity funnel, dedup audit, image cleaning
router.get('/quality', protect, admin, guard((req, res, m) => {
    res.json({
        veracity: m.veracity,
        dedupAudit: m.dedupAudit,
        cleanComparison: m.cleanComparison,
        edaSummary: m.edaSummary,
        ingest: m.ingest,
        layers: m.layers,
    });
}));

// ── MLlib forecast (spark/08_mllib_forecast.py) ──────────────────────────────

const ML = path.join(LAKE, 'gold/ml');
const STATIONS = [
    { id: 'COLABA', name: 'Colaba', lat: 18.9067, lon: 72.8147 },
    { id: 'SANTACRUZ', name: 'Santacruz', lat: 19.0896, lon: 72.8656 },
    { id: 'BORIVALI', name: 'Borivali', lat: 19.2307, lon: 72.8567 },
    { id: 'CHEMBUR', name: 'Chembur', lat: 19.0522, lon: 72.9005 },
    { id: 'MULUND', name: 'Mulund', lat: 19.1726, lon: 72.9425 },
];

function loadMl() {
    const metricsFile = path.join(ML, 'forecast_metrics.json');
    if (!exists(metricsFile)) return null;
    const scen = readCsv(path.join(ML, 'scenario_predictions.csv'));
    // scenario[ward][horizon] = sorted [{rain, y}]
    const scenario = {};
    for (const r of scen) {
        ((scenario[r.ward_id] ||= {})[r.horizon_days] ||= []).push({ rain: r.rain_mm, y: r.predicted_incidents });
    }
    Object.values(scenario).forEach((byH) => Object.values(byH).forEach((list) => list.sort((a, b) => a.rain - b.rain)));
    return {
        metrics: readJson(metricsFile),
        importance: readCsv(path.join(ML, 'feature_importance.csv')),
        test: readCsv(path.join(ML, 'test_predictions.csv')),
        scen,
        scenario,
        updatedAt: mtime(metricsFile),
    };
}

/** Piecewise-linear lookup on a model scenario curve. */
function curveAt(list, rain) {
    if (!list?.length) return 0;
    if (rain <= list[0].rain) return list[0].y;
    for (let i = 1; i < list.length; i++) {
        if (rain <= list[i].rain) {
            const a = list[i - 1];
            const b = list[i];
            return a.y + ((b.y - a.y) * (rain - a.rain)) / (b.rain - a.rain);
        }
    }
    return list[list.length - 1].y;
}

// GET /api/bda/ml — model metrics, importances, hold-out fit, scenario curves
router.get('/ml', protect, admin, guard((req, res, m) => {
    const ml = loadMl();
    if (!ml) return res.status(503).json({ message: 'MLlib outputs not found. Run bda/scripts/run_ml.sh under WSL.' });
    const rains = [...new Set(ml.scen.map((r) => r.rain_mm))].sort((a, b) => a - b);
    const city = rains.map((rain) => {
        const row = { rain };
        for (const h of [0, 1, 2, 3]) row[`h${h}`] = +ml.scen.filter((r) => r.rain_mm === rain && r.horizon_days === h).reduce((s, r) => s + r.predicted_incidents, 0).toFixed(2);
        return row;
    });
    const wardAt65 = m.wards.map((w) => {
        const curve = ml.scenario[w.id]?.[2] || [];
        return { id: w.id, name: w.name, tier: w.tier, dry: curveAt(curve, 0), heavy: curveAt(curve, 65) };
    }).sort((a, b) => b.heavy - a.heavy);
    res.json({ ...ml.metrics, importance: ml.importance, test: ml.test, cityScenario: city, wardAt65, updatedAt: ml.updatedAt });
}));

// ── Live outlook: real Open-Meteo forecast → MLlib scenario curves ───────────

let outlookCache = { at: 0, data: null };

async function fetchForecast() {
    const lat = STATIONS.map((s) => s.lat).join(',');
    const lon = STATIONS.map((s) => s.lon).join(',');
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,precipitation_probability_max&past_days=3&forecast_days=4&timezone=Asia%2FKolkata`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    try {
        const r = await fetch(url, { signal: ctrl.signal });
        if (!r.ok) throw new Error(`Open-Meteo responded ${r.status}`);
        const body = await r.json();
        const list = Array.isArray(body) ? body : [body];
        return STATIONS.map((s, i) => ({
            ...s,
            dates: list[i].daily.time,
            rain: list[i].daily.precipitation_sum.map((v) => v ?? 0),
            probability: list[i].daily.precipitation_probability_max ?? [],
        }));
    } finally {
        clearTimeout(t);
    }
}

// GET /api/bda/outlook — next 4 days of expected incidents per ward from the live forecast
router.get('/outlook', protect, admin, guard(async (req, res, m) => {
    const ml = loadMl();
    if (!ml) return res.status(503).json({ message: 'MLlib outputs not found. Run bda/scripts/run_ml.sh under WSL.' });
    if (!outlookCache.data || Date.now() - outlookCache.at > 30 * 60 * 1000) {
        outlookCache = { at: Date.now(), data: await fetchForecast() };
    }
    const stations = outlookCache.data;
    const byStation = Object.fromEntries(stations.map((s) => [s.id, s]));
    const dates = stations[0].dates;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const startIdx = Math.max(0, dates.indexOf(today));
    const days = dates.slice(startIdx);

    // Expected(T) = no-rain level + Σ_k [curve_k(rain on T-k) − curve_k(0)], k = 0..3.
    // Superposes the model's single-storm responses over the last four days.
    const wards = m.wards.map((w) => {
        const st = byStation[w.station] || stations[0];
        const curves = ml.scenario[w.id] || {};
        const series = days.map((date, j) => {
            const i = startIdx + j;
            let y = curveAt(curves[0], 0);
            for (let k = 0; k <= 3; k++) {
                const rain = st.rain[i - k] ?? 0;
                y += curveAt(curves[k], rain) - curveAt(curves[k], 0);
            }
            return { date, rainMm: st.rain[i] ?? 0, probability: st.probability[i] ?? null, expected: +Math.max(0, y).toFixed(2) };
        });
        const normal = curveAt(curves[0], 0);
        const peak = series.reduce((a, b) => (b.expected > a.expected ? b : a), series[0]);
        return { id: w.id, name: w.name, zone: w.zone, tier: w.tier, lat: w.lat, lon: w.lon, station: st.id, normal: +normal.toFixed(2), peak, series };
    }).sort((a, b) => b.peak.expected - a.peak.expected);

    const city = days.map((date, j) => ({
        date,
        rainMm: +(stations.reduce((s, st) => s + (st.rain[startIdx + j] ?? 0), 0) / stations.length).toFixed(1),
        expected: +wards.reduce((s, w) => s + w.series[j].expected, 0).toFixed(1),
        normal: +wards.reduce((s, w) => s + w.normal, 0).toFixed(1),
    }));

    res.json({
        fetchedAt: new Date(outlookCache.at).toISOString(),
        source: 'Open-Meteo forecast API (live) · MLlib RandomForest scenario curves',
        method: 'Expected incidents on day T = no-rain level + the model’s response to rain on T, T-1, T-2 and T-3 (single-storm curves superposed).',
        stations: stations.map((s) => ({ id: s.id, name: s.name, dates: s.dates, rain: s.rain, probability: s.probability })),
        city,
        wards,
    });
}));

// ── Patterns from the bronze event history ───────────────────────────────────

let patternsCache = null;

async function buildPatterns() {
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const heat = DAYS.map(() => Array(24).fill(0));
    const deptMonth = {};
    const category = {};
    const severityByCat = {};
    const status = {};
    const source = {};
    const accuracy = [0, 0, 0, 0, 0, 0];
    const ACC_EDGES = [5, 10, 20, 50, 100, Infinity];
    let total = 0;
    let emergency = 0;
    let anonymous = 0;
    const rl = readline.createInterface({ input: fs.createReadStream(P.bronzeHistory), crlfDelay: Infinity });
    for await (const line of rl) {
        if (!line.trim()) continue;
        let e;
        try { e = JSON.parse(line); } catch { continue; }
        total++;
        const at = new Date(e.created_at);
        if (!Number.isNaN(at.getTime())) {
            heat[(at.getDay() + 6) % 7][at.getHours()]++;
            const mo = e.created_at.slice(0, 7);
            const d = e.department_tag || 'Unknown';
            ((deptMonth[d] ||= {})[mo] = (deptMonth[d][mo] || 0) + 1);
        }
        category[e.category] = (category[e.category] || 0) + 1;
        const sc = (severityByCat[e.category] ||= {});
        sc[e.ai_severity] = (sc[e.ai_severity] || 0) + 1;
        status[e.status] = (status[e.status] || 0) + 1;
        source[e.location_source] = (source[e.location_source] || 0) + 1;
        if (e.emergency) emergency++;
        if (e.anonymous) anonymous++;
        const acc = Number(e.location_accuracy_meters);
        if (Number.isFinite(acc)) accuracy[ACC_EDGES.findIndex((x) => acc <= x)]++;
    }
    const months = [...new Set(Object.values(deptMonth).flatMap((x) => Object.keys(x)))].sort();
    return {
        total,
        emergencyShare: total ? +(emergency / total).toFixed(4) : 0,
        anonymousShare: total ? +(anonymous / total).toFixed(4) : 0,
        heatmap: { days: DAYS, matrix: heat },
        departmentMonth: {
            months,
            rows: Object.entries(deptMonth)
                .map(([dept, byM]) => ({ dept, total: Object.values(byM).reduce((a, b) => a + b, 0), values: months.map((mo) => byM[mo] || 0) }))
                .sort((a, b) => b.total - a.total),
        },
        categories: Object.entries(category).map(([name, count]) => ({ name, count, severity: severityByCat[name] })).sort((a, b) => b.count - a.count),
        status: Object.entries(status).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
        source: Object.entries(source).map(([name, count]) => ({ name, count })),
        accuracy: ['≤5 m', '5–10 m', '10–20 m', '20–50 m', '50–100 m', '>100 m'].map((label, i) => ({ label, count: accuracy[i] })),
        updatedAt: mtime(P.bronzeHistory),
    };
}

// GET /api/bda/patterns — when, what and how citizens report (bronze history)
router.get('/patterns', protect, admin, guard(async (req, res) => {
    const m = mtime(P.bronzeHistory);
    if (!patternsCache || patternsCache.updatedAt !== m) patternsCache = await buildPatterns();
    res.json(patternsCache);
}));

// ── Pipeline catalog + figures ───────────────────────────────────────────────

const BDA_ROOT = path.resolve(DATA_DIR, '..');
const FIGURES = path.join(BDA_ROOT, 'reports/figures');
const JOBS = [
    { id: 'kafka', name: 'Kafka producer → consumer', tech: 'Apache Kafka', script: 'kafka/consumer_to_lake.py', does: 'Streams civic report events through the broker and lands them in bronze.', outputs: ['bronze/events/kafka_events_latest.jsonl'] },
    { id: 'rain', name: 'Rainfall ingest', tech: 'Python · Open-Meteo ERA5', script: 'scripts/fetch_rainfall.py', does: 'Pulls a full year of real daily rainfall for 5 Mumbai stations.', outputs: ['bronze/weather/rainfall_raw.jsonl'] },
    { id: '01', name: 'Ingest image metadata', tech: 'Spark SQL', script: 'spark/01_ingest_metadata.py', does: 'Reads the road-damage image catalog into a Parquet spine.', outputs: ['bronze/image_metadata/metadata_raw'] },
    { id: '02', name: 'Exploratory analysis', tech: 'Spark SQL', script: 'spark/02_eda.py', does: 'Profiles labels, corruption, duplicates and class balance.', outputs: ['gold/analytics/eda_summary.json'] },
    { id: '03', name: 'Clean images', tech: 'Spark SQL', script: 'spark/03_clean.py', does: 'Removes corrupt, unlabelled and duplicate images.', outputs: ['gold/analytics/clean_comparison.json', 'silver/cleaned_images/metadata_clean'] },
    { id: '04', name: 'Analytics scorecards', tech: 'Spark SQL', script: 'spark/04_analytics.py', does: 'Severity, status and ward hotspot scorecards.', outputs: ['gold/analytics/ward_hotspots.csv', 'gold/analytics/severity_scorecard.csv'] },
    { id: '05', name: 'Events → silver', tech: 'Spark SQL · GraphFrames-style dedup', script: 'spark/05_events_silver.py', does: 'Veracity checks, ward attribution, spatio-temporal duplicate graph.', outputs: ['gold/analytics/veracity_report.json', 'gold/analytics/dedup_audit.csv', 'silver/events_clean/reports'] },
    { id: '06', name: 'Rain × complaint fusion', tech: 'Spark SQL · window functions', script: 'spark/06_fusion.py', does: 'Ward × date join, lag surge analysis, Civic Vulnerability Index.', outputs: ['gold/fusion/ward_date_fused_gold.csv', 'gold/fusion/lag_correlation.json', 'gold/fusion/ward_vulnerability.csv'] },
    { id: '07', name: 'Live city pulse', tech: 'Spark Structured Streaming', script: 'spark/07_stream_pulse.py', does: 'Windowed counts on the Kafka stream; raises ward alerts above a threshold.', outputs: ['gold/analytics/_stream_checkpoint'] },
    { id: '08', name: 'Complaint forecast', tech: 'Spark MLlib · RandomForest + LinearRegression', script: 'spark/08_mllib_forecast.py', does: 'Predicts ward incidents from lagged rainfall; feeds the live outlook.', outputs: ['gold/ml/forecast_metrics.json', 'gold/ml/scenario_predictions.csv', 'gold/ml/rf_model'] },
];

// GET /api/bda/jobs — what each pipeline stage does and when it last wrote output
router.get('/jobs', protect, admin, (req, res) => {
    const jobs = JOBS.map((j) => {
        const outs = j.outputs.map((o) => {
            const p = path.join(LAKE, o);
            return { path: o, updatedAt: mtime(p), exists: exists(p) };
        });
        const times = outs.map((o) => o.updatedAt).filter(Boolean).sort();
        return { ...j, outputs: outs, lastRun: times[times.length - 1] || null, status: outs.every((o) => o.exists) ? 'ok' : outs.some((o) => o.exists) ? 'partial' : 'missing' };
    });
    let figures = [];
    try {
        figures = fs.readdirSync(FIGURES).filter((f) => /^[\w-]+\.png$/.test(f)).filter((f) => !f.startsWith('yolo')).map((f) => ({ name: f, updatedAt: mtime(path.join(FIGURES, f)) }));
    } catch { /* no figures yet */ }
    res.json({ jobs, figures });
});

// GET /api/bda/figures/:name — matplotlib charts written by the Spark jobs
// (aggregate charts only; served without auth so <img> tags can load them)
router.get('/figures/:name', (req, res) => {
    const name = req.params.name;
    if (!/^[\w-]+\.png$/.test(name)) return res.status(400).end();
    const file = path.join(FIGURES, name);
    if (!exists(file)) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=300').sendFile(file);
});

module.exports = router;
