
import dotenv from 'dotenv';
import { generateSessionToken } from './netlify/functions/utils/auth.js';

dotenv.config();

// 1. Generate Token
const token = generateSessionToken('debug@example.com');
console.log("Generated Token:", token ? "Yes" : "No");

// 2. Define URL (Try direct server port 3001)
const query = 'Coffee';
const ll = '50.9303735,5.3378043';
const url = `http://localhost:3001/api/foursquare?query=${query}&ll=${ll}&radius=5000&limit=5&locale=en`;

console.log(`Testing URL: ${url}`);

try {
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log(`Body: ${text}`);

} catch (e) {
    console.error("Fetch Failed:", e.message);
    if (e.cause) console.error("Cause:", e.cause);
}
