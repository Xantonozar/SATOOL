import React, { useMemo } from 'react';
import {
    ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ReferenceLine, ReferenceArea, ResponsiveContainer,
} from 'recharts';
import { GRAPH_TICKS, COLORS, getSieveLabel } from '../constants.js';
import { densifySemiLog } from '../mathUtils.js';

const VIEW_LABELS = { all: 'All Data', fine: '🏖 Fine', coarse: '🪨 Coarse', combined: '📊 Combined' };

function mergeData(curves) {
    const map = new Map();
    curves.forEach(({ key, points }) => {
        if (!points) return;
        points.forEach(p => {
            if (!map.has(p.size)) map.set(p.size, { size: p.size });
            map.get(p.size)[key] = p.pctFiner;
        });
    });
    return Array.from(map.values()).sort((a, b) => a.size - b.size);
}

const formatTick = (v) => {
    if (v >= 100) return v.toFixed(0);
    if (v >= 1) return Number.isInteger(v) ? String(v) : v.toFixed(1);
    return v.toFixed(3);
};

function CustomTooltip({ active, payload, label, sieveFormat }) {
    if (!active || !payload?.length) return null;
    const sizeLabel = label >= 1 ? label.toFixed(2) : label.toFixed(3);
    const usLabel = getSieveLabel(label, sieveFormat || 'us');
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-xs min-w-[200px]">
            <p className="font-semibold text-gray-700 mb-2">
                📏 {usLabel} ({sizeLabel} mm)
            </p>
            {payload
                .filter(p => p.value !== undefined && p.value !== null)
                .map(p => (
                    <div key={p.dataKey} className="flex items-center justify-between gap-3 py-0.5">
                        <span className="flex items-center gap-1.5">
                            <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: p.color }}></span>
                            <span className="text-gray-600 truncate max-w-[120px]">{p.name}</span>
                        </span>
                        <span className="font-mono font-semibold text-gray-800">{Number(p.value).toFixed(1)}%</span>
                    </div>
                ))}
        </div>
    );
}

export default function PSDGraph({
    tableData, fineTableData, coarseTableData,
    astmUpper, astmLower, blendCurves,
    d10, d30, d60,
    hiddenCurves, onToggleCurve,
    optimAstmData, graphId,
    graphView, onGraphViewChange, sieveFormat,
    panWeight,
}) {
    const [winWidth, setWinWidth] = React.useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    React.useEffect(() => {
        const handleResize = () => setWinWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = winWidth < 640;
    const isSmall = winWidth < 480;

    // Pan point: placed half a decade left of the smallest sieve, always at 0% finer
    const panPoint = useMemo(() => {
        if (!tableData || tableData.length === 0 || !(parseFloat(panWeight) > 0)) return null;
        const minSize = Math.min(...tableData.map(r => r.size));
        const panSize = minSize * 0.4; // place to the left of smallest sieve on log scale
        return { size: Math.max(panSize, 0.001), pctFiner: 0 };
    }, [tableData, panWeight]);

    // Build chart data based on view
    const chartData = useMemo(() => {
        const appendPan = (pts) => panPoint ? [...pts, panPoint] : pts;
        // densify converts sparse sieve data to a proper semi-log S-curve:
        // linearly interpolates pctFiner vs log(size) at many intermediate sizes
        const d = (pts) => densifySemiLog(appendPan(pts));
        const curves = [];

        if (graphView === 'all' || graphView === 'combined') {
            curves.push({ key: 'original', points: d(tableData.map(r => ({ size: r.size, pctFiner: r.pctFiner }))) });
        }

        if (graphView === 'fine' || graphView === 'combined') {
            curves.push({ key: 'fine', points: d(fineTableData.map(r => ({ size: r.size, pctFiner: r.pctFiner }))) });
        }

        if (graphView === 'coarse' || graphView === 'combined') {
            curves.push({ key: 'coarse', points: d(coarseTableData.map(r => ({ size: r.size, pctFiner: r.pctFiner }))) });
        }

        // ASTM reference curves — also densified for accurate semi-log rendering
        if (graphView === 'all') {
            curves.push({ key: 'astmUpper', points: densifySemiLog(astmUpper) });
            curves.push({ key: 'astmLower', points: densifySemiLog(astmLower) });
            curves.push({ key: 'blend25', points: densifySemiLog(blendCurves.blend25) });
            curves.push({ key: 'blend50', points: densifySemiLog(blendCurves.blend50) });
            curves.push({ key: 'blend75', points: densifySemiLog(blendCurves.blend75) });
        }
        if (graphView === 'all' && optimAstmData) {
            curves.push({ key: 'optimAstm', points: d(optimAstmData.map(r => ({ size: r.size, pctFiner: r.pctFiner }))) });
        }
        return mergeData(curves);
    }, [tableData, fineTableData, coarseTableData, astmUpper, astmLower, blendCurves, optimAstmData, graphView, panPoint]);

    // Build legend
    const legendItems = useMemo(() => {
        const items = [];

        if (graphView === 'all' || graphView === 'combined') {
            items.push({ key: 'original', label: 'All Data', color: COLORS.original, dash: '', width: 2.5 });
        }
        if (graphView === 'fine' || graphView === 'combined') {
            items.push({ key: 'fine', label: isSmall ? 'Fine' : 'Fine Aggregate', color: COLORS.fine, dash: '', width: 2.5 });
        }
        if (graphView === 'coarse' || graphView === 'combined') {
            items.push({ key: 'coarse', label: isSmall ? 'Coarse' : 'Coarse Aggregate', color: COLORS.coarse, dash: '', width: 2.5 });
        }

        if (graphView === 'all') {
            items.push({ key: 'astmUpper', label: isSmall ? 'ASTM Upper' : 'ASTM Upper Limit', color: COLORS.astmUpper, dash: '4 2', width: 2 });
            items.push({ key: 'astmLower', label: isSmall ? 'ASTM Lower' : 'ASTM Lower Limit', color: COLORS.astmLower, dash: '4 2', width: 2 });
            items.push({ key: 'blend25', label: isSmall ? 'WG 25%' : 'WG Possible — 25%', color: COLORS.blend25, dash: '', width: 1 });
            items.push({ key: 'blend50', label: isSmall ? 'WG 50%' : 'WG Possible — 50% (Center)', color: COLORS.blend50, dash: '', width: 1 });
            items.push({ key: 'blend75', label: isSmall ? 'WG 75%' : 'WG Possible — 75%', color: COLORS.blend75, dash: '', width: 1 });
            if (optimAstmData) items.push({ key: 'optimAstm', label: isSmall ? 'Optim Target' : 'Optimized — ASTM Target', color: COLORS.optimAstm, dash: '', width: 2.5 });
        }
        return items;
    }, [optimAstmData, graphView, isSmall]);

    const xDomain = useMemo(() => {
        if (!tableData || tableData.length === 0) return [0.01, 160];
        const sizes = tableData.map(r => r.size);
        const min = Math.min(...sizes);
        const max = Math.max(...sizes);
        const domainMin = panPoint ? Math.min(min, panPoint.size) : min;
        return [Math.max(0.001, domainMin), Math.max(min + 0.01, max)];
    }, [tableData, panPoint]);

    return (
        <div className="card overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex flex-col gap-3">
                <h2 className="font-semibold text-gray-900 text-sm">Particle Size Distribution — ASTM C136</h2>

                {/* Graph View selector */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-400 font-medium">View:</span>
                    {Object.entries(VIEW_LABELS).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => onGraphViewChange(key)}
                            className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all duration-150 ${graphView === key
                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Graph */}
            <div id={graphId} className="px-1 sm:px-4 pt-2 pb-4">
                <ResponsiveContainer width="100%" height={isSmall ? 280 : isMobile ? 320 : 420}>
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: isSmall ? 30 : 40, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f4f8" />

                        <XAxis
                            dataKey="size"
                            scale="log"
                            domain={xDomain}
                            type="number"
                            ticks={GRAPH_TICKS}
                            tickFormatter={formatTick}
                            label={!isSmall ? { value: 'Particle Size (mm) — Log Scale', position: 'insideBottom', offset: -22, style: { fontSize: isMobile ? 10 : 11, fill: '#6b7280', fontWeight: 500 } } : undefined}
                            tick={{ fontSize: 9, fill: '#6b7280' }}
                            tickLine={{ stroke: '#e2e8f0' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                        />
                        <YAxis
                            domain={[0, 100]}
                            ticks={[0, 20, 40, 60, 80, 100]}
                            tickFormatter={v => `${v}%`}
                            label={!isSmall ? { value: '% Finer', angle: -90, position: 'insideLeft', offset: 15, style: { fontSize: isMobile ? 10 : 11, fill: '#6b7280', fontWeight: 500 } } : undefined}
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            tickLine={{ stroke: '#e2e8f0' }}
                            axisLine={{ stroke: '#e2e8f0' }}
                            width={isSmall ? 40 : 55}
                        />

                        <Tooltip content={<CustomTooltip sieveFormat={sieveFormat} />} />

                        {/* ASTM shaded band */}
                        {graphView === 'all' && (
                            <ReferenceArea x1={0.075} x2={75} fill="#EA580C" fillOpacity={0.06} stroke="none" />
                        )}

                        {/* D-value reference lines */}
                        {graphView === 'all' && d10 && <ReferenceLine x={d10} stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1} label={{ value: 'D₁₀', position: 'top', style: { fontSize: 9, fill: '#64748b' } }} />}
                        {graphView === 'all' && d30 && <ReferenceLine x={d30} stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1} label={{ value: 'D₃₀', position: 'top', style: { fontSize: 9, fill: '#64748b' } }} />}
                        {graphView === 'all' && d60 && <ReferenceLine x={d60} stroke="#94a3b8" strokeDasharray="4 3" strokeWidth={1} label={{ value: 'D₆₀', position: 'top', style: { fontSize: 9, fill: '#64748b' } }} />}

                        {/* Curves */}
                        {legendItems.map(item => (
                            !hiddenCurves.has(item.key) && (
                                <Line
                                    key={item.key}
                                    type="linear"
                                    dataKey={item.key}
                                    stroke={item.color}
                                    strokeWidth={item.width}
                                    strokeDasharray={item.dash || undefined}
                                    dot={false}
                                    activeDot={{ r: 4, fill: item.color, stroke: 'white', strokeWidth: 2 }}
                                    connectNulls={true}
                                    name={item.label}
                                    isAnimationActive={false}
                                />
                            )
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Custom legend */}
            <div className="px-4 pb-4 flex flex-wrap gap-1.5 sm:gap-2">
                {legendItems.map(item => (
                    <button
                        key={item.key}
                        onClick={() => onToggleCurve(item.key)}
                        className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[10px] sm:text-xs border transition-all duration-150 ${hiddenCurves.has(item.key)
                            ? 'opacity-40 bg-gray-50 border-gray-200 text-gray-400'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 shadow-sm'
                            }`}
                    >
                        <span
                            className="inline-block rounded-sm flex-shrink-0"
                            style={{
                                width: 16, height: item.width * 1.2 + 1,
                                backgroundColor: item.color,
                                opacity: hiddenCurves.has(item.key) ? 0.4 : 1,
                            }}
                        />
                        <span className="truncate max-w-[120px] sm:max-w-none">{item.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
