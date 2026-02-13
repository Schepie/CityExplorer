
import { validateUser } from './utils/auth.js';

export const handler = async (event, context) => {
    // Auth Check
    const auth = validateUser(event);
    if (auth.error) {
        return { statusCode: auth.status, body: JSON.stringify({ error: auth.error }) };
    }

    const { query, ll, radius, limit, locale } = event.queryStringParameters;
    const FOURSQUARE_KEY = process.env.FOURSQUARE_KEY || process.env.VITE_FOURSQUARE_KEY;

    if (!FOURSQUARE_KEY) {
        console.error("Foursquare Configuration Error: Missing FOURSQUARE_KEY in environment.");
        console.log("Environment Keys available:", Object.keys(process.env).filter(k => k.startsWith('VITE_') || k.includes('KEY')));
        return { statusCode: 500, body: JSON.stringify({ error: 'Configuration Error: Missing API Key' }) };
    }

    const url = `https://places-api.foursquare.com/places/search?query=${encodeURIComponent(query)}&ll=${ll}&radius=${radius}&limit=${limit}&locale=${locale || 'en'}`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${FOURSQUARE_KEY}`,
                'Accept': 'application/json',
                'X-Places-Api-Version': '2025-06-17'
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
