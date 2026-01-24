/**
 * Calculates the distance between two coordinates in km (Haversine formula).
 */
export const calcDistance = (p1, p2) => {
    if (!p1 || !p2) return Infinity;
    const R = 6371; // Earth radius in km
    const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
    const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Calculates the shortest distance from a point to a line segment.
 * Returns distance in km.
 * 
 * @param {Object} point {lat, lng}
 * @param {Object} start {lat, lng} (Segment Start)
 * @param {Object} end {lat, lng} (Segment End)
 */
export const getDistanceToSegment = (point, start, end) => {
    const x = point.lng;
    const y = point.lat;
    const x1 = start.lng;
    const y1 = start.lat;
    const x2 = end.lng;
    const y2 = end.lat;

    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) // in case of 0 length line
        param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    }
    else if (param > 1) {
        xx = x2;
        yy = y2;
    }
    else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    // Return distance to the closest point on segment (xx, yy)
    // We reuse calcDistance for accuracy over simply returning euclidean
    return calcDistance(point, { lat: yy, lng: xx });
};

/**
 * Checks if a location is loosely "on" a given polyline path.
 * 
 * @param {Object} location {lat, lng}
 * @param {Array} pathCoordinates Array of [lat, lng] arrays
 * @param {number} toleranceKm Max allowed distance from path (default 0.03 = 30m)
 */
export const isLocationOnPath = (location, pathCoordinates, toleranceKm = 0.03) => {
    if (!location || !pathCoordinates || pathCoordinates.length < 2) return false;

    // Check distance to every segment in the path
    // Optimization: Depending on path length, this could be heavy.
    // For navigation legs (usually short), linear scan is fine.
    for (let i = 0; i < pathCoordinates.length - 1; i++) {
        const start = { lat: pathCoordinates[i][0], lng: pathCoordinates[i][1] };
        const end = { lat: pathCoordinates[i + 1][0], lng: pathCoordinates[i + 1][1] };

        const d = getDistanceToSegment(location, start, end);
        if (d <= toleranceKm) return true;
    }

    return false;
};
