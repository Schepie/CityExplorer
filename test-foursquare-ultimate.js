
import dotenv from 'dotenv';
dotenv.config();

const FOURSQUARE_KEY = process.env.VITE_FOURSQUARE_KEY || process.env.FOURSQUARE_KEY;

const query = 'Water & strand';
const ll = '50.9303735,5.3378043';
const radius = 5000;
const limit = 5;
const fields = 'fsq_id,name,location';

const strategies = [
    { name: 'Plain V3 (Standard)', url: `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&ll=${ll}&radius=${radius}&limit=${limit}`, headers: { 'Authorization': FOURSQUARE_KEY, 'Accept': 'application/json' } },
    { name: 'V3 with Fields', url: `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&ll=${ll}&radius=${radius}&limit=${limit}&fields=${fields}`, headers: { 'Authorization': FOURSQUARE_KEY, 'Accept': 'application/json' } },
    { name: 'V3 with v param', url: `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&ll=${ll}&radius=${radius}&limit=${limit}&v=20231010`, headers: { 'Authorization': FOURSQUARE_KEY, 'Accept': 'application/json' } },
    { name: 'V3 with fsq-api-version header', url: `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&ll=${ll}&radius=${radius}&limit=${limit}`, headers: { 'Authorization': FOURSQUARE_KEY, 'Accept': 'application/json', 'fsq-api-version': '2023-10-10' } },
    { name: 'V3 with Fsq prefix', url: `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&ll=${ll}&radius=${radius}&limit=${limit}`, headers: { 'Authorization': `Fsq ${FOURSQUARE_KEY}`, 'Accept': 'application/json' } },
    { name: 'V3 with Bearer prefix', url: `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&ll=${ll}&radius=${radius}&limit=${limit}`, headers: { 'Authorization': `Bearer ${FOURSQUARE_KEY}`, 'Accept': 'application/json' } },
    { name: 'V3 Nearby (No Query)', url: `https://api.foursquare.com/v3/places/nearby?ll=${ll}&radius=${radius}&limit=${limit}&fields=${fields}`, headers: { 'Authorization': FOURSQUARE_KEY, 'Accept': 'application/json' } },
    { name: 'V3 Newer Version Date', url: `https://api.foursquare.com/v3/places/search?query=${encodeURIComponent(query)}&ll=${ll}&radius=${radius}&limit=${limit}&v=20250101`, headers: { 'Authorization': FOURSQUARE_KEY, 'Accept': 'application/json' } }
];

console.log(`Starting Multi-Strategy Foursquare Test... Key: ${FOURSQUARE_KEY.substring(0, 10)}...`);

for (const s of strategies) {
    console.log(`\n--- Testing: ${s.name} ---`);
    try {
        const response = await fetch(s.url, { headers: s.headers });
        console.log(`Status: ${response.status} ${response.statusText}`);
        const data = await response.json();
        if (response.ok) {
            console.log(`SUCCESS! Found ${data.results ? data.results.length : 0} results.`);
            break; // Found one!
        } else {
            console.log(`Error Message: ${data.message || JSON.stringify(data)}`);
            if (data.errorType) console.log(`Error Type: ${data.errorType}`);
        }
    } catch (e) {
        console.log(`Fetch Error: ${e.message}`);
    }
}
