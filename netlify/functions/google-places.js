
import { validateUser } from './utils/auth.js';

export const handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // Auth Check
    const auth = validateUser(event);
    if (auth.error) {
        return { statusCode: auth.status, body: JSON.stringify({ error: auth.error }) };
    }

    const { textQuery, center, radius } = JSON.parse(event.body);
    const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY || process.env.VITE_GOOGLE_PLACES_KEY;

    if (!GOOGLE_PLACES_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Configuration Error' }) };
    }

    try {
        const url = 'https://places.googleapis.com/v1/places:searchText';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.location,places.types,places.editorialSummary,places.id,places.formattedAddress'
            },
            body: JSON.stringify({
                textQuery,
                locationBias: {
                    circle: {
                        center: {
                            latitude: parseFloat(center.lat),
                            longitude: parseFloat(center.lng)
                        },
                        radius: parseFloat(radius)
                    }
                }
            })
        });

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`Google Places API Error ${response.status}: ${txt}`);
        }

        const data = await response.json();
        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error("Google Places Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
