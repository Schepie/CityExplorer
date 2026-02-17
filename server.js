import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Logging System ---
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'service_logs.txt');

function logToFile(level, message, context = '') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${context ? `(${context}) ` : ''}${message}\n`;
    try {
        if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);
        fs.appendFileSync(LOG_FILE, logEntry);
    } catch (e) {
        console.error("Failed to write to log file:", e);
    }
}

import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';


const execPromise = promisify(exec);

dotenv.config();

const app = express();
app.use(cors());

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Debug Logger
app.use((req, res, next) => {
    // console.log(`[Server] ${req.method} ${req.url}`);
    next();
});

const PORT = 3001;

// Access Keys (support VITE_ prefix for backward compat with .env file, but prefer standard)
const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_KEY || process.env.GEMINI_KEY;
const GOOGLE_PLACES_KEY = process.env.VITE_GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_KEY;
const FOURSQUARE_KEY = process.env.VITE_FOURSQUARE_KEY || process.env.FOURSQUARE_KEY;

// --- Supabase Setup ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;
if (supabase) {
    console.log(`[Server] Supabase Cloud Cache: Initialized (${supabaseUrl})`);
} else {
    console.warn(`[Server] Supabase Cloud Cache: DISABLED (Missing keys in .env)`);
}

// --- Health Check ---
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '3.3.2' }));

// --- Groq Model Discovery Registry ---
let groqModels = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"]; // Fallback defaults
let stickyModelIndex = 0; // Remembers the first working model when others are exhausted

async function refreshGroqModels() {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) return;

        const groq = new Groq({ apiKey });
        const list = await groq.models.list();

        // Prioritize by capabilities and size keywords
        // Ranking: 70b > 32b/mixtral > 8b > smaller/others
        const ranked = list.data
            .filter(m => m.active !== false && !m.id.includes('guard')) // Exclude guard models and inactive ones
            .map(m => m.id)
            .sort((a, b) => {
                const getRank = (name) => {
                    const n = name.toLowerCase();
                    if (n.includes('70b') && n.includes('versatile')) return 100;
                    if (n.includes('70b')) return 90;
                    if (n.includes('mixtral') || n.includes('32b')) return 80;
                    if (n.includes('8b')) return 70;
                    if (n.includes('preview')) return 50; // Downrank previews
                    return 10;
                };
                return getRank(b) - getRank(a);
            });

        if (ranked.length > 0) {
            groqModels = ranked;
            stickyModelIndex = 0; // Reset sticky index on discovery (daily refresh)
            console.log(`[Groq Registry] Refreshed. Dynamic Fallback List: ${groqModels.join(' -> ')}`);
        }
    } catch (e) {
        console.warn("[Groq Registry] Failed to refresh models:", e.message);
    }
}

// Initial fetch and 12-hour refresh
refreshGroqModels();
setInterval(refreshGroqModels, 12 * 60 * 60 * 1000);

// Middleware to protect internal API routes
const authMiddleware = (req, res, next) => {
    // Auth disabled: Always permit as guest
    req.user = { email: 'guest@cityexplorer.app', role: 'admin', id: 'guest' };
    next();
};

// Used to check if token is still valid/not blocked on app startup
app.get('/api/auth-validate', authMiddleware, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// --- Auth Endpoints (DISABLED) ---
app.post('/api/auth-request-link', (req, res) => res.status(410).json({ error: "Authentication system is disabled" }));
app.post('/api/auth-verify-link', (req, res) => res.status(410).json({ error: "Authentication system is disabled" }));
app.post('/api/auth-verify-code', (req, res) => res.status(410).json({ error: "Authentication system is disabled" }));


// --- Build Booklet PDF Endpoint ---
app.post('/api/build-booklet', authMiddleware, async (req, res) => {
    try {
        const data = req.body;
        console.log(`[Proxy] Build Booklet Request for ${data.city}`);

        if (!data.city || !data.routeData) {
            return res.status(400).json({ error: 'City and routeData are required' });
        }

        // 1. Save data to a temporary JSON file (in temp folder to avoid Vite reload)
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

        const tempJsonPath = path.join(tempDir, 'temp_itinerary.json');
        fs.writeFileSync(tempJsonPath, JSON.stringify(data, null, 2));

        // 2. Determine output filename and folder
        const bookletsDir = path.join(__dirname, 'public', 'booklets');
        if (!fs.existsSync(bookletsDir)) {
            fs.mkdirSync(bookletsDir, { recursive: true });
        }

        const safeCity = data.city.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const dateStr = new Date().toISOString().split('T')[0];
        const pdfName = `Travel_Booklet_${safeCity}_${dateStr}.pdf`;
        const pdfPath = path.join(bookletsDir, pdfName);

        // 3. Determine logo if exists
        let logoParam = "";
        const logoPath = path.join(__dirname, 'public', 'logo.jpg');
        if (fs.existsSync(logoPath)) {
            logoParam = `--logo "${logoPath}"`;
        }

        // 4. Run the Python script (Try absolute paths, python, then py, then python3)
        console.log(`[Proxy] Running build_booklet.py...`);
        let success = false;
        let lastError = null;

        const pythonCommands = [
            'C:\\Users\\geert\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
            'python',
            'py',
            'python3'
        ];

        for (const cmd of pythonCommands) {
            try {
                console.log(`[Proxy] Trying command: ${cmd}`);
                // Use a template literal with quotes for the command and paths
                const fullCmd = `"${cmd}" "${path.join(__dirname, 'build_booklet.py')}" "${tempJsonPath}" --outfile "${pdfPath}" ${logoParam}`;
                const { stdout, stderr } = await execPromise(fullCmd);

                if (stderr && !stderr.includes('matplotlib') && !stderr.includes('fallback')) {
                    console.warn(`[Proxy] Script Stderr (${cmd}): ${stderr}`);
                }
                console.log(`[Proxy] Script Stdout (${cmd}): ${stdout}`);
                success = true;
                break;
            } catch (err) {
                lastError = err;
                console.warn(`[Proxy] Command ${cmd} failed: ${err.message.split('\n')[0]}`);
                if (err.stderr) console.warn(`[Proxy] Stderr for ${cmd}: ${err.stderr}`);
            }
        }

        if (!success) {
            console.error("[Proxy] All Python commands failed.");
            throw new Error(`Failed to execute Python script. Is Python installed? Last error: ${lastError?.message}`);
        }

        // 5. Return the public URL
        const pdfUrl = `/booklets/${pdfName}`;
        res.json({ success: true, url: pdfUrl });

        // Cleanup temp file
        setTimeout(() => {
            if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath);
        }, 5000);

    } catch (error) {
        console.error("Build Booklet Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Gemini Endpoint ---
app.post('/api/gemini', authMiddleware, async (req, res) => {
    try {
        const { prompt, image, mimeType } = req.body;
        console.log(`[Proxy] Gemini Request received. Prompt: ${prompt ? 'Yes' : 'No'}, Image present: ${!!image}, MimeType: ${mimeType}`);
        if (image) console.log(`[Proxy] Image length: ${image.length} chars (approx ${Math.round(image.length * 0.75 / 1024)} KB)`);
        if (!prompt && !image) return res.status(400).json({ error: 'Prompt or Image is required' });
        if (!GEMINI_KEY) {
            console.error("[Proxy] GEMINI_KEY missing");
            return res.status(500).json({ error: 'GEMINI_KEY not configured on server' });
        }

        const parts = [];
        if (prompt) parts.push({ text: prompt });
        if (image) {
            parts.push({
                inline_data: {
                    mime_type: mimeType || 'image/jpeg',
                    data: image // base64 string
                }
            });
        }

        // Use direct fetch to ensure Referer header is sent correctly to satisfy API key restrictions
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Referer': 'http://localhost:5173/',
                'Origin': 'http://localhost:5173'
            },
            body: JSON.stringify({
                contents: [{ parts: parts }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Proxy] Gemini API Error ${response.status}: ${errorText}`);
            return res.status(response.status).json({ error: errorText });
        }

        const data = await response.json();

        // Log raw response for debugging AR
        console.log(`[Proxy] Gemini Raw Response:`, JSON.stringify(data).substring(0, 500));

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        console.log(`[Proxy] Gemini Success. Text length: ${text ? text.length : 0}`);
        res.json({ text });
    } catch (error) {
        console.error("Gemini Proxy Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Google Places Endpoint ---
app.post('/api/google-places', authMiddleware, async (req, res) => {
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
app.get('/api/foursquare', authMiddleware, async (req, res) => {
    try {
        const { query, ll, radius, limit, locale } = req.query;
        console.log(`[Proxy] Foursquare: "${query}" @ ${ll}`);
        console.log(`[Proxy] Using FSQ Key: ${FOURSQUARE_KEY ? FOURSQUARE_KEY.substring(0, 10) + '...' : 'MISSING'}`);

        if (!FOURSQUARE_KEY) return res.status(500).json({ error: 'FOURSQUARE_KEY not configured' });

        const url = `https://places-api.foursquare.com/places/search?query=${encodeURIComponent(query)}&ll=${ll}&radius=${radius}&limit=${limit}&locale=${locale || 'en'}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${FOURSQUARE_KEY}`,
                'Accept': 'application/json',
                'X-Places-Api-Version': '2025-06-17'
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
app.get('/api/google-search', authMiddleware, async (req, res) => {
    try {
        const { q, cx, num } = req.query;
        console.log(`[Proxy] Google Search: "${q}" (num=${num || 5})`);
        if (!GOOGLE_PLACES_KEY) return res.status(500).json({ error: 'GOOGLE_KEY not configured' });
        const searchCx = cx || process.env.VITE_GOOGLE_SEARCH_CX || process.env.GOOGLE_SEARCH_CX;
        if (!searchCx) return res.status(500).json({ error: 'CX not configured' });

        const searchNum = num || 5;
        const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_PLACES_KEY}&cx=${searchCx}&q=${encodeURIComponent(q)}&num=${searchNum}`;
        const response = await fetch(url, { headers: { 'Referer': 'http://localhost:5173/' } });
        const data = await response.json();

        if (data.error) console.error(`[Proxy] Google Search API Error:`, data.error);
        res.json(data);
    } catch (error) {
        console.error("Google Search Proxy Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- DuckDuckGo Proxy ---
app.get('/api/ddg', authMiddleware, async (req, res) => {
    try {
        const { q } = req.query;
        console.log(`[Proxy] DDG: "${q}"`);
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
        const response = await fetch(url);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("DDG Proxy Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Groq Endpoint ---
app.post('/api/groq', authMiddleware, async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.error("GROQ_API_KEY missing in env");
            return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
        }

        const groq = new Groq({ apiKey });
        const attemptModels = [...groqModels]; // Use the dynamic list

        let lastError = null;
        // Start from the last known successful model index
        for (let i = stickyModelIndex; i < attemptModels.length; i++) {
            const model = attemptModels[i];
            try {
                // If we are retrying within the same request but after a previous TPD failure,
                // we should update stickyModelIndex to avoid retrying the failed model for NEXT requests too.
                console.log(`[Proxy] Attempting Groq request with model: ${model} (Index: ${i})`);
                const completion = await groq.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: model,
                    temperature: 0.7,
                    max_tokens: 2048,
                    top_p: 1
                });

                // Update sticky index to this successful model if it's different
                if (stickyModelIndex !== i) {
                    console.log(`[Proxy] Sticky index updated to: ${i} (${model})`);
                    stickyModelIndex = i;
                }

                console.log(`[Proxy] Groq Success using model: ${model}`);
                const text = completion.choices[0]?.message?.content || '';
                return res.json({ text });
            } catch (error) {
                lastError = error;
                // Specific Groq Error Types: https://console.groq.com/docs/errors
                const isRateLimit = error.status === 429;

                // Detection for "Tokens Per Day" (TPD) or "Requests Per Day" (RPD) limit specifically
                const errorType = error.error?.error?.type;
                const errorMsg = error.message || "";
                const isDailyLimit = isRateLimit && (
                    errorType === 'tokens' ||
                    errorType === 'requests' ||
                    errorMsg.includes('per day') ||
                    errorMsg.includes('daily limit')
                );

                if (isDailyLimit && i < attemptModels.length - 1) {
                    console.warn(`[Proxy] Groq Model ${model} daily limit reached. Moving to fallback...`);
                    // Proactively increment sticky index so the VERY NEXT request doesn't even try this model
                    stickyModelIndex = i + 1;
                    continue;
                }

                // If it's a transient rate limit (TPM/RPM), we might want to wait, 
                // but for simplicity in this proxy we just fail or try next if it looks blocked.
                if (isRateLimit && i < attemptModels.length - 1) {
                    console.warn(`[Proxy] Groq Model ${model} rate limited (429). Trying next...`);
                    stickyModelIndex = i + 1;
                    continue;
                }

                // If it's another error, or the last model, break and throw
                break;
            }
        }

        // If we reach here, it means all models failed or a non-TPD error occurred
        console.error("Groq Proxy Error:", lastError);
        const status = lastError.status || 500;
        const message = lastError.error?.error?.message || lastError.message || 'Internal Server Error';
        res.status(status).json({ error: message });
    } catch (error) {
        console.error("Groq Proxy Global Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Tavily Endpoint ---
app.get('/api/tavily', authMiddleware, async (req, res) => { // Use POST if following pattern, but PoiIntelligence uses GET with query params? 
    // Wait, PoiIntelligence uses apiFetch. apiFetch default is GET?
    // Let's check PoiIntelligence again.
    // It creates url with query params: `${endpoint}?q=...`
    // It calls apiFetch(url).
    // apiFetch uses fetch(url). Default is GET.
    // So this should be app.get('/api/tavily'...) or handle both?
    // Netlify function handler uses event.queryStringParameters which works for GET.
    // So app.get is correct.
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ error: 'Query q is required' });

        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'Tavily API Key missing' });

        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            const errData = await response.json().catch(() => ({}));
            console.error(`Tavily API Error ${response.status}:`, errData);
            return res.status(response.status).json({
                error: `Tavily API error: ${response.statusText}`,
                details: errData
            });
        }

        const data = await response.json();

        const items = data.results.map((result, index) => ({
            snippet: result.content,
            link: result.url,
            title: result.title,
            pagemap: {
                cse_image: data.images && data.images[index] ? [{ src: data.images[index] }] : []
            }
        }));

        res.json({ items });
    } catch (error) {
        console.error("Tavily Proxy Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Tavily Usage Endpoint ---
app.get('/api/tavily-usage', authMiddleware, async (req, res) => {
    try {
        const apiKey = process.env.TAVILY_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'Tavily API Key missing' });

        const response = await fetch(`https://api.tavily.com/usage?api_key=${apiKey}`);
        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch Tavily usage' });
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Nominatim Proxy Endpoint (Avoids CORS) ---
app.get('/api/nominatim', authMiddleware, async (req, res) => {
    try {
        const queryParams = new URLSearchParams(req.query).toString();
        // Heuristic: If 'q' is missing but 'lat'/'lon' are there, assume reverse geocoding.
        const isReverse = !req.query.q && req.query.lat && req.query.lon;
        const endpoint = isReverse ? 'reverse' : 'search';

        const url = `https://nominatim.openstreetmap.org/${endpoint}?${queryParams}`;

        console.log(`[Proxy] Nominatim (${endpoint}): ${queryParams}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'CityExplorer/1.0 (Student Project; educational use)',
                'Accept-Language': req.headers['accept-language'] || 'en'
            }
        });

        if (!response.ok) {
            console.error(`[Proxy] Nominatim Error ${response.status}`);
            return res.status(response.status).send(await response.text());
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Nominatim Proxy Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- POI Cache (Local Simulation for Netlify Blobs) ---
app.all('/api/poi-cache', authMiddleware, async (req, res) => {
    try {
        const cacheDir = path.join(__dirname, '.cache');
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

        const key = req.query.key;
        if (!key) return res.status(400).json({ error: "Missing key" });

        // Sanitize key for filename
        const safeKey = key.replace(/[^a-z0-9_\-]/gi, '_');
        const filePath = path.join(cacheDir, `${safeKey}.json`);

        if (req.method === 'GET') {
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                // Check expiration (optional, but good for sim)
                // 60 days = 60 * 24 * 60 * 60 * 1000 = 5184000000 ms
                if (Date.now() - data.timestamp > 5184000000) {
                    return res.json({ found: false });
                }
                return res.json({ found: true, data: data.data });
            }
            return res.json({ found: false });
        }

        if (req.method === 'POST') {
            const body = req.body;
            if (!body || !body.data) return res.status(400).json({ error: "Missing data" });

            const payload = {
                data: body.data,
                timestamp: Date.now(),
                version: "1.0"
            };
            fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
            return res.json({ success: true });
        }

        res.status(405).json({ error: "Method Not Allowed" });
    } catch (e) {
        console.error("Local Cache Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- Cloud Cache (Supabase Proxy) ---
app.all('/api/cloud-cache', authMiddleware, async (req, res) => {
    if (!supabase) {
        return res.status(500).json({ error: "Supabase not configured locally." });
    }

    try {
        if (req.method === 'GET') {
            const key = req.query.key;
            if (!key) return res.status(400).json({ error: "Missing key" });

            const { data, error } = await supabase
                .from('poi_cache')
                .select('data')
                .eq('cache_key', key)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Supabase GET Error:", error);
                return res.status(500).json({ error: error.message });
            }

            return res.json(data ? data.data : null);
        }

        if (req.method === 'POST') {
            const { key, data, language } = req.body;
            if (!key || !data) return res.status(400).json({ error: "Missing key or data" });

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
                return res.status(500).json({ error: error.message });
            }

            return res.json({ success: true });
        }

        res.status(405).json({ error: "Method Not Allowed" });
    } catch (e) {
        console.error("Cloud Cache Proxy Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- Service Logs API ---
app.get('/api/logs', authMiddleware, (req, res) => {
    try {
        if (!fs.existsSync(LOG_FILE)) return res.json({ logs: "" });

        // Read last 500 lines efficiently
        const content = fs.readFileSync(LOG_FILE, 'utf8');
        const lines = content.split('\n');
        const lastLines = lines.slice(-500).join('\n');

        res.json({ logs: lastLines });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/logs/push', authMiddleware, (req, res) => {
    const { level, message, context } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    logToFile(level || 'info', message, `Client: ${context || 'Unknown'}`);
    res.json({ success: true });
});

app.post('/api/logs/clear', authMiddleware, (req, res) => {
    try {
        fs.writeFileSync(LOG_FILE, `[${new Date().toISOString()}] [INFO] Log file cleared by user.\n`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/logs/download', authMiddleware, (req, res) => {
    if (!fs.existsSync(LOG_FILE)) return res.status(404).send("No logs found");
    res.download(LOG_FILE, 'service_logs.txt');
});

// --- Static Files (Production) ---
// Serve static files from the 'dist' directory (Vite build output)
app.use(express.static(path.join(__dirname, 'dist')));

// Serve the 'public' folder explicitly for booklets during dev
app.use('/booklets', express.static(path.join(__dirname, 'public', 'booklets')));

// Handle React routing, return all requests to React app
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment config: Gemini=${!!GEMINI_KEY}, Google=${!!GOOGLE_PLACES_KEY}, Foursquare=${!!FOURSQUARE_KEY}, Tavily=${!!process.env.TAVILY_API_KEY}`);
});
