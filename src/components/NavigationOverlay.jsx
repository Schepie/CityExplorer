import React, { useState } from 'react';

// Simple Icon Mapping for OSRM Maneuvers
const getManeuverIcon = (modifier, type) => {
    if (type === 'arrive') return '🏁';
    if (type === 'depart') return '🚀';

    switch (modifier) {
        case 'left': return '⬅️';
        case 'right': return '➡️';
        case 'sharp left': return '↙️';
        case 'sharp right': return '↘️';
        case 'slight left': return '↖️';
        case 'slight right': return '↗️';
        case 'straight': return '⬆️';
        case 'uturn': return '🔄';
        default: return '⬆️';
    }
};

// Translate Instructions (Basic)
const translateInstruction = (step, lang) => {
    // OSRM provides English text in step.name and step.maneuver.
    // Full translation is hard without a library, but we can do basic prefixes.
    const { maneuver, name, distance } = step;
    const distStr = distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`;

    if (lang === 'en') {
        if (maneuver.type === 'arrive') return `Arrive at destination`;
        if (maneuver.type === 'depart') return `Head ${maneuver.modifier || 'out'} on ${name || 'path'}`;
        if (!name) return `${maneuver.modifier} (${distStr})`;
        return `${maneuver.type} ${maneuver.modifier} onto ${name}`;
    }

    // Dutch Mapping
    const dirs = {
        'left': 'links', 'right': 'rechts', 'sharp left': 'scherp links', 'sharp right': 'scherp rechts',
        'slight left': 'licht links', 'slight right': 'licht rechts', 'straight': 'rechtdoor', 'uturn': 'omkeren'
    };
    const m = dirs[maneuver.modifier] || maneuver.modifier;

    if (maneuver.type === 'arrive') return `Aankomst bij bestemming`;
    if (maneuver.type === 'depart') return `Vertrek op ${name || 'pad'}`;

    return `Ga ${m} op ${name || 'het pad'}`;
};

const NavigationOverlay = ({ steps, pois, language, isOpen, onClose, onToggle }) => {
    let activeSteps = steps;
    let isFallback = false;

    // UI-Level Fallback: If no OSRM steps but we have POIs, generate a simple list
    if ((!activeSteps || activeSteps.length === 0) && pois && pois.length > 0) {
        activeSteps = pois.map(p => ({
            maneuver: { type: 'depart', modifier: 'straight' },
            name: p.name,
            distance: 0,
            isFallback: true
        }));
        isFallback = true;
    }

    const hasSteps = activeSteps && activeSteps.length > 0;

    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isRightSwipe) {
            onClose();
        }
    };

    return (
        <>
            {/* Toggle Button (Visible when route exists) */}
            {/* Toggle Button removed - moved to MapContainer */}

            {/* Overlay Panel */}
            {isOpen && (
                <div className="absolute inset-0 z-[1100] bg-slate-900/40 backdrop-blur-sm flex justify-end">
                    <div
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                        className="w-full max-w-md h-full bg-slate-900 shadow-2xl border-l border-white/10 flex flex-col animate-in slide-in-from-right duration-300"
                    >

                        {/* Header */}
                        <div className="p-4 border-b border-white/10 bg-slate-800/50 flex items-center justify-between">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <span>🚶</span> {language === 'nl' ? 'Routebeschrijving' : 'Turn-by-turn Navigation'}
                            </h3>
                            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {!hasSteps && (
                                <div className="p-4 text-center text-slate-400 text-sm italic">
                                    {language === 'nl' ? 'Geen routebeschrijving beschikbaar.' : 'No detailed steps available.'}
                                </div>
                            )}
                            {hasSteps && activeSteps.map((step, idx) => (
                                <div key={idx} className="flex gap-4 items-start p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                                    <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-xl shrink-0 border border-blue-500/30 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        {getManeuverIcon(step.maneuver.modifier, step.maneuver.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-slate-200 font-medium text-sm leading-snug">
                                            {/* Use OSRM provided text if available, or generate it */}
                                            {step.isFallback
                                                ? (language === 'nl' ? `Ga naar ${step.name}` : `Go to ${step.name}`)
                                                : translateInstruction(step, language)
                                            }
                                        </p>
                                        <div className="flex items-center gap-4 mt-1">
                                            {!step.isFallback && (
                                                <span className="text-xs text-slate-500 font-bold bg-black/20 px-1.5 py-0.5 rounded">
                                                    {step.distance < 1000 ? `${Math.round(step.distance)}m` : `${(step.distance / 1000).toFixed(1)}km`}
                                                </span>
                                            )}
                                            {step.name && <span className="text-xs text-blue-400 truncate">{step.name}</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Generic Finish */}
                            <div className="flex gap-4 items-center p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm">✓</div>
                                <span className="text-green-400 font-bold text-sm">
                                    {language === 'nl' ? 'Je bent er!' : 'You have arrived!'}
                                </span>
                            </div>
                        </div>

                        {/* Footer Stats */}
                        <div className="p-4 border-t border-white/10 bg-slate-800/80 text-xs text-slate-400 text-center">
                            CityExplorer Navigation {isFallback ? '(Simplified)' : 'via OSRM'}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default NavigationOverlay;
