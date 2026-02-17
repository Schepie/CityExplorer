
import fetch from 'node-fetch';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, 'server-test.js');
const BASE_URL = 'http://localhost:3002';
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
    console.error("❌ Error: JWT_SECRET not found in .env");
    process.exit(1);
}

// Generate a mock token
const token = jwt.sign({ email: 'test@example.com', role: 'user' }, SECRET, { expiresIn: '1h' });

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAuthenticatedCache() {
    console.log("Starting Test Server on 3002 (Auth Enabled)...");
    const serverProcess = spawn('node', [SERVER_PATH], { stdio: 'inherit' });

    // Give server time to start
    await wait(3000);

    try {
        console.log("1. Testing Cache Save (POST) with Token...");
        const testKey = "auth_test_key_" + Date.now();
        const testData = { message: "Hello Authenticated Cache", timestamp: Date.now() };

        const postRes = await fetch(`${BASE_URL}/api/poi-cache?key=${testKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ data: testData })
        });

        if (!postRes.ok) throw new Error(`POST failed: ${postRes.status} ${await postRes.text()}`);
        console.log("   ✅ POST Success");

        console.log("2. Testing Cache Retrieve (GET) with Token...");
        const getRes = await fetch(`${BASE_URL}/api/poi-cache?key=${testKey}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!getRes.ok) throw new Error(`GET failed: ${getRes.status}`);
        const text = await getRes.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch (e) {
            console.error("   ❌ GET Failed: Invalid JSON response:", text);
            throw new Error("Invalid JSON");
        }

        if (json.found && json.data.message === testData.message) {
            console.log("   ✅ GET Success: Data matched");
        } else {
            console.error("   ❌ GET Failed: Data mismatch or not found", json);
        }

    } catch (e) {
        console.error("   ❌ Verification Failed:", e.message);
    } finally {
        console.log("Stopping Test Server...");
        serverProcess.kill();
    }
}

testAuthenticatedCache();
