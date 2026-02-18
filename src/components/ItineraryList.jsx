import React from 'react';
import { interleaveRouteItems } from '../utils/routeUtils';
import { getPoiCategoryIcon } from '../utils/uiUtils';
import PoiDetailContent from './PoiDetailContent';

const ItineraryList = ({
    language,
    text,
    isEnriching,
    onPauseEnrichment,
    onStartEnrichment,
    onReverseDirection,
    isLoading,
    loadingText,
    routeData,
    isDiscoveryTriggered,
    searchMode,
    selectedDiscoveryChips,
    setSelectedDiscoveryChips,
    discoveryChips,
    customDiscoveryInterest,
    setCustomDiscoveryInterest,
    onFindPoisAlongRoute,
    onSkipDiscovery,
    expandedPoi,
    setExpandedPoi,
    poiRefs,
    onPoiClick,
    descriptionLength,
    onPopupClose,
    onEnrichSinglePoi,
    setPoiToDelete,
    onCycleStart,
    setIsAiViewActive,
    setSearchMode,
    onSpeak,
    speakingId,
    isSpeechPaused,
    spokenCharCount,
    poiHighlightedWordRef,
    activeTheme,
    availableThemes,
    setViewAction,
    onStartMapPick,
    onRemovePoi,
    onAddToJourney,
    onStopsCountChange,
    scrollContainerRef,
    handleScroll
}) => {
    const manualStops = (routeData.routeMarkers || []);
    const interleaved = interleaveRouteItems(manualStops, routeData.pois || [], routeData.routePath);

    const items = interleaved.map(item => {
        if (item.specialType === 'start') {
            return {
                ...(routeData.startIsPoi ? routeData.startPoi : {}),
                ...item,
                id: 'sidebar-start',
                name: routeData.startName || (language === 'nl' ? 'Startpunt' : 'Start Point'),
                description: (routeData.startIsPoi && (routeData.startPoi?.description || routeData.startPoi?.structured_info?.short_description))
                    ? (routeData.startPoi.description || routeData.startPoi?.structured_info?.short_description)
                    : (routeData.startInfo || (language === 'nl' ? "Informatie over bereikbaarheid ophalen..." : "Fetching accessibility info...")),
                arrivalInfo: routeData.startInfo,
                isFullyEnriched: routeData.startIsPoi ? (routeData.startPoi?.isFullyEnriched) : (!!routeData.startInfo)
            };
        }
        if (item.isManualMarker) {
            return {
                ...item,
                isFullyEnriched: true,
                short_description: language === 'nl' ? 'Ingepland punt' : 'Planned stop'
            };
        }
        return item;
    });

    return (
        <>
            <div className="flex items-center justify-between mb-1 px-3.5 pt-3 pb-1.5">
                <h3 className="text-[10px] font-black tracking-widest text-white uppercase">
                    {language === 'nl' ? 'Jouw Dagplanning' : 'Your Schedule'}
                </h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isEnriching) {
                                if (onPauseEnrichment) onPauseEnrichment();
                            } else {
                                if (onStartEnrichment) onStartEnrichment();
                            }
                        }}
                        className={`flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all border shadow-sm whitespace-nowrap w-[115px] ${isEnriching
                            ? 'bg-primary/10 text-primary border-primary/20 animate-pulse'
                            : 'bg-white/5 text-[var(--text-muted)] border-white/10 hover:text-white hover:bg-white/10'
                            }`}
                        title={language === 'nl'
                            ? (isEnriching ? "Pauzeer het ophalen van info" : "Hervat info ophalen")
                            : (isEnriching ? "Pause info fetching" : "Update info")
                        }
                    >
                        {isEnriching ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                                {language === 'nl' ? 'PAUZE' : 'PAUSE'}
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
                                {language === 'nl' ? 'INFO UPDATEN' : 'UPDATE INFO'}
                            </>
                        )}
                    </button>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onReverseDirection) onReverseDirection();
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[10px] font-extrabold transition-all border border-emerald-500/20 shadow-sm"
                        title={language === 'nl' ? "Draai de looprichting om" : "Reverse walking direction"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m21 7-3-3-3 3"></path><path d="M18 16V4"></path><path d="m3 17 3 3 3-3"></path><path d="M6 8v12"></path></svg>
                        {language === 'nl' ? 'OMKEREN' : 'REVERSE'}
                    </button>
                </div>
            </div>
            {isLoading && (
                <div className="px-3.5 pb-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
                        <span className="text-xs font-bold text-primary">{loadingText || (language === 'nl' ? 'Bezig met verwerken...' : 'Processing...')}</span>
                    </div>
                </div>
            )}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-2.5 pb-2.5 custom-scrollbar"
            >
                {routeData && routeData.routePath && routeData.routePath.length > 0 && !isDiscoveryTriggered && searchMode !== 'journey' && (!routeData.pois || routeData.pois.length === 0) && (
                    <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="bg-gradient-to-br from-primary/10 to-blue-500/5 border border-primary/20 rounded-2x p-4 text-center relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl rounded-full -mr-8 -mt-8 group-hover:bg-primary/10 transition-colors" />

                            <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/30 shadow-lg shadow-primary/10">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    <path d="m18 8-4 4 4 4" />
                                </svg>
                            </div>

                            <h4 className="text-lg font-bold text-white mb-2">
                                {language === 'nl' ? 'Ontdek plekken langs je route' : 'Discover places along your route'}
                            </h4>
                            <p className="text-slate-400 text-sm mb-5 px-2">
                                {language === 'nl'
                                    ? 'Vind interessante stops gebaseerd op jouw interesses.'
                                    : 'Find interesting stops tailored to your preferences.'}
                            </p>

                            <div className="flex flex-wrap justify-center gap-2 mb-4">
                                {discoveryChips.map(chip => (
                                    <button
                                        key={chip.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const next = new Set(selectedDiscoveryChips);
                                            if (next.has(chip.id)) next.delete(chip.id);
                                            else next.add(chip.id);
                                            setSelectedDiscoveryChips(next);
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 ${selectedDiscoveryChips.has(chip.id)
                                            ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20'
                                            }`}
                                    >
                                        <span>{chip.icon}</span>
                                        {language === 'nl' ? chip.label.nl : chip.label.en}
                                    </button>
                                ))}
                            </div>

                            <div className="relative mb-6 mx-2">
                                <input
                                    type="text"
                                    value={customDiscoveryInterest}
                                    onChange={(e) => setCustomDiscoveryInterest(e.target.value)}
                                    placeholder={language === 'nl' ? 'Bijv. koffie, speeltuinen...' : 'e.g. coffee, playgrounds...'}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-2.5 px-10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-all font-medium"
                                />
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const chipInterests = Array.from(selectedDiscoveryChips).map(id => {
                                        const chip = discoveryChips.find(c => c.id === id);
                                        return chip ? chip.label.en : id;
                                    });
                                    const combinedInterests = [
                                        ...chipInterests,
                                        ...(customDiscoveryInterest ? [customDiscoveryInterest] : [])
                                    ].join(', ');

                                    if (onFindPoisAlongRoute) onFindPoisAlongRoute(combinedInterests || null);
                                }}
                                disabled={isLoading}
                                className="w-full bg-primary hover:bg-primary-hover disabled:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>{loadingText || (language === 'nl' ? 'Bezig...' : 'Processing...')}</span>
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
                                        </svg>
                                        <span>{language === 'nl' ? 'Nu ontdekken' : 'Discover now'}</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSkipDiscovery) onSkipDiscovery();
                                }}
                                className="w-full mt-2 py-2 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                {language === 'nl' ? 'Nee bedankt, ik volg gewoon de route' : 'No thanks, I will just follow the route'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {items.map((poi, index) => {
                        const isExpanded = expandedPoi === poi.id;
                        const displayNum = poi.isSpecial ? null : index;

                        return (
                            <div
                                key={poi.id}
                                ref={el => poiRefs.current[poi.id] = el}
                                onClick={() => {
                                    const newExpanded = isExpanded ? null : poi.id;
                                    setExpandedPoi(newExpanded);

                                    if (!isExpanded) {
                                        if (poi.isSpecial) {
                                            if (poi.specialType === 'start') {
                                                if (typeof setViewAction === 'function') setViewAction('ROUTE');
                                            } else onPoiClick(items[items.length - 1], 'medium');
                                        } else {
                                            onPoiClick(poi, descriptionLength || 'medium');
                                        }
                                    } else {
                                        if (onPopupClose) onPopupClose();
                                    }
                                }}
                                className={`group relative bg-[var(--panel-bg)] hover:bg-[var(--input-bg)] p-3 rounded-xl border transition-all cursor-pointer ${isExpanded ? 'border-primary/50 bg-[var(--input-bg)]' : 'border-[var(--panel-border)] hover:border-primary/30'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors
                                        ${poi.isSpecial
                                            ? (poi.specialType === 'start' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30')
                                            : (poi.isFullyEnriched
                                                ? (isExpanded ? 'bg-primary text-white border-primary' : 'bg-primary/20 text-primary border-primary/20 group-hover:bg-primary group-hover:text-white')
                                                : (poi.short_description
                                                    ? 'bg-primary/40 text-blue-200 border-primary/40 animate-pulse'
                                                    : 'bg-slate-700 text-slate-400 border-slate-600 animate-pulse'
                                                ))
                                        }`}>

                                        {poi.isSpecial ? (
                                            poi.specialType === 'start' ? (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                                            )
                                        ) : (
                                            poi.isManualMarker ? (
                                                <div className="w-3.5 h-3.5 border-2 border-current rotate-45 flex items-center justify-center rounded-[2px]">
                                                    <span className="-rotate-45 block scale-[0.8]">{displayNum}</span>
                                                </div>
                                            ) : (
                                                searchMode === 'radius' ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="11" r="3" /><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" /></svg>
                                                ) : displayNum
                                            )
                                        )}
                                    </div>
                                    <h3 className={`font-semibold transition-colors line-clamp-1 flex items-center gap-1.5 ${isExpanded ? 'text-primary' : 'text-[var(--text-main)] group-hover:text-primary'} pr-24`}>
                                        {poi.name}
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            {getPoiCategoryIcon(poi)}
                                        </svg>
                                    </h3>
                                </div>

                                {!poi.isSpecial && (
                                    <div className="absolute top-4 right-3 flex items-center gap-1">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onEnrichSinglePoi) onEnrichSinglePoi(poi);
                                            }}
                                            className={`p-1.5 rounded-full transition-all focus:opacity-100 ${poi.isLoading ? 'text-primary animate-pulse' : 'text-[var(--text-muted)] hover:text-primary hover:bg-primary/10'}`}
                                            title={language === 'nl' ? "Info updaten" : "Update info"}
                                            disabled={poi.isLoading}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPoiToDelete(poi);
                                            }}
                                            className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all focus:opacity-100"
                                            title={language === 'nl' ? "Verwijder" : "Remove"}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                )}

                                {isExpanded && (
                                    <div className="mt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                        <div className="space-y-4">
                                            <div className="flex flex-wrap gap-2">
                                                {!poi.isSpecial && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (onCycleStart) onCycleStart(poi.id);
                                                        }}
                                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-black tracking-wider transition-all border border-emerald-500/20 shadow-sm active:scale-95"
                                                        title={language === 'nl' ? "Maak dit het nieuwe startpunt" : "Make this the new start point"}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                                        {language === 'nl' ? 'STARTPUNT' : 'START POINT'}
                                                    </button>
                                                )}

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSearchMode('prompt');
                                                        setIsAiViewActive(true);
                                                    }}
                                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-black tracking-wider transition-all border border-primary/20 shadow-sm active:scale-95"
                                                    title={language === 'nl' ? "Pas route aan" : "Adjust Route"}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                    </svg>
                                                    {language === 'nl' ? 'WIJZIG' : 'EDIT'}
                                                </button>

                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onSpeak(poi); }}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-all border shadow-sm active:scale-95 ${speakingId === poi.id
                                                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/30'
                                                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 border-white/10'
                                                        }`}
                                                    title="Read Aloud"
                                                >
                                                    {speakingId === poi.id && !isSpeechPaused ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 animate-pulse" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                                    )}
                                                </button>
                                            </div>

                                            <PoiDetailContent
                                                poi={poi}
                                                language={language}
                                                speakingId={speakingId}
                                                spokenCharCount={spokenCharCount}
                                                highlightRef={poiHighlightedWordRef}
                                                isDark={true}
                                                primaryColor={activeTheme && availableThemes?.[activeTheme] ? availableThemes[activeTheme].colors.primary : '#3b82f6'}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

export default ItineraryList;
