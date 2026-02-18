import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { PoiIntelligence } from '../services/PoiIntelligence';
import { apiFetch } from '../utils/api';
import { SmartAutoScroller } from '../utils/AutoScroller';
import ConfirmationModal from './ConfirmationModal';
import RouteRefiner from './RouteRefiner';
import PoiDetailContent from './PoiDetailContent';
import SidebarInput from './SidebarInput';
import CityWelcomeCard from './CityWelcomeCard';
import SidebarSettings from './SidebarSettings';
import { hexToRgba, getPoiCategoryIcon } from '../utils/uiUtils';
import { interleaveRouteItems } from '../utils/routeUtils';
import ItineraryList from './ItineraryList';

// SidebarInput, CityWelcomeCard, SidebarSettings, ItineraryList moved to their own files
const ItinerarySidebar = ({
    routeData, onPoiClick, onReset, language, setLanguage,
    speakingId, onSpeak, autoAudio, setAutoAudio,
    userLocation,
    spokenNavigationEnabled, setSpokenNavigationEnabled,
    voiceSettings, setVoiceSettings,
    city, setCity, interests, setInterests,
    constraintType, setConstraintType,
    constraintValue, onConstraintValueChange,
    onConstraintValueFinal,
    isRoundtrip, setIsRoundtrip,
    startPoint, setStartPoint,
    stopPoint, setStopPoint,
    searchSources, setSearchSources,
    onJourneyStart, onAddToJourney,
    onSearchStopOptions, onSearchPOIs, onSelectStopOption,
    isLoading, setIsLoading, loadingText, setLoadingText, onCityValidation,
    onUseCurrentLocation,
    disambiguationOptions, onDisambiguationSelect, onDisambiguationCancel,
    searchMode, setSearchMode,
    isOpen, setIsOpen,
    onUpdatePoiDescription,
    onPopupClose,
    travelMode, onStyleChange,
    onStopSpeech, // Callback to stop audio
    onSave, onSaveAs, onLoad,
    descriptionLength, setDescriptionLength,
    activeTheme, setActiveTheme, availableThemes,
    isSimulating, setIsSimulating,
    isSimulationEnabled, setIsSimulationEnabled,
    focusedLocation, onCycleStart, onReverseDirection,
    spokenCharCount,
    isSpeechPaused,
    aiPrompt,
    setAiPrompt,
    aiChatHistory,
    isAiViewActive,
    setIsAiViewActive,
    activePoiIndex,

    onRemovePoi,
    onStopsCountChange,
    onUpdateStartLocation,
    setViewAction,
    onStartMapPick,
    isRouteEditMode,
    isEnriching,
    onStartEnrichment,
    onPauseEnrichment,
    onEnrichSinglePoi,
    onFindPoisAlongRoute,
    onSkipDiscovery,
    isDiscoveryTriggered,
    aiProvider, setAiProvider,
    searchProvider, setSearchProvider,
    autoSave, setAutoSave,
    confidenceThreshold, setConfidenceThreshold,
    version, author, lastUpdated
}) => {

    const [nearbyCities, setNearbyCities] = useState([]);
    const [isAddingMode, setIsAddingMode] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showChangelog, setShowChangelog] = useState(false);
    const [settingsOpenedFromMap, setSettingsOpenedFromMap] = useState(false);
    const [shouldAutoFocusInterests, setShouldAutoFocusInterests] = useState(false);
    const [expandedPoi, setExpandedPoi] = useState(null);
    const [poiToDelete, setPoiToDelete] = useState(null);
    const [showTruthfulnessLegend, setShowTruthfulnessLegend] = useState(false);
    const [selectedDiscoveryChips, setSelectedDiscoveryChips] = useState(new Set());
    const [customDiscoveryInterest, setCustomDiscoveryInterest] = useState('');

    const discoveryChips = [
        { id: 'parks', label: { en: 'Parks', nl: 'Parken' }, icon: '🌳' },
        { id: 'restaurants', label: { en: 'Food', nl: 'Eten' }, icon: '🍴' },
        { id: 'culture', label: { en: 'Culture', nl: 'Cultuur' }, icon: '🏛️' },
        { id: 'landmarks', label: { en: 'Sights', nl: 'Beziens' }, icon: '📸' }
    ];

    const poiHighlightedWordRef = useRef(null);
    const scrollerRef = useRef(null);

    // Determine View Mode
    // Show itinerary if we have POIs OR if we have a finalized route path (discovery flow)
    const hasRoute = routeData && routeData.routePath && routeData.routePath.length > 0;
    const hasPois = routeData && routeData.pois && routeData.pois.length > 0;
    const showItinerary = !isAddingMode && !isRouteEditMode && (hasPois || hasRoute) && !isAiViewActive;
    const showDisambiguation = disambiguationOptions && disambiguationOptions.length > 0;

    // Initialize SmartAutoScroller
    useEffect(() => {
        if (scrollContainerRef.current) {
            if (scrollerRef.current) scrollerRef.current.destroy();
            scrollerRef.current = new SmartAutoScroller(scrollContainerRef.current, {
                pinStrategy: 'top',
                topMargin: 80,
                bottomMargin: 100
            });
        }
        return () => scrollerRef.current?.destroy();
    }, [showItinerary, isAddingMode, isAiViewActive, showSettings]);

    // Sync POI highlight
    useEffect(() => {
        if (speakingId && speakingId !== `city-welcome-${city}` && poiHighlightedWordRef.current) {
            scrollerRef.current?.syncHighlight(poiHighlightedWordRef.current);
        }
    }, [spokenCharCount, speakingId, city]);
    const poiRefs = useRef({});

    // Sync expanded state with map focus
    useEffect(() => {
        if (focusedLocation) {
            setExpandedPoi(focusedLocation.id);
            // Scroll to view
            setTimeout(() => {
                const el = poiRefs.current[focusedLocation.id];
                if (el && scrollerRef.current) {
                    scrollerRef.current.focusElement(el);
                }
            }, 600);
        } else {
            setExpandedPoi(null);
        }
    }, [focusedLocation]);
    const [showSources, setShowSources] = useState(false);
    const [isSubWizardActive, setIsSubWizardActive] = useState(false);

    // Fetch Nearby Cities (Generic logic moved here)
    // Fetch Nearby Cities (Overpass API for real data)
    // DISABLED: Geolocation request on mount violates browser privacy standards
    // This would require user interaction first. For now, using default cities.
    useEffect(() => {
        // Use default cities instead of requesting geolocation
        setNearbyCities(['Brussels', 'Antwerp', 'Ghent', 'Hasselt']);
    }, []);

    const t = {
        en: {
            journey: "CityExplorer",
            dist: "Distance",
            budget: "Budget",
            startNew: "New Search",
            poi: "Point of Interest",
            disambig_title: "Which",
            back: "Back",
            add: "Add Spots",
            add_short: "Add",
            options: "Options",
            reset: "Restart",
            save: "Save",
            adjust: "Adjust Plan",
            guide: "Ask the guide"
        },
        nl: {
            journey: "CityExplorer",
            dist: "Afstand",
            budget: "Budget",
            startNew: "Nieuwe Zoekopdracht",
            poi: "Bezienswaardigheid",
            disambig_title: "Welke",
            back: "Terug",
            add: "Spots Toevoegen",
            add_short: "Voeg toe",
            options: "Opties",
            reset: "Herstarten",
            save: "Opslaan",
            adjust: "Wijzig Plan",
            guide: "Vraag de gids"
        }
    };
    const text = t[language || 'en'];



    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

    const onTouchEnd = (targetMode) => {
        // Search Menu check: Don't allow closing if in search mode
        const isSearchMenu = !showItinerary && !showSettings;

        if (!touchStart || (!touchEnd && !targetMode)) return;

        const distance = (touchStart && touchEnd) ? touchStart - touchEnd : 0;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isOpen && isLeftSwipe && (!isSearchMenu || isAiViewActive)) {
            setIsOpen(false);
            if (isAiViewActive) {
                setIsAiViewActive(false);
            }
        }

        if (!isOpen && isRightSwipe) {
            setIsOpen(true);
            setShowSettings(false);
        }
    };


    const handleOpenItinerary = () => {
        setIsOpen(true);
        setShowSettings(false);
        setSettingsOpenedFromMap(false);
    };

    const handleOpenSettings = () => {
        setIsOpen(true);
        setShowSettings(true);
        setSettingsOpenedFromMap(true);
    };

    const clearServiceLogs = async () => {
        if (!confirm(language === 'nl' ? "Weet je zeker dat je de logs wilt wissen?" : "Are you sure you want to clear the logs?")) return false;
        try {
            const res = await apiFetch('/api/logs/clear', { method: 'POST' });
            return res.ok;
        } catch (e) {
            console.error("Failed to clear logs:", e);
            return false;
        }
    };

    const onButtonTouchEnd = (mode) => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isRightSwipe) {
            setIsOpen(true);
            setShowSettings(mode === 'settings');
        }
    };


    // Scroll Preservation
    const scrollContainerRef = useRef(null);
    const scrollPosRef = useRef(0);

    const handleScroll = (e) => {
        if (e.target) scrollPosRef.current = e.target.scrollTop;
    };

    useLayoutEffect(() => {
        // If data updates (e.g. enrichment), restore scroll position to prevent jump to top
        if (scrollContainerRef.current && scrollPosRef.current > 0) {
            scrollContainerRef.current.scrollTop = scrollPosRef.current;
        }
    }, [routeData]);

    return (
        <>
            {!isOpen && !isRouteEditMode && (
                <>
                    {/* Invisible Edge Swipe Area for Mobile Opening */}
                    <div
                        className="fixed top-0 left-0 w-8 h-full z-[390]"
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                    />
                    <button
                        onClick={handleOpenItinerary}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={() => onButtonTouchEnd('itinerary')}
                        className="absolute bottom-4 left-0 z-[400] w-[80px] h-12 flex items-center group outline-none"
                        title={language === 'nl' ? 'Uitklappen' : 'Expand'}
                    >
                        <div
                            style={{ backgroundColor: activeTheme && availableThemes?.[activeTheme] ? availableThemes[activeTheme].colors.primary : '#3b82f6' }}
                            className="w-10 h-full rounded-r-xl flex items-center justify-center shadow-[4px_0_15px_rgba(0,0,0,0.3)] border border-white/20 border-l-0 transition-all opacity-70 group-hover:opacity-100"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:hidden group-hover:scale-110 transition-transform text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 hidden md:block group-hover:scale-110 transition-transform text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>
                </>
            )}



            <div
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{
                    '--primary': activeTheme && availableThemes?.[activeTheme] ? availableThemes[activeTheme].colors.primary : '#3b82f6',
                    '--accent': activeTheme && availableThemes?.[activeTheme] ? availableThemes[activeTheme].colors.accent : '#60a5fa',
                    '--primary-rgb': activeTheme && availableThemes?.[activeTheme] ?
                        (() => {
                            const hex = availableThemes[activeTheme].colors.primary;
                            const r = parseInt(hex.slice(1, 3), 16);
                            const g = parseInt(hex.slice(3, 5), 16);
                            const b = parseInt(hex.slice(5, 7), 16);
                            return `${r}, ${g}, ${b}`;
                        })() : '59, 130, 246'
                }}
                className={`absolute top-0 left-0 h-full z-[1100] w-full md:w-[440px] max-w-full bg-[var(--bg-gradient-end)]/95 backdrop-blur-xl border-r border-white/10 shadow-2xl transition-transform duration-300 ease-in-out transform ${isOpen && !isRouteEditMode ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="flex flex-col h-full bg-gradient-to-b from-[var(--bg-gradient-start)]/50 to-transparent">
                    {/* Header */}
                    <div className="px-4 pt-4 pb-2 border-b border-white/10">
                        {!isAiViewActive || !routeData ? (
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-3">
                                    <img src="/logo.jpg" alt="App Icon" className="w-10 h-10 rounded-xl shadow-md border border-white/20" />
                                    <h2 className="text-2xl font-bold text-white tracking-tight leading-none">{text.journey}</h2>
                                </div>
                                {/* Lang and Close Controls */}
                                <div className="flex items-center gap-1">
                                    {/* Load Journey Icon - Only in Search View */}
                                    {!showItinerary && (
                                        <div className="relative group">
                                            <input
                                                type="file"
                                                accept=".json"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        if (onLoad) onLoad(e.target.files[0]);
                                                        e.target.value = null;
                                                    }
                                                }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                            />
                                            <button
                                                type="button"
                                                className="p-2 rounded-full transition-all mt-1 text-slate-400 hover:text-white hover:bg-white/5"
                                                title={language === 'nl' ? 'Laad Trip' : 'Load Journey'}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}





                                    {/* Adjust/Edit Icon - Opens Route Refiner */}
                                    {showItinerary && !isAiViewActive && (
                                        <button
                                            onClick={() => {
                                                setSearchMode('prompt');
                                                setIsAiViewActive(true);
                                                setShowSettings(false);
                                            }}
                                            className="p-2 rounded-full transition-all mt-1 text-slate-400 hover:text-white hover:bg-white/5"
                                            title={language === 'nl' ? 'Route Opties' : 'Route Options'}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                    )}



                                    <button
                                        onClick={() => {
                                            const nextValue = !showSettings;
                                            setShowSettings(nextValue);
                                            if (nextValue) setSettingsOpenedFromMap(false);
                                        }}
                                        className={`p-2 rounded-full transition-all mt-1 ${showSettings ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                        title="Settings"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                        </svg>
                                    </button>

                                    {(showItinerary || showSettings) && (
                                        <>
                                            <button
                                                onClick={() => { setIsOpen(false); onStopSpeech?.(); }}
                                                className="p-2 rounded-full transition-all mt-1 text-slate-400 hover:text-white hover:bg-white/5 md:hidden"
                                                title={language === 'nl' ? 'Inklappen' : 'Collapse'}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                </svg>
                                            </button>

                                            <button
                                                onClick={() => { setIsOpen(false); onStopSpeech?.(); }}
                                                className="p-2 rounded-full transition-all mt-1 text-slate-400 hover:text-white hover:bg-white/5 hidden md:block"
                                                title={language === 'nl' ? 'Inklappen' : 'Collapse'}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                                </svg>
                                            </button>
                                        </>
                                    )}


                                </div>
                            </div>
                        ) : (
                            /* Route Options Header - Icon, Title and Settings Button */
                            <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 shadow-lg shadow-primary/10">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white leading-tight">
                                            {language === 'nl' ? "Route Opties" : "Route Options"}
                                        </h2>
                                        <p className="text-[10px] text-slate-400 font-medium leading-tight max-w-[200px]">
                                            {language === 'nl'
                                                ? "Pas je reis aan"
                                                : "Adjust your trip"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                    <button
                                        onClick={() => {
                                            const nextValue = !showSettings;
                                            setShowSettings(nextValue);
                                            if (nextValue) setSettingsOpenedFromMap(false);
                                        }}
                                        className={`p-2 rounded-full transition-all ${showSettings ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                        title="Settings"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                        </svg>
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (isAiViewActive) {
                                                setIsAiViewActive(false);
                                            } else {
                                                setIsOpen(false);
                                                onStopSpeech?.();
                                            }
                                        }}
                                        className="p-2 rounded-full transition-all text-slate-400 hover:text-white hover:bg-white/5 md:hidden"
                                        title={language === 'nl' ? 'Inklappen' : 'Collapse'}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>

                                    <button
                                        onClick={() => {
                                            if (isAiViewActive) {
                                                setIsAiViewActive(false);
                                            } else {
                                                setIsOpen(false);
                                                onStopSpeech?.();
                                            }
                                        }}
                                        className="p-2 rounded-full transition-all text-slate-400 hover:text-white hover:bg-white/5 hidden md:block"
                                        title={language === 'nl' ? 'Inklappen' : 'Collapse'}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}


                    </div>
                    {/* City Welcome Card (Replaces Stats Summary) */}
                    {!isAiViewActive && showItinerary && (
                        <div className="mt-1 px-5">
                            <CityWelcomeCard
                                city={city}
                                center={routeData.center}
                                stats={routeData.stats}
                                language={language}
                                pois={routeData.pois}
                                speakingId={speakingId}
                                onSpeak={onSpeak}
                                autoAudio={autoAudio}
                                interests={interests}
                                searchMode={searchMode}
                                constraintValue={constraintValue}
                                constraintType={constraintType}
                                isRoundtrip={isRoundtrip}
                                activeTheme={availableThemes?.[activeTheme]}
                                travelMode={travelMode}
                                userLocation={userLocation}
                                onStopSpeech={onStopSpeech}
                                spokenCharCount={spokenCharCount}
                                isSpeechPaused={isSpeechPaused}
                                scroller={scrollerRef.current}
                                isAiViewActive={isAiViewActive}

                                setIsAiViewActive={setIsAiViewActive}
                                onUpdateStartLocation={onUpdateStartLocation}
                            />
                        </div>
                    )}




                    {/* Settings Overlay */}
                    {showSettings && (
                        <SidebarSettings
                            language={language}
                            setLanguage={setLanguage}
                            showChangelog={showChangelog}
                            setShowChangelog={setShowChangelog}
                            setShowSettings={setShowSettings}
                            settingsOpenedFromMap={settingsOpenedFromMap}
                            setIsOpen={setIsOpen}
                            voiceSettings={voiceSettings}
                            setVoiceSettings={setVoiceSettings}
                            availableThemes={availableThemes}
                            activeTheme={activeTheme}
                            setActiveTheme={setActiveTheme}
                            travelMode={travelMode}
                            onStyleChange={onStyleChange}
                            isSimulationEnabled={isSimulationEnabled}
                            setIsSimulationEnabled={setIsSimulationEnabled}
                            setIsSimulating={setIsSimulating}
                            autoAudio={autoAudio}
                            setAutoAudio={setAutoAudio}
                            spokenNavigationEnabled={spokenNavigationEnabled}
                            setSpokenNavigationEnabled={setSpokenNavigationEnabled}
                            fetchServiceLogs={async () => {
                                try {
                                    const res = await apiFetch('/api/logs');
                                    if (res.ok) {
                                        const data = await res.json();
                                        return data.logs || (language === 'nl' ? "Geen logs gevonden." : "No logs found.");
                                    }
                                } catch (e) {
                                    console.error("Failed to fetch logs:", e);
                                }
                                return language === 'nl' ? "Fout bij laden logs." : "Error loading logs.";
                            }}
                            clearServiceLogs={clearServiceLogs}
                            onStopSpeech={onStopSpeech}
                            autoSave={autoSave}
                            setAutoSave={setAutoSave}
                            confidenceThreshold={confidenceThreshold}
                            setConfidenceThreshold={setConfidenceThreshold}
                            searchSources={searchSources}
                            setSearchSources={setSearchSources}
                            aiProvider={aiProvider}
                            setAiProvider={setAiProvider}
                            searchProvider={searchProvider}
                            setSearchProvider={setSearchProvider}
                            version={version}
                            author={author}
                            lastUpdated={lastUpdated}
                        />
                    )}

                    {!showSettings && (
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                            {(isAiViewActive && routeData) ? (
                                /* VIEW 3: Route Refiner (The Guide) - Now manages its own scroll and footer */
                                <RouteRefiner
                                    routeData={routeData}
                                    language={language}
                                    travelMode={travelMode}
                                    onStyleChange={onStyleChange}
                                    constraintValue={constraintValue}
                                    onConstraintValueChange={onConstraintValueChange}
                                    onConstraintValueFinal={onConstraintValueFinal}
                                    onRemovePoi={onRemovePoi}
                                    onAddToJourney={onAddToJourney}
                                    onSearchStopOptions={onSearchStopOptions}
                                    onSearchPOIs={onSearchPOIs}
                                    onSelectStopOption={onSelectStopOption}
                                    onStopsCountChange={onStopsCountChange}
                                    activePoiIndex={activePoiIndex}
                                    onStartMapPick={onStartMapPick}
                                    onClose={() => setIsAiViewActive(false)}
                                    setIsLoading={setIsLoading}
                                    setLoadingText={setLoadingText}
                                    loadingText={loadingText}
                                    primaryColor={availableThemes?.[activeTheme]?.colors?.primary || '#3b82f6'}
                                    onSpeak={onSpeak}
                                    onSubWizardStateChange={setIsSubWizardActive}
                                    onStopSpeech={onStopSpeech}
                                    hasPois={hasPois}
                                    hasRoute={hasRoute}
                                    city={city}
                                    searchMode={searchMode}
                                    aiPrompt={aiPrompt}
                                    onJourneyStart={onJourneyStart}
                                />
                            ) : (
                                <>
                                    {/* Scrollable Content for non-refiner views */}
                                    <div className="px-2.5 py-2 flex-1 flex flex-col min-h-0 relative">
                                        <div className="flex-1 flex flex-col min-h-0">
                                            {/* VIEW 1: Disambiguation */}
                                            {showDisambiguation ? (
                                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3" ref={scrollContainerRef} onScroll={handleScroll}>
                                                    <h3 className="font-bold text-[var(--text-main)]">{text.disambig_title} {city}?</h3>
                                                    {disambiguationOptions.map((option, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                onDisambiguationSelect(option);
                                                                if (!interests || !interests.trim()) {
                                                                    setShouldAutoFocusInterests(true);
                                                                }
                                                            }}
                                                            className="w-full text-left bg-[var(--panel-bg)] hover:bg-[var(--input-bg)] p-3 rounded-lg border border-[var(--panel-border)] text-sm"
                                                        >
                                                            <div className="font-bold text-[var(--text-main)]">{option.name}</div>
                                                            <div className="text-xs text-[var(--text-muted)]">{option.display_name}</div>
                                                        </button>
                                                    ))}
                                                    <button onClick={onDisambiguationCancel} className="text-[var(--text-muted)] text-sm w-full text-center mt-2 hover:text-[var(--text-main)]">{text.back}</button>
                                                </div>
                                            ) : showItinerary ? (
                                                <ItineraryList
                                                    language={language}
                                                    text={text}
                                                    isEnriching={isEnriching}
                                                    onPauseEnrichment={onPauseEnrichment}
                                                    onStartEnrichment={onStartEnrichment}
                                                    onReverseDirection={onReverseDirection}
                                                    isLoading={isLoading}
                                                    loadingText={loadingText}
                                                    routeData={routeData}
                                                    isDiscoveryTriggered={isDiscoveryTriggered}
                                                    searchMode={searchMode}
                                                    selectedDiscoveryChips={selectedDiscoveryChips}
                                                    setSelectedDiscoveryChips={setSelectedDiscoveryChips}
                                                    discoveryChips={discoveryChips}
                                                    customDiscoveryInterest={customDiscoveryInterest}
                                                    setCustomDiscoveryInterest={setCustomDiscoveryInterest}
                                                    onFindPoisAlongRoute={onFindPoisAlongRoute}
                                                    onSkipDiscovery={onSkipDiscovery}
                                                    expandedPoi={expandedPoi}
                                                    setExpandedPoi={setExpandedPoi}
                                                    poiRefs={poiRefs}
                                                    onPoiClick={onPoiClick}
                                                    descriptionLength={descriptionLength}
                                                    onPopupClose={onPopupClose}
                                                    onEnrichSinglePoi={onEnrichSinglePoi}
                                                    setPoiToDelete={setPoiToDelete}
                                                    onCycleStart={onCycleStart}
                                                    setIsAiViewActive={setIsAiViewActive}
                                                    setSearchMode={setSearchMode}
                                                    onSpeak={onSpeak}
                                                    speakingId={speakingId}
                                                    isSpeechPaused={isSpeechPaused}
                                                    spokenCharCount={spokenCharCount}
                                                    poiHighlightedWordRef={poiHighlightedWordRef}
                                                    activeTheme={activeTheme}
                                                    availableThemes={availableThemes}
                                                    setViewAction={setViewAction}
                                                    onStartMapPick={onStartMapPick}
                                                    onRemovePoi={onRemovePoi}
                                                    onAddToJourney={onAddToJourney}
                                                    onStopsCountChange={onStopsCountChange}
                                                    scrollContainerRef={scrollContainerRef}
                                                    handleScroll={handleScroll}
                                                />
                                            ) : (
                                                /* VIEW 4: Input Form (Start or Add) */
                                                <SidebarInput
                                                    city={city} setCity={setCity}
                                                    interests={interests} setInterests={setInterests}
                                                    constraintType={constraintType} setConstraintType={setConstraintType}
                                                    constraintValue={constraintValue} setConstraintValue={onConstraintValueChange}
                                                    isRoundtrip={isRoundtrip} setIsRoundtrip={setIsRoundtrip}
                                                    startPoint={startPoint} setStartPoint={setStartPoint}
                                                    stopPoint={stopPoint} setStopPoint={setStopPoint}
                                                    searchSources={searchSources} setSearchSources={setSearchSources}
                                                    onJourneyStart={isAddingMode ? (e) => { onAddToJourney(e); setIsAddingMode(false); } : onJourneyStart}
                                                    onCityValidation={onCityValidation}
                                                    onUseCurrentLocation={onUseCurrentLocation}
                                                    language={language}
                                                    nearbyCities={nearbyCities}
                                                    isAddingMode={isAddingMode}
                                                    searchMode={searchMode}
                                                    setSearchMode={setSearchMode}
                                                    shouldAutoFocusInterests={shouldAutoFocusInterests}
                                                    setShouldAutoFocusInterests={setShouldAutoFocusInterests}
                                                    onLoad={onLoad}
                                                    travelMode={travelMode}
                                                    onStyleChange={onStyleChange}
                                                    aiPrompt={aiPrompt}
                                                    setAiPrompt={setAiPrompt}
                                                    aiChatHistory={aiChatHistory}
                                                    isAiViewActive={isAiViewActive}
                                                    setIsAiViewActive={setIsAiViewActive}
                                                    onStartMapPick={onStartMapPick}
                                                    routeData={routeData}
                                                    onSpeak={onSpeak}
                                                    voiceSettings={voiceSettings}
                                                    speakingId={speakingId}
                                                    spokenCharCount={spokenCharCount}
                                                    isLoading={isLoading}
                                                    loadingText={loadingText}
                                                    onStopSpeech={onStopSpeech}
                                                    onRemovePoi={onRemovePoi}
                                                    onAddToJourney={onAddToJourney}
                                                    activeTheme={activeTheme}
                                                    availableThemes={availableThemes}
                                                    scrollContainerRef={scrollContainerRef}
                                                    handleScroll={handleScroll}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Footer (only for non-route-refiner views) */}
                                    {!showDisambiguation && (
                                        <div className="px-3 py-3 border-t border-white/10 bg-[#0c121e]/80 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            <div className="flex items-center gap-2">
                                                {(!hasPois && !hasRoute) ? (
                                                    searchMode === 'manual' ? (
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (onStartMapPick) onStartMapPick(city); }}
                                                            className="w-full bg-primary text-white font-black py-4 px-4 rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                                                <circle cx="12" cy="10" r="3"></circle>
                                                            </svg>
                                                            <span className="text-[11px] font-black uppercase tracking-[0.1em]">
                                                                {language === 'nl' ? 'Duid aan op Kaart' : 'Pick on Map'}
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => onJourneyStart && onJourneyStart(e)}
                                                            disabled={isLoading || (searchMode === 'journey' ? !city.trim() : (searchMode === 'prompt' ? !aiPrompt.trim() : false))}
                                                            className="w-full bg-primary text-white font-black py-4 px-4 rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-2"
                                                        >
                                                            {isLoading ? (
                                                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                                                </svg>
                                                            )}
                                                            <span className="text-[11px] font-black uppercase tracking-[0.1em]">
                                                                {isLoading ? (loadingText || (language === 'nl' ? 'Trip Genereren...' : 'Generating Trip...')) : (language === 'nl' ? 'Trip Genereren' : 'Generate Trip')}
                                                            </span>
                                                        </button>
                                                    )
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => setAutoAudio(!autoAudio)}
                                                            className={`flex-1 py-3 px-2 text-[10px] uppercase tracking-widest font-black rounded-xl border transition-all flex items-center justify-center gap-1.5 ${autoAudio ? 'bg-primary/20 border-primary/40 text-primary' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'}`}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" /></svg>
                                                            <span className="truncate">{autoAudio ? (language === 'nl' ? "Spreken aan" : "Audio ON") : (language === 'nl' ? "Spreken uit" : "Audio OFF")}</span>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setIsAddingMode(false);
                                                                onReset();
                                                            }}
                                                            className="flex-1 py-3 px-2 text-[10px] uppercase tracking-widest font-black rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-1.5"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" /></svg>
                                                            <span>{language === 'nl' ? 'HERSTARTEN' : 'RESET'}</span>
                                                        </button>
                                                        <button
                                                            onClick={() => onSave && onSave()}
                                                            className="flex-1 py-3 px-2 text-[10px] uppercase tracking-widest font-black rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-1.5"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                                            <span>{text.save}</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={!!poiToDelete}
                title={language === 'nl' ? "Punt Verwijderen" : "Remove POI"}
                message={language === 'nl'
                    ? `Weet je zeker dat je "${poiToDelete?.name}" uit je route wilt verwijderen?`
                    : `Are you sure you want to remove "${poiToDelete?.name}" from your route?`
                }
                confirmLabel={language === 'nl' ? "Verwijderen" : "Remove"}
                cancelLabel={language === 'nl' ? "Annuleren" : "Cancel"}
                onConfirm={() => {
                    if (poiToDelete) onRemovePoi(poiToDelete.id);
                    setPoiToDelete(null);
                }}
                onCancel={() => setPoiToDelete(null)}
            />
        </>
    );
};

export default ItinerarySidebar;
