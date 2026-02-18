import { transformOSRMCoords, sanitizePath, isValidCoord } from './coordinateUtils';

/**
 * Haversine Distance Helper (km)
 */
export const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
};

/**
 * Centralized Sanitization for Route Data
 */
export const sanitizeRouteData = (data, defaultCenter = [52.3676, 4.9041]) => {
    if (!data) return null;

    const isNum = (v) => typeof v === 'number' && !isNaN(v);

    // Strip heavy enrichment-only fields that don't need to survive a page reload.
    // Keeps all display fields (name, description, image, link, short_description, etc.)
    const slimPoiForStorage = (p) => {
        const {
            // Graph scoring debug fields
            graphCentrality,
            consensusBoosted,
            // Wikidata canonical entity (large object, re-fetched on next enrichment)
            canonical,
            // Raw signal arrays (never needed after enrichment)
            signals,
            rawSignals,
            // structured_info can be large; keep only the display-critical sub-fields
            structured_info,
            // Cap images array at 1 item for storage
            images,
            // intelligence metadata
            intelligence,
            ...rest
        } = p;

        const slim = { ...rest };

        // Keep only top image to save space
        slim.image = slim.image || (images && images.length > 0 ? images[0] : null);
        slim.images = slim.image ? [slim.image] : [];

        // Preserve only the display-critical fields from structured_info
        if (structured_info) {
            slim.structured_info = {
                short_description: structured_info.short_description || '',
                full_description: structured_info.full_description || '',
                fun_facts: structured_info.fun_facts || [],
                one_fun_fact: structured_info.one_fun_fact || '',
                visitor_tips: structured_info.visitor_tips || '',
                two_minute_highlight: structured_info.two_minute_highlight || '',
                matching_reasons: structured_info.matching_reasons || [],
            };
        }

        return slim;
    };

    let cleanCenter = data.center;
    if (!cleanCenter || !isNum(cleanCenter[0]) || !isNum(cleanCenter[1])) {
        cleanCenter = defaultCenter;
    }

    const cleanPois = (data.pois || []).map(p => ({
        ...slimPoiForStorage(p),
        lat: isNum(p.lat) ? p.lat : (isNum(parseFloat(p.lat)) ? parseFloat(p.lat) : cleanCenter[0]),
        lng: isNum(p.lng) ? p.lng : (isNum(parseFloat(p.lng)) ? parseFloat(p.lng) : cleanCenter[1])
    }));

    const cleanRoutePath = (data.routePath || []).filter(coord =>
        Array.isArray(coord) && isNum(coord[0]) && isNum(coord[1])
    );

    const cleanSteps = (data.navigationSteps || []).map(step => {
        // Slim navigation steps significantly
        const slimStep = {
            distance: step.distance,
            duration: step.duration,
            name: step.name,
            maneuver: step.maneuver ? {
                location: step.maneuver.location,
                type: step.maneuver.type,
                modifier: step.maneuver.modifier
                // STRIPPED: instruction (long text), bearing_after, etc.
            } : null
        };
        return slimStep;
    });

    return {
        ...data,
        center: cleanCenter,
        pois: cleanPois,
        // originalPois is often redundant if it matches pois exactly
        originalPois: data.originalPois ? data.originalPois.map(p => ({
            ...slimPoiForStorage(p),
            lat: isNum(p.lat) ? p.lat : (isNum(parseFloat(p.lat)) ? parseFloat(p.lat) : cleanCenter[0]),
            lng: isNum(p.lng) ? p.lng : (isNum(parseFloat(p.lng)) ? parseFloat(p.lng) : cleanCenter[1])
        })) : null,
        routePath: cleanRoutePath,
        navigationSteps: cleanSteps
    };
};


/**
 * Main Route Path & Steps Calculation
 */
export const calculateRoutePath = async (pois, center, mode, isRoundtrip, isRouteEditMode, language = 'nl', endCenter = null) => {
    if (!center || !Array.isArray(center) || center.length < 2) {
        return null;
    }

    const getCoord = (p) => {
        const lat = typeof p.lat === 'number' && !isNaN(p.lat) ? p.lat : (typeof p.latitude === 'number' ? p.latitude : parseFloat(p.lat || p.latitude));
        const lng = typeof p.lng === 'number' && !isNaN(p.lng) ? p.lng : (typeof p.lon === 'number' ? p.lon : (typeof p.longitude === 'number' ? p.longitude : parseFloat(p.lng || p.lon || p.longitude)));
        return [lng, lat];
    };

    const waypoints = [
        `${center[1]},${center[0]}`,
        ...pois.map(p => {
            const [lng, lat] = getCoord(p);
            return `${lng},${lat}`;
        })
    ];

    if (endCenter) {
        waypoints.push(`${endCenter[1]},${endCenter[0]}`);
    } else if (isRoundtrip && !isRouteEditMode) {
        waypoints.push(`${center[1]},${center[0]}`);
    }

    try {
        const profile = mode === 'cycling' ? 'bike' : 'foot';
        const osrmUrl = `https://routing.openstreetmap.de/routed-${profile}/route/v1/${profile}/${waypoints.join(';')}?steps=true&geometries=geojson&overview=full`;

        const res = await fetch(osrmUrl);
        const json = await res.json();

        if (json.code === 'Ok' && json.routes && json.routes.length > 0) {
            const route = json.routes[0];
            const path = transformOSRMCoords(route.geometry.coordinates, 'calculated_route');
            const dist = route.distance / 1000;
            let walkDist = 0;
            let steps = [];

            if (route.legs && route.legs.length >= 1) {
                const poiLegs = (isRoundtrip || endCenter) ? route.legs.slice(1, -1) : route.legs.slice(1);
                walkDist = poiLegs.reduce((acc, leg) => acc + leg.distance, 0) / 1000;

                route.legs.forEach((leg, legIdx) => {
                    if (leg.steps) {
                        const rawCoords = leg.steps.flatMap((s, idx) => {
                            if (!s.geometry || !s.geometry.coordinates) return [];
                            const coords = s.geometry.coordinates;
                            return idx === 0 ? coords : coords.slice(1);
                        });
                        leg.geometry = {
                            type: 'LineString',
                            coordinates: sanitizePath(rawCoords, `leg_${legIdx}_geometry`)
                        };
                    }
                });
                steps = route.legs.flatMap(l => l.steps).map(step => {
                    if (step.maneuver && step.maneuver.location && !isValidCoord(step.maneuver.location)) {
                        return { ...step, maneuver: { ...step.maneuver, location: null } };
                    }
                    return step;
                });
            }
            return { path, dist, walkDist, steps, legs: route.legs };
        }
    } catch (e) {
        console.warn("Route calc failed", e);
    }

    // Fallback: Straight lines
    const pts = [center, ...pois.map(p => {
        const [lng, lat] = getCoord(p);
        return [lat, lng];
    })];
    if (isRoundtrip) pts.push(center);

    const fallbackLegs = pts.slice(0, -1).map((p, i) => {
        const next = pts[i + 1];
        return {
            distance: getDistance(p[0], p[1], next[0], next[1]) * 1000,
            duration: (getDistance(p[0], p[1], next[0], next[1]) / (mode === 'cycling' ? 15 : 5)) * 3600,
            steps: [],
            geometry: {
                type: 'LineString',
                coordinates: sanitizePath([[p[1], p[0]], [next[1], next[0]]], 'fallback_leg')
            }
        };
    });

    const fallbackSteps = pois.map(p => {
        const [lng, lat] = getCoord(p);
        return {
            maneuver: {
                type: 'depart',
                modifier: 'straight',
                location: isValidCoord([lng, lat]) ? [lng, lat] : null
            },
            name: language === 'nl' ? `Ga naar ${p.name || 'bestemming'}` : `Walk to ${p.name || 'destination'}`,
            distance: 0
        };
    }).filter(s => s.maneuver.location !== null);

    let fallbackDist = 0;
    let fallbackWalkDist = 0;
    let prevPoint = { lat: center[0], lng: center[1] };
    pois.forEach((p, idx) => {
        const [lng, lat] = getCoord(p);
        if (!isNaN(prevPoint.lat) && !isNaN(prevPoint.lng) && !isNaN(lat) && !isNaN(lng)) {
            const d = getDistance(prevPoint.lat, prevPoint.lng, lat, lng);
            fallbackDist += d;
            if (idx > 0) fallbackWalkDist += d;
        }
        prevPoint = { lat, lng };
    });
    if (isRoundtrip && pois.length > 0) {
        const [lng, lat] = getCoord(pois[pois.length - 1]);
        if (!isNaN(lat) && !isNaN(lng)) {
            fallbackDist += getDistance(lat, lng, center[0], center[1]);
        }
    }

    return {
        path: pts,
        dist: Number((fallbackDist * 1.3) || 0),
        walkDist: Number((fallbackWalkDist * 1.3) || 0),
        steps: fallbackSteps,
        legs: fallbackLegs
    };
};
