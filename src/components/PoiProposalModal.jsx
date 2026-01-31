import React from 'react';

const PoiProposalModal = ({
    isOpen,
    onClose,
    proposals,
    onSelect,
    language,
    primaryColor = '#3b82f6'
}) => {
    if (!isOpen || !proposals || proposals.length === 0) return null;

    const t = {
        nl: {
            title: "Kies een plek",
            subtitle: "Ik heb deze plekjes gevonden. Welke wil je toevoegen?",
            cancel: "Annuleren",
            detour: "omweg",
            add: "Toevoegen"
        },
        en: {
            title: "Choose a spot",
            subtitle: "I found these places. Which one would you like to add?",
            cancel: "Cancel",
            detour: "detour",
            add: "Add"
        }
    };

    const text = t[language === 'nl' ? 'nl' : 'en'];

    return (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
                onClick={onClose}
            />

            <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-white/5 bg-slate-800/20">
                    <h3 className="text-xl font-bold text-white mb-1">{text.title}</h3>
                    <p className="text-sm text-slate-400">{text.subtitle}</p>
                </div>

                <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-3">
                    {proposals.map((poi, idx) => (
                        <div
                            key={poi.id || idx}
                            className="group p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer flex items-center gap-4"
                            onClick={() => onSelect(poi)}
                        >
                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-400 group-hover:bg-primary group-hover:text-white transition-all shrink-0">
                                {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-white truncate">{poi.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 line-clamp-1">
                                        {poi.type || 'Interesse'}
                                    </span>
                                    {poi.detour_km > 0 && (
                                        <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                            +{poi.detour_km.toFixed(1)} km {text.detour}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold shadow-lg shadow-primary/20 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelect(poi);
                                }}
                            >
                                {text.add}
                            </button>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-slate-800/20 border-t border-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white transition-colors"
                    >
                        {text.cancel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PoiProposalModal;
