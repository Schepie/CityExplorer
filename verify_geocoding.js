
// verify_geocoding.js
import fetch from 'node-fetch';

async function testGeocoding(query) {
    console.log(`\n\n=== Testing query: "${query}" ===`);

    const cleanQuery = query.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`Clean Query: '${cleanQuery}' (Len: ${cleanQuery.length})`);

    // 1. Nominatim (Direct)
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
        console.log(`\n[Nominatim] Fetching: ${url}`);
        const res = await fetch(url, { headers: { 'User-Agent': 'CityExplorer-Debugger' } });
        const data = await res.json();

        if (data && data.length > 0) {
            const best = data[0];
            const cleanResult = (best.display_name || "").toLowerCase().split(',')[0].trim();
            console.log(`[Nominatim] Raw Result 1: "${best.display_name}"`);
            console.log(`[Nominatim] Clean Result: '${cleanResult}' (Len: ${cleanResult.length})`);

            // Heuristic Check
            let rejected = false;
            // The logic from geocoding.js
            if (cleanQuery.length > cleanResult.length + 5 && cleanQuery.includes(cleanResult)) {
                console.log(`[Nominatim] ❌ REJECTED by Heuristic (Generic Match)`);
                rejected = true;
            } else {
                console.log(`[Nominatim] ✅ ACCEPTED by Heuristic`);
            }

            console.log(`[Nominatim] Lat/Lon: ${best.lat}, ${best.lon}`);
            console.log(`[Nominatim] Type: ${best.type}, Class: ${best.class}`);

        } else {
            console.log("[Nominatim] No result");
        }
    } catch (e) { console.error("[Nominatim] Error", e.message); }

    // 2. Photon
    try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`;
        console.log(`\n[Photon] Fetching: ${url}`);
        const res = await fetch(url);
        const data = await res.json();
        if (data.features && data.features.length > 0) {
            const p = data.features[0].properties;
            const c = data.features[0].geometry.coordinates;
            console.log(`[Photon] Result 1: ${p.name}, ${p.city} [${c[1]}, ${c[0]}]`);
        } else {
            console.log("[Photon] No result");
        }
    } catch (e) { console.error("[Photon] Error", e.message); }
}

// Test specific cases
testGeocoding("Parking Oost UZ Leuven, Leuven");
testGeocoding("UZ Leuven Campus Gasthuisberg, Leuven");
