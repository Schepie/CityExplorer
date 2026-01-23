import React, { useState } from 'react';

// Guide Icon Mapping for OSRM Maneuvers
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

const calcDistance = (p1, p2) => {
    const R = 6371; // km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLon = (p2.lng - p1.lng) * Math.PI / 180;
    const lat1 = (p1.lat) * Math.PI / 180;
    const lat2 = (p2.lat) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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

const NavigationOverlay = ({ steps, pois, language, isOpen, onClose, onToggle, userLocation, pastDistance = 0, totalTripDistance }) => {
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

    // Calculate Progress
    let progressStats = null;
    if (hasSteps && userLocation && !isFallback) {
        // 1. Total Distance (Sum of all steps in current leg)
        const currentLegTotal = activeSteps.reduce((acc, s) => acc + s.distance, 0) / 1000;

        // 2. Find Closest Step Start
        let minD = Infinity;
        let closestIdx = 0;
        activeSteps.forEach((s, i) => {
            const d = calcDistance(userLocation, { lat: s.maneuver.location[1], lng: s.maneuver.location[0] });
            if (d < minD) {
                minD = d;
                closestIdx = i;
            }
        });

        // 3. Approximate Remaining in Leg
        const targetIdx = Math.min(closestIdx + 1, activeSteps.length - 1);
        const distToTarget = calcDistance(userLocation, { lat: activeSteps[targetIdx].maneuver.location[1], lng: activeSteps[targetIdx].maneuver.location[0] });

        // Sum remaining steps
        let remainingStepsKm = 0;
        for (let i = targetIdx + 1; i < activeSteps.length; i++) {
            remainingStepsKm += activeSteps[i].distance / 1000;
        }

        const remainingInLeg = distToTarget + remainingStepsKm;
        const doneInLeg = Math.max(0, currentLegTotal - remainingInLeg);

        // Total Trip Stats
        const tripDone = pastDistance + doneInLeg;
        const tripTotal = totalTripDistance ? parseFloat(totalTripDistance) : currentLegTotal;

        // If we are on leg 2 of 3, tripTotal should be > currentLegTotal.
        // If not available, we fallback to current leg (which is technically wrong but handles single leg cases).

        const displayTotal = tripTotal > 0.1 ? tripTotal : currentLegTotal;
        const displayDone = tripDone;

        progressStats = {
            done: displayDone.toFixed(1),
            left: Math.max(0, displayTotal - displayDone).toFixed(1),
            total: displayTotal.toFixed(1),
            percentage: Math.min(100, Math.max(0, (displayDone / displayTotal) * 100))
        };
    }



    return (
        <>
            {/* Overlay Panel */}
            {isOpen && (
                <div className="absolute inset-0 z-[1100] bg-slate-900/40 backdrop-blur-sm flex justify-end">
                    <div
                        className="w-full max-w-md h-full bg-[var(--bg-gradient-end)] shadow-2xl border-l border-[var(--panel-border)] flex flex-col animate-in slide-in-from-right duration-300"
                    >

                        {/* Header */}
                        <div className="p-4 border-b border-[var(--panel-border)] bg-[var(--panel-bg)] flex items-center justify-between">
                            <h3 className="font-bold text-[var(--text-main)] flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full border border-primary overflow-hidden bg-white">
                                    <img src="/guide-icon-round.jpg" alt="Guide" className="w-full h-full object-cover scale-125" />
                                </div>
                                {language === 'nl' ? 'Routebeschrijving' : 'Turn-by-turn Navigation'}
                            </h3>
                            {progressStats && (
                                <div className="text-[10px] text-[var(--text-muted)] font-mono">
                                    {progressStats.done} / {progressStats.total} km
                                </div>
                            )}
                            <button onClick={onClose} className="p-2 hover:bg-[var(--input-bg)] rounded-full text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {!hasSteps && (
                                <div className="p-4 text-center text-[var(--text-muted)] text-sm italic">
                                    {language === 'nl' ? 'Geen routebeschrijving beschikbaar.' : 'No detailed steps available.'}
                                </div>
                            )}
                            {hasSteps && activeSteps.map((step, idx) => (
                                <div key={idx} className="flex gap-4 items-start p-3 rounded-xl bg-[var(--panel-bg)] border border-[var(--panel-border)] hover:bg-[var(--input-bg)] transition-colors group">
                                    <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-xl shrink-0 border border-blue-500/30 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        {getManeuverIcon(step.maneuver.modifier, step.maneuver.type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[var(--text-main)] font-medium text-sm leading-snug">
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
                        <div className="p-4 border-t border-[var(--panel-border)] bg-[var(--panel-bg)] text-xs text-[var(--text-muted)] text-center">
                            CityExplorer Navigation {isFallback ? '(Simplified)' : 'via OSRM'}
                        </div>
                    </div>
                </div>
            )
            }
        </>
    );
};

export default NavigationOverlay;
