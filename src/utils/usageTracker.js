/**
 * API Usage Tracker
 * Stores daily hit counts for paid APIs in localStorage.
 */

const STORAGE_KEY = 'app_api_usage_stats';

/**
 * Logs an API call for the current day.
 * @param {string} apiName - Name of the API (e.g., 'gemini', 'google-search')
 */
export const logApiCall = (apiName) => {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const stats = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

        if (!stats[today]) {
            stats[today] = {};
        }

        stats[today][apiName] = (stats[today][apiName] || 0) + 1;

        // Keep only last 30 days to prevent localStorage bloat
        const dates = Object.keys(stats).sort().reverse();
        const prunedStats = {};
        dates.slice(0, 30).forEach(date => {
            prunedStats[date] = stats[date];
        });

        localStorage.setItem(STORAGE_KEY, JSON.stringify(prunedStats));
    } catch (e) {
        console.warn("[UsageTracker] Failed to log API call:", e);
    }
};

/**
 * Returns usage stats for the last N days.
 */
export const getApiUsageStats = (days = 7) => {
    try {
        const stats = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const dates = Object.keys(stats).sort().reverse().slice(0, days);
        const result = {};
        dates.forEach(date => {
            result[date] = stats[date];
        });
        return result;
    } catch (e) {
        return {};
    }
};

/**
 * Resets all usage statistics.
 */
export const clearApiUsageStats = () => {
    localStorage.removeItem(STORAGE_KEY);
};
