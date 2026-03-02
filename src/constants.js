// ─── Standard ASTM C136 Sieve Sizes (mm, descending) ────────────────────────
export const STANDARD_SIEVES = [
    152.4, 76.2, 38.1, 19.05, 9.525,
    4.75, 2.36, 1.18, 0.600, 0.300, 0.150, 0.075,
];

// ─── US Sieve Labels: mm → US name ──────────────────────────────────────────
export const US_SIEVE_LABELS = {
    152.4: '6 in',
    76.2: '3 in',
    38.1: '1.5 in',
    19.05: '3/4 in',
    9.525: '3/8 in',
    4.75: '#4',
    2.36: '#8',
    1.18: '#16',
    0.600: '#30',
    0.300: '#50',
    0.150: '#100',
    0.075: '#200',
};

// ─── Metric Sieve Labels: mm → mm display ───────────────────────────────────
export const METRIC_SIEVES = [
    75.0, 50.0, 37.5, 25.0, 19.0, 12.5, 9.5,
    4.75, 2.36, 1.18, 0.600, 0.300, 0.150, 0.075,
];

export const METRIC_SIEVE_LABELS = {};
METRIC_SIEVES.forEach(s => {
    METRIC_SIEVE_LABELS[s] = s >= 1 ? `${s.toFixed(1)} mm` : `${s.toFixed(3)} mm`;
});

// ─── Default preloaded sieves (US format) ────────────────────────────────────
export const DEFAULT_US_SIEVE_SIZES = [
    19.05, 9.525, 4.75, 2.36, 1.18, 0.600, 0.300, 0.150, 0.075,
];

// ─── Default preloaded sieves (metric) ───────────────────────────────────────
export const DEFAULT_METRIC_SIEVE_SIZES = [
    19.0, 9.5, 4.75, 2.36, 1.18, 0.600, 0.300, 0.150, 0.075,
];

// ─── ASTM C33 Fine Aggregate Grading Limits ──────────────────────────────────
export const ASTM_FINE_LIMITS = [
    { size: 9.5, min: 100, max: 100 },
    { size: 4.75, min: 95, max: 100 },
    { size: 2.36, min: 80, max: 100 },
    { size: 1.18, min: 50, max: 85 },
    { size: 0.600, min: 25, max: 60 },
    { size: 0.300, min: 5, max: 30 },
    { size: 0.150, min: 0, max: 10 },
    { size: 0.075, min: 0, max: 5 },
];

// ─── ASTM C33 Coarse Aggregate Size No. 67 (19mm to 4.75mm) ─────────────────
export const ASTM_COARSE_LIMITS = [
    { size: 25.0, min: 100, max: 100 },
    { size: 19.0, min: 90, max: 100 },
    { size: 9.5, min: 20, max: 55 },
    { size: 4.75, min: 0, max: 10 },
    { size: 2.36, min: 0, max: 5 },
];

// ─── ASTM Combined (Full Range) Aggregate Grading Limits ─────────────────────
// Spans 25mm down to 0.075mm for mixed/combined aggregate optimization
export const ASTM_COMBINED_LIMITS = [
    { size: 25.0, min: 100, max: 100 },
    { size: 19.0, min: 90, max: 100 },
    { size: 9.5, min: 45, max: 80 },
    { size: 4.75, min: 25, max: 60 },
    { size: 2.36, min: 15, max: 45 },
    { size: 1.18, min: 8, max: 35 },
    { size: 0.600, min: 5, max: 25 },
    { size: 0.300, min: 2, max: 15 },
    { size: 0.150, min: 0, max: 8 },
    { size: 0.075, min: 0, max: 4 },
];

// ─── Graph X-axis tick positions (log scale) ─────────────────────────────────
export const GRAPH_TICKS = [0.01, 0.075, 0.150, 0.300, 0.600, 1.18, 2.36, 4.75, 9.5, 19.0, 37.5, 75.0, 100, 152.4];

// ─── Color palette ───────────────────────────────────────────────────────────
export const COLORS = {
    original: '#2563EB',
    astmUpper: '#EA580C',
    astmLower: '#EA580C',
    blend25: '#F59E0B',
    blend50: '#10B981',
    blend75: '#6366F1',
    optimAstm: '#7C3AED',
    fine: '#0EA5E9',
    coarse: '#F97316',
    mixed: '#8B5CF6',
};

// ─── Sieve format label helper ──────────────────────────────────────────────
export function getSieveLabel(size, format) {
    if (format === 'us') {
        return US_SIEVE_LABELS[size] || `${size} mm`;
    }
    return size >= 1 ? `${size.toFixed(1)} mm` : `${size.toFixed(3)} mm`;
}

// ─── Get standard sieves list for a format ──────────────────────────────────
export function getStandardSieves(format) {
    return format === 'us' ? STANDARD_SIEVES : METRIC_SIEVES;
}

export function getDefaultSieves(format) {
    return format === 'us' ? DEFAULT_US_SIEVE_SIZES : DEFAULT_METRIC_SIEVE_SIZES;
}

// ─── Random data generator ──────────────────────────────────────────────────
export function generateRandomWeights(sizes, type = 'mixed') {
    // type: 'fine', 'coarse', 'mixed', 'combined'
    const total = 800 + Math.random() * 700; // 800-1500g random total
    const n = sizes.length;
    const weights = [];
    const sorted = [...sizes].sort((a, b) => b - a); // descending

    for (let i = 0; i < n; i++) {
        const size = sizes[i];
        let w;
        if (type === 'coarse') {
            w = size >= 4.75 ? (50 + Math.random() * 200) : (Math.random() * 30);
        } else if (type === 'fine') {
            w = size <= 4.75 ? (40 + Math.random() * 150) : (Math.random() * 20);
        } else if (type === 'combined') {
            // Bell-curve: most weight in mid-range sieves for a natural S-curve PSD
            const rank = sorted.indexOf(size);
            const mid = (n - 1) / 2;
            const dist = Math.abs(rank - mid) / mid; // 0=center, 1=edge
            const bell = Math.exp(-2.5 * dist * dist);
            w = 20 + bell * (100 + Math.random() * 80);
        } else {
            // Mixed: even spread
            w = 20 + Math.random() * 120;
        }
        weights.push(w);
    }

    const rawTotal = weights.reduce((s, w) => s + w, 0);
    const scale = total / rawTotal;
    return weights.map(w => parseFloat((w * scale).toFixed(1)));
}
