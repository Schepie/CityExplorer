import { getAuthToken } from './authStore.js';

/**
 * Authenticated Fetch Wrapper
 * Simplified for guest-only access.
 */
export const apiFetch = async (url, options = {}) => {
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
