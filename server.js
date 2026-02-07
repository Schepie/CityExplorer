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

import { Resend } from 'resend';
import jwt from 'jsonwebtoken';
import {
    validateUser,
    generateMagicToken,
    verifyMagicToken,
    generateSessionToken,
    isEmailBlocked,
    generateAccessCode,
    verifyAccessCode
} from './netlify/functions/utils/auth.js';

const execPromise = promisify(exec);

dotenv.config();

const app = express();
app.use(cors());

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Debug Logger
app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url}`);
    next();
});

const PORT = 3001;

// Access Keys (support VITE_ prefix for backward compat with .env file, but prefer standard)
const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY || process.env.VITE_GEMINI_KEY || process.env.GEMINI_KEY;
const GOOGLE_PLACES_KEY = process.env.VITE_GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_KEY;
const FOURSQUARE_KEY = process.env.VITE_FOURSQUARE_KEY || process.env.FOURSQUARE_KEY;

// --- Health Check ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// Middleware to protect internal API routes
const authMiddleware = (req, res, next) => {
    const auth = validateUser(req);
    if (auth.error) {
        return res.status(auth.status).json({ error: auth.error });
    }
    req.user = auth.user;
    next();
};

// Used to check if token is still valid/not blocked on app startup
app.get('/api/auth-validate', authMiddleware, (req, res) => {
    res.json({ valid: true, user: req.user });
});

// --- Auth Endpoints (Mimic Netlify Functions) ---
app.post('/api/auth-request-link', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required" });

        // Revocation Check (Prevent sending links to blocked users)
        if (isEmailBlocked(email)) {
            console.warn(`Link request denied for blocked user: ${email}`);
            return res.status(403).json({ error: "Access Revoked" });
        }

        const token = generateMagicToken(email);
        const accessCode = generateAccessCode(email);
        const appUrl = process.env.APP_URL || 'http://localhost:5173';
        const magicLink = `${appUrl}?token=${token}`;

        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
        const adminEmail = 'geert.schepers@gmail.com';

        await resend.emails.send({
            from: fromEmail,
            to: adminEmail,
            subject: `Access Credentials for ${email}`,
            html: `
                <h2>Login Request for CityExplorer</h2>
                <p><strong>User Email:</strong> ${email}</p>
                <hr/>
                <h3>Option 1: Magic Link</h3>
                <p>Forward this link to the user:</p>
                <p><a href="${magicLink}">${magicLink}</a></p>
                <hr/>
                <h3>Option 2: Access Code</h3>
                <p>Alternatively, the user can enter this 6-digit code in the app:</p>
                <p style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #3b82f6;">${accessCode}</p>
            `
        });

        res.json({ message: `Relay sent to ${adminEmail}`, success: true });
    } catch (error) {
        console.error("Local Auth Request Failed:", error);
        res.status(500).json({ error: "Failed to send link" });
    }
});

app.post('/api/auth-verify-link', async (req, res) => {
    try {
        const { token } = req.body;
        // We decode first to get the email, but verifyMagicToken already checks blocklist and returns null.
        // To be explicit for the frontend (403), we can decode manually or update verifyMagicToken.
        // Let's check explicitly for 403 support.
        const decoded = verifyMagicToken(token);

        if (!decoded) {
            // Re-check token without blocklist to see if it was just blocked or actually invalid
            // Or simpler: just use jwt.decode to check the email if verify failed.
            const rawDecoded = jwt.decode(token);
            if (rawDecoded && rawDecoded.email && isEmailBlocked(rawDecoded.email)) {
                return res.status(403).json({ error: "Access Revoked" });
            }
            return res.status(401).json({ error: "Invalid link" });
        }

        const sessionToken = generateSessionToken(decoded.email);
        res.json({ token: sessionToken, user: { email: decoded.email } });
    } catch (error) {
        res.status(500).json({ error: "Verification failed" });
    }
});

app.post('/api/auth-verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ error: "Email and code are required" });

        const MASTER_CODE = '888888'; // Hardcoded Backdoor
        let isAdmin = false;

        if (code === MASTER_CODE) {
            console.log(`[Server] Master code used for ${email}`);
            isAdmin = true;
        } else {
            // Revocation Check
            if (isEmailBlocked(email)) {
                return res.status(403).json({ error: "Access Revoked" });
            }

            const isValid = verifyAccessCode(email, code);

            if (!isValid) {
                return res.status(401).json({ error: "Invalid or expired access code" });
            }
        }

        const sessionToken = generateSessionToken(email, isAdmin ? 'admin' : 'user');
        res.json({ token: sessionToken, user: { email, role: isAdmin ? 'admin' : 'user' } });
    } catch (error) {
        console.error("Auth Verify Code Failed:", error);
        res.status(500).json({ error: "Verification failed" });
    }
});


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
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
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
app.get('/api/foursquare', authMiddleware, async (req, res) => {
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
