import React from 'react';

const ScanResultModal = ({ result, onClose, language }) => {
    if (!result) return null;

    return (
        <div className="absolute inset-0 z-[1300] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-white/10 rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Image Header */}
                <div className="relative h-48 w-full bg-black">
                    {result.image && (
                        <img src={`data:image/jpeg;base64,${result.image.split(',')[1]}`} alt="Scanned" className="w-full h-full object-contain" />
                    )}
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 backdrop-blur-md transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="p-6">
                    <h3 className="text-2xl font-bold text-white mb-1">{result.name}</h3>
                    <div className="flex items-center gap-2 mb-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${result.confidence === 'high' ? 'border-green-500/30 text-green-400 bg-green-500/10' : 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'}`}>
                            {result.confidence === 'high' ? (language === 'nl' ? 'Hoge Zekerheid' : 'High Confidence') : (language === 'nl' ? 'Onzeker' : 'Uncertain')}
                        </span>
                    </div>

                    <p className="text-slate-300 text-sm leading-relaxed mb-4">
                        {result.short_description}
                    </p>

                    {result.fun_fact && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-4">
                            <p className="text-blue-300 text-xs font-medium uppercase tracking-wider mb-1">
                                {language === 'nl' ? 'Wist je dat?' : 'Did you know?'}
                            </p>
                            <p className="text-blue-100 text-sm italic">
                                "{result.fun_fact}"
                            </p>
                        </div>
                    )}

                    <button
                        onClick={onClose}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold transition-colors"
                    >
                        {language === 'nl' ? 'Sluiten' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScanResultModal;
