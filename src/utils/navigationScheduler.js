/**
 * Advanced Navigation Scheduler for Walking & Cycling
 * Handles speed-aware voice guidance using Time-To-Maneuver (TTM) windows.
 */

// Thresholds for alerts based on mode
const WALK = {
    TTM: { early: [10, 16], prepare: [5, 8], now: 2.0 },      // seconds
    DIST: { early: 90, prepare: 40, now: 12 }                // meters
};

const BIKE = {
    TTM: { early: [18, 28], prepare: [8, 12], now: 3.0 },
    DIST: { early: 180, prepare: 90, now: 25 }
};

/**
 * Returns thresholds for specific travel modes.
 */
function getThresholds(mode) {
    return mode === 'cycling' ? BIKE : WALK;
}

/**
 * Calculates Time-To-Maneuver in seconds.
 * Uses a 0.6 m/s floor to prevent division by zero or extremely long durations.
 */
function calcTTM(distanceM, speedMS) {
    return distanceM / Math.max(speedMS, 0.6);
}

/**
 * Converts maneuver modifiers to natural speech words.
 * Support different moods: 'base' (Now/Early) and 'inf' (Prepare).
 */
function getTurnWord(modifier, lang = 'en', mood = 'base', type = 'turn', exit = undefined) {
    const mod = (modifier || '').toLowerCase().replace('_', ' ');

    if (lang === 'nl') {
        if (type === 'roundabout' || type === 'rotary') {
            if (exit) {
                // "Neem de 2e afslag"
                return `neem de ${exit}e afslag op de rotonde`;
            }
            return 'neem de rotonde';
        }
        if (type === 'arrive') {
            return 'je hebt je bestemming bereikt';
        }

        if (mod.includes('right')) {
            return mood === 'inf' ? 'rechtsaf te slaan' : 'rechtsaf';
        }
        if (mod.includes('left')) {
            return mood === 'inf' ? 'linksaf te slaan' : 'linksaf';
        }
        if (mod === 'straight') {
            return mood === 'inf' ? 'rechtdoor te blijven gaan' : 'rechtdoor blijven gaan';
        }
        if (mod === 'uturn') {
            return 'om te keren';
        }
        return mood === 'inf' ? 'af te slaan' : 'sla af';
    }

    // Default English
    if (type === 'roundabout' || type === 'rotary') {
        if (exit) return `take the ${exit === 1 ? '1st' : (exit === 2 ? '2nd' : (exit === 3 ? '3rd' : `${exit}th`))} exit at the roundabout`;
        return 'enter the roundabout';
    }
    if (type === 'arrive') return 'you have arrived at your destination';

    if (!modifier) return 'turn';
    switch (mod) {
        case 'right':
        case 'slight right':
        case 'sharp right':
            return 'right';
        case 'left':
        case 'slight left':
        case 'sharp left':
            return 'left';
        case 'straight':
            return 'continue straight';
        case 'uturn':
            return 'make a U-turn';
        default:
            return 'turn';
    }
}

/**
 * Generates the "Now" instruction line, with look-ahead support.
 */
const getNowLine = (modifier, way, next, lang = 'en', type = 'turn', exit = undefined) => {
    if (lang === 'nl') {
        if (type === 'arrive') return "Je hebt je bestemming bereikt.";

        if (type === 'roundabout' || type === 'rotary') {
            return exit ? `Neem nu de ${exit}e afslag op de rotonde.` : `Rijd nu de rotonde op.`;
        }

        const mod = (modifier || '').toLowerCase().replace('_', ' ');
        let action = 'Sla';
        let direction = '';

        if (mod.includes('right')) direction = 'rechtsaf';
        else if (mod.includes('left')) direction = 'linksaf';
        else if (mod === 'straight') { action = 'Ga'; direction = 'rechtdoor'; }
        else if (mod === 'uturn') { action = 'Keer'; direction = 'om'; }
        else direction = 'af';

        let text = way ? `${action} nu ${direction} naar ${way}.` : `${action} nu ${direction}.`;

        // Add "Next" instruction if available
        if (next) {
            text += ` Daarna ${getTurnWord(next.modifier, lang, 'base', next.type, next.exit)}${next.name ? ` naar ${next.name}` : ''}.`;
        }
        return text;
    }

    if (type === 'arrive') return "You have arrived at your destination.";
    if (type === 'roundabout' || type === 'rotary') {
        return exit ? `Now, take the ${exit} exit at the roundabout.` : `Now, enter the roundabout.`;
    }

    const turn = getTurnWord(modifier, lang, 'base', type, exit);
    let text = way ? `Now, ${turn} on ${way}.` : `Now, ${turn}.`;
    if (next) {
        text += ` Then ${getTurnWord(next.modifier, lang, 'base', next.type, next.exit)}${next.name ? ` on ${next.name}` : ''}.`;
    }
    return text;
};

/**
 * Formats distance for speech, using km for >1000m.
 */
function formatDistance(meters, lang = 'en') {
    if (meters < 1000) {
        return lang === 'nl' ? `${meters} meter` : `${meters} meters`;
    }
    const km = (meters / 1000).toFixed(1).replace('.', lang === 'nl' ? ',' : '.');
    return lang === 'nl' ? `${km} kilometer` : `${km} kilometers`;
}

/**
 * Core Scheduler Logic: Determines if a voice prompt should trigger.
 */
export async function maybeSpeakStep({
    mode,
    distanceM,
    speedMS,
    modifier,
    way,
    next,
    state,
    id,
    speakFn,
    lang = 'en',
    type = 'turn',
    exit = undefined
}) {
    const S = getThresholds(mode);

    // Safety check for invalid/infinite distances
    if (!Number.isFinite(distanceM) || distanceM < 0) return;

    const T = calcTTM(distanceM, speedMS);
    const flags = state[id] || {};

    // 1. EARLY Prompt
    if (!flags.e && ((T >= S.TTM.early[0] && T <= S.TTM.early[1]) || distanceM >= S.DIST.early)) {
        const dist = Math.round(Math.max(distanceM, S.DIST.prepare));
        const formattedDist = formatDistance(dist, lang);
        const turn = getTurnWord(modifier, lang, 'base', type, exit);
        let text;
        if (lang === 'nl') {
            text = `${formattedDist.charAt(0).toUpperCase() + formattedDist.slice(1)}, ${turn}${way ? ` naar ${way}` : ''}.`;
        } else {
            text = `In ${formattedDist}, ${turn}${way ? ` on ${way}` : ''}.`;
        }
        await speakFn(text);
        state[id] = { ...flags, e: true };
        return;
    }

    // 2. PREPARE Prompt
    if (!flags.p && ((T >= S.TTM.prepare[0] && T <= S.TTM.prepare[1]) || distanceM <= S.DIST.prepare)) {
        if (distanceM > S.DIST.now) { // Don't "prepare" if we're already at "now" distance
            const turn = getTurnWord(modifier, lang, 'inf', type, exit);
            let text;
            if (lang === 'nl') {
                if (type === 'roundabout' || type === 'rotary') {
                    text = `Bereid je voor om de rotonde te nemen.`;
                } else if (type === 'arrive') {
                    text = `Je nadert je bestemming.`;
                } else {
                    text = `Bereid je voor om ${turn}${way ? ` naar ${way}` : ''}.`;
                }
            } else {
                if (type === 'arrive') {
                    text = `You are arriving at your destination.`;
                } else {
                    text = `Prepare to ${turn}${way ? ` on ${way}` : ''}.`;
                }
            }
            await speakFn(text);
            state[id] = { ...flags, p: true };
            return;
        }
    }

    // 3. NOW Prompt
    if (!flags.n && (T <= S.TTM.now || distanceM <= S.DIST.now)) {
        const text = getNowLine(modifier, way, next, lang, type, exit);
        await speakFn(text);
        state[id] = { ...flags, n: true };
        return;
    }
}

/**
 * Resets the voice tracking state.
 */
export function resetVoiceState(state) {
    Object.keys(state).forEach(k => delete state[k]);
}
