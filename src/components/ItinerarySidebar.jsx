import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { PoiIntelligence } from '../services/PoiIntelligence';
import { SmartAutoScroller } from '../utils/AutoScroller';
import ConfirmationModal from './ConfirmationModal';

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
    travelMode, onStyleChange,
    aiPrompt, setAiPrompt,
    aiChatHistory,
    isAiViewActive, setIsAiViewActive,
    onSpeak, voiceSettings,
    speakingId, spokenCharCount,
    isLoading, onRemovePoi, onStopSpeech,
    routeData, onAddToJourney,
    activeTheme, availableThemes
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

                    // Intelligent Timing:
                    // If it looks complete, wait less. If it looks incomplete, wait more.
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

    // Auto-read logic removed as per user request

    return (
        <div className="space-y-3 pt-2">


            {/* AI Planner Chat Interface */}
            {searchMode === 'prompt' && (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300 min-h-[300px]">
                    {/* Header Title */}
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-10 h-10 rounded-full border-2 border-primary shadow-lg overflow-hidden bg-white">
                            <img src="/guide-icon-round.jpg" alt="Guide" className="w-full h-full object-cover scale-125" />
                        </div>
                        <h2 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            {language === 'nl' ? 'Vraag het je Gids' : 'Ask your Guide'}
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
                                    title={language === 'nl' ? "Praat met Gids" : "Talk to Guide"}
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
                                    <span className="text-[10px] uppercase tracking-widest font-bold opacity-50">{language === 'nl' ? 'Gids denkt na...' : 'Guide is thinking...'}</span>
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











            {/* Primary Action Button - Hidden in prompt mode as chat has its own interaction */}
            {searchMode !== 'prompt' || isAddingMode ? (
                <button
                    type="button"
                    onClick={(e) => {
                        if (onJourneyStart) onJourneyStart(e);
                    }}
                    disabled={searchMode === 'prompt' ? (!aiPrompt || !aiPrompt.trim()) : (!interests || !interests.trim())}
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
    const desc = (poi.description || "").toLowerCase();
    const name = poi.name.toLowerCase();

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

const CityWelcomeCard = ({ city, center, stats, language, pois, speakingId, isSpeechPaused, onSpeak, autoAudio, interests, searchMode, constraintValue, constraintType, isRoundtrip, activeTheme, travelMode, onStopSpeech, spokenCharCount, scroller, isAiViewActive, setIsAiViewActive, onUpdateStartLocation }) => {
    const [weather, setWeather] = useState(null);
    const [description, setDescription] = useState(null);
    const [cityImage, setCityImage] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [userPos, setUserPos] = useState(null);
    const [currentTime, setCurrentTime] = useState('');
    const [showDurationInfo, setShowDurationInfo] = useState(false);

    const highlightedWordRef = useRef(null);
    const [isEditingStart, setIsEditingStart] = useState(false);
    const [editStartValue, setEditStartValue] = useState("");

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

        // Reset description to null to show loading state and prevent stale text
        setDescription(null);

        // 1. Weather
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${center[0]}&longitude=${center[1]}&current_weather=true`)
            .then(r => r.json())
            .then(data => setWeather(data.current_weather))
            .catch(e => console.warn("Weather fetch failed", e));

        // 2. City Description via Intelligence Engine
        const actualDist = stats?.totalDistance ? `${stats.totalDistance} km` : `${constraintValue} ${constraintType === 'duration' ? 'min' : 'km'}`;
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

                    {searchMode !== 'radius' && (
                        <div className="bg-slate-900/40 p-2.5 rounded-lg border border-white/5 space-y-2">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-slate-500 font-bold uppercase tracking-wider">{language === 'nl' ? 'Totaal' : 'Total'}</span>
                                <span className="text-slate-200 font-bold">{stats.walkDistance || stats.totalDistance} km</span>
                            </div>
                            {pois && pois.length > 0 && (
                                <div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-slate-500 font-bold uppercase tracking-wider">{language === 'nl' ? 'Naar 1e Stop' : 'To 1st Stop'}</span>
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
                                                // Use REAL user position if available, otherwise fallback to center or '-'
                                                // The user specifically asked for "From My Location", so we should prioritize that.
                                                const startLat = userPos ? userPos.lat : (center ? center[0] : null);
                                                const startLon = userPos ? userPos.lng : (center ? center[1] : null);

                                                if (!startLat || !pois[0]) return '-';

                                                // If we have a custom start point active (checking if center deviates significantly from city center?), maybe indicate?
                                                // For now just show distance.

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
                    )}

                    {/* AI Planner Quick Access */}
                    {!isAiViewActive && (
                        <div className="mt-3 px-1">
                            <button
                                onClick={() => setIsAiViewActive(true)}
                                className="w-full py-2 px-3 rounded-xl bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-all flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider group"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                {language === 'nl' ? 'Praat met je gids' : 'Talk to your guide'}
                            </button>
                        </div>
                    )}
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
    onSave, onSaveAs, onLoad,
    descriptionLength, setDescriptionLength,
    activeTheme, setActiveTheme, availableThemes,
    isSimulating, setIsSimulating,
    isSimulationEnabled, setIsSimulationEnabled,
    focusedLocation,
    spokenCharCount,
    isSpeechPaused,
    aiPrompt,
    setAiPrompt,
    aiChatHistory,
    isAiViewActive,
    setIsAiViewActive,

    onRemovePoi,
    onUpdateStartLocation,
    setViewAction
}) => {

    const [nearbyCities, setNearbyCities] = useState([]);
    const [isAddingMode, setIsAddingMode] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsOpenedFromMap, setSettingsOpenedFromMap] = useState(false);
    const [areOptionsVisible, setAreOptionsVisible] = useState(false); // New Toggle for Footer Options
    const [shouldAutoFocusInterests, setShouldAutoFocusInterests] = useState(false);
    const [expandedPoi, setExpandedPoi] = useState(null);
    const [poiToDelete, setPoiToDelete] = useState(null);
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
                    [out:json][timeout:25];
                    (
                      node["place"="city"](around:50000,${latitude},${longitude});
                      node["place"="town"](around:50000,${latitude},${longitude});
                    );
                    out body;
                `;
                const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

                // Fetch with 8s timeout
                const res = await fetch(overpassUrl, { signal: AbortSignal.timeout(20000) });

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
    const showItinerary = !isAddingMode && routeData && routeData.pois && routeData.pois.length > 0 && (!isAiViewActive || searchMode !== 'prompt');
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
                                    isAiViewActive={isAiViewActive}

                                    setIsAiViewActive={setIsAiViewActive}
                                    onUpdateStartLocation={onUpdateStartLocation}
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
                                                    className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${descriptionLength === opt.id ? 'bg-[var(--panel-bg)] border-[var(--primary)]' : 'bg-[var(--panel-bg)] border-[var(--panel-border)] hover:bg-[var(--input-bg)]'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-1.5 rounded-full ${descriptionLength === opt.id ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-[var(--input-bg)] text-[var(--text-muted)]'}`}>
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM4 16V4h16v12H4z" opacity="0.4" />
                                                                {opt.icon}
                                                            </svg>
                                                        </div>
                                                        <span className={`text-sm font-medium ${descriptionLength === opt.id ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>{language === 'nl' ? opt.label.nl : opt.label.en}</span>
                                                    </div>
                                                    {descriptionLength === opt.id && (
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

                                    {/* 5. Simulation Mode */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">{language === 'nl' ? 'Simulatie' : 'Simulation'}</label>
                                        <button
                                            onClick={() => {
                                                const newVal = !isSimulationEnabled;
                                                setIsSimulationEnabled(newVal);
                                                if (!newVal) setIsSimulating(false);
                                            }}
                                            className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${isSimulationEnabled ? 'bg-[var(--panel-bg)] border-[var(--primary)]' : 'bg-[var(--panel-bg)] border-[var(--panel-border)] hover:bg-[var(--input-bg)]'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded-full ${isSimulationEnabled ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-[var(--input-bg)] text-[var(--text-muted)]'}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 1L5 17 10 21 17 5 19 1zM2 10l3-5" /></svg>
                                                </div>
                                                <span className={`text-sm font-medium ${isSimulationEnabled ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>{language === 'nl' ? 'Route Simulatie' : 'Route Simulation'}</span>
                                            </div>
                                            {isSimulationEnabled && (
                                                <div className="text-[var(--primary)]">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    </div>

                                    {/* 6. Auto Audio */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-slate-500 font-bold ml-1">{language === 'nl' ? 'Auto Audio' : 'Auto Audio'}</label>
                                        <button
                                            onClick={() => setAutoAudio(!autoAudio)}
                                            className={`w-full py-2 px-3 flex items-center justify-between text-left rounded-lg transition-all border ${autoAudio ? 'bg-[var(--panel-bg)] border-[var(--primary)]' : 'bg-[var(--panel-bg)] border-[var(--panel-border)] hover:bg-[var(--input-bg)]'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-1.5 rounded-full ${autoAudio ? 'bg-[var(--primary)]/20 text-[var(--primary)]' : 'bg-[var(--input-bg)] text-[var(--text-muted)]'}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                                                </div>
                                                <span className={`text-sm font-medium ${autoAudio ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'}`}>{language === 'nl' ? 'Automatisch Voorlezen' : 'Auto-Audio Mode'}</span>
                                            </div>
                                            {autoAudio && (
                                                <div className="text-[var(--primary)]">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* About Section */}
                                <div className="mt-8 pt-4 border-t border-[var(--panel-border)]">
                                    <h4 className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-3">{language === 'nl' ? 'Over' : 'About'}</h4>
                                    <div className="bg-[var(--input-bg)] rounded-xl p-4 border border-[var(--panel-border)] space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 text-sm">Version</span>
                                            <span className="text-slate-300 text-sm font-medium">v1.4.1</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400 text-sm">Author</span>
                                            <span className="text-slate-300 text-sm font-medium">Geert Schepers</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[var(--text-muted)] text-sm">{language === 'nl' ? 'Laatst bijgewerkt' : 'Last Updated'}</span>
                                            <span className="text-[var(--text-muted)] text-sm font-medium">20 Jan 2026</span>
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
                            <div className="space-y-3">
                                {(() => {
                                    const items = [...routeData.pois];
                                    const startPoint = {
                                        id: 'sidebar-start',
                                        name: language === 'nl' ? 'Startpunt' : 'Start Point',
                                        isSpecial: true,
                                        specialType: 'start',
                                        description: routeData.startInfo || (language === 'nl' ? "Informatie over bereikbaarheid ophalen..." : "Fetching accessibility info..."),
                                        isFullyEnriched: !!routeData.startInfo
                                    };

                                    const finalItems = [startPoint, ...items];

                                    const isRound = routeData.stats?.isRoundtrip || false;
                                    if (items.length > 0 && routeData.routePath?.length > 0) {
                                        finalItems.push({
                                            id: 'sidebar-end',
                                            name: language === 'nl' ? 'Eindpunt' : 'Finish',
                                            isSpecial: true,
                                            specialType: 'end',
                                            description: (isRound ? routeData.startInfo : routeData.endInfo) || (language === 'nl' ? "Informatie over bereikbaarheid ophalen..." : "Fetching accessibility info..."),
                                            isFullyEnriched: !!routeData.endInfo
                                        });
                                    }

                                    return finalItems.map((poi, index) => {
                                        const isExpanded = expandedPoi === poi.id;
                                        // Adjust index for display numbering (skipped for special nodes)
                                        const displayNum = poi.isSpecial ? null : (finalItems.slice(0, index).filter(i => !i.isSpecial).length + 1);

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
                                                            poi.specialType === 'start' ? 'S' : 'F'
                                                        ) : (
                                                            searchMode === 'radius' ? (
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="11" r="3" /><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" /></svg>
                                                            ) : displayNum
                                                        )}
                                                    </div>
                                                    <h3 className={`font-semibold transition-colors line-clamp-1 flex items-center gap-1.5 ${isExpanded ? 'text-primary' : 'text-[var(--text-main)] group-hover:text-primary'} pr-16`}>
                                                        {poi.name}
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            {getPoiCategoryIcon(poi)}
                                                        </svg>
                                                    </h3>
                                                </div>

                                                {!poi.isSpecial && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPoiToDelete(poi);
                                                        }}
                                                        className="absolute top-4 right-3 p-1.5 rounded-full text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-all focus:opacity-100"
                                                        title={language === 'nl' ? "Verwijder" : "Remove"}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                )}

                                                {/* Expandable Content */}
                                                {
                                                    isExpanded && (
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
                                                                className={`absolute top-4 right-12 p-2 rounded-full transition-all ${speakingId === poi.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
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
                                                    )
                                                }
                                            </div>
                                        );
                                    })
                                })()}
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
                                    aiPrompt={aiPrompt}
                                    setAiPrompt={setAiPrompt}
                                    aiChatHistory={aiChatHistory}
                                    isAiViewActive={isAiViewActive}
                                    setIsAiViewActive={setIsAiViewActive}
                                    routeData={routeData}
                                    onSpeak={onSpeak}
                                    voiceSettings={voiceSettings}
                                    isLoading={isLoading}
                                    onStopSpeech={onStopSpeech}
                                    onRemovePoi={onRemovePoi}
                                    onAddToJourney={onAddToJourney}
                                    activeTheme={activeTheme}
                                    availableThemes={availableThemes}
                                />
                            </div>
                        )}
                    </div>

                    {/* Footer Actions (Only show when in Itinerary mode) */}
                    {showItinerary && !showDisambiguation && (
                        <div className="px-3 py-2 border-t border-white/10 bg-slate-900/50 backdrop-blur-md">
                            <div className="flex items-center gap-1.5 h-8">
                                <button
                                    onClick={() => setAutoAudio(!autoAudio)}
                                    className={`flex-1 h-full text-[9px] uppercase tracking-wider font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${autoAudio ? 'bg-primary/10 border-primary/40 text-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]' : 'bg-slate-800/40 border-white/5 text-slate-500 hover:bg-slate-800/80 hover:text-white'}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" /></svg>
                                    <span className="truncate">{autoAudio ? "Audio aan" : "Audio uit"}</span>
                                </button>

                                {!isAiViewActive && (
                                    <button
                                        onClick={() => setIsAiViewActive(true)}
                                        className="flex-1 h-full text-[9px] uppercase tracking-wider font-bold rounded-lg bg-primary/10 border border-primary/40 text-primary hover:bg-primary/20 transition-all flex items-center justify-center gap-1.5 shadow-lg"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                        <span className="truncate">{language === 'nl' ? "Gids" : "Guide"}</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => setAreOptionsVisible(!areOptionsVisible)}
                                    className="h-full px-2.5 text-[9px] uppercase font-bold text-slate-500 hover:text-white transition-colors flex items-center gap-1 bg-slate-800/20 rounded-lg hover:bg-slate-800/60 border border-transparent hover:border-white/5"
                                >
                                    {text.options}
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 transition-transform ${areOptionsVisible ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>

                            {areOptionsVisible && (
                                <div className="mt-2 grid grid-cols-3 gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
                                    <button
                                        onClick={() => {
                                            setIsAddingMode(false);
                                            setAreOptionsVisible(false);
                                            onReset();
                                        }}
                                        className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-[var(--panel-bg)] hover:bg-[var(--input-bg)] border border-[var(--panel-border)] hover:border-[var(--primary)]/30 transition-all group shadow-lg"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--primary)] group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" /></svg>
                                        <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase group-hover:text-[var(--text-main)] transition-colors">{text.reset}</span>
                                    </button>



                                    <button
                                        onClick={onSave}
                                        className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-[var(--panel-bg)] hover:bg-[var(--input-bg)] border border-[var(--panel-border)] hover:border-[var(--primary)]/30 transition-all group shadow-lg"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--primary)] group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                                        <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase group-hover:text-[var(--text-main)] transition-colors">{text.save}</span>
                                    </button>

                                    <button
                                        onClick={onSaveAs}
                                        className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-[var(--panel-bg)] hover:bg-[var(--input-bg)] border border-[var(--panel-border)] hover:border-[var(--primary)]/30 transition-all group shadow-lg"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[var(--primary)] group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                            <polyline points="17 21 17 13 7 13 7 21" />
                                            <polyline points="7 3 7 8 15 8" />
                                            <line x1="12" y1="11" x2="16" y2="15" />
                                            <line x1="12" y1="15" x2="16" y2="15" />
                                        </svg>
                                        <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase group-hover:text-[var(--text-main)] transition-colors">{language === 'nl' ? 'Opslaan als' : 'Save As'}</span>
                                    </button>
                                </div>
                            )}
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
