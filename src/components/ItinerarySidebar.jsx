import React, { useState } from 'react';

const ItinerarySidebar = ({ routeData, onPoiClick, onReset, language, speakingId, onSpeak, autoAudio, setAutoAudio }) => {
    const [isOpen, setIsOpen] = useState(true);


    if (!routeData || !routeData.pois || routeData.pois.length === 0) return null;

    const { pois, stats } = routeData;

    const t = {
        en: {
            journey: "Your Journey",
            dist: "Distance",
            budget: "Budget",
            startNew: "Start New Journey",
            poi: "Point of Interest"
        },
        nl: {
            journey: "Jouw Reis",
            dist: "Afstand",
            budget: "Budget",
            startNew: "Start Nieuwe Reis",
            poi: "Bezienswaardigheid"
        }
    };
    const text = t[language || 'en'];

    return (
        <>
            {/* Sidebar Toggle Button (Visible when closed) */}
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

            {/* Main Sidebar Panel */}
            <div
                className={`absolute top-0 left-0 h-full z-[500] w-80 bg-slate-900/95 backdrop-blur-xl border-r border-white/10 shadow-2xl transition-transform duration-300 ease-in-out transform ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 bg-gradient-to-r from-blue-900/20 to-transparent">
                        <div className="flex justify-between items-start mb-4">
                            <h2 className="text-2xl font-bold text-white tracking-tight">{text.journey}</h2>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setAutoAudio(!autoAudio)}
                                    className={`p-2 rounded-full transition-all ${autoAudio ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                    title={autoAudio ? "Auto-Audio ON" : "Auto-Audio OFF"}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                                <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">{text.dist}</div>
                                <div className="text-xl font-bold text-blue-400">{stats.totalDistance} km</div>
                            </div>
                            <div className="bg-slate-800/50 p-3 rounded-lg border border-white/5">
                                <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">{text.budget}</div>
                                <div className="text-xl font-bold text-emerald-400">~{stats.limitKm} km</div>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable POI List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {pois.map((poi, index) => (
                            <div
                                key={poi.id}
                                onClick={() => onPoiClick(poi)}
                                className="group relative bg-slate-800/40 hover:bg-slate-800/80 p-4 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer"
                            >
                                <div className="absolute top-4 left-4 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                    {index + 1}
                                </div>
                                <div className="pl-10">
                                    <h3 className="font-semibold text-slate-100 group-hover:text-blue-300 transition-colors line-clamp-1">{poi.name}</h3>
                                    <p className="text-sm text-slate-400 capitalize mt-1 pr-6">{poi.description || text.poi}</p>
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
                        ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-white/10 bg-slate-900/50">
                        <button
                            onClick={onReset}
                            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-red-900/30 text-slate-300 hover:text-red-400 py-3 rounded-xl border border-white/10 hover:border-red-500/30 transition-all font-medium"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            {text.startNew}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ItinerarySidebar;
