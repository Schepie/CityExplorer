import React, { useState } from 'react';

/**
 * RouteEditPanel - Floating panel for route editing controls
 * 
 * Displays during route edit mode with:
 * - List of waypoints with cumulative distances
 * - Delete buttons per waypoint
 * - Total route distance
 * - Finalize and cancel buttons
 */
const RouteEditPanel = ({
    points = [],
    cumulativeDistances = [],
    totalDistance = 0,
    travelMode = 'walking',
    language = 'nl',
    onDeletePoint,
    onFinalize,
    onCancel,
    onPointClick,
    selectedPointIndex = -1,
    isCalculating = false
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const t = {
        nl: {
            title: 'Route Bouwen',
            start: 'START',
            stop: 'Stop',
            totalDistance: 'Totale afstand',
            estimatedTime: 'Geschatte tijd',
            finalize: 'Afronden',
            cancel: 'Annuleren',
            addPointHint: 'Tik op de kaart om punten toe te voegen',
            calculating: 'Berekenen...',
            deletePoint: 'Verwijderen',
            walking: 'wandelen',
            cycling: 'fietsen',
            morePoints: (n) => `+ ${n} eerdere punten (toon alles)`,
            lessPoints: 'Toon minder'
        },
        en: {
            title: 'Build Route',
            start: 'START',
            stop: 'Stop',
            totalDistance: 'Total distance',
            estimatedTime: 'Estimated time',
            finalize: 'Finish',
            cancel: 'Cancel',
            addPointHint: 'Tap the map to add points',
            calculating: 'Calculating...',
            deletePoint: 'Delete',
            walking: 'walking',
            cycling: 'cycling',
            morePoints: (n) => `+ ${n} previous points (show all)`,
            lessPoints: 'Show less'
        }
    };
    const text = t[language] || t.en;

    // Calculate estimated time based on travel mode
    const speedKmH = travelMode === 'cycling' ? 15 : 5;
    const estimatedMinutes = Math.round((totalDistance / speedKmH) * 60);
    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;
    const timeDisplay = hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes} min`;

    const reversedPoints = [...points].reverse();
    const visiblePoints = isExpanded ? reversedPoints : reversedPoints.slice(0, 2);

    return (
        <div className={`absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-80 z-[1000] animate-in slide-in-from-bottom-4 duration-300 transition-all`}>
            {/* Main Panel */}
            <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[60vh]">
                {/* Header */}
                <div className="px-3 py-2 border-b border-white/5 bg-gradient-to-r from-primary/20 to-transparent shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-white">{text.title}</h3>
                                <p className="text-[9px] text-slate-400 capitalize">
                                    {travelMode === 'cycling' ? text.cycling : text.walking}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onCancel}
                            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-all"
                            title={text.cancel}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Points List */}
                <div className={`overflow-y-auto custom-scrollbar transition-all bg-black/10 ${isExpanded ? 'max-h-64' : 'max-h-auto'}`}>
                    {points.length === 0 ? (
                        <div className="px-4 py-3 text-center">
                            <p className="text-[10px] text-slate-400">{text.addPointHint}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {visiblePoints.map((point, revIndex) => {
                                // Calculate original index
                                const originalIndex = points.length - 1 - revIndex;
                                return (
                                    <div
                                        key={point.id || originalIndex}
                                        onClick={() => onPointClick && onPointClick(originalIndex)}
                                        className={`px-3 py-1.5 flex items-center gap-3 cursor-pointer transition-all ${selectedPointIndex === originalIndex
                                            ? 'bg-primary/10'
                                            : 'hover:bg-white/5'
                                            }`}
                                    >
                                        {/* Point Number Badge */}
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${originalIndex === 0
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : 'bg-primary/20 text-primary border border-primary/30'
                                            }`}>
                                            {originalIndex === 0 ? '★' : originalIndex}
                                        </div>

                                        {/* Point Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium text-white truncate leading-tight">
                                                {originalIndex === 0 ? text.start : point.name || `${text.stop} ${originalIndex}`}
                                            </p>
                                        </div>

                                        {/* Delete Button */}
                                        {(points.length === 1 || originalIndex > 0) && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeletePoint && onDeletePoint(originalIndex);
                                                }}
                                                className="p-1 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all"
                                                title={text.deletePoint}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Expand/Collapse Toggle - Fixed outside scrollable area */}
                {points.length > 2 && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full px-3 py-1.5 text-[10px] text-slate-400 hover:text-white hover:bg-white/5 text-center transition-colors border-t border-white/5 bg-slate-900/50 flex items-center justify-center gap-1 shrink-0"
                    >
                        {isExpanded
                            ? (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6" /></svg>
                                    {text.lessPoints}
                                </>
                            )
                            : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                                    {typeof text.morePoints === 'function' ? text.morePoints(points.length - 2) : text.morePoints}
                                </>
                            )
                        }
                    </button>
                )}

                {/* Stats Footer - Single Line Layout - Optimized Spacing */}
                {points.length > 0 && (
                    <div className="px-3 py-2 bg-white/5 border-t border-white/5 flex items-center justify-between gap-2 shrink-0">

                        {/* Left: Stats */}
                        <div className="flex items-center gap-2 shrink-0">
                            <div>
                                <p className="text-[8px] uppercase tracking-widest text-slate-500 font-bold leading-none mb-0.5">{text.totalDistance}</p>
                                <p className="text-xs font-black text-white leading-none">
                                    {isCalculating ? '...' : `${totalDistance.toFixed(1)} km`}
                                </p>
                            </div>
                            <div className="h-5 w-px bg-white/10" />
                            <div>
                                <p className="text-[8px] uppercase tracking-widest text-slate-500 font-bold leading-none mb-0.5">{text.estimatedTime}</p>
                                <p className="text-xs font-black text-primary leading-none">
                                    {isCalculating ? '...' : timeDisplay}
                                </p>
                            </div>
                        </div>

                        {/* Right: Action Buttons */}
                        <div className="flex gap-1.5">
                            <button
                                onClick={onCancel}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-all border border-white/5"
                                title={text.cancel}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                                </svg>
                            </button>
                            <button
                                onClick={onFinalize}
                                disabled={points.length < 2 || isCalculating}
                                className="py-1.5 px-3 rounded-lg bg-primary hover:bg-primary/90 text-white text-[10px] font-bold transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap"
                            >
                                {isCalculating ? (
                                    <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <path d="m9 11 3 3L22 4" />
                                    </svg>
                                )}
                                {text.finalize}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RouteEditPanel;
