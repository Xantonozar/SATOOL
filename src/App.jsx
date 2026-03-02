import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    GRAPH_TICKS, COLORS,
    getSieveLabel, getStandardSieves, getDefaultSieves,
    generateRandomWeights,
} from './constants.js';
import {
    calcTableData, calcPanWeight,
    interpolateDValue, calcCoefficients,
    classifyAggregateType, classifyGrading,
    astmBlendCurveAtSizes, checkASTMCompliance,
    generateASTMLimitCurves, getASTMLimits,
    optimizeWeights, validateRows, fmt,
} from './mathUtils.js';
import { combinedScore, getBestCurve } from './scoringUtils.js';
import Header from './components/Header.jsx';
import SieveTable from './components/SieveTable.jsx';
import PSDGraph from './components/PSDGraph.jsx';
import ResultsSummary from './components/ResultsSummary.jsx';
import OptimizationPanel from './components/OptimizationPanel.jsx';

let _id = Date.now();
const nextId = () => ++_id;

function createRow(size, weight = 0, locked = false) {
    return { id: nextId(), size, weight, locked };
}

// ── localStorage helpers ───────────────────────────────────────────────────
const STORAGE_KEY = 'sieve-analysis-data';

function saveToStorage(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* silent */ }
}

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed.rows) {
            parsed.rows = parsed.rows.map(r => ({ ...r, id: nextId() }));
        }
        return parsed;
    } catch (e) { return null; }
}

function getInitialState() {
    const saved = loadFromStorage();
    if (saved) {
        return {
            rows: saved.rows || getDefaultSieves(saved.sieveFormat || 'us').map(s => createRow(s, 0)),
            sieveFormat: saved.sieveFormat || 'us',
            sliderValue: saved.sliderValue ?? 50,
            panWeight: saved.panWeight ?? 0,
        };
    }
    return {
        rows: getDefaultSieves('us').map(s => createRow(s, 0)),
        sieveFormat: 'us',
        sliderValue: 50,
        panWeight: 0,
    };
}

export default function App() {
    const initial = useMemo(() => getInitialState(), []);

    const [rows, setRows] = useState(initial.rows);
    const [sieveFormat, setSieveFormat] = useState(initial.sieveFormat);
    const [sliderValue, setSliderValue] = useState(initial.sliderValue);
    const [panWeight, setPanWeight] = useState(initial.panWeight);
    const [showOptim, setShowOptim] = useState(false);
    const [hiddenCurves, setHiddenCurves] = useState(new Set());
    const [bestCurveResult, setBestCurveResult] = useState(null);
    const [graphView, setGraphView] = useState('all');

    // ── Save to localStorage on changes ───────────────────────────────────────
    useEffect(() => {
        saveToStorage({
            rows: rows.map(r => ({ size: r.size, weight: r.weight, locked: r.locked })),
            sieveFormat,
            sliderValue,
            panWeight,
        });
    }, [rows, sieveFormat, sliderValue, panWeight]);

    // ── Current standard sieves for this format ───────────────────────────────
    const standardSieves = useMemo(() => getStandardSieves(sieveFormat), [sieveFormat]);

    // ── Derived totals ────────────────────────────────────────────────────────
    // totalWeight includes pan weight so all % calculations are correct
    const totalWeight = useMemo(() =>
        rows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0) + (parseFloat(panWeight) || 0),
        [rows, panWeight]
    );

    // ── Table data (sorted descending, with %) ────────────────────────────────
    const sortedRows = useMemo(() =>
        [...rows].sort((a, b) => b.size - a.size),
        [rows]
    );

    const tableData = useMemo(() =>
        calcTableData(sortedRows, totalWeight),
        [sortedRows, totalWeight]
    );

    // ── Fine / Coarse split data for multi-view graphs ────────────────────────
    const fineTableData = useMemo(() => {
        const fineRows = sortedRows.filter(r => r.size <= 4.75);
        const fineTotalW = fineRows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0);
        return calcTableData(fineRows, fineTotalW);
    }, [sortedRows]);

    const coarseTableData = useMemo(() => {
        const coarseRows = sortedRows.filter(r => r.size >= 4.75);
        const coarseTotalW = coarseRows.reduce((s, r) => s + (parseFloat(r.weight) || 0), 0);
        return calcTableData(coarseRows, coarseTotalW);
    }, [sortedRows]);

    // ── D-values & classification ─────────────────────────────────────────────
    const { d10, d30, d60 } = useMemo(() => {
        if (tableData.length < 2 || totalWeight === 0) return { d10: null, d30: null, d60: null };
        return {
            d10: interpolateDValue(tableData, 10),
            d30: interpolateDValue(tableData, 30),
            d60: interpolateDValue(tableData, 60),
        };
    }, [tableData, totalWeight]);

    const { Cu, Cc } = useMemo(() => calcCoefficients(d10, d30, d60), [d10, d30, d60]);
    const aggregateType = useMemo(() => classifyAggregateType(tableData, totalWeight), [tableData, totalWeight]);

    // ── ASTM limits for detected type ─────────────────────────────────────────
    const sieveSizes = useMemo(() => sortedRows.map(r => r.size), [sortedRows]);
    const astmLimits = useMemo(() => getASTMLimits(aggregateType, sieveSizes), [aggregateType, sieveSizes]);

    const isASTMCompliant = useMemo(() => checkASTMCompliance(tableData, astmLimits), [tableData, astmLimits]);

    const grading = useMemo(() => classifyGrading(Cu, Cc, aggregateType, isASTMCompliant), [Cu, Cc, aggregateType, isASTMCompliant]);
    const warnings = useMemo(() => validateRows(rows, totalWeight), [rows, totalWeight]);

    const { astmUpper, astmLower } = useMemo(() => {
        const { upper, lower } = generateASTMLimitCurves(astmLimits, GRAPH_TICKS);
        return { astmUpper: upper, astmLower: lower };
    }, [astmLimits]);

    const blendCurves = useMemo(() => {
        const sizes = GRAPH_TICKS;
        return {
            blend25: astmBlendCurveAtSizes(sizes, astmLimits, 0.25),
            blend50: astmBlendCurveAtSizes(sizes, astmLimits, 0.50),
            blend75: astmBlendCurveAtSizes(sizes, astmLimits, 0.75),
        };
    }, [astmLimits]);

    // ── Optimization (ASTM only) ──────────────────────────────────────────────
    const astmTargetFiner = useMemo(() => {
        return astmBlendCurveAtSizes(sortedRows.map(r => r.size), astmLimits, sliderValue / 100);
    }, [sortedRows, astmLimits, sliderValue]);

    const optimAstmRows = useMemo(() => {
        if (!showOptim) return null;
        return optimizeWeights(rows, astmTargetFiner, totalWeight);
    }, [showOptim, rows, astmTargetFiner, totalWeight]);

    const optimAstmTableData = useMemo(() => {
        if (!optimAstmRows) return null;
        const sorted = [...optimAstmRows].sort((a, b) => b.size - a.size);
        return calcTableData(sorted, totalWeight);
    }, [optimAstmRows, totalWeight]);

    const optimAstmGrading = useMemo(() => {
        if (!optimAstmTableData) return null;
        const d10o = interpolateDValue(optimAstmTableData, 10);
        const d30o = interpolateDValue(optimAstmTableData, 30);
        const d60o = interpolateDValue(optimAstmTableData, 60);
        const { Cu: Cuo, Cc: Cco } = calcCoefficients(d10o, d30o, d60o);
        const isOptCompliant = checkASTMCompliance(optimAstmTableData, astmLimits);
        return { grading: classifyGrading(Cuo, Cco, aggregateType, isOptCompliant), Cu: Cuo, Cc: Cco, d10: d10o, d30: d30o, d60: d60o };
    }, [optimAstmTableData, aggregateType, astmLimits]);

    // ── Current curve quality score (live) ─────────────────────────────────────
    const currentScore = useMemo(() => {
        if (!tableData || tableData.length < 3 || totalWeight <= 0) return null;
        return combinedScore(tableData);
    }, [tableData, totalWeight]);

    // ── Row manipulation handlers ─────────────────────────────────────────────
    const updateWeight = useCallback((id, value) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, weight: value } : r));
        setShowOptim(false);
        setBestCurveResult(null);
    }, []);

    const toggleLock = useCallback((id) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, locked: !r.locked } : r));
    }, []);

    const removeRow = useCallback((id) => {
        setRows(prev => prev.filter(r => r.id !== id));
        setShowOptim(false);
    }, []);

    const addSieve = useCallback((size) => {
        setRows(prev => {
            const newRow = createRow(size, 0);
            return [...prev, newRow].sort((a, b) => b.size - a.size);
        });
    }, []);

    // ── Sieve format switch ───────────────────────────────────────────────────
    const switchSieveFormat = useCallback((fmt) => {
        setSieveFormat(fmt);
        const defaultSizes = getDefaultSieves(fmt);
        setRows(defaultSizes.map(s => createRow(s, 0)));
        setPanWeight(0);
        setShowOptim(false);
    }, []);

    // ── Random data ───────────────────────────────────────────────────────────
    const fillRandomData = useCallback((type = 'mixed') => {
        setRows(prev => {
            const sizes = prev.map(r => r.size);
            const weights = generateRandomWeights(sizes, type);
            return prev.map((r, i) => ({ ...r, weight: weights[i] }));
        });
        setShowOptim(false);
    }, []);

    // ── Export helpers ────────────────────────────────────────────────────────
    const getTableTSV = useCallback(() => {
        const header = ['Sieve', 'Size (mm)', 'Weight (g)', '% Retained', 'Cum % Retained', '% Finer'].join('\t');
        const dataRows = tableData.map(r =>
            [getSieveLabel(r.size, sieveFormat), r.size, (r.weight || 0).toFixed(2), r.pctRetained.toFixed(2), r.cumRetained.toFixed(2), r.pctFiner.toFixed(2)].join('\t')
        );
        const panRow = `Pan\t—\t${(panWeight).toFixed(2)}\t${(panWeight / totalWeight * 100 || 0).toFixed(2)}\t100.00\t0.00`;
        return [header, ...dataRows, panRow].join('\n');
    }, [tableData, panWeight, totalWeight, sieveFormat]);

    const downloadCSV = useCallback(() => {
        const tsv = getTableTSV();
        const csv = tsv.replace(/\t/g, ',');
        const extra = `\n\nResults\nAggregate Type,${aggregateType}\nD10 (mm),${fmt(d10)}\nD30 (mm),${fmt(d30)}\nD60 (mm),${fmt(d60)}\nCu,${fmt(Cu)}\nCc,${fmt(Cc)}\nClassification,${grading.label} (${grading.symbol})`;
        const blob = new Blob([csv + extra], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'sieve_analysis.csv'; a.click();
        URL.revokeObjectURL(url);
    }, [getTableTSV, aggregateType, d10, d30, d60, Cu, Cc, grading]);

    const copyTable = useCallback(() => {
        navigator.clipboard.writeText(getTableTSV()).catch(() => { });
    }, [getTableTSV]);

    const resetAll = useCallback(() => {
        const defaultSizes = getDefaultSieves(sieveFormat);
        setRows(defaultSizes.map(s => createRow(s, 0)));
        setPanWeight(0);
        setShowOptim(false);
        setSliderValue(50);
        setBestCurveResult(null);
    }, [sieveFormat]);

    const onPanWeightChange = useCallback((val) => {
        setPanWeight(parseFloat(val) || 0);
        setShowOptim(false);
        setBestCurveResult(null);
    }, []);

    // ── Apply optimized weights back to input table ───────────────────────────
    const applyOptimized = useCallback((optimizedRows) => {
        if (!optimizedRows || optimizedRows.length === 0) return;
        const weightMap = {};
        optimizedRows.forEach(r => { weightMap[r.size] = r.weight; });
        setRows(prev => prev.map(r => ({
            ...r,
            weight: weightMap[r.size] !== undefined ? weightMap[r.size] : r.weight,
        })));
        setShowOptim(false);
    }, []);

    // ── Best Curve Finder ─────────────────────────────────────────────────────
    const findBestCurve = useCallback(() => {
        if (totalWeight <= 0) return;
        const result = getBestCurve(rows, astmLimits, totalWeight, aggregateType);
        setBestCurveResult(result);
        // Auto-show the best curve on graph by setting slider to best blend position
        if (result.best) {
            setSliderValue(result.best.blendPosition);
            setShowOptim(true);
        }
    }, [rows, astmLimits, totalWeight, aggregateType]);

    const applyBestCurve = useCallback(() => {
        if (!bestCurveResult?.best?.optimRows) return;
        applyOptimized(bestCurveResult.best.optimRows);
    }, [bestCurveResult, applyOptimized]);

    const toggleCurve = useCallback((key) => {
        setHiddenCurves(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }, []);

    const usedSizes = new Set(rows.map(r => r.size));
    const availableSizes = standardSieves.filter(s => !usedSizes.has(s));

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-gray-800">
            <Header
                onCopyTable={copyTable}
                onDownloadCSV={downloadCSV}
                onReset={resetAll}
                onFillRandom={fillRandomData}
                graphId="psd-graph-export"
                sieveFormat={sieveFormat}
                onSieveFormatChange={switchSieveFormat}
            />

            <main className="max-w-[1600px] mx-auto p-4 lg:p-6">
                {/* Warnings */}
                {warnings.length > 0 && totalWeight > 0 && (
                    <div className="mb-4 space-y-1">
                        {warnings.filter(w => !w.includes('Enter aggregate')).map((w, i) => (
                            <div key={i} className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                                <span>⚠️</span> {w}
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-col xl:flex-row gap-6">
                    {/* LEFT: Sieve Table */}
                    <div className="xl:w-[520px] flex-shrink-0">
                        <SieveTable
                            rows={sortedRows}
                            tableData={tableData}
                            totalWeight={totalWeight}
                            panWeight={panWeight}
                            onPanWeightChange={onPanWeightChange}
                            availableSizes={availableSizes}
                            onWeightChange={updateWeight}
                            onToggleLock={toggleLock}
                            onRemove={removeRow}
                            onAddSieve={addSieve}
                            sieveFormat={sieveFormat}
                        />
                    </div>

                    {/* RIGHT: Graph + Results + Optimization */}
                    <div className="flex-1 min-w-0 space-y-4">
                        <PSDGraph
                            tableData={tableData}
                            fineTableData={fineTableData}
                            coarseTableData={coarseTableData}
                            astmUpper={astmUpper}
                            astmLower={astmLower}
                            blendCurves={blendCurves}
                            d10={d10} d30={d30} d60={d60}
                            hiddenCurves={hiddenCurves}
                            onToggleCurve={toggleCurve}
                            optimAstmData={showOptim ? optimAstmTableData : null}
                            graphId="psd-graph-export"
                            graphView={graphView}
                            onGraphViewChange={setGraphView}
                            sieveFormat={sieveFormat}
                            panWeight={panWeight}
                        />

                        <ResultsSummary
                            totalWeight={totalWeight}
                            aggregateType={aggregateType}
                            d10={d10} d30={d30} d60={d60}
                            Cu={Cu} Cc={Cc}
                            grading={grading}
                        />

                        <OptimizationPanel
                            rows={sortedRows}
                            tableData={tableData}
                            totalWeight={totalWeight}
                            sliderValue={sliderValue}
                            onSliderChange={setSliderValue}
                            grading={grading}
                            aggregateType={aggregateType}
                            showOptim={showOptim}
                            onOptimize={() => setShowOptim(true)}
                            optimAstmRows={optimAstmRows}
                            optimAstmTableData={optimAstmTableData}
                            optimAstmGrading={optimAstmGrading}
                            sieveFormat={sieveFormat}
                            onApplyOptimized={applyOptimized}
                            bestCurveResult={bestCurveResult}
                            onFindBestCurve={findBestCurve}
                            onApplyBestCurve={applyBestCurve}
                            currentScore={currentScore}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
