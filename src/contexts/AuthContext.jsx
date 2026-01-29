import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [sessionToken, setSessionToken] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isBlocked, setIsBlocked] = useState(false);

    useEffect(() => {
        // 1. Check LocalStorage on mount
        const storedToken = localStorage.getItem('city_explorer_token');
        const storedUser = localStorage.getItem('city_explorer_user');

        if (storedToken) {
            setSessionToken(storedToken);
            if (storedUser) setUser(JSON.parse(storedUser));
        }
        setIsLoading(false);
    }, []);

    const login = (token, userData) => {
        localStorage.setItem('city_explorer_token', token);
        localStorage.setItem('city_explorer_user', JSON.stringify(userData));
        setSessionToken(token);
        setUser(userData);
        setIsBlocked(false);
    };

    const logout = () => {
        localStorage.removeItem('city_explorer_token');
        localStorage.removeItem('city_explorer_user');
        setSessionToken(null);
        setUser(null);
        setIsBlocked(false);
        window.location.href = '/'; // Hard reset
    };

    // 2. Request Magic Link
    const requestMagicLink = async (email) => {
        try {
            const res = await fetch('/api/auth-request-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (res.status === 403) {
                setIsBlocked(true);
                return 'blocked';
            }

            if (!res.ok) throw new Error('Failed to send link');
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    // 3. Verify Magic Link
    const verifyMagicLink = async (token) => {
        try {
            const res = await fetch('/api/auth-verify-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            });
            const data = await res.json();

            if (res.status === 403) {
                setIsBlocked(true);
                return 'blocked';
            }

            if (!res.ok) throw new Error(data.error || 'Verification failed');

            login(data.token, data.user);
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    };

    // 4. AUTHENTICATED FETCH
    // Wrapper for fetch that auto-injects the token
    const authFetch = async (url, options = {}) => {
        const headers = options.headers || {};
        if (sessionToken) {
            headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const config = { ...options, headers };
        const res = await fetch(url, config);

        // Auto-logout on 401
        if (res.status === 401) {
            console.warn("Unauthorized! Logging out...");
            logout();
            throw new Error("Session expired. Please log in again.");
        }

        // Handle Blocked (403)
        if (res.status === 403) {
            console.warn("Access Revoked! Blocking UI...");
            setIsBlocked(true);
            throw new Error("Your account has been locked. Please contact geert.schepers@gmail.com");
        }

        return res;
    };

    return (
        <AuthContext.Provider value={{ user, sessionToken, isLoading, isBlocked, login, logout, requestMagicLink, verifyMagicLink, authFetch }}>
            {children}
        </AuthContext.Provider>
    );
};
