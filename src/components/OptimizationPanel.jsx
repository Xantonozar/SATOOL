import React, { useState } from 'react';
import { fmt } from '../mathUtils.js';
import { getSieveLabel } from '../constants.js';

const PRESET_BUTTONS = [
    { label: 'Lower (0%)', value: 0 },
    { label: '25%', value: 25 },
    { label: 'Center (50%)', value: 50 },
    { label: '75%', value: 75 },
    { label: 'Upper (100%)', value: 100 },
];

function sliderLabel(t) {
    if (t === 0) return 'Targeting lower ASTM limit';
    if (t === 100) return 'Targeting upper ASTM limit';
    if (t === 50) return 'Targeting center of ASTM band';
    return `Targeting ${t}% toward upper limit`;
}

function ScoreBar({ value, label, color }) {
    const pct = Math.max(0, Math.min(100, value * 100));
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="w-24 text-gray-500 text-right flex-shrink-0">{label}</span>
            <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color || '#6366f1' }}
                />
            </div>
            <span className="w-10 font-mono text-right text-gray-700 font-semibold">{pct.toFixed(0)}%</span>
        </div>
    );
}

function GradeStars({ grade }) {
    const stars = grade.match(/★/g)?.length || 0;
    const label = grade.replace(/★+/, '').trim();
    return (
        <span className="flex items-center gap-1">
            <span className="text-xs text-gray-600">{label}</span>
            <span className="text-amber-400 text-xs">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
        </span>
    );
}

export default function OptimizationPanel({
    rows, tableData, totalWeight, sliderValue, onSliderChange,
    grading, aggregateType, showOptim, onOptimize,
    optimAstmRows, optimAstmTableData, optimAstmGrading,
    sieveFormat, onApplyOptimized,
    // New props for best-curve scoring
    bestCurveResult, onFindBestCurve, onApplyBestCurve,
    currentScore,
}) {
    const allLocked = rows.every(r => r.locked);
    const isWellGraded = grading.label === 'Well-Graded';
    const [showAllCandidates, setShowAllCandidates] = useState(false);

    return (
        <div className="space-y-3">
            {/* Optimize button */}
            <div className="card px-4 py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="font-semibold text-gray-900 text-sm">Well-Grade Optimization — ASTM</h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Redistribute weights to achieve a well-graded mix while keeping total weight fixed at <span className="font-mono font-semibold">{totalWeight.toFixed(1)} g</span>
                        </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            onClick={onOptimize}
                            disabled={allLocked || totalWeight === 0}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
              ${isWellGraded
                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                    : 'bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white'
                                }`}
                            title={allLocked ? 'Unlock at least one sieve to optimize' : totalWeight === 0 ? 'Enter weights first' : ''}
                        >
                            {isWellGraded ? '✅ View Alternatives' : '🔧 Optimize'}
                        </button>
                        <button
                            onClick={onFindBestCurve}
                            disabled={allLocked || totalWeight === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-sm hover:shadow-md transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Scan all 21 ASTM band positions and auto-select the curve with the best S-shape"
                        >
                            🏆 Find Best S-Curve
                        </button>
                    </div>
                </div>
            </div>

            {/* Current Data Score (always shown when there's data) */}
            {currentScore && totalWeight > 0 && (
                <div className="card px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-700">Current Curve Quality</span>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">{(currentScore.score * 100).toFixed(0)}</span>
                            <span className="text-xs text-gray-500">/ 100</span>
                            <GradeStars grade={currentScore.grade} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <ScoreBar label="Monotonic" value={currentScore.breakdown.S1} color={currentScore.breakdown.S1 >= 0.9 ? '#16a34a' : '#dc2626'} />
                        <ScoreBar label="S-Shape" value={currentScore.breakdown.S2} color="#8b5cf6" />
                        <ScoreBar label="No Gaps" value={currentScore.breakdown.S3} color="#06b6d4" />
                        <ScoreBar label="Uniformity" value={currentScore.breakdown.S4} color="#f59e0b" />
                        <ScoreBar label="Sigmoid R²" value={currentScore.breakdown.S5} color="#6366f1" />
                    </div>
                </div>
            )}

            {/* ── BEST CURVE RESULT ─────────────────────────────────────────── */}
            {bestCurveResult && (
                <div className="card overflow-hidden border-2 border-amber-200 bg-gradient-to-br from-amber-50/80 to-orange-50/40">
                    <div className="px-4 py-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🏆</span>
                                <div>
                                    <h3 className="font-bold text-gray-900 text-sm">Best S-Curve Found</h3>
                                    <p className="text-xs text-gray-600">
                                        ASTM {bestCurveResult.best.blendPosition}% ({bestCurveResult.best.label})
                                        {bestCurveResult.warning && <span className="text-amber-600 ml-2">{bestCurveResult.warning}</span>}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <div className="text-2xl font-black text-gray-900">{(bestCurveResult.best.score * 100).toFixed(0)}<span className="text-xs font-normal text-gray-500">/100</span></div>
                                    <GradeStars grade={bestCurveResult.best.grade} />
                                </div>
                                <button
                                    onClick={onApplyBestCurve}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg transition-all duration-200 active:scale-95"
                                >
                                    ⬆️ Apply Best
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="p-4">
                        {/* Score breakdown */}
                        <div className="mb-4 space-y-1.5">
                            <ScoreBar label="Monotonic" value={bestCurveResult.best.breakdown.S1} color={bestCurveResult.best.breakdown.S1 >= 0.9 ? '#16a34a' : '#dc2626'} />
                            <ScoreBar label="S-Shape" value={bestCurveResult.best.breakdown.S2} color="#8b5cf6" />
                            <ScoreBar label="No Gaps" value={bestCurveResult.best.breakdown.S3} color="#06b6d4" />
                            <ScoreBar label="Uniformity" value={bestCurveResult.best.breakdown.S4} color="#f59e0b" />
                            <ScoreBar label="Sigmoid R²" value={bestCurveResult.best.breakdown.S5} color="#6366f1" />
                        </div>

                        {/* Grading badges */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${bestCurveResult.best.isWellGraded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {bestCurveResult.best.isWellGraded ? '✅ Well-Graded' : '❌ Not Well-Graded'}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-gray-100 text-gray-700">
                                Cᵤ = {fmt(bestCurveResult.best.Cu)} | Cᶜ = {fmt(bestCurveResult.best.Cc)}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                                {bestCurveResult.wellGradedCount} / 21 candidates well-graded
                            </span>
                        </div>

                        {/* Candidates Ranking Table (expandable) */}
                        <div>
                            <button
                                onClick={() => setShowAllCandidates(!showAllCandidates)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors mb-2"
                            >
                                <span className={`transform transition-transform ${showAllCandidates ? 'rotate-90' : ''}`}>▶</span>
                                {showAllCandidates ? 'Hide' : 'Show'} All 21 Candidates
                            </button>

                            {showAllCandidates && (
                                <div className="overflow-x-auto rounded-lg border border-gray-200">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-2 py-1.5 text-left font-semibold text-gray-500">Rank</th>
                                                <th className="px-2 py-1.5 text-left font-semibold text-gray-500">ASTM %</th>
                                                <th className="px-2 py-1.5 text-right font-semibold text-gray-500">Score</th>
                                                <th className="px-2 py-1.5 text-center font-semibold text-gray-500">Grade</th>
                                                <th className="px-2 py-1.5 text-center font-semibold text-gray-500">M1</th>
                                                <th className="px-2 py-1.5 text-center font-semibold text-gray-500">M2</th>
                                                <th className="px-2 py-1.5 text-center font-semibold text-gray-500">M3</th>
                                                <th className="px-2 py-1.5 text-center font-semibold text-gray-500">M4</th>
                                                <th className="px-2 py-1.5 text-center font-semibold text-gray-500">M5</th>
                                                <th className="px-2 py-1.5 text-right font-semibold text-gray-500">Cᵤ</th>
                                                <th className="px-2 py-1.5 text-right font-semibold text-gray-500">Cᶜ</th>
                                                <th className="px-2 py-1.5 text-center font-semibold text-gray-500">WG</th>
                                                <th className="px-2 py-1.5 text-center font-semibold text-gray-500">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {bestCurveResult.candidates.map((c, idx) => {
                                                const isBest = c.blendPosition === bestCurveResult.best.blendPosition;
                                                return (
                                                    <tr key={c.blendPosition} className={`${isBest ? 'bg-amber-50 font-semibold' : 'hover:bg-gray-50'}`}>
                                                        <td className="px-2 py-1.5 text-gray-700">{isBest ? '🏆' : `#${idx + 1}`}</td>
                                                        <td className="px-2 py-1.5 font-mono text-gray-700">{c.blendPosition}% <span className="text-gray-400">({c.label})</span></td>
                                                        <td className="px-2 py-1.5 text-right font-mono font-bold">{(c.score * 100).toFixed(0)}</td>
                                                        <td className="px-2 py-1.5 text-center"><GradeStars grade={c.grade} /></td>
                                                        <td className={`px-2 py-1.5 text-center font-mono ${c.breakdown.S1 >= 1 ? 'text-green-600' : 'text-red-500'}`}>{(c.breakdown.S1 * 100).toFixed(0)}</td>
                                                        <td className="px-2 py-1.5 text-center font-mono text-purple-600">{(c.breakdown.S2 * 100).toFixed(0)}</td>
                                                        <td className="px-2 py-1.5 text-center font-mono text-cyan-600">{(c.breakdown.S3 * 100).toFixed(0)}</td>
                                                        <td className="px-2 py-1.5 text-center font-mono text-amber-600">{(c.breakdown.S4 * 100).toFixed(0)}</td>
                                                        <td className="px-2 py-1.5 text-center font-mono text-indigo-600">{(c.breakdown.S5 * 100).toFixed(0)}</td>
                                                        <td className="px-2 py-1.5 text-right font-mono text-gray-600">{fmt(c.Cu)}</td>
                                                        <td className="px-2 py-1.5 text-right font-mono text-gray-600">{fmt(c.Cc)}</td>
                                                        <td className="px-2 py-1.5 text-center">{c.isWellGraded ? '✅' : '❌'}</td>
                                                        <td className="px-2 py-1.5 text-center">
                                                            <button
                                                                onClick={() => onApplyOptimized(c.optimRows)}
                                                                className="px-2 py-0.5 rounded text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium transition-colors"
                                                            >
                                                                Apply
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Optimization results (single ASTM view) */}
            {showOptim && (
                <div className="card overflow-hidden tab-content">
                    <div className="p-4 tab-content">
                        {/* Slider */}
                        <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-semibold text-gray-700">Optimization Target Position within ASTM Band</span>
                                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{sliderValue}%</span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs text-gray-400">Lower</span>
                                <input
                                    type="range" min={0} max={100} step={5}
                                    value={sliderValue}
                                    onChange={e => onSliderChange(Number(e.target.value))}
                                    style={{ '--slider-pct': `${sliderValue}%` }}
                                    className="flex-1"
                                />
                                <span className="text-xs text-gray-400">Upper</span>
                            </div>
                            <p className="text-xs text-gray-500 text-center">{sliderLabel(sliderValue)}</p>
                            <div className="flex flex-wrap gap-1.5 mt-3 justify-center">
                                {PRESET_BUTTONS.map(p => (
                                    <button
                                        key={p.value}
                                        onClick={() => onSliderChange(p.value)}
                                        className={`px-2.5 py-1 text-xs rounded-full border font-medium transition-colors duration-150 ${sliderValue === p.value
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                            }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <OptimResultsContent
                            title={`ASTM Band Target — ${sliderValue}%`}
                            subtitle={sliderLabel(sliderValue)}
                            originalRows={tableData}
                            optimRows={optimAstmTableData}
                            optimSourceRows={optimAstmRows}
                            optimGrading={optimAstmGrading}
                            totalWeight={totalWeight}
                            sieveFormat={sieveFormat}
                            onApply={onApplyOptimized}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function OptimResultsContent({ title, subtitle, originalRows, optimRows, optimSourceRows, optimGrading, totalWeight, sieveFormat, onApply }) {
    const [applied, setApplied] = React.useState(false);

    const handleApply = () => {
        if (onApply && optimSourceRows) {
            onApply(optimSourceRows);
            setApplied(true);
            setTimeout(() => setApplied(false), 2000);
        }
    };

    if (!optimRows || !optimGrading) return (
        <div className="text-center text-gray-400 py-8 text-sm">No optimization result yet.</div>
    );

    const isWellGraded = optimGrading.grading.label === 'Well-Graded';
    const { grading, Cu, Cc, d10, d30, d60 } = optimGrading;

    const origMap = {};
    originalRows.forEach(r => { origMap[r.size] = r; });

    const instructions = [];
    optimRows.forEach(row => {
        const orig = origMap[row.size];
        if (!orig) return;
        const diff = row.weight - (orig.weight || 0);
        if (Math.abs(diff) > 0.5) {
            const label = getSieveLabel(row.size, sieveFormat);
            instructions.push(diff > 0
                ? `Add ${diff.toFixed(1)} g to ${label} fraction`
                : `Remove ${Math.abs(diff).toFixed(1)} g from ${label} fraction`
            );
        }
    });

    return (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-2">
                        <span className={grading.colorClass}>
                            {grading.label === 'Well-Graded' ? '🟢' : grading.label === 'Poorly-Graded' ? '🔴' : '🟡'}
                            {' '}{grading.label} ({grading.symbol})
                        </span>
                        <button
                            onClick={handleApply}
                            disabled={applied}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95 ${applied
                                ? 'bg-green-100 text-green-700 border border-green-300'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow'
                                }`}
                            title="Load these optimized weights into the input table for further editing"
                        >
                            {applied ? '✅ Applied!' : '⬆️ Apply to Table'}
                        </button>
                    </div>
                    <div className="flex gap-3 text-xs font-mono text-gray-600">
                        <span>Cᵤ = <strong className="text-gray-900">{fmt(Cu)}</strong></span>
                        <span>Cᶜ = <strong className="text-gray-900">{fmt(Cc)}</strong></span>
                        <span>D₁₀ = <strong className="text-gray-900">{fmt(d10, 3)}</strong></span>
                        <span>D₆₀ = <strong className="text-gray-900">{fmt(d60, 3)}</strong></span>
                    </div>
                </div>
            </div>

            {!isWellGraded && (
                <div className="mb-4 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                    <span className="text-base">⚠️</span>
                    <span>This target does not yield a well-graded mix. Try adjusting the slider toward the center, or unlock more sieves for redistribution.</span>
                </div>
            )}

            <div className="overflow-x-auto rounded-lg border border-gray-100 mb-4">
                <table className="w-full text-xs min-w-[560px]">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">Sieve</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">Original (g)</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">Adjusted (g)</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">Change</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">Orig % Finer</th>
                            <th className="px-3 py-2 text-right font-semibold text-gray-500 uppercase">New % Finer</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {optimRows.map(row => {
                            const orig = origMap[row.size];
                            if (!orig) return null;
                            const diff = row.weight - (orig.weight || 0);
                            const absDiff = Math.abs(diff);
                            const locked = orig.locked;
                            const label = getSieveLabel(row.size, sieveFormat);
                            return (
                                <tr key={row.size} className={`${locked ? 'bg-amber-50/50' : 'hover:bg-gray-50/50'}`}>
                                    <td className="px-3 py-2 font-mono font-medium text-gray-700">
                                        {label} {locked && <span className="text-amber-500">🔒</span>}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-gray-600">{(orig.weight || 0).toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right font-mono font-semibold text-gray-800">{row.weight.toFixed(2)}</td>
                                    <td className="px-3 py-2 text-right font-mono">
                                        {absDiff < 0.05 ? (
                                            <span className="text-gray-400">0.00</span>
                                        ) : diff > 0 ? (
                                            <span className="text-green-600 font-semibold">+{diff.toFixed(2)} ↑</span>
                                        ) : (
                                            <span className="text-red-500 font-semibold">{diff.toFixed(2)} ↓</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono text-gray-500">{(orig.pctFiner || 0).toFixed(1)}%</td>
                                    <td className="px-3 py-2 text-right font-mono text-blue-700 font-semibold">{(row.pctFiner || 0).toFixed(1)}%</td>
                                </tr>
                            );
                        })}
                        <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                            <td className="px-3 py-2 text-gray-700">Total</td>
                            <td className="px-3 py-2 text-right font-mono">{totalWeight.toFixed(2)} g</td>
                            <td className="px-3 py-2 text-right font-mono">{optimRows.reduce((s, r) => s + r.weight, 0).toFixed(2)} g</td>
                            <td className="px-3 py-2 text-right font-mono text-gray-400">0.00</td>
                            <td className="px-3 py-2 text-right text-gray-400">—</td>
                            <td className="px-3 py-2 text-right text-gray-400">—</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {instructions.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-blue-800 mb-2">📋 To achieve well-grading:</p>
                    <ul className="space-y-1">
                        {instructions.map((inst, i) => (
                            <li key={i} className="text-xs text-blue-700 flex items-start gap-2">
                                <span className="text-blue-400 mt-0.5">•</span>
                                <span>{inst}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-xs text-blue-600 mt-2 font-medium">Total weight remains fixed at {totalWeight.toFixed(1)} g.</p>
                </div>
            )}
        </div>
    );
}
