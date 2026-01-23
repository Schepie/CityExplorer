
/**
 * Haversine distance between two points in km
 */
export const getDistance = (lat1, lon1, lat2, lon2) => {
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

/**
 * Estimation of travel time in minutes
 * Walking: 5 km/h
 * Cycling: 15 km/h
 */
export const getTimeEstimation = (distanceKm, mode = 'walk') => {
    const speed = mode === 'bike' || mode === 'cycling' ? 15 : 5;
    return (distanceKm / speed) * 60;
};

/**
 * find_places_near: Wraps the existing POI service
 * Use getCombinedPOIs but with specific lat/lng
 */
export async function find_places_near(getCombinedPOIs, near_lat, near_lng, categories, max_radius_m) {
    const cityData = { lat: near_lat, lon: near_lng, name: "Search Area" };
    const interestLine = (categories || []).join(', ');
    const radiusKm = (max_radius_m || 1000) / 1000;

    // Note: searchSources should be passed or defaulted. 
    // For simplicity, we'll assume a standard set.
    const sources = { osm: true, foursquare: true, google: true };

    return await getCombinedPOIs(cityData, interestLine, "Nearby", radiusKm, sources);
}

/**
 * route_distance_time: Basic point-to-point estimation
 */
export function route_distance_time(origin, destination, mode = 'walk') {
    const d = getDistance(origin.lat, origin.lng, destination.lat, destination.lng);
    const t = getTimeEstimation(d, mode);
    return { distance_m: Math.round(d * 1000), duration_min: Math.round(t * 10) / 10 };
}

/**
 * added_detour_if_inserted_after: Calculates how much distance is added by inserting a stop
 */
export function added_detour_if_inserted_after(route, insert_after_index, new_stop, mode = 'walk') {
    const pois = route.pois || [];
    const startLoc = { lat: route.center[0], lng: route.center[1] };

    const prev = (insert_after_index === -1) ? startLoc : pois[insert_after_index];
    const next = pois[insert_after_index + 1] || null;

    const d1 = getDistance(prev.lat, prev.lng, new_stop.lat, new_stop.lng);

    if (!next) {
        // If it's the end of a one-way trip, detour is just the leg to the new stop
        // (Assuming the journey ends there now)
        return { added_distance_m: Math.round(d1 * 1000), added_duration_min: Math.round(getTimeEstimation(d1, mode) * 10) / 10 };
    }

    const d2 = getDistance(new_stop.lat, new_stop.lng, next.lat, next.lng);
    const base = getDistance(prev.lat, prev.lng, next.lat, next.lng);

    const addedKm = d1 + d2 - base;
    return {
        added_distance_m: Math.round(addedKm * 1000),
        added_duration_min: Math.round(getTimeEstimation(addedKm, mode) * 10) / 10
    };
}

/**
 * distance_to_next_pois: Finds nearby POIs further along the route
 */
export function distance_to_next_pois(candidate, next_pois, mode = 'walk') {
    return next_pois.map(poi => {
        const res = route_distance_time(candidate, poi, mode);
        return {
            poi_index: poi.index,
            ...res
        };
    }).sort((a, b) => a.distance_m - b.distance_m);
}
