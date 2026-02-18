import React, { useState } from 'react';

/**
 * RouteRefiner - A premium sub-view for adjusting existing routes.
 * Replaces or enhances the traditional AI Chat for route modification.
 */
const RouteRefiner = ({
    routeData,
    language,
    travelMode,
    onStyleChange,
    constraintValue,
    onConstraintValueChange,
    onConstraintValueFinal,
    onRemovePoi,
    onAddToJourney,
    onSearchStopOptions, // callback to search for stop options
    onSearchPOIs,        // callback to search for interest/specific POIs
    onSelectStopOption,  // callback when user selects a POI from results
    onStopsCountChange,
    onClose,
    isLoading,
    setIsLoading,
    loadingText,
    setLoadingText,
    primaryColor = '#3b82f6',
    onSpeak,
    activePoiIndex = 0,
    onStartMapPick,
    onSubWizardStateChange,
    onStopSpeech,
    hasPois,
    hasRoute,
    city,
    searchMode,
    aiPrompt,
    onJourneyStart
}) => {
    const [interestInput, setInterestInput] = useState('');
    const [specificPoiInput, setSpecificPoiInput] = useState('');
    const [showInterestInput, setShowInterestInput] = useState(false);
    const [localStopsCount, setLocalStopsCount] = useState(routeData?.pois?.length || 0);
    const [localDistance, setLocalDistance] = useState(constraintValue);

    // New: Search flow states
    const [searchPhase, setSearchPhase] = useState('wizard'); // 'wizard' | 'searching' | 'results'
    const [searchType, setSearchType] = useState(null); // 'stop' | 'interest' | 'specific'
    const [searchQuery, setSearchQuery] = useState(''); // The search term being searched
    const [searchResults, setSearchResults] = useState([]);
    const [searchError, setSearchError] = useState(null);

    // Sync local count with actual data when it changes externally
    React.useEffect(() => {
        setLocalStopsCount(routeData?.pois?.length || 0);
    }, [routeData?.pois?.length]);

    // Sync local distance when it changes externally
    React.useEffect(() => {
        setLocalDistance(constraintValue);
    }, [constraintValue]);
    const [showSpecificInput, setShowSpecificInput] = useState(false);
    const [showStopSelector, setShowStopSelector] = useState(false);
    const [pendingStopType, setPendingStopType] = useState('drink'); // 'drink' | 'food'
    const [pendingStopLocation, setPendingStopLocation] = useState(null); // original index

    React.useEffect(() => {
        if (onSubWizardStateChange) {
            onSubWizardStateChange(showStopSelector || searchPhase !== 'wizard');
        }
        return () => {
            if (onSubWizardStateChange) onSubWizardStateChange(false);
        };
    }, [showStopSelector, searchPhase, onSubWizardStateChange]);

    const t = {
        nl: {
            title: "Je Persoonlijke Gids",
            subtitle: "pas je route aan",
            stopWizardTitle: "Extra stop toevoegen",
            stopWizardSubtitle: "Selecteer of je een eet of drankstop wil toevoegen en selecteer de stopplaats waar de gids zal zoeken naar een café of restaurant",
            travelMode: "Reiswijze",
            walking: "Wandelen",
            cycling: "Fietsen",
            distance: "Max Afstand",
            addInterest: "Nieuwe interesse toevoegen",
            addSpecific: "Specifieke plek toevoegen",
            halfwayBeer: "Extra eet of drink stop",
            currentRoute: "Huidige Stops",
            remove: "Verwijder",
            back: "Terug naar route",
            interestPlaceholder: "Bijv. Musea, Parken...",
            specificPlaceholder: "Bijv. Atomium, Eiffeltoren...",
            adding: "Laden...",
            stops: "Aantal stops",
            stopsSub: "Minder stops voor een vlottere route",
            stopWizardTypePrompt: "Wat wil je doen?",
            stopWizardWhenPrompt: "Wanneer wil je stoppen?",
            stopEat: "Iets eten",
            stopDrink: "Iets drinken",
            stopHalfway: "Ongeveer halverwege",
            stopAfter: "Na stop",
            stopAdd: "Zoeken",
            searching: "Aan het zoeken...",
            searchingSubtitle: "We zoeken de beste plekjes voor je",
            resultsTitle: "Gevonden opties",
            resultsSubtitle: "Kies een plek om toe te voegen aan je route",
            noResults: "Geen resultaten gevonden",
            tryAgain: "Opnieuw proberen",
            distanceLabel: "afstand",
            addToRoute: "Toevoegen",
            backToWizard: "Terug"
        },
        en: {
            title: "Your Personal Guide",
            subtitle: "adjust your route",
            stopWizardTitle: "Add extra stop",
            stopWizardSubtitle: "Select whether you want to add a food or drink stop and choose the location where the guide will search for a café or restaurant",
            travelMode: "Travel Mode",
            walking: "Walking",
            cycling: "Cycling",
            distance: "Max Distance",
            addInterest: "Add new interests",
            addSpecific: "Add specific place",
            halfwayBeer: "Extra food or drink stop",
            currentRoute: "Current Stops",
            remove: "Remove",
            back: "Back to itinerary",
            interestPlaceholder: "e.g. Museums, Parks...",
            specificPlaceholder: "e.g. Atomium, Eiffel Tower...",
            adding: "Loading...",
            stops: "Number of stops",
            stopsSub: "Fewer stops for a faster route",
            stopWizardTypePrompt: "What would you like to do?",
            stopWizardWhenPrompt: "When do you want to stop?",
            stopEat: "Something to eat",
            stopDrink: "Something to drink",
            stopHalfway: "Approximately halfway",
            stopAfter: "After stop",
            stopAdd: "Search",
            searching: "Searching...",
            searchingSubtitle: "We're finding the best spots for you",
            resultsTitle: "Found options",
            resultsSubtitle: "Choose a place to add to your route",
            noResults: "No results found",
            tryAgain: "Try again",
            distanceLabel: "distance",
            addToRoute: "Add",
            backToWizard: "Back"
        }
    };

    const text = t[language === 'nl' ? 'nl' : 'en'];

    // Unified list of stops for the refiner views (fallback to manual markers if no POIs)
    const navPoints = (routeData?.pois && routeData.pois.length > 0)
        ? routeData.pois
        : (routeData?.routeMarkers || []).map((m, i) => ({
            ...m,
            id: m.id || `manual-${i}`,
            name: m.name || (i === 0 ? (language === 'nl' ? 'Start' : 'Start') : `${language === 'nl' ? 'Stop' : 'Stop'} ${i}`),
            isManual: true
        }));

    const handleHalfwayBeer = () => {
        setShowStopSelector(true);
    };

    const handleExecuteStopAdd = async () => {
        if (pendingStopLocation === null) return;

        // Switch to searching phase
        setSearchPhase('searching');
        setSearchError(null);
        setSearchResults([]);

        const stopIndex = parseInt(pendingStopLocation);
        const targetPoi = navPoints[stopIndex];

        const searchParams = {
            stopType: pendingStopType,
            afterStopIndex: stopIndex,
            referencePoi: targetPoi
        };

        try {
            // Call the search callback if provided
            if (onSearchStopOptions) {
                const results = await onSearchStopOptions(searchParams);
                if (results && results.length > 0) {
                    setSearchResults(results);
                    setSearchPhase('results');
                } else {
                    setSearchError(text.noResults);
                    setSearchPhase('results');
                }
            } else {
                // Fallback: use old behavior
                const typeStr = pendingStopType === 'food'
                    ? (language === 'nl' ? "een leuke plek om iets te eten" : "a nice place to eat")
                    : (language === 'nl' ? "een gezellige plek voor een drankje" : "a cozy place for a drink");

                const whenStr = language === 'nl'
                    ? `na stop ${stopIndex + 1}${targetPoi ? ` (${targetPoi.name})` : ''}`
                    : `after stop ${stopIndex + 1}${targetPoi ? ` (${targetPoi.name})` : ''}`;

                const context = {
                    locationContext: '@AFTER_STOP_INDEX',
                    targetStopIndex: stopIndex,
                    referencePoiId: targetPoi?.id
                };

                const query = language === 'nl'
                    ? `Zoek naar 5 leuke opties voor ${typeStr} ${whenStr}. Laat me kiezen.`
                    : `Find 5 nice options for ${typeStr} ${whenStr}. Let me choose.`;

                if (setIsLoading) setIsLoading(true);
                if (setLoadingText) setLoadingText(language === 'nl' ? 'Leuke opties zoeken...' : 'Finding nice options...');
                onAddToJourney(new Event('submit'), query, context);
                onClose();
            }
        } catch (err) {
            console.error('Stop search failed:', err);
            setSearchError(language === 'nl' ? 'Er ging iets mis bij het zoeken.' : 'Something went wrong while searching.');
            setSearchPhase('results');
        }
    };

    const handleSelectResult = (poi) => {
        if (onSelectStopOption) {
            const stopIndex = parseInt(pendingStopLocation);
            onSelectStopOption(poi, stopIndex);
        }
        onClose();
    };

    const handleBackToWizard = () => {
        setSearchPhase('wizard');
        setSearchType(null);
        setSearchQuery('');
        setSearchResults([]);
        setSearchError(null);
        // Also reset stop selector if active
        setShowStopSelector(false);
    };

    const handleInterestSubmit = async (e) => {
        if (e.key === 'Enter' && interestInput.trim()) {
            const query = interestInput.trim();

            // Start search flow - stay in RouteRefiner
            setSearchType('interest');
            setSearchQuery(query);
            setSearchPhase('searching');
            setSearchError(null);
            setSearchResults([]);
            setShowInterestInput(false);
            setInterestInput('');

            try {
                // Call the search callback if provided
                if (onSearchPOIs) {
                    const results = await onSearchPOIs({ type: 'interest', query });
                    if (results && results.length > 0) {
                        setSearchResults(results);
                        setSearchPhase('results');
                    } else {
                        setSearchError(language === 'nl' ? 'Geen resultaten gevonden' : 'No results found');
                        setSearchPhase('results');
                    }
                } else {
                    // Fallback: use old behavior
                    if (setIsLoading) setIsLoading(true);
                    onAddToJourney(new Event('submit'), query);
                    onClose();
                }
            } catch (err) {
                console.error('Interest search failed:', err);
                setSearchError(language === 'nl' ? 'Er ging iets mis bij het zoeken.' : 'Something went wrong while searching.');
                setSearchPhase('results');
            }
        }
    };

    const handleSpecificSubmit = async (e) => {
        if (e.key === 'Enter' && specificPoiInput.trim()) {
            const query = specificPoiInput.trim();

            // Start search flow - stay in RouteRefiner
            setSearchType('specific');
            setSearchQuery(query);
            setSearchPhase('searching');
            setSearchError(null);
            setSearchResults([]);
            setShowSpecificInput(false);
            setSpecificPoiInput('');

            try {
                // Call the search callback if provided
                if (onSearchPOIs) {
                    const results = await onSearchPOIs({ type: 'specific', query });
                    if (results && results.length > 0) {
                        setSearchResults(results);
                        setSearchPhase('results');
                    } else {
                        setSearchError(language === 'nl' ? 'Geen resultaten gevonden' : 'No results found');
                        setSearchPhase('results');
                    }
                } else {
                    // Fallback: use old behavior
                    if (setIsLoading) setIsLoading(true);
                    onAddToJourney(new Event('submit'), `Voeg ${query} toe aan de route`);
                    onClose();
                }
            } catch (err) {
                console.error('Specific POI search failed:', err);
                setSearchError(language === 'nl' ? 'Er ging iets mis bij het zoeken.' : 'Something went wrong while searching.');
                setSearchPhase('results');
            }
        }
    };

    // Handler for selecting a POI from any search results
    const handleSelectSearchResult = (poi) => {
        if (searchType === 'stop') {
            // Existing stop flow
            if (onSelectStopOption) {
                const stopIndex = parseInt(pendingStopLocation);
                onSelectStopOption(poi, stopIndex);
            }
        } else {
            // Interest or specific - add to journey
            if (onSelectStopOption) {
                // Insert after current active POI
                onSelectStopOption(poi, activePoiIndex);
            }
        }
        // Reset and close
        handleBackToWizard();
        onClose();
    };

    const hexToRgba = (hex, alpha) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    return (
        <div className="flex flex-col flex-1 h-full min-h-0 animate-in slide-in-from-right duration-300">
            {/* UNIFIED SEARCH FLOW: for interest/specific searches */}
            {searchPhase !== 'wizard' && (searchType === 'interest' || searchType === 'specific') ? (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {searchPhase === 'searching' ? (
                            /* SEARCHING PHASE */
                            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
                                <div className="relative">
                                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-bold text-white mb-2">
                                        {text.searching}
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        {loadingText || (language === 'nl'
                                            ? `Zoeken naar "${searchQuery}"...`
                                            : `Searching for "${searchQuery}"...`)}
                                    </p>
                                </div>
                            </div>
                        ) : searchPhase === 'results' ? (
                            /* RESULTS PHASE */
                            <>
                                {/* Header */}
                                <div className="p-6 border-b border-white/5 shrink-0">
                                    <div className="flex items-center gap-3 mb-1">
                                        <button
                                            onClick={handleBackToWizard}
                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                            </svg>
                                        </button>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">
                                                {searchType === 'interest'
                                                    ? (language === 'nl' ? 'Kies een plek' : 'Choose a spot')
                                                    : (language === 'nl' ? 'Gevonden resultaten' : 'Found results')}
                                            </h3>
                                            <p className="text-xs text-slate-400">
                                                {language === 'nl'
                                                    ? `Resultaten voor "${searchQuery}"`
                                                    : `Results for "${searchQuery}"`}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Results list or error */}
                                {searchError ? (
                                    <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
                                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </div>
                                        <p className="text-sm text-slate-400 text-center">{searchError}</p>
                                        <button
                                            onClick={handleBackToWizard}
                                            className="px-6 py-2.5 bg-slate-800/60 hover:bg-slate-800/80 text-white rounded-full text-[10px] font-extrabold tracking-widest uppercase transition-all shadow-sm border border-white/10"
                                        >
                                            {text.tryAgain}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-3">
                                        {searchResults.map((poi, idx) => {
                                            // Calculate distance from route center if available
                                            const center = routeData?.center;
                                            let distanceKm = null;
                                            if (center && poi.lat && (poi.lng || poi.lon)) {
                                                const R = 6371;
                                                const poiLng = poi.lng || poi.lon;
                                                const dLat = (poi.lat - center[0]) * Math.PI / 180;
                                                const dLon = (poiLng - center[1]) * Math.PI / 180;
                                                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                                    Math.cos(center[0] * Math.PI / 180) * Math.cos(poi.lat * Math.PI / 180) *
                                                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                                distanceKm = R * c;
                                            }

                                            return (
                                                <button
                                                    key={poi.id || idx}
                                                    onClick={() => handleSelectSearchResult(poi)}
                                                    className="w-full p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-400 group-hover:bg-primary group-hover:text-white transition-all shrink-0 mt-0.5">
                                                            {idx + 1}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-sm font-bold text-white mb-1.5">{poi.name}</h4>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                                                    {poi.type || poi.category || (searchType === 'interest' ? 'POI' : 'Locatie')}
                                                                </span>
                                                                {distanceKm !== null && (
                                                                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                                        {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
                                                                    </span>
                                                                )}
                                                                {poi.detour_km > 0 && (
                                                                    <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                                        +{poi.detour_km.toFixed(1)}km {language === 'nl' ? 'omweg' : 'detour'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                </div>
            ) : showStopSelector ? (
                /* STOP SELECTOR WITH PHASES: wizard | searching | results */
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {searchPhase === 'searching' ? (
                        /* SEARCHING PHASE */
                        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-6">
                            <div className="relative">
                                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping"></div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-xl font-bold text-white mb-2">{text.searching}</h3>
                                <p className="text-sm text-slate-400">{loadingText || text.searchingSubtitle}</p>
                            </div>
                            <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    ) : searchPhase === 'results' ? (
                        /* RESULTS PHASE */
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="p-6 pb-4">
                                <h3 className="text-lg font-bold text-white mb-1">{text.resultsTitle}</h3>
                                <p className="text-xs text-slate-400">{text.resultsSubtitle}</p>
                            </div>

                            {searchError ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <p className="text-sm text-slate-400 text-center">{searchError}</p>
                                    <button
                                        onClick={handleBackToWizard}
                                        className="px-6 py-2.5 bg-slate-800/60 hover:bg-slate-800/80 text-white rounded-full text-[10px] font-extrabold tracking-widest uppercase transition-all shadow-sm border border-white/10"
                                    >
                                        {text.tryAgain}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 space-y-3">
                                    {searchResults.map((poi, idx) => {
                                        const referencePoi = navPoints[parseInt(pendingStopLocation)];
                                        let distanceKm = null;
                                        const pLat = poi.lat !== undefined ? poi.lat : poi.latitude;
                                        const pLng = poi.lng !== undefined ? poi.lng : (poi.lon || poi.longitude);
                                        const rLat = referencePoi?.lat !== undefined ? referencePoi.lat : referencePoi?.latitude;
                                        const rLng = referencePoi?.lng !== undefined ? referencePoi?.lng : (referencePoi?.lon || referencePoi?.longitude);

                                        if (rLat !== undefined && rLng !== undefined && pLat !== undefined && pLng !== undefined) {
                                            const R = 6371; // Earth radius in km
                                            const dLat = (pLat - rLat) * Math.PI / 180;
                                            const dLon = (pLng - rLng) * Math.PI / 180;
                                            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                                Math.cos(rLat * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) *
                                                Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                            distanceKm = R * c;
                                        }

                                        return (
                                            <button
                                                key={poi.id || idx}
                                                onClick={() => handleSelectResult(poi)}
                                                className="w-full p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                                            >
                                                <div className="flex items-start gap-3">
                                                    {/* Number badge */}
                                                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-400 group-hover:bg-primary group-hover:text-white transition-all shrink-0 mt-0.5">
                                                        {idx + 1}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        {/* Name - full width */}
                                                        <h4 className="text-sm font-bold text-white mb-1.5 pr-2">{poi.name || (language === 'nl' ? 'Onbekende plek' : 'Unknown place')}</h4>

                                                        {/* Type and distance row */}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                                                {poi.type || poi.category || (pendingStopType === 'food' ? 'Restaurant' : 'Café')}
                                                            </span>
                                                            {distanceKm !== null && !isNaN(distanceKm) && (
                                                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                                    +{distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`} {text.distanceLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Results Footer - FIXED AT BOTTOM */}
                            <div className="p-3 bg-slate-950/80 border-t border-white/10 backdrop-blur-md shrink-0 mt-auto">
                                <button
                                    onClick={handleBackToWizard}
                                    className="w-full h-9 bg-slate-800/60 hover:bg-slate-800/80 text-slate-400 hover:text-white font-extrabold rounded-full border border-white/10 transition-all text-[10px] uppercase tracking-widest shadow-sm"
                                >
                                    {text.backToWizard}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* WIZARD PHASE (default) */
                        <div className="flex-1 flex flex-col min-h-0">
                            <div className="flex-1 flex flex-col min-h-0 p-6 space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">{text.stopWizardTitle}</h3>
                                    <p className="text-xs text-slate-400">{text.stopWizardSubtitle}</p>
                                </div>

                                {/* Question 1: What? */}
                                <div className="space-y-4">
                                    <label className="text-[10px] uppercase tracking-widest text-white font-black ml-1">
                                        {text.stopWizardTypePrompt}
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => setPendingStopType('food')}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${pendingStopType === 'food' ? 'bg-primary/20 border-primary text-white' : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-white/10'}`}
                                        >
                                            <div className={`p-3 rounded-full ${pendingStopType === 'food' ? 'bg-primary text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20m14-7V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm-3 0v7" />
                                                </svg>
                                            </div>
                                            <span className={`text-xs font-bold ${pendingStopType === 'food' ? 'text-white' : 'text-slate-500'}`}>{text.stopEat}</span>
                                        </button>
                                        <button
                                            onClick={() => setPendingStopType('drink')}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${pendingStopType === 'drink' ? 'bg-primary/20 border-primary text-white' : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-white/10'}`}
                                        >
                                            <div className={`p-3 rounded-full ${pendingStopType === 'drink' ? 'bg-primary text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8Zm3-6v2m4-2v2m4-2v2" />
                                                </svg>
                                            </div>
                                            <span className={`text-xs font-bold ${pendingStopType === 'drink' ? 'text-white' : 'text-slate-500'}`}>{text.stopDrink}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Question 2: When? - Flex to fill remainder */}
                                <div className="flex-1 flex flex-col min-h-0 space-y-4">
                                    <label className="text-[10px] uppercase tracking-widest text-white font-black ml-1">
                                        {text.stopWizardWhenPrompt}
                                    </label>
                                    <div className="flex-1 flex flex-col min-h-0">
                                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
                                            <div className="space-y-2 pb-2">
                                                {navPoints.slice(0, -1).map((poi, idx) => {
                                                    if (idx < activePoiIndex) return null;
                                                    return (
                                                        <button
                                                            key={poi.id}
                                                            onClick={() => setPendingStopLocation(idx.toString())}
                                                            className={`p-3 rounded-lg border-2 transition-all flex items-center gap-3 text-left ${pendingStopLocation === idx.toString() ? 'bg-primary/20 border-primary text-white' : 'bg-slate-950/30 border-white/5 text-slate-500 hover:border-white/10'}`}
                                                        >
                                                            <div className="w-5 h-5 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-[10px] font-black shrink-0">
                                                                {idx + 1}
                                                            </div>
                                                            <span className="text-xs font-bold truncate">
                                                                {text.stopAfter} <span className="text-white/80">{poi.name}</span>
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Wizard Footer - FIXED AT BOTTOM */}
                            <div className="p-3 bg-slate-950/80 border-t border-white/10 backdrop-blur-md flex gap-2 shrink-0 mt-auto">
                                <button
                                    onClick={() => setShowStopSelector(false)}
                                    className="flex-1 h-9 bg-slate-800/60 hover:bg-slate-800/80 text-slate-400 hover:text-white font-extrabold rounded-full border border-white/10 transition-all text-[10px] uppercase tracking-widest shadow-sm"
                                >
                                    {text.back}
                                </button>
                                <button
                                    onClick={handleExecuteStopAdd}
                                    className="flex-1 h-9 bg-primary hover:bg-primary/90 text-white font-extrabold rounded-full shadow-lg shadow-primary/20 transition-all text-[10px] uppercase tracking-widest"
                                >
                                    {text.stopAdd}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* MAIN REFINER VIEW */
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="p-6 pt-2 space-y-8">
                            {/* 1. Travel Mode Toggle */}
                            <div className="space-y-3">
                                <label className="text-[10px] uppercase tracking-widest text-white font-black ml-1">
                                    {text.travelMode}
                                </label>
                                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/50 rounded-xl border border-white/5">
                                    <button
                                        onClick={() => onStyleChange('walking')}
                                        className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${travelMode === 'walking' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="4" r="2" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19v-4l-2-2 1-3h-2M12 9l2 2-1 6" /></svg>
                                        {text.walking}
                                    </button>
                                    <button
                                        onClick={() => onStyleChange('cycling')}
                                        className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${travelMode === 'cycling' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="5.5" cy="17.5" r="3.5" strokeWidth={2} /><circle cx="18.5" cy="17.5" r="3.5" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 6l-5 5-3-3 2-2M12 17.5V14l-3-3 4-3 2 3h2" /></svg>
                                        {text.cycling}
                                    </button>
                                </div>
                            </div>

                            {/* Compact Sliders Group */}
                            <div className="space-y-3 pt-1">
                                {/* Stops Slider */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center px-0.5">
                                        <label className="text-[10px] uppercase tracking-widest text-white font-black opacity-80">
                                            {text.stops}
                                        </label>
                                        <div className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                            {localStopsCount}
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min={2}
                                        max={routeData?.originalPois?.length || Math.max(localStopsCount, routeData?.pois?.length || 0)}
                                        value={localStopsCount}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setLocalStopsCount(val);
                                        }}
                                        onMouseUp={(e) => onStopsCountChange(parseInt(e.target.value))}
                                        onTouchEnd={(e) => onStopsCountChange(parseInt(e.target.value))}
                                        disabled={(routeData?.originalPois?.length || routeData?.pois?.length || 0) <= 2}
                                        className="w-full accent-primary h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    />
                                </div>

                                {/* Distance Slider */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center px-0.5">
                                        <label className="text-[10px] uppercase tracking-widest text-white font-black opacity-80">
                                            {text.distance}
                                        </label>
                                        <div className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                            {localDistance} km
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min={1}
                                        max={60}
                                        value={localDistance}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setLocalDistance(val);
                                            onConstraintValueChange(val);
                                        }}
                                        onMouseUp={(e) => onConstraintValueFinal(parseInt(e.target.value))}
                                        onTouchEnd={(e) => onConstraintValueFinal(parseInt(e.target.value))}
                                        className="w-full accent-primary h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* 3. Smart Actions */}
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest text-white font-black ml-1">
                                    Snel Toevoegen
                                </label>
                                <div className="space-y-2">
                                    {/* Row 1: Simple Actions (Food & Map) */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* Halfway Beer */}
                                        <button
                                            onClick={handleHalfwayBeer}
                                            className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-all flex flex-col items-center justify-center gap-1.5 text-center group"
                                        >
                                            <div className="p-1.5 bg-amber-500/20 rounded-md group-hover:scale-110 transition-transform">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 11h1a3 3 0 0 1 0 6h-1"></path><path d="M9 12v6"></path><path d="M13 12v6"></path><path d="M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a.5.5 0 0 1-.5-.5V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1a.5.5 0 0 1-.5.5c-.78 0-1.5-.5-2.5-.5z"></path><path d="M5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8"></path></svg>
                                            </div>
                                            <div className="text-[10px] font-black uppercase tracking-tight leading-none">{text.stopDrink} / {text.stopEat}</div>
                                        </button>

                                        {/* Map Pick */}
                                        <button
                                            onClick={() => onStartMapPick && onStartMapPick(null, true)}
                                            className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 hover:bg-teal-500/20 transition-all flex flex-col items-center justify-center gap-1.5 text-center group"
                                        >
                                            <div className="p-1.5 bg-teal-500/20 rounded-md group-hover:scale-110 transition-transform">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                            </div>
                                            <div className="text-[10px] font-black uppercase tracking-tight leading-none">
                                                {language === 'nl' ? 'Kies op kaart' : 'Pick on Map'}
                                            </div>
                                        </button>
                                    </div>

                                    {/* Row 2: Interest Search */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowInterestInput(!showInterestInput)}
                                            className={`w-full p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center gap-3 text-left group ${showInterestInput ? 'rounded-b-none border-b-0' : ''}`}
                                        >
                                            <div className="p-1.5 bg-blue-500/20 rounded-lg group-hover:scale-110 transition-transform">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v8"></path><path d="m4.93 4.93 5.66 5.66"></path><path d="M2 12h8"></path><path d="m4.93 19.07 5.66-5.66"></path><path d="M12 22v-8"></path><path d="m19.07 19.07-5.66-5.66"></path><path d="M22 12h-8"></path><path d="m19.07 4.93-5.66 5.66"></path></svg>
                                            </div>
                                            <div className="text-xs font-black uppercase tracking-tight">{text.addInterest}</div>
                                        </button>
                                        {showInterestInput && (
                                            <div className="bg-blue-500/5 border-x border-b border-blue-500/20 rounded-b-xl p-3 animate-in fade-in slide-in-from-top-1">
                                                <div className="flex gap-2">
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={interestInput}
                                                        onChange={(e) => setInterestInput(e.target.value)}
                                                        onKeyDown={handleInterestSubmit}
                                                        placeholder={text.interestPlaceholder}
                                                        className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500/50"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (interestInput.trim()) {
                                                                handleInterestSubmit({ key: 'Enter' });
                                                            }
                                                        }}
                                                        disabled={!interestInput.trim()}
                                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shrink-0 ${interestInput.trim()
                                                            ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/20'
                                                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        {language === 'nl' ? 'Zoeken' : 'Search'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Row 3: Specific POI */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowSpecificInput(!showSpecificInput)}
                                            className={`w-full p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all flex items-center gap-3 text-left group ${showSpecificInput ? 'rounded-b-none border-b-0' : ''}`}
                                        >
                                            <div className="p-1.5 bg-purple-500/20 rounded-lg group-hover:scale-110 transition-transform">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                                            </div>
                                            <div className="text-xs font-black uppercase tracking-tight">{text.addSpecific}</div>
                                        </button>
                                        {showSpecificInput && (
                                            <div className="bg-purple-500/5 border-x border-b border-purple-500/20 rounded-b-xl p-3 animate-in fade-in slide-in-from-top-1">
                                                <div className="flex gap-2">
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={specificPoiInput}
                                                        onChange={(e) => setSpecificPoiInput(e.target.value)}
                                                        onKeyDown={handleSpecificSubmit}
                                                        placeholder={text.specificPlaceholder}
                                                        className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (specificPoiInput.trim()) {
                                                                handleSpecificSubmit({ key: 'Enter' });
                                                            }
                                                        }}
                                                        disabled={!specificPoiInput.trim()}
                                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shrink-0 ${specificPoiInput.trim()
                                                            ? 'bg-purple-500 text-white hover:bg-purple-600 shadow-lg shadow-purple-500/20'
                                                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                                            }`}
                                                    >
                                                        {language === 'nl' ? 'Zoeken' : 'Search'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 4. Current Stops (Modification Section) */}
                            <div className="space-y-3">
                                <label className="text-[10px] uppercase tracking-widest text-white font-black ml-1">
                                    {text.currentRoute}
                                </label>
                                <div className="space-y-2">
                                    {navPoints.map((poi, idx) => (
                                        <div key={poi.id} className="flex items-center justify-between p-3 bg-slate-900/40 border border-white/5 rounded-xl group hover:bg-slate-900/60 transition-all">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                                                    {idx + 1}
                                                </div>
                                                <span className="text-xs font-bold text-slate-200 truncate pr-2">{poi.name}</span>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent triggering the row click
                                                    onRemovePoi(poi.id);
                                                }}
                                                className="p-2 text-slate-500 hover:text-red-400 transition-colors bg-black/20 hover:bg-black/40 rounded-lg ml-2"
                                                title={text.remove}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                    <line x1="10" y1="11" x2="10" y2="17"></line>
                                                    <line x1="14" y1="11" x2="14" y2="17"></line>
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div> {/* End of overflow-y-auto (683) */}

                    <div className="px-3 py-3 border-t border-white/10 bg-[#0c121e]/80 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-500 shrink-0 mt-auto">
                        <div className="flex gap-2">
                            {(hasPois || hasRoute) && (
                                <button
                                    onClick={(e) => {
                                        onClose();
                                        onStopSpeech?.();
                                    }}
                                    className="flex-1 py-3 text-[10px] uppercase tracking-widest font-extrabold rounded-xl bg-slate-800/60 border border-white/10 text-slate-400 hover:bg-slate-800/80 hover:text-white transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7 7-7" /></svg>
                                    <span className="truncate">{language === 'nl' ? 'TERUG' : 'BACK'}</span>
                                </button>
                            )}
                            <button
                                onClick={(e) => onJourneyStart && onJourneyStart(e)}
                                disabled={isLoading || (searchMode === 'journey' ? !city?.trim() : (searchMode === 'prompt' ? !aiPrompt?.trim() : false))}
                                className="flex-[2] bg-primary text-white font-black py-3 px-4 rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                    </svg>
                                )}
                                <span className="text-[11px] font-black uppercase tracking-[0.1em] whitespace-nowrap">
                                    {isLoading ? (loadingText || (language === 'nl' ? 'Laden...' : 'Loading...')) : (language === 'nl' ? 'Trip Genereren' : 'Generate Trip')}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RouteRefiner;
