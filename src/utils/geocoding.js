import { apiFetch } from './api.js';

/**
 * robustGeocoding.js
 * A reusable service for resolving locations using multiple providers with fallback.
 * Providers: Nominatim (via Proxy) -> Photon -> OpenMeteo
 */

export const resolveLocation = async (query, language = 'en', signal = null) => {
    if (!query || query.length < 2) return [];

    let results = [];

    // 1. Try Nominatim (via Local Proxy to avoid CORS and usage limits if configured)
    // 1. Try Nominatim (via Local Proxy to avoid CORS and usage limits if configured)
    const performNominatimSearch = async (searchQuery) => {
        const cityResponse = await apiFetch(`/api/nominatim?q=${encodeURIComponent(searchQuery)}&format=json&limit=5&addressdetails=1`, {
            headers: { 'Accept-Language': language },
            signal: signal || AbortSignal.timeout(8000)
        });
        const contentType = cityResponse.headers.get("content-type");
        if (cityResponse.ok && contentType && contentType.includes("application/json")) {
            return await cityResponse.json();
        }
        return [];
    };

    try {
        let rawResults = await performNominatimSearch(query);

        // FALLBACK STRATEGY: If no results, try to relax the query
        // Case: "Parking Oost UZ Leuven, Leuven" -> Nominatim finds nothing.
        // Try: "Parking Oost, Leuven"
        if ((!rawResults || rawResults.length === 0) && query.toLowerCase().includes('uz leuven')) {
            // Regex to Strip "UZ Leuven" or "Campus UZ Leuven" but keep the rest
            const relaxed = query.replace(/uz leuven/gi, '').replace(/campus/gi, '').replace(/bezoekersparking/gi, 'parking').replace(/\s+/g, ' ').trim();
            if (relaxed.length > 5 && relaxed !== query) {
                console.log(`Geocoding: Retrying with relaxed query '${relaxed}'`);
                const retryResults = await performNominatimSearch(relaxed);
                if (retryResults && retryResults.length > 0) {
                    rawResults = retryResults;
                }
            }
        }

        // Also try general "Parking X, City" -> "Parking X" if city matches context (handled by Nominatim usually, but sometimes fails)


        // Validate: If the first result is just the City itself, but our query was specific (e.g. "Parking X, City"), 
        // then Nominatim likely fell back to the city. We should REJECT this and try Photon.
        // Heuristic: If result name is short and contained in query, but query is much longer.
        if (rawResults && rawResults.length > 0) {
            const best = rawResults[0];
            const cleanQuery = query.toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
            const cleanResult = (best.display_name || "").toLowerCase().split(',')[0].trim();

            // Semantic Check: Is this a generic place (City) or a specific POI?
            const isGenericPlace = best.class === 'place' || best.class === 'boundary' || best.type === 'administrative';
            const isSpecificType = best.class === 'amenity' || best.class === 'tourism' || best.class === 'leisure' || best.class === 'shop' || best.type === 'parking';

            // Heuristic: If result is generic (e.g. "Leuven") but query is specific (e.g. "Parking X, Leuven"), reject it.
            // UNLESS it is classified as a specific POI (e.g. Type=parking), then we trust it even if name is short.
            if (!isSpecificType && cleanQuery.length > cleanResult.length + 5 && cleanQuery.includes(cleanResult)) {
                console.warn(`Nominatim returned generic '${cleanResult}' (${best.class}/${best.type}) for specific query '${cleanQuery}'. Ignoring to try fallback.`);
            } else {
                return rawResults;
            }
        }
    } catch (err) {
        if (err.name === 'AbortError') throw err;
        console.warn("Nominatim search failed, trying Photon fallback...", err);
    }

    // 2. Try Photon API (Fallback)
    // Photon is very lenient and fast.
    try {
        // Photon supports limited languages (en, de, fr, it). Defaulting to 'en' or mapping 'nl'->'de'/'en' might be validation.
        // We'll stick to 'en' or requested language if supported, but Photon URL param is 'lang'.
        const photonLang = ['en', 'de', 'fr', 'it'].includes(language) ? language : 'en';

        const photonRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=${photonLang}`, {
            signal: signal || AbortSignal.timeout(5000)
        });
        const photonData = await photonRes.json();

        if (photonData && photonData.features && photonData.features.length > 0) {
            // Map Photon GeoJSON to pseudo-Nominatim format
            return photonData.features.map(f => {
                const p = f.properties;
                const parts = [p.name, p.city, p.state, p.country].filter(Boolean);
                return {
                    lat: f.geometry.coordinates[1].toString(), // Photon is [lon, lat]
                    lon: f.geometry.coordinates[0].toString(),
                    display_name: parts.join(", "),
                    name: p.name,
                    address: {
                        city: p.city || p.name,
                        state: p.state,
                        country: p.country,
                        town: p.town,
                        village: p.village
                    },
                    importance: 0.5 // Default importance
                };
            });
        }
    } catch (errPhoton) {
        if (errPhoton.name === 'AbortError') throw errPhoton;
        console.warn("Photon search failed, trying OpenMeteo fallback...", errPhoton);
    }

    // 3. Try OpenMeteo Geocoding (Robust Fallback)
    try {
        const omRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=${language}&format=json`, {
            signal: signal || AbortSignal.timeout(5000)
        });
        const omData = await omRes.json();

        if (omData && omData.results && omData.results.length > 0) {
            return omData.results.map(r => ({
                lat: r.latitude.toString(),
                lon: r.longitude.toString(),
                display_name: `${r.name}, ${r.country} (${r.admin1 || ''})`,
                name: r.name,
                address: {
                    city: r.name,
                    state: r.admin1,
                    country: r.country
                },
                importance: 0.4
            }));
        }
    } catch (errOM) {
        if (errOM.name === 'AbortError') throw errOM;
        console.warn("OpenMeteo search failed.", errOM);
    }

    return [];
};
