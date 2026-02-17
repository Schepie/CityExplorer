let authToken = 'guest-token';

export const setAuthToken = (token) => {
    authToken = token || 'guest-token';
};

export const getAuthToken = () => authToken;

export const clearAuthToken = () => {
    authToken = 'guest-token';
};
