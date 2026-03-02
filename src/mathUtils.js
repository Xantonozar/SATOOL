import { ASTM_FINE_LIMITS, ASTM_COARSE_LIMITS, ASTM_COMBINED_LIMITS } from './constants.js';

// ─── Table calculations ──────────────────────────────────────────────────────
export function calcTableData(rows, totalWeight) {
    if (!rows || rows.length === 0 || totalWeight <= 0) {
        return rows.map(r => ({ ...r, pctRetained: 0, cumRetained: 0, pctFiner: 100 }));
    }
    let cum = 0;
    return rows.map(row => {
        const pctRetained = (row.weight / totalWeight) * 100;
        cum += pctRetained;
        const pctFiner = Math.max(0, 100 - cum);
        return { ...row, pctRetained, cumRetained: cum, pctFiner };
    });
}

// ─── Pan row calculation ─────────────────────────────────────────────────────
export function calcPanWeight(rows, totalWeight) {
    const sumSieves = rows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0);
    return Math.max(0, totalWeight - sumSieves);
}

// ─── Log-linear interpolation for D-values ───────────────────────────────────
// tableData MUST be sorted descending by size (largest sieve first).
// pctFiner DECREASES as sieve size decreases:
//   Largest sieve (19mm) → highest pctFiner (e.g. 83%)
//   Smallest sieve (0.075mm) → lowest pctFiner (e.g. 0%)
// Returns the particle diameter (mm) at which % finer = targetPct
export function interpolateDValue(tableData, targetPct) {
    if (!tableData || tableData.length === 0) return null;

    // Add a pan boundary point at 10% of smallest sieve size with pctFiner = 0
    const smallestSieve = tableData[tableData.length - 1];
    const panBoundary = { size: smallestSieve.size * 0.1, pctFiner: 0 };
    const extended = [...tableData, panBoundary];

    // Scan from largest to smallest sieve — pctFiner decreases each step
    for (let i = 0; i < extended.length - 1; i++) {
        const hi = extended[i];      // larger sieve → higher pctFiner
        const lo = extended[i + 1]; // smaller sieve → lower pctFiner
        // Does targetPct fall in the interval [lo.pctFiner, hi.pctFiner]?
        if (hi.pctFiner >= targetPct && lo.pctFiner <= targetPct) {
            if (hi.pctFiner === lo.pctFiner) return hi.size;
            // Log-linear interpolation: t=0 at hi, t=1 at lo
            const logD1 = Math.log10(hi.size);
            const logD2 = Math.log10(lo.size);
            const t = (hi.pctFiner - targetPct) / (hi.pctFiner - lo.pctFiner);
            return Math.pow(10, logD1 + t * (logD2 - logD1));
        }
    }
    return null;
}

// ─── Coefficient calculations ────────────────────────────────────────────────
export function calcCoefficients(d10, d30, d60) {
    if (!d10 || !d30 || !d60 || d10 === 0) return { Cu: null, Cc: null };
    const Cu = d60 / d10;
    const Cc = (d30 * d30) / (d10 * d60);
    return { Cu, Cc };
}

// ─── Aggregate type detection ────────────────────────────────────────────────
export function classifyAggregateType(tableData, totalWeight) {
    if (!tableData || tableData.length === 0 || totalWeight <= 0) return 'unknown';
    let coarseWeight = 0;
    let fineWeight = 0;
    tableData.forEach(row => {
        if (row.size >= 4.75) coarseWeight += (row.weight || 0);
        else fineWeight += (row.weight || 0);
    });
    const coarsePct = (coarseWeight / totalWeight) * 100;
    const finePct = (fineWeight / totalWeight) * 100;
    if (coarsePct >= 50) return 'coarse';
    if (finePct >= 50) return 'fine';
    return 'mixed';
}

// ─── Grading classification ───────────────────────────────────────────────────
export function classifyGrading(Cu, Cc, aggregateType, isASTMCompliant = true) {
    if (Cu === null || Cc === null || !isFinite(Cu) || !isFinite(Cc)) {
        return { label: 'Insufficient Data', symbol: '—', colorClass: 'badge-unknown', color: '#9ca3af' };
    }
    // For fine aggregates: Cu threshold = 6 (SW rules)
    // For coarse or mixed aggregates: Cu threshold = 4 (GW rules)
    const thresholdCu = aggregateType === 'fine' ? 6 : 4;
    const ccOk = Cc >= 1 && Cc <= 3;
    const cuOk = Cu >= thresholdCu;

    // Is it fundamentally well-graded by USCS?
    const isWGBase = cuOk && ccOk;

    if (!isASTMCompliant) {
        // Technically it might be SW or GW by USCS, but it violates the ASTM specification envelope
        const symbol = aggregateType === 'fine' ? 'SP' : (aggregateType === 'coarse' ? 'GP' : 'GP-SP');
        return { label: 'Non-Compliant (Outside ASTM)', symbol: '⚠️', colorClass: 'badge-poorly-graded', color: '#dc2626' };
    }

    if (isWGBase) {
        const symbol = aggregateType === 'fine' ? 'SW' : (aggregateType === 'coarse' ? 'GW' : 'GW-SW');
        return { label: 'Well-Graded', symbol, colorClass: 'badge-well-graded', color: '#16a34a' };
    }
    if (cuOk && !ccOk) {
        const symbol = aggregateType === 'fine' ? 'SW-SC' : (aggregateType === 'coarse' ? 'GW-GC' : 'GP-SP');
        return { label: 'Gap-Graded', symbol, colorClass: 'badge-gap-graded', color: '#d97706' };
    }
    const symbol = aggregateType === 'fine' ? 'SP' : (aggregateType === 'coarse' ? 'GP' : 'GP-SP');
    return { label: 'Poorly-Graded', symbol, colorClass: 'badge-poorly-graded', color: '#dc2626' };
}


// ─── ASTM limit interpolation at a specific size ─────────────────────────────
export function interpolateASTMLimit(size, limits, field) {
    const sorted = [...limits].sort((a, b) => a.size - b.size);
    if (size <= sorted[0].size) return sorted[0][field];
    if (size >= sorted[sorted.length - 1].size) return sorted[sorted.length - 1][field];
    for (let i = 0; i < sorted.length - 1; i++) {
        if (size >= sorted[i].size && size <= sorted[i + 1].size) {
            const t = (Math.log10(size) - Math.log10(sorted[i].size)) /
                (Math.log10(sorted[i + 1].size) - Math.log10(sorted[i].size));
            return sorted[i][field] + t * (sorted[i + 1][field] - sorted[i][field]);
        }
    }
    return null;
}

// ─── Check if sieve curve falls entirely within ASTM Limits ──────────────────
export function checkASTMCompliance(tableData, limits) {
    if (!limits || !tableData || tableData.length === 0) return true;
    for (const row of tableData) {
        const min = interpolateASTMLimit(row.size, limits, 'min');
        const max = interpolateASTMLimit(row.size, limits, 'max');
        // Allow a tiny 0.1% rounding tolerance
        if (min !== null && max !== null) {
            if (row.pctFiner > max + 0.1 || row.pctFiner < min - 0.1) {
                return false;
            }
        }
    }
    return true;
}


// ─── Get ASTM limits for detected aggregate type ─────────────────────────────
// If user's sieves span both coarse (>9.5mm) and fine (<4.75mm) ranges,
// always use combined limits so the optimizer won't zero out either side.
export function getASTMLimits(aggregateType, sieveSizes = []) {
    if (sieveSizes.length > 0) {
        const maxSize = Math.max(...sieveSizes);
        const minSize = Math.min(...sieveSizes);
        // Sieves span both coarse and fine → use combined limits
        if (maxSize > 9.5 && minSize < 4.75) return ASTM_COMBINED_LIMITS;
    }
    if (aggregateType === 'coarse') return ASTM_COARSE_LIMITS;
    if (aggregateType === 'fine') return ASTM_FINE_LIMITS;
    return ASTM_COMBINED_LIMITS;
}

// ─── ASTM blend curve (t in 0..1) at specified sieve sizes ───────────────────
export function astmBlendCurveAtSizes(sizes, limits, t) {
    return sizes.map(size => {
        const lower = interpolateASTMLimit(size, limits, 'min');
        const upper = interpolateASTMLimit(size, limits, 'max');
        if (lower === null || upper === null) return null;
        return { size, pctFiner: lower + t * (upper - lower) };
    }).filter(Boolean);
}

// ─── ASTM limit curve (for graph) at many sizes ──────────────────────────────
export function astmLimitCurve(limits, field, graphSizes) {
    return graphSizes.map(size => {
        const val = interpolateASTMLimit(size, limits, field);
        return { size, pctFiner: val };
    }).filter(p => p.pctFiner !== null);
}

// ─── Optimization: redistribute weights toward a target % finer ──────────────
export function optimizeWeights(rows, targetFiner, totalWeight) {
    if (!rows || rows.length === 0 || totalWeight <= 0) return rows;

    const targetMap = {};
    targetFiner.forEach(p => { targetMap[p.size] = p.pctFiner; });

    // Convert target % finer → target % retained per sieve (descending order)
    const sortedRows = [...rows].sort((a, b) => b.size - a.size);
    const targetRetained = [];
    let prevFiner = 100;
    for (const row of sortedRows) {
        const tFiner = targetMap[row.size] ?? prevFiner;
        targetRetained.push({
            id: row.id,
            size: row.size,
            locked: row.locked,
            targetPctRet: Math.max(0, prevFiner - tFiner),
        });
        prevFiner = tFiner;
    }

    // Locked sieves keep original weight; unlocked get remaining budget
    const lockedTotal = rows.reduce((s, r) => s + (r.locked ? (parseFloat(r.weight) || 0) : 0), 0);
    const budget = Math.max(0, totalWeight - lockedTotal);

    const unlockedTargets = targetRetained.filter(r => !r.locked);
    const sumUnlockedTargetPct = unlockedTargets.reduce((s, r) => s + r.targetPctRet, 0);

    const newWeightMap = {};
    rows.forEach(r => {
        if (r.locked) newWeightMap[r.id] = parseFloat(r.weight) || 0;
    });
    unlockedTargets.forEach(r => {
        const fraction = sumUnlockedTargetPct > 0
            ? r.targetPctRet / sumUnlockedTargetPct
            : 1 / unlockedTargets.length;
        newWeightMap[r.id] = Math.max(0, fraction * budget);
    });

    // Renormalize to exact total
    const computedTotal = Object.values(newWeightMap).reduce((s, w) => s + w, 0);
    const scaleFactor = computedTotal > 0 ? totalWeight / computedTotal : 1;

    return rows.map(row => ({
        ...row,
        weight: parseFloat((newWeightMap[row.id] * scaleFactor).toFixed(2)),
    }));
}

// ─── Generate ASTM limit curves at graph tick positions ───────────────────────
export function generateASTMLimitCurves(limits, graphTicks) {
    const upper = graphTicks.map(s => {
        const val = interpolateASTMLimit(s, limits, 'max');
        return val !== null ? { size: s, pctFiner: val } : null;
    }).filter(Boolean);
    const lower = graphTicks.map(s => {
        const val = interpolateASTMLimit(s, limits, 'min');
        return val !== null ? { size: s, pctFiner: val } : null;
    }).filter(Boolean);
    return { upper, lower };
}

// ─── Validate sieve rows ──────────────────────────────────────────────────────
export function validateRows(rows, totalWeight) {
    const warnings = [];
    if (totalWeight === 0) warnings.push('Enter aggregate weights to begin analysis.');
    const withWeight = rows.filter(r => (parseFloat(r.weight) || 0) > 0);
    if (totalWeight > 0 && withWeight.length < 2) {
        warnings.push('At least 2 sieves must have weight for grading analysis.');
    }
    rows.forEach(r => {
        if ((parseFloat(r.weight) || 0) < 0) {
            warnings.push(`Negative weight entered for ${r.size} mm sieve.`);
        }
    });
    const sizes = rows.map(r => r.size);
    const dupes = sizes.filter((s, i) => sizes.indexOf(s) !== i);
    if (dupes.length > 0) {
        warnings.push(`Duplicate sieve size: ${[...new Set(dupes)].join(', ')} mm.`);
    }
    return warnings;
}

// ─── Format numbers for display ──────────────────────────────────────────────
export function fmt(val, decimals = 2) {
    if (val === null || val === undefined || !isFinite(val)) return '—';
    return val.toFixed(decimals);
}

// ─── Monotone cubic Hermite spline for smooth semi-log PSD curves ─────────────
// Implements the Fritsch-Carlson algorithm in log10(size) space.
// This is the same method Excel uses for its "smooth line" option.
// Result: passes exactly through all data points, no kinks, no overshoots.
export function densifySemiLog(points, numOutputPoints = 200) {
    if (!points || points.length < 2) return points || [];
    // 1. Clean and sort ascending by size
    const sorted = [...points]
        .filter(p => p && p.size > 0 && isFinite(p.size) && isFinite(p.pctFiner))
        .sort((a, b) => a.size - b.size);
    if (sorted.length < 2) return sorted;

    // 2. Work in log10(size) space — x = log10(size), y = pctFiner
    const xs = sorted.map(p => Math.log10(p.size));
    const ys = sorted.map(p => p.pctFiner);
    const n = xs.length;

    // 3. Compute secant slopes between consecutive points
    const delta = [];
    for (let i = 0; i < n - 1; i++) {
        delta.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    }

    // 4. Initialize tangents (Catmull-Rom for interior, one-sided for ends)
    const m = new Array(n);
    m[0] = delta[0];
    m[n - 1] = delta[n - 2];
    for (let i = 1; i < n - 1; i++) {
        m[i] = (delta[i - 1] + delta[i]) / 2;
    }

    // 5. Fritsch-Carlson monotonicity conditions
    for (let i = 0; i < n - 1; i++) {
        if (Math.abs(delta[i]) < 1e-10) {
            // Flat segment — force zero tangents at both ends
            m[i] = 0;
            m[i + 1] = 0;
        } else {
            const alpha = m[i] / delta[i];
            const beta = m[i + 1] / delta[i];
            const tau = alpha * alpha + beta * beta;
            if (tau > 9) {
                // Rescale to satisfy monotonicity
                const scale = 3 / Math.sqrt(tau);
                m[i] = scale * alpha * delta[i];
                m[i + 1] = scale * beta * delta[i];
            }
        }
    }

    // 6. Generate dense output points evenly spaced on log scale
    const xMin = xs[0];
    const xMax = xs[n - 1];
    const result = [];

    for (let k = 0; k <= numOutputPoints; k++) {
        const x = xMin + (k / numOutputPoints) * (xMax - xMin);

        // Find which segment x falls into (binary-ish scan)
        let seg = 0;
        for (let i = 0; i < n - 2; i++) {
            if (x >= xs[i]) seg = i;
        }

        const h = xs[seg + 1] - xs[seg];
        const t = (x - xs[seg]) / h;
        const t2 = t * t;
        const t3 = t2 * t;

        // Cubic Hermite basis functions
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        const y = h00 * ys[seg] + h10 * h * m[seg] + h01 * ys[seg + 1] + h11 * h * m[seg + 1];

        result.push({
            size: Math.pow(10, x),
            pctFiner: Math.max(0, Math.min(100, y)),
        });
    }

    return result;
}

