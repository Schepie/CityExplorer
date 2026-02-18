import React from 'react';

const RefinementModal = ({ proposals, interests, onSelect, onCancel, language }) => {
    if (!proposals) return null;

    return (
        <div className="absolute inset-0 z-[1300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
                <h3 className="text-xl font-bold text-white mb-2">
                    {language === 'nl' ? 'Geen resultaten gevonden' : 'No matches found'}
                </h3>
                <p className="text-slate-400 mb-4">
                    {language === 'nl'
                        ? `We konden geen punten vinden voor "${interests}". Bedoelde je misschien:`
                        : `We couldn't find points for "${interests}". Did you mean one of these?`
                    }
                </p>

                <div className="grid gap-2">
                    {proposals.map((prop, idx) => (
                        <button
                            key={idx}
                            onClick={() => onSelect(prop)}
                            className="bg-white/5 hover:bg-blue-600/20 hover:text-blue-400 text-left px-4 py-3 rounded-xl border border-white/5 transition-all font-medium text-slate-200"
                        >
                            {prop}
                        </button>
                    ))}
                    <button
                        onClick={onCancel}
                        className="w-full mt-4 text-slate-500 hover:text-white text-sm py-2"
                    >
                        {language === 'nl' ? 'Terug' : 'Cancel'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RefinementModal;
