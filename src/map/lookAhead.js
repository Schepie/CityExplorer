import { calcDistance } from '../utils/geometry';

/**
 * Finds a point on the polyline that is distanceMeters away from the current user position.
 * @param {Array<[number, number]>} polyline - Array of [lat, lng]
 * @param {Object} userLocation - {lat, lng}
 * @param {number} distanceMeters - Distance in meters to look ahead
 * @returns {Object|null} {lat, lng} of the look-ahead point
 */
export const findPointAhead = (polyline, userLocation, distanceMeters) => {
    if (!polyline || polyline.length < 2 || !userLocation) return null;

    const distanceKm = distanceMeters / 1000;

    // 1. Find the segment closest to the user (snapping)
    let minD = Infinity;
    let closestIdx = 0;

    for (let i = 0; i < polyline.length - 1; i++) {
        const p1 = { lat: polyline[i][0], lng: polyline[i][1] };
        const p2 = { lat: polyline[i + 1][0], lng: polyline[i + 1][1] };

        // Simple point-to-point distance for snapping is usually fine for look-ahead
        const d = calcDistance(userLocation, p1);
        if (d < minD) {
            minD = d;
            closestIdx = i;
        }
    }

    // 2. Accumulate distance from that index forward
    let accumulatedKm = 0;
    for (let i = closestIdx; i < polyline.length - 1; i++) {
        const p1 = { lat: polyline[i][0], lng: polyline[i][1] };
        const p2 = { lat: polyline[i + 1][0], lng: polyline[i + 1][1] };
        const segmentDistKm = calcDistance(p1, p2);

        if (accumulatedKm + segmentDistKm >= distanceKm) {
            // Target point is on this segment
            const remainingKm = distanceKm - accumulatedKm;
            const ratio = remainingKm / segmentDistKm;

            return {
                lat: p1.lat + (p2.lat - p1.lat) * ratio,
                lng: p1.lng + (p2.lng - p1.lng) * ratio
            };
        }

        accumulatedKm += segmentDistKm;
    }

    // If we reach the end, return the last point
    const last = polyline[polyline.length - 1];
    return { lat: last[0], lng: last[1] };
};
