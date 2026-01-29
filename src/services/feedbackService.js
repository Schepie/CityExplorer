import { apiFetch } from '../utils/api.js';

/* Feedback service for POI thumbs up/down */

/**
 * Save feedback for a POI in localStorage.
 * @param {string} poiId - Unique identifier of the POI.
 * @param {'up'|'down'} vote - Vote type.
 */
export function saveFeedback(poiId, vote) {
    if (!poiId) return;
    const key = `poi-feedback-${poiId}`;
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    const updated = { ...existing, [vote]: (existing[vote] || 0) + 1 };
    localStorage.setItem(key, JSON.stringify(updated));
}

/**
 * Retrieve feedback counts for a POI.
 * @param {string} poiId
 * @returns {{up:number, down:number}}
 */
export function getFeedback(poiId) {
    if (!poiId) return { up: 0, down: 0 };
    const key = `poi-feedback-${poiId}`;
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    return { up: data.up || 0, down: data.down || 0 };
}

/**
 * Send feedback to a backend endpoint (placeholder).
 * This function is async and will silently ignore errors.
 */
export async function postFeedback(poiId, vote) {
    try {
        await apiFetch('/api/feedback', {
            method: 'POST',
            body: JSON.stringify({ poiId, vote })
        });
    } catch (e) {
        // ignore – backend may not exist yet
        console.warn('Feedback post failed', e);
    }
}

/**
 * Public helper to record feedback both locally and optionally remotely.
 */
export function recordFeedback(poiId, vote) {
    saveFeedback(poiId, vote);
    // fire-and-forget remote post
    postFeedback(poiId, vote);
}
