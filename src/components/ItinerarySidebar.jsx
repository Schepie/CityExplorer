import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { PoiIntelligence } from '../services/PoiIntelligence';
import { SmartAutoScroller } from '../utils/AutoScroller';

const SidebarInput = ({
    city, setCity,
    interests, setInterests,
    constraintType, setConstraintType,
    constraintValue, setConstraintValue,
    isRoundtrip, setIsRoundtrip,
    searchSources, setSearchSources,
    onJourneyStart, onCityValidation, onUseCurrentLocation,
    language, nearbyCities, isAddingMode, searchMode, setSearchMode,
    shouldAutoFocusInterests, setShouldAutoFocusInterests, onLoad,
    travelMode, onStyleChange
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
            settings: "Settings",
            mode_label: "Travel Mode",
            walking: "Walking",
            cycling: "Cycling",
            search_mode_label: "POI Search Mode"
        },
        nl: {
            dest_label: "Bestemming",
            dest_ph: "Bijv. Amsterdam, Rome",
            int_label: "Interesses",
            int_ph: "Bijv. Koffie, Architectuur",
            limit_label: "Triplimiet",
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
            rt_label: "Rondtrip (Lus)",
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
            settings: "Instellingen",
            mode_label: "Tripwijze",
            walking: "Wandelen",
            cycling: "Fietsen",
            search_mode_label: "POI Zoekwijze"
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
        <div className="space-y-3 pt-2">



            {/* City Input */}
            <div className={`space-y-1 transition-all duration-500`}>
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">{text.dest_label}</label>
                <div className="relative bg-slate-800/80 border border-primary/30 rounded-xl p-0.5 flex items-center shadow-lg focus-within:ring-2 ring-primary/50 transition-all">
                    <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (interestsInputRef.current) interestsInputRef.current.focus();
                            }
                        }}
                        placeholder={text.dest_ph}
                        className="w-full bg-transparent border-none text-white text-sm px-3 py-1.5 focus:outline-none placeholder:text-slate-600"
                    />
                    <button
                        type="button"
                        onClick={onUseCurrentLocation}
                        className="p-1.5 text-slate-400 hover:text-blue-400 transition-colors"
                        title="Use Current Location"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* Nearby/Popular Suggestions (DIRECTLY UNDER DESTINATION) */}
                <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-slate-500 px-1 pt-0.5">
                    <span className="font-bold opacity-70">{nearbyCities.length > 0 ? text.nearby : text.pop}</span>
                    {(nearbyCities.length > 0 ? nearbyCities : ['London', 'Paris', 'Tokyo', 'Amsterdam']).map(c => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setCity(c)}
                            className="text-slate-400 hover:text-white hover:underline transition-colors cursor-pointer"
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {/* Interests Input */}
            <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">{text.int_label}</label>
                <div className="bg-slate-800/80 border border-white/10 rounded-xl p-0.5 flex items-center shadow-lg focus-within:ring-2 ring-accent/50 transition-all">
                    <input
                        ref={interestsInputRef}
                        type="text"
                        value={interests}
                        onChange={(e) => setInterests(e.target.value)}
                        placeholder={text.int_ph}
                        className="w-full bg-transparent border-none text-white text-sm px-3 py-1.5 focus:outline-none placeholder:text-slate-600"
                    />
                </div>
            </div>

            {/* Quick Categories (Google Friendly) - EVEN MORE COMPACT */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide snap-x">
                {[
                    { label: text.cat_food, val: 'Restaurant, Cafe', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /> },
                    { label: text.cat_sights, val: 'Museum, Tourist Attraction', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /> },
                    { label: text.cat_nature, val: 'Park, Garden', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
                    { label: text.cat_shops, val: 'Shopping Mall, Store', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /> },
                    { label: text.cat_transport, val: 'Train Station, Bus Stop', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /> },
                    { label: text.cat_ent, val: 'Cinema, Theater, Casino', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /> }
                ].map((cat, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => setInterests(cat.val)}
                        className="flex-shrink-0 w-[58px] flex flex-col items-center justify-center gap-1 bg-slate-800/60 hover:bg-white/10 p-1.5 rounded-lg border border-white/5 transition-all group snap-start"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            {cat.icon}
                        </svg>
                        <span className="text-[9px] font-bold text-slate-500 group-hover:text-white truncate w-full text-center leading-none">{cat.label}</span>
                    </button>
                ))}
            </div>

            {/* Combined Search Settings - COMPACT */}
            <div className="bg-slate-800/60 rounded-xl p-2.5 border border-white/5 space-y-2">
                {/* Mode Toggle */}
                {!isAddingMode && (
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">{text.search_mode_label}</label>
                        <div className="grid grid-cols-2 gap-1.5 bg-[var(--bg-gradient-start)]/40 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchMode('radius');
                                    if (constraintType !== 'distance') {
                                        setConstraintType('distance');
                                        setConstraintValue(5);
                                    }
                                }}
                                className={`py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all ${searchMode === 'radius' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-white'}`}
                            >
                                {language === 'nl' ? 'Zoekstraal' : 'Radius'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSearchMode('journey')}
                                className={`py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all ${searchMode === 'journey' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-white'}`}
                            >
                                {language === 'nl' ? 'Trip' : 'Journey'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Travel Mode Toggle (Walking/Cycling) - Only for Journey */}
                {searchMode === 'journey' && (
                    <div className="space-y-1.5">
                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">{text.mode_label}</label>
                        <div className="grid grid-cols-2 gap-1.5 bg-[var(--bg-gradient-start)]/40 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => onStyleChange && onStyleChange('walking')}
                                className={`flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all ${travelMode === 'walking' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-white'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <circle cx="12" cy="4" r="2" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19v-4l-2-2 1-3h-2M12 9l2 2-1 6" />
                                </svg>
                                {text.walking}
                            </button>
                            <button
                                type="button"
                                onClick={() => onStyleChange && onStyleChange('cycling')}
                                className={`flex items-center justify-center gap-2 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all ${travelMode === 'cycling' ? 'bg-primary text-white shadow-md' : 'text-slate-500 hover:text-white'}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <circle cx="5.5" cy="17.5" r="3.5" strokeWidth={2} /><circle cx="18.5" cy="17.5" r="3.5" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 6l-5 5-3-3 2-2M12 17.5V14l-3-3 4-3 2 3h2" />
                                </svg>
                                {text.cycling}
                            </button>
                        </div>
                    </div>
                )}

                {/* Constraints Controls */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">
                            {searchMode === 'radius' ? (language === 'nl' ? 'Zoekstraal' : 'Search Radius') : text.limit_label}
                        </label>

                        {searchMode === 'journey' && (
                            <button
                                type="button"
                                onClick={toggleConstraint}
                                className="text-[9px] font-bold text-primary/80 hover:text-white transition-colors bg-white/5 px-2 py-0.5 rounded-md"
                            >
                                {constraintType === 'distance' ? text.switch_dur : text.switch_dist}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white w-12 text-right">
                            {constraintValue}<span className="text-[10px] text-slate-400 font-normal ml-0.5">{constraintType === 'distance' ? 'km' : 'min'}</span>
                        </span>
                        <input
                            type="range"
                            min={constraintType === 'distance' ? 1 : 15}
                            max={constraintType === 'distance' ? (travelMode === 'cycling' ? 80 : (searchMode === 'radius' ? 50 : 20)) : 240}
                            step={constraintType === 'distance' ? 0.5 : 15}
                            value={constraintValue}
                            onChange={(e) => setConstraintValue(Number(e.target.value))}
                            className="flex-1 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                    </div>

                    {/* Roundtrip Checkbox */}
                    {searchMode === 'journey' && (
                        <div className="flex items-center justify-center pt-0.5">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isRoundtrip ? 'bg-primary border-primary' : 'border-slate-500'}`}>
                                    {isRoundtrip && <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                </div>
                                <input type="checkbox" className="hidden" checked={isRoundtrip} onChange={(e) => setIsRoundtrip(e.target.checked)} />
                                <span className="text-[10px] font-bold text-slate-500 group-hover:text-white transition-colors">{text.rt_label}</span>
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
                disabled={!interests || !interests.trim()}
                className="w-full relative group bg-primary/20 hover:bg-primary/40 text-primary hover:text-white text-sm font-bold py-3 px-4 rounded-xl border border-primary/30 hover:border-primary/50 shadow-lg active:scale-[0.98] transition-all duration-200 overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/0 via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <span className="relative flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    {isAddingMode || (onJourneyStart && onJourneyStart.name === 'handleAddToJourney')
                        ? (language === 'nl' ? 'Toevoegen' : 'Add')
                        : (searchMode === 'radius'
                            ? (language === 'nl' ? 'Toon Spots' : 'Show POIs')
                            : text.start
                        )
                    }
                </span>
            </button>
        </div>
    )
}

const hexToRgba = (hex, alpha) => {
    if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const CityWelcomeCard = ({ city, center, stats, language, pois, speakingId, isSpeechPaused, onSpeak, autoAudio, interests, searchMode, constraintValue, constraintType, isRoundtrip, activeTheme, travelMode, onStopSpeech, spokenCharCount, scroller }) => {
    const [weather, setWeather] = useState(null);
    const [description, setDescription] = useState(null);
    const [cityImage, setCityImage] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [userPos, setUserPos] = useState(null);
    const [currentTime, setCurrentTime] = useState('');
    const [showDurationInfo, setShowDurationInfo] = useState(false);
    const highlightedWordRef = useRef(null);

    // Sync highlight with SmartAutoScroller
    useEffect(() => {
        if (speakingId === `city-welcome-${city}` && highlightedWordRef.current) {
            scroller?.syncHighlight(highlightedWordRef.current);
        }
    }, [spokenCharCount, speakingId, city, scroller]);

    // Watch User Location for accurate "To 1st Stop" distance
    useEffect(() => {
        if (!navigator.geolocation) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => console.warn("Loc error", err),
            { enableHighAccuracy: false, timeout: 20000, maximumAge: 10000 }
        );
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    // Use theme colors
    const primaryColor = activeTheme?.colors?.primary || '#3b82f6';
    const accentColor = activeTheme?.colors?.accent || '#60a5fa';

    useEffect(() => {
        if (!center) return;

        // 1. Weather
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${center[0]}&longitude=${center[1]}&current_weather=true`)
            .then(r => r.json())
            .then(data => setWeather(data.current_weather))
            .catch(e => console.warn("Weather fetch failed", e));

        // 2. City Description via Intelligence Engine
        const actualDist = stats?.totalDistance ? `${stats.totalDistance} km` : `${constraintValue} ${constraintType === 'duration' ? 'min' : 'km'}`;
        const routeCtx = `${searchMode === 'radius' ? 'Radius search' : 'Journey route'} (${actualDist}, ${isRoundtrip ? 'roundtrip' : 'one-way'})`;
        const engine = new PoiIntelligence({
            city: city,
            language: language,
            interests: interests,
            routeContext: routeCtx
        });

        // We use the engine to evaluate the City itself as a POI
        engine.fetchCityWelcomeMessage(pois || [])
            .then(res => {
                if (res) {
                    setDescription(res);
                } else {
                    // Fallback to Wiki if Gemini fails
                    fetchWikipediaSummary(city, language).then(data => {
                        if (data && data.description) setDescription(data.description);
                    });
                }
            })
            .catch(e => console.warn("City Engine Failed:", e));

        // 3. Time
        setCurrentTime(new Date().toLocaleTimeString(language === 'nl' ? 'nl-NL' : 'en-US', { hour: '2-digit', minute: '2-digit' }));

    }, [city, center, language, interests, searchMode, constraintValue, constraintType, isRoundtrip, stats]);

    // Auto-audio trigger if description arrives while already expanded
    useEffect(() => {
        if (isExpanded && autoAudio && description && speakingId !== `city-welcome-${city}`) {
            onSpeak({
                id: `city-welcome-${city}`,
                name: city,
                description: description
            });
        }
    }, [description, isExpanded, autoAudio, city, onSpeak, speakingId]);

    // Cleanup image on city change
    useEffect(() => { setCityImage(null); }, [city]);

    // Helper for wiki fallback (since it's not imported)
    const fetchWikipediaSummary = async (query, lang) => {
        try {
            const langPrefix = lang === 'nl' ? 'nl' : 'en';
            const searchUrl = `https://${langPrefix}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
            const searchData = await fetch(searchUrl).then(r => r.json());
            if (searchData.query?.search?.[0]) {
                const bestTitle = searchData.query.search[0].title;
                const data = await fetch(`https://${langPrefix}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`).then(r => r.json());
                if (data.type !== 'disambiguation') {
                    if (data.thumbnail?.source) setCityImage(data.thumbnail.source);
                    return { description: data.extract };
                }
            }
        } catch (e) { console.warn("Wiki fallback failed", e); }
        return null;
    };

    const calcDurationDetails = () => {
        const walkDist = stats?.walkDistance || stats?.totalDistance;
        if (!walkDist) return null;
        const wSpeed = travelMode === 'cycling' ? 14.0 : 4.0;
        const walkTimeMin = (parseFloat(walkDist) / wSpeed) * 60;
        const bufferPerPoi = travelMode === 'cycling' ? 1 : 10;
        const visitTimeMin = (pois?.length || 0) * bufferPerPoi;
        const totalMin = Math.round(walkTimeMin + visitTimeMin);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return {
            dist: walkDist,
            speed: wSpeed,
            walkTime: walkTimeMin,
            poiCount: pois?.length || 0,
            buffer: bufferPerPoi,
            visitTime: visitTimeMin,
            totalStr: h > 0 ? `${h}h ${m}m` : `${m}m`
        };
    };

    const durationDetails = calcDurationDetails();

    // Weather Code Interpretation (Simple)
    const getWeatherIcon = (code) => {
        if (code === undefined) return "🌤️";
        if (code <= 1) return "☀️";
        if (code <= 3) return "⛅"; // Partly cloudy
        if (code <= 48) return "🌫️"; // Fog
        if (code <= 67) return "🌧️"; // Rain
        if (code <= 77) return "❄️"; // Snow
        if (code > 95) return "⚡"; // Storm
        return "☁️";
    };

    return (
        <div
            onClick={() => {
                const newExpanded = !isExpanded;
                setIsExpanded(newExpanded);

                if (newExpanded) {
                    // Auto-audio on expansion if enabled
                    if (autoAudio && onSpeak) {
                        const cityPoi = {
                            id: `city-welcome-${city}`,
                            name: city,
                            description: description || (language === 'nl' ? `Welkom in ${city}` : `Welcome to ${city}`)
                        };
                        onSpeak(cityPoi);
                    }
                } else {
                    // Stop speech if collapsing OR if a different POI was being read
                    if (speakingId === `city-welcome-${city}` || speakingId) {
                        if (onStopSpeech) onStopSpeech();
                    }
                }
            }}
            style={{
                borderColor: isExpanded ? hexToRgba(primaryColor, 0.5) : 'rgba(255,255,255,0.05)'
            }}
            className={`group relative bg-slate-800/40 hover:bg-slate-800/80 p-4 rounded-xl border transition-all cursor-pointer`}
        >
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                        <h3 className={`font-bold text-base leading-tight truncate transition-colors ${isExpanded ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>{city}</h3>
                        <div
                            className="flex items-center gap-2 text-[10px] font-medium whitespace-nowrap text-white"
                        >
                            <span>{weather ? `${getWeatherIcon(weather.weathercode)} ${weather.temperature}°C` : ''}</span>
                        </div>
                    </div>
                    {!isExpanded && (
                        <p
                            className="text-[10px] mt-0.5 truncate uppercase tracking-widest font-bold opacity-60 group-hover:opacity-100 transition-opacity"
                            style={{ color: primaryColor }}
                        >
                            {language === 'nl' ? 'KLIK VOOR INFO' : 'CLICK FOR INFO'}
                        </p>
                    )}
                </div>

                {/* Audio Control */}
                {isExpanded && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const cityPoi = {
                                id: `city-welcome-${city}`,
                                name: city,
                                description: description || (language === 'nl' ? `Welkom in ${city}` : `Welcome to ${city}`)
                            };
                            onSpeak(cityPoi);
                        }}
                        style={{
                            backgroundColor: speakingId === `city-welcome-${city}` ? primaryColor : hexToRgba(primaryColor, 0.1),
                            color: speakingId === `city-welcome-${city}` ? 'white' : primaryColor,
                        }}
                        className={`p-1.5 rounded-full transition-all shrink-0 ${speakingId === `city-welcome-${city}` ? 'shadow-lg' : 'hover:bg-opacity-20 hover:text-white'}`}
                        title="Read Aloud"
                    >
                        {speakingId === `city-welcome-${city}` ? (
                            isSpeechPaused ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                            )
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                        )}
                    </button>
                )}

                <div
                    className="shrink-0 transition-colors"
                    style={{ color: hexToRgba(primaryColor, 0.5) }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>

            {/* Expandable "Guide" Content */}
            {isExpanded && (
                <div className="mt-3 pt-3 space-y-3 animate-in slide-in-from-top-2 fade-in" style={{ borderTop: `1px solid ${hexToRgba(primaryColor, 0.1)}` }}>
                    <div className="text-xs text-slate-300 leading-relaxed italic opacity-90 pl-3" style={{ borderLeft: `2px solid ${hexToRgba(primaryColor, 0.3)}` }}>
                        {(() => {
                            const displayDesc = description || (language === 'nl' ? "Informatie aan het laden..." : "Loading info...");
                            const currentSpeakingId = `city-welcome-${city}`;

                            if (speakingId === currentSpeakingId && spokenCharCount !== undefined) {
                                const idx = spokenCharCount;
                                let endIdx = displayDesc.indexOf(' ', idx);
                                if (endIdx === -1) endIdx = displayDesc.length;

                                if (idx >= 0 && idx < displayDesc.length) {
                                    const before = displayDesc.slice(0, idx);
                                    const current = displayDesc.slice(idx, endIdx);
                                    const after = displayDesc.slice(endIdx);

                                    return (
                                        <>
                                            <span className="text-white not-italic">{before}</span>
                                            <span
                                                ref={highlightedWordRef}
                                                style={{
                                                    backgroundColor: hexToRgba(primaryColor, 0.4),
                                                    borderRadius: '2px'
                                                }}
                                                className="text-white not-italic"
                                            >
                                                {current}
                                            </span>
                                            <span className="opacity-50">{after}</span>
                                        </>
                                    );
                                }
                            }
                            return displayDesc;
                        })()}
                    </div>

                    <div className="bg-slate-900/40 p-2.5 rounded-lg border border-white/5 space-y-2">
                        <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500 font-bold uppercase tracking-wider">{language === 'nl' ? 'Totaal' : 'Total'}</span>
                            <span className="text-slate-200 font-bold">{stats.walkDistance || stats.totalDistance} km</span>
                        </div>
                        {pois && pois.length > 0 && (
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500 font-bold uppercase tracking-wider">{language === 'nl' ? 'Naar 1e Stop' : 'To 1st Stop'}</span>
                                <span className="text-slate-200 font-bold">
                                    {(() => {
                                        // Use REAL user position if available, otherwise fallback to center or '-'
                                        // The user specifically asked for "From My Location", so we should prioritize that.
                                        const startLat = userPos ? userPos.lat : (center ? center[0] : null);
                                        const startLon = userPos ? userPos.lng : (center ? center[1] : null);

                                        if (!startLat || !pois[0]) return '-';

                                        const lat1 = startLat;
                                        const lon1 = startLon;
                                        const lat2 = pois[0].lat;
                                        const lon2 = pois[0].lng;
                                        const R = 6371; // km
                                        const dLat = (lat2 - lat1) * (Math.PI / 180);
                                        const dLon = (lon2 - lon1) * (Math.PI / 180);
                                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
                                            Math.sin(dLon / 2) * Math.sin(dLon / 2);
                                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                                        return (R * c).toFixed(1);
                                    })()} km
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-[10px]">
                            <div className="flex items-center gap-1.5">
                                <span className="text-slate-500 font-bold uppercase tracking-wider">{language === 'nl' ? 'Duur' : 'Duration'}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowDurationInfo(!showDurationInfo); }}
                                    className={`transition-colors ${showDurationInfo ? 'text-blue-400' : 'text-slate-600 hover:text-slate-400'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </button>
                            </div>
                            <span className="text-slate-200 font-bold">~{durationDetails?.totalStr || '-'}</span>
                        </div>

                        {showDurationInfo && durationDetails && (
                            <div className="mt-2 p-2 bg-black/20 rounded-md text-[9px] text-slate-400 space-y-1 border border-white/5 animate-in fade-in zoom-in-95 duration-200">
                                <div className="flex justify-between">
                                    <span>{language === 'nl' ? 'Triptijd' : 'Travel time'}:</span>
                                    <span className="text-slate-300">{durationDetails.dist}km @ {durationDetails.speed}km/u → {Math.round(durationDetails.walkTime)}m</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>{language === 'nl' ? 'Stoptijd' : 'Stop time'}:</span>
                                    <span className="text-slate-300">{durationDetails.poiCount} {language === 'nl' ? 'stops' : 'spots'} x {durationDetails.buffer}m → {durationDetails.visitTime}m</span>
                                </div>
                                <div className="pt-1 border-t border-white/5 flex justify-between font-bold text-slate-300">
                                    <span>{language === 'nl' ? 'Totaal' : 'Total'}:</span>
                                    <span>{durationDetails.totalStr}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ItinerarySidebar = ({
    routeData, onPoiClick, onReset, language, setLanguage,
    speakingId, onSpeak, autoAudio, setAutoAudio,
    voiceSettings, setVoiceSettings,
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
    onPopupClose,
    travelMode, onStyleChange,
    onStopSpeech, // Callback to stop audio
    onSave, onLoad,
    descriptionLength, setDescriptionLength,
    activeTheme, setActiveTheme, availableThemes,
    isSimulating, setIsSimulating,
    isSimulationEnabled, setIsSimulationEnabled,
    focusedLocation,
    spokenCharCount,
    isSpeechPaused
}) => {

    const [nearbyCities, setNearbyCities] = useState([]);
    const [isAddingMode, setIsAddingMode] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsOpenedFromMap, setSettingsOpenedFromMap] = useState(false);
    const [areOptionsVisible, setAreOptionsVisible] = useState(false); // New Toggle for Footer Options
    const [shouldAutoFocusInterests, setShouldAutoFocusInterests] = useState(false);
    const [expandedPoi, setExpandedPoi] = useState(null);
    const poiHighlightedWordRef = useRef(null);
    const scrollerRef = useRef(null);

    // Initialize SmartAutoScroller
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollerRef.current = new SmartAutoScroller(scrollContainerRef.current, {
                pinStrategy: 'top',
                topMargin: 80,
                bottomMargin: 100
            });
        }
        return () => scrollerRef.current?.destroy();
    }, []);

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

    // Fetch Nearby Cities (Generic logic moved here)
    // Fetch Nearby Cities (Overpass API for real data)
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            const uniqueCities = new Set();

            // 1. Get Current City (Dual Strategy: Nominatim -> BDC)
            let currentCity = null;
            try {
                // Try Nominatim
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, { signal: AbortSignal.timeout(5000) });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.address) {
                        const addr = data.address;
                        currentCity = addr.city || addr.town || addr.village;
                    }
                }
            } catch (e) { /* ignore */ }

            if (!currentCity) {
                try {
                    // Fallback BDC
                    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`, { signal: AbortSignal.timeout(5000) });
                    const data = await res.json();
                    currentCity = data.city || data.locality;
                } catch (e) { /* ignore */ }
            }

            if (currentCity) uniqueCities.add(currentCity);

            // 2. Get Nearby Big Cities (Overpass) -> >15k pop within 50km
            try {
                const query = `
                    [out:json][timeout:10];
                    (
                      node["place"="city"](around:50000,${latitude},${longitude});
                      node["place"="town"](around:50000,${latitude},${longitude});
                    );
                    out body;
                `;
                const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

                // Fetch with 8s timeout
                const res = await fetch(overpassUrl, { signal: AbortSignal.timeout(8000) });

                if (!res.ok) throw new Error(`Overpass status ${res.status}`);
                const data = await res.json();

                if (data && data.elements) {
                    // Sort by priority (city > town) then population
                    const sorted = data.elements.sort((a, b) => {
                        if (a.tags.place === 'city' && b.tags.place !== 'city') return -1;
                        if (a.tags.place !== 'city' && b.tags.place === 'city') return 1;
                        return (parseInt(b.tags.population || 0) - parseInt(a.tags.population || 0));
                    });

                    sorted.forEach(el => {
                        if (el.tags && el.tags.name) uniqueCities.add(el.tags.name);
                    });
                }
            } catch (err) {
                console.debug("Overpass failed, using defaults", err);
                // Fallback: If list is small, fill with defaults
                if (uniqueCities.size < 4) {
                    // Add context-appropriate defaults if possible, otherwise generic
                    ['Brussels', 'Antwerp', 'Ghent', 'Hasselt'].forEach(c => uniqueCities.add(c));
                }
            }

            // Take top 4 unique
            setNearbyCities(Array.from(uniqueCities).slice(0, 4));

        }, (err) => console.warn("Sidebar Loc Error:", err), { enableHighAccuracy: false, timeout: 20000, maximumAge: 60000 });
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
            reset: "Reset",
            save: "Save"
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
            reset: "Reset",
            save: "Opslaan"
        }
    };
    const text = t[language || 'en'];

    // Determine View Mode
    const showItinerary = !isAddingMode && routeData && routeData.pois && routeData.pois.length > 0;
    const showDisambiguation = disambiguationOptions && disambiguationOptions.length > 0;

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

        if (isOpen && isLeftSwipe && !isSearchMenu) {
            setIsOpen(false);
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
            {!isOpen && (
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
                        className="absolute top-4 left-0 z-[400] w-[120px] h-20 flex items-center group outline-none"
                        title={language === 'nl' ? 'Uitklappen' : 'Expand'}
                    >
                        <div
                            style={{ backgroundColor: activeTheme && availableThemes?.[activeTheme] ? availableThemes[activeTheme].colors.primary : '#3b82f6' }}
                            className="w-12 h-full rounded-r-2xl flex items-center justify-center shadow-[4px_0_15px_rgba(0,0,0,0.3)] border border-white/20 border-l-0 transition-all opacity-70 group-hover:opacity-100"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:hidden group-hover:scale-110 transition-transform text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 hidden md:block group-hover:scale-110 transition-transform text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                        </div>
                    </button>

                    {/* Left Bottom Settings Toggle */}
                    <button
                        onClick={handleOpenSettings}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={() => onButtonTouchEnd('settings')}
                        className="absolute bottom-4 left-0 z-[400] w-[120px] h-20 flex items-center group outline-none"
                        title={language === 'nl' ? 'Instellingen' : 'Settings'}
                    >
                        <div
                            style={{ backgroundColor: activeTheme && availableThemes?.[activeTheme] ? availableThemes[activeTheme].colors.primary : '#3b82f6' }}
                            className="w-12 h-full rounded-r-2xl flex items-center justify-center shadow-[4px_0_15px_rgba(0,0,0,0.3)] border border-white/20 border-l-0 transition-all opacity-70 group-hover:opacity-100"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:rotate-45 transition-transform text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
                className={`absolute top-0 left-0 h-full z-[500] w-[400px] max-w-full bg-[var(--bg-gradient-end)]/95 backdrop-blur-xl border-r border-white/10 shadow-2xl transition-transform duration-300 ease-in-out transform ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full bg-gradient-to-b from-[var(--bg-gradient-start)]/50 to-transparent">
                    {/* Header */}
                    <div className="p-4 pb-3 border-b border-white/10">
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

                        {/* City Welcome Card (Replaces Stats Summary) */}
                        {showItinerary && (
                            <div className="mt-4">
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
                                    userLocation={focusedLocation}
                                    onStopSpeech={onStopSpeech}
                                    spokenCharCount={spokenCharCount}
                                    isSpeechPaused={isSpeechPaused}
                                    scroller={scrollerRef.current}
                                />
                            </div>
                        )}
                    </div>


                    {/* Settings Overlay */}
                    {/* Settings Overlay - Full Screen Modal */}
                    {/* Settings Overlay - Full Sidebar Cover */}
                    {showSettings && (
                        <div className="absolute inset-0 z-[1000] bg-slate-900 flex flex-col animate-in slide-in-from-right duration-300">

                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-800/50">
                                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Settings
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowSettings(false);
                                        if (settingsOpenedFromMap) {
                                            setIsOpen(false);
                                        }
                                    }}
                                    className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Scrollable Content */}
                            <div className="p-6 overflow-y-auto custom-scrollbar">

                                {/* Compact Settings List */}
                                <div className="space-y-4">

                                    {/* 1. Language */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">Language</label>
                                        <div className="flex flex-col gap-1">
                                            {[
                                                { id: 'en', label: 'English', icon: <svg viewBox="0 0 30 20" className="w-5 h-5 rounded-[2px] shadow-sm overflow-hidden"><rect width="30" height="20" fill="#012169" /><path d="M0,0 L30,20 M30,0 L0,20" stroke="white" strokeWidth="4" /><path d="M0,0 L30,20 M30,0 L0,20" stroke="#C8102E" strokeWidth="2" /><path d="M15,0 V20 M0,10 H30" stroke="white" strokeWidth="6" /><path d="M15,0 V20 M0,10 H30" stroke="#C8102E" strokeWidth="4" /></svg> },
                                                { id: 'nl', label: 'Nederlands', icon: <svg viewBox="0 0 30 20" className="w-5 h-5 rounded-[2px] shadow-sm overflow-hidden"><rect width="30" height="20" fill="#21468B" /><rect width="30" height="13.3" fill="#FFFFFF" /><rect width="30" height="6.6" fill="#AE1C28" /></svg> }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => {
                                                        setLanguage(opt.id);
                                                        if (setVoiceSettings) setVoiceSettings({ variant: opt.id, gender: 'female' });
                                                    }}
                                                    className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${language === opt.id ? 'bg-slate-700 border-white/20' : 'bg-slate-800/80 border-white/5 hover:bg-slate-700/80'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {opt.icon}
                                                        <span className={`text-sm font-medium ${language === opt.id ? 'text-white' : 'text-slate-300'}`}>{opt.label}</span>
                                                    </div>
                                                    {language === opt.id && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 2. Voice Preference */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">{language === 'nl' ? 'Stem' : 'Voice'}</label>
                                        <div className="flex flex-col gap-1">
                                            {[
                                                { id: 'female', label: { en: 'Female', nl: 'Vrouw' } },
                                                { id: 'male', label: { en: 'Male', nl: 'Man' } }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setVoiceSettings && setVoiceSettings({ ...voiceSettings, gender: opt.id })}
                                                    className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${voiceSettings?.gender === opt.id ? 'bg-slate-700 border-white/20' : 'bg-slate-800/80 border-white/5 hover:bg-slate-700/80'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-1.5 rounded-full ${voiceSettings?.gender === opt.id ? 'bg-slate-500/20 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                        <span className={`text-sm font-medium ${voiceSettings?.gender === opt.id ? 'text-white' : 'text-slate-300'}`}>{language === 'nl' ? opt.label.nl : opt.label.en}</span>
                                                    </div>
                                                    {voiceSettings?.gender === opt.id && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 3. App Theme */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">{language === 'nl' ? 'Thema' : 'Theme'}</label>
                                        <div className="flex flex-col gap-1">
                                            <div className="grid grid-cols-1 gap-1">
                                                {availableThemes && Object.values(availableThemes).map(t => (
                                                    <button
                                                        key={t.id}
                                                        onClick={() => setActiveTheme(t.id)}
                                                        className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${activeTheme === t.id ? 'bg-slate-700 border-white/20' : 'bg-slate-800/80 border-white/5 hover:bg-slate-700/80'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-7 h-7 rounded-full border border-white/10 shadow-sm flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${t.colors.bgStart}, ${t.colors.bgEnd})` }}>
                                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.colors.primary }} />
                                                            </div>
                                                            <span className={`text-sm font-medium ${activeTheme === t.id ? 'text-white' : 'text-slate-300'}`}>
                                                                {language === 'nl' ? t.label.nl : t.label.en}
                                                            </span>
                                                        </div>
                                                        {activeTheme === t.id && (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Travel Mode */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">{language === 'nl' ? 'Reiswijze' : 'Travel Mode'}</label>
                                        <div className="flex flex-col gap-1">
                                            {[
                                                { id: 'walking', label: { en: 'Walking', nl: 'Wandelen' }, icon: <><circle cx="12" cy="4" r="2" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19v-4l-2-2 1-3h-2M12 9l2 2-1 6" /></> },
                                                { id: 'cycling', label: { en: 'Cycling', nl: 'Fietsen' }, icon: <><circle cx="5.5" cy="17.5" r="3.5" strokeWidth={2} /><circle cx="18.5" cy="17.5" r="3.5" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 6l-5 5-3-3 2-2M12 17.5V14l-3-3 4-3 2 3h2" /></> }
                                            ].map(mode => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => onStyleChange(mode.id)}
                                                    className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${travelMode === mode.id ? 'bg-slate-700 border-white/20' : 'bg-slate-800/80 border-white/5 hover:bg-slate-700/80'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-1.5 rounded-full ${travelMode === mode.id ? 'bg-slate-500/20 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                {mode.icon}
                                                            </svg>
                                                        </div>
                                                        <span className={`text-sm font-medium ${travelMode === mode.id ? 'text-white' : 'text-slate-300'}`}>{language === 'nl' ? mode.label.nl : mode.label.en}</span>
                                                    </div>
                                                    {travelMode === mode.id && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 4. Detail Level */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">{language === 'nl' ? 'Detailniveau' : 'Detail Level'}</label>
                                        <div className="flex flex-col gap-1">
                                            {[
                                                { id: 'short', label: { en: 'Brief', nl: 'Kort' }, icon: <path d="M11 7h2v2h-2zm0 4h2v6h-2z" /> },
                                                { id: 'medium', label: { en: 'Standard', nl: 'Standaard' }, icon: <path d="M7 7h1v2H7zm0 4h1v2H7zM10 7h8v2h-8zm0 4h5v2h-5z" /> },
                                                { id: 'max', label: { en: 'Deep', nl: 'Diep' }, icon: <path d="M7 6h1v2H7zm0 3h1v2H7zm0 3h1v2H7zM10 6h8v2h-8zm0 3h8v2h-8zm0 3h8v2h-8z" /> }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setDescriptionLength(opt.id)}
                                                    className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${descriptionLength === opt.id ? 'bg-slate-700 border-white/20' : 'bg-slate-800/80 border-white/5 hover:bg-slate-700/80'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-1.5 rounded-full ${descriptionLength === opt.id ? 'bg-slate-500/20 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM4 16V4h16v12H4z" opacity="0.4" />
                                                                {opt.icon}
                                                            </svg>
                                                        </div>
                                                        <span className={`text-sm font-medium ${descriptionLength === opt.id ? 'text-white' : 'text-slate-300'}`}>{language === 'nl' ? opt.label.nl : opt.label.en}</span>
                                                    </div>
                                                    {descriptionLength === opt.id && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 5. Simulation Mode */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">{language === 'nl' ? 'Simulatie' : 'Simulation'}</label>
                                        <button
                                            onClick={() => {
                                                const newVal = !isSimulationEnabled;
                                                setIsSimulationEnabled(newVal);
                                                if (!newVal) setIsSimulating(false);
                                            }}
                                            className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${isSimulationEnabled ? 'bg-slate-700 border-white/20' : 'bg-slate-800/80 border-white/5 hover:bg-slate-700/80'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded-full ${isSimulationEnabled ? 'bg-slate-500/20 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 1L5 17 10 21 17 5 19 1zM2 10l3-5" /></svg>
                                                </div>
                                                <span className={`text-sm font-medium ${isSimulationEnabled ? 'text-white' : 'text-slate-300'}`}>{language === 'nl' ? 'Route Simulatie' : 'Route Simulation'}</span>
                                            </div>
                                            <div className={`w-9 h-5 rounded-full relative transition-colors ${isSimulationEnabled ? 'bg-primary' : 'bg-slate-600'}`}>
                                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all shadow-sm ${isSimulationEnabled ? 'right-1' : 'left-1'}`} />
                                            </div>
                                        </button>
                                    </div>

                                    {/* 6. Auto Audio */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">{language === 'nl' ? 'Auto Audio' : 'Auto Audio'}</label>
                                        <button
                                            onClick={() => setAutoAudio(!autoAudio)}
                                            className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${autoAudio ? 'bg-slate-700 border-white/20' : 'bg-slate-800/80 border-white/5 hover:bg-slate-700/80'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded-full ${autoAudio ? 'bg-slate-500/20 text-white' : 'bg-slate-700/50 text-slate-400'}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                                </div>
                                                <span className={`text-sm font-medium ${autoAudio ? 'text-white' : 'text-slate-300'}`}>{language === 'nl' ? 'Automatisch Voorlezen' : 'Auto-Audio Mode'}</span>
                                            </div>
                                            <div className={`w-9 h-5 rounded-full relative transition-colors ${autoAudio ? 'bg-primary' : 'bg-slate-600'}`}>
                                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all shadow-sm ${autoAudio ? 'right-1' : 'left-1'}`} />
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                {/* About Section */}
                                <div className="mt-8 pt-4 border-t border-white/10">
                                    <h4 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">{language === 'nl' ? 'Over' : 'About'}</h4>
                                    <div className="bg-slate-800/60 rounded-xl p-4 border border-white/5 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 text-sm">Version</span>
                                            <span className="text-slate-300 text-sm font-medium">v1.3.0</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 text-sm">Author</span>
                                            <span className="text-slate-300 text-sm font-medium">Geert Schepers</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 text-sm">{language === 'nl' ? 'Laatst bijgewerkt' : 'Last Updated'}</span>
                                            <span className="text-slate-300 text-sm font-medium">20 Jan 2026</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Content Area */}
                    <div
                        ref={scrollContainerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto p-4 custom-scrollbar"
                    >
                        {/* VIEW 1: Disambiguation */}
                        {showDisambiguation ? (
                            <div className="space-y-3">
                                <h3 className="font-bold text-white">{text.disambig_title} {city}?</h3>
                                {disambiguationOptions.map((option, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            onDisambiguationSelect(option);
                                            if (!interests || !interests.trim()) {
                                                setShouldAutoFocusInterests(true);
                                            }
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
                                            ref={el => poiRefs.current[poi.id] = el}
                                            onClick={() => {
                                                const newExpanded = isExpanded ? null : poi.id;
                                                setExpandedPoi(newExpanded);

                                                if (!isExpanded) {
                                                    // Expanding: Focus on Map
                                                    onPoiClick(poi);
                                                } else {
                                                    // Collapsing: Close Map Popup
                                                    if (onPopupClose) onPopupClose();
                                                }
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

                                                    <div className="space-y-4 pr-8">
                                                        {/* POI Image */}
                                                        {poi.image && (
                                                            <div className="mb-2 rounded-xl overflow-hidden border border-white/10 shadow-2xl h-52 bg-slate-800/50 relative group">
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

                                                        {/* High-level short description */}
                                                        <div className="text-sm text-slate-300 font-medium leading-relaxed italic border-l-2 border-primary/30 pl-3">
                                                            {(() => {
                                                                const short = poi.structured_info?.short_description || "";
                                                                const displayDesc = short || poi.description || (language === 'nl' ? "Geen beschrijving beschikbaar." : "No description available.");

                                                                // Use global speakingId and spokenCharCount
                                                                if (speakingId === poi.id && spokenCharCount !== undefined) {
                                                                    const idx = spokenCharCount;

                                                                    // Only highlight if it fits in THIS block (the short part)
                                                                    if (idx >= 0 && idx < short.length) {
                                                                        let endIdx = short.indexOf(' ', idx);
                                                                        if (endIdx === -1) endIdx = short.length;

                                                                        const before = short.slice(0, idx);
                                                                        const current = short.slice(idx, endIdx);
                                                                        const after = short.slice(endIdx);
                                                                        const pColor = activeTheme && availableThemes?.[activeTheme] ? availableThemes[activeTheme].colors.primary : '#3b82f6';

                                                                        return (
                                                                            <>
                                                                                <span className="text-white not-italic">{before}</span>
                                                                                <span
                                                                                    ref={poiHighlightedWordRef}
                                                                                    style={{
                                                                                        backgroundColor: hexToRgba(pColor, 0.4),
                                                                                        borderRadius: '2px'
                                                                                    }}
                                                                                    className="text-white not-italic"
                                                                                >
                                                                                    {current}
                                                                                </span>
                                                                                <span className="opacity-50">{after}</span>
                                                                            </>
                                                                        );
                                                                    } else if (idx >= short.length && short !== "") {
                                                                        // Entire short block is finished, keep it fully visible but not highlighted
                                                                        return <span className="text-white not-italic opacity-80">{short}</span>;
                                                                    }
                                                                }
                                                                return displayDesc;
                                                            })()}
                                                        </div>

                                                        {/* Interest Alignment */}
                                                        {poi.structured_info?.matching_reasons && poi.structured_info.matching_reasons.length > 0 && (
                                                            <div className="space-y-2">
                                                                <h4 className="text-[10px] uppercase tracking-widest text-primary font-bold">{language === 'nl' ? 'WAAROM DIT BIJ JE PAST' : 'WHY THIS MATCHES YOUR INTERESTS'}</h4>
                                                                <div className="grid gap-1.5">
                                                                    {poi.structured_info.matching_reasons.map((reason, ri) => (
                                                                        <div key={ri} className="flex items-start gap-2 text-xs text-slate-400">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mt-0.5 text-green-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                                            <span>{reason}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Full Description (only if expanded or on Standard/Deep) */}
                                                        {poi.structured_info?.full_description && (
                                                            <div className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap">
                                                                {(() => {
                                                                    const short = poi.structured_info?.short_description || "";
                                                                    const displayDesc = poi.structured_info.full_description;

                                                                    if (speakingId === poi.id && spokenCharCount !== undefined) {
                                                                        // Offset by short_description + "\n\n" (2 chars)
                                                                        const offset = short ? short.length + 2 : 0;
                                                                        const idx = spokenCharCount - offset;

                                                                        if (idx >= 0 && idx < displayDesc.length) {
                                                                            let endIdx = displayDesc.indexOf(' ', idx);
                                                                            if (endIdx === -1) endIdx = displayDesc.length;

                                                                            const before = displayDesc.slice(0, idx);
                                                                            const current = displayDesc.slice(idx, endIdx);
                                                                            const after = displayDesc.slice(endIdx);

                                                                            const pColor = activeTheme && availableThemes?.[activeTheme] ? availableThemes[activeTheme].colors.primary : '#3b82f6';

                                                                            return (
                                                                                <>
                                                                                    <span className="text-slate-200">{before}</span>
                                                                                    <span
                                                                                        ref={poiHighlightedWordRef}
                                                                                        style={{
                                                                                            backgroundColor: hexToRgba(pColor, 0.4),
                                                                                            borderRadius: '2px'
                                                                                        }}
                                                                                        className="text-white"
                                                                                    >
                                                                                        {current}
                                                                                    </span>
                                                                                    <span className="text-slate-600">{after}</span>
                                                                                </>
                                                                            );
                                                                        } else if (idx >= displayDesc.length) {
                                                                            return displayDesc;
                                                                        } else if (idx < 0) {
                                                                            // Still reading the short description, dim this part
                                                                            return <span className="opacity-30">{displayDesc}</span>;
                                                                        }
                                                                    }
                                                                    return displayDesc;
                                                                })()}
                                                            </div>
                                                        )}

                                                        {/* Fun Facts */}
                                                        {poi.structured_info?.fun_facts && poi.structured_info.fun_facts.length > 0 && (
                                                            <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 space-y-2">
                                                                <h4 className="text-[10px] uppercase tracking-widest text-blue-400 font-bold flex items-center gap-1.5">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>
                                                                    {language === 'nl' ? 'WIST JE DAT?' : 'FUN FACTS'}
                                                                </h4>
                                                                <ul className="space-y-1.5">
                                                                    {poi.structured_info.fun_facts.map((fact, fi) => (
                                                                        <li key={fi} className="text-xs text-slate-400 pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-blue-500/50">
                                                                            {fact}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}

                                                        {/* 2 Minute Highlight */}
                                                        {poi.structured_info?.two_minute_highlight && (
                                                            <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3">
                                                                <h4 className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-1">{language === 'nl' ? 'ALS JE MAAR 2 MINUTEN HEBT' : 'IF YOU ONLY HAVE 2 MINUTES'}</h4>
                                                                <div className="text-xs text-slate-400 italic">
                                                                    "{poi.structured_info.two_minute_highlight}"
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Visitor Tips */}
                                                        {poi.structured_info?.visitor_tips && (
                                                            <div className="flex items-start gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-white/5">
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                                                <div className="text-[11px] text-slate-500">
                                                                    <span className="font-bold uppercase mr-1">{language === 'nl' ? 'TIPS:' : 'TIPS:'}</span>
                                                                    {poi.structured_info.visitor_tips}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); onSpeak(poi); }}
                                                        className={`absolute top-4 right-4 p-2 rounded-full transition-all ${speakingId === poi.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
                                                        title="Read Aloud"
                                                    >
                                                        {speakingId === poi.id ? (
                                                            isSpeechPaused ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                            ) : (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                                            )
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                                }
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
                                    travelMode={travelMode}
                                    onStyleChange={onStyleChange}
                                />
                            </div>
                        )}
                    </div>

                    {/* Footer Actions (Only show when in Itinerary mode) */}
                    {showItinerary && !showDisambiguation && (
                        <div className="p-4 border-t border-white/10 bg-[var(--bg-gradient-start)]/30 space-y-3">
                            <div className="flex items-center justify-between">
                                <button
                                    onClick={() => setAutoAudio(!autoAudio)}
                                    className={`text-xs font-bold py-2 px-4 rounded-lg border transition-all flex items-center gap-2 ${autoAudio ? 'bg-primary/20 border-primary/50 text-primary' : 'bg-slate-800/40 border-white/5 text-white hover:bg-slate-800/80'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
                                    {autoAudio ? "Auto-Audio ON" : "Auto-Audio OFF"}
                                </button>

                                <button
                                    onClick={() => setAreOptionsVisible(!areOptionsVisible)}
                                    className="text-[10px] uppercase font-bold text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                                >
                                    {text.options}
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${areOptionsVisible ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>

                            {areOptionsVisible && (
                                <div className="grid grid-cols-3 gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
                                    <button
                                        onClick={onReset}
                                        className="flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-white/5 hover:border-primary/30 transition-all group"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary group-hover:text-primary-hover" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span className="text-[10px] font-bold text-white uppercase">{text.reset}</span>
                                    </button>

                                    <button
                                        onClick={() => setIsAddingMode(true)}
                                        className="flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-white/5 hover:border-primary/30 transition-all group"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary group-hover:text-primary-hover" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="text-[10px] font-bold text-white uppercase">{text.add_short}</span>
                                    </button>

                                    <button
                                        onClick={onSave}
                                        className="flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-white/5 hover:border-primary/30 transition-all group"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary group-hover:text-primary-hover" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                        <span className="text-[10px] font-bold text-white uppercase">{text.save}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div >
        </>
    );
};

export default ItinerarySidebar;
