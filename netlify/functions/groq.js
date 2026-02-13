
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

        // Note: Groq doesn't support vision models yet, so we'll only handle text
        if (image) {
            console.warn("Groq doesn't support image analysis yet, ignoring image");
        }

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "llama-3.3-70b-versatile", // Fast, high-quality model
            temperature: 0.7,
            max_tokens: 2048,
            top_p: 1
        });

        const text = completion.choices[0]?.message?.content || '';

        return {
            statusCode: 200,
            body: JSON.stringify({ text })
        };
    } catch (error) {
        console.error("Groq Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
