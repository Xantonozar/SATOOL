// ═══════════════════════════════════════════════════════════════════════════════
// scoringUtils.js — Multi-Method Score-Based PSD Curve Quality Assessment
// ═══════════════════════════════════════════════════════════════════════════════
//
// 5 quality metrics (M1–M5) are computed for each candidate curve:
//   M1 — Monotonicity:  % finer must always decrease as sieve size decreases
//   M2 — Concavity:     A perfect S-curve has exactly 1 inflection point
//   M3 — Gap check:     No flat plateaus (stagnant regions)
//   M4 — Steepness:     Weight spread uniformly, not concentrated in one zone
//   M5 — Sigmoid R²:    Overall fit to the ideal logistic/sigmoid shape
//
// Each metric is normalized to 0–1 and combined via weighted average.
// ═══════════════════════════════════════════════════════════════════════════════

import {
    optimizeWeights, calcTableData, interpolateDValue,
    calcCoefficients, classifyGrading, checkASTMCompliance,
    astmBlendCurveAtSizes, classifyAggregateType,
} from './mathUtils.js';

// ─── M1: Monotonicity Check ──────────────────────────────────────────────────
// % finer should always decrease (or stay equal) as sieve size decreases.
// Returns { pass: boolean, violations: number }
export function checkMonotonicity(tableData) {
    if (!tableData || tableData.length < 2) return { pass: true, violations: 0 };
    // tableData is sorted descending by size (largest first)
    let violations = 0;
    for (let i = 0; i < tableData.length - 1; i++) {
        // pctFiner should decrease or stay equal going from large to small
        if (tableData[i + 1].pctFiner > tableData[i].pctFiner + 0.01) {
            violations++;
        }
    }
    return { pass: violations === 0, violations };
}

// ─── M2: S-Curve Concavity / Inflection Point Count ─────────────────────────
// A proper S-curve (sigmoid) has exactly 1 inflection point.
// We detect inflection points by looking at changes in the sign of the
// second derivative (approximated as difference of differences in log-space).
export function checkSCurveConcavity(tableData) {
    if (!tableData || tableData.length < 3) return { inflectionCount: 0 };
    // Work in log(size) space for proper semi-log analysis
    const pts = tableData.map(r => ({
        x: Math.log10(r.size),
        y: r.pctFiner,
    }));

    // Compute first derivatives (slopes between consecutive points)
    const d1 = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const dx = pts[i + 1].x - pts[i].x;
        if (Math.abs(dx) < 1e-10) continue;
        d1.push((pts[i + 1].y - pts[i].y) / dx);
    }

    // Compute second derivatives
    const d2 = [];
    for (let i = 0; i < d1.length - 1; i++) {
        d2.push(d1[i + 1] - d1[i]);
    }

    // Count sign changes in second derivative = inflection points
    let inflections = 0;
    for (let i = 0; i < d2.length - 1; i++) {
        if (d2[i] * d2[i + 1] < 0) inflections++;
    }

    return { inflectionCount: inflections };
}

// ─── M3: Gap/Plateau Check ──────────────────────────────────────────────────
// Detects flat regions where the % finer doesn't change significantly
// across a wide range of sieve sizes. Each gap reduces curve quality.
export function checkForGaps(tableData, threshold = 2) {
    if (!tableData || tableData.length < 2) return { gaps: [] };
    const gaps = [];
    for (let i = 0; i < tableData.length - 1; i++) {
        const drop = Math.abs(tableData[i].pctFiner - tableData[i + 1].pctFiner);
        if (drop < threshold) {
            gaps.push({
                from: tableData[i].size,
                to: tableData[i + 1].size,
                drop,
            });
        }
    }
    return { gaps };
}

// ─── M4: Steepness / Concentration Ratio ────────────────────────────────────
// Measures how much of the total % finer drop is concentrated in a single
// segment. A perfectly uniform curve has equal drops; a step-function
// has 100% concentration in one segment.
export function checkSteepness(tableData) {
    if (!tableData || tableData.length < 2) return { concentrationRatio: 0 };
    const drops = [];
    for (let i = 0; i < tableData.length - 1; i++) {
        drops.push(Math.abs(tableData[i].pctFiner - tableData[i + 1].pctFiner));
    }
    const totalDrop = drops.reduce((s, d) => s + d, 0);
    if (totalDrop < 0.1) return { concentrationRatio: 0 };
    const maxDrop = Math.max(...drops);
    const concentrationRatio = (maxDrop / totalDrop) * 100;
    return { concentrationRatio };
}

// ─── M5: Sigmoid Fit (R² against ideal logistic curve) ──────────────────────
// Fits pctFiner ~ 100 / (1 + exp(-k * (log10(size) - x0)))
// using least-squares in log(size) space. Returns R² in [0, 1].
export function calculateRSquaredSigmoid(tableData) {
    if (!tableData || tableData.length < 3) return { rSquared: 0, params: null };

    const pts = tableData
        .filter(r => r.size > 0 && isFinite(r.pctFiner))
        .map(r => ({ x: Math.log10(r.size), y: r.pctFiner }));

    if (pts.length < 3) return { rSquared: 0, params: null };

    // Estimate sigmoid parameters via grid search
    // Sigmoid: y = 100 / (1 + exp(-k * (x - x0)))
    const xMin = Math.min(...pts.map(p => p.x));
    const xMax = Math.max(...pts.map(p => p.x));
    const xMid = (xMin + xMax) / 2;
    const xRange = xMax - xMin;

    let bestR2 = -Infinity;
    let bestK = 1;
    let bestX0 = xMid;

    // Grid search for best k and x0
    for (let ki = 1; ki <= 20; ki++) {
        const k = ki * (10 / (xRange || 1));
        for (let xi = 0; xi <= 10; xi++) {
            const x0 = xMin + (xi / 10) * xRange;

            // Compute predicted values and R²
            let ssRes = 0, ssTot = 0;
            const yMean = pts.reduce((s, p) => s + p.y, 0) / pts.length;
            for (const p of pts) {
                const yPred = 100 / (1 + Math.exp(-k * (p.x - x0)));
                ssRes += (p.y - yPred) ** 2;
                ssTot += (p.y - yMean) ** 2;
            }
            const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
            if (r2 > bestR2) {
                bestR2 = r2;
                bestK = k;
                bestX0 = x0;
            }
        }
    }

    return {
        rSquared: Math.max(0, bestR2),
        params: { k: bestK, x0: bestX0 },
    };
}

// ─── Normalize All 5 Checks to 0–1 Scale ────────────────────────────────────
export function normalizeAllChecks(tableData) {
    const m1 = checkMonotonicity(tableData);
    const m2 = checkSCurveConcavity(tableData);
    const m3 = checkForGaps(tableData, 2);
    const m4 = checkSteepness(tableData);
    const m5 = calculateRSquaredSigmoid(tableData);

    // S1: Monotonic (Pass=1, Fail=0)
    const S1 = m1.pass ? 1.0 : 0.0;

    // S2: Inflection count — exactly 1 is ideal
    const S2 = m2.inflectionCount === 1 ? 1.0
        : m2.inflectionCount === 0 ? 0.0
            : Math.max(0, 1 - (m2.inflectionCount - 1) * 0.4);

    // S3: Gap penalty — no gaps = 1.0, each gap reduces by 0.25
    const S3 = Math.max(0, 1.0 - m3.gaps.length * 0.25);

    // S4: Steepness — low concentration = better
    const ratio = m4.concentrationRatio / 100;
    const S4 = Math.max(0, 1.0 - ratio);

    // S5: R² sigmoid fit — already 0–1
    const S5 = Math.max(0, m5.rSquared);

    return { S1, S2, S3, S4, S5 };
}

// ─── Weighted Combined Score ─────────────────────────────────────────────────
const WEIGHTS = {
    W1: 0.15,   // Monotonic     — basic requirement
    W2: 0.20,   // Concavity     — S-shape structure
    W3: 0.20,   // No gaps       — continuity
    W4: 0.15,   // Not too steep — uniformity guard
    W5: 0.30,   // R² sigmoid    — overall shape quality (highest weight)
};

export function combinedScore(tableData) {
    const { S1, S2, S3, S4, S5 } = normalizeAllChecks(tableData);

    const score =
        WEIGHTS.W1 * S1 +
        WEIGHTS.W2 * S2 +
        WEIGHTS.W3 * S3 +
        WEIGHTS.W4 * S4 +
        WEIGHTS.W5 * S5;

    return {
        score: parseFloat(score.toFixed(4)),
        breakdown: { S1, S2, S3, S4, S5 },
        grade: score >= 0.95 ? 'Perfect ★★★★★' :
            score >= 0.85 ? 'Excellent ★★★★' :
                score >= 0.70 ? 'Good ★★★' :
                    score >= 0.50 ? 'Fair ★★' : 'Poor ★',
    };
}

// ─── Generate All Candidates (scan ASTM band 0% → 100% in 5% steps) ────────
export function generateAllCandidates(rows, astmLimits, totalWeight, aggregateType) {
    const candidates = [];
    const sieveSizes = rows.map(r => r.size);

    for (let t = 0; t <= 100; t += 5) {
        // Target % finer at this blend position
        const targetFiner = astmBlendCurveAtSizes(sieveSizes, astmLimits, t / 100);

        // Optimize weights toward this target
        const optimRows = optimizeWeights(rows, targetFiner, totalWeight);
        const sorted = [...optimRows].sort((a, b) => b.size - a.size);
        const oTableData = calcTableData(sorted, totalWeight);

        // Compute grading coefficients
        const d10 = interpolateDValue(oTableData, 10);
        const d30 = interpolateDValue(oTableData, 30);
        const d60 = interpolateDValue(oTableData, 60);
        const { Cu, Cc } = calcCoefficients(d10, d30, d60);
        const isCompliant = checkASTMCompliance(oTableData, astmLimits);
        const grading = classifyGrading(Cu, Cc, aggregateType, isCompliant);
        const isWellGraded = grading.label === 'Well-Graded';

        // Score the resulting curve
        const scoreResult = combinedScore(oTableData);

        const label = t === 0 ? 'Lower Bound'
            : t === 50 ? 'Center'
                : t === 100 ? 'Upper Bound'
                    : `${t}%`;

        candidates.push({
            blendPosition: t,
            label,
            optimRows,
            tableData: oTableData,
            Cu, Cc, d10, d30, d60,
            grading,
            isWellGraded,
            isCompliant,
            score: scoreResult.score,
            grade: scoreResult.grade,
            breakdown: scoreResult.breakdown,
        });
    }

    return candidates;
}

// ─── Pick the Best Curve ─────────────────────────────────────────────────────
export function getBestCurve(rows, astmLimits, totalWeight, aggregateType) {
    const candidates = generateAllCandidates(rows, astmLimits, totalWeight, aggregateType);

    // Filter to well-graded only
    const wellGraded = candidates.filter(c => c.isWellGraded);

    let best;
    let warning = null;

    if (wellGraded.length === 0) {
        // No well-graded candidate — use best overall score
        candidates.sort((a, b) => b.score - a.score);
        best = candidates[0];
        warning = '⚠️ No candidate fully satisfies Cu/Cc well-graded criteria. Showing best approximation.';
    } else {
        // Among well-graded, pick highest combined score
        wellGraded.sort((a, b) => b.score - a.score);
        best = wellGraded[0];
    }

    // Sort all candidates by score for ranking display
    const ranked = [...candidates].sort((a, b) => b.score - a.score);

    return {
        best,
        candidates: ranked,
        wellGradedCount: wellGraded.length,
        warning,
    };
}
