import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Netlify Function: Cloud Cache Proxy
 * Provides a secure bridge between the frontend and Supabase to avoid exposing service keys.
 */
export const handler = async (event, context) => {
    // 1. Setup & Auth Check (Optional: restrict to your own app domain)
    if (!supabase) {
        return { statusCode: 500, body: JSON.stringify({ error: "Supabase not configured on server." }) };
    }

    const { httpMethod, queryStringParameters, body } = event;

    try {
        // --- GET: Fetch cached item by key ---
        if (httpMethod === 'GET') {
            const key = queryStringParameters.key;
            if (!key) return { statusCode: 400, body: JSON.stringify({ error: "Missing key." }) };

            const { data, error } = await supabase
                .from('poi_cache')
                .select('data')
                .eq('cache_key', key)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is code for "more or less than 1 row returned" (i.e. not found)
                console.error("Supabase GET Error:", error);
                return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
            }

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data ? data.data : null)
            };
        }

        // --- POST: Save item to cache ---
        if (httpMethod === 'POST') {
            const { key, data, language } = JSON.parse(body);
            if (!key || !data) return { statusCode: 400, body: JSON.stringify({ error: "Missing key or data." }) };

            const { error } = await supabase
                .from('poi_cache')
                .upsert({
                    cache_key: key,
                    data: data,
                    language: language || 'nl',
                    created_at: new Date().toISOString()
                }, { onConflict: 'cache_key' });

            if (error) {
                console.error("Supabase POST Error:", error);
                return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
            }

            return {
                statusCode: 200,
                body: JSON.stringify({ success: true })
            };
        }

        return { statusCode: 405, body: "Method Not Allowed" };

    } catch (err) {
        console.error("Cloud Cache Function Crash:", err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
