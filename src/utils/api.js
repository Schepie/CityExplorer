import { getAuthToken } from './authStore.js';

/**
 * Authenticated Fetch Wrapper
 * Automatically adds the Authorization header if a token exists.
 * Handles 401 Unauthorized errors by clearing the token (optional—can be handled by UI).
 */
export const apiFetch = async (url, options = {}) => {
    const token = getAuthToken();
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        console.error("API Error: 401 Unauthorized. Clearing token.");
    }

    if (response.status === 403) {
        console.warn("API Error: 403 Forbidden. User may be blocked.");
        window.dispatchEvent(new CustomEvent('city-explorer-auth-blocked'));
    }

    return response;
};
