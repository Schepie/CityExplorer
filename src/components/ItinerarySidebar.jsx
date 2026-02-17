import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { PoiIntelligence } from '../services/PoiIntelligence';
import { apiFetch } from '../utils/api';
import { SmartAutoScroller } from '../utils/AutoScroller';
import ConfirmationModal from './ConfirmationModal';
import RouteRefiner from './RouteRefiner';
import PoiDetailContent from './PoiDetailContent';
import { interleaveRouteItems } from '../utils/routeUtils';

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
    onStartMapPick
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
        <div className="space-y-4 pt-2">
            {/* Mode Selection Tabs */}
            <div className="flex bg-[var(--input-bg)] p-1 rounded-xl border border-[var(--panel-border)] shadow-sm">
                <button
                    onClick={() => setSearchMode('prompt')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${searchMode === 'prompt'
                        ? 'bg-primary text-white shadow-md'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                    </svg>
                    {language === 'nl' ? 'AI Gids' : 'AI Guide'}
                </button>
                <button
                    onClick={() => setSearchMode('journey')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${searchMode === 'journey'
                        ? 'bg-primary text-white shadow-md'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 11a3 3 0 1 0 6 0a3 3 0 0 0-6 0Z" />
                        <path d="m21 21-4.3-4.3" />
                        <path d="M20 11a8 8 0 1 0-16 0 8 8 0 0 0 16 0Z" />
                    </svg>
                    {language === 'nl' ? 'Vragenlijst' : 'Classic'}
                </button>
                <button
                    onClick={() => setSearchMode('manual')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${searchMode === 'manual'
                        ? 'bg-primary text-white shadow-md'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                                    className="w-full bg-[var(--input-bg)] border border-[var(--panel-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 ring-primary/50 transition-all shadow-md"
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
                                    className="w-full bg-[var(--input-bg)] border border-[var(--panel-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 ring-primary/50 transition-all shadow-md"
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
                                    className="w-full bg-[var(--input-bg)] border border-[var(--panel-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 ring-primary/50 transition-all shadow-md"
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

                        {/* Submit Button */}
                        <button
                            onClick={onJourneyStart}
                            disabled={isLoading || !city.trim()}
                            className="w-full bg-primary text-white font-bold py-3.5 px-4 rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 mt-2"
                        >
                            {isLoading ? (
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                            )}


                            {isLoading ? (loadingText || (language === 'nl' ? 'Trip Genereren...' : 'Generating Trip...')) : (language === 'nl' ? 'Trip Genereren' : 'Generate Trip')}
                        </button>
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
                                    className="w-full bg-[var(--input-bg)] border border-[var(--panel-border)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[var(--text-main)] focus:outline-none focus:ring-2 ring-primary/50 transition-all shadow-md"
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

                        <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5 space-y-3">
                            <p className="text-xs text-slate-300 leading-relaxed text-center">
                                {language === 'nl'
                                    ? 'Klik op de knop hieronder en duid vervolgens een punt aan op de kaart om het toe te voegen aan je route.'
                                    : 'Click the button below, then tap a location on the map to add it to your route.'}
                            </p>
                        </div>

                        {/* Start Picking Button */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (onStartMapPick) onStartMapPick(city);
                            }}
                            className="w-full bg-primary text-white font-bold py-3.5 px-4 rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            {language === 'nl' ? 'Duid aan op Kaart' : 'Pick on Map'}
                        </button>
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
                            rows={5}
                            className="w-full bg-[var(--input-bg)] border border-[var(--panel-border)] rounded-2xl pl-4 pr-18 py-3.5 text-[var(--text-main)] text-sm focus:outline-none focus:ring-2 ring-primary/50 placeholder:text-[var(--text-muted)] resize-none leading-relaxed transition-all shadow-xl"
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
                                <div className="bg-white/5 text-slate-400 px-4 py-3 rounded-2xl rounded-tl-none border border-white/5 backdrop-blur-sm shadow-md flex items-center gap-3">
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
                                        <div className="bg-slate-800/80 border rounded-2xl rounded-tl-none p-3 max-w-[95%] shadow-lg backdrop-blur-sm" style={{ borderColor: hexToRgba(primaryColor, 0.3) }}>
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
                                    <div className={`max-w-[90%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-md ${msg.role === 'user'
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













            {/* Primary Action Button - Hidden in prompt, journey, and manual mode */}
            {((searchMode !== 'prompt' && searchMode !== 'journey' && searchMode !== 'manual') || isAddingMode) ? (
                <button
                    type="button"
                    onClick={(e) => {
                        if (onJourneyStart) onJourneyStart(e);
                    }}
                    disabled={isLoading || (searchMode === 'prompt' ? (!aiPrompt || !aiPrompt.trim()) : (!interests || !interests.trim()))}
                    className="w-full relative group bg-primary/20 hover:bg-primary/40 text-primary hover:text-white text-sm font-bold py-3 px-4 rounded-xl border border-primary/30 hover:border-primary/50 shadow-lg active:scale-[0.98] transition-all duration-200 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/0 via-white/5 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <span className="relative flex items-center justify-center gap-2">
                        {(searchMode === 'prompt' && !isAddingMode) ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3.005 3.005 0 013.75-2.906z" />
                            </svg>
                        ) : (
                            searchMode === 'prompt' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                            )
                        )}


                        {isAddingMode || (onJourneyStart && onJourneyStart.name === 'handleAddToJourney')
                            ? (searchMode === 'prompt'
                                ? (language === 'nl' ? 'Praat met gids' : 'Talk to guide')
                                : (language === 'nl' ? 'Toevoegen' : 'Add'))
                            : (searchMode === 'radius'
                                ? (language === 'nl' ? 'Toon Spots' : 'Show POIs')
                                : (searchMode === 'prompt' ? (language === 'nl' ? 'Plan met AI' : 'Plan with AI') : text.start)
                            )
                        }
                    </span>
                </button>
            ) : null}
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

const getPoiCategoryIcon = (poi) => {
    if (!poi) return null;
    const desc = (poi.description || "").toLowerCase();
    const name = (poi.name || "").toLowerCase();

    // Mapping of keywords to Lucide-style icons
    if (desc.includes('restaurant') || desc.includes('food') || desc.includes('bistro') || desc.includes('brasserie')) {
        return <path d="M3 2v7c0 1.1.9 2 2 2h4V2L3 2zM7 2v4M5 2v4M15 2v20M15 2c0 2.8 2.2 5 5 5v3c-2.8 0-5 2.2-5 5" />;
    }
    if (desc.includes('cafe') || desc.includes('coffee') || desc.includes('bakery')) {
        return <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />;
    }
    if (desc.includes('hair') || desc.includes('barber') || desc.includes('beauty') || name.includes('hair')) {
        return <><path d="M6 15h12M18 15a4 4 0 0 1 0 8h-2a4 4 0 0 1-4-4 4 4 0 0 1-4 4H6a4 4 0 0 1 0-8M9 4.8c1.3-1.3 3.6-1.3 4.9 0l7 7c1.3 1.3 1.3 3.6 0 4.9l-7 7c-1.3 1.3-3.6 1.3-4.9 0" opacity="0.1" /><circle cx="6" cy="19" r="3" /><circle cx="18" cy="19" r="3" /><path d="M20 4 8.5 15.5M4 4l11.5 11.5" /></>;
    }
    if (desc.includes('park') || desc.includes('garden') || desc.includes('nature') || desc.includes('forest')) {
        return <path d="m12 19 3-7 3 7-3-1-3 1ZM9 19l-5-8L2 19l3.5-1L9 19ZM12 3v11M12 3c-1.2 0-2.4.6-3 1.7L6 10l3 3.3 3 1.7 3-1.7 3-3.3-3-5.3C14.4 3.6 13.2 3 12 3Z" />;
    }
    if (desc.includes('museum') || desc.includes('historic') || desc.includes('monument') || desc.includes('church')) {
        return <path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M2 11l10-9 10 9M5 22v-4M19 22v-4" />;
    }
    if (desc.includes('shop') || desc.includes('mall') || desc.includes('store') || desc.includes('market')) {
        return <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4ZM3 6h18M16 10a4 4 0 0 1-8 0" />;
    }
    if (desc.includes('bar') || desc.includes('pub') || desc.includes('nightclub')) {
        return <path d="M18 2h-3L7 11V2H4v20h16V2h-2ZM7 22v-5M17 22v-5M7 13h10" />;
    }
    return <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>;
};

const CityWelcomeCard = ({ city, center, stats, language, pois, speakingId, isSpeechPaused, onSpeak, autoAudio, interests, searchMode, constraintValue, constraintType, isRoundtrip, activeTheme, travelMode, onStopSpeech, spokenCharCount, scroller, isAiViewActive, setIsAiViewActive, onUpdateStartLocation, userLocation }) => {
    const [weather, setWeather] = useState(null);
    const [description, setDescription] = useState(null);
    const [cityImage, setCityImage] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentTime, setCurrentTime] = useState('');
    const [showDurationInfo, setShowDurationInfo] = useState(false);
    const [activeView, setActiveView] = useState('main'); // 'main' or 'weather'
    const [isEditingStart, setIsEditingStart] = useState(false);
    const [editStartValue, setEditStartValue] = useState('');
    const highlightedWordRef = useRef(null);

    // Use theme colors
    const primaryColor = activeTheme?.colors?.primary || '#3b82f6';
    const accentColor = activeTheme?.colors?.accent || '#60a5fa';

    useEffect(() => {
        if (!center) return;

        // Reset description to null to show loading state and prevent stale text
        setDescription(null);
        setActiveView('main'); // Reset view on city change

        // 1. Weather (Expanded to include daily and hourly forecast)
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${center[0]}&longitude=${center[1]}&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min&hourly=temperature_2m,weather_code,weathercode&timezone=auto&forecast_days=7`)
            .then(r => r.json())
            .then(data => {
                console.log("Weather Data:", data);
                setWeather(data);
            })
            .catch(e => console.warn("Weather Failed:", e));

        // 2. City Description via Intelligence Engine
        const totalDistNum = stats?.totalDistance ? parseFloat(stats.totalDistance) : 0;
        const actualDist = totalDistNum > 0 ? `${totalDistNum.toFixed(1)} km` : `${constraintValue} ${constraintType === 'duration' ? 'min' : 'km'}`;
        const routeCtx = `${searchMode === 'radius' ? 'Radius search' : 'Journey route'} (Total Length: ${actualDist}, ${isRoundtrip ? 'roundtrip' : 'one-way'})`;
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

    // Sync highlight for city description
    useEffect(() => {
        if (speakingId === `city-welcome-${city}` && highlightedWordRef.current && scroller) {
            scroller.syncHighlight(highlightedWordRef.current);
        }
    }, [spokenCharCount, speakingId, city, scroller]);

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
            className={`group relative bg-slate-800/40 hover:bg-slate-800/80 p-3 rounded-xl border transition-all cursor-pointer`}
        >
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2">
                        <h3 className={`font-bold text-base leading-tight truncate transition-colors ${isExpanded ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                            {city || (language === 'nl' ? 'Leuven' : 'My city trip')}
                        </h3>
                        <div
                            className="flex items-center gap-2 text-[10px] font-medium whitespace-nowrap text-white cursor-pointer hover:bg-white/10 px-1.5 py-0.5 rounded-lg transition-colors border border-transparent hover:border-white/10"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (weather) setActiveView('weather');
                            }}
                            title={language === 'nl' ? 'Bekijk weersverwachting' : 'View weather forecast'}
                        >
                            <span>{weather ? `${getWeatherIcon(weather.current_weather?.weathercode)} ${weather.current_weather?.temperature}°C` : ''}</span>
                        </div>
                    </div>
                    {!isExpanded && (
                        <p
                            className="text-[10px] mt-0.5 truncate uppercase tracking-widest font-black text-white/70 group-hover:text-white transition-opacity"
                        >
                            {language === 'nl' ? 'KLIK VOOR INFO' : 'CLICK FOR INFO'}
                        </p>
                    )}


                </div>

                {/* Audio/Back Control */}
                {isExpanded && (
                    <div className="flex items-center gap-2 shrink-0">
                        {activeView === 'weather' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveView('main');
                                }}
                                className="p-1.5 rounded-full bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                                title={language === 'nl' ? 'Terug' : 'Back'}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                        )}
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
                            className={`p-1.5 rounded-full transition-all ${speakingId === `city-welcome-${city}` ? 'shadow-lg' : 'hover:bg-opacity-20 hover:text-white'}`}
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
                    </div>
                )}
            </div>

            {/* Expandable Content */}
            {isExpanded && (
                <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200">
                    {activeView === 'weather' ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-black tracking-widest text-emerald-500 uppercase">
                                    {language === 'nl' ? 'Weersverwachting' : 'Weather Forecast'}
                                </h4>
                                <span className="text-[10px] text-slate-400">7-Day</span>
                            </div>

                            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                                {weather?.daily?.time?.map((date, idx) => {
                                    const d = new Date(date);
                                    const dayName = d.toLocaleDateString(language === 'nl' ? 'nl-NL' : 'en-US', { weekday: 'short' });
                                    const isToday = idx === 0;

                                    return (
                                        <div
                                            key={date}
                                            onClick={(e) => {
                                                if (isToday) {
                                                    e.stopPropagation();
                                                    setActiveView('hourly');
                                                }
                                            }}
                                            className={`flex items-center justify-between pl-3 pr-5 py-3 border-b border-white/5 last:border-0 ${isToday ? 'bg-emerald-500/10 cursor-pointer hover:bg-emerald-500/20 transition-colors' : ''}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col">
                                                    <span className={`text-[10px] w-14 font-bold uppercase tracking-wider ${isToday ? 'text-emerald-500' : 'text-slate-300'}`}>
                                                        {isToday ? (language === 'nl' ? 'Vandaag' : 'Today') : dayName}
                                                    </span>
                                                    {isToday && (
                                                        <span className="text-[8px] text-emerald-500/60 font-black tracking-widest uppercase">
                                                            {language === 'nl' ? 'BEKIJK UUR' : 'VIEW HOURLY'}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xl leading-none">
                                                    {getWeatherIcon(weather.daily.weathercode[idx])}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-xs font-black text-white">{Math.round(weather.daily.temperature_2m_max[idx])}°</span>
                                                    <span className="text-[9px] font-bold text-slate-500">{Math.round(weather.daily.temperature_2m_min[idx])}°</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveView('main');
                                }}
                                className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black tracking-widest text-slate-400 hover:text-white transition-all uppercase border border-white/10"
                            >
                                {language === 'nl' ? 'TERUG NAAR OVERZICHT' : 'BACK TO SUMMARY'}
                            </button>
                        </div>
                    ) : activeView === 'hourly' ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-black tracking-widest text-emerald-500 uppercase">
                                    {language === 'nl' ? 'Verwachting per uur' : 'Hourly Forecast'}
                                </h4>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveView('weather');
                                    }}
                                    className="p-1 px-2 rounded-md bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-400 hover:text-white transition-all flex items-center gap-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                                    {language === 'nl' ? '7-DAGEN' : '7-DAY'}
                                </button>
                            </div>

                            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                                {(!weather?.hourly?.time || weather.hourly.time.length === 0) ? (
                                    <div className="p-8 text-center text-slate-500 text-[10px] font-bold">
                                        {language === 'nl' ? 'GEEN GEGEVENS BESCHIKBAAR' : 'NO DATA AVAILABLE'}
                                    </div>
                                ) : (
                                    weather.hourly.time.slice(0, 24).map((time, idx) => {
                                        const date = new Date(time);
                                        const hour = date.getHours();
                                        const isNow = hour === new Date().getHours();
                                        const wCode = weather.hourly.weather_code?.[idx] ?? weather.hourly.weathercode?.[idx];

                                        return (
                                            <div
                                                key={time}
                                                className={`flex items-center justify-between pl-4 pr-5 py-3 border-b border-white/5 last:border-0 ${isNow ? 'bg-emerald-500/5' : ''}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <span className={`text-[10px] font-bold w-10 ${isNow ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                        {hour}:00
                                                    </span>
                                                    <span className="text-xl">
                                                        {getWeatherIcon(wCode)}
                                                    </span>
                                                </div>
                                                <span className="text-xs font-black text-white">
                                                    {Math.round(weather.hourly.temperature_2m[idx])}°
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveView('main');
                                }}
                                className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black tracking-widest text-slate-400 hover:text-white transition-all uppercase border border-white/10"
                            >
                                {language === 'nl' ? 'TERUG NAAR OVERZICHT' : 'BACK TO SUMMARY'}
                            </button>
                        </div>
                    ) : (
                        <>
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

                            {searchMode !== 'radius' && (
                                <div className="mt-4 bg-slate-900/40 p-2.5 rounded-lg border border-white/5 space-y-2">
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-white font-black uppercase tracking-wider">{language === 'nl' ? 'Totaal' : 'Total'}</span>
                                        <span className="text-slate-200 font-bold">
                                            {(() => {
                                                const rawDist = stats.walkDistance || stats.totalDistance || 0;
                                                const dist = parseFloat(rawDist) || 0;
                                                if (dist < 1) {
                                                    return `${Math.round(dist * 1000)} m`;
                                                }
                                                return `${dist.toFixed(2)} km`;
                                            })()}
                                        </span>
                                    </div>
                                    {pois && pois.length > 0 && (
                                        <div>
                                            <div className="flex justify-between items-center text-[10px]">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-white font-black uppercase tracking-wider">{language === 'nl' ? 'Naar 1e Stop' : 'To 1st Stop'}</span>
                                                    {onUpdateStartLocation && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setIsEditingStart(!isEditingStart); }}
                                                            className="text-slate-500 hover:text-white transition-colors"
                                                            title={language === 'nl' ? "Startpunt wijzigen" : "Change Start Point"}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                                        </button>
                                                    )}
                                                </div>
                                                <span className="text-slate-200 font-bold">
                                                    {(() => {
                                                        const startLat = userLocation ? userLocation.lat : (center ? center[0] : null);
                                                        const startLon = userLocation ? userLocation.lng : (center ? center[1] : null);

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
                                                        const dist = R * c;
                                                        return dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(2)} km`;
                                                    })()}
                                                </span>
                                            </div>
                                            {isEditingStart && (
                                                <div className="mt-2 flex gap-1 animate-in fade-in slide-in-from-top-1" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="text"
                                                        value={editStartValue}
                                                        onChange={(e) => setEditStartValue(e.target.value)}
                                                        placeholder={language === 'nl' ? "Startpunt (bijv. Station, Huidig)" : "Start (e.g. Station, Current)"}
                                                        className="flex-1 bg-black/30 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-primary/50"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                onUpdateStartLocation(editStartValue);
                                                                setIsEditingStart(false);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            onUpdateStartLocation(editStartValue);
                                                            setIsEditingStart(false);
                                                        }}
                                                        className="bg-primary/20 hover:bg-primary/40 text-primary px-2 py-1 rounded-md text-xs font-bold"
                                                    >
                                                        OK
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center text-[10px]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-white font-black uppercase tracking-wider">{language === 'nl' ? 'Duur' : 'Duration'}</span>
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
                            )}

                            {!isAiViewActive && (
                                <div className="mt-3 px-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsAiViewActive(true);
                                        }}
                                        className="w-full py-2 px-3 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider group"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                        {language === 'nl' ? 'ROUTE AANPASSEN' : 'ADJUST ROUTE'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

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
    searchProvider, setSearchProvider
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
    const [showLanguageSettings, setShowLanguageSettings] = useState(false);
    const [showVoiceSettings, setShowVoiceSettings] = useState(false);
    const [showThemeSettings, setShowThemeSettings] = useState(false);
    const [showTravelSettings, setShowTravelSettings] = useState(false);
    const [showPoiSettings, setShowPoiSettings] = useState(false);
    const [showServiceLogs, setShowServiceLogs] = useState(false);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    const [serviceLogs, setServiceLogs] = useState("");
    const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
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

    // Determine View Mode
    // Show itinerary if we have POIs OR if we have a finalized route path (discovery flow)
    const hasRoute = routeData && routeData.routePath && routeData.routePath.length > 0;
    const hasPois = routeData && routeData.pois && routeData.pois.length > 0;
    const showItinerary = !isAddingMode && !isRouteEditMode && (hasPois || hasRoute) && !isAiViewActive;
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

    const fetchServiceLogs = async () => {
        setIsRefreshingLogs(true);
        try {
            const res = await apiFetch('/api/logs');
            if (res.ok) {
                const data = await res.json();
                setServiceLogs(data.logs || (language === 'nl' ? "Geen logs gevonden." : "No logs found."));
            }
        } catch (e) {
            console.error("Failed to fetch logs:", e);
        } finally {
            setIsRefreshingLogs(false);
        }
    };

    const clearServiceLogs = async () => {
        if (!confirm(language === 'nl' ? "Weet je zeker dat je de logs wilt wissen?" : "Are you sure you want to clear the logs?")) return;
        try {
            const res = await apiFetch('/api/logs/clear', { method: 'POST' });
            if (res.ok) fetchServiceLogs();
        } catch (e) {
            console.error("Failed to clear logs:", e);
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
                className={`absolute top-0 left-0 h-full z-[1100] w-full md:w-[400px] max-w-full bg-[var(--bg-gradient-end)]/95 backdrop-blur-xl border-r border-white/10 shadow-2xl transition-transform duration-300 ease-in-out transform ${isOpen && !isRouteEditMode ? 'translate-x-0' : '-translate-x-full'}`}
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



                                    {/* Guide Icon - Return to AI Chat */}
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
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
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
                        <div className="mt-2.5">
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

                                    {showChangelog && (
                                        <button
                                            onClick={() => setShowChangelog(false)}
                                            className="p-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-400 hover:text-white transition-all flex items-center gap-1"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                                            {language === 'nl' ? 'TERUG' : 'BACK'}
                                        </button>
                                    )}


                                    {showChangelog
                                        ? (language === 'nl' ? 'Wat is nieuw' : "What's New")
                                        : (language === 'nl' ? 'Instellingen' : 'Settings')
                                    }
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
                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                                {showChangelog ? (
                                    /* Changelog View */
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                        {[
                                            {
                                                date: "17 Feb 2026",
                                                version: "v3.3.2",
                                                items: language === 'nl' ? [
                                                    { title: "App Herstarts Fix", desc: "Een bug opgelost waarbij de app herstartte tijdens het bijwerken van plekken." }
                                                ] : [
                                                    { title: "App Restarts Fix", desc: "Resolved an issue where the app would restart unexpectedly during POI updates." }
                                                ]
                                            },
                                            {
                                                date: "17 Feb 2026",
                                                version: "v3.3.1",
                                                items: language === 'nl' ? [
                                                    { title: "Foursquare Standaard", desc: "Extra POI data van Foursquare is nu standaard ingeschakeld voor rijkere resultaten." }
                                                ] : [
                                                    { title: "Foursquare Default", desc: "Foursquare Extra POI data is now enabled by default for richer discovery results." }
                                                ]
                                            },
                                            {
                                                date: "16 Feb 2026",
                                                version: "v3.3.0",
                                                items: language === 'nl' ? [
                                                    { title: "Open Toegang", desc: "Het inlogsysteem is uitgeschakeld voor directe toegang tot alle functies." },
                                                    { title: "Verbeterde Stabiliteit", desc: "Extra beveiliging voor kaartdata voorkomt crashes en verbetert de algemene snelheid." },
                                                    { title: "Service Logs Fix", desc: "Het uitlezen van systeemlogboeken in de instellingen werkt nu weer correct." }
                                                ] : [
                                                    { title: "Open Access", desc: "Disabled the login system to allow immediate access to all features." },
                                                    { title: "Improved Stability", desc: "Data normalization for map points prevents worker crashes and improves performance." },
                                                    { title: "Service Logs Fix", desc: "System diagnostics in advanced settings are now fully functional." }
                                                ]
                                            },
                                            {
                                                date: "13 Feb 2026",
                                                version: "v3.2.0",
                                                items: language === 'nl' ? [
                                                    { title: "Satellietweergave", desc: "Nieuwe 'Layers' knop om te wisselen tussen kaart- en satellietbeelden (vereist MapTiler sleutel)." },
                                                    { title: "Slimme Zoekfeedback", desc: "Beter inzicht in wat de app doet: 'Zoeken...', 'Verrijken...', 'Optimaliseren...'." },
                                                    { title: "Inline Zoeken", desc: "Voeg specifieke plekken (bv. restaurants) toe zonder het zijpaneel te verlaten." },
                                                    { title: "Snellere Resultaten", desc: "Geoptimaliseerde Overpass-servers zorgen voor snellere POI-lading." }
                                                ] : [
                                                    { title: "Satellite View", desc: "New 'Layers' button to toggle between map and satellite imagery (requires MapTiler key)." },
                                                    { title: "Smart Search Feedback", desc: "Better visibility into app actions: 'Searching...', 'Enriching...', 'Optimizing...'." },
                                                    { title: "Inline Search", desc: "Add specific places (e.g. restaurants) without leaving the sidebar." },
                                                    { title: "Faster Results", desc: "Optimized Overpass servers ensure faster POI loading." }
                                                ]
                                            },

                                            {
                                                date: "12 Feb 2026",
                                                version: "v3.1.1",
                                                items: language === 'nl' ? [
                                                    { title: "Volledige Gratis Stack", desc: "Overstap naar Groq Cloud (AI) en Tavily (Zoeken) voor een 100% gratis ervaring." },
                                                    { title: "Overpass Failover", desc: "Automatische mirror-selectie voorkomt foutmeldingen bij drukte op OpenStreetMap." },
                                                    { title: "AI Foutreductie", desc: "Slimme retries en geoptimaliseerde prompts voorkomen 429-fouten in gids-beschrijvingen." },
                                                    { title: "Provider Keuze", desc: "Kies zelf je favoriete AI en zoekmachine in de vernieuwde instellingen." }
                                                ] : [
                                                    { title: "Full Free API Stack", desc: "Migration to Groq Cloud (AI) and Tavily AI (Search) for a 100% free experience." },
                                                    { title: "Overpass Failover", desc: "Automatic mirror switching prevents errors during high OpenStreetMap server load." },
                                                    { title: "AI Error Reduction", desc: "Smart retries and optimized prompts prevent 429 errors in guide descriptions." },
                                                    { title: "Provider Choice", desc: "Choose your preferred AI and search engine in the revamped settings." }
                                                ]
                                            },
                                            {
                                                date: "12 Feb 2026",
                                                version: "v3.0.3",
                                                items: language === 'nl' ? [
                                                    { title: "Overpass API Integratie", desc: "OSM POI zoeken nu via Overpass API. Geen CORS fouten meer, volledig gratis en superieure POI data kwaliteit." }
                                                ] : [
                                                    { title: "Overpass API Integration", desc: "OSM POI search now uses Overpass API. No more CORS errors, completely free, and superior POI data quality." }
                                                ]
                                            },
                                            {
                                                date: "12 Feb 2026",
                                                version: "v3.0.2",
                                                items: language === 'nl' ? [
                                                    { title: "Gratis POI Modus", desc: "Standaard gebruik van OSM (gratis) in plaats van Google Places. Schakel Google Places in via Instellingen indien gewenst." }
                                                ] : [
                                                    { title: "Free POI Mode", desc: "Defaults to OSM (free) instead of Google Places. Enable Google Places in Settings if desired." }
                                                ]
                                            },
                                            {
                                                date: "12 Feb 2026",
                                                version: "v3.0.1",
                                                items: language === 'nl' ? [
                                                    { title: "Zoom naar Route Fix", desc: "De 'zoom naar route' knop werkt nu betrouwbaar, zelfs tijdens navigatie." },
                                                    { title: "GPS Stabilisatie", desc: "Verbeterde sensor filtering voorkomt het schudden van de kaart bij onnauwkeurige GPS of kompas data." }
                                                ] : [
                                                    { title: "Zoom to Route Fix", desc: "The 'zoom to route' button now works reliably, even during navigation." },
                                                    { title: "GPS Stabilization", desc: "Improved sensor filtering prevents map jitter when GPS or compass data is inaccurate." }
                                                ]
                                            },
                                            {
                                                date: "12 Feb 2026",
                                                version: "v3.0.0",
                                                items: language === 'nl' ? [
                                                    { title: "Automatische Lus Routes", desc: "Handmatige routes (via 'Kies op kaart') sluiten nu automatisch als luswandelingen." },
                                                    { title: "Slimme Sidebar", desc: "De zijbalk onthoudt je ontdekkingsvoorkeur en toont geen onnodige discovery prompts meer." },
                                                    { title: "Verfijnde Kaart Controls", desc: "Kaartbesturingsknoppen hebben nu een subtielere transparantie voor een geïntegreerde look." },
                                                    { title: "Route Berekening Fix", desc: "Verbeterde afstandsberekening voor roundtrip routes." }
                                                ] : [
                                                    { title: "Automatic Loop Routes", desc: "Manual routes (via 'Pick on map') now automatically close as loop hikes." },
                                                    { title: "Smart Sidebar", desc: "Sidebar remembers your discovery preference and no longer shows unnecessary discovery prompts." },
                                                    { title: "Refined Map Controls", desc: "Map control buttons now have a more subtle transparency for an integrated look." },
                                                    { title: "Route Calculation Fix", desc: "Improved distance calculation for roundtrip routes." }
                                                ]
                                            },
                                            {
                                                date: "10 Feb 2026",
                                                version: "v2.1.2",
                                                items: language === 'nl' ? [
                                                    { title: "Gedeelde Nummering", desc: "Favorieten en eigen stops delen nu één doorlopende nummering (1, 2, 3...) in de juiste routevolgorde." },
                                                    { title: "Kaart Iconen", desc: "Eigen routepunten zijn nu subtiele ruitvormige markers om ze te onderscheiden van ontdekkingen." },
                                                    { title: "Ontdek Afstand", desc: "De zoekstraal rondom de route is vergroot naar 100 meter voor meer relevante resultaten." }
                                                ] : [
                                                    { title: "Shared Numbering", desc: "POIs and manual stops now share a single sequential numbering (1, 2, 3...) in route order." },
                                                    { title: "Map Icons", desc: "Manual route points are now subtle diamond-shaped markers to distinguish them from discoveries." },
                                                    { title: "Discovery Range", desc: "Increased the discovery perimeter to 100 meters for more relevant results." }
                                                ]
                                            },
                                            {
                                                date: "09 Feb 2026",
                                                version: "v2.1.1",
                                                items: language === 'nl' ? [
                                                    { title: "Navigatie Stabiliteit", desc: "Infinite-loop fix voor route-fetching en verbeterde GPS-drempels." },
                                                    { title: "Handmatige Routes", desc: "Volledige ondersteuning voor eet/drink-stops op zelf getekende routes." },
                                                    { title: "Prestaties", desc: "Minder netwerkverkeer en batterijverbruik door slimme caching-guards." }
                                                ] : [
                                                    { title: "Navigation Stability", desc: "Fixed infinite-loop in route fetching and optimized GPS thresholds." },
                                                    { title: "Manual Route Support", desc: "Full support for food/drink stops on manually drawn routes." },
                                                    { title: "Performance", desc: "Reduced network traffic and battery usage via smart caching guards." }
                                                ]
                                            },
                                            {
                                                date: "09 Feb 2026",
                                                version: "v2.1.0",
                                                items: language === 'nl' ? [
                                                    { title: "Corridor Zoeken", desc: "POI-zoekopdrachten tonen nu alleen plaatsen binnen 50m van je werkelijke pad." },
                                                    { title: "Blijvende Stops", desc: "Genummerde routepunten (1, 2, 3...) blijven nu zichtbaar op de kaart na het afronden." },
                                                    { title: "Snel Ontdekken", desc: "Nieuwe 'Nu Ontdekken' trigger na routecreatie voor een betere controle." },
                                                    { title: "Stabiliteit", desc: "Diverse verbeteringen voor kaartmarkeringen en OSM-proxy verbindingen." }
                                                ] : [
                                                    { title: "Corridor Search", desc: "POI searches now strictly filter results within 50m of your actual route path." },
                                                    { title: "Persistent Stops", desc: "Numbered route markers (1, 2, 3...) now stay visible after finishing your route." },
                                                    { title: "Fast Discovery", desc: "New 'Discover Now' phase after route creation for better control." },
                                                    { title: "Stability", desc: "Key fixes for map marker visibility and OSM proxy reliability." }
                                                ]
                                            },
                                            {
                                                date: "09 Feb 2026",
                                                version: "v2.0.1",
                                                items: language === 'nl' ? [
                                                    { title: "Crash Fix", desc: "Een fout opgelost waarbij de app crashte bij het openen van de stadsinfo met audio aan." },
                                                    { title: "Stem Fix", desc: "Nederlandse stemmen worden nu correct herkend, ongeacht regio (NL/BE)." }
                                                ] : [
                                                    { title: "Crash Fix", desc: "Fixed a critical error where the app would crash when opening city info with audio enabled." },
                                                    { title: "Voice Fix", desc: "Dutch voices are now correctly identified regardless of region (NL/BE)." }
                                                ]
                                            },
                                            {
                                                date: "07 Feb 2026",
                                                version: "v2.0.0",
                                                items: language === 'nl' ? [
                                                    { title: "AR Modus", desc: "Richt je camera op gebouwen om ze direct te identificeren." },
                                                    { title: "Camera Scan", desc: "Nieuwe AI-analyse voor monumenten en bezienswaardigheden." },
                                                    { title: "Kaart Interface", desc: "Verbeterde knoppenindeling voor een rustiger beeld." }
                                                ] : [
                                                    { title: "AR Mode", desc: "Point your camera at buildings to identify them instantly." },
                                                    { title: "Camera Scan", desc: "New AI analysis for monuments and landmarks." },
                                                    { title: "Map Interface", desc: "Improved button layout for a cleaner view." }
                                                ]
                                            },
                                            {
                                                date: "07 Feb 2026",
                                                version: "v1.10.0",
                                                items: language === 'nl' ? [
                                                    { title: "Gesproken Navigatie", desc: "Ontvang nu gesproken turn-by-turn aanwijzingen tijdens je route." },
                                                    { title: "Verbeterde Stabiliteit", desc: "Diverse fixes voor locatie-tracking en stabiliteit bij het opstarten." }
                                                ] : [
                                                    { title: "Spoken Navigation", desc: "Get hands-free turn-by-turn voice guidance as you travel." },
                                                    { title: "Improved Stability", desc: "Key fixes for location tracking and app reliability during startup." }
                                                ]
                                            },
                                            {
                                                date: "07 Feb 2026",
                                                version: "v1.9.0",
                                                items: language === 'nl' ? [
                                                    { title: "Achtergrond Audio", desc: "De app blijft nu actief en gidsen wanneer het scherm uit staat of de app op de achtergrond draait." },
                                                    { title: "Minder Dubbele Info", desc: "Korte beschrijvingen worden nu overgeslagen zodra de uitgebreide informatie beschikbaar is." },
                                                    { title: "Continue Navigatie", desc: "Navigatie stopt niet meer bij tussenstops maar loopt soepel door naar het volgende punt." },
                                                    { title: "Logische Volgorde", desc: "Plek-informatie wordt nu in een natuurlijkere volgorde getoond en voorgelezen." }
                                                ] : [
                                                    { title: "Background Audio", desc: "The app remains active and continues guiding even when the screen is off or backgrounded." },
                                                    { title: "Reduced Redundancy", desc: "Short descriptions are now smartly skipped once full details are available." },
                                                    { title: "Smooth Navigation", desc: "Navigation no longer stops at intermediate waypoints, providing a better flow." },
                                                    { title: "Natural Order", desc: "Information about places is now displayed and read in a more logical order." }
                                                ]
                                            },
                                            {
                                                date: "04 Feb 2026",
                                                version: "v1.8.0",
                                                items: language === 'nl' ? [
                                                    { title: "Route Verfijning", desc: "Nieuwe tool om routes aan te passen, inclusief reiswijze en afstand." },
                                                    { title: "Kies op Kaart", desc: "Klik op de kaart om direct een punt aan de route toe te voegen." },
                                                    { title: "Vereenvoudigde Instellingen", desc: "Instellingen zoals Simulatie en Audio zijn nu direct aan/uit te zetten." }
                                                ] : [
                                                    { title: "Route Refinement", desc: "New tool to modify routes, including travel mode and distance." },
                                                    { title: "Pick on Map", desc: "Click on the map to add a point directly to the route." },
                                                    { title: "Simplified Settings", desc: "Settings like Simulation and Audio are now direct toggles." }
                                                ]
                                            },
                                            {
                                                date: "02 Feb 2026",
                                                version: "v1.7.2",
                                                items: language === 'nl' ? [
                                                    { title: "Kies op Kaart", desc: "Voeg eenvoudig nieuwe stops toe door direct op de kaart te klikken." },
                                                    { title: "Automatische Info", desc: "Nieuwe stops worden nu automatisch voorzien van beschrijvingen en foto's." }
                                                ] : [
                                                    { title: "Pick on Map", desc: "Easily add new stops by clicking directly on the map." },
                                                    { title: "Automatic Info", desc: "New stops are now automatically enriched with descriptions and photos." }
                                                ]
                                            },
                                            {
                                                date: "02 Feb 2026",
                                                version: "v1.7.1",
                                                items: language === 'nl' ? [
                                                    { title: "Route Herberekening", desc: "Wanneer je een POI toevoegt via 'SNEL TOEVOEGEN' wordt de route nu automatisch herberekend en op de kaart getoond." }
                                                ] : [
                                                    { title: "Route Recalculation", desc: "When adding a POI via 'Quick Add', the route is now automatically recalculated and displayed on the map." }
                                                ]
                                            },
                                            {
                                                date: "31 Jan 2026",
                                                version: "v1.7.0",
                                                items: language === 'nl' ? [
                                                    { title: "Gemakkelijk Inloggen", desc: "Je blijft nu 7 dagen ingelogd zodat je niet elke keer een nieuwe code nodig hebt." },
                                                    { title: "Autosave Fix", desc: "De autosave knop werkt nu correct en onthoudt je voorkeur." },
                                                    { title: "Herstarten Verbeterd", desc: "De herstartknop opent nu direct de vragenlijst om snel een nieuwe trip te plannen." }
                                                ] : [
                                                    { title: "Easy Sign-in", desc: "You now stay signed in for 7 days, so you don't need a new code every time." },
                                                    { title: "Autosave Fix", desc: "The autosave button now correctly respects your preference." },
                                                    { title: "Restart Improved", desc: "The restart button now directly opens the questionnaire for quick planning." }
                                                ]
                                            },
                                            {
                                                date: "29 Jan 2026",
                                                version: "v1.6.0",
                                                items: language === 'nl' ? [
                                                    { title: "Beveiligde API", desc: "Volledige JWT authenticatie voor alle zoek- en AI-functies." },
                                                    { title: "Toegangscodes", desc: "Nieuwe mogelijkheid om in te loggen met een 6-cijferige code." },
                                                    { title: "Admin Relay", desc: "Verbeterde login-flow via handmatige goedkeuring." }
                                                ] : [
                                                    { title: "Secure API", desc: "Full JWT authentication for all search and AI features." },
                                                    { title: "Access Codes", desc: "New option to sign in using a 6-digit code." },
                                                    { title: "Admin Relay", desc: "Improved login flow via manual admin approval." }
                                                ]
                                            },
                                            {
                                                date: "26 Jan 2026",
                                                version: "v1.5.1",
                                                items: language === 'nl' ? [
                                                    { title: "Bugfix Suggesties", desc: "Een bug verholpen waarbij het toevoegen van een extra POI uit de lijst van voorstellen soms een foutmelding gaf." }
                                                ] : [
                                                    { title: "Suggestion Bugfix", desc: "Fixed a bug where adding a POI from the guide's suggestions would sometimes trigger an error." }
                                                ]
                                            },
                                            {
                                                date: "26 Jan 2026",
                                                version: "v1.5.0",
                                                items: language === 'nl' ? [
                                                    { title: "Gids Vertelt Verder", desc: "De audio gids leest nu automatisch alle informatie voor (bezienswaardigheid + weetjes + tips) zonder te stoppen." },
                                                    { title: "Visuele Sync", desc: "Woord-voor-woord highlighting volgt nu de stem door alle secties van de beschrijving." },
                                                    { title: "Gedeelde Details", desc: "Informatie in de zijbalk en op de kaart popups is nu identiek en real-time gesynchroniseerd." },
                                                    { title: "Verfijnd Design", desc: "De play-button staat nu naast de titel in popups en de interesses zijn beter leesbaar." },
                                                    { title: "Opgeruimde Menu's", desc: "Instellingen zijn vereenvoudigd en foutieve systeemteksten zijn verwijderd." }
                                                ] : [
                                                    { title: "Continuous Narrative", desc: "The audio guide now automatically reads all information (POI + Fun Facts + Tips) in one go." },
                                                    { title: "Total Sync", desc: "Word-for-word highlighting now follows the voice through all information sections." },
                                                    { title: "Unified Info", desc: "Sidebar and Map Popups now show identical, real-time synchronized data." },
                                                    { title: "Refined Layout", desc: "Play buttons are now aligned with titles and interest matches are more readable." },
                                                    { title: "Clean Settings", desc: "Simplified menus and removed accidental internal system text." }
                                                ]
                                            }
                                        ].map((rel, ri) => (
                                            <div key={ri} className="space-y-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded-full">{rel.version}</span>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{rel.date}</span>
                                                </div>
                                                <div className="space-y-3">
                                                    {rel.items.map((item, ii) => (
                                                        <div key={ii} className="relative pl-4 border-l border-white/5">
                                                            <div className="absolute -left-[1px] top-1.5 w-[2px] h-2 bg-primary/40 rounded-full" />
                                                            <div className="text-sm font-bold text-white mb-0.5">{item.title}</div>
                                                            <div className="text-xs text-slate-400 leading-relaxed">{item.desc}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}

                                        <div className="pt-4 text-center">
                                            <button
                                                onClick={() => setShowChangelog(false)}
                                                className="text-xs text-primary font-bold hover:underline"
                                            >
                                                {language === 'nl' ? 'Sluit Changelog' : 'Close Changelog'}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Settings View */
                                    <div className="space-y-4">
                                        {/* 1. Language */}
                                        <div className="space-y-1">
                                            <button
                                                onClick={() => setShowLanguageSettings(!showLanguageSettings)}
                                                className="flex items-center justify-between w-full hover:bg-white/5 py-1 px-1 rounded-lg transition-all group"
                                            >
                                                <label className="text-xs uppercase tracking-wider text-white font-black ml-1 cursor-pointer group-hover:text-slate-300 transition-colors">
                                                    {language === 'nl' ? 'Taal' : 'Language'}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    {!showLanguageSettings && (
                                                        <span className="text-[10px] text-primary/60 font-bold uppercase tracking-tighter">
                                                            {language === 'en' ? 'English' : 'Nederlands'}
                                                        </span>
                                                    )}


                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className={`h-3 w-3 text-slate-500 transition-transform duration-300 ${showLanguageSettings ? 'rotate-180' : ''}`}
                                                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </button>
                                            {showLanguageSettings && (
                                                <div className="flex flex-col gap-1 mt-1 animate-in slide-in-from-top-1 fade-in duration-200">
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
                                                            className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${language === opt.id ? 'bg-[var(--panel-bg)] border-[var(--primary)]' : 'bg-[var(--panel-bg)] border-[var(--panel-border)] hover:bg-[var(--input-bg)]'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                {opt.icon}
                                                                <span className={`text-sm font-medium ${language === opt.id ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>{opt.label}</span>
                                                            </div>
                                                            {language === opt.id && (
                                                                <div className="text-[var(--primary)]">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                            )}


                                                        </button>
                                                    ))}
                                                </div>
                                            )}


                                        </div>

                                        {/* 2. Voice Preference */}
                                        <div className="space-y-1">
                                            <button
                                                onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                                                className="flex items-center justify-between w-full hover:bg-white/5 py-1 px-1 rounded-lg transition-all group"
                                            >
                                                <label className="text-xs uppercase tracking-wider text-white font-black ml-1 cursor-pointer group-hover:text-slate-300 transition-colors">
                                                    {language === 'nl' ? 'Stem' : 'Voice'}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    {!showVoiceSettings && (
                                                        <span className="text-[10px] text-primary/60 font-bold uppercase tracking-tighter">
                                                            {voiceSettings?.gender === 'female' ? (language === 'nl' ? 'Vrouw' : 'Female') : (language === 'nl' ? 'Man' : 'Male')}
                                                        </span>
                                                    )}


                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className={`h-3 w-3 text-slate-500 transition-transform duration-300 ${showVoiceSettings ? 'rotate-180' : ''}`}
                                                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </button>
                                            {showVoiceSettings && (
                                                <div className="flex flex-col gap-1 mt-1 animate-in slide-in-from-top-1 fade-in duration-200">
                                                    {[
                                                        { id: 'female', label: { en: 'Female', nl: 'Vrouw' } },
                                                        { id: 'male', label: { en: 'Male', nl: 'Man' } }
                                                    ].map((opt) => (
                                                        <button
                                                            key={opt.id}
                                                            onClick={() => setVoiceSettings && setVoiceSettings({ ...voiceSettings, gender: opt.id })}
                                                            className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${voiceSettings?.gender === opt.id ? 'bg-[var(--panel-bg)] border-[var(--primary)]' : 'bg-[var(--panel-bg)] border-[var(--panel-border)] hover:bg-[var(--input-bg)]'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-1.5 rounded-full ${voiceSettings?.gender === opt.id ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-[var(--input-bg)] text-[var(--text-muted)]'}`}>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                                <span className={`text-sm font-medium ${voiceSettings?.gender === opt.id ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>{language === 'nl' ? opt.label.nl : opt.label.en}</span>
                                                            </div>
                                                            {voiceSettings?.gender === opt.id && (
                                                                <div className="text-[var(--primary)]">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                            )}


                                                        </button>
                                                    ))}
                                                </div>
                                            )}


                                        </div>

                                        {/* 3. App Theme */}
                                        <div className="space-y-1">
                                            <button
                                                onClick={() => setShowThemeSettings(!showThemeSettings)}
                                                className="flex items-center justify-between w-full hover:bg-white/5 py-1 px-1 rounded-lg transition-all group"
                                            >
                                                <label className="text-xs uppercase tracking-wider text-white font-black ml-1 cursor-pointer group-hover:text-slate-300 transition-colors">
                                                    {language === 'nl' ? 'Thema' : 'Theme'}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    {!showThemeSettings && (
                                                        <span className="text-[10px] text-primary/60 font-bold uppercase tracking-tighter">
                                                            {availableThemes && availableThemes[activeTheme] ? (language === 'nl' ? availableThemes[activeTheme].label.nl : availableThemes[activeTheme].label.en) : activeTheme}
                                                        </span>
                                                    )}


                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className={`h-3 w-3 text-slate-500 transition-transform duration-300 ${showThemeSettings ? 'rotate-180' : ''}`}
                                                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </button>
                                            {showThemeSettings && (
                                                <div className="flex flex-col gap-1 mt-1 animate-in slide-in-from-top-1 fade-in duration-200">
                                                    <div className="grid grid-cols-1 gap-1">
                                                        {availableThemes && Object.values(availableThemes).map(t => (
                                                            <button
                                                                key={t.id}
                                                                onClick={() => setActiveTheme(t.id)}
                                                                className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${activeTheme === t.id ? 'bg-[var(--panel-bg)] border-[var(--primary)]' : 'bg-[var(--panel-bg)] border-[var(--panel-border)] hover:bg-[var(--input-bg)]'}`}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-7 h-7 rounded-full border border-white/10 shadow-sm flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${t.colors.bgStart}, ${t.colors.bgEnd})` }}>
                                                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.colors.primary }} />
                                                                    </div>
                                                                    <span className={`text-sm font-medium ${activeTheme === t.id ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>
                                                                        {language === 'nl' ? t.label.nl : t.label.en}
                                                                    </span>
                                                                </div>
                                                                {activeTheme === t.id && (
                                                                    <div className="text-[var(--primary)]">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                        </svg>
                                                                    </div>
                                                                )}


                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}


                                        </div>

                                        {/* Travel Mode */}
                                        <div className="space-y-1">
                                            <button
                                                onClick={() => setShowTravelSettings(!showTravelSettings)}
                                                className="flex items-center justify-between w-full hover:bg-white/5 py-1 px-1 rounded-lg transition-all group"
                                            >
                                                <label className="text-xs uppercase tracking-wider text-white font-black ml-1 cursor-pointer group-hover:text-slate-300 transition-colors">
                                                    {language === 'nl' ? 'Reiswijze' : 'Travel Mode'}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    {!showTravelSettings && (
                                                        <span className="text-[10px] text-primary/60 font-bold uppercase tracking-tighter">
                                                            {travelMode === 'walking' ? (language === 'nl' ? 'Wandelen' : 'Walking') : (language === 'nl' ? 'Fietsen' : 'Cycling')}
                                                        </span>
                                                    )}


                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className={`h-3 w-3 text-slate-500 transition-transform duration-300 ${showTravelSettings ? 'rotate-180' : ''}`}
                                                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </button>
                                            {showTravelSettings && (
                                                <div className="flex flex-col gap-1 mt-1 animate-in slide-in-from-top-1 fade-in duration-200">
                                                    {[
                                                        { id: 'walking', label: { en: 'Walking', nl: 'Wandelen' }, icon: <><circle cx="12" cy="4" r="2" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19v-4l-2-2 1-3h-2M12 9l2 2-1 6" /></> },
                                                        { id: 'cycling', label: { en: 'Cycling', nl: 'Fietsen' }, icon: <><circle cx="5.5" cy="17.5" r="3.5" strokeWidth={2} /><circle cx="18.5" cy="17.5" r="3.5" strokeWidth={2} /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 6l-5 5-3-3 2-2M12 17.5V14l-3-3 4-3 2 3h2" /></> }
                                                    ].map(mode => (
                                                        <button
                                                            key={mode.id}
                                                            onClick={() => onStyleChange(mode.id)}
                                                            className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${travelMode === mode.id ? 'bg-[var(--panel-bg)] border-[var(--primary)]' : 'bg-[var(--panel-bg)] border-[var(--panel-border)] hover:bg-[var(--input-bg)]'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-1.5 rounded-full ${travelMode === mode.id ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-[var(--input-bg)] text-[var(--text-muted)]'}`}>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        {mode.icon}
                                                                    </svg>
                                                                </div>
                                                                <span className={`text-sm font-medium ${travelMode === mode.id ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>{language === 'nl' ? mode.label.nl : mode.label.en}</span>
                                                            </div>
                                                            {travelMode === mode.id && (
                                                                <div className="text-[var(--primary)]">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                    </svg>
                                                                </div>
                                                            )}


                                                        </button>
                                                    ))}
                                                </div>
                                            )}


                                        </div>



                                        {/* 5. Simulation Mode */}
                                        <div className="space-y-1">
                                            <button
                                                onClick={() => {
                                                    const newVal = !isSimulationEnabled;
                                                    setIsSimulationEnabled(newVal);
                                                    if (!newVal) setIsSimulating(false);
                                                }}
                                                className="flex items-center justify-between w-full hover:bg-white/5 py-1 px-1 rounded-lg transition-all group"
                                            >
                                                <label className="text-xs uppercase tracking-wider text-white font-black ml-1 cursor-pointer group-hover:text-slate-300 transition-colors">
                                                    {language === 'nl' ? 'Simulatie' : 'Simulation'}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${isSimulationEnabled ? 'text-primary' : 'text-slate-500'}`}>
                                                        {isSimulationEnabled ? (language === 'nl' ? 'Aan' : 'On') : (language === 'nl' ? 'Uit' : 'Off')}
                                                    </span>
                                                </div>
                                            </button>
                                        </div>

                                        {/* 6. Auto Audio */}
                                        <div className="space-y-1">
                                            <button
                                                onClick={() => setAutoAudio(!autoAudio)}
                                                className="flex items-center justify-between w-full hover:bg-white/5 py-1 px-1 rounded-lg transition-all group"
                                            >
                                                <label className="text-xs uppercase tracking-wider text-white font-black ml-1 cursor-pointer group-hover:text-slate-300 transition-colors">
                                                    {language === 'nl' ? 'Auto Audio' : 'Auto Audio'}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${autoAudio ? 'text-primary' : 'text-slate-500'}`}>
                                                        {autoAudio ? (language === 'nl' ? 'Aan' : 'On') : (language === 'nl' ? 'Uit' : 'Off')}
                                                    </span>
                                                </div>
                                            </button>
                                        </div>

                                        {/* 7. Spoken Navigation */}
                                        <div className="space-y-1">
                                            <button
                                                onClick={() => setSpokenNavigationEnabled(!spokenNavigationEnabled)}
                                                className="flex items-center justify-between w-full hover:bg-white/5 py-1 px-1 rounded-lg transition-all group"
                                            >
                                                <label className="text-xs uppercase tracking-wider text-white font-black ml-1 cursor-pointer group-hover:text-slate-300 transition-colors">
                                                    {language === 'nl' ? 'Gesproken Navigatie' : 'Spoken Navigation'}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold uppercase tracking-tighter ${spokenNavigationEnabled ? 'text-primary' : 'text-slate-500'}`}>
                                                        {spokenNavigationEnabled ? (language === 'nl' ? 'Aan' : 'On') : (language === 'nl' ? 'Uit' : 'Off')}
                                                    </span>
                                                </div>
                                            </button>
                                        </div>




                                        {/* 9. Advanced Section */}
                                        <div className="space-y-1">
                                            <button
                                                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                                                className="flex items-center justify-between w-full hover:bg-white/5 py-1 px-1 rounded-lg transition-all group border border-white/5"
                                            >
                                                <label className="text-xs uppercase tracking-wider text-white font-black ml-1 cursor-pointer group-hover:text-slate-300 transition-colors">
                                                    {language === 'nl' ? 'Geavanceerd' : 'Advanced'}
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <svg
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        className={`h-3 w-3 text-slate-500 transition-transform duration-300 ${showAdvancedSettings ? 'rotate-180' : ''}`}
                                                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                    >
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </div>
                                            </button>

                                            {showAdvancedSettings && (
                                                <div className="flex flex-col gap-4 mt-2 p-2 bg-white/5 rounded-xl border border-white/5 animate-in slide-in-from-top-2 fade-in duration-300">
                                                    {/* Service Logs */}
                                                    <div className="space-y-1">
                                                        <button
                                                            onClick={() => {
                                                                const next = !showServiceLogs;
                                                                setShowServiceLogs(next);
                                                                if (next) fetchServiceLogs();
                                                            }}
                                                            className="flex items-center justify-between w-full hover:bg-white/5 py-1 px-1 rounded-lg transition-all group"
                                                        >
                                                            <label className="text-[11px] uppercase tracking-wider text-white font-bold ml-1 cursor-pointer group-hover:text-slate-300 transition-colors">
                                                                {language === 'nl' ? 'Service Logs' : 'Service Logs'}
                                                            </label>
                                                            <div className="flex items-center gap-2">
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    className={`h-3 w-3 text-slate-500 transition-transform duration-300 ${showServiceLogs ? 'rotate-180' : ''}`}
                                                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                                >
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </div>
                                                        </button>
                                                        {showServiceLogs && (
                                                            <div className="flex flex-col gap-2 mt-1 animate-in slide-in-from-top-1 fade-in duration-200">
                                                                <div className="bg-black/40 rounded-lg border border-white/5 p-2 font-mono text-[10px] text-slate-400 overflow-x-auto whitespace-pre min-h-[150px] max-h-[300px] custom-scrollbar focus-within:border-primary/50 transition-all">
                                                                    {isRefreshingLogs ? (
                                                                        <div className="flex items-center justify-center h-full py-10">
                                                                            <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                                                        </div>
                                                                    ) : (
                                                                        serviceLogs || (language === 'nl' ? "Geen data." : "No data.")
                                                                    )}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button onClick={fetchServiceLogs} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white rounded-lg transition-all border border-white/5 shadow-sm">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${isRefreshingLogs ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /><polyline points="22 4 22 10 16 10" /></svg>
                                                                        {language === 'nl' ? 'Verversen' : 'Refresh'}
                                                                    </button>
                                                                    <button onClick={() => window.open('/api/logs/download', '_blank')} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white/5 hover:bg-white/10 text-[10px] font-bold text-white rounded-lg transition-all border border-white/5 shadow-sm">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                                                        {language === 'nl' ? 'Laden' : 'Download'}
                                                                    </button>
                                                                    <button onClick={clearServiceLogs} className="flex items-center justify-center p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all border border-red-500/20 shadow-sm" title={language === 'nl' ? 'Logs wissen' : 'Clear logs'}>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* POI Sources */}
                                                    <div className="space-y-1">
                                                        <button
                                                            onClick={() => setShowPoiSettings(!showPoiSettings)}
                                                            className="flex items-center justify-between w-full hover:bg-white/5 py-1 px-1 rounded-lg transition-all group"
                                                        >
                                                            <label className="text-[11px] uppercase tracking-wider text-white font-bold ml-1 cursor-pointer group-hover:text-slate-300 transition-colors">
                                                                {language === 'nl' ? 'POI Bronnen' : 'POI Sources'}
                                                            </label>
                                                            <div className="flex items-center gap-2">
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    className={`h-3 w-3 text-slate-500 transition-transform duration-300 ${showPoiSettings ? 'rotate-180' : ''}`}
                                                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                                >
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                                </svg>
                                                            </div>
                                                        </button>
                                                        {showPoiSettings && (
                                                            <div className="flex flex-col gap-3 mt-1 animate-in slide-in-from-top-1 fade-in duration-200 p-3 bg-white/5 rounded-lg text-left">
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <div className="text-sm font-medium text-white">AI Engine</div>
                                                                        <div className="text-[10px] text-slate-400">{aiProvider === 'groq' ? (language === 'nl' ? 'Groq (Snel & Gratis)' : 'Groq (Fast & Free)') : (language === 'nl' ? 'Gemini (Google API)' : 'Gemini (Google API)')}</div>
                                                                    </div>
                                                                    <button onClick={() => setAiProvider(aiProvider === 'groq' ? 'gemini' : 'groq')} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${aiProvider === 'groq' ? 'bg-emerald-500' : 'bg-blue-600'}`}>
                                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${aiProvider === 'groq' ? 'translate-x-6' : 'translate-x-1'}`} />
                                                                    </button>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <div className="text-sm font-medium text-white">Search Engine</div>
                                                                        <div className="text-[10px] text-slate-400">{searchProvider === 'tavily' ? (language === 'nl' ? 'Tavily (AI Search - Gratis)' : 'Tavily (AI Search - Free)') : (language === 'nl' ? 'Google (Betaald)' : 'Google (Paid)')}</div>
                                                                    </div>
                                                                    <button onClick={() => setSearchProvider(searchProvider === 'tavily' ? 'google' : 'tavily')} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${searchProvider === 'tavily' ? 'bg-emerald-500' : 'bg-blue-600'}`}>
                                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${searchProvider === 'tavily' ? 'translate-x-6' : 'translate-x-1'}`} />
                                                                    </button>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <div className="text-sm font-medium text-white">OpenStreetMap</div>
                                                                        <div className="text-[10px] text-slate-400">{language === 'nl' ? 'Basis data (Gratis)' : 'Base data (Free)'}</div>
                                                                    </div>
                                                                    <button onClick={() => setSearchSources({ ...searchSources, osm: !searchSources.osm })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${searchSources?.osm ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${searchSources?.osm ? 'translate-x-6' : 'translate-x-1'}`} />
                                                                    </button>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <div className="text-sm font-medium text-white">Foursquare</div>
                                                                        <div className="text-[10px] text-slate-400">{language === 'nl' ? 'Extra POI data (Gratis)' : 'Extra POI data (Free)'}</div>
                                                                    </div>
                                                                    <button onClick={() => setSearchSources({ ...searchSources, foursquare: !searchSources.foursquare })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${searchSources?.foursquare ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${searchSources?.foursquare ? 'translate-x-6' : 'translate-x-1'}`} />
                                                                    </button>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <div className="text-sm font-medium text-white">Google Places</div>
                                                                        <div className="text-[10px] text-slate-400">{language === 'nl' ? 'Hoogste dekking (Betaald)' : 'Highest coverage (Paid)'}</div>
                                                                    </div>
                                                                    <button onClick={() => setSearchSources({ ...searchSources, google: !searchSources.google })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${searchSources?.google ? 'bg-blue-600' : 'bg-slate-700'}`}>
                                                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${searchSources?.google ? 'translate-x-6' : 'translate-x-1'}`} />
                                                                    </button>
                                                                </div>
                                                                <div className="text-[10px] text-slate-400 bg-slate-800/50 p-2 rounded border border-white/5">{language === 'nl' ? '💡 Gebruik Groq, Tavily & Foursquare voor een gratis ervaring. Schakel Google in voor extra data.' : '💡 Use Groq, Tavily & Foursquare for a free experience. Enable Google APIs for extra data coverage.'}</div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Confidence Legend */}
                                                    <div className="space-y-1">
                                                        <button
                                                            onClick={() => setShowTruthfulnessLegend(!showTruthfulnessLegend)}
                                                            className="flex items-center justify-between w-full hover:bg-white/5 py-1 px-1 rounded-lg transition-all group"
                                                        >
                                                            <label className="text-[11px] uppercase tracking-wider text-white font-bold ml-1 cursor-pointer group-hover:text-slate-300 transition-colors">
                                                                {language === 'nl' ? 'Betrouwbaarheid' : 'Confidence'}
                                                            </label>
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                className={`h-3 w-3 text-slate-500 transition-transform duration-300 ${showTruthfulnessLegend ? 'rotate-180' : ''}`}
                                                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                            >
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </button>

                                                        {showTruthfulnessLegend && (
                                                            <div className="mt-1 bg-black/20 rounded-xl p-3 border border-white/5 space-y-3 animate-in slide-in-from-top-2 fade-in duration-300">
                                                                <div className="flex gap-3">
                                                                    <div className="p-1.5 rounded-full bg-emerald-400/10 text-emerald-400 shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg></div>
                                                                    <div>
                                                                        <div className="text-xs font-bold text-slate-200">{language === 'nl' ? 'Hoge Betrouwbaarheid' : 'High Confidence'}</div>
                                                                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{language === 'nl' ? 'Geverifieerd via officiële bronnen of Wikipedia.' : 'Verified via official sources or Wikipedia.'}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-3">
                                                                    <div className="p-1.5 rounded-full bg-blue-400/10 text-blue-400 shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg></div>
                                                                    <div>
                                                                        <div className="text-xs font-bold text-slate-200">{language === 'nl' ? 'Gemiddelde Betrouwbaarheid' : 'Medium Confidence'}</div>
                                                                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{language === 'nl' ? 'Gebaseerd op algemene AI-kennis of zoekresultaten.' : 'Based on general AI knowledge or search results.'}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-3">
                                                                    <div className="p-1.5 rounded-full bg-amber-400/10 text-amber-400 shrink-0"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m10.29 3.86 7.98 13.9a2 2 0 0 1-1.71 3H3.44a2 2 0 0 1-1.71-3l7.98-13.9a2 2 0 0 1 3.44 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></div>
                                                                    <div>
                                                                        <div className="text-xs font-bold text-slate-200">{language === 'nl' ? 'Lage Betrouwbaarheid' : 'Low Confidence'}</div>
                                                                        <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{language === 'nl' ? 'Beperkte data gevonden, interpretatie is vereist.' : 'Limited data found, interpretation is required.'}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                    </div>
                                )}



                            </div>

                            {/* About Section (Static at bottom) */}
                            <div className="p-6 pt-4 border-t border-[var(--panel-border)] bg-slate-900 shrink-0">
                                <h4 className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-3">{language === 'nl' ? 'Over' : 'About'}</h4>
                                <div className="bg-[var(--input-bg)] rounded-xl p-4 border border-[var(--panel-border)] space-y-3">
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-slate-400 text-sm">Version</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setShowChangelog(true)}
                                                className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded font-bold hover:bg-primary/30 transition-colors"
                                            >
                                                {language === 'nl' ? 'WAT IS NIEUW?' : "WHAT'S NEW?"}
                                            </button>
                                            <span className="text-slate-300 text-sm font-medium">v3.3.2</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400 text-sm">Author</span>
                                        <span className="text-slate-300 text-sm font-medium">Geert Schepers</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[var(--text-muted)] text-sm">{language === 'nl' ? 'Laatst bijgewerkt' : 'Last Updated'}</span>
                                        <span className="text-[var(--text-muted)] text-sm font-medium">17 Feb 2026</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}



                    {/* Content Area */}
                    {(isAiViewActive && routeData) ? (
                        /* VIEW 3: Route Refiner (The Guide) - Now takes full space */
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
                        />
                    ) : (
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                            {/* VIEW 1: Disambiguation */}
                            {showDisambiguation ? (
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
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
                                /* VIEW 2: Itinerary List */
                                <>
                                    <div className="flex items-center justify-between mb-1 px-5 pt-4 pb-2">
                                        <h3 className="text-[10px] font-black tracking-widest text-white uppercase">
                                            {language === 'nl' ? 'Jouw Dagplanning' : 'Your Schedule'}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            {/* Pause/Resume Enrichment */}
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
                                                    ? (isEnriching ? "Pauzeer het ophalen van info" : "Hervat info ophalen") // Tooltip can define action, so "Resume info fetching" is effectively "Update Info"
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
                                        <div className="px-5 pb-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
                                                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
                                                <span className="text-xs font-bold text-primary">{loadingText || (language === 'nl' ? 'Bezig met verwerken...' : 'Processing...')}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div
                                        ref={scrollContainerRef}
                                        onScroll={handleScroll}
                                        className="flex-1 overflow-y-auto px-4 pb-4 custom-scrollbar"
                                    >
                                        {/* Discovery Trigger - Shown when we have a route but haven't discovered POIs yet and NO manual POIs exist */}
                                        {routeData && routeData.routePath && routeData.routePath.length > 0 && !isDiscoveryTriggered && searchMode !== 'journey' && (!routeData.pois || routeData.pois.length === 0) && (
                                            <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                                <div className="bg-gradient-to-br from-primary/10 to-blue-500/5 border border-primary/20 rounded-2x p-5 text-center relative overflow-hidden group">
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

                                                    {/* Interest Chips */}
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

                                                    {/* Custom Interest Input */}
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
                                            {(() => {
                                                const manualStops = (routeData.routeMarkers || []);
                                                const interleaved = interleaveRouteItems(manualStops, routeData.pois || [], routeData.routePath);

                                                // Enrich the results with sidebar-specific metadata
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

                                                return items.map((poi, index) => {
                                                    const isExpanded = expandedPoi === poi.id;
                                                    // Display number is simply the index in this consolidated list, but START is special
                                                    const displayNum = poi.isSpecial ? null : index;

                                                    return (
                                                        <div
                                                            key={poi.id}
                                                            ref={el => poiRefs.current[poi.id] = el}
                                                            onClick={() => {
                                                                const newExpanded = isExpanded ? null : poi.id;
                                                                setExpandedPoi(newExpanded);

                                                                if (!isExpanded) {
                                                                    // Expanding: Focus on Map
                                                                    if (poi.isSpecial) {
                                                                        // Center on Start/End
                                                                        if (poi.specialType === 'start') {
                                                                            if (typeof setViewAction === 'function') setViewAction('ROUTE');
                                                                        } else onPoiClick(items[items.length - 1], 'medium'); // Focus last poi for end
                                                                    } else {
                                                                        onPoiClick(poi, descriptionLength || 'medium');
                                                                    }
                                                                } else {
                                                                    if (onPopupClose) onPopupClose();
                                                                }
                                                            }}
                                                            className={`group relative bg-[var(--panel-bg)] hover:bg-[var(--input-bg)] p-4 rounded-xl border transition-all cursor-pointer ${isExpanded ? 'border-primary/50 bg-[var(--input-bg)]' : 'border-[var(--panel-border)] hover:border-primary/30'}`}
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
                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
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



                                                            {/* Expandable Content */}
                                                            {
                                                                isExpanded && (
                                                                    <div className="mt-3 pl-9 animate-in slide-in-from-top-2 fade-in duration-200">

                                                                        <div className="space-y-4 pr-8">
                                                                            {/* Action Buttons */}
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
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
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
                                                                                    {/* Optional Text Label if needed, user just asked for icon but next to 'EDIT' implies style match */}
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
                                                                )
                                                            }
                                                        </div>
                                                    );
                                                })
                                            })()}

                                            {/* Start Journey Button - REMOVED per user request */}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* VIEW 4: Input Form (Start or Add) */
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
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
                                    />
                                </div>
                            )}


                        </div>
                    )}



                    {/* Footer Actions (Only show when in Itinerary mode) */}
                    {showItinerary && !showDisambiguation && (
                        <div className="px-3 py-2 border-t border-white/10 bg-slate-900/50 backdrop-blur-md">
                            <div className="flex items-center gap-1.5 h-8">
                                <button
                                    onClick={() => setAutoAudio(!autoAudio)}
                                    className={`flex-1 h-full text-[10px] uppercase tracking-widest font-extrabold rounded-full border transition-all flex items-center justify-center gap-1.5 shadow-sm ${autoAudio ? 'bg-primary/20 border-primary/40 text-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]' : 'bg-slate-800/60 border-white/10 text-slate-400 hover:bg-slate-800/80 hover:text-white'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" /></svg>
                                    <span className="truncate">{autoAudio ? "Audio aan" : "Audio uit"}</span>
                                </button>



                                <button
                                    onClick={() => {
                                        setIsAddingMode(false);
                                        onReset();
                                    }}
                                    className="flex-1 h-full text-[10px] uppercase tracking-widest font-extrabold rounded-full bg-slate-800/60 border border-white/10 text-slate-400 hover:bg-slate-800/80 hover:text-white transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" /></svg>
                                    <span className="truncate">{text.reset}</span>
                                </button>

                                <button
                                    onClick={onSave}
                                    className="flex-1 h-full text-[10px] uppercase tracking-widest font-extrabold rounded-full bg-slate-800/60 border border-white/10 text-slate-400 hover:bg-slate-800/80 hover:text-white transition-all flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                    <span className="truncate">{text.save}</span>
                                </button>
                            </div>
                        </div>
                    )}


                </div>
                {/* Themed Confirmation Modal */}
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
            </div >
        </>
    );
};

export default ItinerarySidebar;
