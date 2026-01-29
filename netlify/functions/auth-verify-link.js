import jwt from 'jsonwebtoken';
import { verifyMagicToken, generateSessionToken, isEmailBlocked } from './utils/auth.js';

export const handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { token } = JSON.parse(event.body);

        if (!token) {
            return { statusCode: 400, body: JSON.stringify({ error: "Token is required" }) };
        }

        // 1. Verify Magic Token
        const decoded = verifyMagicToken(token);

        if (!decoded) {
            // Check if it was blocked or actually invalid
            const rawDecoded = jwt.decode(token);
            if (rawDecoded && rawDecoded.email && isEmailBlocked(rawDecoded.email)) {
                return {
                    statusCode: 403,
                    body: JSON.stringify({ error: "Access Revoked" })
                };
            }
            return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired link" }) };
        }

        // 2. Issue Session Token
        const sessionToken = generateSessionToken(decoded.email);

        return {
            statusCode: 200,
            body: JSON.stringify({
                token: sessionToken,
                user: { email: decoded.email }
            })
        };

    } catch (error) {
        console.error("Auth Verify Failed:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Verification failed" })
        };
    }
};
