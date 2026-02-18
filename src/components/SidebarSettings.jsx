import React, { useState } from 'react';
import Changelog from './Changelog';

const SidebarSettings = ({
    language, setLanguage,
    showChangelog, setShowChangelog,
    setShowSettings,
    settingsOpenedFromMap,
    setIsOpen,
    voiceSettings, setVoiceSettings,
    availableThemes, activeTheme, setActiveTheme,
    travelMode, onStyleChange,
    isSimulationEnabled, setIsSimulationEnabled,
    setIsSimulating,
    autoAudio, setAutoAudio,
    spokenNavigationEnabled, setSpokenNavigationEnabled,
    fetchServiceLogs, clearServiceLogs,
    onStopSpeech,
    autoSave, setAutoSave,
    confidenceThreshold, setConfidenceThreshold,
    searchSources, setSearchSources,
    aiProvider, setAiProvider,
    searchProvider, setSearchProvider,
    version, author, lastUpdated
}) => {
    const [serviceLogs, setServiceLogs] = useState("");
    const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);

    // UI state for accordions
    const [expandedSection, setExpandedSection] = useState('about');
    const [showAdvanced, setShowAdvanced] = useState(false);

    const handleFetchLogs = async () => {
        setIsRefreshingLogs(true);
        try {
            const logs = await fetchServiceLogs();
            setServiceLogs(logs);
        } catch (e) {
            console.error(e);
            setServiceLogs(language === 'nl' ? "Fout bij laden logs." : "Error loading logs.");
        } finally {
            setIsRefreshingLogs(false);
        }
    };

    const handleClearLogs = async () => {
        const success = await clearServiceLogs();
        if (success) {
            setServiceLogs("");
            handleFetchLogs();
        }
    };

    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section);
        if (section === 'service_logs' && expandedSection !== 'service_logs') {
            handleFetchLogs();
        }
    };

    // Helper for Boolean Toggles
    const SettingToggle = ({ label, value, onChange }) => (
        <div
            onClick={onChange}
            className="flex items-center justify-between py-2.5 px-4 bg-black/20 border border-white/5 rounded-2xl hover:bg-black/30 transition-all group cursor-pointer"
        >
            <label className="text-xs font-black text-white/90 uppercase tracking-[0.05em] group-hover:text-white transition-colors cursor-pointer">{label}</label>
            <span
                className={`text-[11px] font-black uppercase tracking-widest transition-colors ${value ? 'text-primary' : 'text-slate-600'}`}
            >
                {value ? (language === 'nl' ? 'AAN' : 'ON') : (language === 'nl' ? 'UIT' : 'OFF')}
            </span>
        </div>
    );

    // Helper for Select items
    const SettingSelect = ({ label, value, onClick }) => (
        <div className="flex items-center justify-between py-2.5 px-4 bg-black/20 border border-white/5 rounded-2xl group cursor-pointer hover:bg-black/30 transition-all" onClick={onClick}>
            <label className="text-xs font-black text-white/90 uppercase tracking-[0.05em] group-hover:text-white transition-colors">{label}</label>
            <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black text-primary uppercase tracking-widest">{value}</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </div>
        </div>
    );

    // Helper for Source Toggles
    const SourceToggle = ({ title, subtitle, value, onChange }) => (
        <div className="flex items-center justify-between py-1 px-1">
            <div className="flex flex-col">
                <span className="text-[13px] font-bold text-white/90 leading-tight">{title}</span>
                <span className="text-[10px] text-slate-500 font-medium">{subtitle}</span>
            </div>
            <button
                onClick={onChange}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${value ? 'bg-primary border-white/50' : 'bg-slate-700 border-transparent'}`}
            >
                <span className={`pointer-events-none inline-block h-[18px] w-[18px] transform mt-[1px] ml-[1px] rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${value ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
        </div>
    );

    if (showChangelog) {
        return (
            <div className="absolute inset-0 z-[1000] bg-[var(--bg-gradient-end)] flex flex-col animate-in slide-in-from-right duration-300">
                <div className="flex flex-col h-full bg-gradient-to-b from-[var(--bg-gradient-start)]/50 to-transparent backdrop-blur-md">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowChangelog(false)}
                                className="p-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-400 hover:text-white transition-all flex items-center gap-1"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                                {language === 'nl' ? 'TERUG' : 'BACK'}
                            </button>
                            <h3 className="font-bold text-white text-xl tracking-tight">
                                {language === 'nl' ? 'Wat is nieuw' : "What's New"}
                            </h3>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <Changelog language={language} setShowChangelog={setShowChangelog} />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="absolute inset-0 z-[1000] bg-[var(--bg-gradient-end)] flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex flex-col h-full bg-gradient-to-b from-[var(--bg-gradient-start)]/50 to-transparent backdrop-blur-md">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                        </svg>
                        <h3 className="font-bold text-white text-xl tracking-tight">
                            {language === 'nl' ? 'Instellingen' : 'Settings'}
                        </h3>
                    </div>
                    <button
                        onClick={() => {
                            setShowSettings(false);
                            if (settingsOpenedFromMap) {
                                setIsOpen(false);
                            }
                        }}
                        className="p-1 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-3">

                    {/* All Menu Items in one flow */}
                    <div className="space-y-1">
                        {/* Basic Settings */}
                        <SettingSelect
                            label={language === 'nl' ? 'Taal' : 'Language'}
                            value={language === 'nl' ? 'NEDERLANDS' : 'ENGLISH'}
                            onClick={() => setLanguage(language === 'nl' ? 'en' : 'nl')}
                        />
                        <SettingSelect
                            label={language === 'nl' ? 'Stem' : 'Voice'}
                            value={(() => {
                                const gender = voiceSettings?.gender || 'female';
                                if (language === 'nl') {
                                    return gender === 'female' ? 'VROUW' : 'MAN';
                                }
                                return gender.toUpperCase();
                            })()}
                            onClick={() => {
                                const currentGender = voiceSettings?.gender || 'female';
                                const newGender = currentGender === 'female' ? 'male' : 'female';
                                setVoiceSettings({ ...voiceSettings, gender: newGender });
                            }}
                        />
                        <SettingSelect
                            label={language === 'nl' ? 'Thema' : 'Theme'}
                            value={(availableThemes[activeTheme]?.label?.[language] || activeTheme).toUpperCase()}
                            onClick={() => {
                                const themes = Object.keys(availableThemes);
                                const nextIdx = (themes.indexOf(activeTheme) + 1) % themes.length;
                                setActiveTheme(themes[nextIdx]);
                            }}
                        />
                        <SettingSelect
                            label={language === 'nl' ? 'Reismodus' : 'Travel Mode'}
                            value={(() => {
                                if (language === 'nl') {
                                    if (travelMode === 'walking') return 'WANDELEN';
                                    if (travelMode === 'cycling') return 'FIETSEN';
                                }
                                return travelMode.toUpperCase();
                            })()}
                            onClick={() => {
                                const modes = ['walking', 'cycling'];
                                const nextIdx = (modes.indexOf(travelMode) + 1) % modes.length;
                                onStyleChange(modes[nextIdx]);
                            }}
                        />

                        {/* Boolean Toggles */}
                        <SettingToggle
                            label={language === 'nl' ? 'Simulatie' : 'Simulation'}
                            value={isSimulationEnabled}
                            onChange={() => {
                                const newVal = !isSimulationEnabled;
                                setIsSimulationEnabled(newVal);
                                if (!newVal) setIsSimulating(false);
                            }}
                        />
                        <SettingToggle
                            label={language === 'nl' ? 'Auto Audio' : 'Auto Audio'}
                            value={autoAudio}
                            onChange={() => setAutoAudio(!autoAudio)}
                        />
                        <SettingToggle
                            label={language === 'nl' ? 'Gesproken Navigatie' : 'Spoken Navigation'}
                            value={spokenNavigationEnabled}
                            onChange={() => setSpokenNavigationEnabled(!spokenNavigationEnabled)}
                        />
                        <SettingToggle
                            label={language === 'nl' ? 'Automatisch Opslaan' : 'AutoSave'}
                            value={autoSave}
                            onChange={() => setAutoSave(!autoSave)}
                        />

                        {/* Advanced Accordion Header */}
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center justify-between w-full py-2.5 px-4 bg-black/20 border border-white/5 rounded-2xl group hover:bg-black/30 transition-all"
                        >
                            <span className="text-xs font-black text-white/90 uppercase tracking-[0.05em] group-hover:text-white transition-colors">{language === 'nl' ? 'Geavanceerd' : 'Advanced'}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-500 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {/* Advanced Content (Unified Style) */}
                        {showAdvanced && (
                            <div className="space-y-1 pl-4 mt-1">
                                {/* Nested: Service Logs */}
                                <div className="flex flex-col">
                                    <button
                                        onClick={() => toggleSection('service_logs')}
                                        className="flex items-center justify-between w-full py-2 px-4 bg-black/20 border border-white/5 rounded-2xl group text-left hover:bg-black/30 transition-all"
                                    >
                                        <span className="text-xs font-black text-white/90 uppercase tracking-[0.05em] group-hover:text-white transition-colors">Service Logs</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-500 transition-transform ${expandedSection === 'service_logs' ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    {expandedSection === 'service_logs' && (
                                        <div className="mt-1 p-4 bg-black/20 rounded-2xl border border-white/5 animate-in slide-in-from-top-2 duration-200">
                                            <div className="bg-black/40 rounded-lg border border-white/5 p-2 font-mono text-[9px] text-slate-400 overflow-x-auto whitespace-pre min-h-[150px] max-h-[300px] custom-scrollbar mb-3">
                                                {isRefreshingLogs ? (language === 'nl' ? "Logs laden..." : "Loading logs...") : (serviceLogs || (language === 'nl' ? "Geen logs beschikbaar." : "No logs available."))}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={handleFetchLogs} className="flex-1 py-1.5 px-3 bg-white/5 hover:bg-white/10 text-[9px] font-bold text-white rounded-lg transition-all border border-white/5">{language === 'nl' ? 'Vernieuwen' : 'Refresh'}</button>
                                                <button onClick={handleClearLogs} className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[9px] font-bold rounded-lg transition-all border border-red-500/20">{language === 'nl' ? 'Wissen' : 'Clear'}</button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Nested: POI Sources */}
                                <div className="flex flex-col">
                                    <button
                                        onClick={() => toggleSection('poi_sources')}
                                        className="flex items-center justify-between w-full py-2 px-4 bg-black/20 border border-white/5 rounded-2xl group text-left hover:bg-black/30 transition-all"
                                    >
                                        <span className="text-xs font-black text-white/90 uppercase tracking-[0.05em] group-hover:text-white transition-colors">{language === 'nl' ? 'POI BRONNEN' : 'POI SOURCES'}</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-500 transition-transform ${expandedSection === 'poi_sources' ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    {expandedSection === 'poi_sources' && (
                                        <div className="mt-1 p-4 bg-black/20 rounded-2xl border border-white/5 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                            <SourceToggle
                                                title="AI Engine"
                                                subtitle={aiProvider === 'gemini' ? "Gemini (Google API)" : (language === 'nl' ? "Groq (Llama / Gratis)" : "Groq (Llama / Free)")}
                                                value={aiProvider !== 'gemini'}
                                                onChange={() => setAiProvider(aiProvider === 'gemini' ? 'groq' : 'gemini')}
                                            />
                                            <SourceToggle
                                                title="Search Engine"
                                                subtitle={searchProvider === 'google' ? (language === 'nl' ? "Google (Betaald)" : "Google (Paid)") : (language === 'nl' ? "Tavily (Gratis)" : "Tavily (Free)")}
                                                value={searchProvider !== 'google'}
                                                onChange={() => setSearchProvider(searchProvider === 'google' ? 'tavily' : 'google')}
                                            />
                                            <SourceToggle
                                                title="OpenStreetMap"
                                                subtitle={language === 'nl' ? "Basis data (Gratis)" : "Base data (Free)"}
                                                value={searchSources.osm}
                                                onChange={() => setSearchSources({ ...searchSources, osm: !searchSources.osm })}
                                            />
                                            <SourceToggle
                                                title="Foursquare"
                                                subtitle={language === 'nl' ? "Extra POI data (Gratis)" : "Extra POI data (Free)"}
                                                value={searchSources.foursquare}
                                                onChange={() => setSearchSources({ ...searchSources, foursquare: !searchSources.foursquare })}
                                            />
                                            <SourceToggle
                                                title="Google Places"
                                                subtitle={language === 'nl' ? "Hoogste dekking (Betaald)" : "Highest coverage (Paid)"}
                                                value={searchSources.google}
                                                onChange={() => setSearchSources({ ...searchSources, google: !searchSources.google })}
                                            />

                                            {/* Tip Box */}
                                            <div className="mt-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 flex gap-3">
                                                <div className="shrink-0 text-amber-400 mt-0.5">💡</div>
                                                <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                                                    {language === 'nl'
                                                        ? "Gebruik Groq, Tavily & Foursquare voor een gratis ervaring. Schakel Google in voor extra data."
                                                        : "Use Groq, Tavily & Foursquare for a free experience. Enable Google for extra data."}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Nested: Confidence */}
                                <div className="flex flex-col">
                                    <button
                                        onClick={() => toggleSection('confidence')}
                                        className="flex items-center justify-between w-full py-2 px-4 bg-black/20 border border-white/5 rounded-2xl group text-left hover:bg-black/30 transition-all"
                                    >
                                        <span className="text-xs font-black text-white/90 uppercase tracking-[0.05em] group-hover:text-white transition-colors">{language === 'nl' ? 'BETROUWBAARHEID' : 'CONFIDENCE'}</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-500 transition-transform ${expandedSection === 'confidence' ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>

                                    {expandedSection === 'confidence' && (
                                        <div className="mt-1 p-4 bg-black/20 rounded-2xl border border-white/5 animate-in slide-in-from-top-2 duration-300 space-y-5">
                                            {/* High Confidence */}
                                            <div className="flex gap-4 items-start group/item">
                                                <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 border border-emerald-500/20 group-hover/item:bg-emerald-500/20 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h5 className="text-[11px] font-black text-white uppercase tracking-wider">{language === 'nl' ? 'Hoge Betrouwbaarheid' : 'High Confidence'}</h5>
                                                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-medium">
                                                        {language === 'nl' ? 'Geverifieerd via officiële bronnen of Wikipedia.' : 'Verified via official sources or Wikipedia.'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Medium Confidence */}
                                            <div className="flex gap-4 items-start group/item">
                                                <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-500/20 group-hover/item:bg-blue-500/20 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h5 className="text-[11px] font-black text-white uppercase tracking-wider">{language === 'nl' ? 'Gemiddelde Betrouwbaarheid' : 'Medium Confidence'}</h5>
                                                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-medium">
                                                        {language === 'nl' ? 'Gebaseerd op algemene AI-kennis of zoekresultaten.' : 'Based on general AI knowledge or search results.'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Low Confidence */}
                                            <div className="flex gap-4 items-start group/item">
                                                <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 border border-amber-500/20 group-hover/item:bg-amber-500/20 transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h5 className="text-[11px] font-black text-white uppercase tracking-wider">{language === 'nl' ? 'Lage Betrouwbaarheid' : 'Low Confidence'}</h5>
                                                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-medium">
                                                        {language === 'nl' ? 'Beperkte data gevonden, interpretatie is vereist.' : 'Limited data found, interpretation required.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* About Accordion Header */}
                        <button
                            onClick={() => toggleSection('about')}
                            className="flex items-center justify-between w-full py-2.5 px-4 bg-black/20 border border-white/5 rounded-2xl group hover:bg-black/30 transition-all mt-1"
                        >
                            <span className="text-xs font-black text-white/90 uppercase tracking-[0.05em] group-hover:text-white transition-colors">{language === 'nl' ? 'Over deze App' : 'About this App'}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 text-slate-500 transition-transform ${expandedSection === 'about' ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {/* About Content (3 Submenu Topics - compact single-line rows) */}
                        {expandedSection === 'about' && (
                            <div className="pl-4 mt-1 bg-black/20 rounded-2xl border border-white/5 overflow-hidden animate-in slide-in-from-top-2 duration-300">
                                {/* Row 1: Application + version + changelog button */}
                                <div className="flex items-center gap-2.5 px-3 py-2 border-b border-white/5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                                    </svg>
                                    <span className="text-[10px] font-black text-white/70 uppercase tracking-wider flex-1">{language === 'nl' ? 'Versie' : 'Version'}</span>
                                    <button
                                        onClick={() => setShowChangelog(true)}
                                        className="text-[9px] font-black text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-all border border-white/5 uppercase tracking-widest"
                                    >
                                        {language === 'nl' ? 'Nieuw?' : "What's new?"}
                                    </button>
                                    <span className="text-[10px] text-slate-400 font-medium">{version}</span>
                                </div>
                                {/* Row 2: Author */}
                                <div className="flex items-center gap-2.5 px-3 py-2 border-b border-white/5">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" x2="19" y1="8" y2="14" /><line x1="22" x2="16" y1="11" y2="11" />
                                    </svg>
                                    <span className="text-[10px] font-black text-white/70 uppercase tracking-wider flex-1">{language === 'nl' ? 'Auteur' : 'Author'}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">{author}</span>
                                </div>
                                {/* Row 3: Last updated */}
                                <div className="flex items-center gap-2.5 px-3 py-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <span className="text-[10px] font-black text-white/70 uppercase tracking-wider flex-1">{language === 'nl' ? 'Bijgewerkt' : 'Updated'}</span>
                                    <span className="text-[10px] text-slate-400 font-medium">{lastUpdated}</span>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

            </div>
        </div>
    );
};

export default SidebarSettings;
