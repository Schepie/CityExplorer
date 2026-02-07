import React from 'react';

/**
 * Shared component for POI Details across Sidebar and Map Popups.
 * Ensures identical formatting, content, and ordering.
 */
const PoiDetailContent = ({
    poi,
    language,
    speakingId,
    spokenCharCount,
    highlightRef,
    isDark = true,
    primaryColor = '#3b82f6'
}) => {
    if (!poi) return null;

    const hexToRgba = (hex, alpha) => {
        if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(0,0,0,${alpha})`;
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const textMain = isDark ? 'text-white' : 'text-slate-900';
    const textMuted = isDark ? 'text-slate-400' : 'text-slate-600';
    const textDescription = isDark ? 'text-slate-300' : 'text-slate-700';
    const bgPanel = isDark ? 'bg-slate-900/50' : 'bg-slate-50/80';
    const borderPanel = isDark ? 'border-white/5' : 'border-slate-200';

    const isUnknown = (val) => {
        if (!val) return true;
        if (Array.isArray(val)) {
            return val.length === 0 || val.every(v => isUnknown(v));
        }
        const s = String(val).toLowerCase().trim().replace(/[".]/g, '');
        return s === 'onbekend' || s === 'unknown';
    };

    const info = poi.structured_info;

    // --- Offset Calculations for Unified Speech Highlighting ---
    // These MUST match the construction logic in App.jsx handleSpeak
    let currentOffset = 0;
    const offsets = {};

    const sections = [
        { id: 'short', text: info?.short_description },
        { id: 'full', text: info?.full_description },
        {
            id: 'reasons',
            prefix: language === 'nl' ? "Waarom dit bij je past: " : "Why this matches your interests: ",
            content: info?.matching_reasons?.join(". ")
        },
        {
            id: 'facts',
            prefix: language === 'nl' ? "Wist je dat? " : "Did you know? ",
            content: info?.fun_facts?.join(". ")
        },
        {
            id: 'highlight',
            prefix: language === 'nl' ? "Als je maar twee minuten hebt: " : "If you only have two minutes: ",
            content: info?.two_minute_highlight
        },
        {
            id: 'tips',
            prefix: language === 'nl' ? "Tips: " : "Tips: ",
            content: info?.visitor_tips
        }
    ];

    sections.forEach(sec => {
        const fullText = sec.prefix ? (sec.content ? sec.prefix + sec.content : "") : (sec.text || "");
        if (fullText) {
            offsets[sec.id] = currentOffset;
            currentOffset += fullText.length + 2; // +2 for \n\n
        } else {
            offsets[sec.id] = -1;
        }
    });

    /**
     * Helper to render text with highlighting
     * @param {string} text - The segment text
     * @param {number} startOffset - World-space char index where this segment starts
     * @param {string} baseClass - Default text class
     */
    const renderWithHighlight = (text, startOffset, baseClass) => {
        if (speakingId !== poi.id || spokenCharCount === undefined || startOffset === -1) return text;

        const idx = spokenCharCount - startOffset;
        if (idx < 0) return <span className="opacity-30">{text}</span>;
        if (idx >= text.length) return <span className={baseClass}>{text}</span>;

        let endIdx = text.indexOf(' ', idx);
        if (endIdx === -1) endIdx = text.length;

        const before = text.slice(0, idx);
        const current = text.slice(idx, endIdx);
        const after = text.slice(endIdx);

        return (
            <>
                <span className={baseClass}>{before}</span>
                <span
                    ref={highlightRef}
                    style={{ backgroundColor: hexToRgba(primaryColor, 0.4), borderRadius: '2px' }}
                    className={`${textMain} font-bold`}
                >
                    {current}
                </span>
                <span className="opacity-40">{after}</span>
            </>
        );
    };

    const ConfidenceBadge = ({ confidence }) => {
        if (!confidence) return null;

        const c = confidence.toLowerCase();
        const isHigh = c === 'hoog' || c === 'high';
        const isMid = c === 'middel' || c === 'medium';
        const isLow = !isHigh && !isMid;

        let icon;
        let colorClass;
        let title;

        if (isHigh) {
            colorClass = 'text-emerald-400 bg-emerald-400/10';
            title = language === 'nl' ? 'Hoge betrouwbaarheid' : 'High confidence';
            icon = (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>
            );
        } else if (isMid) {
            colorClass = 'text-blue-400 bg-blue-400/10';
            title = language === 'nl' ? 'Gemiddelde betrouwbaarheid' : 'Medium confidence';
            icon = (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            );
        } else {
            colorClass = 'text-amber-400 bg-amber-400/10';
            title = language === 'nl' ? 'Lage betrouwbaarheid' : 'Low confidence';
            icon = (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m10.29 3.86 7.98 13.9a2 2 0 0 1-1.71 3H3.44a2 2 0 0 1-1.71-3l7.98-13.9a2 2 0 0 1 3.44 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            );
        }

        return (
            <span
                className={`p-1 rounded-md ${colorClass} ml-2 border border-current/20 flex items-center justify-center transition-transform hover:scale-110`}
                title={title}
            >
                {icon}
            </span>
        );
    };

    return (
        <div className="space-y-4 pr-1">
            {/* 1. POI Image */}
            {poi.image && (
                <div className={`rounded-xl overflow-hidden border ${borderPanel} shadow-xl h-52 bg-slate-800/50 relative group`}>
                    <img
                        src={poi.image}
                        alt={poi.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        onLoad={(e) => e.target.style.opacity = '1'}
                        onError={(e) => {
                            e.target.closest('.group').style.display = 'none';
                        }}
                        style={{ opacity: 0, transition: 'opacity 0.8s' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                </div>
            )}

            {/* 2. Short Description (Level 1) */}
            <div className={`text-sm ${textDescription} font-medium leading-relaxed italic border-l-2 border-primary/30 pl-3`}>
                {renderWithHighlight(info?.short_description || poi.description || (language === 'nl' ? "Geen beschrijving beschikbaar." : "No description available."), offsets.short, "not-italic")}
            </div>

            {/* 3. Interest Alignment / Matching Reasons */}
            {info?.matching_reasons && info.matching_reasons.length > 0 && !isUnknown(info.matching_reasons) && (
                <div className="space-y-2">
                    <h4 className="text-[10px] uppercase tracking-widest text-primary font-bold mb-2 flex items-center">
                        {language === 'nl' ? 'WAAROM DIT BIJ JE PAST' : 'WHY THIS MATCHES YOUR INTERESTS'}
                        <ConfidenceBadge confidence={info.matching_reasons_confidence} />
                    </h4>
                    <div className="grid gap-1.5">
                        {/* Note: Highlighting here is slightly approximate as it uses the joint reasons text */}
                        <div className="text-xs text-primary leading-relaxed opacity-90">
                            {renderWithHighlight(info.matching_reasons.join(". "), offsets.reasons + (sections.find(s => s.id === 'reasons').prefix?.length || 0), "text-primary")}
                        </div>
                    </div>
                </div>
            )}

            {/* 3.5 Arrival / Transport Instructions (For Start Points) */}
            {poi.arrivalInfo && (
                <div className={`${isDark ? 'bg-emerald-500/5' : 'bg-emerald-50'} border ${isDark ? 'border-emerald-500/10' : 'border-emerald-200'} rounded-xl p-3 space-y-2`}>
                    <h4 className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold mb-2 flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        {language === 'nl' ? 'AANKOMST & PARKEREN' : 'ARRIVAL & PARKING'}
                    </h4>
                    <div className={`text-xs ${textMuted} leading-relaxed font-medium`}>
                        {poi.arrivalInfo}
                    </div>
                </div>
            )}

            {/* 4. Full Description (Level 3) */}
            {info?.full_description && !isUnknown(info.full_description) && (
                <div className="space-y-4">
                    <h4 className="text-[10px] uppercase tracking-widest text-white font-black mb-2 flex items-center">
                        {language === 'nl' ? 'OVER DEZE PLEK' : 'ABOUT THIS PLACE'}
                        <ConfidenceBadge confidence={info.full_description_confidence} />
                    </h4>
                    <div className={`text-sm ${textDescription} leading-relaxed whitespace-pre-wrap`}>
                        {renderWithHighlight(info.full_description, offsets.full, textMuted)}
                    </div>
                </div>
            )}

            {/* 5. Fun Facts */}
            {info?.fun_facts && info.fun_facts.length > 0 && !isUnknown(info.fun_facts) && (
                <div className={`${isDark ? 'bg-blue-500/5' : 'bg-blue-50'} border ${isDark ? 'border-blue-500/10' : 'border-blue-200'} rounded-xl p-3 space-y-2`}>
                    <h4 className="text-[10px] uppercase tracking-widest text-blue-400 font-bold mb-2 flex items-center gap-1.5">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>
                        {language === 'nl' ? 'WIST JE DAT?' : 'FUN FACTS'}
                        <ConfidenceBadge confidence={info.fun_facts_confidence} />
                    </h4>
                    <div className={`text-xs ${textMuted} space-y-1.5`}>
                        {renderWithHighlight(info.fun_facts.join(". "), offsets.facts + (sections.find(s => s.id === 'facts').prefix?.length || 0), textMuted)}
                    </div>
                </div>
            )}

            {/* 6. 2 Minute Highlight */}
            {info?.two_minute_highlight && !isUnknown(info.two_minute_highlight) && (
                <div className={`${isDark ? 'bg-amber-500/5' : 'bg-amber-50'} border ${isDark ? 'border-amber-500/10' : 'border-amber-200'} rounded-xl p-3`}>
                    <h4 className="text-[10px] uppercase tracking-widest text-amber-500 font-bold mb-2 flex items-center">
                        {language === 'nl' ? 'ALS JE MAAR 2 MINUTEN HEBT' : 'IF YOU ONLY HAVE 2 MINUTES'}
                        <ConfidenceBadge confidence={info.two_minute_highlight_confidence} />
                    </h4>
                    <div className={`text-xs ${textMuted} italic`}>
                        "{renderWithHighlight(info.two_minute_highlight, offsets.highlight + (sections.find(s => s.id === 'highlight').prefix?.length || 0), "italic")}"
                    </div>
                </div>
            )}

            {/* 7. Visitor Tips */}
            {info?.visitor_tips && !isUnknown(info.visitor_tips) && (
                <div className={`flex items-start gap-2 ${bgPanel} p-2.5 rounded-lg border ${borderPanel}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${textMuted} shrink-0 mt-0.5`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    <div className={`text-[11px] ${textMuted}`}>
                        <span className="font-bold uppercase mr-1 flex items-center">
                            {language === 'nl' ? 'TIPS:' : 'TIPS:'}
                            <ConfidenceBadge confidence={info.visitor_tips_confidence} />
                        </span>
                        {renderWithHighlight(info.visitor_tips, offsets.tips + (sections.find(s => s.id === 'tips').prefix?.length || 0), textMuted)}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PoiDetailContent;
