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

        // 2. Verify Access Code
        const MASTER_CODE = '888888'; // Hardcoded Backdoor
        let isAdmin = false;

        if (code === MASTER_CODE) {
            console.log(`Master code used for ${email}`);
            isAdmin = true;
        } else {
            // Normal User Flow
            if (isEmailBlocked(email)) {
                console.warn(`Code verification denied for blocked user: ${email}`);
                return { statusCode: 403, body: JSON.stringify({ error: "Access Revoked" }) };
            }

            const isValid = verifyAccessCode(email, code);
            if (!isValid) {
                return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired access code" }) };
            }
        }

        // 3. Issue Session Token
        // Use isAdmin flag to set role
        const SECRET = process.env.JWT_SECRET; // Need to import or re-use logic from auth.js if generateSessionToken doesn't support custom roles easily.
        // Actually generateSessionToken hardcodes 'user'. Let's modify it or just sign here manually for admin/user distinction to keep it clean?
        // Better: let's modifying generateSessionToken in utils/auth.js might be cleaner, but for now I can just use jwt.sign here if I import jwt, 
        // OR I can update utils/auth.js to accept a role param.

        // Let's rely on importing jwt here as well or updating utils.
        // `generateSessionToken` is imported. Let's look at `utils/auth.js` again. 
        // It's: export const generateSessionToken = (email) => { ... jwt.sign({ email, role: 'user' }, ... }

        // I should update `generateSessionToken` in `utils/auth.js` to accept a role first.
        // But since I'm in this file editing, I will stick to the plan of editing `utils/auth.js` momentarily to allow role param? 
        // No, I'll just do it in the file if `jwt` is available? 
        // `auth-verify-code.js` imports from `./utils/auth.js`. It does NOT import jwt.

        // REVISION: I need to update `generateSessionToken` in `utils/auth.js` to accept a role parameter.
        // I will do that in the NEXT tool call or re-do the `utils/auth.js` edit. 
        // For now, I'll assum I will update `generateSessionToken` to take a role.

        // Wait, I can't assume that. I need to make sure `generateSessionToken` supports it.
        // I will update `generateSessionToken` in `utils/auth.js` FIRST, then come back here.
        // So I will FAIL this tool call intentionally or just not include the token generation part yet?
        // Actually, I can use a separate ReplaceFileContent for `generateSessionToken` in the same turn.

        // Let's proceed with valid code assuming I update auth.js in the same turn.
        const sessionToken = generateSessionToken(email, isAdmin ? 'admin' : 'user');

        return {
            statusCode: 200,
            body: JSON.stringify({
                token: sessionToken,
                user: { email, role: isAdmin ? 'admin' : 'user' }
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
