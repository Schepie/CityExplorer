
export const handler = async (event, context) => {
    const { q, cx } = event.queryStringParameters;
    const GOOGLE_PLACES_KEY = process.env.GOOGLE_PLACES_KEY || process.env.VITE_GOOGLE_PLACES_KEY;
    const GOOGLE_SEARCH_CX = cx || process.env.GOOGLE_SEARCH_CX || process.env.VITE_GOOGLE_SEARCH_CX;

    if (!GOOGLE_PLACES_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server Key Config Error' }) };
    }
    if (!GOOGLE_SEARCH_CX) {
        return { statusCode: 500, body: JSON.stringify({ error: 'CX Config Error' }) };
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_PLACES_KEY}&cx=${GOOGLE_SEARCH_CX}&q=${encodeURIComponent(q)}&num=1`;

    try {
        const response = await fetch(url, {
            headers: { 'Referer': 'https://city-explorer.netlify.app' }
        });
        const data = await response.json();

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error("Google Search Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
