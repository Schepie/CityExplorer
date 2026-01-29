import { validateUser } from './utils/auth.js';

export const handler = async (event) => {
    // 1. Check Auth (JWT Validation + Blocklist check)
    const auth = validateUser(event);
    if (auth.error) {
        return {
            statusCode: auth.status,
            body: JSON.stringify({ error: auth.error })
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ valid: true, user: auth.user })
    };
};
