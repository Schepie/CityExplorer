import React, { createContext, useContext, useState, useEffect } from 'react';
import { setAuthToken, clearAuthToken } from '../utils/authStore.js';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    // Auth disabled: always return a guest user
    const [user] = useState({ id: 'guest', email: 'guest@cityexplorer.app', name: 'Guest', role: 'admin' });
    const [sessionToken] = useState('guest-token');
    const [isLoading] = useState(false);
    const [isBlocked] = useState(false);

    useEffect(() => {
        // Ensure the authStore has the guest token
        setAuthToken('guest-token');
    }, []);

    const login = () => {
        console.warn("Auth: login is disabled.");
    };

    const logout = () => {
        console.warn("Auth: logout is disabled.");
    };

    const requestMagicLink = async () => true;
    const verifyMagicLink = async () => true;
    const verifyAccessCode = async () => true;

    const authFetch = async (url, options = {}) => {
        const headers = {
            ...options.headers,
            'Authorization': `Bearer guest-token`,
            'Content-Type': 'application/json'
        };
        return fetch(url, { ...options, headers });
    };

    return (
        <AuthContext.Provider value={{
            user,
            sessionToken,
            isLoading,
            isBlocked,
            login,
            logout,
            requestMagicLink,
            verifyMagicLink,
            verifyAccessCode,
            authFetch
        }}>
            {children}
        </AuthContext.Provider>
    );
};
