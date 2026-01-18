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
const apiKey = env.VITE_GEMINI_API_KEY;

if (!apiKey) {
    console.error("No API key found in .env");
    process.exit(1);
}

const model = "gemini-2.0-flash";
console.log(`Testing verification for model: ${model} WITH referer...`);

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

const prompt = "Explain 'Blossom Alley Hasselt' briefly.";

try {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Referer': 'http://localhost:5173/'
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    if (!response.ok) {
        console.error("HTTP Error:", response.status, response.statusText);
        console.error(await response.text());
    } else {
        const data = await response.json();
        console.log("Success! Response:");
        console.log(data.candidates?.[0]?.content?.parts?.[0]?.text);
    }
} catch (e) {
    console.error("Fetch failed:", e);
}
