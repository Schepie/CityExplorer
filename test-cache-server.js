
import fetch from 'node-fetch';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = path.join(__dirname, 'server-test.js');
const BASE_URL = 'http://localhost:3002';

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCache() {
    console.log("Starting Test Server on 3002...");
    const serverProcess = spawn('node', [SERVER_PATH], { stdio: 'inherit' });

    // Give server time to start
    await wait(3000);

    try {
        console.log("1. Testing Cache Save (POST)...");
        const testKey = "test_key_" + Date.now();
        const testData = { message: "Hello Cache", timestamp: Date.now() };

        const postRes = await fetch(`${BASE_URL}/api/poi-cache?key=${testKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: testData })
        });

        if (!postRes.ok) throw new Error(`POST failed: ${postRes.status} ${await postRes.text()}`);
        console.log("   ✅ POST Success");

        console.log("2. Testing Cache Retrieve (GET)...");
        const getRes = await fetch(`${BASE_URL}/api/poi-cache?key=${testKey}`);

        if (!getRes.ok) throw new Error(`GET failed: ${getRes.status}`);
        const json = await getRes.json();

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

testCache();
