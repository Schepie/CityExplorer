
import { validateUser } from './utils/auth.js';

export const handler = async (event, context) => {
    // Auth Check
    const auth = validateUser(event);
    if (auth.error) {
        return { statusCode: auth.status, body: JSON.stringify({ error: auth.error }) };
    }

    try {
        const queryParams = new URLSearchParams(event.queryStringParameters).toString();
        const { lat, lon, q } = event.queryStringParameters;

        // Heuristic: If 'q' is missing but 'lat'/'lon' are there, assume reverse geocoding.
        const isReverse = !q && lat && lon;
        const endpoint = isReverse ? 'reverse' : 'search';

        const url = `https://nominatim.openstreetmap.org/${endpoint}?${queryParams}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'CityExplorer/1.0 (Student Project; educational use)',
                'Accept-Language': event.headers['accept-language'] || 'en'
            }
        });

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: await response.text()
            };
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error("Nominatim Proxy Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
