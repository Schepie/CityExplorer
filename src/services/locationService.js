import { apiFetch } from '../utils/api';
import { getDistance } from '../utils/routePathUtils';

/**
 * Validates a city name or query against multiple geocoding providers.
 */
export const validateCity = async (query, language = 'nl') => {
    if (!query || query.length < 2) return [];

    let results = [];
    try {
        // 1. Try Nominatim (via Local Proxy to avoid CORS)
        const cityResponse = await apiFetch(`/api/nominatim?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`, {
            headers: { 'Accept-Language': language },
            signal: AbortSignal.timeout(8000)
        });

        const contentType = cityResponse.headers.get("content-type");
        if (cityResponse.ok && contentType && contentType.includes("application/json")) {
            results = await cityResponse.json();
        } else {
            const errText = await cityResponse.text().catch(() => "Unknown error");
            throw new Error(`Nominatim Proxy failed: ${cityResponse.status} ${errText.substring(0, 50)}`);
        }
    } catch (err) {
        console.warn("Nominatim search failed, trying Photon fallback...", err);
        try {
            // 2. Try Photon API (Fallback)
            const photonRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=en`, {
                signal: AbortSignal.timeout(5000)
            });
            const photonData = await photonRes.json();

            if (photonData && photonData.features) {
                results = photonData.features.map(f => {
                    const p = f.properties;
                    const parts = [p.name, p.city, p.state, p.country].filter(Boolean);
                    return {
                        lat: f.geometry.coordinates[1].toString(),
                        lon: f.geometry.coordinates[0].toString(),
                        display_name: parts.join(", "),
                        name: p.name,
                        address: {
                            city: p.city || p.name,
                            state: p.state,
                            country: p.country
                        },
                        importance: 0.5
                    };
                });
            }
        } catch (errPhoton) {
            console.warn("Photon search failed, trying OpenMeteo fallback...", errPhoton);
            try {
                // 3. Try OpenMeteo Geocoding
                const omRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=${language}&format=json`, {
                    signal: AbortSignal.timeout(5000)
                });
                const omData = await omRes.json();
                if (omData && omData.results) {
                    results = omData.results.map(r => ({
                        lat: r.latitude.toString(),
                        lon: r.longitude.toString(),
                        display_name: `${r.name}, ${r.country}`,
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
                console.error("All geocoding fallbacks failed", errOM);
            }
        }
    }
    return results;
};

/**
 * Deduplicates geocoding results based on distance and name.
 */
export const deduplicateResults = (results) => {
    const uniqueData = [];
    for (const item of results) {
        const isDuplicate = uniqueData.some(existing => {
            const nameMatch = existing.display_name.includes(item.name) || item.display_name.includes(existing.name);
            let dist = 9999;
            if (item.lat && existing.lat) {
                dist = getDistance(parseFloat(item.lat), parseFloat(item.lon), parseFloat(existing.lat), parseFloat(existing.lon));
            }
            return (dist < 5) || (existing.display_name === item.display_name);
        });
        if (!isDuplicate) uniqueData.push(item);
    }
    return uniqueData;
};

/**
 * Reverse geocodes coordinates to a city/location.
 */
export const reverseGeocode = async (lat, lon, language = 'nl') => {
    try {
        const res = await apiFetch(`/api/nominatim?format=json&lat=${lat}&lon=${lon}`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.address) {
                const addr = data.address;
                const foundCity = addr.city || addr.town || addr.village || addr.municipality;
                let displayName = foundCity;
                if (addr.country) displayName += `, ${addr.country}`;
                return {
                    lat: lat.toString(),
                    lon: lon.toString(),
                    name: foundCity,
                    display_name: displayName,
                    address: addr
                };
            }
        }
    } catch (err) {
        console.warn("Nominatim Reverse Geocode failed, trying fallback...", err);
    }

    // Fallback: BigDataCloud
    try {
        const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=${language === 'nl' ? 'nl' : 'en'}`);
        const data = await res.json();
        if (data && (data.city || data.locality)) {
            const foundCity = data.city || data.locality;
            let displayName = foundCity;
            if (data.countryName) displayName += `, ${data.countryName}`;
            return {
                lat: lat.toString(),
                lon: lon.toString(),
                name: foundCity,
                display_name: displayName,
                address: { city: foundCity, country: data.countryName }
            };
        }
    } catch (err) {
        console.warn("BigDataCloud reverse geocode failed", err);
    }

    // Absolute Fallback: Coordinates
    const label = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    return { lat, lon, name: label, display_name: label };
};
