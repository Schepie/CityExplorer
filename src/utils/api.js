import { getAuthToken } from './authStore.js';
import { logApiCall } from './usageTracker.js';

/**
 * Authenticated Fetch Wrapper
 * Simplified for guest-only access.
 */
export const apiFetch = async (url, options = {}) => {
    // Log usage for paid APIs
    if (url.includes('/api/gemini')) logApiCall('Gemini AI');
    if (url.includes('/api/google-search')) logApiCall('Google Search');
    if (url.includes('/api/tavily')) logApiCall('Tavily Search');
    if (url.includes('/api/foursquare')) logApiCall('Foursquare');
    if (url.includes('maps.googleapis.com')) logApiCall('Google Places');

    // We still send a token (e.g. 'guest-token') to satisfy middleware if it expects one
    const token = getAuthToken() || 'guest-token';
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    // 401/403 are no longer handled by logging out, as there is no session.
    if (response.status === 401) {
        console.error("API Error: 401 Unauthorized.");
    }

    if (response.status === 403) {
        console.warn("API Error: 403 Forbidden.");
    }

    return response;
};
