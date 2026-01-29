
import { validateUser } from './utils/auth.js';

export const handler = async (event, context) => {
    // Auth Check
    const auth = validateUser(event);
    if (auth.error) {
        return { statusCode: auth.status, body: JSON.stringify({ error: auth.error }) };
    }

    const { query, ll, radius, limit } = event.queryStringParameters;
    const FOURSQUARE_KEY = process.env.FOURSQUARE_KEY || process.env.VITE_FOURSQUARE_KEY;

    if (!FOURSQUARE_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Configuration Error' }) };
    }

    const url = `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&ll=${ll}&radius=${radius}&limit=${limit}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': FOURSQUARE_KEY,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Foursquare API Error: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error("Foursquare Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
