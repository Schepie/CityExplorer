import React, { useState, useEffect, useRef } from 'react';
import { hexToRgba } from '../utils/uiUtils';

const SidebarInput = ({
    city, setCity,
    interests, setInterests,
    constraintType, setConstraintType,
    constraintValue, setConstraintValue,
    isRoundtrip, setIsRoundtrip,
    startPoint, setStartPoint,
    stopPoint, setStopPoint,
    searchSources, setSearchSources,
    onJourneyStart, onCityValidation, onUseCurrentLocation,
    language, nearbyCities, isAddingMode, searchMode, setSearchMode,
    shouldAutoFocusInterests, setShouldAutoFocusInterests, onLoad,
    travelMode, onStyleChange,
    aiPrompt, setAiPrompt,
    aiChatHistory,
    isAiViewActive, setIsAiViewActive,
    onSpeak, voiceSettings,
    speakingId, spokenCharCount,
    isLoading, loadingText, onRemovePoi, onStopSpeech,

    routeData, onAddToJourney,
    activeTheme, availableThemes,
    onStartMapPick,
    scrollContainerRef, handleScroll
}) => {
    const primaryColor = availableThemes?.[activeTheme]?.colors?.primary || '#3b82f6';
    const [isListening, setIsListening] = useState(false);
    const [wasVoiceInitiated, setWasVoiceInitiated] = useState(false);
    const recognitionRef = useRef(null);
    const silenceTimerRef = useRef(null);
    const onJourneyStartRef = useRef(onJourneyStart);

    // Keep ref in sync
    useEffect(() => {
        onJourneyStartRef.current = onJourneyStart;
    }, [onJourneyStart]);

    // Heuristic: guess if a sentence is complete
    const isInputLikelyComplete = (text) => {
        if (!text) return false;
        const lowText = text.toLowerCase();

        // Completion markers
        const commonStarters = ['ik ', 'geef ', ' toon ', 'zoek ', 'plan '];
        const completeMarkers = ['km', 'minuten', 'u ', 'uur', 'rondrit', 'lus', ' Hasselt', ' Gent', ' Antwerpen', ' Brussel', ' Brugge', ' Leuven']; // Typical completion units/cities

        const wordCount = text.trim().split(/\s+/).length;

        // If it's very short, probably not done, unless it's just a city name
        if (wordCount < 2) return false;

        // If it contains a destination AND a constraint, it's very likely complete
        const hasConstraint = lowText.includes('km') || lowText.includes('min') || lowText.includes('uur');
        const hasTravelMode = lowText.includes('fiet') || lowText.includes('wand') || lowText.includes('lop');

        if (hasConstraint && wordCount > 3) return true;
        if (hasTravelMode && wordCount > 4) return true;

        return false;
    };

    // Initialize Speech Recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = language === 'nl' ? 'nl-NL' : 'en-US';

            recognitionRef.current.onresult = (event) => {
                let interimTranscript = '';
                let finalTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                const currentText = (finalTranscript || interimTranscript).trim();
                if (currentText) {
                    setAiPrompt(currentText);
                    setWasVoiceInitiated(true);

                    // Clear previous timer
                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

                    // Intelligent Timing
                    const isComplete = isInputLikelyComplete(currentText);
                    const waitTime = isComplete ? 1200 : 2500;

                    silenceTimerRef.current = setTimeout(() => {
                        console.log("[Voice] Silence detected. Submitting:", currentText);
                        if (recognitionRef.current) recognitionRef.current.stop();
                        if (onJourneyStartRef.current) {
                            // isVoice: true removed so auto-read is disabled
                            onJourneyStartRef.current({ preventDefault: () => { } }, null, currentText);
                        }
                    }, waitTime);
                }
            };

            recognitionRef.current.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }

        return () => {
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        };
    }, [language, setAiPrompt]);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert(language === 'nl' ? "Spraakherkenning wordt niet ondersteund in deze browser." : "Speech recognition is not supported in this browser.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            // Stop any ongoing speech (TTS) before listening
            if (onStopSpeech) onStopSpeech();

            setIsListening(true);
            recognitionRef.current.start();
        }
    };

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
            search_mode_label: "POI Search Mode",
            ai_planner: "AI Planner",
            ai_ph: "Hoi, ik wil graag een wandeling doen van ongeveer 3 uur door Hasselt. Ik wil vertrekken aan de Blauwe Boulevard...",
            ai_label: "Extra Instructions (Language)"
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
            search_mode_label: "POI Zoekwijze",
            ai_planner: "AI Planner",
            ai_ph: "Hoi, ik wil graag een wandeling doen van ongeveer 3 uur door Hasselt. Ik wil vertrekken aan de Blauwe Boulevard...",
            ai_label: "Natuurlijke Taal Planner"
        }
    };
    const text = t[language || 'en'];


    const interestsInputRef = useRef(null);

    useEffect(() => {
        if (shouldAutoFocusInterests && interestsInputRef.current) {
            interestsInputRef.current.focus();
            if (setShouldAutoFocusInterests) setShouldAutoFocusInterests(false);
        }
    }, [shouldAutoFocusInterests, setShouldAutoFocusInterests]);

    // Auto-read logic removed as per user request

    return (
        <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pt-2 px-1"
        >
            {/* Mode Selection Tabs - Split Layout */}
            <div className="grid grid-cols-3 gap-2 mb-2">
                <button
                    onClick={() => setSearchMode('prompt')}
                    className={`flex flex-col items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${searchMode === 'prompt'
                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]'
                        : 'bg-[var(--input-bg)] text-[var(--text-muted)] border-[var(--panel-border)] hover:text-white hover:bg-white/5'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                    {language === 'nl' ? 'AI Gids' : 'AI Guide'}
                </button>
                <button
                    onClick={() => setSearchMode('journey')}
                    className={`flex flex-col items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${searchMode === 'journey'
                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]'
                        : 'bg-[var(--input-bg)] text-[var(--text-muted)] border-[var(--panel-border)] hover:text-white hover:bg-white/5'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0Z" />
                        <path d="m21 21-4.3-4.3" />
                        <path d="M20 11a8 8 0 1 0-16 0 8 8 0 0 0 16 0Z" />
                    </svg>
                    {language === 'nl' ? 'Vragenlijst' : 'Classic'}
                </button>
                <button
                    onClick={() => setSearchMode('manual')}
                    className={`flex flex-col items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all border ${searchMode === 'manual'
                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-[1.02]'
                        : 'bg-[var(--input-bg)] text-[var(--text-muted)] border-[var(--panel-border)] hover:text-white hover:bg-white/5'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0Z" />
                        <path d="M20 11a8 8 0 1 0-16 0 8 8 0 0 0 16 0Z" />
                        <path d="M12 2a3 3 0 0 1 3 3v2a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                    </svg>
                    {language === 'nl' ? 'Zelf Kiezen' : 'Map Pick'}
                </button>
            </div>


            {/* Questionnaire Mode Interface */}
            {searchMode === 'journey' && (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Header */}
                    <div className="flex items-center gap-2 px-1">
                        <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            {language === 'nl' ? 'Plan je trip' : 'Plan your trip'}
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {/* 1. City Selection */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-white font-black ml-1">
                                {language === 'nl' ? 'Welke stad?' : 'Which city?'}
                            </label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    onBlur={() => onCityValidation('blur')}
                                    onKeyDown={(e) => e.key === 'Enter' && onCityValidation('submit')}
                                    placeholder={language === 'nl' ? "Stad zoeken..." : "Search city..."}
                                    className="w-full bg-[var(--input-bg)] border border-[var(--panel-border)] rounded-xl pl-9 pr-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 ring-primary/50 transition-all shadow-md"
                                />
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                </div>
                                <button
                                    onClick={onUseCurrentLocation}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-primary transition-all"
                                    title={language === 'nl' ? "Gebruik mijn locatie" : "Use my location"}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* 2. Location & Type */}
                        {/* 2. Start Location */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-white font-black ml-1">
                                {language === 'nl' ? 'Vertrekpunt (optioneel)' : 'Start Point (optional)'}
                            </label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={startPoint}
                                    onChange={(e) => setStartPoint(e.target.value)}
                                    placeholder={language === 'nl' ? "Bv. Markt ( leeg = gids kiest vertrekpunt)" : "E.g. Market (empty = guide chooses start)"}
                                    className="w-full bg-[var(--input-bg)] border border-[var(--panel-border)] rounded-xl pl-9 pr-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 ring-primary/50 transition-all shadow-md"
                                />
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* 3. Interests Selection */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-white font-black ml-1">
                                {language === 'nl' ? 'Wat zijn je interesses? (optioneel)' : 'What are your interests? (optional)'}
                            </label>
                            <div className="relative group">
                                <input
                                    ref={interestsInputRef}
                                    type="text"
                                    value={interests}
                                    onChange={(e) => setInterests(e.target.value)}
                                    placeholder={language === 'nl' ? "Bv. Musea... (leeg = toeristische plekken)" : "E.g. Museums... (empty = tourist highlights)"}
                                    className="w-full bg-[var(--input-bg)] border border-[var(--panel-border)] rounded-xl pl-9 pr-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 ring-primary/50 transition-all shadow-md"
                                />
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* 3. Travel Mode */}
                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest text-white font-black ml-1">
                                    {language === 'nl' ? 'Tripwijze' : 'Travel Mode'}
                                </label>
                                <div className="flex bg-[var(--input-bg)] p-1 rounded-xl border border-[var(--panel-border)]">
                                    <button
                                        onClick={() => onStyleChange('walking')}
                                        className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold transition-all ${travelMode === 'walking' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {language === 'nl' ? 'Wandelen' : 'Walk'}
                                    </button>
                                    <button
                                        onClick={() => onStyleChange('cycling')}
                                        className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold transition-all ${travelMode === 'cycling' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {language === 'nl' ? 'Fietsen' : 'Cycle'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 4. Constraints (Always Roundtrip) */}
                        <div className="space-y-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-300">
                            {/* Unified Distance/Time Slider for Roundtrip */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <label className="text-[10px] uppercase tracking-widest text-white font-black">
                                        {language === 'nl' ? 'Bereik' : 'Range'}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-primary/80 font-bold">
                                            {travelMode === 'walking' ? (language === 'nl' ? 'Wandelen' : 'Walking') : (language === 'nl' ? 'Fietsen' : 'Cycling')}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-4 px-1">
                                    <input
                                        type="range"
                                        min={1}
                                        max={60}
                                        step={1}
                                        value={constraintType === 'duration' ? Math.round(constraintValue / (travelMode === 'walking' ? 12 : 3)) : constraintValue}
                                        onChange={(e) => {
                                            const km = parseInt(e.target.value);
                                            setConstraintType('distance');
                                            setConstraintValue(km);
                                        }}
                                        className="w-full accent-primary"
                                    />
                                    <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5 shadow-inner">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-xl font-black text-white">
                                                {constraintType === 'duration' ? Math.round(constraintValue / (travelMode === 'walking' ? 12 : 3)) : constraintValue}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">km</span>
                                        </div>
                                        <div className="flex items-baseline gap-1 bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                                            <span className="text-sm font-bold text-primary">
                                                ~{constraintType === 'duration' ? constraintValue : (constraintValue * (travelMode === 'walking' ? 12 : 3))}
                                            </span>
                                            <span className="text-[9px] font-bold text-primary/70 uppercase">min</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}


            {/* Manual Map Picker Interface */}
            {searchMode === 'manual' && (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 px-1">
                        <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            {language === 'nl' ? 'Kies op de kaart' : 'Pick on Map'}
                        </h2>
                    </div>

                    <div className="space-y-4">
                        {/* 1. City Selection */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-white font-black ml-1">
                                {language === 'nl' ? 'Welke stad?' : 'Which city?'}
                            </label>
                            <div className="relative group">
                                <input
                                    type="text"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    onBlur={() => onCityValidation('blur')}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            // In manual mode, Enter only validates the city, doesn't start journey
                                            e.target.blur();
                                        }
                                    }}
                                    placeholder={language === 'nl' ? "Stad zoeken..." : "Search city..."}
                                    className="w-full bg-[var(--input-bg)] border border-[var(--panel-border)] rounded-xl pl-9 pr-3 py-2 text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 ring-primary/50 transition-all shadow-md"
                                />
                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                </div>
                                <button
                                    onClick={onUseCurrentLocation}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-primary transition-all"
                                    title={language === 'nl' ? "Gebruik mijn locatie" : "Use my location"}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* Travel Mode Selector */}
                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest text-white font-black ml-1">
                                    {language === 'nl' ? 'Tripwijze' : 'Travel Mode'}
                                </label>
                                <div className="flex bg-[var(--input-bg)] p-1 rounded-xl border border-[var(--panel-border)]">
                                    <button
                                        onClick={() => onStyleChange('walking')}
                                        className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold transition-all ${travelMode === 'walking' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {language === 'nl' ? 'Wandelen' : 'Walk'}
                                    </button>
                                    <button
                                        onClick={() => onStyleChange('cycling')}
                                        className={`flex-1 flex items-center justify-center py-1.5 rounded-lg text-[10px] font-bold transition-all ${travelMode === 'cycling' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {language === 'nl' ? 'Fietsen' : 'Cycle'}
                                    </button>
                                </div>
                            </div>
                        </div>


                    </div>
                </div>
            )}


            {/* AI Planner Chat Interface */}
            {searchMode === 'prompt' && (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300 min-h-[300px]">
                    {/* Header Title */}
                    <div className="flex items-center gap-2 px-1">
                        <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            {language === 'nl' ? 'Vraag het je gids' : 'Ask your guide'}
                        </h2>
                    </div>

                    {/* Input Area - Now at the Top */}
                    <div className="relative group pb-2 border-b border-[var(--panel-border)]">
                        <textarea
                            value={aiPrompt}
                            onChange={(e) => {
                                setAiPrompt(e.target.value);
                                setWasVoiceInitiated(false);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    onJourneyStart(e);
                                }
                            }}
                            placeholder={isListening ? (language === 'nl' ? "Ik luister..." : "I'm listening...") : (language === 'nl' ? "Hoe kan ik je helpen?" : "How can I help you?")}
                            rows={4}
                            className="w-full bg-[var(--input-bg)] border border-[var(--panel-border)] rounded-2xl pl-3 pr-14 py-2.5 text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 ring-primary/50 placeholder:text-[var(--text-muted)] resize-none leading-relaxed transition-all shadow-xl"
                        />
                        <div className="absolute right-2 bottom-4.5 flex gap-1 z-10">
                            {/* Toggle between Voice and Send based on input type */}
                            {(!(aiPrompt || "").trim() || wasVoiceInitiated || isListening) ? (
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    className={`h-8 w-8 flex items-center justify-center rounded-xl transition-all shadow-lg ${isListening
                                        ? 'bg-red-500 text-white animate-pulse'
                                        : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-600'
                                        }`}
                                    title={language === 'nl' ? "Vraag de gids" : "Ask the guide"}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                        <line x1="12" y1="19" x2="12" y2="22" />
                                    </svg>
                                </button>
                            ) : (
                                <button
                                    onClick={(e) => {
                                        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                                        setWasVoiceInitiated(false);
                                        onJourneyStart(e);
                                    }}
                                    disabled={!(aiPrompt || "").trim()}
                                    className="h-8 w-8 flex items-center justify-center bg-primary text-white rounded-xl shadow-lg hover:bg-primary/80 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg>
                                </button>
                            )}


                        </div>
                    </div>

                    {/* Optional: Go to Trip Button if results exist */}
                    {routeData?.pois?.length > 0 && isAiViewActive && (
                        <button
                            onClick={() => setIsAiViewActive(false)}
                            className="bg-primary/20 hover:bg-primary/40 text-primary border border-primary/40 rounded-xl py-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 animate-in fade-in zoom-in-95 duration-500"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            {language === 'nl' ? "Bekijk je trip" : "View your trip"}
                        </button>
                    )}



                    {/* Chat History Area - Now below the input, showing newest first */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1 scroll-smooth">
                        {isLoading && (
                            <div className="flex justify-start animate-in fade-in slide-in-from-top-2 duration-500">
                                <div className="bg-white/5 text-slate-400 px-3 py-2 rounded-2xl rounded-tl-none border border-white/5 backdrop-blur-sm shadow-md flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-full border border-primary overflow-hidden bg-white shrink-0">
                                        <img src="/guide-icon-round.jpg" alt="Guide" className="w-full h-full object-cover scale-125" />
                                    </div>
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: primaryColor }}></div>
                                        <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ animationDelay: '200ms', backgroundColor: primaryColor }}></div>
                                        <div className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ animationDelay: '400ms', backgroundColor: primaryColor }}></div>
                                    </div>
                                    <span className="text-[10px] uppercase tracking-widest font-bold opacity-50">{loadingText || (language === 'nl' ? 'gids denkt na...' : 'guide is thinking...')}</span>
                                </div>
                            </div>
                        )}


                        {(aiChatHistory || []).map((msg, i) => ({ ...msg, originalIdx: i })).reverse().map((msg, idx) => {
                            const originalIdx = msg.originalIdx;

                            // TYPE: POI SUGGESTIONS (Cards)
                            if (msg.type === 'poi_suggestions' && msg.data) {
                                return (
                                    <div key={idx} className="flex justify-start animate-in fade-in slide-in-from-top-2 duration-500 w-full mb-4">
                                        <div className="bg-slate-800/80 border rounded-2xl rounded-tl-none p-2 max-w-[95%] shadow-lg backdrop-blur-sm" style={{ borderColor: hexToRgba(primaryColor, 0.3) }}>
                                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                                                <div className="w-5 h-5 rounded-full border border-primary/50 overflow-hidden bg-white shrink-0">
                                                    <img src="/guide-icon-round.jpg" alt="Guide" className="w-full h-full object-cover scale-125" />
                                                </div>
                                                <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: hexToRgba(primaryColor, 0.9) }}>
                                                    {language === 'nl' ? `Gevonden voor "${msg.query}"` : `Found for "${msg.query}"`}
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                {msg.data.map((poi, pIdx) => (
                                                    <div key={pIdx} className="bg-slate-900/40 hover:bg-slate-900/60 p-2 rounded-xl flex flex-col gap-2 group transition-all">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="font-bold text-slate-200 text-xs truncate leading-tight">{poi.name}</div>
                                                                <div className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">{poi.description || (language === 'nl' ? 'Geen beschrijving' : 'No description')}</div>
                                                                {poi.detour_km !== undefined && (
                                                                    <div className="text-[9px] text-slate-500 mt-1 flex gap-2">
                                                                        <span className={`font-bold ${poi.detour_km > 1 ? 'text-amber-500' : 'text-green-400'}`}>
                                                                            +{poi.detour_km.toFixed(1)} km / {poi.added_duration_min} min
                                                                        </span>
                                                                    </div>
                                                                )}


                                                            </div>
                                                            <button
                                                                onClick={() => onAddToJourney && onAddToJourney(null, msg.query, { directCandidates: [poi], referencePoiId: msg.context?.referencePoiId })}
                                                                className="h-7 px-3 rounded-lg text-white text-[10px] font-bold shadow-sm transition-all active:scale-95 flex items-center gap-1 hover:brightness-110 shrink-0"
                                                                style={{ backgroundColor: primaryColor }}
                                                            >
                                                                <span>{language === 'nl' ? 'Toevoegen' : 'Add'}</span>
                                                            </button>
                                                        </div>

                                                        {/* Smart Alternative Section */}
                                                        {poi.smartAlternative && (
                                                            <div className="mt-1 pt-1 border-t border-white/5 flex flex-col gap-1.5">
                                                                <div className="flex items-center gap-1.5 text-[9px] text-amber-400/80 font-medium">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                                                    <span>{language === 'nl' ? 'Slim Alternatief' : 'Smart Alternative'}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between gap-2 pl-4">
                                                                    <div className="text-[9px] text-slate-400 italic">
                                                                        {language === 'nl' ? 'Plan na' : 'Plan after'} <span className="text-slate-200 non-italic font-bold">{poi.smartAlternative.poi_name}</span>: {poi.smartAlternative.why_better}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            onAddToJourney && onAddToJourney(null, msg.query, {
                                                                                directCandidates: [poi],
                                                                                insertAfterIndex: poi.smartAlternative.suggest_after_poi_index
                                                                            });
                                                                        }}
                                                                        className="h-6 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 text-[9px] font-bold border border-amber-500/30 transition-all active:scale-95"
                                                                    >
                                                                        {language === 'nl' ? 'Hier toevoegen' : 'Add here'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}


                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // TYPE: TEXT MESSAGE
                            return (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-top-2 duration-500`}>
                                    <div className={`max-w-[90%] px-3 py-2 rounded-2xl text-sm leading-relaxed shadow-md ${msg.role === 'user'
                                        ? 'bg-primary text-white rounded-tr-none'
                                        : 'bg-white/5 text-slate-200 rounded-tl-none border border-white/5 backdrop-blur-sm'
                                        }`}>
                                        <div className="relative whitespace-pre-wrap">
                                            {speakingId === `brain-msg-${originalIdx}` ? (
                                                <div className="whitespace-pre-wrap">
                                                    <span>{msg.text.slice(0, spokenCharCount)}</span>
                                                    <span className="bg-primary/40 text-white rounded-sm px-0.5 transition-all duration-150">{msg.text.slice(spokenCharCount).split(' ')[0]}</span>
                                                    <span>{msg.text.slice(spokenCharCount + msg.text.slice(spokenCharCount).split(' ')[0].length)}</span>
                                                </div>
                                            ) : (
                                                msg.text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                                                    if (part.startsWith('**') && part.endsWith('**')) {
                                                        return <strong key={i} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
                                                    }
                                                    return part;
                                                })
                                            )}


                                        </div>
                                        {msg.role === 'brain' && (
                                            <div className="mt-2 flex items-center justify-between gap-1">
                                                <div className="flex gap-1 animate-pulse opacity-30">
                                                    <div className="w-1.5 h-1.5 bg-current rounded-full"></div>
                                                    <div className="w-1.5 h-1.5 bg-current rounded-full" style={{ animationDelay: '200ms' }}></div>
                                                    <div className="w-1.5 h-1.5 bg-current rounded-full" style={{ animationDelay: '400ms' }}></div>
                                                </div>
                                                <button
                                                    onClick={() => onSpeak && onSpeak(msg.text, `brain-msg-${originalIdx}`)}
                                                    className="p-1 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white"
                                                    title={language === 'nl' ? "Voorlezen" : "Read aloud"}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                                                </button>
                                            </div>
                                        )}


                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}


            {((searchMode !== 'prompt' && searchMode !== 'journey' && searchMode !== 'manual') || isAddingMode) ? (
                <button
                    type="button"
                    onClick={(e) => {
                        if (onJourneyStart) onJourneyStart(e);
                    }}
                    disabled={isLoading || (searchMode === 'prompt' ? (!aiPrompt || !aiPrompt.trim()) : (!interests || !interests.trim()))}
                    className="w-full relative group bg-primary/20 hover:bg-primary/40 text-primary hover:text-white text-sm font-bold py-3 px-4 rounded-xl border border-primary/30 hover:border-primary/50 shadow-lg active:scale-[0.98] transition-all duration-200 overflow-hidden"
                >
                    <div className="relative z-10 flex items-center justify-center gap-2">
                        {isLoading ? (
                            <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        )}
                        <span>{isLoading ? (loadingText || text.start) : text.start}</span>
                    </div>
                </button>
            ) : null}
        </div>
    );
};

export default SidebarInput;
