import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// 1. Secret Getters (Dynamic to handle ESM hoisting/initialization issues)
const getJwtSecret = () => process.env.JWT_SECRET;
const getMagicSecret = () => process.env.MAGIC_LINK_SECRET;

/**
 * Generates a stateless 6-digit access code for an email.
 * The code is deterministic based on email, secret, and current hour.
 * This allows a 1-2 hour window for validation without a database.
 */
export const generateAccessCode = (email, offsetHours = 0) => {
    const SECRET = getMagicSecret();
    if (!SECRET) return null;

    const date = new Date();
    if (offsetHours !== 0) date.setHours(date.getHours() + offsetHours);

    // Create a time-based bucket (e.g., "user@gmail.com-SECRET-2024-01-29-12")
    const timeBucket = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCHours()}`;
    const seed = `${email.toLowerCase()}-${SECRET}-${timeBucket}`;

    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    // Map the hash to 6 digits
    return (parseInt(hash.substring(0, 8), 16) % 1000000).toString().padStart(6, '0');
};

/**
 * Verifies if the provided code matches the current or previous hour's code.
 */
export const verifyAccessCode = (email, code) => {
    if (!email || !code) return false;

    // Check current hour and previous hour (to handle window overlaps)
    const codeNow = generateAccessCode(email, 0);
    const codeThen = generateAccessCode(email, -1);

    return code === codeNow || code === codeThen;
};

// 2. Constants
const TOKEN_EXPIRY = '7d';
const MAGIC_LINK_EXPIRY = '15m';

// 3. Helpers
export const isEmailBlocked = (email) => {
    if (!email) return false;
    const blockedString = process.env.BLOCKED_EMAILS || '';
    if (!blockedString.trim()) return false;

    // Split by comma, trim whitespace, convert to lowercase, and remove empty entries
    const blockedList = blockedString
        .split(',')
        .map(e => e.trim().toLowerCase())
        .filter(e => e !== '');

    return blockedList.includes(email.toLowerCase());
};

// 4. Validation Middleware / Helper
export const validateUser = (event) => {
    // Auth disabled: Always return a guest user
    return {
        user: {
            email: 'guest@cityexplorer.app',
            role: 'admin', // Give admin role to bypass any other checks
            id: 'guest'
        },
        status: 200
    };

    /* Original validation logic bypassed
    const JWT_SECRET = getJwtSecret();
    ...
    */
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

export const generateSessionToken = (email, role = 'user') => {
    const SECRET = getJwtSecret();
    if (!SECRET) throw new Error("Missing JWT_SECRET");
    return jwt.sign({ email, role }, SECRET, { expiresIn: TOKEN_EXPIRY });
};
