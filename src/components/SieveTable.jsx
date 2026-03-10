import React, { useState } from 'react';
import { getSieveLabel } from '../constants.js';

export default function SieveTable({
    rows, tableData, totalWeight, panWeight, onPanWeightChange,
    availableSizes, onWeightChange, onToggleLock, onRemove, onAddSieve,
    sieveFormat,
}) {
    const [showAddDropdown, setShowAddDropdown] = useState(false);
    const lockedCount = rows.filter(r => r.locked).length;
    const lockedWeight = rows.filter(r => r.locked).reduce((s, r) => s + (parseFloat(r.weight) || 0), 0);
    const freeWeight = totalWeight - lockedWeight;

    const handleAddClick = (size) => {
        onAddSieve(size);
        setShowAddDropdown(false);
    };

    return (
        <div className="card overflow-hidden">
            {/* Card header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-gray-900 text-sm">Sieve Input Table</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Total: <span className="font-mono font-semibold text-gray-800">{totalWeight.toFixed(1)} g</span>
                    </p>
                </div>
                <div className="relative">
                    <button
                        className="btn-primary text-xs px-3 py-1.5"
                        onClick={() => setShowAddDropdown(v => !v)}
                        disabled={availableSizes.length === 0}
                    >
                        <span className="text-base">+</span> Add Sieve
                    </button>
                    {showAddDropdown && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-30 py-1 max-h-56 overflow-y-auto">
                            {availableSizes.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-gray-400">All sieves added</div>
                            ) : availableSizes.sort((a, b) => b - a).map(s => (
                                <button
                                    key={s}
                                    onClick={() => handleAddClick(s)}
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors font-mono flex justify-between"
                                >
                                    <span className="font-semibold">{getSieveLabel(s, sieveFormat)}</span>
                                    <span className="text-gray-400 text-xs">{s} mm</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Lock summary */}
            {lockedCount > 0 && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
                    🔒 <strong>{lockedCount}</strong> sieve{lockedCount > 1 ? 's' : ''} locked — <strong>{lockedWeight.toFixed(1)} g</strong> fixed.
                    {' '}<strong>{Math.max(0, freeWeight).toFixed(1)} g</strong> available for redistribution.
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-gray-100">
                            <th className="px-2 py-2 text-[10px] font-semibold text-gray-400 uppercase w-8 text-center">🔒</th>
                            <th className="px-2 sm:px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase text-left">Sieve</th>
                            <th className="table-th px-2 sm:px-3 text-[10px]">Weight (g)</th>
                            <th className="table-th px-2 sm:px-3 text-[10px] hidden sm:table-cell">% Ret</th>
                            <th className="table-th px-2 sm:px-3 text-[10px] hidden md:table-cell">Cum %</th>
                            <th className="table-th px-2 sm:px-3 text-[10px] text-blue-600">% Finer</th>
                            <th className="px-2 py-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {tableData.map((row) => (
                            <SieveRow
                                key={row.id}
                                row={row}
                                sieveFormat={sieveFormat}
                                onWeightChange={onWeightChange}
                                onToggleLock={onToggleLock}
                                onRemove={onRemove}
                            />
                        ))}
                        {/* Pan row — editable */}
                        <tr className="bg-amber-50/40 hover:bg-amber-50/60 transition-colors">
                            <td className="px-2 py-2 text-center text-amber-300">
                                <span className="text-xs">🪣</span>
                            </td>
                            <td className="px-2 sm:px-3 py-2">
                                <span className="text-xs sm:text-sm font-medium text-gray-700">Pan</span>
                                <span className="text-[10px] text-gray-400 ml-1.5 hidden xs:inline">(&lt; smallest sieve)</span>
                            </td>
                            <td className="px-2 sm:px-3 py-1.5">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    value={panWeight === 0 ? '' : panWeight}
                                    placeholder="0"
                                    onChange={e => onPanWeightChange(e.target.value)}
                                    onFocus={e => e.target.select()}
                                    className="w-16 sm:w-20 px-1 sm:px-2 py-1 text-xs sm:text-sm font-mono text-right rounded border bg-white border-amber-200 hover:border-amber-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors duration-150"
                                />
                            </td>
                            <td className="table-td px-2 sm:px-3 text-[11px] sm:text-xs text-gray-500 hidden sm:table-cell">{totalWeight > 0 ? ((panWeight / totalWeight) * 100).toFixed(2) : '0.00'}</td>
                            <td className="table-td px-2 sm:px-3 text-[11px] sm:text-xs text-gray-500 hidden md:table-cell">100.00</td>
                            <td className="table-td px-2 sm:px-3 text-[11px] sm:text-xs font-semibold text-blue-700">0.00</td>
                            <td className="px-2"></td>
                        </tr>
                        {/* Total row */}
                        <tr className="bg-blue-50/50 border-t-2 border-blue-100">
                            <td colSpan={2} className="px-2 sm:px-3 py-2 text-[10px] font-bold text-gray-600 uppercase">Total</td>
                            <td className="table-td px-2 sm:px-3 text-[11px] sm:text-xs font-bold text-gray-900">{totalWeight.toFixed(2)}</td>
                            <td className="table-td px-2 sm:px-3 text-[11px] sm:text-xs font-bold hidden sm:table-cell">100.00</td>
                            <td className="table-td px-2 sm:px-3 text-[11px] sm:text-xs text-gray-400 hidden md:table-cell">—</td>
                            <td className="table-td px-2 sm:px-3 text-[11px] sm:text-xs text-gray-400">—</td>
                            <td className="px-2"></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Validation messages */}
            {totalWeight === 0 && (
                <div className="px-4 py-3 text-sm text-gray-400 text-center border-t border-gray-100">
                    Enter aggregate weights to begin analysis
                </div>
            )}
        </div>
    );
}

function SieveRow({ row, sieveFormat, onWeightChange, onToggleLock, onRemove }) {
    const label = getSieveLabel(row.size, sieveFormat);
    const mmLabel = row.size >= 1 ? row.size.toFixed(1) : row.size.toFixed(3);

    return (
        <tr className={`hover:bg-gray-50/70 transition-colors ${row.locked ? 'row-locked' : ''}`}>
            <td className="px-2 py-1.5 text-center">
                <button
                    onClick={() => onToggleLock(row.id)}
                    className={`text-base sm:text-lg transition-all duration-150 hover:scale-110 ${row.locked ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}
                    title={row.locked ? 'Unlock this sieve' : 'Lock this sieve'}
                >
                    {row.locked ? '🔒' : '🔓'}
                </button>
            </td>

            <td className="px-2 sm:px-3 py-1.5">
                <span className="font-mono text-xs sm:text-sm font-bold text-gray-800">{label}</span>
                {sieveFormat === 'us' && (
                    <span className="text-[10px] text-gray-400 ml-1 hidden xs:inline">({mmLabel})</span>
                )}
            </td>

            <td className="px-2 sm:px-3 py-1.5">
                <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={row.weight === 0 ? '' : row.weight}
                    placeholder="0"
                    disabled={row.locked}
                    onChange={e => onWeightChange(row.id, parseFloat(e.target.value) || 0)}
                    onFocus={e => e.target.select()}
                    className={`w-16 sm:w-20 px-1 sm:px-2 py-1 text-xs sm:text-sm font-mono text-right rounded border transition-colors duration-150
            ${row.locked
                            ? 'bg-amber-50 text-amber-700 border-amber-200 cursor-not-allowed'
                            : 'bg-white border-gray-200 hover:border-blue-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/20'
                        }`}
                />
            </td>

            <td className="table-td px-2 sm:px-3 text-[11px] sm:text-xs text-gray-600 hidden sm:table-cell">{row.pctRetained?.toFixed(2) ?? '0.00'}</td>
            <td className="table-td px-2 sm:px-3 text-[11px] sm:text-xs text-gray-600 hidden md:table-cell">{row.cumRetained?.toFixed(2) ?? '0.00'}</td>
            <td className="table-td px-2 sm:px-3 text-[11px] sm:text-xs font-semibold text-blue-700">{row.pctFiner?.toFixed(2) ?? '100.00'}</td>

            <td className="px-2 py-1.5 text-center">
                <button onClick={() => onRemove(row.id)} className="btn-danger p-1 sm:p-1.5" title="Remove sieve">
                    <span className="text-[10px] sm:text-xs">✕</span>
                </button>
            </td>
        </tr>
    );
}
