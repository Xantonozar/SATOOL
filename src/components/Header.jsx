import React, { useState, useRef } from 'react';

export default function Header({ onCopyTable, onDownloadCSV, onDownloadExcel, onReset, onFillRandom, graphId, sieveFormat, onSieveFormatChange }) {
    const [showRandomMenu, setShowRandomMenu] = useState(false);
    const menuRef = useRef(null);

    const getGraphImage = () => {
        return new Promise((resolve) => {
            const container = document.getElementById(graphId);
            if (!container) return resolve(null);
            const svg = container.querySelector('svg');
            if (!svg) return resolve(null);

            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const rect = svg.getBoundingClientRect();
            canvas.width = rect.width * 2;
            canvas.height = rect.height * 2;
            const ctx = canvas.getContext('2d');
            ctx.scale(2, 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, rect.width, rect.height);

            const img = new Image();
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                ctx.drawImage(img, 0, 0, rect.width, rect.height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/png'));
            };
            img.src = url;
        });
    };

    const downloadPNG = async () => {
        const dataUrl = await getGraphImage();
        if (!dataUrl) return;
        const a = document.createElement('a');
        a.download = 'psd_curve.png';
        a.href = dataUrl;
        a.click();
    };

    const handleExcelExport = async () => {
        const imageData = await getGraphImage();
        onDownloadExcel(imageData);
    };

    return (
        <header className="sticky top-0 z-50 glass border-b border-white/20">
            <div className="max-w-[1600px] mx-auto px-4 lg:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 text-2xl">
                        🪨
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Sieve Analysis</h1>
                        <p className="text-[10px] font-bold text-blue-600 tracking-widest uppercase">ASTM C136 — Particle Distribution</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Unit Toggle */}
                    <div className="flex bg-gray-100/50 backdrop-blur-sm rounded-xl p-1 border border-gray-200/50">
                        <button
                            onClick={() => onSieveFormatChange('us')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${sieveFormat === 'us' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            US Standard
                        </button>
                        <button
                            onClick={() => onSieveFormatChange('metric')}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 ${sieveFormat === 'metric' ? 'bg-white text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Metric
                        </button>
                    </div>

                    <div className="h-8 w-px bg-gray-200 mx-1 hidden sm:block" />

                    <div className="flex items-center gap-2">
                        {/* Random Data */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowRandomMenu(v => !v)}
                                className="btn-secondary"
                                title="Fill with random data"
                            >
                                🎲 <span className="hidden lg:inline">Random Data</span>
                            </button>
                            {showRandomMenu && (
                                <div className="absolute right-0 top-full mt-2 w-48 glass-card border-gray-200/50 p-2 z-[60]">
                                    <div className="text-[10px] font-bold text-gray-400 px-3 py-1 uppercase tracking-tighter">Quick Templates</div>
                                    <button onClick={() => { onFillRandom('mixed'); setShowRandomMenu(false); }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2">
                                        🧪 <span>Mixed Sample</span>
                                    </button>
                                    <button onClick={() => { onFillRandom('coarse'); setShowRandomMenu(false); }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 rounded-lg transition-colors flex items-center gap-2">
                                        🪨 <span>Coarse Agg</span>
                                    </button>
                                    <button onClick={() => { onFillRandom('fine'); setShowRandomMenu(false); }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-cyan-50 rounded-lg transition-colors flex items-center gap-2">
                                        🏖 <span>Fine Sand</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-1 bg-gray-100/50 rounded-xl p-1">
                            <button onClick={onCopyTable} className="p-2 hover:bg-white rounded-lg transition-all text-gray-600 hover:text-blue-600" title="Copy TSV">📋</button>
                            <button onClick={onDownloadCSV} className="p-2 hover:bg-white rounded-lg transition-all text-gray-600 hover:text-emerald-600" title="Export CSV">📊</button>
                            <button onClick={handleExcelExport} className="p-1.5 px-3 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-lg hover:bg-emerald-100 transition-all flex items-center gap-1" title="Export Excel">
                                📗 <span>Excel</span>
                            </button>
                            <button onClick={downloadPNG} className="p-2 hover:bg-white rounded-lg transition-all text-gray-600 hover:text-indigo-600" title="Export PNG">🖼</button>
                        </div>

                        <button
                            onClick={onReset}
                            className="btn-base bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100"
                            title="Clear All"
                        >
                            <span className="text-lg">🔄</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
