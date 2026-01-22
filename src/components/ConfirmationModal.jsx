import React from 'react';

const ConfirmationModal = ({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', cancelLabel = 'Cancel' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            {/* Backdrop with blur */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onCancel}
            />

            {/* Modal Card */}
            <div className="relative bg-slate-900 border border-primary/50 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
                {/* Header (Optional decorative gradient) */}
                <div className="h-1 w-full bg-gradient-to-r from-primary to-accent opacity-50" />

                <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                    <p className="text-slate-300 mb-6 leading-relaxed">
                        {message}
                    </p>

                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium text-sm"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white transition-all shadow-lg shadow-primary/20 font-medium text-sm"
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;
