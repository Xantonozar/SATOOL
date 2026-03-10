import React from 'react';
import { fmt } from '../mathUtils.js';

export default function ResultsSummary({ totalWeight, aggregateType, d10, d30, d60, Cu, Cc, grading }) {
    const typeLabel = {
        coarse: '🪨 Coarse Aggregate (Gravel)',
        fine: '🏖 Fine Aggregate (Sand)',
        mixed: '🧪 Mixed / Combined',
        unknown: '— Unknown',
    }[aggregateType] || '— Unknown';

    return (
        <div className="card px-4 sm:px-5 py-3 sm:py-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Results Summary</h2>

            <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
                {/* Aggregate Type */}
                <StatCard label="Aggregate Type" value={typeLabel} valueClass="text-[10px] sm:text-sm" mono={false} wide />

                {/* Total Weight */}
                <StatCard label="Total Weight" value={`${totalWeight.toFixed(1)} g`} />

                {/* D-values */}
                <StatCard label="D₁₀" value={d10 ? `${d10.toFixed(3)} mm` : '—'} />
                <StatCard label="D₃₀" value={d30 ? `${d30.toFixed(3)} mm` : '—'} />
                <StatCard label="D₆₀" value={d60 ? `${d60.toFixed(3)} mm` : '—'} />

                {/* Cu, Cc */}
                <StatCard label="Cᵤ (Uniformity)" value={fmt(Cu)} highlight={Cu !== null && Cu > 0} />
                <StatCard label="Cᶜ (Curvature)" value={fmt(Cc)} highlight={Cc !== null && Cc > 0} />
            </div>

            {/* Classification badge + USCS */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-3 border-t border-gray-100">
                <span className="text-[11px] sm:text-xs text-gray-500 font-medium">Classification:</span>
                <span className={`${grading.colorClass} text-[11px] sm:text-sm`}>
                    {grading.label === 'Well-Graded' ? '🟢' : grading.label === 'Poorly-Graded' ? '🔴' : grading.label === 'Gap-Graded' ? '🟡' : '⚪'}
                    {' '}{grading.label}
                </span>
                {grading.symbol !== '—' && (
                    <span className="px-2 py-0.5 text-[10px] sm:text-xs font-bold font-mono bg-gray-100 text-gray-700 rounded border border-gray-200">
                        USCS: {grading.symbol}
                    </span>
                )}
            </div>
        </div>
    );
}

function StatCard({ label, value, mono = true, highlight = false, wide = false, valueClass = '' }) {
    return (
        <div className={`bg-gray-50 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 ${wide ? 'col-span-2' : ''}`}>
            <p className="text-[9px] sm:text-xs text-gray-400 font-medium mb-0.5 truncate">{label}</p>
            <p className={`font-semibold text-gray-800 ${mono ? 'font-mono text-xs sm:text-base' : 'text-[11px] sm:text-sm'} ${highlight ? 'text-blue-700' : ''} ${valueClass} break-words`}>
                {value}
            </p>
        </div>
    );
}
