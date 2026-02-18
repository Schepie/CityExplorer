/**
 * Utility for selecting the best available voice based on language and gender.
 * 
 * @param {SpeechSynthesisVoice[]} availableVoices - List of voices from window.speechSynthesis.getVoices()
 * @param {string} targetLang - Target locale (e.g., 'nl-NL', 'en-US', 'nl-BE')
 * @param {'male'|'female'} targetGender - Desired gender preference
 * @returns {SpeechSynthesisVoice|null} The best matching voice or null if none found
 */
export const getBestVoice = (availableVoices, targetLang, targetGender) => {
    if (!availableVoices || availableVoices.length === 0) return null;

    // Helper to find gender match in a list of voices
    const findGenderMatch = (voices) => {
        if (!voices || voices.length === 0) return null;

        const filtered = voices.filter(v => {
            const n = v.name.toLowerCase();
            // Heuristic names for gender identification
            const maleNames = ['male', 'man', 'xander', 'bart', 'arthur', 'david', 'frank', 'maarten', 'mark', 'stefan', 'rob', 'paul', 'daniel', 'george', 'james', 'mark', 'oliver', 'jack', 'harry', 'noah', 'william'];
            const femaleNames = ['female', 'woman', 'lady', 'ellen', 'claire', 'laura', 'google', 'zira', 'eva', 'katja', 'fenna', 'samantha', 'tessa', 'karen', 'fiona', 'moira', 'saskia', 'hazel', 'susan', 'heidi', 'elke', 'colette', 'zira', 'sophie', 'emma', 'olivia', 'mia', 'isabella'];

            if (targetGender === 'female' && n.includes('male')) return false;
            if (targetGender === 'male' && n.includes('female')) return false;

            if (targetGender === 'male') return maleNames.some(name => n.includes(name));
            if (targetGender === 'female') return femaleNames.some(name => n.includes(name));
            return true; // Fallback if no specific gender markers found but we need a voice
        });

        // Priority: 1. Google Voices (usually high quality), 2. Local voices, 3. Anything else
        return filtered.find(v => v.name.includes('Google')) ||
            filtered.find(v => v.localService) ||
            filtered[0];
    };

    // Strategy 1: Exact Locale Match (e.g. nl-NL)
    let relevantVoices = availableVoices.filter(v => v.lang.toLowerCase() === targetLang.toLowerCase());
    let selectedVoice = findGenderMatch(relevantVoices);

    // Strategy 2: Broad Language Match (e.g. any 'nl') if no gender match found yet
    if (!selectedVoice) {
        const shortLang = targetLang.split('-')[0].toLowerCase();
        const broadVoices = availableVoices.filter(v => v.lang.toLowerCase().startsWith(shortLang));
        selectedVoice = findGenderMatch(broadVoices);
    }

    // Strategy 3: Fallback to first available voice of target language (ignore gender)
    if (!selectedVoice) {
        relevantVoices = availableVoices.filter(v => v.lang.toLowerCase().includes(targetLang.toLowerCase()));
        if (relevantVoices.length === 0) {
            const shortLang = targetLang.split('-')[0].toLowerCase();
            relevantVoices = availableVoices.filter(v => v.lang.toLowerCase().startsWith(shortLang));
        }
        selectedVoice = relevantVoices[0];
    }

    return selectedVoice;
};
