
export const handler = async (event, context) => {
    const { q } = event.queryStringParameters;

    if (!q) {
        return { statusCode: 400, body: "Missing query" };
    }

    try {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;

        // DDG API is notoriously slow/flakey sometimes, so we simple-fetch
        const response = await fetch(url);
        const data = await response.json();

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error("DDG Proxy Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
