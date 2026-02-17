import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.TAVILY_API_KEY;

async function testTavily() {
    console.log("--- Tavily Diagnostic ---");
    console.log("API Key Length:", apiKey ? apiKey.length : 0);

    if (!apiKey) {
        console.error("Error: Missing TAVILY_API_KEY in .env");
        return;
    }

    try {
        console.log("Testing Tavily Search...");
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                query: "Berlin sightseeing highlights",
                search_depth: "basic",
                include_images: true,
                max_results: 5
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`FAILED! Tavily Status: ${response.status}`);
            console.error("Error Data:", JSON.stringify(data, null, 2));

            if (response.status === 401) {
                console.log("\nTIP: Your Tavily API key is invalid.");
            } else if (response.status === 429) {
                console.log("\nTIP: You have exceeded your Tavily rate limit or quota.");
            }
        } else {
            console.log("SUCCESS! Tavily Search is working.");
            console.log("Results found:", data.results ? data.results.length : 0);
        }
    } catch (err) {
        console.error("Diagnostic script crashed:", err);
    }
}

testTavily();
