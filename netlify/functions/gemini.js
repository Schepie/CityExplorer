
import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_KEY = process.env.GEMINI_KEY || process.env.VITE_GEMINI_KEY;

export const handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt } = JSON.parse(event.body);

        if (!prompt) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required' }) };
        }

        if (!GEMINI_KEY) {
            console.error("GEMINI_KEY is missing in environment");
            return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
        }

        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        return {
            statusCode: 200,
            body: JSON.stringify({ text })
        };
    } catch (error) {
        console.error("Gemini Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
