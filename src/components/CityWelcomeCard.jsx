import React, { useState, useEffect, useRef } from 'react';
import { PoiIntelligence } from '../services/PoiIntelligence';
import { hexToRgba } from '../utils/uiUtils';

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
                            title={language === 'nl' ? "Voorlezen" : "Read Aloud"}
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
                                <span className="text-[10px] text-slate-400">{language === 'nl' ? '7-Dagen' : '7-Day'}</span>
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
                            <div className="text-xs text-slate-300 leading-relaxed italic opacity-90 pl-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2" style={{ borderLeft: `2px solid ${hexToRgba(primaryColor, 0.3)}` }}>
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
                                                            title={language === 'nl' ? "Startpunt wijzigen" : "Edit Start Point"}
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
                                                <span className="text-slate-300">{parseFloat(durationDetails.dist).toFixed(2)}km @ {durationDetails.speed}km/{language === 'nl' ? 'u' : 'h'} → {Math.round(durationDetails.walkTime)}{language === 'nl' ? 'm' : 'min'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>{language === 'nl' ? 'Stoptijd' : 'Stop time'}:</span>
                                                <span className="text-slate-300">{durationDetails.poiCount} {language === 'nl' ? 'stops' : 'spots'} x {durationDetails.buffer}{language === 'nl' ? 'm' : 'min'} → {durationDetails.visitTime}{language === 'nl' ? 'm' : 'min'}</span>
                                            </div>
                                            <div className="pt-1 border-t border-white/5 flex justify-between font-bold text-slate-300">
                                                <span>{language === 'nl' ? 'Totaal' : 'Total'}:</span>
                                                <span>{durationDetails.totalStr}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}


                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default CityWelcomeCard;
