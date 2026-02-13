
import Groq from 'groq-sdk';
import { validateUser } from './utils/auth.js';

const GROQ_API_KEY = process.env.GROQ_API_KEY;

export const handler = async (event, context) => {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 1. Auth Check
    const auth = validateUser(event);
    if (auth.error) {
        return { statusCode: auth.status, body: JSON.stringify({ error: auth.error }) };
    }

    try {
        const { prompt, image, mimeType } = JSON.parse(event.body);

        if (!prompt) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required' }) };
        }

        if (!GROQ_API_KEY) {
            console.error("GROQ_API_KEY is missing in environment");
            return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error: GROQ_API_KEY not set' }) };
        }

        const groq = new Groq({ apiKey: GROQ_API_KEY });

        if (image) {
            console.warn("Groq doesn't support image analysis yet, ignoring image");
        }

        const performCompletion = async (model) => {
            return await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: model,
                temperature: 0.7,
                max_tokens: 2048,
                top_p: 1
            });
        };

        let text = '';
        let warning = null;

        try {
            // Try Primary Model (70b - High Quality)
            const completion = await performCompletion("llama-3.3-70b-versatile");
            text = completion.choices[0]?.message?.content || '';
        } catch (error) {
            // Fallback Strategy for Rate Limits
            if (error.status === 429 || (error.error && error.error.code === 'rate_limit_exceeded')) {
                console.warn("Rate limit hit on 70b. Attempting fallback to 8b-instant...");
                try {
                    const fallbackCompletion = await performCompletion("llama-3.1-8b-instant");
                    text = fallbackCompletion.choices[0]?.message?.content || '';
                    warning = "Served by fallback model due to high traffic.";
                } catch (fallbackError) {
                    console.error("Fallback also failed:", fallbackError);
                    // Return 429 if both fail
                    return {
                        statusCode: 429,
                        body: JSON.stringify({ error: "Rate limit exceeded. Please try again later." })
                    };
                }
            } else {
                throw error; // Re-throw other errors to the main catch block
            }
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ text, warning })
        };

    } catch (error) {
        console.error("Groq Function Error:", error);
        return {
            statusCode: error.status || 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
