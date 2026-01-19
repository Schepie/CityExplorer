import React, { useState } from 'react';

const CitySelector = ({ onCitySelect, onStartFadeOut }) => {
    const [city, setCity] = useState('');
    const [isAnimating, setIsAnimating] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!city.trim()) return;

        // Notify parent that we are starting to leave (for immediate UI updates like showing loader)
        if (onStartFadeOut) onStartFadeOut();

        setIsAnimating(true);
        // Delay parent callback slightly to allow animation to play
        setTimeout(() => {
            onCitySelect(city);
        }, 800);
    };

    return (
        <div className={`fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900 transition-opacity duration-1000 ${isAnimating ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900/30 to-slate-900"></div>
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="relative z-10 w-full max-w-2xl px-6">
                <div className="text-center mb-12">
                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight">
                        Explore the <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">World</span>
                    </h1>
                    <p className="text-xl text-slate-400 font-light">
                        Discover new places, hidden gems, and local secrets.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="relative max-w-lg mx-auto group">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
                    <div className="relative bg-slate-800/80 backdrop-blur-xl border border-white/10 rounded-full p-2 flex items-center shadow-2xl ring-1 ring-white/10 focus-within:ring-primary/50 transition-all transform hover:scale-[1.02]">
                        <input
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Where to next? (e.g., Tokyo)"
                            className="flex-1 bg-transparent border-none text-white text-lg px-6 py-3 focus:outline-none placeholder:text-slate-500"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={!city.trim()}
                            className="bg-primary hover:bg-primary-hover text-white rounded-full p-3 px-8 font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-primary/50"
                        >
                            <span className="hidden md:inline">Let's Go</span>
                            <span className="md:hidden">→</span>
                        </button>
                    </div>
                </form>

                <div className="mt-12 flex justify-center gap-4 text-sm text-slate-500">
                    <span>Popular:</span>
                    {['London', 'New York', 'Paris', 'Tokyo'].map(c => (
                        <button
                            key={c}
                            onClick={() => { setCity(c); }}
                            className="hover:text-white transition-colors cursor-pointer"
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CitySelector;
