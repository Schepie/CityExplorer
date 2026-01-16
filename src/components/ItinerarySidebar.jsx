import React, { useState, useEffect, useRef } from 'react';

const SidebarInput = ({
    city, setCity,
    interests, setInterests,
    constraintType, setConstraintType,
    constraintValue, setConstraintValue,
    isRoundtrip, setIsRoundtrip,
    searchSources, setSearchSources,
    onJourneyStart, onCityValidation, onUseCurrentLocation,
    language, nearbyCities, isAddingMode, searchMode, setSearchMode,
    shouldAutoFocusInterests, setShouldAutoFocusInterests, onLoad
}) => {

    // Translations
    const t = {
        en: {
            dest_label: "Destination",
            dest_ph: "E.g., Paris, Tokyo",
            int_label: "Interests",
            int_ph: "E.g., Coffee, Architecture",
            limit_label: "Journey Limit",
            switch_dur: "Switch to Duration",
            switch_dist: "Switch to Distance",
            sources_label: "Search Sources",
            journey: "CityExplorer",
            dist: "Distance",
            budget: "Budget",
            startNew: "New Search",
            poi: "Point of Interest",
            disambig_title: "Which one?",
            back: "Back",
            add: "Add Spots",
            walk_min: "min walking",
            walk_km: "km walking",
            rt_label: "Roundtrip (Loop)",
            start: "Start Exploring",
            pop: "Popular:",
            nearby: "Nearby:",
            cat_food: "Food",
            cat_sights: "Sights",
            cat_nature: "Nature",
            cat_shops: "Shops",
            cat_transport: "Transport",
            cat_ent: "Fun",
            cat_night: "Nightlife",
            settings: "Settings"
        },
        nl: {
            dest_label: "Bestemming",
            dest_ph: "Bijv. Amsterdam, Rome",
            int_label: "Interesses",
            int_ph: "Bijv. Koffie, Architectuur",
            limit_label: "Reislimiet",
            switch_dur: "Wissel naar Tijd",
            switch_dist: "Wissel naar Afstand",
            sources_label: "Zoekbronnen",
            journey: "CityExplorer",
            dist: "Afstand",
            budget: "Budget",
            startNew: "Nieuwe Zoekopdracht",
            poi: "Bezienswaardigheid",
            disambig_title: "Welke",
            back: "Terug",
            add: "Spots Toevoegen",
            walk_min: "min lopen",
            walk_km: "km lopen",
            rt_label: "Rondreis (Lus)",
            start: "Start Ontdekken",
            pop: "Populair:",
            nearby: "In de buurt:",
            cat_food: "Eten",
            cat_sights: "Beziensw.",
            cat_nature: "Natuur",
            cat_shops: "Winkels",
            cat_transport: "Vervoer",
            cat_ent: "Plezier",
            cat_night: "Uitgaan",
            settings: "Instellingen"
        }
    };
    const text = t[language || 'en'];

    const toggleConstraint = () => {
        if (constraintType === 'distance') {
            setConstraintType('duration');
            setConstraintValue(60);
        } else {
            setConstraintType('distance');
            setConstraintValue(5);
        }
    };

    const interestsInputRef = useRef(null);

    useEffect(() => {
        if (shouldAutoFocusInterests && interestsInputRef.current) {
            interestsInputRef.current.focus();
            if (setShouldAutoFocusInterests) setShouldAutoFocusInterests(false);
        }
    }, [shouldAutoFocusInterests, setShouldAutoFocusInterests]);

    return (
        <div className="space-y-6 pt-4">


            {/* Load Saved Journey (Top) */}
            {!isAddingMode && (
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
                        className="w-full flex items-center justify-center gap-2 bg-slate-800/40 hover:bg-slate-700 text-slate-400 hover:text-white py-2 rounded-lg border border-white/5 hover:border-white/20 transition-all text-xs font-semibold uppercase tracking-wider mb-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {language === 'nl' ? 'Laad Opgeslagen Reis' : 'Load Saved Journey'}
                    </button>
                </div>
            )}

            {/* City Input */}
            <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{text.dest_label}</label>
                <div className="relative bg-slate-800/80 border border-primary/30 rounded-xl p-1 flex items-center shadow-lg focus-within:ring-2 ring-primary/50 transition-all">
                    <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        onBlur={() => onCityValidation && onCityValidation('blur')}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                onCityValidation && onCityValidation('blur');
                                if (interestsInputRef.current) interestsInputRef.current.focus();
                            }
                        }}
                        placeholder={text.dest_ph}
                        className="w-full bg-transparent border-none text-white text-sm px-3 py-2 focus:outline-none placeholder:text-slate-600"
                    />
                    <button
                        type="button"
                        onClick={onUseCurrentLocation}
                        className="p-2 text-slate-400 hover:text-blue-400 transition-colors"
                        title="Use Current Location"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Interests Input */}
            <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{text.int_label}</label>
                <div className="bg-slate-800/80 border border-white/10 rounded-xl p-1 flex items-center shadow-lg focus-within:ring-2 ring-accent/50 transition-all">
                    <input
                        ref={interestsInputRef}
                        type="text"
                        value={interests}
                        onChange={(e) => setInterests(e.target.value)}
                        placeholder={text.int_ph}
                        className="w-full bg-transparent border-none text-white text-sm px-3 py-2 focus:outline-none placeholder:text-slate-600"
                    />
                </div>
            </div>

            {/* Quick Categories (Google Friendly) */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
                {[
                    { label: text.cat_food, val: 'Restaurant, Cafe', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> },
                    { label: text.cat_sights, val: 'Museum, Tourist Attraction', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /> },
                    { label: text.cat_nature, val: 'Park, Garden', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
                    { label: text.cat_shops, val: 'Shopping Mall, Store', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /> },
                    { label: text.cat_transport, val: 'Train Station, Bus Stop, Subway', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /> }, // Swap to proper transport icon below
                    { label: text.cat_ent, val: 'Cinema, Theater, Casino', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /> },
                    { label: text.cat_night, val: 'Bar, Night Club, Pub', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-9a2 2 0 00-2-2H8a2 2 0 00-2 2v9h12z" /> }
                ].map((cat, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => setInterests(cat.val)}
                        className="flex-shrink-0 w-[70px] flex flex-col items-center justify-center gap-1 bg-slate-800/60 hover:bg-white/10 p-2 rounded-xl border border-white/5 transition-all group snap-start"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {cat.icon}
                        </svg>
                        <span className="text-[10px] font-bold text-slate-300 group-hover:text-white truncate w-full text-center">{cat.label}</span>
                    </button>
                ))}
            </div>

            {/* Combined Search Settings */}
            <div className="bg-slate-800/60 rounded-xl p-3 border border-white/5 space-y-3">
                {/* Mode Toggle (Hidden in Add Mode) */}
                {!isAddingMode && (
                    <div className="grid grid-cols-2 gap-2 bg-[var(--bg-gradient-start)]/40 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => {
                                setSearchMode('radius');
                                if (constraintType !== 'distance') {
                                    setConstraintType('distance');
                                    setConstraintValue(5);
                                }
                            }}
                            className={`py-2 rounded-md text-xs font-bold transition-all ${searchMode === 'radius' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                        >
                            {language === 'nl' ? 'Radius' : 'Radius'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setSearchMode('journey')}
                            className={`py-2 rounded-md text-xs font-bold transition-all ${searchMode === 'journey' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                        >
                            {language === 'nl' ? 'Reis' : 'Journey'}
                        </button>
                    </div>
                )}

                {/* Constraints Controls */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                            {searchMode === 'radius'
                                ? (language === 'nl' ? 'Zoek Radius' : 'Search Radius')
                                : text.limit_label
                            }
                        </label>

                        {/* Switch Unit (Only for Journey) */}
                        {searchMode === 'journey' && (
                            <button
                                type="button"
                                onClick={toggleConstraint}
                                className="text-[10px] font-bold text-primary hover:text-white transition-colors bg-white/5 px-2 py-1 rounded-lg"
                            >
                                {constraintType === 'distance' ? text.switch_dur : text.switch_dist}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white w-16 text-right">
                            {constraintValue} <span className="text-xs text-slate-400 font-normal">{constraintType === 'distance' ? 'km' : 'min'}</span>
                        </span>
                        <input
                            type="range"
                            min={constraintType === 'distance' ? 1 : 15}
                            max={constraintType === 'distance' ? (searchMode === 'radius' ? 50 : 20) : 240}
                            step={constraintType === 'distance' ? 0.5 : 15}
                            value={constraintValue}
                            onChange={(e) => setConstraintValue(Number(e.target.value))}
                            className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    {/* Roundtrip Checkbox (Only for Journey) */}
                    {searchMode === 'journey' && (
                        <div className="flex items-center justify-center pt-1">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isRoundtrip ? 'bg-primary border-primary' : 'border-slate-500 group-hover:border-primary'}`}>
                                    {isRoundtrip && (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={isRoundtrip}
                                    onChange={(e) => setIsRoundtrip(e.target.checked)}
                                />
                                <span className={`text-xs font-medium transition-colors ${isRoundtrip ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                                    {text.rt_label}
                                </span>
                            </label>
                        </div>
                    )}
                </div>
            </div>



            <button
                type="button"
                onClick={(e) => {
                    if (onJourneyStart) onJourneyStart(e);
                }}
                disabled={!city || !city.trim() || !interests || !interests.trim()}
                className="w-full relative group bg-primary/20 hover:bg-primary/40 text-primary hover:text-white text-lg font-bold py-4 px-6 rounded-2xl border border-primary/30 hover:border-primary/50 shadow-lg active:scale-[0.98] transition-all duration-200 overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/0 via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <span className="relative flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    {/* determine label based on mode */}
                    {isAddingMode || (onJourneyStart && onJourneyStart.name === 'handleAddToJourney')
                        ? (language === 'nl' ? 'Voeg toe aan reis' : 'Add to Journey')
                        : (searchMode === 'radius'
                            ? (language === 'nl' ? 'Toon Spots' : 'Show POIs')
                            : text.start
                        )
                    }
                </span>
            </button>



            <div className="flex flex-wrap gap-2 justify-center text-xs text-slate-500 pt-2">
                <span>{nearbyCities.length > 0 ? text.nearby : text.pop}</span>
                {(nearbyCities.length > 0 ? nearbyCities : ['London', 'Paris', 'Tokyo', 'Amsterdam']).map(c => (
                    <button
                        key={c}
                        type="button"
                        onClick={() => setCity(c)}
                        className="hover:text-white transition-colors cursor-pointer"
                    >
                        {c}
                    </button>
                ))}
            </div>
        </div>
    )
}

const ItinerarySidebar = ({
    routeData, onPoiClick, onReset, language, setLanguage,
    speakingId, onSpeak, autoAudio, setAutoAudio,
    // Form Props
    city, setCity, interests, setInterests,
    constraintType, setConstraintType,
    constraintValue, setConstraintValue,
    isRoundtrip, setIsRoundtrip,
    searchSources, setSearchSources,
    onJourneyStart, onAddToJourney,
    isLoading, onCityValidation,
    onUseCurrentLocation,
    disambiguationOptions, onDisambiguationSelect, onDisambiguationCancel,
    searchMode, setSearchMode,
    isOpen, setIsOpen,
    onUpdatePoiDescription,
    onSave, onLoad,
    descriptionLength, setDescriptionLength,
    activeTheme, setActiveTheme, availableThemes
}) => {

    const [nearbyCities, setNearbyCities] = useState([]);
    const [isAddingMode, setIsAddingMode] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [shouldAutoFocusInterests, setShouldAutoFocusInterests] = useState(false);
    const [expandedPoi, setExpandedPoi] = useState(null);
    const [showSources, setShowSources] = useState(false);

    // Fetch Nearby Cities (Generic logic moved here)
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await res.json();
                if (data && data.address) {
                    const addr = data.address;
                    const currentCity = addr.city || addr.town || addr.village || addr.municipality;
                    if (currentCity) setNearbyCities([currentCity]);
                }
            } catch (err) { console.warn("Reverse geocode failed", err); }
        }, () => { }, { timeout: 5000 });
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
            add: "Add Spots"
        },
        nl: {
            journey: "CityExplorer",
            dist: "Afstand",
            budget: "Budget",
            startNew: "Nieuwe Zoekopdracht",
            poi: "Bezienswaardigheid",
            disambig_title: "Welke",
            back: "Terug",
            add: "Spots Toevoegen"
        }
    };
    const text = t[language || 'en'];

    // Determine View Mode
    const showItinerary = !isAddingMode && routeData && routeData.pois && routeData.pois.length > 0;
    const showDisambiguation = disambiguationOptions && disambiguationOptions.length > 0;

    return (
        <>
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="absolute top-4 left-4 z-[400] bg-slate-800/90 text-white p-3 rounded-full shadow-lg border border-white/10 hover:bg-slate-700 transition-all"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            )}

            <div
                className={`absolute top-0 left-0 h-full z-[500] w-80 bg-[var(--bg-gradient-end)]/95 backdrop-blur-xl border-r border-white/10 shadow-2xl transition-transform duration-300 ease-in-out transform ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full bg-gradient-to-b from-[var(--bg-gradient-start)]/50 to-transparent">
                    {/* Header */}
                    <div className="p-6 border-b border-white/10">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-3">
                                <img src="/logo.jpg" alt="App Icon" className="w-10 h-10 rounded-xl shadow-md border border-white/20" />
                                <h2 className="text-2xl font-bold text-white tracking-tight">{text.journey}</h2>
                            </div>
                            {/* Lang and Close Controls */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowSettings(!showSettings)}
                                    className={`p-2 rounded-full transition-all ${showSettings ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                    title="Settings"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Stats Summary (Only if Itinerary) */}
                        {showItinerary && (
                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">{text.dist}</div>
                                    <div className="text-xl font-bold text-primary">{routeData.stats.totalDistance} km</div>
                                </div>
                                <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                                    <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">{text.budget}</div>
                                    <div className="text-xl font-bold text-emerald-400">
                                        {routeData.stats.limitKm.toString().startsWith('Radius') ? '' : '~'}
                                        {routeData.stats.limitKm} km
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>


                    {/* Settings Overlay */}
                    {showSettings && (
                        <div className="absolute top-[80px] left-0 w-full h-[calc(100%-80px)] z-[600] bg-[var(--bg-gradient-end)]/95 backdrop-blur-md p-6 overflow-y-auto animate-in fade-in slide-in-from-top-4">
                            <h3 className="font-bold text-white mb-4 text-lg border-b border-white/10 pb-2">Settings</h3>

                            {/* Language */}
                            <div className="mb-6 space-y-2">
                                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Language / Taal</label>
                                <div className="flex bg-slate-800/50 p-1 rounded-lg">
                                    {['en', 'nl'].map(lang => (
                                        <button
                                            key={lang}
                                            onClick={() => setLanguage(lang)}
                                            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${language === lang ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                        >
                                            {lang === 'en' ? 'English' : 'Nederlands'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* App Theme */}
                            <div className="mb-6 space-y-2">
                                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{language === 'nl' ? 'Thema' : 'App Theme'}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {availableThemes && Object.values(availableThemes).map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => setActiveTheme(t.id)}
                                            className={`group relative p-3 rounded-xl border transition-all overflow-hidden ${activeTheme === t.id ? 'border-white/40 shadow-lg scale-[1.02]' : 'border-white/5 hover:border-white/20'}`}
                                            style={{
                                                background: `linear-gradient(135deg, ${t.colors.bgStart}, ${t.colors.bgEnd})`
                                            }}
                                        >
                                            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />

                                            <div className="relative z-10 flex flex-col items-center gap-2">
                                                {/* Primary Color Indicator */}
                                                <div
                                                    className="w-4 h-4 rounded-full shadow-lg border border-white/20"
                                                    style={{ backgroundColor: t.colors.primary }}
                                                />
                                                <span className="text-[10px] font-bold text-white tracking-wide shadow-black drop-shadow-md leading-none">
                                                    {language === 'nl' ? t.label.nl : t.label.en}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Description Length Settings */}
                            <div className="mb-6 space-y-2">
                                <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{language === 'nl' ? 'Lengte Beschrijving POI' : 'POI Description Length'}</label>
                                <div className="flex bg-slate-800/50 p-1 rounded-lg gap-1">
                                    {[
                                        { id: 'short', label: { en: 'Brief', nl: 'Kort' }, icon: <><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /><path d="M11 7h2v2h-2zm0 4h2v6h-2z" /></> },
                                        { id: 'medium', label: { en: 'Standard', nl: 'Standaard' }, icon: <><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM4 16V4h16v12H4z" /><path d="M7 7h1v2H7zm0 4h1v2H7zM10 7h8v2h-8zm0 4h5v2h-5z" /></> },
                                        { id: 'max', label: { en: 'Detailed', nl: 'Gedetailleerd' }, icon: <><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM4 16V4h16v12H4z" /><path d="M7 6h1v2H7zm0 3h1v2H7zm0 3h1v2H7zM10 6h8v2h-8zm0 3h8v2h-8zm0 3h8v2h-8z" /></> }
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setDescriptionLength(opt.id)}
                                            className={`flex-1 flex flex-col items-center justify-center py-2 rounded-md transition-all ${descriptionLength === opt.id ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mb-1" viewBox="0 0 24 24" fill="currentColor">
                                                {opt.icon}
                                            </svg>
                                            <span className="text-[10px] font-medium">{language === 'nl' ? opt.label.nl : opt.label.en}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Search Sources (Collapsed) */}
                            <div className="space-y-3">
                                <button
                                    onClick={() => setShowSources(!showSources)}
                                    className="flex items-center justify-between w-full text-xs uppercase tracking-wider text-slate-500 font-semibold hover:text-white transition-colors"
                                >
                                    {text.sources_label || "Search Sources"}
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showSources ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>

                                {showSources && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2 fade-in">
                                        {/* OSM */}
                                        <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${searchSources.osm ? 'bg-blue-600/10 border-blue-500/50' : 'bg-slate-800/60 border-white/5'}`}>
                                            <span className={`font-medium ${searchSources.osm ? 'text-blue-300' : 'text-slate-400'}`}>OpenStreetMap</span>
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${searchSources.osm ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`}>
                                                {searchSources.osm && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={searchSources.osm} onChange={(e) => setSearchSources({ ...searchSources, osm: e.target.checked })} />
                                        </label>
                                        {/* Foursquare */}
                                        <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${searchSources.foursquare ? 'bg-pink-600/10 border-pink-500/50' : 'bg-slate-800/60 border-white/5'}`}>
                                            <span className={`font-medium ${searchSources.foursquare ? 'text-pink-300' : 'text-slate-400'}`}>Foursquare</span>
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${searchSources.foursquare ? 'bg-pink-500 border-pink-500' : 'border-slate-600'}`}>
                                                {searchSources.foursquare && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={searchSources.foursquare} onChange={(e) => setSearchSources({ ...searchSources, foursquare: e.target.checked })} />
                                        </label>
                                        {/* Google */}
                                        <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${searchSources.google ? 'bg-green-600/10 border-green-500/50' : 'bg-slate-800/60 border-white/5'}`}>
                                            <span className={`font-medium ${searchSources.google ? 'text-green-300' : 'text-slate-400'}`}>Google Places</span>
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${searchSources.google ? 'bg-green-500 border-green-500' : 'border-slate-600'}`}>
                                                {searchSources.google && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={searchSources.google} onChange={(e) => setSearchSources({ ...searchSources, google: e.target.checked })} />
                                        </label>
                                    </div>
                                )}
                            </div>



                            {/* About Section */}
                            <div className="mt-8 pt-4 border-t border-white/10">
                                <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">{language === 'nl' ? 'Over' : 'About'}</h4>
                                <div className="bg-slate-800/60 rounded-xl p-4 border border-white/5 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 text-sm">Version</span>
                                        <span className="text-white font-mono text-sm font-bold bg-white/10 px-2 py-0.5 rounded">v1.0.0</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 text-sm">Author</span>
                                        <span className="text-blue-400 text-sm font-medium">Geert Schepers</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 text-sm">{language === 'nl' ? 'Laatst bijgewerkt' : 'Last Updated'}</span>
                                        <span className="text-slate-300 text-sm font-medium">16 Jan 2026</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {/* VIEW 1: Disambiguation */}
                        {showDisambiguation ? (
                            <div className="space-y-3">
                                <h3 className="font-bold text-white">{text.disambig_title} {city}?</h3>
                                {disambiguationOptions.map((option, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            onDisambiguationSelect(option);
                                            setShouldAutoFocusInterests(true);
                                        }}
                                        className="w-full text-left bg-slate-800/50 hover:bg-slate-700 p-3 rounded-lg border border-white/5 text-sm"
                                    >
                                        <div className="font-bold text-white">{option.name}</div>
                                        <div className="text-xs text-slate-400">{option.display_name}</div>
                                    </button>
                                ))}
                                <button onClick={onDisambiguationCancel} className="text-slate-400 text-sm w-full text-center mt-2 hover:text-white">{text.back}</button>
                            </div>
                        ) : showItinerary ? (
                            /* VIEW 2: Itinerary List */
                            <div className="space-y-3">
                                {routeData.pois.map((poi, index) => {
                                    const isExpanded = expandedPoi === poi.id;
                                    return (
                                        <div
                                            key={poi.id}
                                            onClick={() => {
                                                setExpandedPoi(isExpanded ? null : poi.id);
                                                onPoiClick(poi);
                                            }}
                                            className={`group relative bg-slate-800/40 hover:bg-slate-800/80 p-4 rounded-xl border transition-all cursor-pointer ${isExpanded ? 'border-primary/50 bg-slate-800/80' : 'border-white/5 hover:border-primary/30'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${isExpanded ? 'bg-primary text-white border-primary' : 'bg-primary/20 text-primary border-primary/20 group-hover:bg-primary group-hover:text-white'}`}>
                                                    {index + 1}
                                                </div>
                                                <h3 className={`font-semibold transition-colors line-clamp-1 ${isExpanded ? 'text-primary' : 'text-slate-100 group-hover:text-primary'}`}>
                                                    {poi.name}
                                                </h3>
                                            </div>

                                            {/* Expandable Content */}
                                            {isExpanded && (
                                                <div className="mt-3 pl-9 animate-in slide-in-from-top-2 fade-in duration-200">
                                                    {/* Length Controls */}
                                                    <div className="flex gap-2 mb-3">
                                                        {[
                                                            { id: 'short', label: 'Brief', icon: <><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" /><path d="M11 7h2v2h-2zm0 4h2v6h-2z" /></> },
                                                            { id: 'medium', label: 'Standard', icon: <><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM4 16V4h16v12H4z" /><path d="M7 7h1v2H7zm0 4h1v2H7zM10 7h8v2h-8zm0 4h5v2h-5z" /></> },
                                                            { id: 'max', label: 'Detailed', icon: <><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM4 16V4h16v12H4z" /><path d="M7 6h1v2H7zm0 3h1v2H7zm0 3h1v2H7zM10 6h8v2h-8zm0 3h8v2h-8zm0 3h8v2h-8z" /></> }
                                                        ].map(opt => (
                                                            <button
                                                                key={opt.id}
                                                                onClick={(e) => { e.stopPropagation(); onUpdatePoiDescription(poi, opt.id); }}
                                                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-transparent hover:border-white/10"
                                                                title={opt.label}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                                                    {opt.icon}
                                                                </svg>
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <div className="text-sm text-slate-400 capitalize pr-8 leading-relaxed">
                                                        {(() => {
                                                            const d = poi.description || "";
                                                            const dLow = d.toLowerCase();
                                                            const isBad = dLow.includes("hasselt is de hoofdstad") || (dLow.includes("hoofdstad") && dLow.includes("provincie"));
                                                            return isBad ? (language === 'nl' ? "Geen beschrijving beschikbaar." : "No description available.") : (d || text.poi);
                                                        })()}
                                                    </div>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onSpeak(poi); }}
                                                        className={`absolute top-4 right-4 p-2 rounded-full transition-all ${speakingId === poi.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                                                        title="Read Aloud"
                                                    >
                                                        {speakingId === poi.id ? (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* VIEW 3: Input Form (Start or Add) */
                            <div className="relative">
                                {isAddingMode && (
                                    <button
                                        onClick={() => setIsAddingMode(false)}
                                        className="mb-2 text-xs text-blue-400 hover:text-white flex items-center gap-1"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                        {text.back}
                                    </button>
                                )}
                                <SidebarInput
                                    city={city} setCity={setCity}
                                    interests={interests} setInterests={setInterests}
                                    constraintType={constraintType} setConstraintType={setConstraintType}
                                    constraintValue={constraintValue} setConstraintValue={setConstraintValue}
                                    isRoundtrip={isRoundtrip} setIsRoundtrip={setIsRoundtrip}
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
                                />
                            </div>
                        )}
                    </div>

                    {/* Footer Actions (Only show Reset when in Itinerary mode) */}
                    {showItinerary && !showDisambiguation && (
                        <div className="p-4 border-t border-white/10 bg-[var(--bg-gradient-start)]/30">
                            <div className="flex items-center justify-between mb-2 px-1">
                                <span className="text-xs text-slate-500 uppercase font-bold">Options</span>
                                <button
                                    onClick={() => setAutoAudio(!autoAudio)}
                                    className={`text-xs flex items-center gap-1 ${autoAudio ? 'text-primary' : 'text-slate-500'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
                                    {autoAudio ? "Auto-Audio ON" : "Auto-Audio OFF"}
                                </button>
                            </div>
                            <div className="flex gap-2">
                                {/* Reset (New Search) */}
                                <button
                                    onClick={onReset}
                                    title={text.startNew}
                                    className="flex-1 flex items-center justify-center p-3 bg-slate-800 hover:bg-red-900/30 text-slate-300 hover:text-red-400 rounded-xl border border-white/10 hover:border-red-500/30 transition-all group"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>

                                {/* Add Button */}
                                <button
                                    onClick={() => { setIsAddingMode(true); setInterests(''); }}
                                    title={text.add}
                                    className="flex-1 flex items-center justify-center p-3 bg-primary/20 hover:bg-primary/40 text-primary hover:text-white rounded-xl border border-primary/30 transition-all group"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>

                                {/* Save Button */}
                                <button
                                    onClick={onSave}
                                    title={language === 'nl' ? "Opslaan" : "Save Journey"}
                                    className="flex-1 flex items-center justify-center p-3 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 hover:text-white rounded-xl border border-emerald-500/30 transition-all group"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                    </svg>
                                </button>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default ItinerarySidebar;
