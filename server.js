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

const execPromise = promisify(exec);

dotenv.config();

const app = express();
app.use(cors());

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const PORT = 3001;

// Access Keys (support VITE_ prefix for backward compat with .env file, but prefer standard)
const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_KEY || process.env.GEMINI_KEY;
const GOOGLE_PLACES_KEY = process.env.VITE_GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_KEY;
const FOURSQUARE_KEY = process.env.VITE_FOURSQUARE_KEY || process.env.FOURSQUARE_KEY;

// --- Health Check ---
app.get('/api/health', (req, res) => {
    console.log("[Health] Ping received");
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- Build Booklet PDF Endpoint ---
app.post('/api/build-booklet', async (req, res) => {
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

// --- Nominatim Proxy Endpoint (Avoids CORS) ---
app.get('/api/nominatim', async (req, res) => {
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
    console.log(`Environment config: Gemini=${!!GEMINI_KEY}, Google=${!!GOOGLE_PLACES_KEY}, Foursquare=${!!FOURSQUARE_KEY}`);
});
