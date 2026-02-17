

import { apiFetch } from './api.js';

// ============================================================================
// OVERPASS API IMPLEMENTATION (Replaces Nominatim)
// ============================================================================

/**
 * Map interest keywords to Overpass OSM tags
 * Supports both English and Dutch keywords
 */
/**
 * Map interest keywords to Overpass QL filters (Regex/OR logic)
 * Returns array of raw QL filter strings (e.g., '["tourism"~"museum|gallery"]')
 */
const mapInterestToTags = (interest) => {
    const lowerInterest = interest.toLowerCase().trim();

    // 1. POPULARITY FILTER (Wikipedia)
    // If "must-see", "top", "famous", "highlight" -> requires wikipedia tag
    const isPopular = ['must-see', 'top', 'famous', 'highlight', 'beroemd', 'populair'].some(k => lowerInterest.includes(k));
    const wikiFilter = isPopular ? '["wikipedia"]' : '';

    // 2. CATEGORY MAPPING (Using exact match '=' when possible for performance)
    const mappings = [
        {
            keys: ['sight', 'bezienswaardig', 'attraction', 'landmark', 'toerist', 'tourist', 'monument', 'historic', 'historisch', 'castle', 'kasteel', 'church', 'kerk', 'chapel', 'kapel', 'ruin'],
            filters: [
                `["tourism"="attraction"]${wikiFilter}`,
                `["historic"="monument"]${wikiFilter}`,
                `["historic"="memorial"]${wikiFilter}`,
                `["historic"="castle"]${wikiFilter}`,
                `["historic"="ruins"]${wikiFilter}`,
                `["historic"="city_gate"]${wikiFilter}`,
                `["historic"="battlefield"]${wikiFilter}`,
                `["historic"="fort"]${wikiFilter}`,
                `["heritage"]${wikiFilter}`
            ]
        },
        {
            keys: ['museum', 'musea', 'art', 'kunst', 'gallery', 'galerij', 'culture', 'cultuur', 'exhibition', 'tentoonstelling'],
            filters: [
                `["tourism"="museum"]${wikiFilter}`,
                `["tourism"="artwork"]${wikiFilter}`,
                `["tourism"="gallery"]${wikiFilter}`,
                `["amenity"="arts_centre"]${wikiFilter}`,
                `["historic"="manor"]${wikiFilter}`
            ]
        },
        {
            keys: ['park', 'garden', 'tuin', 'nature', 'natuur', 'forest', 'bos', 'water', 'beach', 'strand', 'lake', 'meer'],
            filters: [
                `["leisure"="park"]${wikiFilter}`,
                `["leisure"="garden"]${wikiFilter}`,
                `["leisure"="nature_reserve"]${wikiFilter}`,
                `["natural"="beach"]${wikiFilter}`,
                `["natural"="water"]${wikiFilter}`,
                `["natural"="wood"]${wikiFilter}`,
                `["landuse"="forest"]${wikiFilter}`,
                `["boundary"="national_park"]${wikiFilter}`
            ]
        },
        {
            keys: ['viewpoint', 'uitzicht', 'scenic', 'panorama'],
            filters: [`["tourism"="viewpoint"]${wikiFilter}`]
        },
        {
            keys: ['shop', 'winkel', 'market', 'markt'],
            filters: [`["shop"]${wikiFilter}`, `["amenity"="marketplace"]${wikiFilter}`]
        },
        {
            keys: ['food', 'eten', 'restaurant', 'cafe', 'bar', 'pub'],
            filters: [
                `["amenity"="restaurant"]${wikiFilter}`,
                `["amenity"="cafe"]${wikiFilter}`,
                `["amenity"="bar"]${wikiFilter}`,
                `["amenity"="pub"]${wikiFilter}`,
                `["amenity"="ice_cream"]${wikiFilter}`
            ]
        },
        {
            keys: ['drink', 'drank', 'alcohol'],
            filters: [`["amenity"="bar"]${wikiFilter}`, `["amenity"="pub"]${wikiFilter}`, `["amenity"="biergarten"]${wikiFilter}`]
        },
        {
            keys: ['entertainment', 'theater', 'cinema', 'bioscoop'],
            filters: [
                `["amenity"="theatre"]${wikiFilter}`,
                `["amenity"="cinema"]${wikiFilter}`,
                `["amenity"="casino"]${wikiFilter}`,
                `["amenity"="nightclub"]${wikiFilter}`
            ]
        },
        {
            keys: ['sport', 'swimming', 'zwemmen', 'playground', 'speeltuin'],
            filters: [
                `["leisure"="sports_centre"]${wikiFilter}`,
                `["leisure"="swimming_pool"]${wikiFilter}`,
                `["leisure"="playground"]${wikiFilter}`,
                `["leisure"="water_park"]${wikiFilter}`
            ]
        }
    ];

    // Find match
    for (const mapping of mappings) {
        if (mapping.keys.some(k => lowerInterest.includes(k))) {
            return mapping.filters;
        }
    }

    // Default Fallback (General Sights)
    // If generic search or empty, return broad Sights/Historic/Museum categories
    // This effectively filters out random shops/restaurants unless explicitly asked.
    return [
        `["tourism"="attraction"]${wikiFilter}`,
        `["tourism"="museum"]${wikiFilter}`,
        `["tourism"="viewpoint"]${wikiFilter}`,
        `["tourism"="artwork"]${wikiFilter}`,
        `["tourism"="gallery"]${wikiFilter}`,
        `["historic"="monument"]${wikiFilter}`,
        `["historic"="memorial"]${wikiFilter}`,
        `["historic"="castle"]${wikiFilter}`,
        `["historic"="ruins"]${wikiFilter}`,
        `["historic"="city_gate"]${wikiFilter}`,
        `["leisure"="park"]${wikiFilter}`,
        `["leisure"="garden"]${wikiFilter}`,
        `["leisure"="nature_reserve"]${wikiFilter}`
    ];
};

/**
 * Build Overpass QL query from bounding box and QL filters
 */
const buildOverpassQuery = (bbox, filters) => {
    const [minLat, maxLat, minLon, maxLon] = bbox;
    const bboxStr = `${minLat},${minLon},${maxLat},${maxLon}`;

    // METHOD 1: Use 'nwr' (Nodes, Ways, Relations) for full coverage
    // METHOD 2: Union the filters (OR Logic)
    const unionParts = filters.map(filter => `nwr${filter}(${bboxStr});`).join('\n            ');

    const query = `
        [out:json][timeout:12];
        (
            ${unionParts}
        );
        out center 200;
    `.trim();

    return query;
};

/**
 * Transform Overpass results to standard POI format
 */
const transformOverpassResults = (elements, cityName) => {
    if (!elements || elements.length === 0) return [];

    return elements
        .filter(el => {
            // Must have a name
            if (!el.tags?.name) return false;

            // EXCLUDE HOTELS/LODGING (unless historic/attraction)
            const tourism = el.tags?.tourism;
            if (tourism && ['hotel', 'hostel', 'guest_house', 'motel', 'apartment', 'camp_site', 'chalet'].includes(tourism)) {
                // Allow if it has historic value or explicit attraction tag
                const isHistoric = el.tags.historic || el.tags.heritage || el.tags.building === 'castle';
                const isAttraction = el.tags.tourism === 'attraction'; // Unlikely if it's 'hotel', but maybe dual tagged?

                if (!isHistoric && !isAttraction) return false;
            }

            // Get coordinates (nodes have lat/lon, ways/relations have center)
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;

            return lat && lon;
        })
        .map(el => {
            const lat = el.lat || el.center?.lat;
            const lon = el.lon || el.center?.lon;

            // Extract description from tags
            let description = '';
            if (el.tags.tourism) description = el.tags.tourism;
            else if (el.tags.historic) description = el.tags.historic;
            else if (el.tags.amenity) description = el.tags.amenity;
            else if (el.tags.leisure) description = el.tags.leisure;
            else if (el.tags.shop) description = 'shop';

            // Build address from tags
            const address = [
                el.tags['addr:street'],
                el.tags['addr:housenumber'],
                el.tags['addr:city'] || cityName
            ].filter(Boolean).join(', ');

            return {
                name: el.tags.name,
                lat: parseFloat(lat),
                lng: parseFloat(lon),
                description: description || 'point of interest',
                id: `osm-${el.type}-${el.id}`,
                source: 'OpenStreetMap',
                address: address || cityName,
                location_context: el.tags['addr:city'] || el.tags['addr:suburb'] || cityName,
                address_components: {
                    road: el.tags['addr:street'],
                    house_number: el.tags['addr:housenumber'],
                    city: el.tags['addr:city'] || cityName
                }
            };
        }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
};

/**
 * Fetch POIs from OpenStreetMap using Overpass API
 * @param {Object} cityData - City data with lat/lon and optional boundingbox
 * @param {string} interest - Interest keyword (e.g., "museum", "park")
 * @param {string} cityName - Name of the city
 * @param {number} radiusKm - Search radius in kilometers (default 5)
 * @param {string} language - Language code (default 'en')
 * @returns {Promise<Array>} Array of POI objects
 */
export const fetchOsmPOIs = async (cityData, interest, cityName, radiusKm = 5, language = 'en', onProgress = null) => {
    // try { removed to handle errors internally in the retry loop
    // Calculate bounding box if missing
    // Calculate radius-based bbox
    let bbox = cityData.boundingbox;
    let radiusBbox = null;

    if (cityData.lat && cityData.lon) {
        const lat = parseFloat(cityData.lat);
        const lon = parseFloat(cityData.lon);
        const R = 6378.1; // Earth radius in km

        const dLat = (radiusKm / R) * (180 / Math.PI);
        const dLon = (radiusKm / R) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);

        radiusBbox = [
            (lat - dLat).toFixed(6),
            (lat + dLat).toFixed(6),
            (lon - dLon).toFixed(6),
            (lon + dLon).toFixed(6)
        ];
    }

    // PRIORITIZE RADIUS IF LARGE (e.g. > 15km) to cover route area
    // Otherwise use strict city bbox for precision
    if (radiusKm > 15 && radiusBbox) {
        bbox = radiusBbox;
        console.log(`Using radius-based bbox (${radiusKm}km) instead of city boundary`);
    } else if (!bbox && radiusBbox) {
        bbox = radiusBbox;
    }


    if (!bbox) {
        console.warn('No bounding box available for Overpass query');
        return [];
    }

    // Map interest to OSM tags
    const tags = mapInterestToTags(interest);
    if (!tags || tags.length === 0) {
        console.warn(`No tag mapping found for interest: ${interest}`);
        return [];
    }

    // Build Overpass query
    const query = buildOverpassQuery(bbox, tags);

    // CACHE CHECK (Local Storage)
    // We cache based on the generated Query string, which is unique to bbox + interest
    const cacheKey = `overpass_search_${interest}_${bbox.join('_')}`;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            // Cache valid for 24 hours (86400000 ms) for search results
            if (Date.now() - parsed.timestamp < 86400000) {
                console.log(`[Overpass] Cache Hit for "${interest}"`);
                return parsed.data;
            } else {
                localStorage.removeItem(cacheKey);
            }
        }
    } catch (e) {
        console.warn("Cache read error", e);
    }

    // List of Overpass servers for failover
    const servers = [
        'https://overpass-api.de/api/interpreter',
        'https://overpass.openstreetmap.fr/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass.osm.ch/api/interpreter'
    ];

    let attempts = 0;
    const maxAttempts = servers.length; // Try each server once

    // Randomize starting server to avoid hammering the first one
    let serverIndex = Math.floor(Math.random() * servers.length);

    while (attempts < maxAttempts) {
        const currentServer = servers[serverIndex];
        // Rotate to next server for subsequent attempts
        serverIndex = (serverIndex + 1) % servers.length;

        const url = `${currentServer}?data=${encodeURIComponent(query)}`;

        try {
            const controller = new AbortController();
            // Timeout 12s to match Overpass standard
            const timeoutId = setTimeout(() => controller.abort(), 12000);

            // Add jitter to prevent thundering herd (0-1000ms delay)
            const jitter = Math.floor(Math.random() * 1000);
            await new Promise(r => setTimeout(r, jitter));

            console.log(`Querying Overpass Server: ${currentServer} (Attempt ${attempts + 1})`);

            const res = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'CityExplorer/1.0 (Student Project; educational use)',
                    'Accept': 'application/json'
                }
            });
            clearTimeout(timeoutId);

            // Handle Rate Limiting (429) or Server Error (5xx)
            if (res.status === 429 || res.status >= 500) {
                const msg = language === 'nl'
                    ? `Server druk (${res.status}), wissel naar backup...`
                    : `Server busy (${res.status}), switching to backup...`;
                console.warn(`[Overpass] ${res.status} on ${currentServer}. ${msg}`);
                if (onProgress) onProgress(msg);

                attempts++;
                continue; // IMMEDIATE FAILOVER (No sleep)
            }

            if (!res.ok) {
                throw new Error(`Overpass API returned ${res.status}`);
            }

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (jsonErr) {
                console.warn(`[Overpass] Invalid JSON from ${currentServer}. Response snippet: ${text.substring(0, 200)}...`);
                throw new Error(`Invalid JSON response: ${jsonErr.message}`);
            }

            // Transform and return results
            const pois = transformOverpassResults(data.elements, cityName);

            // Success log
            if (pois.length > 0) {
                console.log(`Overpass API found ${pois.length} POIs for "${interest}"`);
                // CACHE WRITE
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({
                        data: pois,
                        timestamp: Date.now()
                    }));
                } catch (e) {
                    console.warn("Cache write error (quota?)", e);
                }
            }
            return pois;

        } catch (e) {
            // If last attempt, throw
            if (attempts === maxAttempts - 1) {
                console.error(`Overpass API failed after ${maxAttempts} attempts:`, e);
                return []; // Return empty instead of crashing the whole Promise.all chain
            }

            // Log and retry
            console.warn(`Overpass Error (${e.name}: ${e.message}). Retrying...`);
            if (onProgress) onProgress(language === 'nl' ? "Verbinding optimaliseren..." : "Optimizing connection...");
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
        }
    }
    return [];
}; // End of fetchOsmPOIs

// ... (other functions)


export const fetchFoursquarePOIs = async (lat, lng, interest, radius = 5000, language = 'en') => {
    // Proxy call
    // Proxy call
    const url = `/api/foursquare?query=${encodeURIComponent(interest)}&ll=${lat},${lng}&radius=${radius}&limit=30&locale=${language}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s

        const res = await apiFetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!res.ok) {
            console.warn(`Foursquare Proxy Error ${res.status}`);
            return [];
        }

        const data = await res.json();
        if (data.results && data.results.length > 0) {
            return data.results.map(place => ({
                name: place.name,
                lat: parseFloat(place.geocodes?.main?.latitude),
                lng: parseFloat(place.geocodes?.main?.longitude),
                description: place.categories?.map(c => c.name).join(', ') || 'Place of interest',
                id: `fs-${place.fsq_id}`,
                source: 'Foursquare'
            })).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
        }
    } catch (e) {
        console.error("Foursquare fetch failed:", e);
    }

    return [];
};

export const fetchGooglePOIs = async (lat, lng, interest, radius = 5000, language = 'en') => {
    // Proxy call
    const maxRadius = Math.min(radius, 50000); // Google Places Limit is 50,000 meters
    const url = '/api/google-places';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s

        const response = await apiFetch(url, {
            method: 'POST',
            body: JSON.stringify({
                textQuery: interest,
                center: { lat, lng },
                radius: maxRadius,
                languageCode: language
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            console.warn(`Google Places Proxy Failed: ${response.status}`, errText);
            return [];
        }

        const data = await response.json();

        if (data.places && data.places.length > 0) {
            return data.places.map(place => ({
                name: place.displayName?.text || 'Unknown Place',
                lat: parseFloat(place.location?.latitude),
                lng: parseFloat(place.location?.longitude),
                description: place.editorialSummary?.text || place.types?.map(t => t.replace('_', ' ')).slice(0, 3).join(', ') || 'Place of Interest',
                address: place.formattedAddress,
                id: `google-${place.id}`,
                source: 'Google Places'
            })).filter(p => !isNaN(p.lat) && !isNaN(p.lng));
        }
    } catch (e) {
        console.error("Google Places fetch failed:", e);
    }

    return [];
}


export const getCombinedPOIs = async (cityData, interestLine, cityName, constrainValueKm, sources, language = 'en', onProgress = null) => {
    // Determine Radius in Meters
    const radiusMeters = (constrainValueKm || 5) * 1000;
    const radiusKm = constrainValueKm || 5;

    // Separate interests by comma
    let interests = [];
    if (interestLine && interestLine.trim().length > 0) {
        interests = interestLine.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    // Default interests when none specified
    if (interests.length === 0) {
        interests = [
            "Bezienswaardigheden", "Must-see", "Historisch", "Monument",
            "Musea", "Kunst & design", "Tentoonstellingen", "Erfgoed",
            "Parken & natuur", "Uitzichtpunten", "Wandelen", "Water & strand"
        ];
    }

    // Default to true if sources not passed (legacy compatibility)
    const useOsm = sources ? sources.osm : true;
    const useFs = sources ? sources.foursquare : true;
    const useGoogle = sources ? sources.google : true;

    // Helper: Fetch for a SINGLE keyword
    const fetchForKeyword = async (keyword) => {
        const [osm, fs, google] = await Promise.all([
            useOsm ? fetchOsmPOIs(cityData, keyword, cityName, radiusKm, language, onProgress) : Promise.resolve([]),
            useFs ? fetchFoursquarePOIs(cityData.lat, cityData.lon, keyword, radiusMeters, language) : Promise.resolve([]),
            useGoogle ? fetchGooglePOIs(cityData.lat, cityData.lon, keyword, radiusMeters, language) : Promise.resolve([])
        ]);
        return [...google, ...fs, ...osm];
    };

    // Run searches for ALL keywords in parallel
    const resultsArrays = await Promise.all(interests.map(k => fetchForKeyword(k)));
    const allPois = resultsArrays.flat();

    // Helper: Haversine Distance
    const calcDist = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const centerLat = parseFloat(cityData.lat);
    const centerLon = parseFloat(cityData.lon);

    // Rudimentary deduplication by name (normalized) AND Distance Filtering
    const uniquePois = [];
    const seenNames = new Set();

    for (const poi of allPois) {
        // 1. Dedupe
        const normName = poi.name.toLowerCase().trim();
        if (seenNames.has(normName)) continue;

        // 2. Strict Filter: EXCLUSIONS (Hard Filter)
        // User Rules: NO Parking, Offices, Consulting, Technical Infra, etc.
        const forbiddenTerms = [
            'parking', 'parkeer', 'garage', 'p+r',
            'architect', 'studio', 'bureau',
            'office', 'kantoor', 'consultan', 'agency',
            'accounting', 'lawyer', 'advocaat', 'notaris',
            'insurance', 'verzekering',
            'real estate', 'makelaar', 'immobili',
            'logistics', 'transport', 'shipping',
            'plumber', 'loodgieter', 'electrician',
            'dentist', 'tandarts', 'doctor', 'dokter', 'clinic', 'kliniek',
            'pharmacy', 'apotheek', // Usually not a tourist destination unless historical
            'supermarket', 'supermarkt', 'albert heijn', 'jumbo', 'lidl', 'aldi', // Grocery stores
            'atm', 'bancontact', 'bank',
            'school', 'university', 'universiteit', 'college', // Unless specifically a "Museum of..."
            'gym', 'fitness', 'sport',
            'hair', 'kapper', 'salon',
            'laundry', 'wasserette',
            'driving school', 'rijschool',
            // --- NEW: Restaurant / Food exclusion ---
            'restaurant', 'cafe', 'café', 'bistro', 'eatery', 'food', 'eten', 'diner', 'lunch',
            'snackbar', 'fastfood', 'fast food', 'pizzeria', 'grill', 'bar', 'pub', 'kroeg',
            // --- NEW: Bookstore exclusion ---
            'boekwinkel', 'boekhandel', 'bookstore', 'boeken',
            // --- NEW: Retail / Shopping exclusion (User Request) ---
            'jewelry', 'juwelier', 'jewel', 'sieraad',
            'shoe', 'schoen', 'footwear',
            'clothing', 'kleding', 'fashion', 'mode', 'boutique', 'boetiek',
            'store', 'winkel', 'shop', 'outlet', 'mall', 'shopping',
            'furniture', 'meubel', 'electronics', 'elektronica', 'phone', 'telefoon'
        ];

        // Check if the user EXPLICITLY asked for food/drink in the search query
        // Check if the user EXPLICITLY asked for restricted items (food/bookstores) in the search query
        const specialTerms = [
            'restaurant', 'cafe', 'café', 'eten', 'food', 'drink', 'bar', 'pub', 'kroeg', 'koffie', 'coffee', 'lunch', 'diner', 'ontbijt', 'breakfast',
            'boekwinkel', 'boekhandel', 'bookstore', 'boeken', 'books',
            'jewelry', 'juwelier', 'shoe', 'schoen', 'clothing', 'kleding', 'boutique', 'boetiek', 'shop', 'winkel', 'store', 'shopping', 'mall'
        ];
        const explicitlyRequestedSpecial = interests.some(interest =>
            specialTerms.some(term => interest.toLowerCase().includes(term))
        );

        // Also check description/type if available
        const descriptionLower = (poi.description || "").toLowerCase();
        const typeLower = (poi.type || "").toLowerCase(); // Some sources might have type

        const isForbidden = forbiddenTerms.some(term =>
            normName.includes(term) ||
            descriptionLower.includes(term) ||
            typeLower.includes(term)
        );

        if (isForbidden) {
            // Restriction: Only bypass if explicitly requested AND it's a special term (food/books)
            const isSpecialTerm = [
                'restaurant', 'cafe', 'café', 'bistro', 'eatery', 'food', 'eten', 'diner', 'lunch',
                'snackbar', 'fastfood', 'pizzeria', 'grill', 'bar', 'pub', 'kroeg',
                'boekwinkel', 'boekhandel', 'bookstore', 'boeken',
                'jewelry', 'juwelier', 'shoe', 'schoen', 'clothing', 'kleding', 'boutique', 'boetiek', 'shop', 'winkel', 'store', 'shopping', 'mall'
            ].some(t => normName.includes(t) || descriptionLower.includes(t) || typeLower.includes(t));

            if (isSpecialTerm && explicitlyRequestedSpecial) {
                // Allow
            } else {
                // Check other whitelists (museums, etc.)
                const whitelist = ['museum', 'gallery', 'histor', 'visit', 'tour', 'monument', 'church', 'kerk', 'kasteel', 'castle'];
                const isWhitelisted = whitelist.some(w => normName.includes(w) || descriptionLower.includes(w));

                if (!isWhitelisted) {
                    continue; // Skip this POI
                }
            }
        }

        // 3. Strict Distance Filter
        const d = calcDist(centerLat, centerLon, parseFloat(poi.lat), parseFloat(poi.lng));
        if (d <= radiusKm) {
            uniquePois.push({ ...poi, dist_km: parseFloat(d.toFixed(2)) });
            seenNames.add(normName);
        }
    }

    // If NO results found found across ALL keywords, return empty (caller usually handles refinement prompt).
    // If PARTIAL results (some keywords found nothing), we silently return what we found.
    // The requirement says: "If one of the words is not understood, the app should only ask to clarify that word."
    // Implementing exact "ask to clarify THAT word" requires changing the return shape to include failed keywords.
    // For now, let's return the combined list. If empty, the App handles the generic "No results" prompting.
    // To support per-word failure, we'd need to return { pois: [], failedKeywords: [] }.

    // Let's refine the return to support the requirement: "only ask to clarify that word".
    // We check which keywords produced 0 results.
    const failedKeywords = [];
    for (let i = 0; i < interests.length; i++) {
        if (resultsArrays[i].length === 0) {
            failedKeywords.push(interests[i]);
        }
    }

    // However, the current App.jsx expects an array of POIs.
    // We will attach the failed keywords as a property to the array to avoid breaking the signature too much,
    // or we just return the array and let the user re-try if they see missing stuff.
    // But the user EXPLICITLY asked for this behavior.
    // Let's attach it to the array instance.
    uniquePois.failedKeywords = failedKeywords;

    return uniquePois;
}

export const fetchGenericSuggestions = async (cityName) => {
    try {
        const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent('tourism in ' + cityName)}`;
        const fbRes = await fetch(fallbackUrl);
        const fbData = await fbRes.json();
        if (fbData && fbData.length > 0) {
            return fbData.map(i => i.name || i.display_name.split(',')[0]).filter(n => n);
        }
    } catch (e) {
        console.warn("Fallback failed", e);
    }
    return [];
};

export const getInterestSuggestions = (failedInterest, language = 'en') => {
    const raw = failedInterest.toLowerCase().trim();
    const suggestions = new Set();
    const lang = language === 'nl' ? 'nl' : 'en';

    // 1. Keyword Mapping (Keys are English/Universal, Values are Localized)
    const mappings = [
        {
            keys: ['eat', 'food', 'lunch', 'dinner', 'snack', 'hungry', 'eten', 'voedsel', 'diner', 'lunch', 'honger'],
            values: { en: ['Restaurant', 'Bistro', 'Cafe', 'Fast Food'], nl: ['Restaurant', 'Bistro', 'Cafe', 'Snackbar'] }
        },
        {
            keys: ['drink', 'beer', 'wine', 'cocktail', 'pub', 'bar', 'club', 'drank', 'bier', 'wijn'],
            values: { en: ['Bar', 'Pub', 'Nightclub', 'Biergarten'], nl: ['Bar', 'Kroeg', 'Nachtclub', 'Biergarten'] }
        },
        {
            keys: ['coffee', 'tea', 'latte', 'espresso', 'koffie', 'thee'],
            values: { en: ['Cafe', 'Coffee Shop', 'Bakery'], nl: ['Cafe', 'Koffiehuis', 'Bakkerij'] }
        },
        {
            keys: ['nature', 'green', 'walk', 'hike', 'tree', 'flower', 'natuur', 'groen', 'wandelen', 'boom', 'bloem'],
            values: { en: ['Park', 'Garden', 'Forest', 'Nature Reserve'], nl: ['Park', 'Tuin', 'Bos', 'Natuurgebied'] }
        },
        {
            keys: ['history', 'old', 'ancient', 'culture', 'geschiedenis', 'oud', 'cultuur'],
            values: { en: ['Museum', 'Historic Site', 'Castle', 'Monument'], nl: ['Museum', 'Historische Plek', 'Kasteel', 'Monument'] }
        },
        {
            keys: ['art', 'painting', 'gallery', 'statue', 'kunst', 'schilderij', 'galerij', 'standbeeld'],
            values: { en: ['Art Gallery', 'Museum', 'Artwork'], nl: ['Kunstgalerij', 'Museum', 'Kunstwerk'] }
        },
        {
            keys: ['shop', 'store', 'buy', 'mall', 'fashion', 'winkel', 'kopen', 'mode'],
            values: { en: ['Shopping Mall', 'Boutique', 'Supermarket', 'Market'], nl: ['Winkelcentrum', 'Boetiek', 'Supermarkt', 'Markt'] }
        },
        {
            keys: ['view', 'lookout', 'scenic', 'photo', 'uitzicht', 'foto'],
            values: { en: ['Viewpoint', 'Observation Deck', 'Attraction'], nl: ['Uitzichtpunt', 'Observatiedek', 'Attractie'] }
        },
        {
            keys: ['kid', 'child', 'family', 'play', 'kind', 'familie', 'spelen'],
            values: { en: ['Playground', 'Theme Park', 'Zoo', 'Aquarium'], nl: ['Speeltuin', 'Pretpark', 'Dierentuin', 'Aquarium'] }
        }
    ];

    for (const m of mappings) {
        if (m.keys.some(k => raw.includes(k))) {
            m.values[lang].forEach(v => suggestions.add(v));
        }
    }

    // 2. Default suggestions if map is weak
    if (suggestions.size < 3) {
        if (lang === 'nl') {
            suggestions.add('Toeristische Attractie');
            suggestions.add('Museum');
            suggestions.add('Park');
            suggestions.add('Restaurant');
        } else {
            suggestions.add('Tourist Attraction');
            suggestions.add('Museum');
            suggestions.add('Park');
            suggestions.add('Restaurant');
        }
    }

    return Array.from(suggestions).slice(0, 5); // Return top 5
};
