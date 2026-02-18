import React from 'react';

const LimitConfirmationModal = ({ confirmation, onCancel, onProceed, language }) => {
    if (!confirmation) return null;

    return (
        <div className="absolute inset-0 z-[1300] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300">
                <h3 className="text-xl font-bold text-white mb-2">
                    {language === 'nl' ? 'Limiet overschreden' : 'Limit Exceeded'}
                </h3>
                <p className="text-slate-400 mb-6">
                    {confirmation.message}
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl transition-colors font-medium"
                    >
                        {language === 'nl' ? 'Annuleren' : 'Cancel'}
                    </button>
                    <button
                        onClick={onProceed}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl transition-colors font-medium"
                    >
                        {language === 'nl' ? 'Doorgaan' : 'Proceed'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LimitConfirmationModal;
