
// verify_geocoding_file.js
import fetch from 'node-fetch';
import fs from 'fs';

function log(msg) {
    fs.appendFileSync('debug_log.txt', msg + '\n');
    console.log(msg);
}

async function testGeocoding(query) {
    log(`\n\n=== Testing query: "${query}" ===`);

    const cleanQuery = query.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    log(`Clean Query: '${cleanQuery}' (Len: ${cleanQuery.length})`);

    // 1. Nominatim (Direct)
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
        log(`\n[Nominatim] Fetching: ${url}`);
        const res = await fetch(url, { headers: { 'User-Agent': 'CityExplorer-Debugger' } });
        const data = await res.json();

        if (data && data.length > 0) {
            const best = data[0];
            const cleanResult = (best.display_name || "").toLowerCase().split(',')[0].trim();
            log(`[Nominatim] Raw Result 1: "${best.display_name}"`);
            log(`[Nominatim] Clean Result: '${cleanResult}' (Len: ${cleanResult.length})`);

            // Heuristic Check
            if (cleanQuery.length > cleanResult.length + 5 && cleanQuery.includes(cleanResult)) {
                log(`[Nominatim] ❌ REJECTED by Heuristic (Generic Match)`);
            } else {
                log(`[Nominatim] ✅ ACCEPTED by Heuristic`);
            }
            log(`[Nominatim] Lat/Lon: ${best.lat}, ${best.lon}`);
            log(`[Nominatim] Type: ${best.type}, Class: ${best.class}`);

        } else {
            log("[Nominatim] No result");
        }
    } catch (e) { log("[Nominatim] Error: " + e.message); }

    // 2. Photon
    try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`;
        log(`\n[Photon] Fetching: ${url}`);
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
            const p = data.features[0].properties;
            const c = data.features[0].geometry.coordinates;
            log(`[Photon] Result 1: ${p.name}, ${p.city} [${c[1]}, ${c[0]}]`);
        } else {
            log("[Photon] No result");
        }
    } catch (e) { log("[Photon] Error: " + e.message); }
}

// Clear log
fs.writeFileSync('debug_log.txt', '');

async function run() {
    await testGeocoding("Parking Oost UZ Leuven, Leuven");
    await testGeocoding("Parking Oost, Leuven");
    await testGeocoding("UZ Leuven Parking Oost, Leuven");
    await testGeocoding("Bezoekersparking Oost UZ Leuven, Leuven");
    await testGeocoding("Parking Oost"); // No city context
}

run();
