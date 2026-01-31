import React from 'react';

const DistanceRefineConfirmation = ({
    isOpen,
    onClose,
    onConfirm,
    currentStats,
    currentPoisCount,
    newTargetValue,
    constraintType,
    language,
    primaryColor = '#3b82f6'
}) => {
    if (!isOpen) return null;

    const t = {
        nl: {
            title: "Route Herberekenen?",
            subtitle: "Je hebt de afstand aangepast. Wil je de route volledig vernieuwen met nieuwe plekjes?",
            currentTitle: "Huidige Route",
            newTitle: "Nieuw Voorstel",
            stops: "stops",
            distance: "afstand",
            target: "Doel",
            confirm: "Herberekenen",
            cancel: "Behoud huidige",
            warning: "Let op: Je huidige aanpassingen kunnen verloren gaan."
        },
        en: {
            title: "Recalculate Route?",
            subtitle: "You've adjusted the distance. Would you like to completely refresh the route with new spots?",
            currentTitle: "Current Route",
            newTitle: "New Proposal",
            stops: "stops",
            distance: "distance",
            target: "Target",
            confirm: "Recalculate",
            cancel: "Keep current",
            warning: "Note: Your current manual changes may be lost."
        }
    };

    const text = t[language === 'nl' ? 'nl' : 'en'];

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
                onClick={onClose}
            />

            <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-white/5 bg-slate-800/20 text-center">
                    <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/30">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">{text.title}</h3>
                    <p className="text-sm text-slate-400 font-medium leading-relaxed">{text.subtitle}</p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-3xl bg-white/5 border border-white/5">
                            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black mb-2">{text.currentTitle}</div>
                            <div className="flex flex-col gap-1">
                                <div className="text-lg font-black text-white">{currentPoisCount} <span className="text-xs text-slate-500 font-bold">{text.stops}</span></div>
                                <div className="text-sm font-bold text-slate-400">{currentStats?.totalDistance} <span className="text-[10px] uppercase">km</span></div>
                            </div>
                        </div>
                        <div className="p-4 rounded-3xl bg-primary/10 border border-primary/20">
                            <div className="text-[10px] uppercase tracking-widest text-primary font-black mb-2">{text.newTitle}</div>
                            <div className="flex flex-col gap-1">
                                <div className="text-lg font-black text-primary">{newTargetValue} <span className="text-xs text-primary/60 font-bold">{constraintType === 'duration' ? 'min' : 'km'}</span></div>
                                <div className="text-[10px] text-primary/60 font-bold uppercase">{text.target}</div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <p className="text-[11px] text-amber-500/80 font-bold leading-normal">{text.warning}</p>
                    </div>
                </div>

                <div className="p-6 bg-slate-800/40 flex flex-col gap-3">
                    <button
                        onClick={onConfirm}
                        className="w-full py-4 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black text-sm shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
                    >
                        {text.confirm}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-white transition-colors"
                    >
                        {text.cancel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DistanceRefineConfirmation;
