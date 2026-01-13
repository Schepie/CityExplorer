import React, { useState } from 'react';

const JourneyInput = ({
    city, setCity,
    interests, setInterests,
    constraintType, setConstraintType,
    constraintValue, setConstraintValue,
    isRoundtrip, setIsRoundtrip,
    onJourneyStart, onCityValidation,
    disambiguationOptions, onDisambiguationSelect, onDisambiguationCancel,
    language, setLanguage
}) => {
    // Local Suggestion State only
    const [suggestion, setSuggestion] = useState('');
    const [isAnimating, setIsAnimating] = useState(false);
    const [nearbyCities, setNearbyCities] = useState([]);
    const isMounted = React.useRef(true);

    // Mount cleanup
    React.useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    // Fetch Nearby Cities
    React.useEffect(() => {
        if (!navigator.geolocation) return;

        console.log("Requesting nearby cities...");
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            console.log("Got coords:", latitude, longitude);
            try {
                // Switching to Nominatim Reverse Geocoding as Overpass API is timing out
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                const data = await res.json();
                console.log("Nominatim data:", data);

                if (data && data.address) {
                    const addr = data.address;
                    // Get current location name
                    const currentCity = addr.city || addr.town || addr.village || addr.municipality;

                    if (currentCity) {
                        console.log("Setting nearby to current:", currentCity);
                        setNearbyCities([currentCity]);
                    }
                }
            } catch (err) {
                console.warn("Reverse geocode failed", err);
            }
        }, () => { }, { timeout: 5000 });
    }, []);

    // Auto-complete fetch
    React.useEffect(() => {
        const fetchSuggestion = async () => {
            if (!city || city.length < 2) {
                setSuggestion('');
                return;
            }
            try {
                // Fetch suggestion (limit 1)
                const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&addressdetails=1`, {
                    headers: { 'Accept-Language': language }
                });
                const data = await response.json();
                if (data && data.length > 0) {
                    // Check if matches prefix
                    let bestMatch = data[0].name || data[0].display_name.split(',')[0];

                    // Helper: match case-insensitive
                    if (bestMatch.toLowerCase().startsWith(city.toLowerCase()) && bestMatch.length > city.length) {
                        setSuggestion(bestMatch);
                    } else {
                        setSuggestion('');
                    }
                } else {
                    setSuggestion('');
                }
            } catch (e) {
                // ignore errors silently
            }
        };

        const timer = setTimeout(fetchSuggestion, 300);
        return () => clearTimeout(timer);
    }, [city, language]);

    const handleCityKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (suggestion) {
                setCity(suggestion);
                setSuggestion('');
                // Validate with the suggestion immediately
                onCityValidation && onCityValidation('blur', suggestion);
            } else {
                // Validate with current text
                onCityValidation && onCityValidation('blur');
            }
        } else if ((e.key === 'Tab' || e.key === 'ArrowRight') && suggestion) {
            e.preventDefault();
            setCity(suggestion);
            setSuggestion('');
        }
    };

    // Translations
    const t = {
        en: {
            title_p1: "Citytrip",
            title_p2: "Journey",
            subtitle: "Where do you want to go, and what do you want to do?",
            dest_label: "Destination",
            dest_ph: "E.g., Paris, Tokyo, New York",
            int_label: "Interests",
            int_ph: "What do you love? (e.g., Coffee, Architecture)",
            limit_label: "Journey Limit",
            switch_dur: "Switch to Duration",
            switch_dist: "Switch to Distance",
            walk_min: "approx. min walking",
            walk_km: "approx. km walking",
            rt_label: "Roundtrip (Loop)",
            start: "Start Exploring",
            disambig_title: "Which",
            back: "Back to Edit",
            pop: "Popular:",
            which: "Which"
        },
        nl: {
            title_p1: "Citytrip",
            title_p2: "Reis",
            subtitle: "Waar wil je heen, en wat wil je doen?",
            dest_label: "Bestemming",
            dest_ph: "Bijv. Amsterdam, Rome, Parijs",
            int_label: "Interesses",
            int_ph: "Waar hou je van? (bijv. Koffie, Architectuur)",
            limit_label: "Reis Limiet",
            switch_dur: "Wissel naar Tijd",
            switch_dist: "Wissel naar Afstand",
            walk_min: "ong. min lopen",
            walk_km: "ong. km lopen",
            rt_label: "Rondreis (Lus)",
            start: "Start Ontdekken",
            disambig_title: "Welke",
            back: "Terug naar Bewerken",
            pop: "Populair:",
            which: "Welke"
        }
    };

    const text = t[language || 'en'];

    const handleSubmit = async (e) => {
        setIsAnimating(true);
        try {
            await onJourneyStart(e);
        } catch (err) {
            console.error(err);
        } finally {
            if (isMounted.current) {
                setIsAnimating(false);
            }
        }
    };

    // Toggle handler
    const toggleConstraint = () => {
        if (constraintType === 'distance') {
            setConstraintType('duration');
            setConstraintValue(60); // Default 60 min
        } else {
            setConstraintType('distance');
            setConstraintValue(5); // Default 5 km
        }
    };

    if (disambiguationOptions && disambiguationOptions.length > 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900">
                <div className="relative z-10 w-full max-w-2xl px-6">
                    <h2 className="text-3xl font-bold text-white mb-6 text-center">{text.which} {city}?</h2>
                    <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
                        {disambiguationOptions.map((option, idx) => (
                            <button
                                key={idx}
                                onClick={() => onDisambiguationSelect(option)}
                                className="text-left bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur-md border border-white/10 rounded-xl p-4 transition-all hover:scale-[1.01] group"
                            >
                                <div className="font-bold text-white group-hover:text-primary transition-colors">
                                    {option.name || city}
                                </div>
                                <div className="text-sm text-slate-400">
                                    {option.display_name}
                                </div>
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={onDisambiguationCancel}
                        className="mt-6 w-full text-slate-500 hover:text-white text-sm"
                    >
                        {text.back}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm transition-opacity duration-1000 ${isAnimating ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            {/* Lang Toggle */}
            <div className="absolute top-6 right-6 z-50">
                <button
                    onClick={() => setLanguage(language === 'en' ? 'nl' : 'en')}
                    className="bg-white/10 hover:bg-white/20 p-3 rounded-full backdrop-blur-md transition-all border border-white/5 shadow-lg group"
                    title={language === 'en' ? "Switch to Dutch" : "Switch to English"}
                >
                    <img
                        src={language === 'en' ? "https://flagcdn.com/w40/nl.png" : "https://flagcdn.com/w40/gb.png"}
                        srcSet={language === 'en' ? "https://flagcdn.com/w80/nl.png 2x" : "https://flagcdn.com/w80/gb.png 2x"}
                        width="24"
                        height="18"
                        alt={language === 'en' ? "NL" : "EN"}
                        className="rounded-[2px] opacity-90 group-hover:opacity-100 transition-opacity shadow-sm object-cover"
                    />
                </button>
            </div>

            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-900/30 to-slate-900"></div>
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <div className="relative z-10 w-full max-w-2xl px-6">
                <div className="text-center mb-10">
                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">
                        {text.title_p1} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">{text.title_p2}</span>
                    </h1>
                    <p className="text-xl text-slate-400 font-light">
                        {text.subtitle}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto space-y-6">

                    {/* City Input */}
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-4">{text.dest_label}</label>
                        <div className="relative bg-slate-800/80 backdrop-blur-xl border border-white/10 rounded-2xl p-1 flex items-center shadow-lg focus-within:ring-2 ring-primary/50 transition-all">

                            {/* Ghost Text Overlay */}
                            <div className="absolute inset-0 px-4 py-3 text-lg flex items-center pointer-events-none overflow-hidden">
                                <span className="text-transparent">{city}</span>
                                {suggestion && suggestion.toLowerCase().startsWith(city.toLowerCase()) && (
                                    <span className="text-slate-500 opacity-60">
                                        {suggestion.slice(city.length)}
                                    </span>
                                )}
                            </div>

                            <input
                                type="text"
                                value={city}
                                onChange={(e) => {
                                    setCity(e.target.value);
                                    if (!e.target.value) setSuggestion('');
                                }}
                                onKeyDown={handleCityKeyDown}
                                onBlur={() => onCityValidation && onCityValidation('blur')}
                                placeholder={text.dest_ph}
                                className="relative z-10 w-full bg-transparent border-none text-white text-lg px-4 py-3 focus:outline-none placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    {/* Interests Input */}
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold ml-4">{text.int_label}</label>
                        <div className="bg-slate-800/80 backdrop-blur-xl border border-white/10 rounded-2xl p-1 flex items-center shadow-lg focus-within:ring-2 ring-accent/50 transition-all">
                            <input
                                type="text"
                                value={interests}
                                onChange={(e) => setInterests(e.target.value)}
                                placeholder={text.int_ph}
                                className="w-full bg-transparent border-none text-white text-lg px-4 py-3 focus:outline-none placeholder:text-slate-600"
                            />
                        </div>
                    </div>

                    {/* Constraints Input */}
                    <div className="bg-slate-800/60 backdrop-blur-md rounded-2xl p-4 border border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{text.limit_label}</label>
                            <button
                                type="button"
                                onClick={toggleConstraint}
                                className="text-xs font-bold text-primary hover:text-white transition-colors bg-white/5 px-2 py-1 rounded-lg"
                            >
                                {constraintType === 'distance' ? text.switch_dur : text.switch_dist}
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-2xl font-bold text-white w-24 text-right">
                                {constraintValue} <span className="text-sm text-slate-400 font-normal">{constraintType === 'distance' ? 'km' : 'min'}</span>
                            </span>
                            <input
                                type="range"
                                min={constraintType === 'distance' ? 1 : 15}
                                max={constraintType === 'distance' ? 20 : 240}
                                step={constraintType === 'distance' ? 0.5 : 15}
                                value={constraintValue}
                                onChange={(e) => setConstraintValue(Number(e.target.value))}
                                className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-primary-hover"
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-2 text-center">
                            {constraintType === 'distance'
                                ? `${Math.round(constraintValue * 12)} ${text.walk_min}`
                                : `${(constraintValue / 60 * 5).toFixed(1)} ${text.walk_km}`}
                        </p>

                        {/* Roundtrip Checkbox */}
                        <div className="mt-4 flex items-center justify-center">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isRoundtrip ? 'bg-primary border-primary' : 'border-slate-500 group-hover:border-primary'}`}>
                                    {isRoundtrip && (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={isRoundtrip}
                                    onChange={(e) => setIsRoundtrip(e.target.checked)}
                                />
                                <span className={`text-sm font-medium transition-colors ${isRoundtrip ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                                    {text.rt_label}
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={!city.trim() || !interests.trim()}
                            className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary-hover hover:to-accent-hover text-white rounded-2xl p-4 font-bold text-lg transition-all transform hover:scale-[1.02] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {text.start}
                        </button>
                    </div>

                    <div className="mt-8 flex justify-center gap-4 text-sm text-slate-500 flex-wrap">
                        <span>{nearbyCities.length > 0 ? (language === 'nl' ? 'In de buurt:' : 'Nearby:') : text.pop}</span>
                        {(nearbyCities.length > 0 ? nearbyCities : ['London', 'New York', 'Paris', 'Tokyo', 'Amsterdam']).map(c => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setCity(c)}
                                className="hover:text-white transition-colors cursor-pointer"
                            >
                                {c}
                            </button>
                        ))}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default JourneyInput;
