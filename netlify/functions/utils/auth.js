import jwt from 'jsonwebtoken';

// 1. Secret Getters (Dynamic to handle ESM hoisting/initialization issues)
const getJwtSecret = () => process.env.JWT_SECRET;
const getMagicSecret = () => process.env.MAGIC_LINK_SECRET;

// 2. Constants
const TOKEN_EXPIRY = '2h';
const MAGIC_LINK_EXPIRY = '15m';

// 3. Helpers
export const isEmailBlocked = (email) => {
    if (!email) return false;
    const blockedString = process.env.BLOCKED_EMAILS || '';
    const blockedList = blockedString.split(',').map(e => e.trim().toLowerCase());
    return blockedList.includes(email.toLowerCase());
};

// 4. Validation Middleware / Helper
export const validateUser = (event) => {
    const JWT_SECRET = getJwtSecret();
    if (!JWT_SECRET) {
        console.error("Missing JWT_SECRET in environment variables.");
        return { error: "Server Configuration Error", status: 500 };
    }

    // Support both Netlify (headers object) and Express (header() method or lowercase)
    const getHeader = (name) => {
        if (event.headers && typeof event.headers[name] === 'string') return event.headers[name];
        if (event.header && typeof event.header === 'function') return event.header(name);
        return null;
    };

    const authHeader = getHeader('authorization') || getHeader('Authorization');

    if (!authHeader) {
        return { error: "Missing Authorization Header", status: 401 };
    }

    if (!authHeader.startsWith('Bearer ')) {
        return { error: "Invalid Authorization Format (Bearer <token>)", status: 401 };
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Revocation Check
        if (isEmailBlocked(decoded.email)) {
            console.warn(`Access denied for blocked user: ${decoded.email}`);
            return { error: "Access Revoked", status: 403 };
        }

        return { user: decoded, status: 200 };
    } catch (err) {
        console.warn("Invalid Token:", err.message);
        return { error: "Invalid or Expired Token", status: 401 };
    }
};

// 5. Token Generation
export const generateMagicToken = (email) => {
    const SECRET = getMagicSecret();
    if (!SECRET) throw new Error("Missing MAGIC_LINK_SECRET");
    return jwt.sign({ email, type: 'magic_link' }, SECRET, { expiresIn: MAGIC_LINK_EXPIRY });
};

export const verifyMagicToken = (token) => {
    const SECRET = getMagicSecret();
    if (!SECRET) return null;
    try {
        const decoded = jwt.verify(token, SECRET);
        if (decoded.type !== 'magic_link') throw new Error("Invalid Token Type");

        // Revocation Check (Prevent login if blocked)
        if (isEmailBlocked(decoded.email)) {
            console.warn(`Login attempt denied for blocked user: ${decoded.email}`);
            return null; // Treat as invalid token to prevent login
        }

        return decoded;
    } catch (err) {
        return null;
    }
};

export const generateSessionToken = (email) => {
    const SECRET = getJwtSecret();
    if (!SECRET) throw new Error("Missing JWT_SECRET");
    return jwt.sign({ email, role: 'user' }, SECRET, { expiresIn: TOKEN_EXPIRY });
};
