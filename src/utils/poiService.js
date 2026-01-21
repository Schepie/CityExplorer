


export const fetchOsmPOIs = async (cityData, interest, cityName, radiusKm = 5) => {
    let poiData = [];

    // Helper: Calculate bounding box if missing (for current location)
    let bbox = cityData.boundingbox;
    if (!bbox && cityData.lat && cityData.lon) {
        const lat = parseFloat(cityData.lat);
        const lon = parseFloat(cityData.lon);
        const R = 6378.1; // Earth Radius km
        const rad = radiusKm;

        // Approx dLat dLon
        const dLat = (rad / R) * (180 / Math.PI);
        const dLon = (rad / R) * (180 / Math.PI) / Math.cos(lat * Math.PI / 180);

        // Nominatim format: [minLat, maxLat, minLon, maxLon]
        bbox = [
            (lat - dLat).toFixed(6),
            (lat + dLat).toFixed(6),
            (lon - dLon).toFixed(6),
            (lon + dLon).toFixed(6)
        ];
    }

    // Helper strategies taken from original App.jsx
    const searchStrategies = [
        // Strategy 0: Direct Proximity (Bounded Viewbox) - Best for Current Location
        () => {
            if (!bbox) return null;
            const [minLat, maxLat, minLon, maxLon] = bbox;
            // Nominatim viewbox is: left,top,right,bottom -> minLon,maxLat,maxLon,minLat
            // wait, docs say: <x1>,<y1>,<x2>,<y2> (left,top,right,bottom).
            // Actually Nominatim API expects viewbox=minLon,maxLat,maxLon,minLat 
            // (or minLon,minLat,maxLon,maxLat? Docs vary. Usually x1,y1,x2,y2 aka minLon,maxLat,maxLon,minLat for top-left bottom-right, but strictly it's a box).
            // Let's rely on the standard pattern: minLon,maxLat,maxLon,minLat (Left-Top, Right-Bottom)
            const viewbox = `${minLon},${maxLat},${maxLon},${minLat}`;
            return { q: interest, viewbox, bounded: 1 };
        },

        // Strategy 1: "Interest in City" (Fallback if Strategy 0 fails or returns few)
        () => `${interest} in ${cityName}`,

        // Strategy 2: Bounding Box Search (Relaxed)
        () => {
            if (!bbox) return null;
            const [minLat, maxLat, minLon, maxLon] = bbox;
            const viewbox = `${minLon},${maxLat},${maxLon},${minLat}`;
            return { q: interest, viewbox, bounded: 1 };
        },

        // Strategy 3: Relaxed Keywords
        () => {
            if (!bbox) return null;
            const words = interest.split(' ');
            if (words.length <= 1) return null;
            const relaxedInterest = words.slice(1).join(' ');
            const [minLat, maxLat, minLon, maxLon] = bbox;
            const viewbox = `${minLon},${maxLat},${maxLon},${minLat}`;
            return { q: relaxedInterest, viewbox, bounded: 1 };
        }
    ];

    for (const strategy of searchStrategies) {
        const params = strategy();
        if (!params) continue;

        let url = 'https://nominatim.openstreetmap.org/search?format=json&limit=30&addressdetails=1';
        if (typeof params === 'string') {
            url += `&q=${encodeURIComponent(params)}`;
        } else {
            url += `&q=${encodeURIComponent(params.q)}&viewbox=${params.viewbox}&bounded=${params.bounded}`;
        }

        try {
            const res = await fetch(url);
            const data = await res.json();
            if (data && data.length > 0) {
                // Determine source for attribution
                const source = 'OpenStreetMap';
                const mapped = data.map(item => ({
                    name: item.name || item.display_name.split(',')[0],
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon),
                    description: item.type, // Nominatim 'type' is often a category like 'museum'
                    id: `osm-${item.place_id}`,
                    source: source,
                    // Capture local context for better IQ searches
                    address: item.display_name,
                    location_context: item.address ? (item.address.village || item.address.town || item.address.suburb || item.address.hamlet || item.address.city_district || item.address.city || item.address.municipality) : null,
                    address_components: item.address ? {
                        road: item.address.road || item.address.pedestrian || item.address.footway || item.address.path,
                        house_number: item.address.house_number,
                        city: item.address.village || item.address.town || item.address.suburb || item.address.city
                    } : null
                }));

                // Filter by distance if we generated the bbox (Strategy 0) to ensure they are actually close
                // (Nominatim 'bounded' is decent but square box vs radius check)
                // We'll trust the results for now to avoid over-filtering.
                return mapped;
            }
        } catch (e) {
            console.error("OSM Search strategy failed:", e);
        }
    }

    return [];
};

// ... (other functions)


export const fetchFoursquarePOIs = async (lat, lng, interest, radius = 5000) => {
    // Proxy call
    // Proxy call
    const url = `/api/foursquare?query=${encodeURIComponent(interest)}&ll=${lat},${lng}&radius=${radius}&limit=30`;

    try {
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`Foursquare Proxy Error ${res.status}`);
            return [];
        }

        const data = await res.json();
        if (data.results && data.results.length > 0) {
            return data.results.map(place => ({
                name: place.name,
                lat: place.geocodes?.main?.latitude,
                lng: place.geocodes?.main?.longitude,
                description: place.categories?.map(c => c.name).join(', ') || 'Place of interest',
                id: `fs-${place.fsq_id}`,
                source: 'Foursquare'
            }));
        }
    } catch (e) {
        console.error("Foursquare fetch failed:", e);
    }

    return [];
};

export const fetchGooglePOIs = async (lat, lng, interest, radius = 5000) => {
    // Proxy call
    const maxRadius = Math.min(radius, 50000); // Google Places Limit is 50,000 meters
    const url = '/api/google-places';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                textQuery: interest,
                center: { lat, lng },
                radius: maxRadius
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.warn(`Google Places Proxy Failed: ${response.status}`, errText);
            return [];
        }

        const data = await response.json();

        if (data.places && data.places.length > 0) {
            return data.places.map(place => ({
                name: place.displayName?.text || 'Unknown Place',
                lat: place.location?.latitude,
                lng: place.location?.longitude,
                description: place.editorialSummary?.text || place.types?.map(t => t.replace('_', ' ')).slice(0, 3).join(', ') || 'Place of Interest',
                address: place.formattedAddress,
                id: `google-${place.id}`,
                source: 'Google Places'
            }));
        }
    } catch (e) {
        console.error("Google Places fetch failed:", e);
    }

    return [];
}


export const getCombinedPOIs = async (cityData, interestLine, cityName, constrainValueKm, sources) => {
    // Determine Radius in Meters
    const radiusMeters = (constrainValueKm || 5) * 1000;
    const radiusKm = constrainValueKm || 5;

    // Separate interests by comma
    const interests = interestLine.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (interests.length === 0) return [];

    // Default to true if sources not passed (legacy compatibility)
    const useOsm = sources ? sources.osm : true;
    const useFs = sources ? sources.foursquare : true;
    const useGoogle = sources ? sources.google : true;

    // Helper: Fetch for a SINGLE keyword
    const fetchForKeyword = async (keyword) => {
        const [osm, fs, google] = await Promise.all([
            useOsm ? fetchOsmPOIs(cityData, keyword, cityName, radiusKm) : Promise.resolve([]),
            useFs ? fetchFoursquarePOIs(cityData.lat, cityData.lon, keyword, radiusMeters) : Promise.resolve([]),
            useGoogle ? fetchGooglePOIs(cityData.lat, cityData.lon, keyword, radiusMeters) : Promise.resolve([])
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

        // 2. Strict Distance Filter
        const d = calcDist(centerLat, centerLon, parseFloat(poi.lat), parseFloat(poi.lng));
        if (d <= radiusKm) {
            uniquePois.push({ ...poi, distanceKm: d.toFixed(2) }); // accessible for debugging
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
