let authToken = null;

// Initialize from localStorage if available (for page refreshes)
const storedToken = localStorage.getItem('city_explorer_token');
if (storedToken) authToken = storedToken;

export const setAuthToken = (token) => {
    authToken = token;
    if (token) {
        localStorage.setItem('city_explorer_token', token);
    } else {
        localStorage.removeItem('city_explorer_token');
    }
};

export const getAuthToken = () => authToken;
export const clearAuthToken = () => {
    authToken = null;
    localStorage.removeItem('city_explorer_token');
};
