
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
// Native fetch is available in Node 18+ 
// However, since we are in "type": "module", we might access global fetch directly. 
// If node version is old, it might fail. I'll rely on global fetch first, or import if I see it's missing. 
// Actually, to be safe in an unknown environment, I'll rely on globalThis.fetch or assume Node 18+. 
// If the user's Node is old, I might need 'node-fetch', but I didn't install it. 
// Let's assume Node 18+.

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

// Access Keys (support VITE_ prefix for backward compat with .env file, but prefer standard)
const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_KEY || process.env.GEMINI_KEY;
const GOOGLE_PLACES_KEY = process.env.VITE_GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_KEY;
const FOURSQUARE_KEY = process.env.VITE_FOURSQUARE_KEY || process.env.FOURSQUARE_KEY;

// --- Gemini Endpoint ---
app.post('/api/gemini', async (req, res) => {
    try {
        const { prompt } = req.body;
        console.log(`[Proxy] Gemini Request`);
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
        if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_KEY not configured on server' });

        const genAI = new GoogleGenerativeAI(GEMINI_KEY);
        // Using valid model as discovered in previous turns or standard generic one
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log(`[Proxy] Gemini Success`);
        res.json({ text });
    } catch (error) {
        console.error("Gemini Proxy Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Google Places Endpoint ---
app.post('/api/google-places', async (req, res) => {
    try {
        const { textQuery, center, radius } = req.body;
        console.log(`[Proxy] Google Places: "${textQuery}" @ ${JSON.stringify(center)}`);

        if (!GOOGLE_PLACES_KEY) return res.status(500).json({ error: 'GOOGLE_PLACES_KEY not configured' });

        const url = 'https://places.googleapis.com/v1/places:searchText';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_PLACES_KEY,
                // Prepare the request to Google Places API (New Text Search Basic)
                // Fields: displayName, location, businessStatus, types...
                // We only neeed Basic fields for now + editorialSummary
                'X-Goog-FieldMask': 'places.displayName,places.location,places.types,places.editorialSummary,places.id,places.formattedAddress',
                'Referer': 'http://localhost:5173/',
                'Origin': 'http://localhost:5173'
            },
            body: JSON.stringify({
                textQuery,
                locationBias: {
                    circle: {
                        center: {
                            latitude: parseFloat(center.lat),
                            longitude: parseFloat(center.lng)
                        },
                        radius: parseFloat(radius)
                    }
                }
            })
        });

        if (!response.ok) {
            const txt = await response.text();
            console.error(`[Proxy] Google Places API Error ${response.status}: ${txt}`);
            return res.status(response.status).send(txt);
        }

        const data = await response.json();
        console.log(`[Proxy] Google Places Found: ${data.places ? data.places.length : 0}`);
        res.json(data);
    } catch (error) {
        console.error("Google Places Proxy Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Foursquare Endpoint ---
app.get('/api/foursquare', async (req, res) => {
    try {
        const { query, ll, radius, limit } = req.query;
        console.log(`[Proxy] Foursquare: "${query}" @ ${ll}`);

        if (!FOURSQUARE_KEY) return res.status(500).json({ error: 'FOURSQUARE_KEY not configured' });

        const url = `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&ll=${ll}&radius=${radius}&limit=${limit}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': FOURSQUARE_KEY,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`[Proxy] Foursquare API Error ${response.status}: ${err}`);
            throw new Error(`Foursquare API Error: ${response.statusText} ${err}`);
        }

        const data = await response.json();
        console.log(`[Proxy] Foursquare Found: ${data.results ? data.results.length : 0}`);
        res.json(data);
    } catch (error) {
        console.error("Foursquare Proxy Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Google Custom Search Endpoint ---
app.get('/api/google-search', async (req, res) => {
    try {
        const { q, cx } = req.query;
        console.log(`[Proxy] Google Search: "${q}"`);
        // Allows passing CX from client or ENV. If configured on server, use server.
        // We will assume the server has the keys if we want to secure them.
        // But CX is usually not secret. The API KEY is secret.
        // Let's use the GOOGLE_PLACES_KEY (often same project) or a specific SEARCH_KEY.
        // The existing code used GOOGLE_PLACES_KEY for search too.

        if (!GOOGLE_PLACES_KEY) return res.status(500).json({ error: 'GOOGLE_KEY not configured' });

        // If CX is not passed, maybe use env?
        const searchCx = cx || process.env.VITE_GOOGLE_SEARCH_CX || process.env.GOOGLE_SEARCH_CX;
        if (!searchCx) return res.status(500).json({ error: 'CX not configured' });

        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_PLACES_KEY}&cx=${searchCx}&q=${encodeURIComponent(q)}&num=1`;

        const response = await fetch(url, {
            headers: { 'Referer': 'http://localhost:5173/' }
        });
        const data = await response.json();

        if (data.error) {
            console.error(`[Proxy] Google Search API Error:`, data.error);
        } else {
            console.log(`[Proxy] Google Search Found: ${data.items ? data.items.length : 0}`);
        }

        res.json(data);
    } catch (error) {
        console.error("Google Search Proxy Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Static Files (Production) ---
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the 'dist' directory (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment config: Gemini=${!!GEMINI_KEY}, Google=${!!GOOGLE_PLACES_KEY}, Foursquare=${!!FOURSQUARE_KEY}`);
});
