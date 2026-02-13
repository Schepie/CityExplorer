
import dotenv from 'dotenv';
import { handler } from './netlify/functions/foursquare.js';
import { generateSessionToken } from './netlify/functions/utils/auth.js';

dotenv.config();

// Generate a valid token for testing
const token = generateSessionToken('test@example.com');

// mock event
const event = {
    headers: {
        'authorization': `Bearer ${token}`
    },
    queryStringParameters: {
        query: 'Coffee', // Simple query
        ll: '50.9303735,5.3378043',
        radius: 5000,
        limit: 5
    }
};

const context = {};

console.log("Testing Netlify Function Handler locally...");

try {
    const response = await handler(event, context);
    console.log(`Status Code: ${response.statusCode}`);
    if (response.statusCode === 200) {
        const body = JSON.parse(response.body);
        console.log("Success! Results found:", body.results ? body.results.length : 0);
        console.log(JSON.stringify(body, null, 2).substring(0, 300) + "...");
    } else {
        console.log("Error Response:", response.body);
    }
} catch (e) {
    console.error("Handler execution failed:", e);
}
