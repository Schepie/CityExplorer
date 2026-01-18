import fs from 'fs';
import path from 'path';

function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envFile.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                env[key.trim()] = value.trim();
            }
        });
        return env;
    } catch (e) {
        return {};
    }
}

const env = loadEnv();
const apiKey = env.VITE_GOOGLE_PLACES_KEY;
const cx = env.VITE_GOOGLE_SEARCH_CX;

if (!apiKey || !cx) {
    console.error("Missing VITE_GOOGLE_PLACES_KEY or VITE_GOOGLE_SEARCH_CX in .env");
    process.exit(1);
}

const query = "Hasselt Belgium Tourism";
const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=1`;

console.log(`Testing Google Custom Search WITH referer...`);

try {
    const response = await fetch(url, {
        headers: { 'Referer': 'http://localhost:5173/' }
    });
    const data = await response.json();

    if (data.error) {
        console.error("SEARCH ERROR:", data.error.code, data.error.message);
    } else {
        console.log("Success! Found items:", data.items ? data.items.length : 0);
    }
} catch (e) {
    console.error("Fetch failed:", e);
}
