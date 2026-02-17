
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
    // Only allow POST (Save) and GET (Retrieve)
    if (req.method !== "POST" && req.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const store = getStore("poi-cache");
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
        return new Response("Missing 'key' query parameter", { status: 400 });
    }

    try {
        if (req.method === "GET") {
            const data = await store.get(key, { type: "json" });
            if (!data) {
                return new Response(JSON.stringify({ found: false }), {
                    status: 404,
                    headers: { "Content-Type": "application/json" }
                });
            }

            // Check expiration: 60 days = 5184000000 ms
            if (data.timestamp && Date.now() - data.timestamp > 5184000000) {
                return new Response(JSON.stringify({ found: false }), {
                    status: 200, // It's a "miss", not an error
                    headers: { "Content-Type": "application/json" }
                });
            }

            // Return the inner data directly to match server.js behavior
            return new Response(JSON.stringify({ found: true, data: data.data || data }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        if (req.method === "POST") {
            const body = await req.json();
            // Validate body structure if needed
            if (!body || !body.data) {
                return new Response("Missing 'data' in body", { status: 400 });
            }

            // Metadata for expiration logic (7 days in ms)
            // We can store metadata if blobs supports it, or wrap the object
            const payload = {
                data: body.data,
                timestamp: Date.now(),
                version: "1.0"
            };

            await store.setJSON(key, payload);

            return new Response(JSON.stringify({ success: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

    } catch (error) {
        console.error("Blob Error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};
