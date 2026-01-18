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

// Simple test query
const query = "Hasselt Belgium Tourism";
const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=1`;

console.log(`Testing Google Custom Search...`);
console.log(`Using Key: ${apiKey.substring(0, 5)}...`);
console.log(`Using CX: ${cx}`);

try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        console.error("SEARCH ERROR:", data.error.code, data.error.message);
        if (data.error.message.includes("invalid argument")) {
            console.error("\nHINT: Your CX ID might be invalid. It should NOT be an API key but a specific Search Engine ID.");
        }
    } else {
        console.log("Success! Found items:", data.items ? data.items.length : 0);
        if (data.items?.[0]) {
            console.log("First Result:", data.items[0].title);
        }
    }
} catch (e) {
    console.error("Fetch failed:", e);
}
