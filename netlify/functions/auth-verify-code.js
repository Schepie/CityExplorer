import { verifyAccessCode, generateSessionToken, isEmailBlocked } from './utils/auth.js';

export const handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { email, code } = JSON.parse(event.body);

        if (!email || !code) {
            return { statusCode: 400, body: JSON.stringify({ error: "Email and code are required" }) };
        }

        // 1. Revocation Check
        if (isEmailBlocked(email)) {
            console.warn(`Code verification denied for blocked user: ${email}`);
            return { statusCode: 403, body: JSON.stringify({ error: "Access Revoked" }) };
        }

        // 2. Verify Access Code
        const isValid = verifyAccessCode(email, code);

        if (!isValid) {
            return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired access code" }) };
        }

        // 3. Issue Session Token
        const sessionToken = generateSessionToken(email);

        return {
            statusCode: 200,
            body: JSON.stringify({
                token: sessionToken,
                user: { email }
            })
        };

    } catch (error) {
        console.error("Auth Verify Code Failed:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Verification failed" })
        };
    }
};
