export const handler = async (event) => {
    const { q } = event.queryStringParameters;
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Tavily API Key missing. Please set TAVILY_API_KEY in Netlify.' })
        };
    }

    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: apiKey,
                query: q,
                search_depth: "basic",
                include_images: true,
                include_answer: false,
                max_results: 5
            })
        });

        if (!response.ok) {
            throw new Error(`Tavily API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Transform Tavily results to Google Search JSON structure for compatibility
        // Google Format: items: [{ snippet, link, title, pagemap: { cse_image: [{ src }] } }]
        const items = data.results.map((result, index) => ({
            snippet: result.content,
            link: result.url,
            title: result.title,
            pagemap: {
                // Map Tavily images to Google's cse_image format if available
                // We map the images list by index, or fall back to empty
                cse_image: data.images && data.images[index] ? [{ src: data.images[index] }] : []
            }
        }));

        return {
            statusCode: 200,
            body: JSON.stringify({ items })
        };

    } catch (error) {
        console.error("Tavily Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
